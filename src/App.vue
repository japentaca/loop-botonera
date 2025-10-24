<template>
  <div id="app">
    <AppHeader />
    <main class="container">
      <LoopGrid />
      <!-- Componente de prueba temporal para la matriz de notas -->
      <MatrixTest />
    </main>
    <SynthEditor />
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import AppHeader from './components/AppHeader.vue'
import LoopGrid from './components/LoopGrid.vue'
import SynthEditor from './components/SynthEditor.vue'
import MatrixTest from './components/MatrixTest.vue'
import { useAudioStore } from './stores/audioStore'
import { usePresetStore } from './stores/presetStore'

const audioStore = useAudioStore()
const presetStore = usePresetStore()

onMounted(async () => {
  // Inicializar audio cuando la aplicación se monta
  try {
    await audioStore.initAudio()
  } catch (error) {
    console.error('Error inicializando audio:', error)
  }
  
  // Inicializar el sistema de presets
  try {
    await presetStore.initialize()
  } catch (error) {
    console.error('Error inicializando sistema de presets:', error)
  }
})
</script>

<style>
@import './style.css';
</style>