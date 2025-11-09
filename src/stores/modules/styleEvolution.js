import { ref } from 'vue'
import { useMusicalStyles } from '../../composables/useMusic'

/**
 * Style-based evolution system
 * Controls evolution behavior based on musical style presets
 */
export const useStyleEvolution = () => {
  const currentStyle = ref('classical')
  const { styles, getStyle, getStyleNames, getRandomStyleScale, getStyleChordType } = useMusicalStyles()

  // Apply style-specific evolution settings
  const applyStyleToEvolution = (evolutionSystem, energyManager) => {
    const style = getStyle(currentStyle.value)

    if (!style) {
      console.warn(`[StyleEvolution] Unknown style: ${currentStyle.value}`)
      return
    }

    // Update evolution intensity based on style
    if (evolutionSystem.evolutionIntensity) {
      evolutionSystem.evolutionIntensity.value = style.evolutionIntensity
    }

    // Update energy density preferences
    if (energyManager && energyManager.targetDensity) {
      const avgDensity = (style.density.min + style.density.max) / 2
      energyManager.targetDensity.value = avgDensity
    }

    console.log(`[StyleEvolution] Applied ${style.name} style - intensity: ${style.evolutionIntensity}, density: ${style.density.min}-${style.density.max}`)
  }

  // Get a scale that fits the current style
  const getStyleAppropriateScale = () => {
    return getRandomStyleScale(currentStyle.value)
  }

  // Get chord type appropriate for current style
  const getStyleAppropriateChordType = () => {
    return getStyleChordType(currentStyle.value)
  }

  // Apply style-specific evolution behavior to a loop
  const evolveWithStyle = (loop, evolutionSystem, notesMatrix, globalScaleIntervals) => {
    const style = getStyle(currentStyle.value)
    
    if (!style || !loop || !evolutionSystem) return loop

    // Style-specific evolution strategies
    switch (currentStyle.value) {
      case 'ambient':
        // Sparse, slow changes, focus on sustained notes
        if (Math.random() < 0.3) {
          evolutionSystem.adjustLoopDensity(loop, style.density.min + Math.random() * 0.1, globalScaleIntervals)
        }
        break

      case 'jazz':
        // More complex, frequent note changes
        if (Math.random() < 0.7) {
          evolutionSystem.mutateLoopRhythm(loop, globalScaleIntervals, 0.6)
        }
        break

      case 'techno':
        // Repetitive, minimal melodic variation, focus on rhythm
        if (Math.random() < 0.8) {
          evolutionSystem.mutateLoopRhythm(loop, globalScaleIntervals, 0.4)
        }
        // Keep high density
        const currentDensity = notesMatrix.getLoopNoteDensity(loop.id)
        if (currentDensity < style.density.min) {
          evolutionSystem.adjustLoopDensity(loop, style.density.max, globalScaleIntervals)
        }
        break

      case 'minimal':
        // Very sparse, almost no changes
        if (Math.random() < 0.1) {
          evolutionSystem.mutateLoopRhythm(loop, globalScaleIntervals, 0.1)
        }
        break

      case 'experimental':
        // Unpredictable, dramatic changes
        if (Math.random() < 0.5) {
          const intensity = 0.5 + Math.random() * 0.4
          evolutionSystem.mutateLoopRhythm(loop, globalScaleIntervals, intensity)
        }
        break

      case 'classical':
      default:
        // Balanced evolution
        evolutionSystem.evolveLoop(loop, globalScaleIntervals)
        break
    }

    return loop
  }

  // Set the current musical style
  const setStyle = (styleName) => {
    if (!styles[styleName]) {
      console.warn(`[StyleEvolution] Invalid style: ${styleName}`)
      return false
    }

    currentStyle.value = styleName
    console.log(`[StyleEvolution] Style changed to: ${styles[styleName].name}`)
    return true
  }

  // Get all available style names
  const getAvailableStyles = () => {
    return getStyleNames()
  }

  // Get current style info
  const getCurrentStyleInfo = () => {
    return getStyle(currentStyle.value)
  }

  // Get recommended tempo for current style
  const getStyleTempo = () => {
    const style = getStyle(currentStyle.value)
    const { min, max } = style.tempo
    return Math.floor(min + Math.random() * (max - min))
  }

  // Should this loop be active based on style density?
  const shouldLoopBeActiveForStyle = (loopIndex, totalLoops) => {
    const style = getStyle(currentStyle.value)
    const avgDensity = (style.density.min + style.density.max) / 2
    const targetActiveLoops = Math.ceil(totalLoops * avgDensity)
    
    return loopIndex < targetActiveLoops
  }

  return {
    // State
    currentStyle,
    styles,

    // Methods
    applyStyleToEvolution,
    getStyleAppropriateScale,
    getStyleAppropriateChordType,
    evolveWithStyle,
    setStyle,
    getAvailableStyles,
    getCurrentStyleInfo,
    getStyleTempo,
    shouldLoopBeActiveForStyle
  }
}
