# Scale + Tail Pattern Implementation Plan

## Goals
- Produce audible “lead + tail” phrasing while the lead moves across each loop’s note range.
- Keep generation explicit at source; no defensive repairs downstream.
- Avoid bias toward extremes or getting stuck on a few notes; distribute coverage predictably.

## Generator Parameters
- Randomized per generation inside `generateScalePattern`: `centerBias`, `tailLength`, `directionMode`, `leadAdvance`. These do not reside in `notesMatrix.loopMetadata`.
- `densityTiming`: `random | even | euclidean | fillAll` to select placement positions.
- `positionMapping`: `sequential | index` for mapping sequence notes into selected positions.

## Generator Algorithm (generateScalePattern)
1. Randomize `centerBias`, `tailLength`, `directionMode`, `leadAdvance` for this generation.
2. Build `sortedNotes` from `(scale, baseNote)` within `[noteRangeMin, noteRangeMax]`.
3. Pick `leadIdx` using `centerBias` around the middle of `sortedNotes`.
4. For cycles until length reached:
   - Emit `lead` note.
   - Emit `tailLength` notes in the current `direction`, stopping at boundaries.
   - Advance `leadIdx` by `leadAdvance` and bounce at boundaries.
   - If `directionMode=alternate`, flip direction per cycle; if `random`, pick per cycle.
5. Compute placement indices by `densityTiming`.
6. Map the generated sequence into positions using `positionMapping=sequential` so pitch progression spreads across the pattern.
7. Return the pattern; generation intrinsically respects range.

## Integration (useMelodicGenerator)
- Do not read `{ tailLength, directionMode, centerBias, leadAdvance }` from metadata; they are randomized inside `generateScalePattern`.
- Read metadata only for `{ densityTiming, positionMapping }` and provide safe defaults when absent.
- Pass non‑random options into `generateScalePattern` via `patternOptions`; randomized parameters are created internally per generation.

## Logging
- Emit one structured log per generation:
  - `{ loopId, patternType, length, range, baseNote, density, tailLength, directionMode, leadAdvance, centerBias }` randomized per generation.
- Emit a summary line with `oob` (out‑of‑bounds count) for diagnosis only.
- When `window.__LOOP_DEBUG` is true, optionally print the first N sequence notes.

## DevTools Hooks
- `__DBG.setGenParams({ tailLength, directionMode, centerBias, leadAdvance })` to temporarily override randomization for diagnosis; otherwise values are random per generation.
- Keep AppHeader button to log active loops’ notes for quick inspection.

## Validation
- Regenerate several loops and inspect distribution:
  - Use `__DBG.getNotes(loopId)` and the generation logs.
  - Confirm lead movement traverses the range with tails audibly following.
- Test different ranges and densities to ensure no drift toward extremes.

## Rollout Steps
1. Remove `{ tailLength, directionMode, centerBias, leadAdvance }` from `notesMatrix.loopMetadata`.
2. Generate these parameters randomly inside `generateScalePattern`; forward only `{ densityTiming, positionMapping }`.
3. Implement traversal and mapping options in `generateScalePattern`.
4. Add logging fields and optional first‑N preview including randomized parameter values.
5. Verify in DevTools; adjust randomization bounds if needed.

## Notes
- Keep responsibilities explicit: generators produce valid in‑range sequences; no post‑generation repair.
- Prefer sequential mapping over absolute index mapping to avoid tying pitch to time index.