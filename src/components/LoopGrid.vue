<template>
  <div class="loop-grid">
    <LoopCard v-for="loop in audioStore.loops" :key="loop.id" :loop="loop" :current-beat="audioStore.currentPulse" />
  </div>
</template>

<script setup>
  import { onMounted, onUnmounted, onBeforeMount, onBeforeUnmount } from 'vue'
  import LoopCard from './LoopCard.vue'
  import { useAudioStore } from '../stores/audioStore'

  const componentId = Math.random().toString(36).substr(2, 9)

  const audioStore = useAudioStore()

  // onBeforeUpdate and onUpdated removed to prevent spam during playback
</script>