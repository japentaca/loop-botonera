# Performance Analysis & Optimization Opportunities

## Executive Summary

The project is compute-intensive due to:
1. **Real-time audio synthesis** (Tone.js with 8 polyphonic loops)
2. **Continuous evolution algorithms** generating and mutating note patterns
3. **Energy management calculations** on every loop parameter change
4. **Matrix operations** on notes (677+ lines involving array manipulations)
5. **Frequency of DOM updates** during beat-by-beat playback

**Current optimizations already implemented:**
- ShallowRef for frequently-changing arrays
- Debounced energy checks (150ms)
- Debounced preset notifications (300ms)
- V-memo directives on components

---

## Critical Performance Hotspots

### 1. **Energy Calculation Loop** ⚠️ HIGH PRIORITY

**File:** `energyManager.js` - `calculateSonicEnergy()` function (lines 46-65)

**Issue:** 
- Loops through ALL active loops on EVERY energy balance check
- Called after every volume update
- Multiple nested property accesses (`loop.volume`, `loop.length`, `noteDensity`)

**Current Debounce:** 150ms (GOOD, but could be optimized further)

**Optimizations:**
```javascript
// BEFORE: Recalculates everything
const calculateSonicEnergy = (loops) => {
  const activeLoops = loops.filter(loop => loop.isActive)
  // ... complex calculations
}

// AFTER: Cache previous energy + incremental updates
const energyCache = new Map() // loopId -> lastEnergy
const updateCachedEnergy = (loops, changedLoopId) => {
  // Only recalculate affected loop
  let totalEnergy = 0
  loops.forEach(loop => {
    if (loop.id === changedLoopId) {
      energyCache.set(loop.id, calculateLoopEnergy(loop))
    }
    totalEnergy += energyCache.get(loop.id) || calculateLoopEnergy(loop)
  })
  return totalEnergy
}
```

**Expected Impact:** 60-70% faster energy checks for large loop counts

---

### 2. **Note Density Calculations** ⚠️ HIGH PRIORITY

**File:** `energyManager.js` - `getLoopDensity()` function (lines 18-39)

**Issue:**
- Calls `notesMatrix.getLoopNoteDensity()` on EVERY energy check
- `notesMatrix.js` computes density by filtering entire loop (lines 70-85)
- `getLoopDensity()` has multiple unused return paths (dead code)

**Current Code Issues:**
```javascript
const getLoopDensity = (loop) => {
  const loopId = loop.id
  const matrixDensity = notesMatrix.getLoopNoteDensity(loopId)
  return matrixDensity
  // ↓ DEAD CODE - unreachable
  const metadataDensity = notesMatrix.loopMetadata[loopId].density
  return metadataDensity
  // ... more dead code paths
}
```

**Optimizations:**
1. **Remove dead code paths** (lines 25-39 are unreachable)
2. **Cache density in metadata** - only update when notes change:
```javascript
const updateLoopMetadata = (loopId, updates) => {
  // ... existing code ...
  if (notesChanged) {
    // Only recalculate if notes actually changed
    loopMetadata[loopId].density = computeLoopDensityMetrics(loopId).density
  }
}
```

**Expected Impact:** 40-50% faster density lookups

---

### 3. **Evolution System - Mutation Operations** ⚠️ HIGH PRIORITY

**File:** `evolutionSystem.js` - `mutateLoopRhythm()` & `adjustLoopDensity()` (lines 56-155)

**Issues:**
- `adjustLoopDensity()` creates arrays and loops 3+ times over same data:
  ```javascript
  loopNotes.forEach((note, index) => {
    activeIndices.push(index)      // ← Loop 1
    inactiveIndices.push(index)    // ← Loop 1
  })
  // Shuffle inactive (Loop 2)
  // Remove excess (Loop 3)
  // Add notes (Loop 4)
  ```
- Inefficient array manipulation with `.splice()` and `.shift()` operations
- Called frequently during evolution cycles

**Optimizations:**
```javascript
const adjustLoopDensity = (loop, targetDensity, globalScaleIntervals) => {
  const loopNotes = notesMatrix.getLoopNotes(loop.id)
  if (loopNotes.length === 0) return false

  const desiredActive = Math.max(1, Math.round(loopNotes.length * targetDensity))
  
  // OPTIMIZED: Single pass categorization
  const activeIndices = []
  const inactiveIndices = []
  
  for (let i = 0, len = loopNotes.length; i < len; i++) {
    if (loopNotes[i] !== null && loopNotes[i] !== undefined) {
      activeIndices.push(i)
    } else {
      inactiveIndices.push(i)
    }
  }
  
  // Fisher-Yates shuffle only when needed
  if (inactiveIndices.length > desiredActive) {
    shuffleArray(inactiveIndices)
  }
  
  // ... rest of logic
}
```

**Expected Impact:** 50-60% faster evolution mutations

---

### 4. **Notes Matrix - Dense Array Operations** ⚠️ MEDIUM PRIORITY

**File:** `useNotesMatrix.js` - Core matrix operations (lines 200+)

**Issues:**
- `generateLoopNotes()` (line ~300) performs multiple array iterations
- `setLoopNotes()` calls `triggerRef()` unconditionally
- `clearLoopNote()` / `setLoopNote()` trigger reactivity on every single operation

**Optimization Strategy - Batch Operations:**
```javascript
// Add batch operation mode to reduce reactivity triggers
const batchUpdateStart = () => {
  batchMode = true
}

const batchUpdateEnd = () => {
  batchMode = false
  triggerRef(notesMatrix) // Single trigger for all changes
}

const setLoopNote = (loopId, step, note) => {
  notesMatrix.value[loopId][step] = note
  if (!batchMode) triggerRef(notesMatrix) // Only trigger if not in batch
}
```

**Expected Impact:** 30-40% faster during evolution cycles (which set many notes)

---

### 5. **Scale Resolution Performance** ⚠️ MEDIUM PRIORITY

**Files:** 
- `evolutionSystem.js` - `createRandomNoteForLoop()` (line ~44)
- `useNotesMatrix.js` - `generateRandomNoteForLoop()` (line ~60)
- `useMusic.js` - Scale resolution calls

**Issues:**
- `getScale()` is called multiple times per evolution tick
- Scale name → intervals resolution happens repeatedly
- No caching of scale lookups

**Optimization:**
```javascript
// Cache scale resolutions
const scaleCache = new Map()

const getScaleIntervals = (scaleName) => {
  if (!scaleCache.has(scaleName)) {
    scaleCache.set(scaleName, useScales().getScale(scaleName))
  }
  return scaleCache.get(scaleName)
}

// Invalidate cache only when scale changes
const updateScale = (newScale) => {
  currentScale.value = newScale
  scaleCache.clear() // Clear on scale change only
}
```

**Expected Impact:** 20-30% faster note generation

---

### 6. **Real-time Event Frequency Issues** ⚠️ MEDIUM PRIORITY

**File:** `audioStore.js` - `playActiveLoops()` (line ~77)

**Issue:**
- Called **16 times per second** (at 16th note resolution, 120 BPM)
- Loops through all loops checking `isActive`
- Creates computed properties on every pulse

**Current Implementation:**
```javascript
const playActiveLoops = (time, pulse) => {
  const activeLoops = loopManager.getActiveLoops() // Filter operation
  activeLoops.forEach(loop => {
    const step = (pulse - 1) % loop.length
    loopManager.playLoopNote(loop, audioEngine, step, time)
  })
}
```

**Optimization - Maintain active loop list:**
```javascript
let cachedActiveLoops = []

const onLoopToggled = (loopId, isActive) => {
  // Update cache instead of filtering every time
  if (isActive) {
    cachedActiveLoops.push(loopId)
  } else {
    cachedActiveLoops = cachedActiveLoops.filter(id => id !== loopId)
  }
}

const playActiveLoops = (time, pulse) => {
  // Use cache - no filtering needed
  cachedActiveLoops.forEach(loopId => {
    const loop = loopManager.loops.value[loopId]
    const step = (pulse - 1) % loop.length
    loopManager.playLoopNote(loop, audioEngine, step, time)
  })
}
```

**Expected Impact:** 10-20% CPU reduction during playback

---

### 7. **Energy Management - Frequency & Intensity** ⚠️ MEDIUM PRIORITY

**Current Behavior:**
- `debouncedEnergyCheck()` still called on EVERY `updateLoopParam()`
- Even though debounced, creates function overhead 16x/second during playback
- `adjustAllLoopVolumes()` is O(n) per check

**Issue in Detail:**
```javascript
const updateLoopParam = (id, param, value) => {
  loopManager.updateLoopParam(id, param, value)
  
  // Called on EVERY param update, even if volume didn't change
  if (param === 'volume') {
    debouncedEnergyCheck(loopManager.loops.value) // Debounce helps but...
  }
}
```

**Optimization - Value Change Detection:**
```javascript
const updateLoopParam = (id, param, value) => {
  const oldValue = loopManager.loops.value[id][param]
  loopManager.updateLoopParam(id, param, value)
  
  // Only trigger energy check if value actually changed significantly
  if (param === 'volume' && Math.abs(oldValue - value) > 0.05) {
    debouncedEnergyCheck(loopManager.loops.value)
  }
}
```

**Expected Impact:** 20-30% reduction in debounce function calls

---

## Summary Table: Optimization Opportunities

| Priority | Component | Issue | Current | Optimized | Effort | Impact |
|----------|-----------|-------|---------|-----------|--------|--------|
| 🔴 HIGH | Energy Manager | Recalculates all loops | O(n) | O(1-2) | Low | 60-70% |
| 🔴 HIGH | Energy Manager | Dense density lookups | Recomputed | Cached | Low | 40-50% |
| 🔴 HIGH | Evolution | Multiple array passes | 4+ loops | 1-2 loops | Medium | 50-60% |
| 🟠 MEDIUM | Notes Matrix | Reactivity per note | Per-note triggers | Batch updates | Medium | 30-40% |
| 🟠 MEDIUM | Music Composables | Scale resolution | Repeated lookups | Cached | Low | 20-30% |
| 🟠 MEDIUM | Audio Store | Active loop filtering | O(n) per pulse | Cached set | Low | 10-20% |
| 🟠 MEDIUM | Audio Store | Energy check frequency | Always called | Conditional | Low | 20-30% |

---

## Implementation Roadmap

### Phase 1: High-Impact, Low-Effort (Recommended Start)
1. **Remove dead code** in `energyManager.getLoopDensity()` 
2. **Add incremental energy calculation** with cache
3. **Implement scale cache** in music composables
4. **Conditional energy checks** - only on significant changes

### Phase 2: Medium-Impact, Medium-Effort
1. **Optimize evolution mutations** - reduce array passes
2. **Batch note matrix updates**
3. **Cache active loops list** instead of filtering

### Phase 3: Polish & Monitoring
1. **Performance profiling** with Chrome DevTools
2. **Frame rate monitoring** during evolution
3. **CPU usage tracking** with audio context metrics

---

## Monitoring & Validation

### Key Metrics to Track
```javascript
// Add performance monitoring
const perfMetrics = {
  energyCheckTime: [],
  evolutionMutationTime: [],
  renderFrameTime: [],
  audioPlaybackTime: []
}

// Measure during development
const measurePerformance = (label, fn) => {
  const start = performance.now()
  const result = fn()
  const duration = performance.now() - start
  console.log(`${label}: ${duration.toFixed(2)}ms`)
  return result
}
```

### Before/After Validation
- Record baseline CPU usage during 8-loop playback with auto-evolution
- After each optimization, compare metrics
- Monitor for audio dropouts or glitches

---

## Notes

- **Already optimized:** ShallowRef, debouncing, v-memo directives
- **No dev server required:** These are pure JS optimizations
- **Error-first approach:** Changes will reveal bugs, not hide them
- **Testing:** Run with evolution enabled and all loops active
