<template>
  <div id="app">
    <AppHeader />
    <main class="container">
      <LoopGrid />
    </main>
    <SynthEditor />
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import AppHeader from './components/AppHeader.vue'
import LoopGrid from './components/LoopGrid.vue'
import SynthEditor from './components/SynthEditor.vue'
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
    console.log('Sistema de presets inicializado correctamente')
  } catch (error) {
    console.error('Error inicializando sistema de presets:', error)
  }
})
</script>

<style>
@import './style.css';
</style>