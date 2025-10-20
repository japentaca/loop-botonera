# Guía de Stores: Audio, Presets y Synth

Este documento detalla responsabilidades, estado y acciones de los stores principales para facilitar modificaciones seguras.

## audioStore (src/stores/audioStore.js)
Orquesta el motor de audio y los módulos especializados.

- Estado clave:
  - `tempo`, `masterVol`/`masterVolume`, `delayDivision`, `currentPulse`, `isPlaying`.
  - `currentScale`, `scaleLocked`, `recentScales`.
  - Auto-evolución: `autoEvolve`, `evolveInterval`, `evolveIntensity`, `measuresSinceEvolve`, `nextEvolveMeasure`, `evolveMode` y modos creativos (momentum, call/response, tensión-release).
- Inicialización:
  - `initAudio()`: llama `audioEngine.initAudio()`, configura callback de transporte, y `loopManager.initializeLoops(scale, audioEngine)`.
- Reproducción:
  - `togglePlay()`, `startTransport()`, `stopTransport()` delegan en `audioEngine`.
  - `playActiveLoops()` invocado cada pulso; dispara notas de loops activos.
- Parámetros globales:
  - `updateTempo(value)`: ajusta `audioEngine.tempo`.
  - `updateMasterVolume()`: usa `audioEngine.updateMasterVolume()`.
  - `updateDelayDivision(division)`: ajusta división del delay global.
  - `updateScale(name)`: actualiza escala y re-cuantiza/regen loops vía `loopManager`.
- Gestión de loops:
  - `regenerateLoop(id)`, `regenerateAllLoops()`.
  - `updateLoopParam(id, key, value)`: delayAmount, reverbAmount, volume, pan, length, etc.
  - `updateLoopSynth(id, synthConfig)`: delega en `loopManager.updateLoopSynth()` (reconexión segura).
- Evolución musical:
  - `startAutoEvolve()`, `stopAutoEvolve()`, `updateEvolveInterval(n)`, `updateEvolveIntensity(n)`.
  - Modos creativos: `setMomentumEnabled(bool)`, `setCallResponseEnabled(bool)`, `setTensionReleaseMode(bool)`.
  - `evolveMusic()`: calcula nueva escala (si no está bloqueada) y aplica mutaciones vía `evolutionSystem`.

### Ejemplos de uso
```js
const audio = useAudioStore()
audio.updateTempo(128)
audio.updateScale('dorian')
audio.updateLoopParam(0, 'delayAmount', 0.35)
audio.updateLoopSynth(3, {
  synthType: 'FMSynth',
  oscillatorType: 'sawtooth',
  envelope: { attack: 0.05, decay: 0.2, sustain: 0.6, release: 1.0 },
  harmonicity: 2.5,
  modulationIndex: 12
})
```

## presetStore (src/stores/presetStore.js)
Administra la persistencia y gestión de presets.

- Estado clave:
  - `presets`, `currentPresetId`, `isLoading`, `hasUnsavedChanges`, `lastSaveTime`, `autoSaveEnabled`, `isDialogOpen`.
- Computed:
  - `currentPreset`, `sortedPresets`, `presetsCount`.
- Métodos principales:
  - `initialize()`: carga presets y configura auto-guardado.
  - `loadPresets()`, `createPreset(data)`, `createDefaultPreset(name)`.
  - `loadPreset(id)`: aplica preset al estado actual vía `applyPresetToState`.
  - `saveCurrentPreset()`, `renamePreset(id, name)`, `deletePreset(id)`, `duplicatePreset(id)`.
  - `markChanges()`, `handleChange()`: marcan cambios para auto-guardado debounced.
  - `captureCurrentState()`: serializa configuración global y de loops (incluye `synthConfig`).
  - `applyPresetToState(preset)`: restaura valores globales y por loop llamando APIs del `audioStore`.
- Servicio subyacente: `src/services/presetService.js`
  - CRUD en `localStorage` con validación y migración de versión.
  - Límite de `MAX_PRESETS = 50`.

### Ejemplos de uso
```js
const presets = usePresetStore()
await presets.initialize()
const p = await presets.createDefaultPreset('Mi sonido base')
presets.currentPresetId = p.id
await presets.saveCurrentPreset()
```

## synthStore (src/stores/synthStore.js)
Controla el editor de sintetizador y la aplicación de cambios.

- Estado:
  - Modal: `isModalOpen`, `currentLoopId`.
  - `originalSynthConfig` para revertir.
  - `tempSynthConfig`: `synthType`, `oscillatorType`, `envelope`, `harmonicity`, `modulationIndex`.
- Catálogos:
  - `synthTypes`: `PolySynth`, `AMSynth`, `FMSynth`, `PluckSynth`, `MembraneSynth`.
  - `oscillatorTypes`: `sine`, `triangle`, `square`, `sawtooth`.
- Acciones:
  - `openSynthEditor(loopId)`, `closeSynthEditor()`, `cancelSynthChanges()`.
  - `updateSynthType(type)`, `updateOscillatorType(type)`.
  - `updateEnvelopeParam(param, value)`, `updateHarmonicity(value)`, `updateModulationIndex(value)`.
  - `scheduleApplySynthDebounced()` para aplicar cambios con debounce.
  - `previewSynth()`: prueba nota con synth temporal.
  - `applySynthConfig()`: persiste en `audioStore.updateLoopSynth()`.

### Ejemplos de uso
```js
const synth = useSynthStore()
synth.openSynthEditor(2)
synth.updateSynthType('AMSynth')
synth.updateEnvelopeParam('attack', 0.02)
synth.applySynthConfig()
synth.closeSynthEditor()
```

## Buenas prácticas de modificación
- Cambios de objetos Tone.js siempre via `audioEngine` o `loopManager`.
- Al actualizar synth de un loop, permitir que `loopManager.updateLoopSynth` desconecte/disponga el anterior y cree la nueva cadena.
- Mantener `audioStore` como única fachada para mutar estado global.
- Usar `presetStore` para capturar/aplicar configuraciones completas.
