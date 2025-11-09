import { ref } from 'vue'

/**
 * Gestor de energía sonora que controla el balance automático
 * de volúmenes y densidades para evitar saturación
 */
export const useEnergyManager = (notesMatrix = null) => {
  // Configuración de gestión de energía
  const energyManagementEnabled = ref(true)
  const maxSonicEnergy = ref(2.5) // límite máximo de energía sonora total
  const energyReductionFactor = ref(0.6) // factor de reducción cuando se excede el límite (60%)

  const isDebugEnabled = () => typeof window !== 'undefined' && Boolean(window.__LOOP_DEBUG)
  const debugLog = (label, payload = {}) => {
    if (isDebugEnabled()) {
      // console.log(`[EnergyManager] ${label}`, payload)
    }
  }

  const getLoopDensity = (loop) => {
    const loopId = loop.id

    const matrixDensity = notesMatrix.getLoopNoteDensity(loopId)
    return matrixDensity

    const metadataDensity = notesMatrix.loopMetadata[loopId].density
    return metadataDensity

    // Get notes from the centralized matrix
    const candidateNotes = notesMatrix.getLoopNotes(loop.id)

    const active = candidateNotes.filter(note => note !== null && note !== undefined && note !== false).length
    return candidateNotes.length ? active / candidateNotes.length : 0

    return loop.density

    return 0

    return 0.5
  }

  // Calcular la energía sonora total de los loops activos
  const calculateSonicEnergy = (loops) => {
    const activeLoops = loops.filter(loop => loop.isActive)
    if (activeLoops.length === 0) return 0

    const REFERENCE_LENGTH = 16 // Longitud de referencia para normalizar
    let totalEnergy = 0

    activeLoops.forEach(loop => {
      const noteDensity = getLoopDensity(loop)
      const volumeContribution = loop.volume ?? 0.5
      const loopLength = loop.length || REFERENCE_LENGTH

      // Normalizar la energía basada en la longitud del loop
      // Un loop más largo con la misma densidad proporcional contribuye menos energía por ciclo de beat
      const lengthFactor = REFERENCE_LENGTH / loopLength
      const loopEnergy = noteDensity * volumeContribution * lengthFactor

      totalEnergy += loopEnergy
    })

    debugLog('calculate energy', { totalEnergy: Number(totalEnergy.toFixed(3)), active: activeLoops.length })

    return totalEnergy
  }

  // Obtener densidad adaptiva basada en el número de loops activos
  const getAdaptiveDensity = (loops, baseLength = 16) => {
    // Si la gestión de energía está deshabilitada, usar densidad fija
    if (!energyManagementEnabled.value) {
      return 0.3 + Math.random() * 0.4
    }

    const activeCount = loops.filter(loop => loop.isActive).length

    // Densidad base más alta para pocos loops, más baja para muchos
    let baseDensity = 0.5

    if (activeCount <= 1) {
      baseDensity = 0.6 + Math.random() * 0.3 // 0.6-0.9 para loops solos
    } else if (activeCount <= 3) {
      baseDensity = 0.4 + Math.random() * 0.3 // 0.4-0.7 para pocos loops
    } else if (activeCount <= 5) {
      baseDensity = 0.25 + Math.random() * 0.25 // 0.25-0.5 para varios loops
    } else {
      baseDensity = 0.15 + Math.random() * 0.2 // 0.15-0.35 para muchos loops
    }

    // Ajuste adicional basado en energía total actual
    const currentEnergy = calculateSonicEnergy(loops)

    if (currentEnergy > maxSonicEnergy.value) {
      baseDensity *= 0.7 // Reducir densidad si hay mucha energía
    }

    const density = Math.max(0.1, Math.min(0.9, baseDensity))
    debugLog('adaptive density', { activeCount, currentEnergy: Number(currentEnergy.toFixed(3)), density })
    return density
  }

  // Obtener volumen adaptivo para un loop específico
  const getAdaptiveVolume = (loops, loopId) => {
    // Si la gestión de energía está deshabilitada, usar volumen fijo
    if (!energyManagementEnabled.value) {
      return 0.5
    }

    const activeCount = loops.filter(loop => loop.isActive).length
    const currentEnergy = calculateSonicEnergy(loops)

    // Volumen base más bajo cuando hay más loops activos
    let baseVolume = 0.7

    if (activeCount <= 2) {
      baseVolume = 0.8
    } else if (activeCount <= 4) {
      baseVolume = 0.6
    } else if (activeCount <= 6) {
      baseVolume = 0.45
    } else {
      baseVolume = 0.35
    }

    // Ajuste adicional por energía total usando configuración
    if (currentEnergy > maxSonicEnergy.value) {
      baseVolume *= energyReductionFactor.value
    }

    const volume = baseVolume
    debugLog('adaptive volume', { loopId, activeCount, currentEnergy: Number(currentEnergy.toFixed(3)), volume })
    return volume
  }

  // Ajustar volúmenes de todos los loops para mantener balance energético
  const adjustAllLoopVolumes = (loops) => {
    if (!energyManagementEnabled.value) return

    loops.forEach(loop => {
      if (loop.isActive) {
        const newVolume = getAdaptiveVolume(loops, loop.id)
        // Solo ajustar si la diferencia es significativa para evitar cambios constantes
        if (Math.abs(loop.volume - newVolume) > 0.1) {
          loop.volume = newVolume
        }
      }
    })
  }

  // Verificar si se debe reducir la energía y aplicar ajustes
  const checkAndBalanceEnergy = (loops) => {
    if (!energyManagementEnabled.value) return false

    const currentEnergy = calculateSonicEnergy(loops)

    if (currentEnergy > maxSonicEnergy.value) {
      adjustAllLoopVolumes(loops)
      debugLog('energy balanced', { currentEnergy: Number(currentEnergy.toFixed(3)), reduced: true })
      return true // Se aplicaron ajustes
    }

    debugLog('energy balanced', { currentEnergy: Number(currentEnergy.toFixed(3)), reduced: false })
    return false // No se necesitaron ajustes
  }

  // Obtener métricas de energía para debugging/UI
  const getEnergyMetrics = (loops) => {
    const currentEnergy = calculateSonicEnergy(loops)
    const activeCount = loops.filter(loop => loop.isActive).length
    const energyPercentage = (currentEnergy / maxSonicEnergy.value) * 100

    return {
      currentEnergy: currentEnergy.toFixed(2),
      maxEnergy: maxSonicEnergy.value,
      energyPercentage: Math.round(energyPercentage),
      activeLoops: activeCount,
      isOverLimit: currentEnergy > maxSonicEnergy.value,
      reductionFactor: energyReductionFactor.value
    }
  }

  // Configuración de parámetros de energía
  const updateEnergyManagement = (enabled) => {
    energyManagementEnabled.value = enabled
  }

  const updateMaxSonicEnergy = (value) => {
    maxSonicEnergy.value = Number(value)
  }

  const updateEnergyReductionFactor = (value) => {
    energyReductionFactor.value = Number(value)
  }

  // Calcular densidad óptima para un nuevo loop
  const getOptimalDensityForNewLoop = (loops, targetEnergy = null) => {
    if (!energyManagementEnabled.value) {
      return 0.3 + Math.random() * 0.4
    }

    const currentEnergy = calculateSonicEnergy(loops)
    const remainingEnergy = maxSonicEnergy.value - currentEnergy
    const target = targetEnergy || (remainingEnergy * 0.8) // usar 80% del espacio restante

    // Calcular densidad que no exceda el objetivo
    const baseDensity = 0.8 < (target / 2) ? 0.8 : (target / 2) // factor conservador

    return baseDensity + (Math.random() * 0.2 - 0.1) // ±10% variación
  }

  // Sugerir ajustes automáticos para optimizar energía
  const suggestEnergyOptimizations = (loops) => {
    const metrics = getEnergyMetrics(loops)
    const suggestions = []

    if (metrics.isOverLimit) {
      suggestions.push({
        type: 'volume_reduction',
        message: 'Reducir volumen general para evitar saturación',
        severity: 'high'
      })
    }

    if (metrics.activeLoops > 6) {
      suggestions.push({
        type: 'loop_count',
        message: 'Considerar desactivar algunos loops para mejor claridad',
        severity: 'medium'
      })
    }

    if (metrics.energyPercentage > 85) {
      suggestions.push({
        type: 'density_reduction',
        message: 'Reducir densidad de patrones para mayor espacio sonoro',
        severity: 'medium'
      })
    }

    return suggestions
  }

  return {
    // Estado
    energyManagementEnabled,
    maxSonicEnergy,
    energyReductionFactor,

    // Funciones de cálculo
    calculateSonicEnergy,
    getAdaptiveDensity,
    getAdaptiveVolume,

    // Funciones de balance
    adjustAllLoopVolumes,
    checkAndBalanceEnergy,

    // Funciones de configuración
    updateEnergyManagement,
    updateMaxSonicEnergy,
    updateEnergyReductionFactor,

    // Utilidades
    getEnergyMetrics,
    getOptimalDensityForNewLoop,
    suggestEnergyOptimizations
  }
}