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
            :value="audioStore.masterVolume"
            @input="audioStore.updateMasterVolume($event.target.value)"
            class="range-compact"
          />
          <span class="value-compact">{{ audioStore.masterVolume }}%</span>
        </div>
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
          <label class="control-label-compact">Transpose</label>
          <input 
            type="range" 
            min="-12" 
            max="12" 
            :value="audioStore.transpose"
            @input="audioStore.updateTranspose($event.target.value)"
            class="range-compact"
          />
          <span class="value-compact">{{ audioStore.transpose > 0 ? '+' : '' }}{{ audioStore.transpose }}</span>
        </div>

        <div class="control-group-compact">
          <label class="control-label-compact">Escala</label>
          <div class="scale-control-wrapper">
            <select 
              :value="audioStore.currentScale" 
              @change="onScaleChange($event.target.value)"
              class="select-compact"
            >
              <option v-for="scaleKey in scaleKeys" :key="scaleKey" :value="scaleKey">
                {{ scaleNamesSpanish[scaleKey] }}
              </option>
            </select>
            <button 
              @click="toggleScaleLock"
              :class="['scale-lock-button', { locked: audioStore.scaleLocked }]"
              :title="audioStore.scaleLocked ? 'Desbloquear escala' : 'Bloquear escala'"
            >
              {{ audioStore.scaleLocked ? '🔒' : '🔓' }}
            </button>
          </div>
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
      
      <!-- Controles de energía sonora -->
      <div class="energy-controls">
        <div class="control-group-compact">
          <label class="control-label-compact">
            <input 
              type="checkbox" 
              :checked="audioStore.energyManagementEnabled"
              @change="updateEnergyManagement($event.target.checked)"
              class="checkbox-compact"
            />
            Gestión Energía
          </label>
        </div>
        
        <div class="control-group-compact" v-if="audioStore.energyManagementEnabled">
          <label class="control-label-compact">Límite</label>
          <input 
            type="range" 
            min="1" 
            max="8" 
            step="0.5"
            :value="audioStore.maxSonicEnergy"
            @input="updateMaxSonicEnergy($event.target.value)"
            class="range-compact"
          />
          <span class="value-compact">{{ audioStore.maxSonicEnergy.toFixed(1) }}</span>
        </div>
        
        <div class="control-group-compact" v-if="audioStore.energyManagementEnabled">
          <label class="control-label-compact">Reducción</label>
          <input 
            type="range" 
            min="0.3" 
            max="1.0" 
            step="0.1"
            :value="audioStore.energyReductionFactor"
            @input="updateEnergyReductionFactor($event.target.value)"
            class="range-compact"
          />
          <span class="value-compact">{{ Math.round(audioStore.energyReductionFactor * 100) }}%</span>
        </div>
      </div>
      
      <div class="evolution-controls-compact">
        <!-- MultiSelector para estilos creativos - movido al lado izquierdo -->
        <div class="control-group-compact evolution-styles">
          <MultiSelector
            v-model="selectedEvolutionTypes"
            :options="evolutionOptions"
            label="Estilos Creativos"
            placeholder="Seleccionar estilos..."
            :max-selections="3"
            @update:modelValue="onEvolutionTypesChange"
          />
        </div>
        
        <button 
          @click="toggleAutoEvolve" 
          :class="['evolve-button-compact', { active: audioStore.autoEvolve }]"
        >
          {{ audioStore.autoEvolve ? '⏸' : '▶' }} Auto
        </button>
        
        <div class="control-group-compact">
          <label class="control-label-compact">Intervalo</label>
          <input 
            type="range" 
            min="4" 
            max="32" 
            step="4"
            :value="audioStore.evolveInterval"
            @input="onEvolveIntervalChange($event.target.value)"
            class="range-compact"
          />
          <span class="value-compact">{{ audioStore.evolveInterval }}</span>
        </div>
        
        <div class="control-group-compact">
          <label class="control-label-compact">Intensidad</label>
          <input 
            type="range" 
            min="1" 
            max="3" 
            step="1"
            :value="audioStore.evolveIntensity"
            @input="onEvolveIntensityChange($event.target.value)"
            class="range-compact"
          />
          <span class="value-compact">{{ audioStore.evolveIntensity }}</span>
        </div>
        
        <div class="evolve-progress-compact" v-if="audioStore.autoEvolve">
          <div class="progress-bar-compact">
            <div class="progress-fill-compact" :style="{ width: evolveProgress + '%' }"></div>
          </div>
          <span class="next-evolve">{{ nextEvolveInMeasures }}c</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { useAudioStore } from '../stores/audioStore'
import { useScales } from '../composables/useMusic'
import MultiSelector from './MultiSelector.vue'

const audioStore = useAudioStore()
const { scales, scaleNames, scaleNamesSpanish } = useScales()

// Obtener las claves de las escalas para el selector
const scaleKeys = Object.keys(scales)

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

// Mantener sincronizado tempTempo con cambios externos
watch(() => audioStore.tempo, (newTempo) => {
  tempTempo.value = newTempo
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

const toggleScaleLock = () => {
  audioStore.toggleScaleLock()
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

// Funciones wrapper para gestión de energía sónica
const updateEnergyManagement = (value) => {
  audioStore.updateEnergyManagement(value)
}

const updateMaxSonicEnergy = (value) => {
  audioStore.updateMaxSonicEnergy(parseFloat(value))
}

const updateEnergyReductionFactor = (value) => {
  audioStore.updateEnergyReductionFactor(parseFloat(value))
}

const delayDivisionFriendlyLabel = computed(() => divisionLabelMap[audioStore.delayDivision] || audioStore.delayDivision)
</script>