<template>
  <div class="header-compact">
    <!-- Fila superior: Título y controles principales -->
    <div class="header-row-main">
      <div class="title-compact">🎹 LOOP SYNTH MACHINE 🎹</div>
      
      <div class="main-controls">
        <Button 
          @click="togglePlay" 
          :class="['play-button-compact', { playing: audioStore.isPlaying }]"
          size="small"
          :title="audioStore.isPlaying ? 'Pausa' : 'Play'"
        >
          {{ audioStore.isPlaying ? '⏸️' : '▶️' }}
        </Button>
        
        <Button 
          @click="regenerateAllLoops" 
          class="regen-button-compact"
          icon="pi pi-refresh"
          label="Regenerar"
          size="small"
        />
        
        <div class="control-group-compact">
          <label class="control-label-compact">Tempo</label>
          <Slider 
            v-model="tempTempo"
            :min="10" 
            :max="180"
            @change="onTempoInput(tempTempo)"
            class="range-compact"
          />
          <span class="value-compact">{{ tempTempo }}</span>
        </div>
        
        <div class="control-group-compact">
          <label class="control-label-compact">Vol</label>
          <Slider 
            v-model="tempMasterVolume"
            :min="0" 
            :max="100"
            @change="onMasterVolumeInput(tempMasterVolume)"
            class="range-compact"
          />
          <span class="value-compact">{{ tempMasterVolume }}%</span>
        </div>
        
        <Button 
          @click="audioStore.applySparseDistribution" 
          class="sparse-button"
          label="Sparse"
          size="small"
          severity="secondary"
          title="Distribuir canales activos en el panorama estéreo"
        />
        
        <Button 
          @click="openPresetDialog"
          class="preset-button-compact"
          icon="pi pi-save"
          label="Presets"
          size="small"
          title="Gestionar presets"
        />
      </div>
      
      <!-- Visualizador de pulsos integrado -->
      <div class="pulse-viz-compact">
        <div 
          v-for="i in 16" 
          :key="i" 
          :class="['pulse-dot-compact', { active: audioStore.currentBeat === i - 1 }]"
        ></div>
      </div>
    </div>
    
    <!-- Fila inferior: Controles de música y evolución -->
    <div class="header-row-secondary">
      <div class="music-controls">
        <div class="control-group-compact">
          <label class="control-label-compact">Escala</label>
          <Dropdown 
            :modelValue="audioStore.currentScale" 
            @update:modelValue="onScaleChange"
            :options="scaleOptions"
            optionLabel="label"
            optionValue="value"
            class="select-compact"
          />
        </div>

        <div class="control-group-compact">
          <label class="control-label-compact">Delay</label>
          <Dropdown 
            :modelValue="audioStore.delayDivision" 
            @update:modelValue="audioStore.updateDelayDivision"
            :options="delayOptions"
            optionLabel="label"
            optionValue="value"
            class="select-compact"
          />
        </div>
      </div>
      
      <div class="evolution-controls-compact">
        <Button 
          @click="toggleAutoEvolve" 
          :class="['evolve-button-compact', { active: audioStore.autoEvolve }]"
          :icon="audioStore.autoEvolve ? 'pi pi-pause' : 'pi pi-play'"
          label="Auto"
          size="small"
          :severity="audioStore.autoEvolve ? 'success' : 'secondary'"
        />
        
        <Button 
          @click="openStyleDialog"
          class="style-config-button-compact"
          icon="pi pi-cog"
          label="Estilos"
          size="small"
          title="Configurar estilos de evolución"
        />
        
        <div class="evolve-progress-compact" v-if="audioStore.autoEvolve">
          <ProgressBar 
            :value="evolveProgress" 
            class="progress-bar-compact"
            :showValue="false"
          />
          <span class="next-evolve">{{ nextEvolveInMeasures }}c</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Diálogo de configuración de estilos -->
  <StyleConfigDialog 
    :is-open="isStyleDialogOpen" 
    @close="closeStyleDialog" 
  />
  
  <!-- Diálogo de gestión de presets -->
  <PresetManagerDialog />
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { useAudioStore } from '../stores/audioStore'
import { usePresetStore } from '../stores/presetStore'
import { useScales } from '../composables/useMusic'
import StyleConfigDialog from './StyleConfigDialog.vue'
import PresetManagerDialog from './PresetManagerDialog.vue'

const audioStore = useAudioStore()
const presetStore = usePresetStore()
const { scales, scaleNames, scaleNamesSpanish } = useScales()

// Obtener las claves de las escalas para el selector
const scaleKeys = Object.keys(scales)

// Opciones para el dropdown de escalas
const scaleOptions = scaleKeys.map(key => ({
  label: scaleNamesSpanish[key],
  value: key
}))

// Opciones para el dropdown de delay
const delayOptions = [
  { label: '1/16 (semicorchea)', value: '16n' },
  { label: '1/8 (corchea)', value: '8n' },
  { label: '1/4 (negra)', value: '4n' },
  { label: '1/2 (blanca)', value: '2n' },
  { label: '1/8t (corchea ternaria)', value: '8t' },
  { label: '1/4t (negra ternaria)', value: '4t' },
  { label: '1/2t (blanca ternaria)', value: '2t' }
]

// Estado para el diálogo de configuración de estilos
const isStyleDialogOpen = ref(false)

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

// Estado temporal para el tempo
const tempTempo = ref(audioStore.tempo)
let tempoTimer = null

// Estado temporal para el volumen maestro
const tempMasterVolume = ref(audioStore.masterVolume || 70)
let volumeTimer = null

// Estado para evolución automática
const evolveProgress = computed(() => {
  if (!audioStore.autoEvolve) return 0
  const total = audioStore.evolveInterval * 16
  const current = audioStore.currentPulse % total
  return (current / total) * 100
})

const nextEvolveInMeasures = computed(() => {
  if (!audioStore.autoEvolve) return 0
  const currentMeasure = Math.floor(audioStore.currentPulse / 16)
  const targetMeasure = Math.floor(audioStore.nextEvolveMeasure / 16)
  return Math.max(0, targetMeasure - currentMeasure)
})

const onTempoInput = (value) => {
  const v = Number(value)
  tempTempo.value = v
  if (tempoTimer) clearTimeout(tempoTimer)
  tempoTimer = setTimeout(() => {
    audioStore.updateTempo(v)
  }, 300)
}

const onMasterVolumeInput = (value) => {
  const v = Number(value)
  tempMasterVolume.value = v
  if (volumeTimer) clearTimeout(volumeTimer)
  volumeTimer = setTimeout(() => {
    audioStore.updateMasterVolume(v)
  }, 150) // Debounce más corto para volumen para mejor respuesta
}

// Mantener sincronizado tempTempo con cambios externos
watch(() => audioStore.tempo, (newTempo) => {
  tempTempo.value = newTempo
})

// Mantener sincronizado tempMasterVolume con cambios externos
watch(() => audioStore.masterVolume, (newVolume) => {
  tempMasterVolume.value = newVolume
})

// Métodos
const togglePlay = async () => {
  await audioStore.togglePlay()
}

const toggleAutoEvolve = () => {
  if (audioStore.autoEvolve) {
    audioStore.stopAutoEvolve()
  } else {
    audioStore.startAutoEvolve()
  }
}

const onScaleChange = (scale) => {
  audioStore.updateScale(scale)
}

// Manejar cambios en el multiselector de evolución
const onEvolutionTypesChange = (selectedTypes) => {
  // Actualizar los estados en el store basándose en las selecciones
  audioStore.setMomentumEnabled(selectedTypes.includes('momentum'))
  audioStore.setCallResponseEnabled(selectedTypes.includes('callResponse'))
  audioStore.setTensionReleaseMode(selectedTypes.includes('tensionRelease'))
  
  // Si se selecciona clásico, desactivar todos los modos especiales
  if (selectedTypes.includes('classic')) {
    audioStore.setMomentumEnabled(false)
    audioStore.setCallResponseEnabled(false)
    audioStore.setTensionReleaseMode(false)
  }
  
  console.log('Tipos de evolución actualizados:', selectedTypes)
}

const updateMasterVolume = () => {
  audioStore.updateMasterVolume()
}

const regenerateAllLoops = () => {
  audioStore.regenerateAllLoops()
}

// Mapeo de etiquetas amigables para divisiones de delay
const divisionLabelMap = {
  '16n': '1/16 (semicorchea)',
  '8n': '1/8 (corchea)',
  '4n': '1/4 (negra)',
  '2n': '1/2 (blanca)',
  '8t': '1/8t (corchea ternaria)',
  '4t': '1/4t (negra ternaria)',
  '2t': '1/2t (blanca ternaria)',
}

// Funciones para el diálogo de configuración de estilos
const openStyleDialog = () => {
  isStyleDialogOpen.value = true
}

const closeStyleDialog = () => {
  isStyleDialogOpen.value = false
}

// Función para abrir el diálogo de presets
const openPresetDialog = () => {
  presetStore.openDialog()
}

const delayDivisionFriendlyLabel = computed(() => divisionLabelMap[audioStore.delayDivision] || audioStore.delayDivision)
</script>