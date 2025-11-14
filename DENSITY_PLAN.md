# Dynamic Density Plan

Objective

Implement dynamic per-loop density calculation that adjusts automatically when loops are enabled or disabled. The behavior should produce sparser patterns when many loops are active and denser patterns when few loops are active. This change must be non-breaking and respect per-loop locks (generationMode: 'locked').

Summary of behavior

- Density is computed based on the number of active loops (1..8).
- Fewer active loops → higher density (more notes, less spacing).
- More active loops → lower density (fewer notes, more spacing).
- The value will be stored in `notesMatrix.loopMetadata[loopId].density`.
- The system must respect `generationMode === 'locked'` and skip updating locked loops.
- Changes apply when a loop is enabled/disabled (toggle), debounced to avoid rapid thrashing.

Contract

Inputs:
- Array of loop objects (from `loopManager.loops.value`). Each loop has `id`, `isActive`, `length`, `volume`, etc.
- Configuration values: `NUM_LOOPS` (default 8), `MIN_DYNAMIC_DENSITY` (default 0.15), `MAX_DYNAMIC_DENSITY` (default 0.9), `DENSITY_REDUCTION_FACTOR_ON_ENERGY` (default 0.7).

Outputs:
- For each active, unlocked loop: update `loopMetadata[loopId].density` and regenerate notes using `notesMatrix.generateLoopNotes(loopId, density)` (or melodic regeneration path via `loopManager.regenerateLoop` when melodic strategy applies).

Success criteria:
- After toggling a loop, per-loop densities reflect the computed values within ~250ms.
- When 1 loop active → density ≈ MAX_DYNAMIC_DENSITY.
- When all loops active → density ≈ MIN_DYNAMIC_DENSITY.
- Locked loops are not changed.

Design & Formula

- Linear interpolation (recommended):
  - t = (activeCount - 1) / (NUM_LOOPS - 1)
  - baseDensity = lerp(MAX_DYNAMIC_DENSITY, MIN_DYNAMIC_DENSITY, t)
  - If sonic energy is above threshold, apply reduction: baseDensity *= DENSITY_REDUCTION_FACTOR_ON_ENERGY
  - finalDensity = clamp(baseDensity, MIN_DYNAMIC_DENSITY, MAX_DYNAMIC_DENSITY)

- lerp(a, b, t) = a * (1 - t) + b * t

Default values (configurable):
- NUM_LOOPS = 8
- MIN_DYNAMIC_DENSITY = 0.15
- MAX_DYNAMIC_DENSITY = 0.9
- DENSITY_REDUCTION_FACTOR_ON_ENERGY = 0.7
- DENSITY_DEBOUNCE_MS = 250

Files to modify

1. `src/stores/modules/energyManager.js`
   - Add `computeDynamicDensity(loops)` which implements the mapping and energy-based adjustment.
   - Export or expose the function through the manager instance.
   - Keep existing `getAdaptiveDensity` compatibility but prefer `computeDynamicDensity` for toggles and immediate density updates.

2. `src/stores/audioStore.js`
   - After `loopManager.toggleLoop(id)` (or in setLoopActive), call a debounced `applyDynamicDensities()` that:
     - Calls `energyManager.computeDynamicDensity(loopManager.loops.value)` to get the density.
     - Iterates over loops and for each active, unlocked loop calls `notesMatrix.generateLoopNotes(loop.id, density)` or `loopManager.regenerateLoop` for melodic path.
   - Use `debounce` utility already present in `audioStore.js`.

3. `src/composables/useNotesMatrix.js`
   - Ensure `generateLoopNotes(loopId, density)` clamps density and writes `meta.density = density` after generation.
   - Ensure it does not override density for `meta.generationMode === 'locked'` (if generationMode locked, skip generation or only update metadata if explicitly requested).

4. `src/stores/modules/loopManager.js` (optional)
   - When creating loops, keep `density: adaptiveDensity || 0.4` as initial value. No change required unless creation-time adaptive density is desired.

5. `src/components/PatternSettings.vue` (optional UI)
   - Consider adding a per-loop lock for density or a user-preferred density input; ensure the core logic respects `generationMode === 'locked'`.

Implementation steps (developer instructions)

Step 1 — energyManager.computeDynamicDensity
- Add configuration constants at top of energyManager:
  - const MIN_DYNAMIC_DENSITY = 0.15
  - const MAX_DYNAMIC_DENSITY = 0.9
  - const DENSITY_REDUCTION_FACTOR_ON_ENERGY = 0.7
- Implement helper `lerp(a,b,t)`.
- Implement `computeDynamicDensity(loops)`:
  - activeCount = Math.max(1, loops.filter(l => l.isActive).length)
  - t = (activeCount - 1) / (NUM_LOOPS - 1)
  - baseDensity = lerp(MAX_DYNAMIC_DENSITY, MIN_DYNAMIC_DENSITY, t)
  - currentEnergy = calculateSonicEnergy(loops)
  - if (currentEnergy > maxSonicEnergy.value) baseDensity *= DENSITY_REDUCTION_FACTOR_ON_ENERGY
  - return Math.max(MIN_DYNAMIC_DENSITY, Math.min(MAX_DYNAMIC_DENSITY, baseDensity))
- Expose/return `computeDynamicDensity` as part of the energyManager API object.

Step 2 — applyDynamicDensities in audioStore
- At module scope in `audioStore.js`, create a debounced function using existing `debounce()` utility:
  - const applyDynamicDensities = debounce(() => { ... }, DENSITY_DEBOUNCE_MS)
- Implementation details inside applyDynamicDensities():
  - const loops = loopManager.loops.value
  - const density = energyManager.computeDynamicDensity(loops)
  - Use `batchUpdate` pattern if many loops are updated; if not available in audioStore, use `notesMatrix.updateLoopMetadata` + `notesMatrix.generateLoopNotes` or call `loopManager.regenerateLoop` for melodic loops.
  - For each loop: skip if not active or if meta.generationMode === 'locked'. Otherwise call `notesMatrix.generateLoopNotes(loop.id, density)`.
- Call `applyDynamicDensities()` from `toggleLoop` and `setLoopActive` after updating the loop's active state. Also call when initializing loops if adaptiveDensity is desired.

Step 3 — Respect melodic generation path
- If the loop uses melodic generation (the system checks `options.strategy === 'melodic'`), prefer calling melodic regeneration paths (e.g., `loopManager.regenerateLoop(loopId, scale, currentScaleName, density, volume, currentPulse)`) so melodic rules/counterpoint apply.
- Determine which path to call by checking `loop.generationMode` or other metadata.

Step 4 — UI & metadata locking
- Ensure `notesMatrix.updateLoopMetadata` validation still clamps density when user calls it directly.
- Respect `generationMode === 'locked'` by not changing density for locked loops.

Step 5 — Logging & observability
- Add a debug log guarded by existing `isDebugEnabled()`:
  - Example: `debugLog('dynamic density applied', { activeCount, density })`
- Use `[Density]` or similar prefix to make logs discoverable.

Step 6 — Rollout & fallback
- Feature should be opt-in in behavior via a config flag (optional). If disabled, system keeps existing static/default densities.
- If energyManager disabled, fall back to previously stored per-loop `meta.density` or default 0.4.

Edge cases

- Very short loops: For tiny `meta.length`, ensure `generateLoopNotes` behavior still yields at least 0 or 1 notes depending on `allowZero` semantics; this plan leaves that logic unchanged.
- Rapid toggles: Debounce will prevent thrash.
- Locked loops: Explicitly skip locked loops so user preferences remain intact.
- Energy over-limit: Final density may be reduced further by energyManager's sonic energy policy.

Notes

- This change focuses on controlling density at enabling/disabling moments. You can extend it later to re-evaluate density on volume or other parameter changes.
- Keep all changes additive and non-breaking; default behavior remains.


