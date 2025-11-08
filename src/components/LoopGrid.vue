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
  console.log('🟢 LOOP_GRID: LoopGrid.vue script setup starting - Instance ID:', componentId);

  const audioStore = useAudioStore()

  onBeforeMount(() => {
    console.log('🟢 LOOP_GRID: onBeforeMount fired - Instance ID:', componentId);
  })

  onMounted(() => {
    console.log('🟢 LOOP_GRID: onMounted fired - Instance ID:', componentId);
  })

  // onBeforeUpdate and onUpdated removed to prevent spam during playback

  onBeforeUnmount(() => {
    console.log('🟢 LOOP_GRID: onBeforeUnmount fired - Instance ID:', componentId);
  })

  onUnmounted(() => {
    console.log('🟢 LOOP_GRID: onUnmounted fired - Instance ID:', componentId);
  })
</script>