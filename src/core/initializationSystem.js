/**
 * Initialization Sequence Hardening System
 * 
 * Provides deterministic module initialization to eliminate race conditions
 * and the need for defensive checks throughout the codebase.
 */

import { createDIContainer } from './dependencyInjection.js'
import { ContractRegistry, registerSystemContracts, ContractValidator } from './contractValidation.js'
import { createModuleAssert } from './assertions.js'

/**
 * Initialization states for deterministic startup
 */
export const InitState = {
  UNINITIALIZED: 'uninitialized',
  INITIALIZING: 'initializing',
  READY: 'ready',
  ERROR: 'error'
}

/**
 * Module lifecycle phases
 */
export const LifecyclePhase = {
  DEPENDENCIES: 'dependencies',    // Load required modules
  CONTRACTS: 'contracts',          // Validate module contracts
  AUDIO: 'audio',                  // Initialize audio system
  MUSIC: 'music',                  // Initialize music components
  READY: 'ready'                   // System fully initialized
}

/**
 * Main system initializer that coordinates deterministic startup
 */
export class SystemInitializer {
  constructor() {
    this.container = createDIContainer()
    this.registry = new ContractRegistry()
    this.validator = new ContractValidator(this.registry)
    this.state = InitState.UNINITIALIZED
    this.currentPhase = null
    this.initializationLog = []
    this.error = null

    // Register all system contracts
    registerSystemContracts(this.registry)
  }

  /**
   * Initialize the entire system in deterministic order
   */
  async initialize(options = {}) {
    if (this.state !== InitState.UNINITIALIZED) {
      throw new Error('System already initialized or in progress')
    }

    const {
      validateContracts = true,
      skipAudio = false,
      timeout = 30000
    } = options

    this.state = InitState.INITIALIZING
    this.log('Starting system initialization...')

    try {
      // Phase 1: Initialize dependency container
      await this.initializeDependencies()

      // Phase 2: Validate contracts (development only)
      if (validateContracts) {
        await this.validateContracts()
      }

      // Phase 3: Initialize audio system (if not skipped)
      if (!skipAudio) {
        await this.initializeAudioSystem()
      }

      // Phase 4: Initialize music components
      await this.initializeMusicComponents()

      // Phase 5: Final validation and ready state
      await this.finalizeInitialization()

      this.state = InitState.READY
      this.log('System initialization complete')

      return this.getInitializationResult()

    } catch (error) {
      this.state = InitState.ERROR
      this.error = error
      this.log(`Initialization failed: ${error.message}`)
      throw new Error(`System initialization failed: ${error.message}`)
    }
  }

  /**
   * Initialize dependency container
   */
  async initializeDependencies() {
    this.currentPhase = LifecyclePhase.DEPENDENCIES
    this.log('Phase 1: Initializing dependencies...')

    const startTime = Date.now()

    try {
      // Resolve all modules in dependency order
      const audioStore = await this.container.resolve('audioStore')

      const elapsed = Date.now() - startTime
      this.log(`Dependencies initialized in ${elapsed}ms`)

      return {
        audioStore,
        container: this.container,
        elapsed
      }
    } catch (error) {
      throw new Error(`Failed to initialize dependencies: ${error.message}`)
    }
  }

  /**
   * Validate module contracts
   */
  async validateContracts() {
    this.currentPhase = LifecyclePhase.CONTRACTS
    this.log('Phase 2: Validating module contracts...')

    try {
      this.validator.validateContainer(this.container)
      this.log('All module contracts validated successfully')
    } catch (error) {
      throw new Error(`Contract validation failed: ${error.message}`)
    }
  }

  /**
   * Initialize audio system with proper error handling
   */
  async initializeAudioSystem() {
    this.currentPhase = LifecyclePhase.AUDIO
    this.log('Phase 3: Initializing audio system...')

    const status = this.container.getStatus()
    const audioStore = this.container.modules.get('audioStore')?.instance
    const audioEngine = this.container.modules.get('audioEngine')?.instance

    if (!audioStore || !audioEngine) {
      throw new Error('Audio components not available')
    }

    try {
      // Initialize audio engine
      await this.withTimeout(
        audioEngine.initAudio(),
        15000,
        'Audio engine initialization timeout'
      )

      // Ensure audio is properly initialized
      if (!audioEngine.audioInitialized.value) {
        throw new Error('Audio engine reported uninitialized after initAudio()')
      }

      // Initialize music components that depend on audio
      await this.withTimeout(
        audioStore.initMusicComponents(),
        10000,
        'Music components initialization timeout'
      )

      this.log('Audio system initialized successfully')
    } catch (error) {
      throw new Error(`Audio system initialization failed: ${error.message}`)
    }
  }

  /**
   * Initialize music components and dependencies
   */
  async initializeMusicComponents() {
    this.currentPhase = LifecyclePhase.MUSIC
    this.log('Phase 4: Initializing music components...')

    const status = this.container.getStatus()

    // Ensure all critical components are ready
    const requiredModules = ['audioStore', 'loopManager', 'energyManager', 'evolutionSystem']
    const missingModules = requiredModules.filter(name => !status.initialized.includes(name))

    if (missingModules.length > 0) {
      throw new Error(`Missing required modules: ${missingModules.join(', ')}`)
    }

    // Initialize loop manager with proper configuration
    const audioStore = this.container.modules.get('audioStore')?.instance
    const loopManager = this.container.modules.get('loopManager')?.instance

    if (loopManager && audioStore) {
      try {
        await this.withTimeout(
          loopManager.initializeLoops(audioStore.currentScale, audioStore.audioEngine),
          5000,
          'Loop manager initialization timeout'
        )
      } catch (error) {
        throw new Error(`Loop manager initialization failed: ${error.message}`)
      }
    }

    this.log('Music components initialized successfully')
  }

  /**
   * Finalize initialization with validation
   */
  async finalizeInitialization() {
    this.currentPhase = LifecyclePhase.READY
    this.log('Phase 5: Finalizing initialization...')

    const status = this.container.getStatus()

    // Validate system is ready for operation
    this.validateSystemReadiness(status)

    this.log('System ready for operation')
  }

  /**
   * Validate that the system is fully ready
   */
  validateSystemReadiness(status) {
    const requiredModules = ['audioStore', 'notesMatrix', 'audioEngine', 'loopManager']
    const missingModules = requiredModules.filter(name => !status.initialized.includes(name))

    if (missingModules.length > 0) {
      throw new Error(`System not ready - missing modules: ${missingModules.join(', ')}`)
    }

    // Validate critical components have required methods
    const audioStore = this.container.modules.get('audioStore')?.instance
    if (!audioStore) {
      throw new Error('Audio store not available')
    }

    // Check essential methods exist (contract validation should have caught this)
    const essentialMethods = ['initAudio', 'togglePlay', 'toggleLoop', 'regenerateLoop']
    const missingMethods = essentialMethods.filter(method => typeof audioStore[method] !== 'function')

    if (missingMethods.length > 0) {
      throw new Error(`Audio store missing essential methods: ${missingMethods.join(', ')}`)
    }
  }

  /**
   * Execute operation with timeout
   */
  async withTimeout(operation, timeoutMs, errorMessage) {
    return Promise.race([
      operation,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
      })
    ])
  }

  /**
   * Get initialization result
   */
  getInitializationResult() {
    const status = this.container.getStatus()

    return {
      state: this.state,
      phase: this.currentPhase,
      success: this.state === InitState.READY,
      error: this.error,
      status,
      audioStore: this.container.modules.get('audioStore')?.instance,
      container: this.container,
      log: this.initializationLog,
      ready: this.state === InitState.READY
    }
  }

  /**
   * Check if system is ready for operation
   */
  isReady() {
    return this.state === InitState.READY
  }

  /**
   * Get current status for debugging
   */
  getStatus() {
    return {
      state: this.state,
      phase: this.currentPhase,
      error: this.error,
      initializedModules: this.container.getStatus().initialized,
      log: this.initializationLog
    }
  }

  /**
   * Log initialization events
   */
  log(message) {
    const timestamp = new Date().toISOString()
    const logEntry = `[${timestamp}] ${message}`
    this.initializationLog.push(logEntry)
    console.log(`[SystemInit] ${message}`)
  }

  /**
   * Reset initialization state (for testing)
   */
  reset() {
    this.state = InitState.UNINITIALIZED
    this.currentPhase = null
    this.initializationLog = []
    this.error = null

    // Create new container
    this.container = createDIContainer()
    registerSystemContracts(this.registry)
    this.validator = new ContractValidator(this.registry)
  }
}

/**
 * Singleton system initializer instance
 */
let systemInitializer = null

/**
 * Initialize the global system
 */
export async function initializeGlobalSystem(options = {}) {
  if (systemInitializer && systemInitializer.isReady()) {
    return systemInitializer.getInitializationResult()
  }

  systemInitializer = new SystemInitializer()
  return await systemInitializer.initialize(options)
}

/**
 * Get the global system initializer
 */
export function getGlobalInitializer() {
  return systemInitializer
}

/**
 * Get the initialized audio store
 */
export async function getAudioStore() {
  if (!systemInitializer || !systemInitializer.isReady()) {
    throw new Error('System not initialized. Call initializeGlobalSystem() first.')
  }

  return systemInitializer.container.modules.get('audioStore')?.instance
}

/**
 * Wait for system to be ready
 */
export async function waitForSystemReady(timeout = 30000) {
  if (systemInitializer && systemInitializer.isReady()) {
    return true
  }

  return new Promise((resolve, reject) => {
    const startTime = Date.now()

    const checkReady = () => {
      if (systemInitializer && systemInitializer.isReady()) {
        resolve(true)
        return
      }

      if (Date.now() - startTime > timeout) {
        reject(new Error('System initialization timeout'))
        return
      }

      setTimeout(checkReady, 100)
    }

    checkReady()
  })
}

/**
 * Development helper to test initialization
 */
export function testInitialization() {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('Test initialization only available in development mode')
  }

  console.log('[InitTest] Starting initialization test...')

  const initializer = new SystemInitializer()

  return initializer.initialize({ validateContracts: true })
    .then(result => {
      console.log('[InitTest] Initialization successful:', result.status)

      // Test basic operations
      const audioStore = result.audioStore
      console.log('[InitTest] Testing basic operations...')

      // These should work without defensive checks
      try {
        console.log('- Audio initialized:', audioStore.audioInitialized.value)
        console.log('- Loops count:', audioStore.loops.value.length)
        console.log('- Current scale:', audioStore.currentScale)
        console.log('[InitTest] All basic operations successful')
      } catch (error) {
        console.error('[InitTest] Basic operations failed:', error)
        throw error
      }

      return result
    })
    .catch(error => {
      console.error('[InitTest] Initialization failed:', error)
      throw error
    })
}

/**
 * Clean up system (for testing)
 */
export function cleanup() {
  if (systemInitializer) {
    systemInitializer.reset()
    systemInitializer = null
  }
}