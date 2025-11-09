# New Features Documentation

This document describes the three major features added to the loop-botonera music system.

## 1. Polyrhythmic Patterns

Polyrhythmic patterns allow loops to run at different time signatures simultaneously, creating complex rhythmic textures.

### Features

- **Multiple time signature ratios**: Support for 3:2, 3:4, 5:4, 7:4, 5:3, and 7:5 ratios
- **Automatic cycle calculation**: The system calculates the LCM (Least Common Multiple) to determine when all loops align
- **Easy enable/disable**: Toggle polyrhythm on/off without losing loop configurations

### Usage

```javascript
// Enable polyrhythm with a specific ratio
audioStore.enablePolyrhythm('3:4')

// Enable with automatic ratio selection
audioStore.enablePolyrhythm()

// Disable and return to standard timing
audioStore.disablePolyrhythm()

// Check polyrhythm status
const info = audioStore.polyrhythmInfo
console.log(info.enabled, info.ratio, info.cycleLength)
```

### How It Works

1. Each active loop is assigned a length based on the selected ratio
2. The system calculates when all loops will align (the polyrhythmic cycle)
3. Loops play independently but sync at cycle boundaries
4. Example: In a 3:4 ratio with base length 12, one loop has 9 steps, another has 12 steps, they align every 36 steps

## 2. Enhanced Scale System with Chord Progressions

The scale system now includes chord progression awareness, allowing for more harmonically coherent music generation.

### Features

- **Chord progression templates**: Pre-defined progressions for different scales (I-IV-V, ii-V-I, etc.)
- **Extended chord types**: Major7, minor7, dominant7, diminished7, major9, minor9, sus chords
- **Chord-aware melody generation**: Generate melodies that emphasize chord tones
- **Automatic chord progression**: Advance through chords as the music plays

### Usage

```javascript
// Initialize a chord progression
audioStore.initializeChordProgression(4) // 4-chord progression

// Get current chord info
const currentChord = audioStore.currentChord
console.log(currentChord.type, currentChord.notes, currentChord.degree)

// Advance to next chord
audioStore.advanceChordInProgression()

// Generate a chord-aware melody for a loop
audioStore.regenerateWithChordProgression(loopId)

// Get full progression info
const info = audioStore.progressionInfo
console.log(info.progression) // Array of chord objects
```

### Chord Progression Templates

Available for different scales:

- **Major**: I-IV-V-I, I-V-vi-IV, ii-V-I, I-vi-IV-V, I-iii-IV-V
- **Minor**: i-iv-v, i-VI-VII, i-iv-VII-VI, i-v-i
- **Dorian**: i-IV-i, i-IV-VII
- **Blues**: I-IV-V, I7-IV7-I7-V7

## 3. Style-Based Evolution Modes

Musical style presets that control how the evolution system behaves, creating genre-specific sounds and patterns.

### Available Styles

1. **Ambient**
   - Sparse, atmospheric textures (10-30% density)
   - Slow evolution (intensity: 0.2)
   - Scales: major, lydian, pentatonic, wholeTone
   - Tempo: 60-90 BPM
   - Chords: major, major7, sus2, sus4

2. **Jazz**
   - Complex harmonies, sophisticated progressions
   - Medium-high density (40-70%)
   - Active evolution (intensity: 0.5)
   - Scales: dorian, mixolydian, altered, bebop
   - Tempo: 120-180 BPM
   - Chords: major7, minor7, dominant7, halfDiminished7, major9

3. **Techno**
   - Repetitive, driving patterns
   - High density (60-90%)
   - Moderate evolution (intensity: 0.3)
   - Scales: minor, phrygian, harmonicMinor
   - Tempo: 120-140 BPM
   - Chords: minor, minor7, diminished

4. **Classical**
   - Traditional progressions, balanced approach
   - Medium density (40-60%)
   - Moderate evolution (intensity: 0.4)
   - Scales: major, minor, harmonicMinor
   - Tempo: 80-140 BPM
   - Chords: major, minor, diminished, dominant7

5. **Minimal**
   - Very sparse, slow changes
   - Low density (10-20%)
   - Minimal evolution (intensity: 0.1)
   - Scales: pentatonic, minorPentatonic, major
   - Tempo: 80-110 BPM
   - Chords: major, minor

6. **Experimental**
   - Unpredictable, dissonant
   - Variable density (30-80%)
   - High evolution (intensity: 0.8)
   - Scales: chromatic, wholeTone, diminished, altered
   - Tempo: 60-160 BPM
   - Chords: diminished, augmented, diminished7

7. **World**
   - Ethnic scales, exotic flavors
   - Medium density (30-60%)
   - Moderate evolution (intensity: 0.4)
   - Scales: hirajoshi, kumoi, pelog, pentatonic
   - Tempo: 90-130 BPM
   - Chords: major, minor, sus4

### Usage

```javascript
// Set a musical style
audioStore.setMusicalStyle('jazz')

// Get available styles
const styles = audioStore.availableStyles
console.log(styles) // ['ambient', 'jazz', 'techno', ...]

// Get current style info
const styleInfo = audioStore.currentStyleInfo
console.log(styleInfo.name, styleInfo.density, styleInfo.evolutionIntensity)

// Current style
const currentStyle = audioStore.currentStyle
```

### How Styles Affect Music

- **Evolution Intensity**: Controls how dramatically the system changes the music
- **Density**: Determines how many notes are active (sparse vs. dense)
- **Scale Preferences**: Each style favors certain scales
- **Chord Types**: Each style uses characteristic chord types
- **Tempo Range**: Suggests appropriate tempo for the style

## Integration Examples

### Example 1: Jazz Session with Chord Progressions

```javascript
// Set jazz style
audioStore.setMusicalStyle('jazz')

// Initialize a ii-V-I progression
audioStore.initializeChordProgression(3)

// Enable auto-evolution
audioStore.startAutoEvolve()

// The system will now generate jazz-appropriate patterns
// with chord-aware melodies
```

### Example 2: Polyrhythmic Techno

```javascript
// Set techno style
audioStore.setMusicalStyle('techno')

// Enable 5:4 polyrhythm
audioStore.enablePolyrhythm('5:4')

// Activate multiple loops
audioStore.toggleLoop(0)
audioStore.toggleLoop(1)
audioStore.toggleLoop(2)

// High-density, polyrhythmic techno patterns emerge
```

### Example 3: Ambient Soundscape

```javascript
// Set ambient style
audioStore.setMusicalStyle('ambient')

// Use a ethereal scale
audioStore.updateScale('lydian')

// Low evolution for slow changes
audioStore.updateEvolveIntensity(2) // 0.2 actual intensity

// Create sparse, evolving ambient texture
```

## API Reference

### Polyrhythm Functions

- `enablePolyrhythm(ratio?: string)`: Enable polyrhythm with optional ratio
- `disablePolyrhythm()`: Disable polyrhythm
- `getPolyrhythmRatios()`: Get available ratios
- `polyrhythmEnabled`: Computed property for enabled state
- `polyrhythmInfo`: Computed property with current polyrhythm info

### Chord Progression Functions

- `initializeChordProgression(length: number)`: Initialize progression
- `advanceChordInProgression()`: Move to next chord
- `regenerateWithChordProgression(loopId: number)`: Generate chord-aware melody
- `currentChord`: Computed property for current chord
- `progressionInfo`: Computed property with full progression data

### Style Functions

- `setMusicalStyle(styleName: string)`: Set the musical style
- `availableStyles`: Computed property with style names
- `currentStyle`: Computed property for current style name
- `currentStyleInfo`: Computed property with full style data

## Testing

All features include comprehensive unit tests:

```bash
npm run test
```

Test coverage includes:
- Polyrhythm LCM calculations
- Cycle length calculations
- Style definitions and properties
- Chord progression generation
- Chord type detection
- Integration between systems

15 tests passing ✓

## Performance Considerations

- **Polyrhythm**: Minimal overhead, cycles are pre-calculated
- **Chord Progressions**: Negligible impact, uses lookup tables
- **Styles**: No runtime cost, only affects parameter selection

## Future Enhancements

Potential areas for expansion:

1. **Polyrhythm**: Add more exotic ratios (11:8, 13:7, etc.)
2. **Chords**: Implement automatic voicing and voice leading
3. **Styles**: Add user-defined custom styles
4. **Integration**: Combine all three features for preset templates
5. **UI**: Add visual feedback for chord changes and polyrhythmic cycles
