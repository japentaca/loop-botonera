## Scope
- Update `src/utils/patternGenerators.js` to implement the “lead + tail” scale traversal with randomized per‑generation params and mapping options.
- Integrate in `src/composables/useMelodicGenerator.js` to pass `densityTiming` and `positionMapping` from metadata with safe defaults and structured logging.
- Add DevTools overrides in `src/stores/audioStore.js` via `__DBG.setGenParams`.

## Generator Changes
- Function: `generateScalePattern` at `src/utils/patternGenerators.js:68`
- Randomize per generation inside the function (do not read metadata):
  - `centerBias` in [-0.6, 0.6] (bias around middle of `sortedNotes`).
  - `tailLength` integer [0..5] with `options.maxTail` bound.
  - `directionMode`: `alternate | random` (default `alternate`).
  - `leadAdvance`: integer step size [1..2].
- Build `sortedNotes` from `(scale, baseNote)` constrained to `{min,max}` (already implemented at `src/utils/patternGenerators.js:74–83`).
- Pick `leadIdx` using `centerBias` around mid; bounce at edges.
- Traverse cycles until the sequence reaches `length`:
  - Emit lead note, then `tailLength` notes in current direction, stopping at boundaries.
  - Advance `leadIdx` by `leadAdvance`; bounce and continue.
  - If `directionMode=alternate`, flip direction per cycle; if `random`, pick per cycle.
- Placement positions by `densityTiming`:
  - Use existing `computePositions` with mode mapping: `random | even | euclidean | fillAll`.
- Position mapping:
  - `sequential` (default): place `seqFull[k]` into sorted positions `positions[k]`.
  - `index`: place `seqFull[pos % seqFull.length]` at each `pos`.
- Logging:
  - Accept optional `options.log(info)` and call with `{ loopId, patternType:'scale', length, range, baseNote, density, tailLength, directionMode, leadAdvance, centerBias }` and `oob` summary.
  - When `window.__LOOP_DEBUG` is true, print first N notes of the generated sequence.
- DevTools overrides:
  - If `window.__DBG?.__genParams` exists, override `{ tailLength, directionMode, centerBias, leadAdvance }` before generation.
- Remove random final pattern shift; keep generation deterministic per params.

## Orchestration Changes
- File: `src/composables/useMelodicGenerator.js`
- Build `patternOptions` with safe defaults:
  - `densityTiming = meta.densityTiming ?? 'random'`
  - `positionMapping = meta.positionMapping ?? 'sequential'`
  - Pass `loopId` and a `log` function that emits the structured generation log and the `oob` summary.
- Keep metadata reads limited to placement options; no tail/direction/center params read from metadata.

## DevTools Hooks
- File: `src/stores/audioStore.js:396–405`
- Extend `window.__DBG` with:
  - `setGenParams(params)` to set `window.__DBG.__genParams = { tailLength, directionMode, centerBias, leadAdvance }`.
  - `clearGenParams()` to delete the override.
  - `getGenParams()` to inspect current overrides.

## Defaults & Bounds
- `densityTiming`: default `random`.
- `positionMapping`: default `sequential`.
- `centerBias`: clamp to [-0.6, 0.6].
- `tailLength`: clamp to [0..5] (bounded by `options.maxTail`).
- `leadAdvance`: clamp to [1..2].

## Validation
- Regenerate several active loops and review console structured logs.
- Use `__DBG.getNotes(loopId)` to inspect note arrays.
- Confirm lead traverses the range with audible tails and coverage distribution remains balanced across ranges and densities.

## Notes
- Generators produce valid in‑range sequences; no post‑generation repair.
- Prefer sequential mapping over index mapping to avoid tying pitch to absolute time indices.