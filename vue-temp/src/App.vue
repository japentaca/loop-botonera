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

const audioStore = useAudioStore()

onMounted(() => {
  // Inicializar audio cuando la aplicación se monta
})
</script>

<style>
@import './style.css';
</style>