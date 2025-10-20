<template>
  <Dialog 
    v-model:visible="presetStore.isDialogOpen"
    modal
    header="Gestión de Presets"
    :style="{ width: '90vw', maxWidth: '1200px' }"
    :closable="true"
    @hide="closeDialog"
    class="preset-manager-dialog"
  >

      <!-- Información del preset actual -->
      <div class="current-preset-info">
        <div class="preset-status">
          <span class="label">Preset Actual:</span>
          <span class="preset-name">
            {{ presetStore.currentPreset?.name || 'Ninguno seleccionado' }}
          </span>
          <span v-if="presetStore.hasUnsavedChanges" class="unsaved-indicator" title="Cambios sin guardar">
            ●
          </span>
        </div>
        <div v-if="presetStore.lastSaveTime" class="last-save">
          Último guardado: {{ formatDate(presetStore.lastSaveTime) }}
        </div>
      </div>

      <!-- Barra de herramientas -->
      <div class="toolbar">
        <div class="search-section">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Buscar presets..."
            class="search-input"
          />
        </div>
        <div class="action-buttons">
          <button @click="showCreateForm = true" class="btn btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Nuevo Preset
          </button>
          <button @click="saveCurrentPreset" class="btn btn-secondary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
              <polyline points="17,21 17,13 7,13 7,21"></polyline>
              <polyline points="7,3 7,8 15,8"></polyline>
            </svg>
            Guardar
          </button>
        </div>
      </div>

      <!-- Tabla de presets -->
      <div class="presets-table-container">
        <table class="presets-table">
          <thead>
            <tr>
              <th @click="setSortBy('name')" class="sortable">
                Nombre
                <span v-if="sortBy === 'name'" class="sort-indicator">
                  {{ sortOrder === 'asc' ? '↑' : '↓' }}
                </span>
              </th>
              <th @click="setSortBy('updatedAt')" class="sortable">
                Fecha Modificación
                <span v-if="sortBy === 'updatedAt'" class="sort-indicator">
                  {{ sortOrder === 'asc' ? '↑' : '↓' }}
                </span>
              </th>
              <th @click="setSortBy('createdAt')" class="sortable">
                Fecha Creación
                <span v-if="sortBy === 'createdAt'" class="sort-indicator">
                  {{ sortOrder === 'asc' ? '↑' : '↓' }}
                </span>
              </th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="preset in filteredAndSortedPresets"
              :key="preset.id"
              :class="{ 'current-preset': preset.id === presetStore.currentPresetId }"
            >
              <td class="preset-name-cell">
                <span v-if="editingPresetId !== preset.id" @dblclick="startEditing(preset)">
                  {{ preset.name }}
                </span>
                <input
                  v-else
                  v-model="editingName"
                  @blur="finishEditing"
                  @keyup.enter="finishEditing"
                  @keyup.escape="cancelEditing"
                  class="edit-input"
                  ref="editInput"
                />
                <span v-if="preset.id === presetStore.currentPresetId" class="current-indicator" title="Preset actual">
                  ★
                </span>
              </td>
              <td 
                @dblclick="preset.id !== presetStore.currentPresetId ? loadPresetAndClose(preset.id) : null"
                style="cursor: pointer;"
                title="Doble click para cargar preset"
              >
                {{ formatDate(preset.updatedAt) }}
              </td>
              <td 
                @dblclick="preset.id !== presetStore.currentPresetId ? loadPresetAndClose(preset.id) : null"
                style="cursor: pointer;"
                title="Doble click para cargar preset"
              >
                {{ formatDate(preset.createdAt) }}
              </td>
              <td class="actions-cell">
                <button
                  @click="loadPreset(preset.id)"
                  :disabled="preset.id === presetStore.currentPresetId"
                  class="btn btn-small btn-primary"
                  title="Cargar preset"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="16,16 12,12 8,16"></polyline>
                    <line x1="12" y1="12" x2="12" y2="21"></line>
                    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"></path>
                  </svg>
                </button>
                <button
                  @click="duplicatePreset(preset.id)"
                  class="btn btn-small btn-secondary"
                  title="Duplicar preset"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                </button>
                <button
                  @click="startEditing(preset)"
                  class="btn btn-small btn-secondary"
                  title="Renombrar preset"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                </button>
                <button
                  @click="confirmDelete(preset)"
                  class="btn btn-small btn-danger"
                  title="Eliminar preset"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3,6 5,6 21,6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <div v-if="filteredAndSortedPresets.length === 0" class="empty-state">
          <p v-if="searchQuery">No se encontraron presets que coincidan con "{{ searchQuery }}"</p>
          <p v-else>No hay presets disponibles. Crea tu primer preset.</p>
        </div>
      </div>

      <!-- Información de almacenamiento -->
      <div class="storage-info">
        <span>{{ presetStore.presetsCount }} presets</span>
        <span v-if="storageStats">
          • {{ storageStats.storageUsedKB }} KB utilizados
        </span>
      </div>

      <!-- Formulario de creación de preset -->
      <div v-if="showCreateForm" class="create-form-overlay" @click="showCreateForm = false">
        <div class="create-form" @click.stop>
          <h3>Crear Nuevo Preset</h3>
          <input
            v-model="newPresetName"
            type="text"
            placeholder="Nombre del preset"
            class="form-input"
            @keyup.enter="createPreset"
            @keyup.escape="showCreateForm = false"
            ref="createInput"
          />
          <div class="form-actions">
            <button @click="createPreset" :disabled="!newPresetName.trim()" class="btn btn-primary">
              Crear
            </button>
            <button @click="showCreateForm = false" class="btn btn-secondary">
              Cancelar
            </button>
          </div>
        </div>
      </div>

      <!-- Confirmación de eliminación -->
      <div v-if="deleteConfirmation" class="confirm-overlay" @click="deleteConfirmation = null">
        <div class="confirm-dialog" @click.stop>
          <h3>Confirmar Eliminación</h3>
          <p>¿Estás seguro de que quieres eliminar el preset "{{ deleteConfirmation.name }}"?</p>
          <p class="warning">Esta acción no se puede deshacer.</p>
          <div class="form-actions">
            <button @click="deletePreset(deleteConfirmation.id)" class="btn btn-danger">
              Eliminar
            </button>
            <button @click="deleteConfirmation = null" class="btn btn-secondary">
              Cancelar
            </button>
          </div>
        </div>
      </div>

      <!-- Indicador de carga -->
      <div v-if="presetStore.isLoading" class="loading-overlay">
        <div class="loading-spinner"></div>
      </div>
  </Dialog>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, watch } from 'vue'
import { usePresetStore } from '../stores/presetStore'
import { getStorageStats } from '../services/presetService'
import Dialog from 'primevue/dialog'

const presetStore = usePresetStore()

// Estado del componente
const searchQuery = ref('')
const sortBy = ref('updatedAt')
const sortOrder = ref('desc')
const showCreateForm = ref(false)
const newPresetName = ref('')
const editingPresetId = ref(null)
const editingName = ref('')
const deleteConfirmation = ref(null)
const storageStats = ref(null)

// Referencias a elementos DOM
const editInput = ref(null)
const createInput = ref(null)

// Computed
const filteredAndSortedPresets = computed(() => {
  let filtered = presetStore.presets

  // Filtrar por búsqueda
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(preset =>
      preset.name.toLowerCase().includes(query)
    )
  }

  // Ordenar
  const sorted = [...filtered].sort((a, b) => {
    let aVal = a[sortBy.value]
    let bVal = b[sortBy.value]

    if (sortBy.value.includes('At')) {
      aVal = new Date(aVal)
      bVal = new Date(bVal)
    }

    if (sortOrder.value === 'asc') {
      return aVal < bVal ? -1 : aVal > bVal ? 1 : 0
    } else {
      return aVal > bVal ? -1 : aVal < bVal ? 1 : 0
    }
  })

  return sorted
})

// Métodos
const closeDialog = () => {
  presetStore.closeDialog()
  resetForms()
}

const resetForms = () => {
  showCreateForm.value = false
  newPresetName.value = ''
  editingPresetId.value = null
  editingName.value = ''
  deleteConfirmation.value = null
}

const setSortBy = (field) => {
  if (sortBy.value === field) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = field
    sortOrder.value = 'desc'
  }
}

const formatDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleString('es-ES', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const createPreset = async () => {
  if (!newPresetName.value.trim()) return

  try {
    await presetStore.createPreset(newPresetName.value.trim())
    showCreateForm.value = false
    newPresetName.value = ''
  } catch (error) {
    alert(`Error al crear preset: ${error.message}`)
  }
}

const loadPreset = async (presetId) => {
  try {
    await presetStore.loadPreset(presetId)
  } catch (error) {
    alert(`Error al cargar preset: ${error.message}`)
  }
}

const loadPresetAndClose = async (presetId) => {
  try {
    await presetStore.loadPreset(presetId)
    closeDialog()
  } catch (error) {
    alert(`Error al cargar preset: ${error.message}`)
  }
}

const saveCurrentPreset = async () => {
  try {
    await presetStore.saveCurrentPreset()
  } catch (error) {
    if (error.message === 'NO_PRESET_SELECTED') {
      // Si no hay preset seleccionado, mostrar el formulario de creación
      showCreateForm.value = true
      // Enfocar el input cuando se muestre
      nextTick(() => {
        if (createInput.value) {
          createInput.value.focus()
        }
      })
    } else {
      alert(`Error al guardar preset: ${error.message}`)
    }
  }
}

const duplicatePreset = async (presetId) => {
  try {
    await presetStore.duplicatePreset(presetId)
  } catch (error) {
    alert(`Error al duplicar preset: ${error.message}`)
  }
}

const startEditing = (preset) => {
  editingPresetId.value = preset.id
  editingName.value = preset.name
  nextTick(() => {
    if (editInput.value && typeof editInput.value.focus === 'function') {
      editInput.value.focus()
      if (typeof editInput.value.select === 'function') {
        editInput.value.select()
      }
    }
  })
}

const finishEditing = async () => {
  if (!editingName.value.trim()) {
    cancelEditing()
    return
  }

  try {
    await presetStore.renamePreset(editingPresetId.value, editingName.value.trim())
    editingPresetId.value = null
    editingName.value = ''
  } catch (error) {
    alert(`Error al renombrar preset: ${error.message}`)
    cancelEditing()
  }
}

const cancelEditing = () => {
  editingPresetId.value = null
  editingName.value = ''
}

const confirmDelete = (preset) => {
  deleteConfirmation.value = preset
}

const deletePreset = async (presetId) => {
  try {
    await presetStore.deletePreset(presetId)
    deleteConfirmation.value = null
  } catch (error) {
    alert(`Error al eliminar preset: ${error.message}`)
  }
}

const updateStorageStats = () => {
  storageStats.value = getStorageStats()
}

// Watchers
watch(() => showCreateForm.value, (show) => {
  if (show) {
    nextTick(() => {
      if (createInput.value) {
        createInput.value.focus()
      }
    })
  }
})

// Lifecycle
onMounted(() => {
  updateStorageStats()
})

// Actualizar estadísticas cuando cambie el número de presets
watch(() => presetStore.presetsCount, updateStorageStats)
</script>

<style scoped>
.preset-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.preset-dialog {
  background: #1a1a1a;
  border-radius: 12px;
  width: 100%;
  max-width: 900px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  color: #ffffff;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #333;
}

.dialog-header h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: color 0.2s;
}

.close-btn:hover {
  color: #fff;
}

.current-preset-info {
  padding: 16px 24px;
  background: #252525;
  border-bottom: 1px solid #333;
}

.preset-status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.label {
  color: #888;
  font-size: 0.9rem;
}

.preset-name {
  font-weight: 500;
  color: #4CAF50;
}

.unsaved-indicator {
  color: #ff9800;
  font-size: 1.2rem;
  line-height: 1;
}

.last-save {
  font-size: 0.8rem;
  color: #666;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid #333;
  gap: 16px;
}

.search-section {
  flex: 1;
  max-width: 300px;
}

.search-input {
  width: 100%;
  padding: 8px 12px;
  background: #333;
  border: 1px solid #555;
  border-radius: 6px;
  color: #fff;
  font-size: 0.9rem;
}

.search-input:focus {
  outline: none;
  border-color: #4CAF50;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #4CAF50;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #45a049;
}

.btn-secondary {
  background: #555;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #666;
}

.btn-danger {
  background: #f44336;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #da190b;
}

.btn-small {
  padding: 4px 6px;
  font-size: 0.8rem;
}

.presets-table-container {
  flex: 1;
  overflow: auto;
  padding: 0 24px;
}

.presets-table {
  width: 100%;
  border-collapse: collapse;
  margin: 16px 0;
}

.presets-table th,
.presets-table td {
  padding: 12px 8px;
  text-align: left;
  border-bottom: 1px solid #333;
}

.presets-table th {
  background: #252525;
  font-weight: 600;
  color: #ccc;
  position: sticky;
  top: 0;
}

.sortable {
  cursor: pointer;
  user-select: none;
}

.sortable:hover {
  background: #333;
}

.sort-indicator {
  margin-left: 4px;
  font-size: 0.8rem;
}

.presets-table tr:hover {
  background: #252525;
}

.current-preset {
  background: rgba(76, 175, 80, 0.1);
}

.preset-name-cell {
  position: relative;
}

.current-indicator {
  color: #4CAF50;
  margin-left: 8px;
}

.edit-input {
  background: #333;
  border: 1px solid #4CAF50;
  border-radius: 4px;
  color: #fff;
  padding: 4px 8px;
  font-size: 0.9rem;
  width: 100%;
}

.actions-cell {
  white-space: nowrap;
}

.actions-cell .btn {
  margin-right: 4px;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #888;
}

.storage-info {
  padding: 12px 24px;
  border-top: 1px solid #333;
  font-size: 0.8rem;
  color: #888;
  display: flex;
  gap: 8px;
}

.create-form-overlay,
.confirm-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.create-form,
.confirm-dialog {
  background: #2a2a2a;
  border-radius: 8px;
  padding: 24px;
  min-width: 300px;
  max-width: 400px;
}

.create-form h3,
.confirm-dialog h3 {
  margin: 0 0 16px 0;
  font-size: 1.2rem;
}

.form-input {
  width: 100%;
  padding: 8px 12px;
  background: #333;
  border: 1px solid #555;
  border-radius: 6px;
  color: #fff;
  font-size: 0.9rem;
  margin-bottom: 16px;
}

.form-input:focus {
  outline: none;
  border-color: #4CAF50;
}

.form-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.warning {
  color: #ff9800;
  font-size: 0.9rem;
  margin: 8px 0;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #333;
  border-top: 3px solid #4CAF50;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .preset-dialog {
    margin: 10px;
    max-height: calc(100vh - 20px);
  }
  
  .toolbar {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  
  .search-section {
    max-width: none;
  }
  
  .presets-table {
    font-size: 0.8rem;
  }
  
  .presets-table th,
  .presets-table td {
    padding: 8px 4px;
  }
}
</style>