<template>
  <div id="app">
    <!-- Audio Start Overlay -->
    <div v-if="!audioStore.audioInitialized" class="audio-start-overlay">
      <div class="audio-start-card">
        <h2>🎵 Loop Synth Machine</h2>
        <p>Click the button below to initialize the audio engine</p>
        <button @click="initializeAudio" class="start-audio-button" :disabled="isInitializing">
          {{ isInitializing ? 'Initializing...' : '🔊 Start Audio' }}
        </button>
        <p class="audio-note">
          <small>WebAudio requires user interaction to start</small>
        </p>
      </div>
    </div>

    <!-- Main App (disabled until audio is ready) -->
    <div :class="['main-app', { disabled: !audioStore.audioInitialized }]">
      <AppHeader />
      <main class="container">
        <LoopGrid />
      </main>
      <SynthEditor />
    </div>
  </div>
</template>

<script setup>
  import { onMounted, ref } from 'vue'
  import AppHeader from './components/AppHeader.vue'
  import LoopGrid from './components/LoopGrid.vue'
  import SynthEditor from './components/SynthEditor.vue'
  import { useAudioStore } from './stores/audioStore'
  import { usePresetStore } from './stores/presetStore'

  const componentId = Math.random().toString(36).substr(2, 9)

  const audioStore = useAudioStore()
  const presetStore = usePresetStore()
  const isInitializing = ref(false)

  // Initialize audio only when user clicks the start button
  const initializeAudio = async () => {
    if (isInitializing.value) {
      return
    }

    isInitializing.value = true

    try {
      // Step 1: Initialize only Tone.js audio engine
      await audioStore.initAudio()

      // Step 2: Initialize preset system (load/create default preset)
      await presetStore.initialize()

      // Step 3: Initialize music components after preset is loaded
      await audioStore.initMusicComponents()

      // Step 4: Retry loading the current preset now that loops are initialized
      await presetStore.retryLoadCurrentPreset()

    } catch (error) {
      console.error('🔴 APP: Error during initialization:', error)
    } finally {
      isInitializing.value = false
    }
  }


</script>

<style>
  @import './style.css';

  /* Audio Start Overlay */
  .audio-start-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    color: white;
  }

  .audio-start-card {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 20px;
    padding: 3rem;
    text-align: center;
    max-width: 400px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  }

  .audio-start-card h2 {
    margin-bottom: 1rem;
    font-size: 2rem;
    background: linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1);
    background-size: 300% 300%;
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: gradient 3s ease infinite;
  }

  @keyframes gradient {
    0% {
      background-position: 0% 50%;
    }

    50% {
      background-position: 100% 50%;
    }

    100% {
      background-position: 0% 50%;
    }
  }

  .audio-start-card p {
    margin-bottom: 2rem;
    font-size: 1.1rem;
    opacity: 0.9;
  }

  .start-audio-button {
    background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
    border: none;
    color: white;
    font-size: 1.3rem;
    font-weight: bold;
    padding: 1rem 2rem;
    border-radius: 50px;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(255, 107, 107, 0.3);
    min-width: 200px;
  }

  .start-audio-button:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(255, 107, 107, 0.4);
  }

  .start-audio-button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
  }

  .audio-note {
    margin-top: 1rem;
    font-size: 0.9rem;
    opacity: 0.7;
  }

  /* Main app disabled state */
  .main-app.disabled {
    pointer-events: none;
    opacity: 0.5;
    filter: grayscale(50%);
  }

  .main-app {
    transition: all 0.3s ease;
  }
</style>