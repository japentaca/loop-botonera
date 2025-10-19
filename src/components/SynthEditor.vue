<template>
  <div v-if="synthStore.isModalOpen" class="modal-overlay">
    <div class="modal-content">
      <div class="modal-header">
        <h3>Editor de Sintetizador - Loop {{ synthStore.currentLoopId || 'N/A' }}</h3>
        <button @click="synthStore.closeSynthEditor" class="close-btn">&times;</button>
      </div>
      
      <div class="synth-controls">
        <!-- Selector de Tipo de Sintetizador -->
        <div class="control-section">
          <h4>Tipo de Sintetizador</h4>
          <select class="scale-select" :value="synthStore.tempSynthConfig.synthType" @change="synthStore.updateSynthType($event.target.value)">
            <option value="PolySynth">PolySynth</option>
            <option value="AMSynth">AMSynth</option>
            <option value="FMSynth">FMSynth</option>
          </select>
          <p class="help-text">{{ synthStore.getSynthTypeDescription(synthStore.tempSynthConfig.synthType) }}</p>
        </div>

        <!-- Tipo de Oscilador -->
        <div class="control-section">
          <h4>Oscilador</h4>
          <div class="oscillator-buttons">
            <button 
              v-for="opt in synthStore.oscillatorTypes" 
              :key="opt.value"
              @click="synthStore.updateOscillatorType(opt.value)"
              :class="['osc-btn', { active: synthStore.tempSynthConfig.oscillatorType === opt.value }]"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <!-- Envelope ADSR -->
        <div class="control-section">
          <h4>Envolvente ADSR</h4>
          <div class="envelope-controls">
            <div class="envelope-param">
              <label>Ataque</label>
              <input 
                type="range" 
                min="0.01" 
                max="2" 
                step="0.01"
                :value="synthStore.tempSynthConfig.envelope.attack"
                @input="synthStore.updateEnvelopeParam('attack', $event.target.value)"
              />
              <span>{{ synthStore.tempSynthConfig.envelope.attack }}s</span>
            </div>
            
            <div class="envelope-param">
              <label>Decaimiento</label>
              <input 
                type="range" 
                min="0.01" 
                max="2" 
                step="0.01"
                :value="synthStore.tempSynthConfig.envelope.decay"
                @input="synthStore.updateEnvelopeParam('decay', $event.target.value)"
              />
              <span>{{ synthStore.tempSynthConfig.envelope.decay }}s</span>
            </div>
            
            <div class="envelope-param">
              <label>Sostenimiento</label>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.01"
                :value="synthStore.tempSynthConfig.envelope.sustain"
                @input="synthStore.updateEnvelopeParam('sustain', $event.target.value)"
              />
              <span>{{ synthStore.tempSynthConfig.envelope.sustain }}</span>
            </div>
            
            <div class="envelope-param">
              <label>Liberación</label>
              <input 
                type="range" 
                min="0.01" 
                max="3" 
                step="0.01"
                :value="synthStore.tempSynthConfig.envelope.release"
                @input="synthStore.updateEnvelopeParam('release', $event.target.value)"
              />
              <span>{{ synthStore.tempSynthConfig.envelope.release }}s</span>
            </div>
          </div>
        </div>

        <!-- Modulación (para FM/AM) -->
        <div class="control-section" v-if="synthStore.tempSynthConfig.synthType === 'AMSynth' || synthStore.tempSynthConfig.synthType === 'FMSynth'">
          <h4>Modulación</h4>
          <div class="modulation-controls">
            <div class="mod-param">
              <label>Armonicidad</label>
              <input 
                type="range" 
                min="0.1" 
                max="10" 
                step="0.1"
                :value="synthStore.tempSynthConfig.harmonicity"
                @input="synthStore.updateHarmonicity($event.target.value)"
              />
              <span>{{ synthStore.tempSynthConfig.harmonicity }}</span>
            </div>
            
            <div class="mod-param" v-if="synthStore.tempSynthConfig.synthType === 'FMSynth'">
              <label>Índice de Modulación</label>
              <input 
                type="range" 
                min="0" 
                max="100" 
                step="1"
                :value="synthStore.tempSynthConfig.modulationIndex"
                @input="synthStore.updateModulationIndex($event.target.value)"
              />
              <span>{{ synthStore.tempSynthConfig.modulationIndex }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button @click="synthStore.closeSynthEditor" class="cancel-btn">OK</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useSynthStore } from '../stores/synthStore'

const synthStore = useSynthStore()

const updateOscillatorType = (type) => {
  synthStore.updateOscillatorType(type)
}

const updateEnvelope = (param, value) => {
  synthStore.updateEnvelopeParam(param, parseFloat(value))
}

const updateHarmonicity = (value) => {
  synthStore.updateHarmonicity(parseFloat(value))
}

const updateModulationIndex = (value) => {
  synthStore.updateModulationIndex(parseFloat(value))
}

const previewSynth = () => {
  synthStore.previewSynth()
}

const applySynth = () => {
  synthStore.applySynthConfig()
}

const closeModal = () => {
  synthStore.closeSynthEditor()
}
</script>