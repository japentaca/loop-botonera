# Componentes Principales y Comunicación

Este documento mapea los componentes clave de la UI y cómo se comunican con los stores.

## App.vue
- Monta `AppHeader`, `LoopGrid` y `SynthEditor`.
- En `onMounted`:
  - Inicializa audio con `audioStore.initAudio()`.
  - Inicializa presets con `presetStore.initialize()`.

## AppHeader.vue
Controles globales y estilos de evolución.

- Controles principales:
  - Play/Pause: `audioStore.togglePlay()`.
  - Regenerar todos: `audioStore.regenerateAllLoops()`.
  - Tempo (slider): `onTempoInput -> audioStore.updateTempo(value)`.
  - Volumen maestro (slider): `onMasterVolumeInput -> audioStore.updateMasterVolume()`.
  - División de delay: `audioStore.updateDelayDivision(value)`.
- Auto-evolución:
  - `toggleAutoEvolve()`: alterna `audioStore.startAutoEvolve()` / `stopAutoEvolve()`.
  - Progreso UI: usa `audioStore.autoEvolve`, `nextEvolveMeasure`.
- Estilos y modos creativos:
  - Abre `StyleConfigDialog`.
  - Multiselector de evolución: actualiza `audioStore.setMomentumEnabled`, `setCallResponseEnabled`, `setTensionReleaseMode`.
- Escalas:
  - `onScaleChange(scale)`: `audioStore.updateScale(scale)`.

## LoopGrid.vue
- Renderiza `LoopCard` por cada elemento en `audioStore.loops`.
- Pasa `loop` y `currentPulse` (como `current-beat`) al hijo.

## LoopCard.vue
Controles por loop.

- Acciones:
  - Toggle de actividad: `audioStore.toggleLoop(loop.id)`.
  - Editar sintetizador: `synthStore.openSynthEditor(loop.id)`.
  - Regenerar loop: `audioStore.regenerateLoop(loop.id)`.
- Parámetros (sliders/selects) que llaman `audioStore.updateLoopParam`:
  - `length` (tamaños permitidos: `[4,8,12,16,32,48,64,128,256,512]`).
  - `delayAmount`, `reverbAmount`, `volume`, `pan` (formateo IE/D para paneo).
- Estado visual:
  - Muestra `loop.synthType`.
  - Simula progreso de beat si `loop.isActive`.

## SynthEditor.vue
Editor modal del sintetizador.

- Fuente de estado: `synthStore`.
- Controles:
  - Tipo de sintetizador: `synthStore.updateSynthType(value)`.
  - Oscilador: `synthStore.updateOscillatorType(value)`.
  - Envelope ADSR: `synthStore.updateEnvelopeParam(param, value)`.
  - Modulación: `synthStore.updateHarmonicity(value)`, `updateModulationIndex(value)`.
- Acciones:
  - `previewSynth()`.
  - `applySynthConfig()`.
  - `closeSynthEditor()`.

## StyleConfigDialog.vue
Configuración de estilos de evolución y energía.

- Interacciones típicas con `audioStore`:
  - `updateEvolveInterval(n)`, `updateEvolveIntensity(n)`.
  - `setMomentumEnabled(bool)`, `setCallResponseEnabled(bool)`, `setTensionReleaseMode(bool)`.
  - `updateScale(scale)` y `scaleLocked`.
  - Energía: `energyManagement`, `maxSonicEnergy`, `energyReductionFactor`.

## PresetManagerDialog.vue
Gestión de presets.

- UI extensa (CSS rico). Lógica provista por `presetStore`:
  - Abrir/cerrar diálogo: `presetStore.openDialog()`/`closeDialog()`.
  - Crear/renombrar/duplicar/eliminar: métodos del store.
  - Auto-guardado y estado de cambios.

## Diagrama de comunicación (texto)
- `AppHeader` → `audioStore`: play/pause, tempo, volumen, delay division, auto-evolución, escala.
- `AppHeader` → `StyleConfigDialog`: abrir/cerrar; ajustes de evolución y energía.
- `LoopGrid` → `LoopCard`: entrega cada `loop`.
- `LoopCard` → `audioStore`: activar/desactivar, actualizar parámetros, regenerar.
- `LoopCard` → `synthStore`: abrir editor.
- `SynthEditor` → `synthStore` → `audioStore.updateLoopSynth`: aplicar cambios.
- `PresetManagerDialog` → `presetStore` → `audioStore`: capturar/aplicar estado.

## Puntos de extensión
- Nuevos controles globales: añadir en `AppHeader.vue` y conectar con `audioStore`.
- Nuevos parámetros de loop: extender `loopManager` estructura y exponer setters en `audioStore.updateLoopParam`.
- Nuevos modos creativos: ampliar `audioStore.evolveMusic()` y `evolutionSystem`.
