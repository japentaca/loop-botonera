# AGENT_DOCS.md (Agent Guide)

> Machine-readable, actionable documentation for coding agents working on the `loop-botonera` project.

This document contains a precise description of repository structure, key modules, public APIs, architectural patterns, coding conventions, performance mechanisms, test suggestions, and step-by-step guidance to safely implement and extend features.

---

## 1. Quick project summary
- Platform: Frontend web app built with Vue 3 + Vite
- State manager: Pinia
- Audio engine: Tone.js (v15)
- UI libraries: PrimeVue (and primeicons)
- Purpose: Loop synthesizer / pattern generator with evolution & energy balance systems

## 2. Main dependencies (from `package.json`)
- `vue` (3.x)
- `vite` (v7.x)
- `pinia`
- `tone` (Tone.js for audio)
- `primevue`, `primeicons` for UI components

---

## 3. File & module map (high-level)
- `src/` — main app source
  - `main.js` — app bootstrap (Pinia + PrimeVue + global components)
  - `App.vue` — top-level orchestration; user-driven audio initialization
  - `components/` — UI components (LoopGrid, LoopCard, SynthEditor, PatternSettings, etc.)
  - `composables/` — centralized composables: `useAudio`, `useNotesMatrix`, `useMusic`, `useMelodicGenerator`, `musicTheory`, `musicUtils`
  - `stores/` — Pinia stores
    - `audioStore.js` — main orchestration store (single source of truth coordinating modules)
    - `presetStore.js` — preset management + auto-save
    - `synthStore.js` — synth editor modal & changes
    - `stores/modules/` — internal modules used by `audioStore`: `audioEngine.js`, `loopManager.js`, `energyManager.js`, `evolutionSystem.js`
  - `services/` — utility services like `presetService.js` and `counterpointService.js`
  - `utils/` — helper utils (e.g., `noteUtils.js`)
- `vite.config.js` — dev server config
- `AGENTS.md` — operational instructions for humans/agents (special notes)

---

## 4. Architectural Principles & Patterns
- Single source of truth for notes: `useNotesMatrix` composable centralizes note storage, density/metadata, and note operations. All pattern generation and edits should use `notesMatrix` API, not direct loop private fields.
- Audio orchestration: `audioStore` coordinates modules and exposes public actions (initAudio, togglePlay, loop control, synth updates, global settings, evolution triggers).
- Separation of responsibilities:
  - `audioEngine` handles Tone.js initialization, transport, audio chains, and low-level audio ops.
  - `loopManager` creates loop instances, handles audio chain creation, maps UI actions to matrix updates.
  - `energyManager` computes sonic energy and auto-balances volumes/density across loops.
  - `evolutionSystem` implements evolution strategies via intents; it must not modify metadata directly (only generate intents or use the `audioStore` unified API.)
- Preset lifecycle: Preset store coordinates capturing, applying and saving state; `presetService` is responsible for localStorage persistence.
- Debounce & batching: Many operations are debounced or batched (notifyPresetChanges, energy checks, matrix reactivity triggers) for performance.

---

## 5. Initialization & Runtime Flow (critical)
- App boot: `main.js` mounts Vue and registers global components.
- User gesture required for audio initialization (WebAudio policy): `App.vue`'s start audio button calls `audioStore.initAudio()`. Sequence used at startup:
  1. Audio engine Tone.js init (`audioEngine.initAudio()`)
  2. Transport callback setup (`audioEngine.setupTransportCallback(playActiveLoops)`) — but loops are not yet initialized.
  3. Preset system initialization (`presetStore.initialize()`), which may trigger `applyPresetToState`.
  4. `audioStore.initMusicComponents()` which builds loop objects and upgrades them with audio chains.
  5. `presetStore.retryLoadCurrentPreset()` after loops initialized; this ensures presets properly apply to loops.

Important: Do not start audio from agent scripts unless the environment can provide a user gesture. Tone requires a user gesture for the audio context to start — keep interactions behind `audioStore.initAudio()`.

---

## 6. Public APIs & Exposed Methods (for agents to use)
All the following refer to exported functions in the stores, modules, composables and services.

### 6.1 audioStore (Pinia store)
- State exports (refs / computed): `audioInitialized`, `isPlaying`, `currentPulse`, `currentBeat`, `tempo`, `masterVol`, `loops`, `currentScale`, `scales`, `globalDensityBias`, `notesMatrix`, ...
- Functions (key):
  - initAudio(): initialize Tone.js audio engine
  - initMusicComponents(): initialize loops and notes matrix after presets
  - togglePlay(): start/pause transport
  - toggleLoop(id): toggle active state for loop id
  - setLoopActive(id, boolean): idempotent setter
  - updateLoopParam(id, param, value): update `length`, `volume`, `delayAmount`, `reverbAmount`, `pan`, etc.
  - updateLoopSynth(loopId, synthConfig): update synth config for loop and create audio chain
  - regenerateLoop, regenerateAllLoops, generateLoopPattern: generation APIs — prefer these for new generators
  - updateScale(newScale): set global scale and quantize loops
  - updateTempo(newTempo), updateMasterVolume(volume), updateDelayDivision(division)
  - startAutoEvolve(), stopAutoEvolve(), updateEvolveInterval(), updateEvolveIntensity()
  - updateGlobalDensityBias(value) — global density bias is normalized 0..1
  - notesMatrix: `initializeMatrix`, `updateLoopMetadata`, `getLoopNotes`, etc. (expose composable itself)

Note: For programmatic changes that should be persisted in presets, call these store methods (they trigger `notifyPresetChanges()` and/or `presetStore.startBatchMode()`, `endBatchMode()` as needed).

### 6.2 loopManager (module)
- Methods: createBasicLoop, createLoop, initializeLoops(scaleName, audioEngine, getAdaptiveVolume, getAdaptiveDensity), upgradeLoopsWithAudio(audioEngine), toggleLoop(id), updateLoopParam, updateLoopSynth, regenerateLoop, playLoopNote(loop, audioEngine, step, time), applySparseDistribution, getMatrixStats.
- Notes: Loop objects are returned from `createLoop` and stored in `audioStore.loops`.

### 6.3 audioEngine (module)
- Methods: initAudio(), setupTransportCallback(callback), togglePlay(), startTransport(), stopTransport(), updateTempo(), updateMasterVolume(), updateDelayDivision(), createAudioChain(synthConfig, effectsConfig), playNote(audioChain, midiNote, duration, velocity, time).
- Danger: Always check `audioInitialized.value` before creating audio chains or manipulating audio objects.

### 6.4 notesMatrix (composable) — main functions
- Constants: MAX_LOOPS, MAX_STEPS
- Methods: initializeMatrix(), initializeLoop(loopId, options), setLoopActive(loopId, boolean), updateLoopMetadata(loopId, metadata), getLoopNotes(loopId), setLoopNotes(loopId, notes), setLoopNote(loopId, step, note), clearLoopNote(loopId, step), generateLoopNotes(loopId, options), selectPatternType(loopId), quantizeLoop(loopId, scaleName), transposeLoop, rotateLoop, invertLoop, mutateLoop, copyLoop, exportMatrix(), importMatrix(data), getMatrixStats(), getLoopNoteDensity(loopId), setManualDensity, setAutoDensity
- Important: `loopMetadata` structure is authoritative for densities / generation configs. Agents must use these APIs to change loops.

### 6.5 energyManager (module)
- Methods: calculateSonicEnergy(loops), getAdaptiveDensity(loops, baseLength?), computeDynamicDensity(loops), getAdaptiveVolume(loops, loopId), adjustAllLoopVolumes(loops), checkAndBalanceEnergy(loops), suggestEnergyOptimizations(loops)
- Note: `audioStore` wires energy manager and triggers `updateNumLoops()` and `adjustAllLoopVolumes()` where appropriate.

### 6.6 evolutionSystem (module)
- Methods: evolveMatrixLoop(loopId, notesMatrix, intensity), evolveMultipleMatrixLoops(loopIds, notesMatrix, intensity), evolveMultipleLoops(loops, globalScaleIntervals, options), applyMatrixMutation(loopId, notesMatrix, mutationType, params), updateEvolutionSettings(settings)
- Important: evolutionSystem should not mutate metadata of loops (scale, density mode, etc). It should produce intents and apply them through audioStore or notesMatrix API.

### 6.7 presetStore (Pinia store)
- Methods: initialize(), loadPresets(), createPreset(name), createDefaultPreset(), loadPreset(id), saveCurrentPreset(), deletePreset(), duplicatePreset(), applyPresetToState(preset, options), captureCurrentState(), startBatchMode(), endBatchMode()
- Important: Preset store has `isLoadingPreset` flag to temporarily prevent autosave while applying a preset. When making programmatic changes that should be saved, use `presetStore.handleChange()` or rely on `audioStore` notifications.

### 6.8 presetService (local storage helper)
- Methods: getAllPresets(), createPreset(), updatePreset(), getPresetById(), deletePreset(), duplicatePreset(), exportPreset(), importPreset(), clearAllPresets()

---

## 7. Conventions & Safe Patterns (codified rules for agents)
- Always prefer to use the public store/composable APIs. For example:
  - Change loop length via `audioStore.updateLoopParam(loopId, 'length', newLen)`.
  - Change synth via `audioStore.updateLoopSynth(loopId, synthConfig)`.
  - Change metadata via `audioStore.updateLoopMetadata(loopId, metadata)` or `notesMatrix.updateLoopMetadata`.
- Do NOT modify `loop.synth` or `loop` internals directly without using wrapper functions. The `loopManager` and `audioStore` manage lifecycle and side effects.
- Do not change the global scale by mutating `notesMatrix`; use `audioStore.updateScale()`.
- Preserve `evolutionSystem` rule: it must not modify metadata or call `notesMatrix.updateLoopMetadata` to change user settings; use generation APIs instead.
- Use `presetStore.startBatchMode()` and `endBatchMode()` around bulk or auto-evolution changes so autosave is handled appropriately (avoids excessive writes).
- Respect `AGENTS.md`: Do not start the dev server in environments where HRM (hot reload) behaves badly; use the dev environment in controlled mode.
- Use `window.__LOOP_DEBUG` for debug traces when running in dev or manual testing modes.
- When adding or changing an API that affects presets, ensure `presetStore.handleChange()` is called or that the update flows through `audioStore` for auto-save.

---

## 8. Performance & Stability Notes (useful for agents)
- `notesMatrix` uses typed arrays, caches and a `batchUpdate()` mechanism to collect updates and trigger reactivity debounced at ~16ms.
- Debounce timings used in code (important if changing behavior):
  - notifyPresetChanges: 300ms
  - energyCheck debounce: 750ms
  - applyDynamicDensities: 250ms
- `energyManager` caches energy calculations with TTL 500ms to reduce recalculation.
- Avoid heavy synchronous work in hot paths (transport callback occurs every 16th note). Use optimized cached active loop indices instead of expensive `filter` operations.
- Use `triggerRef` and `shallowRef` patterns where applicable for performance.

---

## 9. Testing & Debugging guidance for agents
- Human debug: Set `window.__LOOP_DEBUG = true` to enable verbose logs in run-time.
- Unit tests: The repo currently has `tests/integration` — there are no unit harnesses included by default. If adding features, prefer small functions that are easily testable in unit tests.
- Test plan for a change (recommended):
  - Ensure API changes are backward-compatible.
  - Add unit tests for pure functions in `utils/` and `composables/`.
  - Add integration e2e tests for `useNotesMatrix` or `useMelodicGenerator` if feasible.
  - For audio chains, avoid auto-playing audio in tests; mock `Tone` contexts where necessary.
- Local run commands (caveat: AGENTS.md warns not to start dev server if HRM behavior is undesired):
  - Install: `npm install`  (use local environment)
  - Dev server: `npm run dev`  (ensure user interaction for `Tone.start()`)
  - Build: `npm run build`
  - Preview: `npm run preview`

---

## 10. How to add a new feature (checklist)
This is a canonical process to add a feature (e.g., new UI control, new module to affect loop generation, a new effect, or update the evolution system).

1. Design the feature and identify which module(s) will be impacted (stores, module, composable, UI).
2. Create or modify a module:
   - If a new module is needed, create it under `src/stores/modules/` and export it for `audioStore` to import. Example: `useMyNewEffect.js` with a functional API.
3. Wire into `audioStore`:
   - Import your module in `audioStore.js`, build module instance during store init, update initialization flow where necessary.
   - Expose minimal and clear methods that other modules or components can call.
4. Use `notesMatrix` for note-related changes. Update metadata via `notesMatrix.updateLoopMetadata`. Do not mutate internal arrays directly unless absolutely required.
5. Use `audioStore.notifyPresetChanges()` or simply rely on `audioStore`/`presetStore` methods to call for autosave. If the change is batched (like during evolution), call `presetStore.startBatchMode()` and `endBatchMode()`.
6. Add unit tests for any new pure logic function and integration tests for store-level flows that change core behavior.
7. Update UI components under `src/components` and hook to store APIs. For new global controls, update header components.
8. Add docs (update `AGENT_DOCS.md`, `AGENTS.md` if needed.)

---

## 11. Feature Implementation Example (add a new effect toggle)
Minimal steps to add a global `bitcrusher` effect that can be toggled per loop:

1. Add new file: `src/stores/modules/bitcrusher.js` (or integrate in audioEngine if low-level global effect)
2. Example module skeleton (pseudocode):
```js
export const useBitCrusher = () => {
  const enabled = ref(false)
  const amount = ref(0.1)
  const node = null
  const initialize = (audioEngine) => {
    if (!audioEngine.audioInitialized.value) throw new Error('Audio not initialized')
    node = new Tone.BitCrusher(amount.value).connect(audioEngine.masterGain)
  }
  const setEnabled = (on) => { enabled.value = !!on; if (on) node.connect(audioEngine.masterGain) else node.disconnect() }
  return { initialize, enabled, setEnabled, amount }
}
```
3. Integrate within `audioStore` during initialization (call `bitcrusher.initialize(audioEngine)`), expose toggles.
4. Add UI toggle in `AppHeader` or `SynthEditor` to set bitcrusher state using `audioStore.setBitCrusherEnabled(true/false)`.
5. Update preset capture/apply: `captureCurrentState` should record `bitcrusher.enabled` state and `applyPresetToState` should set it when applying.
6. Add test and small suite to verify the API exists and toggles the effect.

---

## 12. Preset & Autosave notes (for agents)
- PresetCapture intentionally saves loop configs (not raw note arrays). The notes matrix is regenerated on load (to keep presets smaller). If you want to persist the `notesMatrix` data, use `presetService` to export matrix via `notesMatrix.exportMatrix` and save it in the preset structure explicitly.
- Avoid saving large raw note payloads unless necessary.
- Use `presetStore.startBatchMode()`/`endBatchMode()` to avoid many autosaves.

---

## 13. Dangerous operations & quick failsafe
- Dangerous: Forcing audio context start in an automated job (CI or agent) — avoid.
- Dangerous: Direct mutation of `notesMatrix` internal arrays; prefer `notesMatrix` setters.
- Danger: Running `npm run dev` from an agent without a proper headless environment (Tone/Tone.start may block). AGENTS.md warns: `don't start development server, it uses HRM`. If you need to test, do it in controlled environment.

---

## 14. Additional notes for agents
- The code uses Spanish comments and many console logs in Spanish; maintain language of comments if modifying original files.
- Avoid adding new synchronous or heavy operations in transport callbacks (use `requestAnimationFrame`, `debounce`, or `batchUpdate`).
- Use available `utils/` functions for common logic (e.g., `generatePossibleNotes` in `noteUtils.js`).

---

## 15. Useful grep/search shortcuts for agents (patterns to find typical code)
- `audioEngine` — search for `initAudio`, `setupTransportCallback`.
- `notesMatrix` — search `updateLoopMetadata`, `generateLoopNotes`, `getLoopNotes`.
- `evolutionSystem` — search `evolution` and `evolveMultipleLoops`.
- Look for `placeholder: 'TODO'` or `// TODO:` tags for feature markers.

---

## 16. Example agent tasks (quick starters)
- Add per-loop effect sends (reverb/bitcrusher), make them editable via `UpdateLoopParam`.
- Add export/import of exact notes in presets (persist `notesMatrix.exportMatrix`).
- Add new evolution strategy plugin that produces regenerative intents without changing metadata.

---

## 17. Agent test checklist before PR
- Ensure code uses `audioStore` and `notesMatrix` APIs, not direct mutation.
- Ensure autosave and preset flows work via `presetStore` in normal and batch modes.
- Verify no blocking synchronous operations were introduced in the transport callback.
- Confirm `Tone` objects are created only after `audioEngine.initAudio()`.
- Add or update tests for new code paths where relevant.

---

## 18. Where to look first when changing behavior
- `src/stores/audioStore.js` — global orchestration and best place to integrate cross-cutting changes.
- `src/composables/useNotesMatrix.js` — notes generation & metadata; always use this API for note changes.
- `src/stores/modules/*` — per-subsystem code. Add modules here and expose their APIs via audioStore.
- `src/components/LoopCard.vue` and `LoopGrid.vue` — UI layer for loops; modify to add UI controls.

---

## 19. Misc (developer preferences & constraints)
- The repository prefers failing early for errors rather than heavy defensive code. Keep new code compatible with that preference.

---

## 20. Agent Operational Constraints & Permissions
These are rules that any automated agent (including new coding agents) MUST follow when contributing to this repository:

- Request explicit permission before installing or modifying any NPM packages (including during development or CI tasks).
- Maintain documentation in sync when code changes are made: update `AGENT_DOCS.md`, `AGENTS.md`, and any related documentation files as part of the change.
- Do not write separate change reports; instead update the relevant documentation and inline comments so the repo stays self-contained.
- If the agent needs additional clarification from a human, ask questions one at a time and wait for the response before continuing.

Notes on implementation:
- Agents MUST not run `npm install` or update `package.json` without explicit permission from the repo owner (ask: 'Do you allow me to install npm packages now?').
- When making changes to code, the agent must also update `AGENT_DOCS.md` to reflect new APIs, shortcuts, or behavior changes so documentation always remains in sync.
- Agents should use `presetStore.startBatchMode()` and `endBatchMode()` around bulk changes to avoid autosave thrash, and should not attempt to circumvent existing autosave semantics.

---

## 22. Implementation Preference: Vanilla JavaScript & Minimal Reactivity
This project uses Vue for UI and Pinia for store state, but agent code should prefer plain JavaScript modules and avoid adding new reactive constructs unless required for the UI.

Guidelines for new code:
- Implement core algorithms, generators, and utilities as plain (vanilla) JavaScript modules exported as functions or factory objects. Avoid using `ref`, `reactive`, `computed`, or other Vue reactivity APIs inside these modules.
- Keep stateful reactivity at the store boundary (e.g. `audioStore`, `presetStore`). Stores may convert the plain JS module outputs into `ref`/`computed` for peer reactivity.
- When a module needs to expose a mutable state, optional pattern:
  - Implement a plain JS factory that returns methods over internal plain JS state.
  - Wrap it in Vue's reactivity only in the store: const module = createModule(); const moduleRef = { value: module } or store will expose read-only values to UI.
- For audio scheduling, high-frequency loops, or performance-sensitive parts (e.g., note generation), use vanilla JS with efficient typed arrays, caches, and synchronous pure functions.
- If a module truly requires reactivity internally (rare), keep it isolated and explicit with clear reasoning in the module comments.

Examples (vanilla module factory):
```js
// src/stores/modules/myUtility.js (plain JS)
export function createMyUtility(opts = {}) {
  let _state = { count: 0 }
  function increment(by = 1) { _state.count += by }
  function getState() { return { ..._state } }
  return { increment, getState }
}

// In audioStore.js (wrap for reactivity as needed)
import { createMyUtility } from '../stores/modules/myUtility'
const myUtility = createMyUtility()
// If the UI needs reactivity, expose derived readonly refs from the store
// e.g., const count = computed(() => myUtility.getState().count)
```

Notes and exceptions:
- Vue components (UI layer) will continue to use reactivity as needed to render and respond to user input.
- Existing modules that are already using Vue reactivity are not automatically refactored. Prefer implementing new modules as vanilla JS.
- This rule is a preference and helps keep modules framework agnostic — if you need to break this rule, ask a question and explain the justification.

---

## 21. Per-file API Reference (quick surface)
This section contains concise reference tables for the most important files. Each entry lists the exported API and a minimal example usage.

### `src/stores/audioStore.js` (Pinia store)
- State (refs/computed): `audioInitialized`, `isPlaying`, `currentPulse`, `tempo`, `masterVol`, `loops`, `currentScale`, `notesMatrix`, `globalDensityBias`
- Key functions:
  - `initAudio()` — Initialize Tone.js engine.
  - `initMusicComponents()` — Initialize loops and notes matrix.
  - `togglePlay()` — Play/pause transport.
  - `toggleLoop(id)`, `setLoopActive(id, boolean)` — toggle or set loop active.
  - `updateLoopParam(id, param, value)` — change a loop parameter (length, volume, pan, delayAmount, etc.).
  - `updateLoopSynth(loopId, synthConfig)` — change loop synth config.
  - `regenerateLoop(id)`, `regenerateAllLoops()` — use to trigger pattern regen.
  - `updateScale(newScale)` — set global scale and quantize loops.
  - `startAutoEvolve()`, `stopAutoEvolve()` — auto-evolution controls.

Example:
```js
const audioStore = useAudioStore()
await audioStore.initAudio()
audioStore.updateTempo(120)
audioStore.toggleLoop(0)
```

### `src/composables/useNotesMatrix.js` (central notes storage/composable)
- Constants: `MAX_LOOPS`, `MAX_STEPS`
- Key functions:
  - `initializeMatrix()`, `initializeLoop(loopId, options)`
  - `setLoopActive(loopId, boolean)`, `updateLoopMetadata(loopId, metadata)`
  - `getLoopNotes(loopId)`, `setLoopNotes(loopId, notes)`, `setLoopNote(loopId, step, note)`
  - `generateLoopNotes(loopId, options)`, `selectPatternType(loopId)`
  - `quantizeLoop(loopId, scaleName)`, `transposeLoop`, `rotateLoop`, `invertLoop`, `mutateLoop`
  - `exportMatrix()`, `importMatrix(data)`, `getMatrixStats()`

Example:
```js
const notesMatrix = useNotesMatrix()
notesMatrix.initializeMatrix()
notesMatrix.initializeLoop(0, { length: 16, baseNote: 60 })
notesMatrix.generateLoopNotes(0)
const notes = notesMatrix.getLoopNotes(0)
```

### `src/stores/modules/audioEngine.js`
- State: `audioInitialized`, `isPlaying`, `currentPulse`, `tempo`, `masterVol`, `delayDivision`.
- Key functions: `initAudio()`, `setupTransportCallback(callback)`, `togglePlay()`, `startTransport()`, `stopTransport()`, `updateTempo(newTempo)`, `updateMasterVolume(newVolume)`, `createAudioChain(synthConfig, effectsConfig)`, `playNote(audioChain, midiNote, duration, velocity, time)`.

Example:
```js
const audioEngine = useAudioEngine()
await audioEngine.initAudio()
const chain = audioEngine.createAudioChain({ oscillator: { type: 'sine' } }, { volume: 0.5 })
audioEngine.playNote(chain, 60)
```

### `src/stores/modules/loopManager.js`
- State: `loops`, `NUM_LOOPS`.
- Key functions: `createBasicLoop`, `createLoop`, `initializeLoops(scaleName, audioEngine, getAdaptiveVolume, getAdaptiveDensity)`, `upgradeLoopsWithAudio(audioEngine)`, `toggleLoop`, `updateLoopParam`, `updateLoopSynth`, `regenerateLoop`, `playLoopNote(loop, audioEngine, step, time)`, `applySparseDistribution`.

Example:
```js
const loopManager = useLoopManager(notesMatrix)
loopManager.initializeLoops('major', audioEngine)
loopManager.toggleLoop(0)
loopManager.regenerateLoop(0, useScales().getScale('major'), 'major')
```

### `src/stores/modules/energyManager.js`
- State: `energyManagementEnabled`, `maxSonicEnergy`, `energyReductionFactor`.
- Key functions: `calculateSonicEnergy(loops)`, `getAdaptiveDensity(loops)`, `getAdaptiveVolume(loops, loopId)`, `adjustAllLoopVolumes(loops)`, `checkAndBalanceEnergy(loops)`, `getEnergyMetrics(loops)`, `suggestEnergyOptimizations(loops)`.

Example:
```js
const stats = energyManager.getEnergyMetrics(audioStore.loops)
if (energyManager.checkAndBalanceEnergy(audioStore.loops)) {
  // volumes adjusted
}
```

### `src/stores/modules/evolutionSystem.js`
- State: `autoEvolutionEnabled`, `evolutionInterval`, `evolutionIntensity`.
- Key functions: `evolveMultipleLoops(loops, globalScaleIntervals, options)`, `evolveMatrixLoop(loopId, notesMatrix, intensity)`, `applyMatrixMutation(loopId, notesMatrix, mutationType, params)`, `updateEvolutionSettings(settings)`, `evolveMultipleMatrixLoops(loopIds, notesMatrix, intensity)`.

Example:
```js
evolutionSystem.updateEvolutionSettings({ enabled: true, interval: 8, intensity: 0.2 })
evolutionSystem.forceEvolution(audioStore.loops, audioStore.getScale(audioStore.currentScale))
```

### `src/stores/presetStore.js` (Pinia store)
- State: `presets`, `currentPresetId`, `isLoading`, `hasUnsavedChanges`, `autoSaveEnabled`.
- Key functions: `initialize()`, `loadPresets()`, `createPreset(name)`, `createDefaultPreset()`, `loadPreset(id)`, `saveCurrentPreset()`, `renamePreset()`, `deletePreset()`, `duplicatePreset()`, `applyPresetToState(preset, options)`, `captureCurrentState()`, `startBatchMode()`, `endBatchMode()`.

Example:
```js
await presetStore.initialize()
await presetStore.createDefaultPreset()
presetStore.createPreset('My Preset')
```

### `src/services/presetService.js` (localStorage helper)
- Key functions: `getAllPresets()`, `createPreset()`, `getPresetById()`, `updatePreset()`, `deletePreset()`, `duplicatePreset()`, `exportPreset()`, `importPreset()`.

Example:
```js
const presets = getAllPresets()
const p = createPreset({ name: 'auto' })
```

### `src/stores/synthStore.js`
- State: `isModalOpen`, `currentLoopId`, `tempSynthConfig`.
- Key functions: `openSynthEditor(loopId)`, `closeSynthEditor()`, `updateSynthType(type)`, `updateOscillatorType(type)`, `updateEnvelopeParam(param, value)`, `updateHarmonicity(value)`, `updateModulationIndex(value)`, `previewSynth()`, `applySynthConfig()`, `cancelSynthChanges()`.

Example:
```js
synthStore.openSynthEditor(0)
synthStore.updateOscillatorType('sawtooth')
synthStore.applySynthConfig()
```

### `src/composables/useMelodicGenerator.js`
- Key functions: `generateLoopMelody(loopId, options)`, `regenerateLoop(loopId, currentPulse)`, `regenerateAllLoops(currentPulse)`, `selectPatternType(loopId)`, `applyCounterpoint(loopId, notes, activeLoops)`.

Example:
```js
const mg = useMelodicGenerator(notesMatrix)
mg.regenerateLoop(0)
```

### `src/composables/useAudio.js` (Tone wrappers)
- Key functions: `initializeAudio()`, `createEffectsChain(masterVolume)`, `updateDelayTime(tempo)`, `updateMasterVolume(volume)`, `setupTransport(callback)`, `startTransport()`, `stopTransport()`.

Example:
```js
const { initializeAudio, createEffectsChain } = useAudio()
await initializeAudio()
await createEffectsChain(0.8)
```

*** End Patch
- Observe the repository's existing style: frequently uses Spanish comments and logs; be consistent when modifying existing files.

---

## 20. Final notes & how to ask for help
When in doubt, you should:
1. Add a small PR with changes and thorough tests.
2. Run a local validation with `npm run dev` (only if environment allows user gesture for Tone) and use `window.__LOOP_DEBUG = true` for debugging.
3. Follow the flow: audio initialization -> preset init -> music components init -> retry preset load.

Good luck implementing features — rely on the `audioStore` / `notesMatrix` / `presetStore` flows and avoid direct internal mutation.
