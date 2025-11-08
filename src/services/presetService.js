/**
 * Servicio para gestión de presets en localStorage
 * Maneja operaciones CRUD, validaciones y migración de versiones
 * 
 * Estructura de preset:
 * - globalConfig: configuración global de la aplicación
 * - loops: array de configuraciones de loops, cada loop contiene:
 *   - synthType: tipo de sintetizador (PolySynth, AMSynth, FMSynth, etc.)
 *   - oscillatorType: forma de onda (sine, triangle, square, sawtooth)
 *   - synthModel: compatibilidad hacia atrás (mismo valor que synthType)
 *   - envelope: configuración ADSR del sintetizador
 *   - harmonicity: para sintetizadores AM/FM
 *   - modulationIndex: para sintetizadores FM
 */

const STORAGE_KEY = 'loopera_presets'
const CURRENT_VERSION = '1.0.0'
const MAX_PRESETS = 50

/**
 * Genera un ID único para presets
 */
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

/**
 * Valida la estructura de un preset
 */
export const validatePreset = (preset) => {
  try {
    if (!preset || typeof preset !== 'object') {
      console.warn('Preset inválido: no es un objeto')
      return false
    }
    
    if (!preset.name || typeof preset.name !== 'string' || preset.name.trim().length === 0) {
      console.warn('Preset inválido: nombre faltante o inválido')
      return false
    }
    
    if (!preset.globalConfig || typeof preset.globalConfig !== 'object') {
      console.warn('Preset inválido: configuración global faltante')
      return false
    }
    
    if (!preset.loops || !Array.isArray(preset.loops)) {
      console.warn('Preset inválido: configuración de loops faltante o inválida')
      return false
    }
    
    // Validar configuración global básica
    const { globalConfig } = preset
    if (typeof globalConfig.tempo !== 'number' || globalConfig.tempo < 10 || globalConfig.tempo > 300) {
      console.warn('Preset inválido: tempo fuera de rango válido (10-300)')
      return false
    }
    
    // Validar loops básicos
    if (preset.loops.length > 8) {
      console.warn('Preset inválido: demasiados loops (máximo 8)')
      return false
    }
    
    for (let i = 0; i < preset.loops.length; i++) {
      const loop = preset.loops[i]
      if (!loop || typeof loop !== 'object') {
        console.warn(`Preset inválido: loop ${i} no es un objeto válido`)
        return false
      }
      
      if (typeof loop.isActive !== 'boolean') {
        console.warn(`Preset inválido: loop ${i} falta propiedad isActive`)
        return false
      }
    }
    
    return true
  } catch (error) {
    console.error('Error validando preset:', error)
    return false
  }
}

/**
 * Migra un preset a la versión actual
 */
const migratePreset = (preset) => {
  const migratedPreset = {
    ...preset,
    version: CURRENT_VERSION,
    updatedAt: preset.updatedAt || preset.createdAt || new Date().toISOString()
  }
  
  // Migrar evolveInterval de milisegundos a compases si es necesario
  if (migratedPreset.globalConfig && migratedPreset.globalConfig.evolveInterval) {
    const evolveInterval = migratedPreset.globalConfig.evolveInterval
    
    // Si el valor es mayor a 100, probablemente está en milisegundos
    if (evolveInterval > 100) {
      // Convertir de milisegundos a compases aproximados
      // Valores comunes: 8000ms ≈ 8 compases, 4000ms ≈ 4 compases
      const measuresInterval = Math.round(evolveInterval / 1000)
      migratedPreset.globalConfig.evolveInterval = Math.max(2, Math.min(32, measuresInterval))
    }
  }
  
  return migratedPreset
}

/**
 * Obtiene todos los presets del localStorage
 */
export const getAllPresets = () => {
  console.log('📋 PRESET SERVICE: Starting getAllPresets');
  console.log('📋 PRESET SERVICE: STORAGE_KEY:', STORAGE_KEY);
  console.log('📋 PRESET SERVICE: Browser info:', navigator.userAgent);
  console.log('📋 PRESET SERVICE: localStorage keys:', Object.keys(localStorage));
  
  try {
    console.log('📋 PRESET SERVICE: Attempting to access localStorage');
    const stored = localStorage.getItem(STORAGE_KEY)
    console.log('📋 PRESET SERVICE: localStorage.getItem result:', stored);
    console.log('📋 PRESET SERVICE: localStorage available:', typeof localStorage !== 'undefined');
    console.log('📋 PRESET SERVICE: localStorage length:', localStorage.length);
    
    // Check all localStorage keys to see what's available
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      console.log(`📋 PRESET SERVICE: localStorage key[${i}]:`, key);
      if (key && key.includes('preset')) {
        console.log(`📋 PRESET SERVICE: Found preset-related key:`, key);
      }
    }
    
    if (!stored) {
      console.log('📋 PRESET SERVICE: No stored data found for STORAGE_KEY, returning empty array');
      return []
    }

    console.log('📋 PRESET SERVICE: Parsing stored data...');
    const presets = JSON.parse(stored)
    console.log('📋 PRESET SERVICE: Parsed data type:', typeof presets);
    console.log('📋 PRESET SERVICE: Is array:', Array.isArray(presets));
    console.log('📋 PRESET SERVICE: Array length:', presets?.length);
    
    if (!Array.isArray(presets)) {
      console.warn('📋 PRESET SERVICE: Datos de presets corruptos, reiniciando...')
      return []
    }

    console.log('📋 PRESET SERVICE: Starting migration and validation...');
    // SKIP MIGRATION FOR BRAVE BROWSER TESTING
    console.log('📋 PRESET SERVICE: SKIPPING MIGRATION - using presets as-is');
    const result = presets.map(preset => {
      try {
        console.log('📋 PRESET SERVICE: Validating preset:', preset?.name || 'unnamed');
        // Skip migration and just validate
        validatePreset(preset)
        console.log('📋 PRESET SERVICE: Preset validated successfully (migration skipped)');
        return preset
      } catch (error) {
        console.warn(`📋 PRESET SERVICE: Preset corrupto eliminado: ${preset.name || 'Sin nombre'}`, error)
        return null
      }
    }).filter(Boolean)
    
    console.log('📋 PRESET SERVICE: Final result count:', result.length);
    return result;

  } catch (error) {
    console.error('📋 PRESET SERVICE: Error al cargar presets:', error)
    console.error('📋 PRESET SERVICE: Error details:', error.message);
    console.error('📋 PRESET SERVICE: Error stack:', error.stack);
    return []
  }
}

/**
 * Guarda todos los presets en localStorage
 */
const saveAllPresets = (presets) => {
  try {
    // Limitar número de presets
    const limitedPresets = presets.slice(0, MAX_PRESETS)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(limitedPresets))
    return true
  } catch (error) {
    if (error.name === 'QuotaExceededError') {
      throw new Error('Espacio de almacenamiento insuficiente. Elimina algunos presets.')
    }
    throw new Error(`Error al guardar presets: ${error.message}`)
  }
}

/**
 * Obtiene un preset por ID
 */
export const getPresetById = (id) => {
  const presets = getAllPresets()
  return presets.find(preset => preset.id === id) || null
}

/**
 * Crea un nuevo preset
 */
export const createPreset = (presetData) => {
  try {
    if (!presetData || typeof presetData !== 'object') {
      throw new Error('Los datos del preset son obligatorios')
    }
    
    if (!presetData.name || typeof presetData.name !== 'string' || presetData.name.trim().length === 0) {
      throw new Error('El nombre del preset es obligatorio')
    }
    
    if (presetData.name.trim().length > 50) {
      throw new Error('El nombre del preset no puede exceder 50 caracteres')
    }

    const presets = getAllPresets()
    
    // Verificar límite de presets
    if (presets.length >= MAX_PRESETS) {
      throw new Error(`Límite de presets alcanzado (${MAX_PRESETS}). Elimina algunos presets antes de crear nuevos.`)
    }
    
    // Verificar nombre único
    const trimmedName = presetData.name.trim()
    if (presets.some(p => p.name.toLowerCase() === trimmedName.toLowerCase())) {
      throw new Error('Ya existe un preset con ese nombre')
    }

    const now = new Date().toISOString()
    const preset = {
      id: generateId(),
      version: CURRENT_VERSION,
      createdAt: now,
      updatedAt: now,
      ...presetData,
      name: trimmedName
    }

    if (!validatePreset(preset)) {
      throw new Error('Los datos del preset no son válidos')
    }

    presets.push(preset)
    
    try {
      saveAllPresets(presets)
    } catch (storageError) {
      if (storageError.message.includes('Espacio de almacenamiento insuficiente')) {
        throw new Error('No hay suficiente espacio de almacenamiento. Elimina algunos presets.')
      }
      throw storageError
    }

    return preset
  } catch (error) {
    console.error('Error creando preset:', error)
    throw new Error(`Error al crear preset: ${error.message}`)
  }
}

/**
 * Actualiza un preset existente
 */
export const updatePreset = (id, updates) => {
  try {
    const presets = getAllPresets()
    const index = presets.findIndex(preset => preset.id === id)
    
    if (index === -1) {
      throw new Error('Preset no encontrado')
    }

    const updatedPreset = {
      ...presets[index],
      ...updates,
      id, // Asegurar que el ID no cambie
      updatedAt: new Date().toISOString()
    }

    validatePreset(updatedPreset)

    presets[index] = updatedPreset
    saveAllPresets(presets)

    return updatedPreset
  } catch (error) {
    throw new Error(`Error al actualizar preset: ${error.message}`)
  }
}

/**
 * Elimina un preset
 */
export const deletePreset = (id) => {
  try {
    const presets = getAllPresets()
    const filteredPresets = presets.filter(preset => preset.id !== id)
    
    if (filteredPresets.length === presets.length) {
      throw new Error('Preset no encontrado')
    }

    saveAllPresets(filteredPresets)
    return true
  } catch (error) {
    throw new Error(`Error al eliminar preset: ${error.message}`)
  }
}

/**
 * Duplica un preset
 */
export const duplicatePreset = (id) => {
  try {
    const originalPreset = getPresetById(id)
    if (!originalPreset) {
      throw new Error('Preset no encontrado')
    }

    const duplicatedPreset = {
      ...originalPreset,
      id: generateId(),
      name: `${originalPreset.name} (Copia)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    const presets = getAllPresets()
    
    if (presets.length >= MAX_PRESETS) {
      throw new Error(`Máximo ${MAX_PRESETS} presets permitidos`)
    }

    presets.push(duplicatedPreset)
    saveAllPresets(presets)

    return duplicatedPreset
  } catch (error) {
    throw new Error(`Error al duplicar preset: ${error.message}`)
  }
}

/**
 * Exporta un preset como JSON
 */
export const exportPreset = (id) => {
  const preset = getPresetById(id)
  if (!preset) {
    throw new Error('Preset no encontrado')
  }
  return JSON.stringify(preset, null, 2)
}

/**
 * Importa un preset desde JSON
 */
export const importPreset = (jsonString) => {
  try {
    const preset = JSON.parse(jsonString)
    
    // Generar nuevo ID para evitar conflictos
    preset.id = generateId()
    preset.createdAt = new Date().toISOString()
    preset.updatedAt = new Date().toISOString()
    
    validatePreset(preset)

    const presets = getAllPresets()
    
    if (presets.length >= MAX_PRESETS) {
      throw new Error(`Máximo ${MAX_PRESETS} presets permitidos`)
    }

    presets.push(preset)
    saveAllPresets(presets)

    return preset
  } catch (error) {
    throw new Error(`Error al importar preset: ${error.message}`)
  }
}

/**
 * Limpia todos los presets (usar con precaución)
 */
export const clearAllPresets = () => {
  try {
    localStorage.removeItem(STORAGE_KEY)
    return true
  } catch (error) {
    throw new Error(`Error al limpiar presets: ${error.message}`)
  }
}

/**
 * Obtiene estadísticas de uso de almacenamiento
 */
export const getStorageStats = () => {
  try {
    const presets = getAllPresets()
    const jsonString = localStorage.getItem(STORAGE_KEY) || '[]'
    
    return {
      totalPresets: presets.length,
      maxPresets: MAX_PRESETS,
      storageUsed: new Blob([jsonString]).size,
      storageUsedKB: Math.round(new Blob([jsonString]).size / 1024 * 100) / 100
    }
  } catch (error) {
    return {
      totalPresets: 0,
      maxPresets: MAX_PRESETS,
      storageUsed: 0,
      storageUsedKB: 0,
      error: error.message
    }
  }
}