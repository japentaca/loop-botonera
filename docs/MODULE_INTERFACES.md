# Module Interface Documentation

## Overview

This document provides a comprehensive interface contract for all modules in the audio loop system. It serves as the foundation for removing defensive code by establishing clear contracts between modules.

## Core Architecture

The system follows a **Centralized Audio Store** pattern where:
- `audioStore` acts as the central hub coordinating all modules
- `useNotesMatrix` provides the single source of truth for musical data
- Specialized modules (`loopManager`, `energyManager`, `evolutionSystem`) handle domain-specific logic
- `audioEngine` manages the low-level audio infrastructure

## Module Dependencies Map

```
audioStore (Central Coordinator)
├── useNotesMatrix (Data Layer)
├── useAudioEngine (Audio Infrastructure)
├── useLoopManager (Loop Management)
├── useEnergyManager (Energy Balance)
└── useEvolutionSystem (Musical Evolution)
```

## Module Interface Contracts

### 1. AudioStore (`src/stores/audioStore.js`)

**Purpose**: Central coordinator that manages global state and orchestrates between modules.

**Constructor Dependencies**:
```javascript
constructor(
  notesMatrix,           // Required: useNotesMatrix instance
  audioEngine,          // Required: useAudioEngine instance  
  loopManager,          // Required: useLoopManager instance
  energyManager,        // Required: useEnergyManager instance
  evolutionSystem       // Required: useEvolutionSystem instance
)
```

**Required Methods**:
- `initAudio()` - Initialize audio system
- `initMusicComponents()` - Initialize music components after preset load
- `togglePlay()` - Toggle playback
- `toggleLoop(id)` - Toggle loop active state
- `updateLoopParam(id, param, value)` - Update loop parameters
- `regenerateLoop(id)` - Regenerate individual loop
- `updateScale(newScale)` - Update global musical scale
- `startAutoEvolve()` / `stopAutoEvolve()` - Control automatic evolution

**State Properties**:
- `audioInitialized: Ref<boolean>` - Audio system ready state
- `isPlaying: Ref<boolean>` - Playback state
- `currentScale: Ref<string>` - Current musical scale name
- `loops: Ref<Array>` - Array of loop objects
- `tempo: Ref<number>` - Current tempo
- `masterVol: Ref<number>` - Master volume level

**Defensive Code Issues**:
- `typeof window !== 'undefined'` checks throughout
- Fallback values for function existence
- Conditional method calls with existence checks

### 2. UseNotesMatrix (`src/composables/useNotesMatrix.js`)

**Purpose**: Single source of truth for all musical data (notes, patterns, metadata).

**Constructor**: No dependencies (standalone composable)

**Required Methods**:
- `initializeLoop(loopId, options)` - Initialize loop with metadata
- `getLoopNotes(loopId)` - Get notes array for loop
- `setLoopNote(loopId, step, note)` - Set individual note
- `generateLoopNotes(loopId, options)` - Generate pattern for loop
- `getEffectiveDensity(loopId)` - Get current density for loop
- `updateLoopMetadata(loopId, metadata)` - Update loop metadata
- `quantizeLoop(loopId, scale)` - Quantize loop to scale

**State Properties**:
- `notesMatrix: Readonly<Array<Array>>` - 2D array of MIDI notes
- `loopMetadata: Readonly<Array>` - Metadata for each loop
- `matrixState: Readonly<Ref>` - Global matrix state

**Required Metadata Structure**:
```javascript
{
  isActive: boolean,
  scale: string,        // Scale name (e.g., 'major', 'minor')
  baseNote: number,     // MIDI note number
  length: number,       // Loop length in steps
  density: number,      // Current density (0-1)
  densityMode: 'auto' | 'manual',
  manualDensity: number, // Manual density override
  noteRangeMin: number,  // MIDI note range min
  noteRangeMax: number,  // MIDI note range max
  generationMode: 'auto' | 'locked',
  patternProbabilities: { euclidean: number, scale: number, random: number }
}
```

**Defensive Code Issues**:
- Extensive bounds checking (`if (loopId >= MAX_LOOPS)`)
- Fallback value assignments (`||`, `??`)
- Type validation guards
- Null/undefined checks throughout

### 3. UseLoopManager (`src/stores/modules/loopManager.js`)

**Purpose**: Manages loop creation, configuration, and audio chain setup.

**Constructor Dependencies**:
```javascript
constructor(notesMatrix)  // Required: notesMatrix instance
```

**Required Methods**:
- `createLoop(id, scaleName, audioEngine)` - Create complete loop with audio
- `initializeLoops(scaleName, audioEngine)` - Initialize all loops
- `toggleLoop(id)` - Toggle loop active state
- `updateLoopParam(id, param, value)` - Update loop parameters
- `regenerateLoop(id, scale, scaleName)` - Regenerate loop content
- `playLoopNote(loop, audioEngine, step, time)` - Play note at specific time

**State Properties**:
- `loops: ShallowRef<Array>` - Array of loop objects
- `NUM_LOOPS: number` - Total number of loops
- `synthTypes: Array<string>` - Available synthesizer types

**Defensive Code Issues**:
- `typeof notesMatrix === 'function'` checks
- Null checks for `notesMatrix` parameter
- Fallback return values

### 4. UseEnergyManager (`src/stores/modules/energyManager.js`)

**Purpose**: Manages sonic energy balance across active loops.

**Constructor Dependencies**:
```javascript
constructor(notesMatrix)  // Required: notesMatrix instance
```

**Required Methods**:
- `calculateSonicEnergy(loops)` - Calculate total sonic energy
- `getAdaptiveVolume(loops, loopId)` - Get volume for specific loop
- `adjustAllLoopVolumes(loops)` - Balance volumes across loops
- `checkAndBalanceEnergy(loops)` - Check and balance if needed
- `getOptimalDensityForNewLoop(loops)` - Get density for new loop

**State Properties**:
- `energyManagementEnabled: Ref<boolean>` - Feature toggle
- `maxSonicEnergy: Ref<number>` - Maximum allowed energy
- `energyReductionFactor: Ref<number>` - Reduction factor when over limit

**Defensive Code Issues**:
- Type validation for numerical parameters
- Null/undefined checks for loop arrays
- Fallback density calculations

### 5. UseEvolutionSystem (`src/stores/modules/evolutionSystem.js`)

**Purpose**: Handles automatic musical evolution and mutation.

**Constructor Dependencies**:
```javascript
constructor(notesMatrix, melodicGenerator)  // Both optional but recommended
```

**Required Methods**:
- `evolveMultipleLoops(loops, scaleIntervals)` - Evolve selected loops
- `applyMatrixMutation(loopId, notesMatrix, type, params)` - Apply specific mutation
- `forceEvolution(loops, scaleIntervals)` - Force immediate evolution

**State Properties**:
- `autoEvolutionEnabled: Ref<boolean>` - Auto-evolution toggle
- `evolutionInterval: Ref<number>` - Interval between evolutions
- `evolutionIntensity: Ref<number>` - Intensity of changes (0-1)
- `evolutionTypes: Ref<Object>` - Types of evolution enabled

**Defensive Code Issues**:
- Function existence checks
- Optional parameter validation
- Fallback behavior for missing dependencies

### 6. UseAudioEngine (`src/stores/modules/audioEngine.js`)

**Purpose**: Low-level audio infrastructure and Tone.js integration.

**Constructor**: No dependencies (standalone)

**Required Methods**:
- `initAudio()` - Initialize Tone.js audio system
- `playNote(audioChain, note, duration, velocity, time)` - Play MIDI note
- `createAudioChain(synthConfig, effectsConfig)` - Create audio processing chain
- `updateTempo(newTempo)` - Update playback tempo
- `togglePlay()` - Toggle transport playback

**State Properties**:
- `audioInitialized: Ref<boolean>` - Audio system ready state
- `isPlaying: Ref<boolean>` - Transport playback state
- `currentPulse: Ref<number>` - Current pulse position
- `tempo: Ref<number>` - Current BPM

**Defensive Code Issues**:
- Environment checks (`typeof window !== 'undefined'`)
- Audio context existence validation
- Fallback behaviors for unsupported features

## Circular Dependencies Identified

1. **EvolutionSystem → AudioStore**: Evolution system imports and uses audioStore for context
   - **Solution**: Pass required context as parameters instead of global import

2. **LoopManager → MelodicGenerator**: LoopManager creates melodic generator when notesMatrix available
   - **Solution**: Inject melodicGenerator dependency in constructor

3. **AudioStore → All Modules**: Central coordinator imports all modules
   - **Solution**: This is expected - AudioStore is the composition root

## Missing Method Contracts

### NotesMatrix Method Signatures (Currently Inconsistent)

**Current Issues**:
- Some methods accept optional parameters inconsistently
- Return types not guaranteed
- No validation of required parameters

**Required Contract Standardization**:
```javascript
// All methods should validate required parameters
function generateLoopNotes(loopId, options = {}) {
  validateLoopId(loopId)  // Throw if invalid
  validateOptions(options) // Throw if invalid format
  
  // Method implementation
}

// All methods should return consistent types
function getLoopNotes(loopId) {
  return Array<MIDI note or null>  // Guaranteed return type
}
```

## Initialization Sequence Dependencies

**Current Order**:
1. AudioStore initialization
2. NotesMatrix creation
3. Module creation with NotesMatrix dependency
4. AudioEngine initialization
5. Music components initialization

**Required Order**:
1. AudioEngine (no dependencies)
2. NotesMatrix (no dependencies)
3. LoopManager with NotesMatrix
4. EnergyManager with NotesMatrix  
5. EvolutionSystem with NotesMatrix
6. AudioStore with all dependencies injected

## Interface Validation Rules

### Development Mode Only
```javascript
function validateModuleInterface(moduleInstance, requiredMethods) {
  if (process.env.NODE_ENV === 'development') {
    requiredMethods.forEach(method => {
      if (typeof moduleInstance[method] !== 'function') {
        throw new Error(`Module missing required method: ${method}`)
      }
    })
  }
}
```

### Parameter Validation
```javascript
function validateLoopId(loopId) {
  if (!Number.isInteger(loopId) || loopId < 0 || loopId >= MAX_LOOPS) {
    throw new Error(`Invalid loopId: ${loopId}. Must be integer 0-${MAX_LOOPS-1}`)
  }
}

function validateDensity(density) {
  if (typeof density !== 'number' || isNaN(density) || density < 0 || density > 1) {
    throw new Error(`Invalid density: ${density}. Must be number between 0 and 1`)
  }
}
```

## Migration Strategy

### Phase 1: Interface Documentation ✓
- Document all current interfaces
- Identify defensive code patterns
- Map dependencies

### Phase 2: Contract Enforcement
- Add interface validation in development mode
- Remove defensive code in favor of clear contracts
- Implement proper dependency injection

### Phase 3: Constructor Refactoring
- Update all modules to accept dependencies explicitly
- Remove magic global dependencies
- Establish proper initialization sequence

### Phase 4: Defensive Code Removal
- Replace function existence checks with contract validation
- Remove fallback values in favor of proper error handling
- Centralize parameter validation

## Success Metrics

- **Zero function existence checks** (`typeof obj.method === 'function'`)
- **Zero fallback assignments** (`||`, `??` operators in business logic)
- **Clear interface contracts** with JSDoc or TypeScript definitions
- **Deterministic initialization** without race conditions
- **Explicit dependency injection** for all module relationships

---

*This interface contract serves as the foundation for all subsequent refactoring phases. Any changes to these interfaces should be carefully considered and documented.*