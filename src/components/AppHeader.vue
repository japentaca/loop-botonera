<template>
  <div class="header-compact full-viewport" ref="headerEl">
    <!-- Fila superior: Título y controles principales -->
    <div class="header-row-main">
      <div class="main-controls-left">
        <!-- Playback and general controls -->
        <div class="play-wrapper">
          <Button @click="togglePlay"
            :class="['play-button-compact', 'header-btn-compact', { playing: audioStore.isPlaying }]" size="small"
            :title="audioStore.isPlaying ? 'Pausa' : (audioStore.audioInitialized ? 'Play' : 'Click to initialize audio')">{{ audioStore.isPlaying ? '⏸️' : '▶️' }}</Button>
          <span :class="['audio-status', audioStore.audioInitialized ? 'ready' : 'not-ready']" title="Audio initialization state">
            <span class="audio-icon" aria-hidden="true">{{ audioStore.audioInitialized ? '🔊' : '🔇' }}</span>
            <span class="audio-label">{{ audioStore.audioInitialized ? 'Audio ready' : 'Click Play to initialize audio' }}</span>
          </span>
        </div>

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

      <!-- A centered title makes the grid layout balanced and keeps controls aligned -->
      <h1 class="title-compact" role="heading" aria-level="1">Loop Botonera</h1>

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
          <Button class="help-button" icon="pi pi-question" size="small" severity="help" @click="toggleHelp" title="Quick help" />
        </div>

        <!-- Visualizador de pulsos integrado (moved to right section) -->
        <div class="pulse-viz-compact">
          <div :class="['pulse-light', { flash: audioStore.beatFlash }]"></div>
        </div>
      </div>
    </div>
    <div v-if="showHelp" class="header-help-inline">
      <small>Quick help: Use Play to start audio. To use Tonal cycles: choose scope (Global/Group/Loop), set Interval (beats), optionally enable "Snap to measure", and click Start. Check table below to monitor active cycles and action them.</small>
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
        <!-- Tonal cycles controls -->
        <div class="tonal-cycles-controls">
          <div class="control-group-compact">
            <label class="control-label-compact">Cycles</label>
            <Dropdown v-model="cycleScope" :options="cycleScopeOptions" optionLabel="label" optionValue="value" class="select-compact" @update:modelValue="onCycleScopeChange" />
            <Dropdown v-model="cycleStrategy" :options="cycleStrategyOptions" optionLabel="label" optionValue="value" class="select-compact" @update:modelValue="(v) => cycleStrategy = v" />
          </div>

          <div class="control-group-compact">
            <label class="control-label-compact">Target</label>
            <select v-if="cycleScope === 'group'" v-model="cycleGroupId" class="select-compact">
              <option value="">-- Select group --</option>
              <option v-for="g in voiceGroups" :key="g.id" :value="g.id">{{ g.id }} ({{ g.members.length }} loops)
              </option>
            </select>
            <input v-if="cycleScope === 'loop'" v-model.number="cycleLoopId" type="number" placeholder="loopId"
              class="input-compact" min="0" />
          </div>

          <div class="control-group-compact">
            <label class="control-label-compact">Active Cycle</label>
            <select v-model="selectedCycleId" class="select-compact">
              <option value="">-- Select active cycle --</option>
              <option v-for="id in cycleIds" :key="id" :value="id">{{ id }}</option>
            </select>
            <Button @click="rescanCycles" label="Rescan" size="small" class="header-btn-compact" />
            <div v-if="selectedCycleNext !== null" class="cycle-countdown" style="display:inline-block;margin-left:8px;">{{ formatNext(selectedCycleNext) }}</div>
          </div>

          <div class="control-group-compact">
            <label class="control-label-compact">Interval (beats)</label>
            <Slider v-model="cycleIntervalBeats" :min="1" :max="64" class="range-compact range-compact--small" />
            <span class="value-compact">{{ cycleIntervalBeats }} beats</span>
          </div>
          <div class="control-group-compact">
            <label class="control-label-compact"><input type="checkbox" v-model="cycleSnapToMeasure" /> Snap to measure</label>
            <small class="control-description">Start the cycle aligned to the next measure</small>
          </div>

          <div class="control-group-compact">
            <template v-if="existingMatchingCycle">
              <Button @click="startCycle" label="Update" size="small" class="header-btn-compact" title="Update existing cycle: change strategy/interval/snapToMeasure" />
              <Button @click="startCycle" label="Start New" size="small" class="header-btn-compact" :disabled="!allowMultipleCycles" title="Start a new cycle even when matching one exists (Allow multiple)" />
            </template>
            <template v-else>
              <Button @click="startCycle" label="Start" size="small" class="header-btn-compact" title="Start a new cycle" />
            </template>
            <Button @click="stopCycle" label="Stop" size="small" class="header-btn-compact" />
            <Button @click="stepCycle" label="Step" size="small" class="header-btn-compact" />
            <Button @click="pauseCycleUI" label="Pause" size="small" class="header-btn-compact" />
            <Button @click="resumeCycleUI" label="Resume" size="small" class="header-btn-compact" />
          </div>

          <div class="control-group-compact">
            <div class="active-cycles-compact">Active: <span v-for="c in cycleIds" :key="c">{{ c }} </span></div>
            <label class="allow-multiple-toggle"><input type="checkbox" v-model="allowMultipleCycles" /> Allow
              multiple</label>
            <Button @click="showCyclesPanel = !showCyclesPanel" :class="['header-btn-compact']" icon="pi pi-list" size="small" :label="showCyclesPanel ? 'Close cycles' : 'Open cycles'" />
          </div>
          <!-- moved active cycles table outside of the per-control grid to avoid overlap -->
          <div class="control-group-compact">
            <small class="control-description">Timing is measured in beats (quarter notes). Adjust tempo for BPM, or
              increase the interval for longer windows.</small>
          </div>
          <!-- Tonal cycles table: moved to overlay controlled by `showCyclesPanel` -->
          <teleport to="body">
            <div v-if="showCyclesPanel" class="cycles-overlay" role="dialog" aria-label="Active cycles panel">
              <div class="cycles-overlay-inner">
              <div class="overlay-header">
                <strong>Active Cycles</strong>
                <Button @click="showCyclesPanel = false" class="header-btn-compact" icon="pi pi-times" size="small" title="Close" />
              </div>
              <div class="active-cycles-detailed">
                <table class="cycles-table">
                <thead><tr><th>ID</th><th>Scope</th><th>Strategy</th><th>Interval</th><th>Status</th><th>Next</th><th>Actions</th></tr></thead>
                <tbody>
                  <tr v-for="c in activeCycleDetails" :key="c.id">
                    <td>{{ c.id }}</td>
                    <td>{{ c.scope }}</td>
                    <td>{{ c.strategy }}</td>
                    <td>{{ c.intervalBeats }} beats</td>
                    <td>
                      <span class="status-pill" :class="c.status">{{ c.status }}</span>
                    </td>
                    <td>
                      <div v-if="c.nextInBeats !== null" class="progress-bar" :title="formatNext(c.nextInBeats)">
                        <div class="progress-bar-inner" :style="{ width: (100 - (c.nextInBeats / (c.intervalBeats || 1) * 100)).toFixed(1) + '%' }"></div>
                      </div>
                      <div class="next-text">{{ formatNext(c.nextInBeats) }} <small v-if="c.nextPulse">(nextPulse: {{ c.nextPulse }})</small></div>
                    </td>
                    <td>
                      <Button @click="selectCycle(c.id)" icon="pi pi-check" size="small" title="Select cycle" />
                      <Button @click="stopSelected(c.id)" icon="pi pi-times" size="small" severity="danger" title="Stop and remove" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
              </div>
            </div>
          </teleport>
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
  import { useNotesMatrix } from '../composables/useNotesMatrix.js'
  import StyleConfigDialog from './StyleConfigDialog.vue'
  import PresetManagerDialog from './PresetManagerDialog.vue'

  const componentId = Math.random().toString(36).substr(2, 9)

  const audioStore = useAudioStore()
  const presetStore = usePresetStore()
  const { scales, scaleNames, scaleNamesSpanish } = useScales()
  const notesMatrix = useNotesMatrix()
  const voiceGroups = computed(() => notesMatrix.getAllVoiceGroups())

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
  const showHelp = ref(false)

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

  const toggleHelp = () => { showHelp.value = !showHelp.value }

  // Función para loggear la matriz de notas
  const logNotesMatrix = () => {
    if (audioStore.logNotesMatrix) {
      audioStore.logNotesMatrix()
    } else {
      console.warn('logNotesMatrix not available on audioStore')
    }
  }

  const delayDivisionFriendlyLabel = computed(() => divisionLabelMap[audioStore.delayDivision] || audioStore.delayDivision)

  // Header ref and dynamic offset for overlay
  const headerEl = ref(null)
  const setHeaderOffset = () => {
    try {
      const el = headerEl.value || document.querySelector('.header-compact')
      if (!el) return
      const h = el.getBoundingClientRect().height || 0
      document.documentElement.style.setProperty('--header-height', `${Math.round(h)}px`)
    } catch (e) {
      // ignore
    }
  }

  // Tonal cycles UI state
  const cycleScope = ref('global')
  const cycleGroupId = ref('')
  const cycleLoopId = ref(0)
  const cycleIntervalBeats = ref(4)
  const cycleStrategy = ref('rotateMode')
  const cycleIds = computed(() => (audioStore.activeTonalCycles || []).map(c => c.id))
  const selectedCycleId = ref(null)
  const allowMultipleCycles = ref(false)
  const showCyclesPanel = ref(false)

  const existingMatchingCycle = computed(() => {
    const cycles = audioStore.activeTonalCycles || []
    const scope = cycleScope.value || 'global'
    const loopId = cycleScope.value === 'loop' ? Number(cycleLoopId.value) : null
    const groupId = cycleScope.value === 'group' ? cycleGroupId.value : null
    return cycles.find(c => {
      const cfg = c.config || {}
      const sameScope = cfg.scope === scope
      const sameLoop = (cfg.loopId == null && loopId == null) || cfg.loopId === loopId
      const sameGroup = (cfg.groupId == null && groupId == null) || cfg.groupId === groupId
      // Match only by scope + target so Start works as Update for changed properties
      return sameScope && sameLoop && sameGroup
    })
  })

  const cycleSnapToMeasure = ref(false)

  // UI tick removed; countdowns use transport pulses instead of MS time
  onMounted(() => {
    // Compute header offset and update CSS var for overlays
    setHeaderOffset()
    window.addEventListener('resize', setHeaderOffset)
  })
  onUnmounted(() => {
    window.removeEventListener('resize', setHeaderOffset)
  })

  const cycleScopeOptions = [
    { label: 'Global', value: 'global' },
    { label: 'Group', value: 'group' },
    { label: 'Loop', value: 'loop' }
  ]
  const cycleStrategyOptions = [
    { label: 'Rotate Mode', value: 'rotateMode' },
    { label: 'Shift Key', value: 'shiftKey' }
  ]

  const onCycleScopeChange = (val) => {
    cycleScope.value = val
  }

  const startCycle = () => {
    const cfg = { scope: cycleScope.value, intervalBeats: cycleIntervalBeats.value, strategy: cycleStrategy.value, snapToMeasure: !!cycleSnapToMeasure.value, allowMultiple: !!allowMultipleCycles.value }
    if (cycleScope.value === 'group') cfg.groupId = cycleGroupId.value
    if (cycleScope.value === 'loop') cfg.loopId = cycleLoopId.value
    const handle = audioStore.startTonalCycle(cfg)
    if (handle && handle.id) {
      // selectedCycleId is set to the newly created cycle; active cycles list is reactive
      selectedCycleId.value = handle.id
    }
  }

  const activeCycleDetails = computed(() => {
    const cycles = audioStore.activeTonalCycles || []
    const currentPulse = Number(audioStore.currentPulse?.value || audioStore.currentPulse || 0)
    return cycles.map(c => {
      const cfg = c.config || {}
      const status = c.paused ? 'paused' : (c.waiting ? 'waiting' : 'running')
      const intervalPulses = cfg.intervalPulses || ((cfg.intervalBeats || 4) * 4)
      const nextPulse = c.nextPulse || null
      let nextInPulses = null
      if (nextPulse != null) {
        nextInPulses = Math.max(0, nextPulse - currentPulse)
      }
      const nextInBeats = nextInPulses != null ? (nextInPulses / 4) : null
      return {
        id: c.id,
        scope: cfg.scope,
        strategy: cfg.strategy,
        intervalBeats: cfg.intervalBeats || 4,
        intervalPulses: intervalPulses,
        status,
        waiting: !!c.waiting,
        lastStepTime: c.lastStepTime || null,
        nextInPulses,
        nextPulse,
        nextInBeats
      }
    })
  })

  const selectedCycleNext = computed(() => {
    const cycles = activeCycleDetails.value || []
    const selected = cycles.find(c => c.id === selectedCycleId.value)
    if (!selected) return null
    return selected.nextInBeats
  })

  const stopCycle = () => {
    if (!selectedCycleId.value) return
    const id = selectedCycleId.value
    audioStore.stopTonalCycle(id)
    // active cycles list updates automatically via store subscription
    selectedCycleId.value = null
  }

  const stepCycle = () => {
    if (!selectedCycleId.value) return
    audioStore.stepTonalCycle(selectedCycleId.value)
  }

  const pauseCycleUI = () => {
    if (!selectedCycleId.value) return
    audioStore.pauseTonalCycle(selectedCycleId.value)
  }

  const resumeCycleUI = () => {
    if (!selectedCycleId.value) return
    audioStore.resumeTonalCycle(selectedCycleId.value)
  }

  const selectCycle = (id) => {
    selectedCycleId.value = id
  }

  const stopSelected = (id) => {
    audioStore.stopTonalCycle(id)
    if (selectedCycleId.value === id) selectedCycleId.value = null
  }

  const formatNext = (beats) => {
    if (beats == null) return '—'
    if (beats >= 1) {
      return `${beats.toFixed(1)} beats`
    }
    // Beats < 1: show pulses as a fraction (quarter beats)
    const pulses = Math.round(beats * 4)
    return `${pulses} pulses`
  }

  // Cycle interval is expressed in beats; no ms conversion is needed for UI

  const rescanCycles = () => {
    // Force a scan of existing cycles and ensure selected cycle remains valid
    const info = audioStore.listTonalCycles() || []
    if (!selectedCycleId.value && info.length > 0) selectedCycleId.value = info[0].id
    // If selected cycle id is no longer available, reset to first
    if (selectedCycleId.value && !info.find(c => c.id === selectedCycleId.value)) {
      selectedCycleId.value = info.length > 0 ? info[0].id : null
    }
  }
  onMounted(() => {
    // If cycles exist, set a default selected id
    if (!selectedCycleId.value && cycleIds.value.length > 0) selectedCycleId.value = cycleIds.value[0]
  })
</script>
