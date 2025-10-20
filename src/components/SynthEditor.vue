<template>
  <Dialog 
    :visible="synthStore.isModalOpen" 
    modal 
    :header="`Editor de Sintetizador - Loop ${synthStore.currentLoopId || 'N/A'}`"
    :style="{ width: '90vw', maxWidth: '600px' }"
    :closable="true"
    @hide="synthStore.closeSynthEditor"
    class="synth-editor-dialog"
  >
    <div class="synth-controls">
      <!-- Selector de Tipo de Sintetizador -->
      <div class="control-section">
        <h4>Tipo de Sintetizador</h4>
        <Dropdown 
          :modelValue="synthStore.tempSynthConfig.synthType" 
          @update:modelValue="synthStore.updateSynthType"
          :options="synthTypeOptions"
          optionLabel="label"
          optionValue="value"
          class="w-full"
        />
        <p class="help-text">{{ synthStore.getSynthTypeDescription(synthStore.tempSynthConfig.synthType) }}</p>
      </div>

      <!-- Tipo de Oscilador -->
      <div class="control-section">
        <h4>Oscilador</h4>
        <div class="oscillator-buttons">
          <Button 
            v-for="opt in synthStore.oscillatorTypes" 
            :key="opt.value"
            @click="synthStore.updateOscillatorType(opt.value)"
            :label="opt.label"
            :severity="synthStore.tempSynthConfig.oscillatorType === opt.value ? 'info' : 'secondary'"
            :outlined="synthStore.tempSynthConfig.oscillatorType !== opt.value"
            size="small"
            class="osc-btn"
          />
        </div>
      </div>

      <!-- Envelope ADSR -->
      <div class="control-section">
        <h4>Envolvente ADSR</h4>
        <div class="envelope-controls">
          <div class="envelope-param">
            <label>Ataque</label>
            <div class="slider-container">
              <Slider 
                :min="0.01" 
                :max="2" 
                :step="0.01"
                :modelValue="synthStore.tempSynthConfig.envelope.attack"
                @update:modelValue="(value) => synthStore.updateEnvelopeParam('attack', value)"
                class="flex-1"
              />
              <span class="value-display">{{ synthStore.tempSynthConfig.envelope.attack }}s</span>
            </div>
          </div>
          
          <div class="envelope-param">
            <label>Decaimiento</label>
            <div class="slider-container">
              <Slider 
                :min="0.01" 
                :max="2" 
                :step="0.01"
                :modelValue="synthStore.tempSynthConfig.envelope.decay"
                @update:modelValue="(value) => synthStore.updateEnvelopeParam('decay', value)"
                class="flex-1"
              />
              <span class="value-display">{{ synthStore.tempSynthConfig.envelope.decay }}s</span>
            </div>
          </div>
          
          <div class="envelope-param">
            <label>Sostenimiento</label>
            <div class="slider-container">
              <Slider 
                :min="0" 
                :max="1" 
                :step="0.01"
                :modelValue="synthStore.tempSynthConfig.envelope.sustain"
                @update:modelValue="(value) => synthStore.updateEnvelopeParam('sustain', value)"
                class="flex-1"
              />
              <span class="value-display">{{ synthStore.tempSynthConfig.envelope.sustain }}</span>
            </div>
          </div>
          
          <div class="envelope-param">
            <label>Liberación</label>
            <div class="slider-container">
              <Slider 
                :min="0.01" 
                :max="3" 
                :step="0.01"
                :modelValue="synthStore.tempSynthConfig.envelope.release"
                @update:modelValue="(value) => synthStore.updateEnvelopeParam('release', value)"
                class="flex-1"
              />
              <span class="value-display">{{ synthStore.tempSynthConfig.envelope.release }}s</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Modulación (para FM/AM) -->
      <div class="control-section" v-if="synthStore.tempSynthConfig.synthType === 'AMSynth' || synthStore.tempSynthConfig.synthType === 'FMSynth'">
        <h4>Modulación</h4>
        <div class="modulation-controls">
          <div class="mod-param">
            <label>Armonicidad</label>
            <div class="slider-container">
              <Slider 
                :min="0.1" 
                :max="10" 
                :step="0.1"
                :modelValue="synthStore.tempSynthConfig.harmonicity"
                @update:modelValue="synthStore.updateHarmonicity"
                class="flex-1"
              />
              <span class="value-display">{{ synthStore.tempSynthConfig.harmonicity }}</span>
            </div>
          </div>
          
          <div class="mod-param" v-if="synthStore.tempSynthConfig.synthType === 'FMSynth'">
            <label>Índice de Modulación</label>
            <div class="slider-container">
              <Slider 
                :min="0" 
                :max="100" 
                :step="1"
                :modelValue="synthStore.tempSynthConfig.modulationIndex"
                @update:modelValue="synthStore.updateModulationIndex"
                class="flex-1"
              />
              <span class="value-display">{{ synthStore.tempSynthConfig.modulationIndex }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <Button 
        @click="synthStore.closeSynthEditor" 
        label="OK"
        icon="pi pi-check"
        class="p-button-success"
      />
    </template>
  </Dialog>
</template>

<script setup>
import { useSynthStore } from '../stores/synthStore'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Dropdown from 'primevue/dropdown'
import Slider from 'primevue/slider'

const synthStore = useSynthStore()

// Opciones para el dropdown de tipos de sintetizador
const synthTypeOptions = [
  { label: 'PolySynth', value: 'PolySynth' },
  { label: 'AMSynth', value: 'AMSynth' },
  { label: 'FMSynth', value: 'FMSynth' }
]
</script>

<style scoped>
.synth-editor-dialog {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.synth-controls {
  padding: 1rem 0;
}

.control-section {
  margin-bottom: 2rem;
}

.control-section h4 {
  margin: 0 0 1rem 0;
  color: #333;
  font-size: 1.1rem;
  font-weight: 600;
}

.help-text {
  margin: 0.5rem 0 0 0;
  font-size: 0.85rem;
  color: #666;
  font-style: italic;
}

.oscillator-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.osc-btn {
  min-width: 80px;
}

.envelope-controls,
.modulation-controls {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.envelope-param,
.mod-param {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.envelope-param label,
.mod-param label {
  font-weight: 500;
  color: #555;
  font-size: 0.9rem;
}

.slider-container {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.value-display {
  min-width: 60px;
  text-align: right;
  font-weight: 500;
  color: #333;
  font-size: 0.9rem;
}

.flex-1 {
  flex: 1;
}

.w-full {
  width: 100%;
}

/* Responsive design */
@media (min-width: 768px) {
  .envelope-controls,
  .modulation-controls {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }
  
  .oscillator-buttons {
    justify-content: flex-start;
  }
}

@media (min-width: 1024px) {
  .envelope-controls {
    grid-template-columns: repeat(4, 1fr);
  }
}
</style>