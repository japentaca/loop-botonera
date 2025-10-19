<template>
  <div class="header">
    <div class="title">🎹 LOOP SYNTH MACHINE 🎹</div>
    
    <div class="master-controls">
      <!-- Control de Play/Pause -->
      <button 
        @click="audioStore.togglePlay" 
        :class="['play-button', { playing: audioStore.isPlaying }]"
      >
        {{ audioStore.isPlaying ? '⏸' : '▶' }}
      </button>
      
      <!-- Botón Regenerate All -->
      <button 
        @click="audioStore.regenerateAllLoops" 
        class="regen-button"
      >
        🔄 Regenerar Todos
      </button>
      
      <!-- Control de Tempo -->
      <div class="control-group">
        <label class="control-label">Tempo (BPM)</label>
        <input 
          type="range" 
          min="10" 
          max="180" 
          :value="tempTempo"
          @input="onTempoInput($event.target.value)"
        />
        <div class="value-display">{{ tempTempo }} BPM</div>
      </div>
      
      <!-- Control de Transpose -->
      <div class="control-group">
        <label class="control-label">Transposición</label>
        <input 
          type="range" 
          min="-12" 
          max="12" 
          :value="audioStore.transpose"
          @input="audioStore.updateTranspose($event.target.value)"
        />
        <div class="value-display">{{ audioStore.transpose > 0 ? '+' : '' }}{{ audioStore.transpose }} ST</div>
      </div>

      <!-- Selector de Escala -->
      <div class="control-group">
        <label class="control-label">Escala</label>
        <select 
          :value="audioStore.currentScale" 
          @change="onScaleChange($event.target.value)"
          class="scale-select"
        >
          <option v-for="scaleKey in scaleKeys" :key="scaleKey" :value="scaleKey">
            {{ scaleNamesSpanish[scaleKey] }}
          </option>
        </select>

      </div>
      
      <!-- Control de Master Volume -->
      <div class="control-group">
        <label class="control-label">Master Volume</label>
        <input 
          type="range" 
          min="0" 
          max="100" 
          :value="audioStore.masterVolume"
          @input="audioStore.updateMasterVolume($event.target.value)"
        />
        <div class="value-display">{{ audioStore.masterVolume }}%</div>
      </div>

      <!-- Tap Division del Delay -->
      <div class="control-group">
        <label class="control-label">Delay</label>
        <select :value="audioStore.delayDivision" @change="audioStore.updateDelayDivision($event.target.value)">
          <optgroup label="Binarias">
            <option value="16n">1/16 (semicorchea)</option>
            <option value="8n">1/8 (corchea)</option>
            <option value="4n">1/4 (negra)</option>
            <option value="2n">1/2 (blanca)</option>
          </optgroup>
          <optgroup label="Trinarias">
            <option value="8t">1/8t (corchea ternaria)</option>
            <option value="4t">1/4t (negra ternaria)</option>
            <option value="2t">1/2t (blanca ternaria)</option>
          </optgroup>
        </select>

      </div>


    </div>
    
    <!-- Visualizador de pulsos -->
    <div class="pulse-viz">
      <div 
        v-for="i in 16" 
        :key="i" 
        :class="['pulse-dot', { active: audioStore.currentBeat === i - 1 }]"
      ></div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { useAudioStore } from '../stores/audioStore'
import { useScales } from '../composables/useMusic'

const audioStore = useAudioStore()
const { scales, scaleNames, scaleNamesSpanish } = useScales()

// Obtener las claves de las escalas para el selector
const scaleKeys = Object.keys(scales)

// Estado temporal para el tempo
const tempTempo = ref(audioStore.tempo)
let tempoTimer = null

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

const updateMasterVolume = () => {
  audioStore.updateMasterVolume()
}

const regenerateAllLoops = () => {
  audioStore.regenerateAllLoops()
}

// Manejar cambio de escala
const onScaleChange = (newScale) => {
  audioStore.updateScale(newScale)
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

const delayDivisionFriendlyLabel = computed(() => divisionLabelMap[audioStore.delayDivision] || audioStore.delayDivision)
</script>