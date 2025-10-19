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
          :value="audioStore.tempo"
          @input="audioStore.updateTempo($event.target.value)"
        />
        <div class="value-display">{{ audioStore.tempo }} BPM</div>
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
import { useAudioStore } from '../stores/audioStore'

const audioStore = useAudioStore()

// Métodos
const togglePlay = async () => {
  await audioStore.togglePlay()
}

const updateTempo = () => {
  audioStore.updateTempo()
}

const updateMasterVolume = () => {
  audioStore.updateMasterVolume()
}

const regenerateAllLoops = () => {
  audioStore.regenerateAllLoops()
}
</script>