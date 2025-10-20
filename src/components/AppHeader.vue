<template>
  <div class="header-compact">
    <!-- Fila superior: Título y controles principales -->
    <div class="header-row-main">
      <div class="title-compact">🎹 LOOP SYNTH MACHINE 🎹</div>
      
      <div class="main-controls">
        <button 
          @click="togglePlay" 
          :class="['play-button-compact', { playing: audioStore.isPlaying }]"
        >
          {{ audioStore.isPlaying ? '⏸' : '▶' }}
        </button>
        
        <button 
          @click="regenerateAllLoops" 
          class="regen-button-compact"
        >
          🔄 Regenerar
        </button>
        
        <div class="control-group-compact">
          <label class="control-label-compact">Tempo</label>
          <input 
            type="range" 
            min="10" 
            max="180" 
            :value="tempTempo"
            @input="onTempoInput($event.target.value)"
            class="range-compact"
          />
          <span class="value-compact">{{ tempTempo }}</span>
        </div>
        
        <div class="control-group-compact">
          <label class="control-label-compact">Vol</label>
          <input 
            type="range" 
            min="0" 
            max="100" 
            :value="tempMasterVolume"
            @input="onMasterVolumeInput($event.target.value)"
            class="range-compact"
          />
          <span class="value-compact">{{ tempMasterVolume }}%</span>
        </div>
        
        <button 
          @click="audioStore.applySparseDistribution" 
          class="sparse-button"
          title="Distribuir canales activos en el panorama estéreo"
        >
          Sparse
        </button>
        
        <button 
          @click="openPresetDialog"
          class="preset-button-compact"
          title="Gestionar presets"
        >
          💾 Presets
        </button>
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
          <select 
            :value="audioStore.currentScale" 
            @change="onScaleChange($event.target.value)"
            class="select-compact"
          >
            <option v-for="scaleKey in scaleKeys" :key="scaleKey" :value="scaleKey">
              {{ scaleNamesSpanish[scaleKey] }}
            </option>
          </select>
        </div>

        <div class="control-group-compact">
          <label class="control-label-compact">Delay</label>
          <select 
            :value="audioStore.delayDivision" 
            @change="audioStore.updateDelayDivision($event.target.value)" 
            class="select-compact"
          >
            <optgroup label="Binarias">
              <option value="16n">1/16</option>
              <option value="8n">1/8</option>
              <option value="4n">1/4</option>
              <option value="2n">1/2</option>
            </optgroup>
            <optgroup label="Trinarias">
              <option value="8t">1/8t</option>
              <option value="4t">1/4t</option>
              <option value="2t">1/2t</option>
            </optgroup>
          </select>
        </div>
      </div>
      

      
      <div class="evolution-controls-compact">
        <button 
          @click="toggleAutoEvolve" 
          :class="['evolve-button-compact', { active: audioStore.autoEvolve }]"
        >
          {{ audioStore.autoEvolve ? '⏸' : '▶' }} Auto
        </button>
        
        <button 
          @click="openStyleDialog"
          class="style-config-button-compact"
          title="Configurar estilos de evolución"
        >
          ⚙️ Estilos
        </button>
        
        <div class="evolve-progress-compact" v-if="audioStore.autoEvolve">
          <div class="progress-bar-compact">
            <div class="progress-fill-compact" :style="{ width: evolveProgress + '%' }"></div>
          </div>
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

const onEvolveIntervalChange = (value) => {
  audioStore.updateEvolveInterval(Number(value))
}

const onEvolveIntensityChange = (value) => {
  audioStore.updateEvolveIntensity(Number(value))
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