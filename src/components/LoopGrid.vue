<template>
  <div class="loop-grid">
    <LoopCard 
      v-for="loop in audioStore.loops" 
      :key="loop.id"
      :loop="loop"
      :current-beat="audioStore.currentPulse"
    />
  </div>
</template>

<script setup>
import LoopCard from './LoopCard.vue'
import { useAudioStore } from '../stores/audioStore'

const audioStore = useAudioStore()
</script>