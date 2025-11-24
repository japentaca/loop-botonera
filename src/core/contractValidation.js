/**
 * Module Contract Validation System
 * 
 * Provides development-time validation of module interfaces to eliminate
 * the need for runtime defensive programming patterns.
 */

import { assert } from './assertions.js'

/**
 * Contract definition for module interfaces
 */
export class ModuleContract {
  constructor(name) {
    this.name = name
    this.requiredMethods = new Set()
    this.optionalMethods = new Set()
    this.requiredProperties = new Set()
    this.optionalProperties = new Set()
    this.lifecycle = {
      init: null,
      validate: null,
      destroy: null
    }
  }

  /**
   * Define required methods that must exist
   */
  requiresMethods(...methods) {
    methods.forEach(method => this.requiredMethods.add(method))
    return this
  }

  /**
   * Define optional methods that may exist
   */
  mayHaveMethods(...methods) {
    methods.forEach(method => this.optionalMethods.add(method))
    return this
  }

  /**
   * Define required properties that must exist
   */
  requiresProperties(...properties) {
    properties.forEach(prop => this.requiredProperties.add(prop))
    return this
  }

  /**
   * Define optional properties that may exist
   */
  mayHaveProperties(...properties) {
    properties.forEach(prop => this.optionalProperties.add(prop))
    return this
  }

  /**
   * Define lifecycle hooks
   */
  withLifecycle({ init, validate, destroy } = {}) {
    this.lifecycle.init = init
    this.lifecycle.validate = validate
    this.lifecycle.destroy = destroy
    return this
  }

  /**
   * Build the complete contract
   */
  build() {
    return {
      name: this.name,
      requiredMethods: Array.from(this.requiredMethods),
      optionalMethods: Array.from(this.optionalMethods),
      requiredProperties: Array.from(this.requiredProperties),
      optionalProperties: Array.from(this.optionalProperties),
      lifecycle: { ...this.lifecycle }
    }
  }
}

/**
 * Contract registry for all modules
 */
export class ContractRegistry {
  constructor() {
    this.contracts = new Map()
  }

  /**
   * Register a contract for a module
   */
  register(contract) {
    this.contracts.set(contract.name, contract)
  }

  /**
   * Get contract by module name
   */
  get(name) {
    return this.contracts.get(name)
  }

  /**
   * Validate a module against its contract
   */
  validate(moduleName, instance) {
    const contract = this.contracts.get(moduleName)
    if (!contract) {
      throw new Error(`No contract defined for module: ${moduleName}`)
    }

    const errors = []

    // Check required methods
    contract.requiredMethods.forEach(method => {
      if (typeof instance[method] !== 'function') {
        errors.push(`Missing required method: ${method}`)
      }
    })

    // Check optional methods (warn only)
    contract.optionalMethods.forEach(method => {
      if (typeof instance[method] !== 'function') {
        console.warn(`[Contract] Module ${moduleName} missing optional method: ${method}`)
      }
    })

    // Check required properties
    contract.requiredProperties.forEach(prop => {
      if (!(prop in instance)) {
        errors.push(`Missing required property: ${prop}`)
      }
    })

    // Check optional properties (warn only)
    contract.optionalProperties.forEach(prop => {
      if (!(prop in instance)) {
        console.warn(`[Contract] Module ${moduleName} missing optional property: ${prop}`)
      }
    })

    // Run custom validation if defined
    if (contract.lifecycle.validate) {
      try {
        contract.lifecycle.validate(instance)
      } catch (error) {
        errors.push(`Custom validation failed: ${error.message}`)
      }
    }

    if (errors.length > 0) {
      throw new Error(`Contract validation failed for ${moduleName}:\n${errors.join('\n')}`)
    }

    return true
  }

  /**
   * Get all registered contracts
   */
  getAll() {
    return Array.from(this.contracts.values())
  }
}

/**
 * Pre-defined contracts for all system modules
 */
export function registerSystemContracts(registry) {
  // NotesMatrix Contract
  registry.register(
    new ModuleContract('notesMatrix')
      .requiresMethods(
        'getLoopNotes',
        'generateLoopNotes',
        'getEffectiveDensity',
        'updateLoopMetadata',
        'initializeLoop',
        'setLoopNote',
        'getNote'
      )
      .requiresProperties(
        'loopMetadata',
        'MAX_LOOPS',
        'MAX_STEPS'
      )
      .mayHaveMethods(
        'transposeLoop',
        'rotateLoop',
        'mutateLoop',
        'quantizeLoop',
        'getLoopNoteDensity'
      )
      .mayHaveProperties(
        'matrixState'
      )
  )

  // AudioEngine Contract
  registry.register(
    new ModuleContract('audioEngine')
      .requiresMethods(
        'initAudio',
        'togglePlay',
        'playNote',
        'createAudioChain'
      )
      .requiresProperties(
        'audioInitialized',
        'isPlaying',
        'currentPulse',
        'tempo'
      )
      .mayHaveMethods(
        'registerTransportListener',
        'unregisterTransportListener',
        'updateTempo',
        'updateMasterVolume'
      )
  )

  // LoopManager Contract
  registry.register(
    new ModuleContract('loopManager')
      .requiresMethods(
        'toggleLoop',
        'updateLoopParam',
        'regenerateLoop',
        'playLoopNote'
      )
      .requiresProperties(
        'loops',
        'NUM_LOOPS'
      )
      .mayHaveMethods(
        'initializeLoops',
        'createLoop',
        'updateAllLoopsScale'
      )
  )

  // EnergyManager Contract
  registry.register(
    new ModuleContract('energyManager')
      .requiresMethods(
        'calculateSonicEnergy',
        'getAdaptiveVolume',
        'adjustAllLoopVolumes',
        'checkAndBalanceEnergy'
      )
      .requiresProperties(
        'energyManagementEnabled',
        'maxSonicEnergy',
        'energyReductionFactor'
      )
      .mayHaveMethods(
        'getOptimalDensityForNewLoop',
        'suggestEnergyOptimizations'
      )
  )

  // EvolutionSystem Contract
  registry.register(
    new ModuleContract('evolutionSystem')
      .requiresMethods(
        'evolveMultipleLoops',
        'applyMatrixMutation',
        'updateEvolutionSettings'
      )
      .requiresProperties(
        'evolutionInterval',
        'evolutionIntensity',
        'autoEvolutionEnabled'
      )
      .mayHaveMethods(
        'evolveMatrixLoop',
        'forceEvolution',
        'getEvolutionStats'
      )
      .mayHaveProperties(
        'evolutionTypes'
      )
  )

  // AudioStore Contract (Central Coordinator)
  registry.register(
    new ModuleContract('audioStore')
      .requiresMethods(
        'initAudio',
        'togglePlay',
        'toggleLoop',
        'regenerateLoop',
        'generateLoopPattern'
      )
      .requiresProperties(
        'loops',
        'notesMatrix',
        'audioInitialized',
        'isPlaying',
        'currentScale'
      )
      .mayHaveMethods(
        'startAutoEvolve',
        'stopAutoEvolve',
        'updateScale',
        'updateTempo'
      )
  )

  // MelodicGenerator Contract
  registry.register(
    new ModuleContract('melodicGenerator')
      .requiresMethods(
        'regenerateLoop',
        'generateLoopMelody',
        'selectPatternType'
      )
      .mayHaveMethods(
        'regenerateAllLoops',
        'getMelodicStats'
      )
  )
}

/**
 * Development-time contract validator
 * Replaces runtime defensive checks with compile-time validation
 */
export class ContractValidator {
  constructor(registry) {
    this.registry = registry
    this.enabled = process.env.NODE_ENV === 'development'
  }

  /**
   * Validate a module instance
   */
  validateModule(moduleName, instance) {
    if (!this.enabled) {
      return instance
    }

    try {
      this.registry.validate(moduleName, instance)

      // Run lifecycle hooks if defined
      const contract = this.registry.get(moduleName)
      if (contract && contract.lifecycle.init) {
        contract.lifecycle.init(instance)
      }

      return instance
    } catch (error) {
      console.error(`[ContractValidator] Validation failed for ${moduleName}:`, error.message)
      throw error
    }
  }

  /**
   * Validate all modules in a dependency injection container
   */
  validateContainer(container) {
    if (!this.enabled) {
      return container
    }

    const status = container.getStatus()

    status.initialized.forEach(moduleName => {
      const module = container.modules.get(moduleName)
      if (module && module.instance) {
        this.validateModule(moduleName, module.instance)
      }
    })

    return container
  }

  /**
   * Enable/disable contract validation
   */
  setEnabled(enabled) {
    this.enabled = enabled
  }
}

/**
 * Module wrapper that automatically validates contracts
 * Use this to wrap module creation and ensure contracts are met
 */
export function withContractValidation(moduleName, createFn, registry) {
  return async (...args) => {
    const validator = new ContractValidator(registry)

    const instance = await createFn(...args)
    return validator.validateModule(moduleName, instance)
  }
}

/**
 * Assert helper for custom validation rules
 */
export function assertContract(condition, message) {
  if (!condition) {
    throw new Error(`Contract assertion failed: ${message}`)
  }
}

/**
 * Helper to validate array types and lengths
 */
export function validateArray(arr, expectedType, minLength = 0) {
  assert(Array.isArray(arr), `Expected array, got ${typeof arr}`)
  assert(arr.length >= minLength, `Array must have at least ${minLength} elements, got ${arr.length}`)

  arr.forEach((item, index) => {
    assert(
      typeof item === expectedType,
      `Array element at index ${index} must be ${expectedType}, got ${typeof item}`
    )
  })
}

/**
 * Helper to validate object has required properties
 */
export function validateObjectShape(obj, requiredProps, optionalProps = []) {
  assert(typeof obj === 'object' && obj !== null, 'Expected object')

  requiredProps.forEach(prop => {
    assert(prop in obj, `Missing required property: ${prop}`)
  })

  const allProps = [...requiredProps, ...optionalProps]
  allProps.forEach(prop => {
    if (prop in obj) {
      assert(typeof obj[prop] !== 'undefined', `Property ${prop} cannot be undefined`)
    }
  })
}

/**
 * Development environment helper to check if contracts are being validated
 */
export function isContractValidationEnabled() {
  return process.env.NODE_ENV === 'development'
}

/**
 * Generate a contract validation report
 */
export function generateContractReport(registry, container) {
  const report = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    contracts: [],
    validationResults: [],
    summary: {
      totalContracts: 0,
      validatedModules: 0,
      failedValidations: 0
    }
  }

  // Contract definitions
  report.contracts = registry.getAll().map(contract => ({
    name: contract.name,
    requiredMethods: contract.requiredMethods,
    optionalMethods: contract.optionalMethods,
    requiredProperties: contract.requiredProperties,
    optionalProperties: contract.optionalProperties
  }))

  // Validation results
  if (container) {
    const status = container.getStatus()
    report.validationResults = status.initialized.map(moduleName => {
      const module = container.modules.get(moduleName)
      const contract = registry.get(moduleName)

      return {
        moduleName,
        hasContract: !!contract,
        isValidated: !!(module && module.instance),
        contractSize: {
          requiredMethods: contract?.requiredMethods.length || 0,
          optionalMethods: contract?.optionalMethods.length || 0,
          requiredProperties: contract?.requiredProperties.length || 0,
          optionalProperties: contract?.optionalProperties.length || 0
        }
      }
    })
  }

  report.summary.totalContracts = report.contracts.length
  report.summary.validatedModules = report.validationResults.length

  return report
}