const STORAGE_KEY = 'loopera_presets'
const MAX_PRESETS = 50

const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

export const validatePreset = (preset) => {
  // Validation removed - presets read "as is"
  return true
}

export const getAllPresets = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []

    const presets = JSON.parse(stored)
    return Array.isArray(presets) ? presets : []
  } catch (error) {
    console.error('Error loading presets - aborting:', error)
    return []
  }
}

const saveAllPresets = (presets) => {
  try {
    const limitedPresets = presets.slice(0, MAX_PRESETS)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(limitedPresets))
    // Debug: verify what actually ended up in storage
    try {
      const storedNow = localStorage.getItem(STORAGE_KEY)
      // Keep this as a compact log to avoid huge spam; individual preset logs are below
      console.log('🗄️ [PresetStorage] Saved presets array length:', limitedPresets.length, 'bytes:', storedNow?.length || 0)
    } catch { }
    return true
  } catch (error) {
    throw new Error(error.name === 'QuotaExceededError'
      ? 'Storage full. Delete some presets.'
      : `Save error: ${error.message}`)
  }
}

export const getPresetById = (id) => {
  const presets = getAllPresets()
  return presets.find(preset => preset.id === id) || null
}

export const createPreset = (presetData) => {
  if (!presetData?.name?.trim()) {
    throw new Error('Preset name is required')
  }

  const presets = getAllPresets()

  if (presets.length >= MAX_PRESETS) {
    throw new Error(`Maximum ${MAX_PRESETS} presets allowed`)
  }

  const trimmedName = presetData.name.trim()
  if (presets.some(p => p.name.toLowerCase() === trimmedName.toLowerCase())) {
    throw new Error('Preset name already exists')
  }

  const now = new Date().toISOString()
  const preset = {
    id: generateId(),
    createdAt: now,
    updatedAt: now,
    ...presetData,
    name: trimmedName
  }

  // No validation - save preset "as is"

  presets.push(preset)
  saveAllPresets(presets)
  return preset
}

export const updatePreset = (id, updates) => {
  const presets = getAllPresets()
  const index = presets.findIndex(preset => preset.id === id)

  if (index === -1) {
    throw new Error('Preset not found')
  }

  const updatedPreset = {
    ...presets[index],
    ...updates,
    id,
    updatedAt: new Date().toISOString()
  }

  // No validation - save preset "as is"

  presets[index] = updatedPreset
  saveAllPresets(presets)
  return updatedPreset
}

export const deletePreset = (id) => {
  const presets = getAllPresets()
  const filteredPresets = presets.filter(preset => preset.id !== id)

  if (filteredPresets.length === presets.length) {
    throw new Error('Preset not found')
  }

  saveAllPresets(filteredPresets)
  return true
}

export const duplicatePreset = (id) => {
  const originalPreset = getPresetById(id)
  if (!originalPreset) {
    throw new Error('Preset not found')
  }

  const presets = getAllPresets()
  if (presets.length >= MAX_PRESETS) {
    throw new Error(`Maximum ${MAX_PRESETS} presets allowed`)
  }

  const duplicatedPreset = {
    ...originalPreset,
    id: generateId(),
    name: `${originalPreset.name} (Copy)`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  presets.push(duplicatedPreset)
  saveAllPresets(presets)
  return duplicatedPreset
}

export const exportPreset = (id) => {
  const preset = getPresetById(id)
  if (!preset) {
    throw new Error('Preset not found')
  }
  return JSON.stringify(preset, null, 2)
}

export const importPreset = (jsonString) => {
  try {
    const preset = JSON.parse(jsonString)
    preset.id = generateId()
    preset.createdAt = new Date().toISOString()
    preset.updatedAt = new Date().toISOString()

    // No validation - import preset "as is"

    const presets = getAllPresets()
    if (presets.length >= MAX_PRESETS) {
      throw new Error(`Maximum ${MAX_PRESETS} presets allowed`)
    }

    presets.push(preset)
    saveAllPresets(presets)
    return preset
  } catch (error) {
    console.error('Error importing preset - aborting:', error)
    throw error
  }
}

export const clearAllPresets = () => {
  localStorage.removeItem(STORAGE_KEY)
  return true
}

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