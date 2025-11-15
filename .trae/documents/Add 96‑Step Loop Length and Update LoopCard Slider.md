## Summary
- Add `96` as an allowed loop length and ensure the LoopCard slider supports it.
- Make slider bounds dynamic so future length additions don’t require hard-coded updates.

## Changes
1. Insert `96` in the allowed loop sizes list
- File: `src/components/LoopCard.vue:116`
- Update `const allowedSizes = [4, 8, 12, 16, 32, 48, 64, 128, 256, 512]`
- To: `const allowedSizes = [4, 8, 12, 16, 32, 48, 64, 96, 128, 256, 512]`

2. Make the slider max index dynamic
- File: `src/components/LoopCard.vue:27-31`
- Update `<Slider ... :min="0" :max="9" :step="1" ... />`
- To: `<Slider ... :min="0" :max="allowedSizes.length - 1" :step="1" ... />`

## Rationale
- The slider maps its selected index to `allowedSizes[$event]` (`src/components/LoopCard.vue:27-31`), so adding `96` to `allowedSizes` exposes it immediately.
- Using `:max="allowedSizes.length - 1"` removes a fragile hard-coded value and properly reflects the list size.
- All downstream logic already uses `loop.length` generically:
  - Step scheduling: `(pulse - 1) % loop.length` (`src/stores/audioStore.js:155-158`)
  - Matrix resizing and metadata: `resizeLoop` and `updateLoopMetadata` (`src/stores/modules/loopManager.js:354-364`, `src/composables/useNotesMatrix.js:341-357`, `218-236`)
  - Beat indicators and progress use `props.loop.length` (`src/components/LoopCard.vue:156-167`).

## Verification
- UI: Confirm the LoopCard “Tamaño” slider displays and selects `96`; the value label shows `96`.
- Behavior: Switching to `96` resizes the loop (notes beyond 96 cleared) and playback continues with correct stepping.
- Check that length persists in metadata via the existing update path.
- Smoke test lengths around the new value: `64 → 96 → 128` without errors.

## Notes
- No other files define allowed sizes; `LoopCard.vue` owns the list.
- No slider `marks` are present; index mapping remains correct via `sizeIndex` (`src/components/LoopCard.vue:119-129`).

If you approve, I will implement these changes and verify the behavior end-to-end.