## Objective
Remove the overengineered `useMelodicGenerator.js` layer and drive music generation directly from the central notes matrix using loop metadata. Simplify call sites to only use `notesMatrix.generateLoopNotes(loopId)`.

## Changes
- `useNotesMatrix.js`: inline pattern selection and generation
  - Remove import of `useMelodicGenerator`.
  - Add helpers: `euclideanRhythm`, `computePositions`, `generatePossibleNotes`.
  - Add `selectPatternType(loopId)` using per-loop probabilities.
  - Rewrite `generateLoopNotes(loopId)` to:
    - Read `meta` and `scaleName` from metadata.
    - Compute `density`, `startOffset`, positions and generate notes for `'euclidean'|'scale'|'random'`.
    - Optionally apply counterpoint and then set notes.
    - Update metadata (`lastPattern`, `lastModified`).

- `audioStore.js`: remove `useMelodicGenerator` usage
  - Delete import and instance creation.
  - Update debug helpers to call `notesMatrix.selectPatternType` and `notesMatrix.generateLoopNotes`.
  - Replace `melodicGenerator.regenerateAllLoops` and per-loop regenerate calls with `notesMatrix.generateLoopNotes(loopId)` iterations.

- `loopManager.js`: generate directly via notes matrix
  - Update `generateLoopMelodyFor(loopId)` to call `notesMatrix.generateLoopNotes(loopId)` and return resulting notes.

## Result
- One API: `notesMatrix.generateLoopNotes(loopId)` handles pattern choice and generation.
- No module cycles; fewer layers; simpler maintenance.

## Verification
- Run generation for active loops and confirm density, ranges and offsets.
- Check logs for timing and out-of-range counts with debug flag on.

## References
- `useNotesMatrix.generateLoopNotes`: `src/composables/useNotesMatrix.js:339`.
- Pattern selection code source: `src/composables/useMelodicGenerator.js:179–233` (to be ported).
- Loop manager generation sites: `src/stores/modules/loopManager.js:40–49`, `469–497`, `499–558`.
- Audio store debug and evolve references: `src/stores/audioStore.js:407–420`, `614–621`.