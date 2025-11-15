## Objective
Make `src/utils/patternGenerators.js` functions accept only `loopId` and fetch all required parameters from the central store (metadata, scale, density) for simpler usage across the project.

## Constraints
- Avoid circular imports:
  - `useNotesMatrix` imports `useMelodicGenerator`.
  - `useMelodicGenerator` currently imports `patternGenerators`.
  - Refactored `patternGenerators` must not be imported by `useMelodicGenerator` to prevent cycles.

## Design
- Convert `generateEuclideanPattern`, `generateScalePattern`, `generateRandomPattern` to accept `(loopId, extraOptions = {})`.
- Inside each, read data from the central store:
  - `meta = notesMatrix.loopMetadata[loopId]` (length, baseNote, range, timing).
  - `density = notesMatrix.getEffectiveDensity(loopId)`.
  - `scaleIntervals = useScales().getScale(audioStore.currentScale)`.
- Keep helper functions `generatePossibleNotes`, `euclideanRhythm`, and `computePositions` in `patternGenerators.js`.
- Stop importing `patternGenerators` from `useMelodicGenerator.js`; `useMelodicGenerator` will retain its existing generation flow for internal orchestration.

## API Changes (Breaking)
- New signatures:
  - `generateEuclideanPattern(loopId, options?)`
  - `generateScalePattern(loopId, options?)`
  - `generateRandomPattern(loopId, options?)`
- Options remain optional for overrides (e.g., `timing`, `startOffset`).

## Implementation Steps
1. Update `src/utils/patternGenerators.js`:
  - Import `useAudioStore` and `useNotesMatrix` (and `useScales`).
  - Implement parameter assembly: `{ length, scale, baseNote, noteRange, density, startOffset }` from store.
  - Replace current parameter objects with store-derived values.
  - Keep helper functions intact.
2. Update `src/composables/useMelodicGenerator.js`:
  - Remove import of `patternGenerators` to avoid cycles.
  - Continue using its current internal flow for `generateLoopMelody(loopId)`; no dependency on `patternGenerators`.
3. Ensure `useNotesMatrix.generateLoopNotes(loopId)` continues to work (it uses `useMelodicGenerator`, no change required).
4. Provide simple usage examples in code comments where helpful.

## Verification
- For a few `loopId`s, call each generator and verify:
  - Length equals metadata length and density matches `getEffectiveDensity`.
  - Notes fall within `noteRangeMin/max`.
  - Timing respects `startOffset` and selected mode.
- Observe logs with `window.__LOOP_DEBUG` enabled.

## Code References
- Generators to refactor: `src/utils/patternGenerators.js:19`, `src/utils/patternGenerators.js:68`, `src/utils/patternGenerators.js:121`.
- Store access: `src/stores/audioStore.js:892–900`.
- Density: `src/composables/useNotesMatrix.js:159–166`.
- Current option construction (for parity): `src/composables/useMelodicGenerator.js:26–43`.

## Result
Callers across the app can pass only `loopId` when generating patterns, simplifying usage and centralizing parameter sourcing without introducing module cycles.