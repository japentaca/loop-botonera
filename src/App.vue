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

console.log('🔵 APP: App.vue script setup starting');
console.log('🔵 APP: Current time:', new Date().toISOString());

const audioStore = useAudioStore()
const presetStore = usePresetStore()

console.log('🔵 APP: Stores initialized - audioStore:', !!audioStore, 'presetStore:', !!presetStore);

onMounted(async () => {
  console.log('🔵 APP: onMounted lifecycle hook fired');
  console.log('🔵 APP: Starting async initialization sequence');
  
  // Inicializar audio cuando la aplicación se monta
  console.log('🔵 APP: Initializing audio store...');
  try {
    await audioStore.initAudio()
    console.log('🔵 APP: Audio store initialized successfully');
  } catch (error) {
    console.error('🔴 APP: Error inicializando audio:', error)
  }
  
  // Inicializar el sistema de presets
  console.log('🔵 APP: Initializing preset store...');
  try {
    console.log('🔵 APP: About to call presetStore.initialize()');
    await presetStore.initialize()
    console.log('🔵 APP: Preset store initialized successfully');
    console.log('🔵 APP: Post-initialization state:');
    console.log('🔵 APP: - presets count:', presetStore.presetsCount);
    console.log('🔵 APP: - current preset:', JSON.stringify(presetStore.currentPreset));
    console.log('🔵 APP: - is loading:', presetStore.isLoading);
    console.log('🔵 APP: - is dialog open:', presetStore.isDialogOpen);
  } catch (error) {
    console.error('🔴 APP: Error inicializando sistema de presets:', error)
    console.error('🔴 APP: Error details:', error.message)
    console.error('🔴 APP: Error stack:', error.stack)
  }
  
  console.log('🔵 APP: All async initialization complete');
})
</script>

<style>
@import './style.css';
</style>