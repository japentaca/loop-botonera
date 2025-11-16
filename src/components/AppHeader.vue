<template>
  <div class="header-compact">
    <!-- Fila superior: Título y controles principales -->
    <div class="header-row-main">
      <div class="main-controls-left">
        <!-- Playback and general controls -->
        <Button @click="togglePlay"
          :class="['play-button-compact', 'header-btn-compact', { playing: audioStore.isPlaying }]" size="small"
          :title="audioStore.isPlaying ? 'Pausa' : 'Play'" :disabled="!audioStore.audioInitialized">
          {{ audioStore.isPlaying ? '⏸️' : '▶️' }}
        </Button>

        <Button @click="generateAllPatterns" class="regen-button-compact header-btn-compact" icon="pi pi-refresh"
          label="Regenerar" size="small" />

        <Button @click="resetSync" class="sync-button-compact header-btn-compact" icon="pi pi-sync" label="Sincronizar"
          size="small" title="Resetear contador para re-sincronizar los loops"
          :disabled="!audioStore.audioInitialized" />

        <Button @click="audioStore.applySparseDistribution" class="sparse-button header-btn-compact" label="Sparse"
          size="small" severity="secondary" title="Distribuir canales activos en el panorama estéreo"
          :disabled="!audioStore.audioInitialized" />

        <Button @click="logNotesMatrix" class="debug-button header-btn-compact" icon="pi pi-list" size="small"
          severity="help" title="Log notes matrix to console" :disabled="!audioStore.audioInitialized" />
      </div>



      <div class="main-controls-right">
        <!-- main-controls-right only contains the sliders and presets/pulse -->

        <!-- the sliders are above; duplicates removed -->

        <div class="control-group-compact control-group-compact--slider">
          <label class="control-label-compact">Tempo</label>
          <Slider v-model="tempTempo" :min="10" :max="180" @change="onTempoInput(tempTempo)"
            class="range-compact range-compact--large" :disabled="!audioStore.audioInitialized" />
          <span class="value-compact">{{ tempTempo }}</span>
        </div>

        <div class="control-group-compact control-group-compact--slider">
          <label class="control-label-compact">Vol</label>
          <Slider v-model="tempMasterVolume" :min="0" :max="100" @change="onMasterVolumeInput(tempMasterVolume)"
            class="range-compact range-compact--large" :disabled="!audioStore.audioInitialized" />
          <span class="value-compact">{{ tempMasterVolume }}%</span>
        </div>

        <div class="control-group-compact">
          <label class="control-label-compact">Densidad</label>
          <Slider v-model="tempGlobalDensityBias" :min="0" :max="100"
            @change="onGlobalDensityBiasInput(tempGlobalDensityBias)" class="range-compact"
            :disabled="!audioStore.audioInitialized" />
          <span class="value-compact">{{ tempGlobalDensityBias }}%</span>
        </div>

        <div class="preset-control-group">
          <Button @click="openPresetDialog" class="preset-button-compact header-btn-compact" icon="pi pi-save"
            label="Presets" size="small" title="Gestionar presets" :disabled="!audioStore.audioInitialized" />
          <span class="preset-name-label">{{ presetStore.currentPreset?.name || 'Sin preset' }}</span>
        </div>

        <!-- Visualizador de pulsos integrado (moved to right section) -->
        <div class="pulse-viz-compact">
          <div :class="['pulse-light', { flash: audioStore.beatFlash }]"></div>
        </div>
      </div>
    </div>

    <!-- Fila inferior: Controles de música y evolución -->
    <div class="header-row-secondary">
      <div class="music-controls">
        <div class="control-group-compact">
          <label class="control-label-compact">Escala</label>
          <Dropdown :modelValue="audioStore.currentScale" @update:modelValue="onScaleChange" :options="scaleOptions"
            optionLabel="label" optionValue="value" class="select-compact" :disabled="!audioStore.audioInitialized" />
        </div>

        <div class="control-group-compact">
          <label class="control-label-compact">Delay</label>
          <Dropdown :modelValue="audioStore.delayDivision" @update:modelValue="audioStore.updateDelayDivision"
            :options="delayOptions" optionLabel="label" optionValue="value" class="select-compact"
            :disabled="!audioStore.audioInitialized" />
        </div>
      </div>

      <div class="evolution-controls-compact">
        <Button @click="toggleAutoEvolve" :class="['evolve-button-compact', { active: audioStore.autoEvolve }]"
          :icon="audioStore.autoEvolve ? 'pi pi-pause' : 'pi pi-play'" label="Auto" size="small"
          :severity="audioStore.autoEvolve ? 'success' : 'secondary'" :disabled="!audioStore.audioInitialized" />

        <Button @click="openStyleDialog" class="style-config-button-compact" icon="pi pi-cog" label="Estilos"
          size="small" title="Configurar estilos de evolución" :disabled="!audioStore.audioInitialized" />

        <div class="evolve-progress-compact" v-if="audioStore.autoEvolve">
          <span class="next-evolve">{{ nextEvolveInBeats }}</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Diálogo de configuración de estilos -->
  <StyleConfigDialog :is-open="isStyleDialogOpen" @close="closeStyleDialog" />

  <!-- Diálogo de gestión de presets -->
  <PresetManagerDialog />
</template>

<script setup>
  import { ref, watch, computed, onMounted, onUnmounted, onBeforeMount, onBeforeUnmount } from 'vue'
  import { useAudioStore } from '../stores/audioStore'
  import { usePresetStore } from '../stores/presetStore'
  import { useScales } from '../composables/useMusic'
  import StyleConfigDialog from './StyleConfigDialog.vue'
  import PresetManagerDialog from './PresetManagerDialog.vue'

  const componentId = Math.random().toString(36).substr(2, 9)

  const audioStore = useAudioStore()
  const presetStore = usePresetStore()
  const { scales, scaleNames, scaleNamesSpanish } = useScales()

  // onBeforeUpdate and onUpdated removed to prevent spam during playback
  // These fire constantly because evolveProgress and other computed props update with currentPulse  // Obtener las claves de las escalas para el selector
  const scaleKeys = Object.keys(scales)

  // Opciones para el dropdown de escalas
  const scaleOptions = scaleKeys.map(key => ({
    label: scaleNamesSpanish[key],
    value: key
  })).sort((a, b) => a.label.localeCompare(b.label))

  // Opciones para el dropdown de delay
  const delayOptions = [
    { label: '1/16 (semicorchea)', value: '16n' },
    { label: '1/8 (corchea)', value: '8n' },
    { label: '1/4 (negra)', value: '4n' },
    { label: '1/2 (blanca)', value: '2n' },
    { label: '1/8t (corchea ternaria)', value: '8t' },
    { label: '1/4t (negra ternaria)', value: '4t' },
    { label: '1/2t (blanca ternaria)', value: '2t' }
  ]

  // Estado para el diálogo de configuración de estilos
  const isStyleDialogOpen = ref(false)

  // Configuración del multiselector de evolución
  // Evolution types simplified: momentum, call/response, and tension/release disabled

  // Estado temporal para el tempo
  const tempTempo = ref(audioStore.tempo)

  // Estado temporal para el volumen maestro
  const tempMasterVolume = ref(audioStore.masterVolume || 70)

  const tempGlobalDensityBias = ref(Math.round((audioStore.globalDensityBias || 0.5) * 100))

  const nextEvolveInBeats = computed(() => {
    if (!audioStore.autoEvolve) return 0
    const remainingPulses = audioStore.nextEvolveMeasure - audioStore.currentPulse
    const remainingBeats = Math.ceil(remainingPulses / 4) // 4 pulses per beat in 4/4 time

    // Si el valor calculado es 0 o negativo, significa que estamos en el momento de evolución
    // o justo después. En este caso, mostrar el intervalo completo en beats.
    if (remainingBeats <= 0) {
      return audioStore.evolveInterval * 4
    }

    return remainingBeats
  })

  const onTempoInput = (value) => {
    const v = Number(value)
    tempTempo.value = v
    audioStore.updateTempo(v)
  }

  const onMasterVolumeInput = (value) => {
    const v = Number(value)
    tempMasterVolume.value = v
    audioStore.updateMasterVolume(v)
  }

  const onGlobalDensityBiasInput = (value) => {
    const v = Math.max(0, Math.min(100, Number(value)))
    tempGlobalDensityBias.value = v
    audioStore.updateGlobalDensityBias(v / 100)
  }

  // Mantener sincronizado tempTempo con cambios externos
  watch(() => audioStore.tempo, (newTempo) => {
    tempTempo.value = newTempo
  })

  // Mantener sincronizado tempMasterVolume con cambios externos
  watch(() => audioStore.masterVolume, (newVolume) => {
    tempMasterVolume.value = newVolume
  })

  watch(() => audioStore.globalDensityBias, (newBias) => {
    tempGlobalDensityBias.value = Math.round((newBias || 0) * 100)
  })

  // Métodos
  const togglePlay = async () => {
    await audioStore.togglePlay()
  }

  const toggleAutoEvolve = () => {
    if (audioStore.autoEvolve) {
      audioStore.stopAutoEvolve()
    } else {
      audioStore.startAutoEvolve()
    }
  }

  const onScaleChange = (scale) => {
    audioStore.updateScale(scale)
  }

  // Manejar cambios en el multiselector de evolución
  // Evolution options removed - no extra handling required

  const updateMasterVolume = () => {
    audioStore.updateMasterVolume()
  }

  const generateAllPatterns = () => {
    audioStore.generateAllPatterns()
  }

  const resetSync = () => {
    audioStore.resetLoopCounters()
  }

  // Mapeo de etiquetas amigables para divisiones de delay
  const divisionLabelMap = {
    '16n': '1/16 (semicorchea)',
    '8n': '1/8 (corchea)',
    '4n': '1/4 (negra)',
    '2n': '1/2 (blanca)',
    '8t': '1/8t (corchea ternaria)',
    '4t': '1/4t (negra ternaria)',
    '2t': '1/2t (blanca ternaria)',
  }

  // Funciones para el diálogo de configuración de estilos
  const openStyleDialog = () => {
    isStyleDialogOpen.value = true
  }

  const closeStyleDialog = () => {
    isStyleDialogOpen.value = false
  }

  // Función para abrir el diálogo de presets
  const openPresetDialog = () => {
    presetStore.openDialog()
  }

  // Función para loggear la matriz de notas
  const logNotesMatrix = () => {
    if (audioStore.logNotesMatrix) {
      audioStore.logNotesMatrix()
    } else {
      console.warn('logNotesMatrix not available on audioStore')
    }
  }

  const delayDivisionFriendlyLabel = computed(() => divisionLabelMap[audioStore.delayDivision] || audioStore.delayDivision)
</script>
