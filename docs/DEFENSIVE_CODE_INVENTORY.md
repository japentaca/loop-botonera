# Defensive Code Inventory

## Overview

This document catalogs all defensive programming patterns found in the codebase as the foundation for systematic removal. The inventory is organized by pattern type with specific examples, file locations, and proposed solutions.

## Summary Statistics

- **Function Existence Checks**: 25 instances
- **Fallback Value Assignments**: 210+ instances  
- **Environment Guards**: 9 instances
- **Type Validation Guards**: 98+ instances
- **Bounds Checking**: 50+ instances
- **Total Defensive Patterns**: 400+ instances

## Pattern Categories

### 1. Function Existence Checks (25 instances)

**Pattern**: `typeof obj.method === 'function'`

#### High-Priority Targets (Core Business Logic)

**File**: `src/stores/audioStore.js`
```javascript
// Line 53: Function existence check before calling
if (typeof energyManager.updateNumLoops === 'function') {
  energyManager.updateNumLoops(loopManager.NUM_LOOPS)
}

// Line 396: Melodic generator existence check
if (preferMelodic && typeof melodicGenerator?.regenerateLoop === 'function') {
  melodicGenerator.regenerateLoop(loopId, currentPulse, { silent: true })
}

// Line 404: Notes matrix method check
if (typeof notesMatrix.generateLoopNotes === 'function') {
  notesMatrix.generateLoopNotes(loopId, { silent: true })
}

// Line 618: Evolution system method check
if (evolutionSystem && typeof evolutionSystem.applyMatrixMutation === 'function') {
  evolutionSystem.applyMatrixMutation(loopId, notesMatrix, mutationType, m.params || {})
}

// Line 639: Fallback mutation method check
if (notesMatrix && typeof notesMatrix.mutateLoop === 'function') {
  notesMatrix.mutateLoop(i.loopId, { probability: m.params?.probability || 0.3 })
}

// Line 668: Density method with fallback
const target = typeof notesMatrix.getEffectiveDensity === 'function' ? notesMatrix.getEffectiveDensity(loop.id) : 0.3
```

**File**: `src/stores/modules/evolutionSystem.js`
```javascript
// Line 281: Notes matrix generation check
if (notesMatrix && typeof notesMatrix.generateLoopNotes === 'function') {
  // ... evolution logic
}

// Line 285: AudioStore method check  
if (audioStore && typeof audioStore.generateLoopPattern === 'function') {
  audioStore.generateLoopPattern(loopId)
}

// Line 295: Mutation method check
if (notesMatrix && typeof notesMatrix.mutateLoop === 'function') {
  notesMatrix.mutateLoop(loopId, { probability: intensity })
}
```

**File**: `src/composables/useMelodicGenerator.js`
```javascript
// Line 38: Density method with fallback
density: typeof notesMatrix.getEffectiveDensity === 'function' ? notesMatrix.getEffectiveDensity(loopId) : (typeof meta.density === 'number' ? meta.density : 0.3)

// Line 101: Metadata update check
if (!(options && options.silent === true) && typeof notesMatrix.updateLoopMetadata === 'function') {
  notesMatrix.updateLoopMetadata(loopId, { lastPattern: patternType, lastModified: Date.now() })
}

// Line 140: Reactivity trigger check
if (typeof notesMatrix.triggerReactivityDebounced === 'function') {
  notesMatrix.triggerReactivityDebounced()
}
```

#### Medium-Priority Targets (Infrastructure)

**File**: `src/stores/modules/audioEngine.js`
```javascript
// Line 107: Callback function validation
if (typeof fn === 'function') transportListeners.add(fn)

// Line 122: Callback execution check
try { if (typeof _transportMainCallback.cb === 'function') _transportMainCallback.cb(time, _internalPulse) } catch (err) { ... }

// Line 128: Tone.js API check
if (typeof Tone?.Transport?.scheduleRepeat === 'function') {
  Tone.Transport.scheduleRepeat((time) => { /* ... */ })
}

// Line 157: Transport start check
if (typeof Tone?.Transport?.start === 'function' && typeof Tone?.Transport?.scheduleRepeat === 'function') {
  Tone.Transport.start()
}

// Line 183: Transport pause check
if (typeof Tone?.Transport?.pause === 'function' && typeof Tone?.Transport?.scheduleRepeat === 'function') {
  Tone.Transport.pause()
}
```

**File**: `src/modules/tonalCycles.js`
```javascript
// Line 30: AudioStore method check
if (!audioStore || typeof audioStore.registerTransportListener !== 'function') return

// Line 64: AudioStore unregister check
if (!audioStore || typeof audioStore.unregisterTransportListener !== 'function') return
```

#### Low-Priority Targets (UI/Utility)

**File**: `src/components/PresetManagerDialog.vue`
```javascript
// Line 329: Input element method checks
if (editInput.value && typeof editInput.value.focus === 'function') {
  editInput.value.focus()
  if (typeof editInput.value.select === 'function') {
    editInput.value.select()
  }
}
```

### 2. Fallback Value Assignments (210+ instances)

#### High-Impact Business Logic Fallbacks

**File**: `src/stores/presetStore.js`
```javascript
// Lines 120-128: Metadata fallback chains
noteRangeMin: (notesMatrix ? notesMatrix.loopMetadata[loop.id]?.noteRangeMin : audioStore.loopMetadata[loop.id]?.noteRangeMin) ?? 24,
noteRangeMax: (notesMatrix ? notesMatrix.loopMetadata[loop.id]?.noteRangeMax : audioStore.loopMetadata[loop.id]?.noteRangeMax) ?? 96,
patternProbabilities: { ...((notesMatrix ? notesMatrix.loopMetadata[loop.id]?.patternProbabilities : audioStore.loopMetadata[loop.id]?.patternProbabilities) || { euclidean: 0.3, scale: 0.3, random: 0.4 }) },
generationMode: (notesMatrix ? notesMatrix.loopMetadata[loop.id]?.generationMode : audioStore.loopMetadata[loop.id]?.generationMode) ?? 'auto',
lastPattern: (notesMatrix ? notesMatrix.loopMetadata[loop.id]?.lastPattern : audioStore.loopMetadata[loop.id]?.lastPattern) ?? null,
densityMode: (notesMatrix ? notesMatrix.loopMetadata[loop.id]?.densityMode : audioStore.loopMetadata[loop.id]?.densityMode) ?? 'auto',
manualDensity: (notesMatrix ? notesMatrix.loopMetadata[loop.id]?.manualDensity : audioStore.loopMetadata[loop.id]?.manualDensity) ?? 0.3,
autoDensity: (notesMatrix ? notesMatrix.loopMetadata[loop.id]?.autoDensity : audioStore.loopMetadata[loop.id]?.autoDensity) ?? 0.3
```

**File**: `src/stores/audioStore.js`
```javascript
// Line 62: Tonal cycles fallback
const tonalCyclesList = ref(listCycles() || [])

// Line 66: Subscription result fallback
tonalCyclesList.value = list || []

// Line 124: Density bias fallback
const basePerLoopDensity = Math.max(0, Math.min(1, Number(globalDensityBias.value || 0))) / autoTargets.length

// Line 133-135: Loop parameter fallbacks
const val = typeof meta.manualDensity === 'number' ? meta.manualDensity : (typeof meta.density === 'number' ? meta.density : 0)
const lengthFactor = REFERENCE_LENGTH / (loop.length || REFERENCE_LENGTH)
const volumeContrib = (typeof loop.volume === 'number' ? loop.volume : 0)

// Lines 537, 543: Scale fallback chains
return Object.keys(scalesList).find(scale => scale !== excludeScale) || 'major'
return getMusicRelatedScale(currentScale) || getRandomScale(currentScale)
```

#### Pattern Generation Fallbacks

**File**: `src/utils/patternGenerators.js`
```javascript
// Lines 17-18: Options fallbacks
let masterLoopId = options.masterLoopId ?? members[0]
const masterMeta = notesMatrix.loopMetadata[loopId] || {}
const masterBase = masterMeta.baseNote || 60

// Lines 45-46: Timing and jitter fallbacks
const timing = 'euclidean'
const jitter = sel1.jitter ?? 0

// Line 89-91: Timing mode fallbacks
const timingMode = options.densityTiming ?? (sel2.timingMode ?? 'even')
const jitter2 = sel2.jitter ?? 0

// Lines 164-166: Mode fallbacks
const mode3 = sel3.timingMode ?? (options.timing ?? 'random')
const jitter3 = sel3.jitter ?? 0

// Lines 284-291: Random function fallbacks
while (set.size < count) set.add(Math.floor(Math.random() * length));
return Array.from(set).map(p => (p + startOffset) % length);
```

#### Array and Object Fallbacks

**File**: `src/composables/useNotesMatrix.js`
```javascript
// Lines 186-194: Options processing with fallbacks
scale: options.scale || null,
baseNote: options.baseNote || matrixState.value.globalBaseNote,
length: options.length || matrixState.value.stepCount,
octaveRange: options.octaveRange || 2,
densityMode: options.densityMode || 'auto',
manualDensity: typeof options.manualDensity === 'number' ? Math.max(0, Math.min(1, options.manualDensity)) : 0.3,
autoDensity: typeof options.autoDensity === 'number' ? Math.max(0, Math.min(1, options.autoDensity)) : 0.3,
startOffset: typeof options.startOffset === 'number' ? Math.max(0, Math.min((options.length || matrixState.value.stepCount) - 1, Math.floor(options.startOffset))) : null,
noteRangeMin: options.noteRangeMin || 24,
noteRangeMax: options.noteRangeMax || 96,

// Lines 543-548: Pattern probability fallbacks
const eu = Number(raw.euclidean || 0)
const sc = Number(raw.scale || 0)  
const rnd = Number(raw.random || 0)

// Lines 897-899: Import fallbacks
matrixState.value.globalBaseNote = data.state.globalBaseNote || 60
matrixState.value.stepCount = data.state.stepCount || 16
```

### 3. Environment Guards (9 instances)

#### Window Existence Checks

**File**: `src/stores/audioStore.js`
```javascript
// Line 508-519: Window-dependent debug setup
if (typeof window !== 'undefined') {
  window.__LOOP_DEBUG = true
  window.__DBG = {
    getMeta: (id) => notesMatrix.loopMetadata[id],
    getNotes: (id) => notesMatrix.getLoopNotes(id),
    setMeta: (id, updates) => notesMatrix.updateLoopMetadata(id, updates),
    // ... more debug methods
  }
}
```

#### Debug Flag Guards

**File**: `src/utils/patternGenerators.js`
```javascript
// Line 14: Debug flag check
const DEBUG = (typeof window !== 'undefined' && Boolean(window.__LOOP_DEBUG)) || (typeof import.meta !== 'undefined' && import.meta.env && String(import.meta.env.VITE_LOOP_DEBUG) === 'true')
```

**File**: `src/composables/useNotesMatrix.js`
```javascript
// Line 5: Debug flag check
const DEBUG = typeof window !== 'undefined' && Boolean(window.__LOOP_DEBUG)
```

#### Window Event Listeners

**File**: `src/components/AppHeader.vue`
```javascript
// Lines 434-437: Window resize listener
window.addEventListener('resize', setHeaderOffset)
window.removeEventListener('resize', setHeaderOffset)
```

### 4. Type Validation Guards (98+ instances)

#### Object/Array Validation

**File**: `src/utils/noteUtils.js`
```javascript
// Line 10: Array and type validation
if (!Array.isArray(scale) || typeof baseNote !== 'number' || !noteRange || typeof noteRange.min !== 'number' || typeof noteRange.max !== 'number') {
  return possibleNotes
}
```

**File**: `src/stores/modules/loopManager.js`
```javascript
// Line 159-160: Scale name validation
if (!scaleName || scaleName === 'null') {
  console.warn(`Invalid scale name provided: "${scaleName}", using 'major' as default`)
  scaleName = 'major'
}
```

#### Parameter Validation

**File**: `src/composables/useMelodicGenerator.js`
```javascript
// Line 185-187: Missing metadata fallback
if (!meta) {
  // Fallback if metadata is missing
  const pattern = ['euclidean', 'scale', 'random'][Math.floor(Math.random() * 3)]
  melLog(`selectPatternType loop=${loopId} missing metadata -> ${pattern} (fallback)`)
  return pattern
}
```

#### Function Parameter Type Guards

**File**: `src/utils/patternGenerators.js`
```javascript
// Line 31-32: Metadata validation
const meta = notesMatrix.loopMetadata && notesMatrix.loopMetadata[loopId]
if (!meta || typeof meta.length !== 'number' || meta.length <= 0) {
  return []
}
```

### 5. Bounds Checking (50+ instances)

#### Array Index Validation

**File**: `src/composables/useNotesMatrix.js`
```javascript
// Lines 135-136: Loop bounds check
if (loopId >= MAX_LOOPS || !loopMetadata[loopId]) {
  return { density: 0, noteCount: 0, length: 0 }
}

// Line 168: Density function bounds check
if (loopId >= MAX_LOOPS || !loopMetadata[loopId]) return 0.3

// Line 228: Set loop active bounds check
if (loopId >= MAX_LOOPS || !loopMetadata[loopId]) return

// Line 244: Update metadata bounds check
if (loopId >= MAX_LOOPS || !loopMetadata[loopId]) return

// Line 277: Get loop notes bounds check
if (loopId >= MAX_LOOPS || !loopMetadata[loopId]) return []

// Line 294: Set loop notes bounds check
if (loopId >= MAX_LOOPS || !loopMetadata[loopId]) return

// Line 320: Set loop note bounds check
if (loopId >= MAX_LOOPS || step >= MAX_STEPS || !loopMetadata[loopId]) return

// Line 333: Clear loop note bounds check
if (loopId >= MAX_LOOPS || step >= MAX_STEPS || !loopMetadata[loopId]) return

// Line 346: Get note bounds check
if (loopId >= MAX_LOOPS || step >= MAX_STEPS) return null

// Line 441: Resize loop bounds check
if (loopId >= MAX_LOOPS || !loopMetadata[loopId] || newLength <= 0 || newLength > MAX_STEPS) return

// Line 460: Quantize loop bounds check
if (loopId >= MAX_LOOPS || !loopMetadata[loopId]) return

// Line 564: Transpose loop bounds check
if (loopId >= MAX_LOOPS || !loopMetadata[loopId]) return

// Line 588: Rotate loop bounds check
if (loopId >= MAX_LOOPS || !loopMetadata[loopId]) return

// Line 618: Invert loop bounds check
if (loopId >= MAX_LOOPS || !loopMetadata[loopId]) return

// Line 656: Mutate loop bounds check
if (loopId >= MAX_LOOPS || !loopMetadata[loopId]) return
```

#### Loop State Validation

**File**: `src/stores/modules/loopManager.js`
```javascript
// Line 567-568: Note validation
const midiNote = notesMatrix.getNote(loop.id, step)
if (midiNote === null || midiNote === undefined) return

// Line 318-319: Source/target validation
if (sourceLoopId >= MAX_LOOPS || targetLoopId >= MAX_LOOPS ||
  !loopMetadata[sourceLoopId] || !loopMetadata[targetLoopId]) return
```

### 6. Defensive Error Handling

#### Try-Catch Blocks with Fallbacks

**File**: `src/stores/audioEngine.js`
```javascript
// Line 122: Callback error handling
try { if (typeof _transportMainCallback.cb === 'function') _transportMainCallback.cb(time, _internalPulse) } catch (err) { console.warn('[audioEngine] transport main callback error', err) }
for (const l of transportListeners) { try { l(time, _internalPulse) } catch (err) { console.warn('[audioEngine] transport listener error', err) } }
```

**File**: `src/services/tonalService.js`
```javascript
// Line 18-19: Library function fallback
if (TonalLoaded && NoteModule && typeof NoteModule.fromMidi === 'function') {
  try { return NoteModule.fromMidi(midi) } catch (e) { /* fallback */ }
}
```

## Root Cause Analysis

### Why Defensive Code Was Added

1. **Initialization Order Issues**: Modules are created at different times with uncertain dependency states
2. **Missing Dependency Injection**: Global dependencies like `useAudioStore()` called from within modules
3. **Race Conditions**: Asynchronous initialization without proper guards
4. **API Contract Uncertainty**: No clear interface contracts between modules
5. **Environment Variability**: Code must work in browser, Node.js, and testing environments

### Pattern Concentration by Module

**Highest Defensive Code Density**:
1. `useNotesMatrix.js` - 80+ instances (data layer uncertainty)
2. `audioStore.js` - 50+ instances (coordination complexity)
3. `loopManager.js` - 40+ instances (audio system integration)
4. `evolutionSystem.js` - 30+ instances (dependency chain)

**Moderate Defensive Code Density**:
5. `energyManager.js` - 20+ instances
6. `audioEngine.js` - 15+ instances  
7. `patternGenerators.js` - 15+ instances

**Low Defensive Code Density**:
8. UI Components - 10+ instances
9. Services - 5+ instances
10. Utils - 5+ instances

## Impact Assessment

### Performance Impact

- **High Impact**: Bounds checking in audio callbacks (16x/second)
- **Medium Impact**: Type validation in pattern generation
- **Low Impact**: Environment checks, debug guards

### Maintainability Impact

- **Critical**: Function existence checks obscure true dependencies
- **High**: Fallback chains make data flow unclear
- **Medium**: Type validation creates noise in business logic

### Code Clarity Impact

- **Critical**: Defensive code masks business logic intent
- **High**: Multiple fallback paths create uncertainty
- **Medium**: Environment checks pollute logic

## Removal Strategy

### Phase 1: High-Impact Targets (Remove First)
1. **Function existence checks in hot paths** (audio callbacks)
2. **Bounds checking in notesMatrix** (performance critical)
3. **Fallback chains in presetStore** (state management)

### Phase 2: Medium-Impact Targets
1. **Type validation in business logic**
2. **Parameter fallback assignments**
3. **Array/object validation guards**

### Phase 3: Low-Impact Targets  
1. **Environment checks**
2. **Debug flag guards**
3. **UI component validations**

## Success Criteria

- [ ] Zero function existence checks (`typeof obj.method === 'function'`)
- [ ] Zero fallback value assignments (`||`, `??`) in business logic
- [ ] Centralized validation instead of scattered guards
- [ ] Clear interface contracts replace uncertainty
- [ ] Performance improvement in hot paths (audio callbacks)

---

*This inventory serves as the roadmap for systematic defensive code removal. Each pattern should be addressed with proper architectural fixes rather than band-aid solutions.*