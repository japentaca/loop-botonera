# Melodic Generation System - Implementation Plan

## Project Overview
Implementation of a modular melodic generation system with counterpoint awareness for the loop-botonera project. The system generates structured melodic patterns across multiple loops, with each loop acting as an independent voice that can interact harmoniously with others.

## Core Requirements
- **Generation Strategy**: Loops are melodically aware of each other with simple counterpoint (note avoidance)
- **Triggers**: Manual regeneration (B) and mode/settings changes (D) only
- **Patterns**: All 7 pattern types available with per-loop probability sliders
- **Musical Intelligence**: No voice roles, no chord progressions, uses global scale only
- **Note Range**: Each loop has editable note range (default: full range)
- **Evolution Integration**: Evolution system can break patterns (option B)
- **Pattern Length**: Mix of approaches depending on pattern type (option D)
- **UI Control**: Per-loop settings with existing regenerate buttons
- **Counterpoint**: Simple avoidance - loops avoid playing same notes at same time
- **Implementation**: Incremental approach - core patterns first, then expand

---

## Implementation Phases

### PHASE 1: Core Infrastructure ✅ Status: NOT_STARTED
**Goal**: Establish the foundation for melodic generation system

#### Task 1.1: Create Pattern Generation Module
**Status**: NOT_STARTED
**File**: `src/utils/patternGenerators.js`
**Description**: Create new utility module with pattern generator functions
**Implementation Details**:
```javascript
// Structure:
// - Pure functions for each pattern type
// - Input: { length, scale, baseNote, noteRange, density, options }
// - Output: Array of notes (with nulls for rests)
// Core patterns for Phase 1:
// 1. generateEuclideanPattern()
// 2. generateArpeggioPattern()
// 3. generateRandomPattern() (enhanced current implementation)
```
**Dependencies**: None
**Testing**: Manual testing - generate patterns with various parameters and verify output
**Success Criteria**: 
- All 3 core pattern generators return valid note arrays
- Patterns respect length, scale, and note range constraints

---

#### Task 1.2: Create Counterpoint Service
**Status**: NOT_STARTED
**File**: `src/services/counterpointService.js`
**Description**: Implement simple counterpoint logic for note avoidance
**Implementation Details**:
```javascript
// Functions:
// - analyzeActiveLoops(loopsArray, currentStep) -> Map of occupied notes
// - avoidConflicts(proposedNote, occupiedNotes, scale, options) -> adjusted note
// - validateCounterpoint(loopId, noteArray, otherLoops) -> boolean
```
**Dependencies**: Task 1.1
**Testing**: Manual testing - test note collision detection with multiple active loops
**Success Criteria**:
- Correctly identifies note collisions across active loops
- Suggests alternative notes in scale when conflicts occur

---

#### Task 1.3: Extend Loop Metadata Structure
**Status**: NOT_STARTED
**Files**: 
- `src/composables/useNotesMatrix.js`
- `src/composables/useNotesMatrix_optimized.js`
**Description**: Add pattern generation settings to loop metadata
**Implementation Details**:
```javascript
// Add to loopMetadata structure:
loopMetadata[loopId] = {
  // ... existing fields ...
  noteRangeMin: 24,        // MIDI note min (default: full range)
  noteRangeMax: 96,        // MIDI note max (default: full range)
  patternProbabilities: {  // Per-loop pattern weights
    euclidean: 0.3,
    arpeggio: 0.3,
    random: 0.4,
    // Will add more in Phase 2
  },
  generationMode: 'auto',  // 'auto' | 'locked'
  lastPattern: null        // Track what was generated for reference
}
```
**Dependencies**: None
**Testing**: Manual testing - verify metadata structure and preset save/load
**Success Criteria**:
- New fields initialize correctly
- Fields persist through preset save/load
- Backward compatibility maintained

---

#### Task 1.4: Create Melodic Generation Coordinator
**Status**: NOT_STARTED
**File**: `src/composables/useMelodicGenerator.js`
**Description**: Main composable that orchestrates pattern generation
**Implementation Details**:
```javascript
// Core functions:
// - generateLoopMelody(loopId, options) -> Array
// - regenerateLoop(loopId) -> void (uses existing metadata)
// - regenerateAllLoops() -> void
// - selectPatternType(loopId) -> string (based on probabilities)
// - applyCounterpoint(loopId, notes, activeLoops) -> Array
```
**Dependencies**: Tasks 1.1, 1.2, 1.3
**Testing**: Manual testing - generate melodies for multiple loops with various settings
**Success Criteria**:
- Correctly selects pattern based on probabilities
- Applies counterpoint when multiple loops active
- Respects note range constraints
- Handles edge cases (no active loops, locked loops)

---

#### Task 1.5: Integrate with Existing Generation System
**Status**: NOT_STARTED
**Files**: 
- `src/composables/useNotesMatrix.js` (modify `generateLoopNotes`)
- `src/stores/audioStore.js` (add regeneration methods)
**Description**: Replace/enhance existing random generation with new system
**Implementation Details**:
```javascript
// In useNotesMatrix.js:
// - Refactor generateLoopNotes() to use useMelodicGenerator
// - Maintain backward compatibility
// - Add option to use legacy random generation

// In audioStore.js:
// - Add regenerateLoopMelody(loopId)
// - Add regenerateAllMelodies()
// - Expose to components
```
**Dependencies**: Task 1.4
**Testing**: Manual testing - verify existing features work with new system
**Success Criteria**:
- Existing presets load correctly
- New generation can be toggled/disabled
- No breaking changes to current features

---

### PHASE 2: Pattern Implementations ✅ Status: NOT_STARTED
**Goal**: Implement the 3 core pattern types

#### Task 2.1: Implement Euclidean Pattern Generator
**Status**: NOT_STARTED
**File**: `src/utils/patternGenerators.js` (add function)
**Description**: Implement Euclidean rhythm algorithm for even note distribution
**Implementation Details**:
```javascript
// Algorithm: Bjorklund's algorithm
// Parameters:
// - steps: loop length
// - pulses: number of notes (from density)
// - rotation: offset pattern (0 to steps-1)
// Note selection: Random from scale on each pulse
// Length behavior: Distributes notes evenly across entire loop length
```
**Algorithm Reference**: https://en.wikipedia.org/wiki/Euclidean_rhythm
**Dependencies**: Task 1.1
**Testing**: Manual testing - test various step/pulse combinations and verify distribution
**Success Criteria**:
- Generates mathematically correct Euclidean distributions
- Notes evenly spaced according to algorithm
- Works for any loop length 1-64 steps

---

#### Task 2.2: Implement Arpeggio Pattern Generator
**Status**: NOT_STARTED
**File**: `src/utils/patternGenerators.js` (add function)
**Description**: Generate arpeggio patterns (broken chords)
**Implementation Details**:
```javascript
// Arpeggio types (randomly selected or user preference):
// - UP: scale degrees ascending
// - DOWN: scale degrees descending
// - UP_DOWN: ascend then descend
// - DOWN_UP: descend then ascend
// - RANDOM: random order of scale degrees
// 
// Length behavior: 
// - Short loops (≤8 steps): Simple 3-4 note arpeggio, repeated
// - Medium loops (9-16): Extended arpeggio with variations
// - Long loops (17+): Multiple arpeggio cycles with octave changes
//
// Density handling: Add rests between notes based on density parameter
```
**Dependencies**: Task 1.1
**Testing**: Manual testing - test all arpeggio types with various loop lengths
**Success Criteria**:
- All 5 arpeggio types generate correctly
- Respects note range constraints
- Adapts to different loop lengths appropriately

---

#### Task 2.3: Implement Enhanced Random Pattern Generator
**Status**: NOT_STARTED
**File**: `src/utils/patternGenerators.js` (add function)
**Description**: Formalize current random generation as a pattern type
**Implementation Details**:
```javascript
// Same as current implementation but structured:
// - Shuffle positions for distribution
// - Select random scale degrees
// - Add option for "weighted randomness" (prefer certain scale degrees)
// - Add option for "melodic randomness" (favor stepwise motion)
//
// Length behavior: Uniform random distribution across entire length
```
**Dependencies**: Task 1.1
**Testing**: Manual testing - verify random distribution and optional enhancements
**Success Criteria**:
- Maintains current random generation quality
- Properly integrated as selectable pattern
- Optional enhancements working

---

#### Task 2.4: Pattern Selection Logic
**Status**: NOT_STARTED
**File**: `src/composables/useMelodicGenerator.js` (enhance)
**Description**: Implement probability-based pattern selection
**Implementation Details**:
```javascript
// selectPatternType(loopId):
// 1. Get loop's patternProbabilities from metadata
// 2. Normalize probabilities to sum to 1.0
// 3. Use weighted random selection
// 4. Return selected pattern type string
//
// Example: { euclidean: 0.3, arpeggio: 0.5, random: 0.2 }
// Should select arpeggio 50% of the time
```
**Dependencies**: Tasks 2.1, 2.2, 2.3
**Testing**: Manual testing - verify pattern selection matches probabilities over multiple generations
**Success Criteria**:
- Pattern selection matches specified probabilities
- Handles edge cases (all zeros, single 1.0, etc.)

---

### PHASE 3: User Interface ✅ Status: NOT_STARTED
**Goal**: Create UI controls for melodic generation settings

#### Task 3.1: Create Pattern Settings Component
**Status**: NOT_STARTED
**File**: `src/components/PatternSettings.vue`
**Description**: Per-loop pattern probability sliders UI
**Implementation Details**:
```vue
<!-- Component structure:
- Display for loop metadata
- Sliders for each pattern type (euclidean, arpeggio, random)
- Note range min/max inputs
- Lock/unlock toggle
- Visual feedback for current pattern type
- Real-time probability updates
-->
```
**Dependencies**: Phase 2 complete
**Testing**: Manual UI testing - verify sliders, inputs, and visual feedback
**Success Criteria**:
- Sliders update loop metadata correctly
- Values persist through preset changes
- Intuitive and responsive UI

---

#### Task 3.2: Integrate into LoopCard Component
**Status**: NOT_STARTED
**File**: `src/components/LoopCard.vue`
**Description**: Add pattern settings to each loop card
**Implementation Details**:
```vue
<!-- Add to LoopCard:
- Expandable section for pattern settings
- Regenerate button (already exists, verify integration)
- Visual indicator of current pattern type
- Lock icon when loop is locked from regeneration
-->
```
**Dependencies**: Task 3.1
**Testing**: Manual testing - verify integration with existing loop controls
**Success Criteria**:
- Settings accessible from each loop
- Doesn't clutter existing UI
- Works with existing regenerate functionality

---

#### Task 3.3: Add Global Regenerate Control
**Status**: NOT_STARTED
**File**: `src/components/AppHeader.vue` or similar
**Description**: Add "Regenerate All" button to global controls
**Implementation Details**:
```vue
<!-- Add button that:
- Calls regenerateAllLoops() from audioStore
- Shows confirmation dialog (optional)
- Respects locked loops
- Provides visual feedback during generation
-->
```
**Dependencies**: Task 1.5
**Testing**: Manual testing - test with various loop states (locked, unlocked, mixed)
**Success Criteria**:
- Regenerates all unlocked loops
- Respects counterpoint across all loops
- Smooth user experience

---

### PHASE 4: Testing & Integration ✅ Status: NOT_STARTED
**Goal**: Comprehensive testing and preset integration

#### Task 4.1: Preset System Integration
**Status**: NOT_STARTED
**Files**: 
- `src/stores/presetStore.js`
- `src/services/presetService.js`
**Description**: Ensure pattern settings save/load with presets
**Implementation Details**:
```javascript
// Update preset structure to include:
// - Per-loop noteRangeMin/Max
// - Per-loop patternProbabilities
// - generationMode (locked/auto)
//
// Verify:
// - Save includes new fields
// - Load correctly restores settings
// - Backward compatibility with old presets (use defaults)
```
**Dependencies**: Phase 3 complete
**Testing**: Manual testing - save and load various preset configurations
**Success Criteria**:
- All pattern settings persist correctly
- Old presets load with sensible defaults
- No data loss on save/load cycles

---

#### Task 4.2: Evolution System Compatibility
**Status**: NOT_STARTED
**File**: `src/stores/modules/evolutionSystem.js`
**Description**: Verify evolution system works with new patterns
**Implementation Details**:
```javascript
// Ensure evolution:
// - Can break patterns as intended (option B from requirements)
// - Respects locked loops (no evolution on locked)
// - Maintains counterpoint after mutations
// - Doesn't corrupt pattern metadata
```
**Dependencies**: Phase 2 complete
**Testing**: Manual testing - run evolution cycles with various patterns active
**Success Criteria**:
- Evolution successfully mutates patterned loops
- No crashes or data corruption
- Musical output remains coherent

---

#### Task 4.3: Performance Optimization
**Status**: NOT_STARTED
**Files**: Multiple (optimization pass)
**Description**: Optimize pattern generation for real-time performance
**Implementation Details**:
```javascript
// Optimization targets:
// - Cache generated patterns when possible
// - Minimize recalculation on metadata changes
// - Efficient counterpoint checking
// - Debounce UI slider updates
//
// Performance targets:
// - Pattern generation: < 10ms per loop
// - Regenerate all (16 loops): < 200ms
// - UI responsiveness: no perceivable lag
```
**Dependencies**: All previous phases
**Testing**: Manual performance testing - profile generation times and UI responsiveness
**Success Criteria**:
- Meets performance targets
- No UI lag during generation
- Smooth audio playback during regeneration

---

#### Task 4.4: Documentation & Examples
**Status**: NOT_STARTED
**Files**: Create documentation files
**Description**: Document the melodic generation system
**Implementation Details**:
```markdown
# Create:
# - MELODIC_GENERATION.md: System overview and architecture
# - PATTERN_TYPES.md: Detailed pattern descriptions and parameters
# - API_REFERENCE.md: Developer API documentation
# - Update README.md with new features
#
# Include:
# - Code examples
# - Musical theory explanations
# - Usage patterns
// - Troubleshooting guide
```
**Dependencies**: All implementation complete
**Testing**: Manual review - verify documentation accuracy and clarity
**Success Criteria**:
- Clear documentation for users and developers
- Examples are accurate and helpful
- Easy to understand for new contributors

---

## Future Phases (Post-Core Implementation)

### PHASE 5: Additional Pattern Types ⏸️ Status: PLANNED
Add remaining pattern types one by one:
- **Task 5.1**: Scalar runs (ascending/descending passages)
- **Task 5.2**: Melodic contours (arch, valley, etc.)
- **Task 5.3**: Motif repetition (generate and vary motifs)
- **Task 5.4**: Call and response (inter-loop patterns)
- **Task 5.5**: Polyrhythmic patterns (different subdivisions)

### PHASE 6: Advanced Features ⏸️ Status: PLANNED
- **Task 6.1**: Pattern morphing (smooth transitions between patterns)
- **Task 6.2**: Advanced counterpoint rules (interval preferences)
- **Task 6.3**: Pattern templates library (save/load favorite patterns)
- **Task 6.4**: Harmonic analysis and suggestions
- **Task 6.5**: MIDI export of generated patterns

---

## Status Legend
- ✅ **NOT_STARTED**: Task has not been begun
- 🔄 **IN_PROGRESS**: Currently being implemented
- ✔️ **COMPLETED**: Implementation finished and tested
- ⚠️ **BLOCKED**: Waiting on dependencies or issues
- 🐛 **FIXING**: Bug fixes in progress
- ⏸️ **PLANNED**: Future work, not yet scheduled

---

## Session Continuation Instructions

### For AI Agent:
When user says "continue with implementation of this plan":

1. **Check Current Status**: Read this file and identify the first task with status `NOT_STARTED`
2. **Verify Dependencies**: Ensure all dependency tasks are `COMPLETED`
3. **Announce Task**: Tell user which task you're implementing (e.g., "Implementing Task 1.1: Create Pattern Generation Module")
4. **Implement**: Follow the task's Implementation Details exactly
5. **Update Status**: Change task status to `IN_PROGRESS` during work
6. **Test**: Follow testing instructions in task
7. **Complete**: Update status to `COMPLETED` and commit changes
8. **Report**: Summarize what was done and what's next

### For User:
To continue implementation:
- Say: **"continue with implementation of this plan"** or **"implement next task"**
- To skip a task: **"skip task X.X and continue"**
- To revisit a task: **"reimplement task X.X"** or **"fix task X.X"**
- To check status: **"what's the current implementation status?"**

---

## File Structure Overview
```
src/
├── utils/
│   └── patternGenerators.js          [NEW] Pattern generation algorithms
├── services/
│   └── counterpointService.js        [NEW] Counterpoint logic
├── composables/
│   ├── useMelodicGenerator.js        [NEW] Main generation coordinator
│   ├── useNotesMatrix.js             [MODIFY] Add pattern support
│   └── useNotesMatrix_optimized.js   [MODIFY] Add pattern support
├── components/
│   ├── PatternSettings.vue           [NEW] Pattern UI controls
│   ├── LoopCard.vue                  [MODIFY] Integrate pattern settings
│   └── AppHeader.vue                 [MODIFY] Add regenerate all button
├── stores/
│   ├── audioStore.js                 [MODIFY] Add regeneration methods
│   ├── presetStore.js                [MODIFY] Save/load pattern settings
│   └── modules/
│       └── evolutionSystem.js        [MODIFY] Evolution compatibility
└── docs/
    ├── MELODIC_GENERATION.md         [NEW] System documentation
    ├── PATTERN_TYPES.md              [NEW] Pattern reference
    └── API_REFERENCE.md              [NEW] API documentation
```

---

## Testing Checklist

### Phase 1 Testing
- [ ] Pattern generators return valid arrays
- [ ] Counterpoint detects collisions correctly
- [ ] Metadata extends without breaking existing code
- [ ] Generation coordinator handles edge cases
- [ ] Integration maintains backward compatibility

### Phase 2 Testing
- [ ] Euclidean patterns mathematically correct
- [ ] Arpeggios generate correctly in all modes
- [ ] Random patterns properly distributed
- [ ] Pattern selection probabilities accurate
- [ ] All patterns respect note range constraints

### Phase 3 Testing
- [ ] UI sliders update metadata correctly
- [ ] Pattern settings persist through preset changes
- [ ] Regenerate buttons work for single and all loops
- [ ] Locked loops cannot be regenerated
- [ ] UI responsive and intuitive

### Phase 4 Testing
- [ ] Presets save/load with pattern settings
- [ ] Old presets load with sensible defaults
- [ ] Evolution system compatible with patterns
- [ ] Performance targets met
- [ ] Documentation accurate and helpful

---

## Notes & Decisions

### Design Decisions
1. **Pure Function Generators**: Pattern generators are pure functions for testability
2. **Counterpoint Service**: Separate service for potential future expansion
3. **Per-Loop Settings**: Maximum flexibility for complex arrangements
4. **Incremental Approach**: Reduces risk, allows for testing and refinement
5. **Backward Compatibility**: Existing presets and features must continue working

### Technical Constraints
- Loop length: 1-64 steps (MAX_STEPS constant)
- MIDI note range: 24-96 (adjustable per loop)
- Scale-based generation: All patterns use global scale
- Real-time performance: Generation must be near-instantaneous

### Musical Considerations
- Counterpoint keeps loops distinct and clear
- Pattern variety creates interest and movement
- Note range prevents muddy or shrill textures
- Density control maintains rhythmic space

---

## Change Log
- **2025-11-10**: Initial plan created based on user requirements
- Status: Ready for Phase 1 implementation

---

**END OF IMPLEMENTATION PLAN**
