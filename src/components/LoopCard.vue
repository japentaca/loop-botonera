<template>
  <div :class="['loop-card', { active: loop.isActive }]">
    <div class="loop-main">
      <Button @click="audioStore.toggleLoop(loop.id)" :class="['loop-button', { active: loop.isActive }]"
        :icon="loop.isActive ? 'pi pi-pause' : 'pi pi-play'" :label="`L${loop.id + 1}`" size="large" text
        :disabled="!audioStore.audioInitialized">
        <template #default>
          <i :class="loop.isActive ? 'pi pi-pause' : 'pi pi-play'" class="loop-icon"></i>
          <span class="loop-label">L{{ loop.id + 1 }}</span>
        </template>
      </Button>
      
      <div v-if="loop.isActive" class="beat-display">
        <span class="beat-current">{{ paddedBeatsRemaining }}</span>
        <span class="beat-remaining">left</span>
      </div>
      <div class="beat-indicator">
        <ProgressBar :value="beatProgress" class="beat-progress" :showValue="false" />
      </div>

      <div class="loop-controls">
        <div class="mini-control">
          <span class="mini-label">Tamaño</span>
          <Slider :modelValue="sizeIndex"
            @update:modelValue="audioStore.updateLoopParam(loop.id, 'length', allowedSizes[$event])" :min="0" :max="9"
            :step="1" class="mini-slider" :disabled="!audioStore.audioInitialized" />
          <span class="mini-value">{{ loop.length }}</span>
        </div>

        <div class="mini-control">
          <span class="mini-label">Delay</span>
          <Slider :modelValue="loop.delayAmount * 100"
            @update:modelValue="audioStore.updateLoopParam(loop.id, 'delayAmount', $event / 100)" :min="0" :max="100"
            class="mini-slider" :disabled="!audioStore.audioInitialized" />
          <span class="mini-value">{{ Math.round(loop.delayAmount * 100) }}%</span>
        </div>

        <div class="mini-control">
          <span class="mini-label">Reverb</span>
          <Slider :modelValue="loop.reverbAmount * 100"
            @update:modelValue="audioStore.updateLoopParam(loop.id, 'reverbAmount', $event / 100)" :min="0" :max="100"
            class="mini-slider" :disabled="!audioStore.audioInitialized" />
          <span class="mini-value">{{ Math.round(loop.reverbAmount * 100) }}%</span>
        </div>

        <div class="mini-control">
          <span class="mini-label">Volumen</span>
          <Slider :modelValue="loop.volume * 100"
            @update:modelValue="audioStore.updateLoopParam(loop.id, 'volume', $event / 100)" :min="0" :max="100"
            class="mini-slider" :disabled="!audioStore.audioInitialized" />
          <span class="mini-value">{{ Math.round(loop.volume * 100) }}%</span>
        </div>

        <div class="mini-control">
          <span class="mini-label">Pan</span>
          <Slider :modelValue="loop.pan * 100"
            @update:modelValue="audioStore.updateLoopParam(loop.id, 'pan', $event / 100)" :min="-100" :max="100"
            class="mini-slider" :disabled="!audioStore.audioInitialized" />
          <span class="mini-value">{{ formatPan(loop.pan) }}</span>
        </div>
      </div>
    </div>

    <div class="loop-actions">
      <Button @click="synthStore.openSynthEditor(loop.id)" class="edit-button" icon="pi pi-cog" label="Editar Synth"
        size="small" outlined :disabled="!audioStore.audioInitialized" />
      <Button @click="audioStore.regenerateLoop(loop.id)" class="edit-button" icon="pi pi-refresh"
        label="Regenerar Loop" size="small" outlined :disabled="!audioStore.audioInitialized" />
    </div>

    <div class="synth-type-display">
      {{ loop.synthType || 'Synth' }}
    </div>
  </div>
</template>

<script setup>
  import { computed, onMounted, onUnmounted, onBeforeMount, onBeforeUnmount } from 'vue'
  import { useAudioStore } from '../stores/audioStore'
  import { useSynthStore } from '../stores/synthStore'

  const componentId = Math.random().toString(36).substr(2, 9)

  const audioStore = useAudioStore()
  const synthStore = useSynthStore()

  const props = defineProps({
    loop: {
      type: Object,
      required: true
    }
  })

  // onBeforeUpdate and onUpdated removed to prevent spam during playback
  // These fire constantly because currentPulse updates every 16th note  // Tamaños permitidos para el loop
  const allowedSizes = [4, 8, 12, 16, 32, 48, 64, 128, 256, 512]

  // Índice del tamaño actual basado en la lista permitida
  const sizeIndex = computed(() => {
    const idx = allowedSizes.indexOf(props.loop.length)
    // Si el valor actual no está en la lista, escoger el más cercano
    if (idx === -1) {
      const closest = allowedSizes.reduce((prev, curr) => {
        return Math.abs(curr - props.loop.length) < Math.abs(prev - props.loop.length) ? curr : prev
      })
      return allowedSizes.indexOf(closest)
    }
    return idx
  })

  // Función para formatear el paneo
  const formatPan = (pan) => {
    if (pan === 0) return '0'
    const direction = pan > 0 ? 'D' : 'I'
    const value = Math.abs(Math.round(pan * 100))
    return `${direction}${value}`
  }

  // Current beat being played (1-indexed for display)
  const currentBeat = computed(() => {
    return props.loop.isActive ? (props.loop.currentStep || 0) + 1 : 0
  })

  // Beats remaining in the loop
  const beatsRemaining = computed(() => {
    if (!props.loop.isActive) return 0
    const remaining = props.loop.length - (props.loop.currentStep || 0) - 1
    return Math.max(0, remaining)
  })

  // Padded beats remaining (with leading zeros)
  const paddedBeatsRemaining = computed(() => {
    return String(beatsRemaining.value).padStart(3, '0')
  })

  // Progreso del beat como porcentaje
  const beatProgress = computed(() => {
    if (!props.loop.isActive) return 0
    const step = props.loop.currentStep || 0
    return (step / props.loop.length) * 100
  })
</script>

<style scoped>

  /* Estilo simple para el botón inactivo */
  .loop-button:not(.active) {
    background: var(--primary-color) !important;
    color: white !important;
  }

  /* Estilos para el contenido del botón del loop */
  .loop-button .p-button-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-direction: column;
  }

  .loop-icon {
    font-size: 1.2rem;
    margin-bottom: 0.25rem;
  }

  .loop-label {
    font-weight: bold;
    font-size: 0.9rem;
  }

  .beat-display {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    font-size: 0.8rem;
    margin: 0.5rem 0 0.25rem 0;
    padding: 0.35rem 0.75rem;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 4px;
    color: rgba(255, 255, 255, 0.95);
  }

  .beat-current {
    font-weight: bold;
    font-size: 1rem;
    color: #00ff88;
  }

  .beat-separator {
    opacity: 0.6;
    margin: 0 0.15rem;
  }

  .beat-total {
    opacity: 0.85;
    font-weight: 500;
  }

  .beat-remaining {
    margin-left: 0.35rem;
    opacity: 0.65;
    font-size: 0.75rem;
  }

  /* Ajustar el indicador de beat */
  .beat-indicator {
    width: 100%;
    margin-top: 0.25rem;
  }
</style>