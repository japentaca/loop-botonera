<template>
  <div class="matrix-test">
    <h3>Prueba de Matriz de Notas</h3>
    
    <div class="controls">
      <button @click="initializeMatrix" class="btn-primary">
        Inicializar Matriz
      </button>
      
      <button @click="generateRandomLoop" class="btn-secondary">
        Generar Loop Aleatorio
      </button>
      
      <button @click="evolveCurrentLoop" class="btn-accent">
        Evolucionar Loop
      </button>
      
      <button @click="clearMatrix" class="btn-danger">
        Limpiar Matriz
      </button>
    </div>

    <div class="matrix-info">
      <h4>Estado de la Matriz</h4>
      <p>Loops Activos: {{ matrixState.activeLoops.length }}</p>
      <p>Escala Actual: {{ matrixState.currentScale }}</p>
      <p>Nota Base: {{ matrixState.globalBaseNote }}</p>
      <p>Pasos: {{ matrixState.stepCount }}</p>
    </div>

    <div class="loop-display" v-if="currentLoopNotes.length > 0">
      <h4>Loop Actual (ID: {{ currentLoopId }})</h4>
      <div class="notes-grid">
        <div 
          v-for="(note, index) in currentLoopNotes" 
          :key="index"
          class="note-cell"
          :class="{ 'has-note': note !== null }"
          @click="toggleNote(index)"
        >
          {{ note || '-' }}
        </div>
      </div>
    </div>

    <div class="evolution-controls">
      <h4>Controles de Evolución</h4>
      <select v-model="selectedStrategy">
        <option value="conservative">Conservador</option>
        <option value="balanced">Balanceado</option>
        <option value="aggressive">Agresivo</option>
        <option value="experimental">Experimental</option>
      </select>
      
      <button @click="evolveWithStrategy" class="btn-accent">
        Evolucionar con Estrategia
      </button>
    </div>

    <div class="stats" v-if="matrixStats">
      <h4>Estadísticas</h4>
      <p>Total de Notas: {{ matrixStats.totalNotes }}</p>
      <p>Loops con Notas: {{ matrixStats.loopsWithNotes }}</p>
      <p>Densidad Promedio: {{ matrixStats.averageDensity?.toFixed(2) }}%</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAudioStore } from '../stores/audioStore'

const audioStore = useAudioStore()
const currentLoopId = ref(0)
const selectedStrategy = ref('balanced')

// Estados reactivos de la matriz
const matrixState = computed(() => audioStore.matrixState)
const matrixStats = computed(() => audioStore.getMatrixStats())
const currentLoopNotes = computed(() => audioStore.getLoopNotes(currentLoopId.value) || [])

// Funciones de control
const initializeMatrix = () => {
  audioStore.initializeMatrix()
}

const generateRandomLoop = () => {
  audioStore.activateLoop(currentLoopId.value, {
    length: 16,
    instrument: 'synth',
    scale: 'major'
  })
  
  audioStore.generateRandomNotes(currentLoopId.value, 0.3) // 30% de densidad
}

const evolveCurrentLoop = () => {
  const result = audioStore.evolveMatrixLoop(currentLoopId.value, audioStore)
}

const evolveWithStrategy = () => {
  const activeLoops = matrixState.value.activeLoops
  if (activeLoops.length === 0) {
    return
  }
  
  const result = audioStore.evolveMatrixWithStrategy(activeLoops, audioStore, selectedStrategy.value)
}

const clearMatrix = () => {
  audioStore.clearMatrix()
}

const toggleNote = (stepIndex) => {
  const currentNote = currentLoopNotes.value[stepIndex]
  
  if (currentNote !== null) {
    audioStore.clearLoopNote(currentLoopId.value, stepIndex)
  } else {
    // Agregar una nota aleatoria
    const randomNote = Math.floor(Math.random() * 88) + 21 // C1 a C8
    audioStore.setLoopNote(currentLoopId.value, stepIndex, randomNote)
  }
}

onMounted(() => {
  initializeMatrix()
})
</script>

<style scoped>
.matrix-test {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.controls {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.btn-primary, .btn-secondary, .btn-accent, .btn-danger {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-accent {
  background: #28a745;
  color: white;
}

.btn-danger {
  background: #dc3545;
  color: white;
}

.matrix-info, .stats, .evolution-controls {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.loop-display {
  background: #e9ecef;
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.notes-grid {
  display: grid;
  grid-template-columns: repeat(16, 1fr);
  gap: 4px;
  margin-top: 10px;
}

.note-cell {
  background: #fff;
  border: 2px solid #dee2e6;
  padding: 8px 4px;
  text-align: center;
  cursor: pointer;
  border-radius: 4px;
  font-size: 12px;
  min-height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.note-cell.has-note {
  background: #007bff;
  color: white;
  border-color: #0056b3;
}

.note-cell:hover {
  border-color: #007bff;
}

.evolution-controls select {
  padding: 8px;
  margin-right: 10px;
  border: 1px solid #ced4da;
  border-radius: 4px;
}

h3, h4 {
  color: #495057;
  margin-bottom: 15px;
}

p {
  margin: 5px 0;
  color: #6c757d;
}
</style>