## Goals
- Single-source, time-aligned regeneration/evolution to prevent duplicated work and console noise.
- Convert evolver to emit intents; apply centrally in the store with batching and deduplication.
- Align evolution scheduling with transport beats/measures.

## Scope
- Core orchestration in `src/stores/audioStore.js`.
- Evolver APIs in `src/stores/modules/evolutionSystem.js`.
- Generation calls in `src/composables/useMelodicGenerator.js`.
- Loop state updates in `src/stores/modules/loopManager.js`.
- UI continues using existing audioStore actions.

## Key Design Changes
### Single Orchestrator
- Only `audioStore` performs side effects (regenerate, quantize, loop updates).
- UI triggers `audioStore` actions (`regenerateAllMelodies`, per-loop regen, scale change).

### Intent-Based Evolver
- `evolutionSystem.evolveMultipleLoops(...)` returns a plan (intents), no side effects:
  - `[{ type: 'regenerate', loopId, options }, { type: 'metadataUpdate', loopId, updates }, { type: 'quantize', loopId }, …]`
- Remove direct generator calls and loop mutations from evolver.
- Edit targets: `src/stores/modules/evolutionSystem.js:85–93, 145–158, 183–214, 216–249`.

### Transport-Aligned Scheduling
- Trigger evolution checks on transport callbacks, not `setInterval(100ms)`.
- Gate `checkEvolve()` at measure boundaries `currentPulse % 16 === 0`.
- Replace interval at `src/stores/audioStore.js:667–672`; integrate measure-gated checks in callback at `src/stores/audioStore.js:187`.

### Deduplication Rules (Store-Level)
- In `evolveMusic()`, coalesce plan:
  - Drop per-loop regen intents if a global regen is scheduled.
  - If >50% of active loops are targeted, convert to one global regeneration.
  - Merge metadata updates per loop; apply once.
  - Skip no-op scale changes before quantization.

### Logging Policy
- Emit one summary line per lifecycle action from `audioStore`.
- Guard `[MelGen]` and `[LoopManager]` logs behind a debug flag.

## Implementation
### Phase 1: Define Evolver Intents
- Create intent types and `Plan` structure in `src/stores/modules/evolutionSystem.js`.
- Refactor functions to return intents, no side effects:
  - `mutateLoopRhythm(...)` `src/stores/modules/evolutionSystem.js:85–93`.
  - `evolveNotes(...)` `src/stores/modules/evolutionSystem.js:145–158`.
  - `evolveLoop(...)` `src/stores/modules/evolutionSystem.js:183–214`.
  - `evolveMultipleLoops(...)` `src/stores/modules/evolutionSystem.js:216–249`.

### Phase 2: Apply Plan in audioStore
- In `evolveMusic()` (`src/stores/audioStore.js:550–635`):
  - Request `intents` from evolver.
  - Deduplicate/coalesce per rules.
  - Execute centrally:
    - Regenerate via `melodicGenerator.regenerateLoop(loopId, currentPulse)` or `regenerateAllLoops(currentPulse)`.
    - Apply metadata updates via `notesMatrix.updateLoopMetadata`.
    - Quantize when needed.
  - Preserve batching (`startBatchMode`/`endBatchMode`).

### Phase 3: Transport-Based Evolve Trigger
- Remove `setInterval` ticker at `src/stores/audioStore.js:667–672`.
- In transport callback set by `audioEngine.setupTransportCallback(playActiveLoops)` (`src/stores/audioStore.js:187`), add measure-gated `checkEvolve()`.
- Update `checkEvolve()` (`src/stores/audioStore.js:637–651`) to guard by measure boundary and store state.

### Phase 4: Unify Regeneration Paths
- Keep `regenerateAllMelodies()` (`src/stores/audioStore.js:343–351`) as the global entry.
- Ensure `evolveMusic()` selects per-loop vs global based on coalesced plan.
- Make `audioStore.regenerateAllLoops()` (`src/stores/audioStore.js:317–332`) internal-only, not UI-invoked.
- UI Button: `src/components/AppHeader.vue:13, 266–268` continues calling `regenerateAllMelodies()`.

### Phase 5: Logging Consolidation
- Guard `[MelGen]` logger in `src/composables/useMelodicGenerator.js:14` with `window.__LOOP_DEBUG` or env flag.
- Guard `debugLog` in `src/stores/modules/loopManager.js:27–32, 539–546` similarly.
- Add summary logs in `audioStore` applying plan (intent counts, loops affected, duration).

### Phase 6: Skip No-Op Scale Changes
- In `updateScale(newScale)` (`src/stores/audioStore.js:378–404`): early return if `newScale === currentScale.value` before logging/quantizing.

## Verification
- Manual: Press `Regenerar`; expect a single summary entry, no repeated `[MelGen]` without debug.
- Auto-evolve: One evolution per measure, not per 100ms tick.
- Scale change: Selecting same scale yields no quantization/logs.
- Performance: Preset batching reduces autosave churn.

## Risks & Mitigations
- Behavior parity across locked vs creative modes; test thoroughly.
- Timing cadence changes; verify musical outcomes at measure boundaries.
- Debuggability preserved via optional detailed logs.

## Deliverables
- Intent-based evolver API.
- Centralized plan application with coalescing in `audioStore`.
- Transport-gated evolution scheduling.
- Simplified logging at store; module logs behind a flag.
- Early-return for unchanged scale.

## References
- UI: `src/components/AppHeader.vue:13, 266–268`
- Store actions: `src/stores/audioStore.js:317–351, 378–404, 550–672`
- Evolver: `src/stores/modules/evolutionSystem.js:85–93, 145–158, 183–214, 216–249`
- Generator: `src/composables/useMelodicGenerator.js:14, 111–165`
- LoopManager logs: `src/stores/modules/loopManager.js:27–32, 539–546`