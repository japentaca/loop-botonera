<template>
  <Dialog 
    :visible="isOpen" 
    modal 
    header="Configuración de Estilos"
    :style="{ width: '90vw', maxWidth: '800px' }"
    :closable="true"
    :closeOnEscape="true"
    :dismissableMask="true"
    @update:visible="onVisibilityChange"
    @hide="closeDialog"
    class="style-config-dialog"
  >
    <div class="dialog-body">
        <!-- Estilos Creativos -->
        <div class="config-section">
          <h4>Estilos Creativos</h4>
          <div class="styles-grid">
            <div class="field">
              <label for="evolution-types" class="field-label">Tipos de Evolución</label>
              <MultiSelect
                id="evolution-types"
                v-model="selectedEvolutionTypes"
                :options="evolutionOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="Seleccionar estilos..."
                :maxSelectedLabels="3"
                :selectionLimit="3"
                class="w-full"
                @update:modelValue="onEvolutionTypesChange"
              />
            </div>
          </div>
        </div>

        <!-- Parámetros de Evolución -->
        <div class="config-section">
          <h4>Parámetros de Evolución</h4>
          <div class="controls-grid">
            <!-- Intervalo de Evolución -->
            <div class="control-group">
              <label class="control-label">Intervalo (compases)</label>
              <div class="slider-container">
                <Slider 
                  :min="4" 
                  :max="32" 
                  :step="4"
                  :modelValue="audioStore.evolveInterval"
                  @update:modelValue="onEvolveIntervalChange"
                  class="range-slider"
                />
                <span class="value-display">{{ audioStore.evolveInterval }}</span>
              </div>
              <small class="control-description">Compases entre cada evolución automática</small>
            </div>

            <!-- Intensidad de Evolución -->
            <div class="control-group">
              <label class="control-label">Intensidad</label>
              <div class="slider-container">
                <Slider 
                  :min="1" 
                  :max="10" 
                  :step="1"
                  :modelValue="audioStore.evolveIntensity"
                  @update:modelValue="onEvolveIntensityChange"
                  class="range-slider"
                />
                <span class="value-display">{{ audioStore.evolveIntensity }}</span>
              </div>
              <small class="control-description">Número de loops afectados por evolución</small>
            </div>

            <!-- Nivel Máximo de Momentum -->
            <div class="control-group">
              <label class="control-label">Momentum Máximo</label>
              <div class="slider-container">
                <Slider 
                  :min="1" 
                  :max="10" 
                  :step="1"
                  :modelValue="momentumMaxLevel"
                  @update:modelValue="onMomentumMaxLevelChange"
                  class="range-slider"
                />
                <span class="value-display">{{ momentumMaxLevel }}</span>
              </div>
              <small class="control-description">Nivel máximo que puede alcanzar el momentum</small>
            </div>
          </div>
        </div>

        <!-- Gestión de Energía Sonora -->
        <div class="config-section">
          <h4>Gestión de Energía Sonora</h4>
          <div class="controls-grid">
            <!-- Habilitar Gestión de Energía -->
            <div class="control-group checkbox-group">
              <div class="checkbox-container">
                <label for="energyManagement" class="checkbox-label">
                  <input 
                    type="checkbox" 
                    id="energyManagement"
                    v-model="energyManagementEnabled"
                    class="custom-checkbox"
                  />
                  <span class="checkbox-text">Habilitar gestión automática de energía</span>
                </label>
              </div>
              <small class="control-description">Ajusta automáticamente volumen y densidad según la energía total</small>
            </div>

            <!-- Energía Sonora Máxima -->
            <div class="control-group">
              <label class="control-label">Energía Sonora Máxima</label>
              <div class="slider-container">
                <Slider 
                  :min="1.0" 
                  :max="5.0" 
                  :step="0.1"
                  :modelValue="audioStore.maxSonicEnergy"
                  @update:modelValue="onMaxSonicEnergyChange"
                  class="range-slider"
                />
                <span class="value-display">{{ audioStore.maxSonicEnergy.toFixed(1) }}</span>
              </div>
              <small class="control-description">Límite máximo de energía sonora total permitida</small>
            </div>

            <!-- Factor de Reducción de Energía -->
            <div class="control-group">
              <label class="control-label">Factor de Reducción</label>
              <div class="slider-container">
                <Slider 
                  :min="0.1" 
                  :max="1.0" 
                  :step="0.05"
                  :modelValue="audioStore.energyReductionFactor"
                  @update:modelValue="onEnergyReductionFactorChange"
                  class="range-slider"
                />
                <span class="value-display">{{ Math.round(audioStore.energyReductionFactor * 100) }}%</span>
              </div>
              <small class="control-description">Porcentaje de reducción cuando se excede el límite</small>
            </div>
          </div>
        </div>

        <!-- Controles Adicionales -->
        <div class="config-section">
          <h4>Controles Adicionales</h4>
          <div class="controls-grid">
            <!-- Bloqueo de Escala -->
            <div class="control-group checkbox-group">
              <div class="checkbox-container">
                <label for="scaleLocked" class="checkbox-label">
                  <input 
                    id="scaleLocked"
                    type="checkbox" 
                    v-model="scaleLocked"
                    class="custom-checkbox"
                  />
                  <span class="checkbox-text">Bloquear cambios de escala</span>
                </label>
              </div>
              <small class="control-description">Evita que la evolución automática cambie la escala musical</small>
            </div>
          </div>
        </div>
    </div>
    
    <template #footer>
      <Button 
        label="Restaurar Valores por Defecto" 
        icon="pi pi-refresh" 
        severity="secondary" 
        @click="resetToDefaults" 
      />
      <Button 
        label="Cerrar" 
        icon="pi pi-check" 
        @click="closeDialog" 
      />
    </template>
  </Dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useAudioStore } from '../stores/audioStore'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Slider from 'primevue/slider'
import Checkbox from 'primevue/checkbox'
import MultiSelect from 'primevue/multiselect'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close'])

const audioStore = useAudioStore()

// Estado local para momentum max level (no está expuesto en el store)
const momentumMaxLevel = ref(5)

// Configuración del multiselector de evolución
const selectedEvolutionTypes = ref([])

const evolutionOptions = [
  {
    value: 'momentum',
    label: 'Momentum',
    description: 'Intensidad progresiva que aumenta con el tiempo'
  },
  {
    value: 'callResponse',
    label: 'Call & Response',
    description: 'Patrones de pregunta y respuesta entre loops'
  },
  {
    value: 'tensionRelease',
    label: 'Tensión/Release',
    description: 'Alternancia entre fases de tensión y relajación'
  },
  {
    value: 'classic',
    label: 'Clásico',
    description: 'Cambios aleatorios tradicionales'
  }
]

// Métodos de manejo de eventos
const onEvolveIntervalChange = (value) => {
  audioStore.updateEvolveInterval(Number(value))
}

const onEvolveIntensityChange = (value) => {
  audioStore.updateEvolveIntensity(Number(value))
}

const onMomentumMaxLevelChange = (value) => {
  momentumMaxLevel.value = Number(value)
  // Actualizar en el store si existe la función
  if (audioStore.updateMomentumMaxLevel) {
    audioStore.updateMomentumMaxLevel(Number(value))
  }
}

const onMaxSonicEnergyChange = (value) => {
  audioStore.updateMaxSonicEnergy(Number(value))
}

const onEnergyReductionFactorChange = (value) => {
  audioStore.updateEnergyReductionFactor(Number(value))
}

// Computed property para el checkbox de bloqueo de escala
const scaleLocked = computed({
  get: () => audioStore.scaleLocked,
  set: (value) => {
    if (value !== audioStore.scaleLocked) {
      audioStore.toggleScaleLock()
      console.log('Estado del bloqueo de escala:', audioStore.scaleLocked)
    }
  }
})

// Computed property para el checkbox de gestión automática de energía
const energyManagementEnabled = computed({
  get: () => audioStore.energyManagementEnabled,
  set: (value) => {
    audioStore.updateEnergyManagement(value)
    console.log('Gestión automática de energía:', value ? 'activada' : 'desactivada')
    console.log('Estado de gestión de energía:', audioStore.energyManagementEnabled)
  }
})

// Manejar cambios en el multiselector de evolución
const onEvolutionTypesChange = (selectedTypes) => {
  // Si se selecciona clásico, desactivar todos los modos especiales
  if (selectedTypes.includes('classic')) {
    audioStore.setMomentumEnabled(false)
    audioStore.setCallResponseEnabled(false)
    audioStore.setTensionReleaseMode(false)
  } else {
    // Si no se selecciona clásico, actualizar los estados basándose en las selecciones
    audioStore.setMomentumEnabled(selectedTypes.includes('momentum'))
    audioStore.setCallResponseEnabled(selectedTypes.includes('callResponse'))
    audioStore.setTensionReleaseMode(selectedTypes.includes('tensionRelease'))
  }
  
  console.log('Tipos de evolución actualizados:', selectedTypes)
}

const resetToDefaults = () => {
  // Restaurar valores por defecto
  audioStore.updateEvolveInterval(8)
  audioStore.updateEvolveIntensity(2)
  momentumMaxLevel.value = 5
  audioStore.updateEnergyManagement(true)
  audioStore.updateMaxSonicEnergy(2.5)
  audioStore.updateEnergyReductionFactor(0.6)
  selectedEvolutionTypes.value = []
  onEvolutionTypesChange([])
}

const onVisibilityChange = (visible) => {
  if (!visible) {
    emit('close')
  }
}

const closeDialog = () => {
  emit('close')
}

// Sincronizar estado inicial del multiselector basado en el store
watch(() => [
  audioStore.momentumEnabled,
  audioStore.callResponseEnabled,
  audioStore.tensionReleaseMode
], () => {
  const types = []
  if (audioStore.momentumEnabled) types.push('momentum')
  if (audioStore.callResponseEnabled) types.push('callResponse')
  if (audioStore.tensionReleaseMode) types.push('tensionRelease')
  
  // Solo agregar 'classic' si no hay ningún tipo especial activado
  if (types.length === 0) {
    types.push('classic')
  }
  
  selectedEvolutionTypes.value = types
}, { immediate: true })
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.dialog-content {
  background: linear-gradient(135deg, #1a1a2e, #16213e);
  border: 2px solid rgba(0, 217, 255, 0.3);
  border-radius: 12px;
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid rgba(0, 217, 255, 0.2);
}

.dialog-header h3 {
  color: #00d9ff;
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.close-button {
  background: none;
  border: none;
  color: #00d9ff;
  font-size: 2rem;
  cursor: pointer;
  padding: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.3s ease;
}

.close-button:hover {
  background: rgba(0, 217, 255, 0.1);
}

.dialog-body {
  padding: 1.5rem;
}

.config-section {
  margin-bottom: 2rem;
}

.config-section h4 {
  color: #7b2ff7;
  margin: 0 0 1rem 0;
  font-size: 1.2rem;
  font-weight: 500;
  border-bottom: 1px solid rgba(123, 47, 247, 0.3);
  padding-bottom: 0.5rem;
}

.controls-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

.styles-grid {
  width: 100%;
}

.control-group {
  background: rgba(0, 0, 0, 0.3);
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.control-label {
  display: block;
  color: #00d9ff;
  font-weight: 500;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.slider-container {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.range-slider {
  flex: 1;
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  outline: none;
  -webkit-appearance: none;
}

.range-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  background: linear-gradient(135deg, #00d9ff, #7b2ff7);
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 217, 255, 0.3);
}

.range-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  background: linear-gradient(135deg, #00d9ff, #7b2ff7);
  border-radius: 50%;
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 8px rgba(0, 217, 255, 0.3);
}

.value-display {
  color: #ffffff;
  font-weight: 600;
  min-width: 40px;
  text-align: center;
  background: rgba(0, 217, 255, 0.1);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  border: 1px solid rgba(0, 217, 255, 0.3);
}

.control-description {
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.8rem;
  line-height: 1.3;
}

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.checkbox-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.9rem;
  color: #ffffff;
}

.custom-checkbox {
  width: 1.2rem;
  height: 1.2rem;
  border: 2px solid #00d9ff;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.custom-checkbox:checked {
  background: #00d9ff;
  border-color: #00d9ff;
}

.custom-checkbox:checked::after {
  content: '✓';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-size: 0.8rem;
  font-weight: bold;
}

.custom-checkbox:hover {
  border-color: #7b2ff7;
  box-shadow: 0 0 0 2px rgba(0, 217, 255, 0.2);
}

.checkbox-text {
  font-size: 0.9rem;
  color: #ffffff;
  cursor: pointer;
  font-weight: 500;
}

.dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-top: 1px solid rgba(0, 217, 255, 0.2);
  gap: 1rem;
}

.btn-primary,
.btn-secondary {
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  border: none;
  font-size: 0.9rem;
}

.btn-primary {
  background: linear-gradient(135deg, #00d9ff, #7b2ff7);
  color: white;
}

.btn-primary:hover {
  box-shadow: 0 6px 20px rgba(0, 217, 255, 0.4);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* Scrollbar personalizado */
.dialog-content::-webkit-scrollbar {
  width: 8px;
}

.dialog-content::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
}

.dialog-content::-webkit-scrollbar-thumb {
  background: linear-gradient(135deg, #00d9ff, #7b2ff7);
  border-radius: 4px;
}

.dialog-content::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(135deg, #7b2ff7, #00d9ff);
}
</style>