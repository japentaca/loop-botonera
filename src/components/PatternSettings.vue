<template>
  <div v-if="metadata" class="pattern-settings" :class="{ 'pattern-locked': isLocked }">
    <div class="settings-header">
      <h4>Pattern Settings</h4>
      <div class="lock-toggle">
        <label class="toggle-label">
          <input type="checkbox" :checked="isLocked" @change="toggleLock" />
          <span class="toggle-slider"></span>
          <span>{{ isLocked ? 'Pattern Locked' : 'Pattern Unlocked' }}</span>
        </label>
      </div>
    </div>

    <div class="pattern-probabilities">
      <div class="probability-control">
        <span class="control-label">Euclidean</span>
        <Slider :modelValue="patternProbabilities.euclidean * 100"
          @update:modelValue="updateProbability('euclidean', $event / 100)" :min="0" :max="100" :step="1"
          class="probability-slider" />
        <span class="probability-value">{{ Math.round(patternProbabilities.euclidean * 100) }}%</span>
      </div>

      <div class="probability-control">
        <span class="control-label">Scale</span>
        <Slider :modelValue="patternProbabilities.scale * 100"
          @update:modelValue="updateProbability('scale', $event / 100)" :min="0" :max="100" :step="1"
          class="probability-slider" />
        <span class="probability-value">{{ Math.round(patternProbabilities.scale * 100) }}%</span>
      </div>

      <div class="probability-control">
        <span class="control-label">Random</span>
        <Slider :modelValue="patternProbabilities.random * 100"
          @update:modelValue="updateProbability('random', $event / 100)" :min="0" :max="100" :step="1"
          class="probability-slider" />
        <span class="probability-value">{{ Math.round(patternProbabilities.random * 100) }}%</span>
      </div>
    </div>

    <div class="note-range-controls">
      <div class="range-control">
        <span class="control-label">Note Range</span>
        <Slider v-model="noteRange" range :min="24" :max="96" :step="1" class="probability-slider" />
        <span class="note-display">{{ midiToNoteName(noteRange[0]) }}–{{ midiToNoteName(noteRange[1]) }}</span>
      </div>
    </div>

    <div class="density-controls">
      <div class="density-mode-toggle">
        <label class="toggle-label">
          <input type="checkbox" :checked="densityMode === 'auto'" @change="toggleDensityMode" />
          <span class="toggle-slider"></span>
          <span>{{ densityMode === 'auto' ? 'Densidad Auto' : 'Densidad Manual' }}</span>
        </label>
      </div>

      <div v-if="densityMode === 'manual'" class="density-slider">
        <span class="control-label">Densidad</span>
        <Slider :modelValue="manualDensityPercent" @update:modelValue="onManualDensityChange($event)" :min="0" :max="100" :step="1" class="probability-slider" />
        <span class="probability-value">{{ manualDensityPercent }}%</span>
      </div>

      <div class="effective-density">
        <span class="control-label">Densidad efectiva</span>
        <span class="probability-value">{{ effectiveDensityPercent }}%</span>
      </div>
    </div>

    <div class="current-pattern-display" v-if="lastPattern">
      <span class="pattern-label">Last Pattern:</span>
      <span class="pattern-type" :class="`pattern-${lastPattern}`">{{ lastPattern }}</span>
    </div>
  </div>
</template>

<script setup>
  import { ref, computed, watch } from 'vue'
  import Slider from 'primevue/slider'

  // Props
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

  // Emits
  const emit = defineEmits(['update-metadata'])

  // Computed properties
  const metadata = computed(() => props.loopMetadata?.[props.loopId])

  // Local reactive state for immediate UI updates
  const localProbabilities = ref({ euclidean: 0.3, scale: 0.3, random: 0.4 })

  // Sync local state with metadata
  watch(() => metadata.value?.patternProbabilities, (newProbs) => {
    if (newProbs) {
      localProbabilities.value = { ...newProbs }
    }
  }, { immediate: true })

  const patternProbabilities = computed(() => localProbabilities.value)
  const noteRange = computed({
    get: () => [metadata.value?.noteRangeMin ?? 24, metadata.value?.noteRangeMax ?? 96],
    set: ([min, max]) => {
      emit('update-metadata', {
        loopId: props.loopId,
        updates: { noteRangeMin: min, noteRangeMax: max }
      })
    }
  })
  const generationMode = computed(() => metadata.value?.generationMode ?? 'auto')
  const lastPattern = computed(() => metadata.value?.lastPattern ?? null)

  const isLocked = computed(() => generationMode.value === 'locked')

  const densityMode = computed(() => metadata.value?.densityMode ?? 'auto')
  const manualDensityPercent = computed(() => Math.round(((metadata.value?.manualDensity ?? 0.3) * 100)))
  const effectiveDensityPercent = computed(() => {
    const mode = metadata.value?.densityMode === 'manual' ? 'manual' : 'auto'
    const val = mode === 'manual' ? (metadata.value?.manualDensity ?? 0.3) : (metadata.value?.autoDensity ?? 0.3)
    const n = typeof val === 'number' && isFinite(val) ? Math.max(0, Math.min(1, val)) : 0.3
    return Math.round(n * 100)
  })
  const updateProbability = (patternType, value) => {
    const newProbabilities = { ...localProbabilities.value }
    newProbabilities[patternType] = value

    // Normalize to ensure they sum to 1.0
    const total = Object.values(newProbabilities).reduce((sum, p) => sum + p, 0)
    if (total > 0) {
      Object.keys(newProbabilities).forEach(key => {
        newProbabilities[key] = newProbabilities[key] / total
      })
    }

    // Update local state immediately for UI responsiveness
    localProbabilities.value = newProbabilities

    emit('update-metadata', {
      loopId: props.loopId,
      updates: { patternProbabilities: newProbabilities }
    })
  }

  // Removed min/max input handlers; range slider updates both values via noteRange

  const toggleLock = () => {
    const newMode = isLocked.value ? 'auto' : 'locked'
    emit('update-metadata', {
      loopId: props.loopId,
      updates: { generationMode: newMode }
    })
  }

  const toggleDensityMode = () => {
    const newMode = densityMode.value === 'auto' ? 'manual' : 'auto'
    emit('update-metadata', { loopId: props.loopId, updates: { densityMode: newMode } })
  }

  const onManualDensityChange = (value) => {
    const v = Math.max(0, Math.min(100, Number(value)))
    emit('update-metadata', { loopId: props.loopId, updates: { manualDensity: v / 100 } })
  }

  const midiToNoteName = (midiNote) => {
    if (midiNote == null) return '--'
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    const octave = Math.floor(midiNote / 12) - 1
    const noteIndex = midiNote % 12
    return `${noteNames[noteIndex]}${octave}`
  }
</script>

<style scoped>
  .pattern-settings {
    padding: 1rem;
    background: var(--surface-section);
    border-radius: 8px;
    border: 1px solid var(--surface-border);
    transition: all 0.3s ease;
  }

  .pattern-settings.pattern-locked {
    border-color: rgba(255, 107, 53, 0.5);
    box-shadow: 0 0 20px rgba(255, 107, 53, 0.15);
    background: linear-gradient(135deg, rgba(255, 107, 53, 0.05), transparent);
  }

  .settings-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .settings-header h4 {
    margin: 0;
    color: var(--text-color);
    font-size: 1.2rem;
    font-weight: 700;
  }

  .density-controls {
    margin-top: 1rem;
    display: grid;
    gap: 0.75rem;
  }

  .density-mode-toggle {
    display: flex;
    justify-content: flex-start;
  }

  .density-slider {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 0.5rem;
  }

  .effective-density {
    display: grid;
    grid-template-columns: auto auto;
    align-items: center;
    gap: 0.5rem;
  }

  .lock-toggle {
    display: flex;
    align-items: center;
  }

  .toggle-label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    user-select: none;
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    transition: all 0.3s ease;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .toggle-label:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .toggle-label input[type="checkbox"] {
    display: none;
  }

  .toggle-slider {
    position: relative;
    width: 50px;
    height: 24px;
    background: var(--surface-300);
    border-radius: 12px;
    transition: all 0.3s ease;
    border: 2px solid rgba(255, 255, 255, 0.2);
  }

  .toggle-slider::before {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    background: white;
    border-radius: 50%;
    transition: all 0.3s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .toggle-label input:checked+.toggle-slider {
    background: linear-gradient(135deg, #ff6b35, #ff8c00);
    border-color: #ff6b35;
    box-shadow: 0 0 15px rgba(255, 107, 53, 0.4);
  }

  .toggle-label input:checked+.toggle-slider::before {
    transform: translateX(26px);
    background: #fff;
  }

  .toggle-label input:checked~span:last-child {
    color: #ff8c00;
    font-weight: 700;
  }

  /* Add lock icon indicator */
  .toggle-label span:last-child {
    position: relative;
    padding-left: 1.5rem;
  }

  .toggle-label span:last-child::before {
    content: '🔓';
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    font-size: 1rem;
    transition: all 0.3s ease;
  }

  .toggle-label input:checked+span+span:last-child::before {
    content: '🔒';
    color: #ff8c00;
  }

  .pattern-probabilities {
    margin-bottom: 1rem;
  }

  .probability-control {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .control-label {
    min-width: 70px;
    font-size: 0.9rem;
    color: var(--text-color-secondary);
  }

  .probability-slider {
    flex: 1;
  }

  .probability-value {
    min-width: 35px;
    text-align: right;
    font-size: 0.9rem;
    color: var(--text-color);
  }

  .note-range-controls {
    margin-bottom: 1rem;
  }

  .range-control {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .range-input {
    width: 80px;
  }

  .range-input-field {
    width: 100%;
    text-align: center;
  }

  .note-display {
    min-width: 35px;
    font-size: 0.9rem;
    color: var(--text-color-secondary);
  }

  .current-pattern-display {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    background: var(--surface-100);
    border-radius: 4px;
  }

  .pattern-label {
    font-size: 0.9rem;
    color: var(--text-color-secondary);
  }

  .pattern-type {
    font-weight: bold;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.8rem;
    text-transform: uppercase;
  }

  .pattern-euclidean {
    background: var(--blue-100);
    color: var(--blue-800);
  }

  .pattern-scale {
    background: var(--green-100);
    color: var(--green-800);
  }

  .pattern-random {
    background: var(--orange-100);
    color: var(--orange-800);
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .pattern-settings {
      padding: 0.75rem;
    }

    .probability-control,
    .range-control {
      flex-direction: column;
      align-items: stretch;
      gap: 0.25rem;
    }

    .control-label {
      text-align: center;
    }

    .probability-value,
    .note-display {
      text-align: center;
    }
  }
</style>
