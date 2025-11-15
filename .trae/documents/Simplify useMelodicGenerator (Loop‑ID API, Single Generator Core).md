## Intent
Reduce overengineering in `src/composables/useMelodicGenerator.js` by collapsing layers and exposing a loop‑id only API. Keep counterpoint optional and efficient.

## Changes
- Remove indirection:
  - Delete `buildPatternOptions` (`src/composables/useMelodicGenerator.js:25–42`).
  - Delete `generateBasePattern` dispatch (`src/composables/useMelodicGenerator.js:44–54`).
- Add a single core: `generatePattern(loopId, type, extraOptions = {})` that:
  - Reads `meta` from `notesMatrix.loopMetadata[loopId]`.
  - Gets `scale` via `useScales().getScale(audioStore.currentScale)`.
  - Computes `density` via `notesMatrix.getEffectiveDensity(loopId)`.
  - Computes `startOffset` from `meta.startOffset` or pulse modulo length.
  - Uses shared helpers `computePositions`, `generatePossibleNotes` and type branch for placement.
- Simplify `generateLoopMelody(loopId)`:
  - Determine `patternType` via `selectPatternType(loopId)`.
  - Call `generatePattern(loopId, patternType)`.
  - Apply counterpoint if enabled and more than one active loop.
  - Update metadata `lastPattern/lastModified`.
- Retain only one helper set:
  - Keep `generatePossibleNotes`, `euclideanRhythm`, `computePositions` in this module.
  - Remove `euclidFromOptions`, `scaleFromOptions`, `randomFromOptions` and fold their logic into `generatePattern`.
- Keep `selectPatternType(loopId)` but compress normalization and weighted pick.
- Optionally simplify `getActiveLoops()` to use `audioStore.loopManager.loops.value` for clarity instead of scanning metadata (only if no new coupling issues).

## Resulting Public API
- `generateLoopMelody(loopId)`
- `regenerateLoop(loopId, currentPulse?)`
- `regenerateAllLoops(currentPulse?)`
- `selectPatternType(loopId)`
- `applyCounterpoint(loopId, notes, activeLoops)`
- `getActiveLoops()`

## Rationale
- Eliminates parameter-building and option-dispatch duplication.
- One generator core avoids multiple function variants and reduces maintenance.
- Keeps loop‑id only usage aligned with the central store.

## Verification
- Run melody generation for several `loopId`s; confirm:
  - Density equals `getEffectiveDensity(loopId)`.
  - Notes within `noteRangeMin/max`.
  - Timing respects `startOffset` or pulse modulo.
- Observe debug logs with `window.__LOOP_DEBUG` for timing and oob counts.

## References
- Current layers to remove: `src/composables/useMelodicGenerator.js:25–54`.
- Helpers to keep: `src/composables/useMelodicGenerator.js:320–386`.