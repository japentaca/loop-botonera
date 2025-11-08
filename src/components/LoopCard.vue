<template>
  <div :class="['loop-card', { active: loop.isActive }]">
    <div class="loop-main">
      <Button @click="audioStore.toggleLoop(loop.id)" :class="['loop-button', { active: loop.isActive }]"
        :icon="loop.isActive ? 'pi pi-pause' : 'pi pi-play'" :label="`L${loop.id + 1}`" size="large" text
        :disabled="!audioStore.audioInitialized">
        <template #default>
          <i :class="loop.isActive ? 'pi pi-pause' : 'pi pi-play'" class="loop-icon"></i>
          <span class="loop-label">L{{ loop.id + 1 }}</span>
          <div class="beat-indicator">
            <ProgressBar :value="beatProgress" class="beat-progress" :showValue="false" />
          </div>
        </template>
      </Button>

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
  console.log('🟣 LOOP_CARD: LoopCard.vue script setup starting - Instance ID:', componentId);

  const audioStore = useAudioStore()
  const synthStore = useSynthStore()

  const props = defineProps({
    loop: {
      type: Object,
      required: true
    }
  })

  onBeforeMount(() => {
    console.log('🟣 LOOP_CARD: onBeforeMount fired - Instance ID:', componentId, 'Loop ID:', props.loop?.id);
  })

  onMounted(() => {
    console.log('🟣 LOOP_CARD: onMounted fired - Instance ID:', componentId, 'Loop ID:', props.loop?.id);
  })

  // onBeforeUpdate and onUpdated removed to prevent spam during playback
  // These fire constantly because currentPulse updates every 16th note

  onBeforeUnmount(() => {
    console.log('🟣 LOOP_CARD: onBeforeUnmount fired - Instance ID:', componentId, 'Loop ID:', props.loop?.id);
  })

  onUnmounted(() => {
    console.log('🟣 LOOP_CARD: onUnmounted fired - Instance ID:', componentId, 'Loop ID:', props.loop?.id);
  })  // Tamaños permitidos para el loop
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

  // Progreso del beat (simulado por ahora)
  const beatProgress = computed(() => {
    // Aquí se podría implementar la lógica real del progreso del beat
    // Por ahora retornamos un valor fijo
    return props.loop.isActive ? 50 : 0
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

  /* Ajustar el indicador de beat */
  .beat-indicator {
    width: 100%;
    margin-top: 0.25rem;
  }
</style>