import { ref, computed } from 'vue'
import { usePolyrhythm } from '../../composables/useMusic'

/**
 * Polyrhythm manager for handling loops with different time signatures
 * and lengths that create polyrhythmic patterns
 */
export const usePolyrhythmManager = () => {
  const polyrhythmEnabled = ref(false)
  const currentPolyrhythmSet = ref(null)
  const polyrhythmCycleLength = ref(16)
  
  const { 
    lcm, 
    calculatePolyrythmCycle, 
    polyrhythmRatios, 
    generatePolyrhythmicSet,
    isPolyrythmicAlignment 
  } = usePolyrhythm()

  // Get available polyrhythm ratios
  const getAvailableRatios = () => {
    return polyrhythmRatios
  }

  // Initialize polyrhythmic pattern for active loops
  const initializePolyrhythm = (numLoops, baseLength = 16) => {
    const polySet = generatePolyrhythmicSet(numLoops, baseLength)
    currentPolyrhythmSet.value = polySet
    
    // Calculate the overall cycle length
    const lengths = polySet.patterns.map(p => p.length)
    polyrhythmCycleLength.value = calculatePolyrythmCycle(lengths)
    
    polyrhythmEnabled.value = true
    
    console.log(`[Polyrhythm] Initialized ${polySet.name} pattern:`, polySet.patterns)
    console.log(`[Polyrhythm] Cycle length: ${polyrhythmCycleLength.value} steps`)
    
    return polySet
  }

  // Apply polyrhythmic lengths to loops
  const applyPolyrhythmToLoops = (loops, loopManager) => {
    if (!polyrhythmEnabled.value || !currentPolyrhythmSet.value) {
      return
    }

    const activeLoops = loops.filter(l => l.isActive)
    if (activeLoops.length === 0) return

    console.log(`[Polyrhythm] Applying to ${activeLoops.length} active loops`)

    activeLoops.forEach((loop, index) => {
      const patternIndex = index % currentPolyrhythmSet.value.patterns.length
      const pattern = currentPolyrhythmSet.value.patterns[patternIndex]
      
      // Update loop length
      if (loop.length !== pattern.length) {
        loopManager.updateLoopParam(loop.id, 'length', pattern.length)
        console.log(`[Polyrhythm] Set loop ${loop.id} length to ${pattern.length} (ratio: ${pattern.ratio})`)
      }
    })
  }

  // Apply a specific polyrhythm ratio
  const applyRatio = (ratio, loops, loopManager, baseLength = 16) => {
    const targetRatio = polyrhythmRatios.find(r => r.name === ratio)
    if (!targetRatio) {
      console.warn(`[Polyrhythm] Unknown ratio: ${ratio}`)
      return
    }

    const activeLoops = loops.filter(l => l.isActive)
    if (activeLoops.length < 2) {
      console.warn('[Polyrhythm] Need at least 2 active loops for polyrhythm')
      return
    }

    // Calculate actual lengths based on base length
    const maxRatio = Math.max(...targetRatio.lengths)
    const lengthMultiplier = Math.floor(baseLength / maxRatio)

    activeLoops.forEach((loop, index) => {
      const ratioIndex = index % targetRatio.lengths.length
      const newLength = targetRatio.lengths[ratioIndex] * lengthMultiplier
      
      loopManager.updateLoopParam(loop.id, 'length', newLength)
    })

    // Update state
    const lengths = activeLoops.map((_, i) => 
      targetRatio.lengths[i % targetRatio.lengths.length] * lengthMultiplier
    )
    polyrhythmCycleLength.value = calculatePolyrythmCycle(lengths)
    polyrhythmEnabled.value = true

    console.log(`[Polyrhythm] Applied ${targetRatio.name} ratio, cycle length: ${polyrhythmCycleLength.value}`)
  }

  // Disable polyrhythm and reset all loops to same length
  const disablePolyrhythm = (loops, loopManager, defaultLength = 16) => {
    loops.forEach(loop => {
      if (loop.length !== defaultLength) {
        loopManager.updateLoopParam(loop.id, 'length', defaultLength)
      }
    })

    polyrhythmEnabled.value = false
    currentPolyrhythmSet.value = null
    polyrhythmCycleLength.value = defaultLength

    console.log('[Polyrhythm] Disabled, all loops reset to length', defaultLength)
  }

  // Check if we're at a polyrhythmic alignment point (all loops sync)
  const isAtAlignment = (currentStep) => {
    if (!polyrhythmEnabled.value) return true
    return currentStep % polyrhythmCycleLength.value === 0
  }

  // Get polyrhythm info for UI display
  const getPolyrhythmInfo = () => {
    if (!polyrhythmEnabled.value || !currentPolyrhythmSet.value) {
      return {
        enabled: false,
        ratio: null,
        cycleLength: 16
      }
    }

    return {
      enabled: true,
      ratio: currentPolyrhythmSet.value.name,
      description: currentPolyrhythmSet.value.description,
      cycleLength: polyrhythmCycleLength.value,
      patterns: currentPolyrhythmSet.value.patterns
    }
  }

  // Calculate where each loop is in its individual cycle
  const getLoopPositions = (globalStep, loops) => {
    return loops.map(loop => ({
      loopId: loop.id,
      position: globalStep % loop.length,
      length: loop.length,
      cycleProgress: (globalStep % loop.length) / loop.length
    }))
  }

  // Get the next alignment point
  const getNextAlignment = (currentStep) => {
    if (!polyrhythmEnabled.value) return currentStep
    
    const remainder = currentStep % polyrhythmCycleLength.value
    if (remainder === 0) return currentStep
    
    return currentStep + (polyrhythmCycleLength.value - remainder)
  }

  return {
    // State
    polyrhythmEnabled,
    currentPolyrhythmSet,
    polyrhythmCycleLength,

    // Methods
    getAvailableRatios,
    initializePolyrhythm,
    applyPolyrhythmToLoops,
    applyRatio,
    disablePolyrhythm,
    isAtAlignment,
    getPolyrhythmInfo,
    getLoopPositions,
    getNextAlignment
  }
}
