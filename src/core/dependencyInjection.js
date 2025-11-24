/**
 * Dependency Injection Framework
 * 
 * Provides a structured way to manage module dependencies and initialization order.
 * Eliminates the need for global dependency calls within modules.
 */

import { useNotesMatrix } from '../composables/useNotesMatrix.js'
import { useAudioEngine } from '../stores/modules/audioEngine.js'
import { useLoopManager } from '../stores/modules/loopManager.js'
import { useEnergyManager } from '../stores/modules/energyManager.js'
import { useEvolutionSystem } from '../stores/modules/evolutionSystem.js'
import { useAudioStore } from '../stores/audioStore.js'
import { useMelodicGenerator } from '../composables/useMelodicGenerator.js'

/**
 * Dependency Injection Container
 * Manages module lifecycle and dependencies
 */
class DIContainer {
  constructor() {
    this.modules = new Map()
    this.initializing = new Set()
    this.initialized = new Set()
    this.dependencies = new Map()
  }

  /**
   * Register a module factory function with its dependencies
   */
  register(name, factory, deps = []) {
    this.modules.set(name, { factory, deps })
    this.dependencies.set(name, deps)
  }

  /**
   * Resolve a module and its dependencies
   */
  async resolve(name) {
    if (this.initialized.has(name)) {
      return this.modules.get(name).instance
    }

    if (this.initializing.has(name)) {
      throw new Error(`Circular dependency detected for module: ${name}`)
    }

    const module = this.modules.get(name)
    if (!module) {
      throw new Error(`Module not registered: ${name}`)
    }

    this.initializing.add(name)

    try {
      // Resolve dependencies first
      const deps = {}
      for (const depName of module.deps) {
        deps[depName] = await this.resolve(depName)
      }

      // Create module instance
      const instance = await module.factory(deps)

      // Cache the instance
      module.instance = instance
      this.initialized.add(name)
      this.initializing.delete(name)

      return instance
    } catch (error) {
      this.initializing.delete(name)
      throw new Error(`Failed to resolve module ${name}: ${error.message}`)
    }
  }

  /**
   * Check if all modules are initialized
   */
  isReady() {
    return this.initialized.size === this.modules.size
  }

  /**
   * Get initialization status for debugging
   */
  getStatus() {
    return {
      modules: Array.from(this.modules.keys()),
      initialized: Array.from(this.initialized),
      initializing: Array.from(this.initializing),
      ready: this.isReady()
    }
  }
}

/**
 * Create the dependency injection container with all modules
 */
export function createDIContainer() {
  const container = new DIContainer()

  // Register core modules in dependency order
  // Level 1: No dependencies
  container.register('notesMatrix', async () => {
    return useNotesMatrix()
  }, [])

  container.register('audioEngine', async () => {
    return useAudioEngine()
  }, [])

  // Level 2: Depends on Level 1
  container.register('melodicGenerator', async (deps) => {
    return useMelodicGenerator(deps.notesMatrix)
  }, ['notesMatrix'])

  // Level 3: Depends on Level 1-2
  container.register('loopManager', async (deps) => {
    return useLoopManager(deps.notesMatrix)
  }, ['notesMatrix'])

  container.register('energyManager', async (deps) => {
    return useEnergyManager(deps.notesMatrix)
  }, ['notesMatrix'])

  container.register('evolutionSystem', async (deps) => {
    return useEvolutionSystem(deps.notesMatrix, deps.melodicGenerator)
  }, ['notesMatrix', 'melodicGenerator'])

  // Level 4: Central coordinator - depends on all others
  container.register('audioStore', async (deps) => {
    // Create audioStore with explicit dependencies instead of global calls
    return createAudioStoreWithDeps(deps)
  }, ['notesMatrix', 'audioEngine', 'loopManager', 'energyManager', 'evolutionSystem'])

  return container
}

/**
 * Factory function to create audioStore with explicit dependencies
 * This replaces the current audioStore pattern that calls global composables
 */
function createAudioStoreWithDeps(deps) {
  // Extract dependencies
  const { notesMatrix, audioEngine, loopManager, energyManager, evolutionSystem } = deps

  // Create a minimal audioStore that uses the provided dependencies
  // This is a simplified version - in practice, you'd refactor the full audioStore
  const audioStore = {
    // Audio engine state
    audioInitialized: audioEngine.audioInitialized,
    isPlaying: audioEngine.isPlaying,
    currentPulse: audioEngine.currentPulse,
    tempo: audioEngine.tempo,

    // Loop manager integration
    loops: loopManager.loops,

    // Notes matrix integration  
    notesMatrix: notesMatrix,
    loopMetadata: notesMatrix.loopMetadata,

    // Evolution system integration
    evolveMultipleMatrixLoops: evolutionSystem.evolveMultipleMatrixLoops,
    applyMatrixMutation: evolutionSystem.applyMatrixMutation,

    // Energy management integration
    energyManagementEnabled: energyManager.energyManagementEnabled,
    maxSonicEnergy: energyManager.maxSonicEnergy,

    // Core methods that previously had defensive code
    initAudio: async () => {
      await audioEngine.initAudio()
      // No more defensive checks needed - dependencies guaranteed
    },

    togglePlay: () => {
      audioEngine.togglePlay()
    },

    toggleLoop: (id) => {
      loopManager.toggleLoop(id)
      // No more null checks needed
    },

    regenerateLoop: (id) => {
      const scale = getCurrentScale() // You'd inject this or get from global state properly
      const adaptiveVolume = energyManager.getAdaptiveVolume(loopManager.loops.value, id)
      loopManager.regenerateLoop(id, scale, scale, adaptiveVolume, audioEngine.currentPulse.value)
      // No more existence checks needed
    },

    generateLoopPattern: (loopId) => {
      // Direct call without existence checks - guaranteed to work
      notesMatrix.generateLoopNotes(loopId, { silent: true })
    },

    // Removed defensive code patterns:
    // - No more "if (typeof notesMatrix.generateLoopNotes === 'function')"
    // - No more "|| 0.3" fallbacks  
    // - No more "typeof window !== 'undefined'" checks in business logic
    // - No more optional chaining with existence checks

    // Add debug helper (without window check - use proper environment detection)
    getDebugInfo: () => ({
      modulesReady: container.getStatus(),
      loopCount: loopManager.loops.value.length,
      activeLoops: loopManager.loops.value.filter(l => l.isActive).length
    })
  }

  return audioStore
}

/**
 * Helper function to get current scale
 * In a real implementation, this would be properly injected
 */
function getCurrentScale() {
  // This is a placeholder - you'd get this from proper state management
  return [0, 2, 4, 5, 7, 9, 11] // Major scale intervals
}

/**
 * Initialize the entire system with proper dependency injection
 * This replaces ad-hoc initialization with controlled startup
 */
export async function initializeSystem() {
  const container = createDIContainer()

  try {
    console.log('[DI] Starting system initialization...')

    // Resolve all modules in dependency order
    const audioStore = await container.resolve('audioStore')

    console.log('[DI] System initialization complete:', container.getStatus())

    return {
      audioStore,
      container,
      isReady: () => container.isReady(),
      getStatus: () => container.getStatus()
    }
  } catch (error) {
    console.error('[DI] System initialization failed:', error)
    throw error
  }
}

/**
 * Development-mode module validator
 * Ensures modules meet their contracts at initialization time
 */
export function validateModuleContracts(container) {
  if (process.env.NODE_ENV !== 'development') {
    return
  }

  const status = container.getStatus()
  console.log('[DI] Validating module contracts...')

  // Validate required interfaces
  status.initialized.forEach(moduleName => {
    const module = container.modules.get(moduleName)
    if (module && module.instance) {
      validateModuleInterface(moduleName, module.instance)
    }
  })

  console.log('[DI] Module contract validation complete')
}

function validateModuleInterface(moduleName, instance) {
  const contracts = {
    notesMatrix: [
      'getLoopNotes', 'generateLoopNotes', 'getEffectiveDensity',
      'updateLoopMetadata', 'initializeLoop', 'loopMetadata'
    ],
    audioEngine: [
      'initAudio', 'togglePlay', 'audioInitialized', 'isPlaying',
      'currentPulse', 'tempo', 'playNote', 'createAudioChain'
    ],
    loopManager: [
      'loops', 'toggleLoop', 'regenerateLoop', 'updateLoopParam'
    ],
    energyManager: [
      'energyManagementEnabled', 'maxSonicEnergy', 'getAdaptiveVolume',
      'calculateSonicEnergy', 'adjustAllLoopVolumes'
    ],
    evolutionSystem: [
      'evolveMultipleMatrixLoops', 'applyMatrixMutation', 'evolutionInterval',
      'evolutionIntensity', 'autoEvolutionEnabled'
    ],
    audioStore: [
      'initAudio', 'togglePlay', 'toggleLoop', 'regenerateLoop',
      'generateLoopPattern', 'loops', 'notesMatrix'
    ]
  }

  const requiredMethods = contracts[moduleName] || []
  const missing = requiredMethods.filter(method => typeof instance[method] !== 'function')

  if (missing.length > 0) {
    throw new Error(`Module ${moduleName} is missing required methods: ${missing.join(', ')}`)
  }
}