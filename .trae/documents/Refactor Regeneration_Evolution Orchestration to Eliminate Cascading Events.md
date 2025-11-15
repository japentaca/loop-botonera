## Goals
- Make regeneration and evolution calls single-sourced and time-aligned to avoid duplicated, unnecessary work and console noise.
- Turn the evolver into a planner that emits intents; apply them centrally in the store in batched, deduplicated fashion.
- Align evolution scheduling with transport beats/measures to remove race conditions.

## Scope
- Core orchestration in `src/stores/audioStore.js`.
- Evolver APIs in `src/stores/modules/evolutionSystem.js`.
- Generation calls in `src/composables/useMelodicGenerator.js`.
- Loop state updates in `src/stores/modules/loopManager.js`.
- Keep UI components unchanged, but rely on a single orchestrator to apply effects.

## Key Design Changes
### Single Orchestrator
- Only `audioStore` performs side-effectful actions (regenerate, quantize, apply loop updates). Modules become pure or intent-producing.
- UI continues calling `audioStore` actions (`regenerateAllMelodies`, per-loop regen, scale change).

### Intent-Based Evolver
- Change `evolutionSystem.evolveMultipleLoops(...)` to return a list of intents (plan), not perform side effects:
  - `[{ type: 'regenerate', loopId, options }, { type: 'metadataUpdate', loopId, updates }, { type: 'quantize', loopId }, …]`
- Remove direct calls to `melodicGenerator.regenerateLoop(...)` and loop mutations in evolver functions.
  - Targets to edit: `src/stores/modules/evolutionSystem.js:85–93, 145–158, 183–214, 216–249`.

### Transport-Aligned Scheduling
- Trigger evolution checks on transport beats/measures via the existing transport callback instead of `setInterval(100ms)`.
- Evaluate `checkEvolve()` only when `currentPulse % 16 === 0` (measure boundary) to ensure one execution per measure.
  - Edit: replace interval at `src/stores/audioStore.js:667–672` with measure-gated checks inside transport callback set at `src/stores/audioStore.js:187`.

### Deduplication Rules (Store-Level)
- In `evolveMusic()`, interpret the evolver plan and coalesce:
  - If a global regen is scheduled for the tick, drop per-loop regen intents.
  - If more than half of active loops are targeted for regen, convert intents to one global regeneration.
  - Combine metadata updates for the same loop; apply once.
- Skip no-op scale changes before quantization.

### Logging Policy
- Emit one summary line per lifecycle action from `audioStore` (e.g., `Regeneration plan applied`), remove or guard module-level logs behind a debug flag.
  - `[MelGen]` and `[LoopManager]` logs become conditional.

## Implementation Steps
### Phase 1: Define Evolver Intents
- Create intent types and a `Plan` structure in `src/stores/modules/evolutionSystem.js`.
- Refactor:
  - `mutateLoopRhythm(...)` `src/stores/modules/evolutionSystem.js:85–93` → return `{ type: 'regenerate', loopId, options }` instead of calling generator.
  - `evolveNotes(...)` `src/stores/modules/evolutionSystem.js:145–158` → return intents.
  - `evolveLoop(...)` `src/stores/modules/evolutionSystem.js:183–214` → assemble intents based on lock/creative modes, no side effects.
  - `evolveMultipleLoops(...)` `src/stores/modules/evolutionSystem.js:216–249` → return flattened intents array.

### Phase 2: Apply Plan in `audioStore`
- In `evolveMusic()` (`src/stores/audioStore.js:550–635`):
  - Call evolver to get `intents`.
  - Deduplicate/coalesce according to rules.
  - Execute intents centrally:
    - Regenerate via `melodicGenerator.regenerateLoop(loopId, currentPulse)` or a single `regenerateAllLoops(currentPulse)`.
    - Apply metadata updates with `notesMatrix.updateLoopMetadata`.
    - Quantization only if needed.
  - Keep preset batching already present (`startBatchMode`/`endBatchMode`).

### Phase 3: Transport-Based Evolve Trigger
- Remove `setInterval` ticker at `src/stores/audioStore.js:667–672`.
- In the transport callback set by `audioEngine.setupTransportCallback(playActiveLoops)` (`src/stores/audioStore.js:187`), add measure-gated `checkEvolve()` calls.
- Update `checkEvolve()` (`src/stores/audioStore.js:637–651`) to guard by measure boundary and store state only.

### Phase 4: Unify Regeneration Paths
- Keep `regenerateAllMelodies()` (`src/stores/audioStore.js:343–351`) as the only global generation entry; ensure `evolveMusic()` chooses between per-loop or global regens based on plan coalescing.
- Ensure `audioStore.regenerateAllLoops()` (`src/stores/audioStore.js:317–332`) is either removed or internal-only, not called from UI.
  - UI button in `src/components/AppHeader.vue:13, 266–268` continues to call `regenerateAllMelodies()`.

### Phase 5: Logging Consolidation
- `[MelGen]` logger in `src/composables/useMelodicGenerator.js:14`: guard by `window.__LOOP_DEBUG` or an env-based debug flag.
- `debugLog` in `src/stores/modules/loopManager.js:27–32, 539–546`: guard similarly.
- Add summary logs in `audioStore` when applying a plan (count of intents, loops affected, time taken).

### Phase 6: Skip No-Op Scale Changes
- In `updateScale(newScale)` (`src/stores/audioStore.js:378–404`):
  - Early return if `newScale === currentScale.value` before logging and quantizing.

## Verification
- Manual: Press `Regenerar` and observe a single summary console entry; no repeated `[MelGen]` per loop unless debug enabled.
- Auto-evolve: Enable auto-evolve, verify one evolution per measure, not per 100ms tick.
- Scale change: Change scale; when selecting same scale, confirm no quantization/logs.
- Performance: Confirm preset batching reduces autosave churn during evolutions.

## Risks & Mitigations
- Behavior parity: Ensure musical output remains equivalent; test locked vs creative modes.
- Timing: Transport alignment changes cadence; verify that measure boundary gating matches musical expectations.
- Debuggability: Keep a debug flag to re-enable detailed module logs when needed.

## Deliverables
- Refactored evolver to intent-based API.
- Centralized plan application in `audioStore` with coalescing.
- Transport-gated evolution scheduling.
- Logging simplified at the store; module logs behind a flag.
- Early-return for unchanged scale.

## References
- Button wiring: `src/components/AppHeader.vue:13, 266–268`
- Store actions: `src/stores/audioStore.js:317–351, 378–404, 550–672`
- Evolver: `src/stores/modules/evolutionSystem.js:85–93, 145–158, 183–214, 216–249`
- Generator: `src/composables/useMelodicGenerator.js:14, 111–165`
- LoopManager logs: `src/stores/modules/loopManager.js:27–32, 539–546`