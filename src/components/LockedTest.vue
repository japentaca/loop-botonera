<template>
  <div class="locked-test">
    <h3>🔒 Locked State Test</h3>
    <div class="test-info">
      <p><strong>Loop ID:</strong> {{ loopId }}</p>
      <p><strong>Current generationMode:</strong> {{ currentMode }}</p>
      <p><strong>Is Locked:</strong> <span :class="isLocked ? 'locked' : 'unlocked'">{{ isLocked ? 'LOCKED' : 'UNLOCKED'
          }}</span></p>
      <p><strong>Toggle Result:</strong> {{ toggleResult }}</p>
    </div>
    <div class="test-controls">
      <button @click="testToggle" :disabled="!metadata">Test Toggle</button>
      <button @click="showCurrentState">Show Current State</button>
    </div>
    <div v-if="metadata" class="metadata-display">
      <h4>Current Metadata:</h4>
      <pre>{{ JSON.stringify(metadata, null, 2) }}</pre>
    </div>
  </div>
</template>

<script setup>
  import { computed, ref } from 'vue'

  const props = defineProps({
    loopId: {
      type: Number,
      required: true
    },
    loopMetadata: {
      type: Array,
      required: true
    }
  })

  const metadata = computed(() => props.loopMetadata?.[props.loopId])
  const currentMode = computed(() => metadata.value?.generationMode ?? 'auto')
  const isLocked = computed(() => currentMode.value === 'locked')
  const toggleResult = ref('')

  const testToggle = () => {
    const event = new CustomEvent('update-metadata', {
      detail: {
        loopId: props.loopId,
        updates: {
          generationMode: isLocked.value ? 'auto' : 'locked'
        }
      }
    })
    window.dispatchEvent(event)
    toggleResult.value = `Toggled: ${isLocked.value ? 'locked→auto' : 'auto→locked'}`
  }

  const showCurrentState = () => {
    console.log('🔒 Locked State Debug:', {
      loopId: props.loopId,
      metadata: metadata.value,
      generationMode: currentMode.value,
      isLocked: isLocked.value
    })
  }
</script>

<style scoped>
  .locked-test {
    padding: 1rem;
    border: 1px solid #007acc;
    border-radius: 8px;
    margin: 1rem 0;
    background: rgba(0, 122, 204, 0.05);
  }

  .test-info {
    margin-bottom: 1rem;
  }

  .locked {
    color: #ff6b6b;
    font-weight: bold;
  }

  .unlocked {
    color: #4ecdc4;
    font-weight: bold;
  }

  .test-controls {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .test-controls button {
    padding: 0.5rem 1rem;
    border: 1px solid #007acc;
    background: #007acc;
    color: white;
    border-radius: 4px;
    cursor: pointer;
  }

  .test-controls button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .metadata-display {
    background: #f5f5f5;
    padding: 0.5rem;
    border-radius: 4px;
    font-size: 0.8rem;
  }
</style>