# Mapa de Arquitectura y Flujo de Audio

Este documento resume la arquitectura de la aplicación y el flujo de audio, para acelerar futuras modificaciones por parte del agente IA.

## Visión general
- Framework: Vue 3 (Composition API) + Pinia.
- Audio: Tone.js.
- Estado: `audioStore` orquesta módulos especializados: `audioEngine`, `loopManager`, `energyManager`, `evolutionSystem`.
- UI principal: `App.vue` monta `AppHeader`, `LoopGrid` y `SynthEditor`.
- Presets: `presetStore` + `presetService` (localStorage).

## Punto de entrada
- `src/App.vue` actúa como raíz de la aplicación. En `onMounted`:
  - `audioStore.initAudio()` inicializa el motor de audio y prepara los loops.
  - `presetStore.initialize()` carga y prepara el sistema de presets.

> Nota: No se encontró `main.js` en `src`. El bundler podría estar configurado para montar `App.vue` directamente.

## Stores y módulos
- `src/stores/audioStore.js` (Pinia):
  - Orquesta los módulos especializados.
  - Expone estado global (tempo, volumen maestro, escala, auto-evolución, modos creativos).
  - Brinda funciones de control: play/stop, regeneración de loops, actualización de parámetros de loop y efectos, cambio de escala, delay division, evolución musical.
- `src/stores/presetStore.js` (Pinia):
  - Gestiona presets (CRUD, auto-guardado, captura del estado actual, aplicación de presets).
  - Utiliza `src/services/presetService.js` para persistencia en `localStorage`.
- `src/stores/synthStore.js` (Pinia):
  - Administra el editor de sintetizador (modal, configuración temporal, aplicación y vista previa).
- Módulos en `src/stores/modules/`:
  - `audioEngine.js`: Inicializa Tone.js, efectos globales (delay, reverb, master), transporte, `createAudioChain`.
  - `loopManager.js`: Crea y configura loops (estructura, patrones, notas, parámetros, conexiones de audio).
  - `energyManager.js`: Calcula y balancea la energía sónica (volumen/densidad adaptativos).
  - `evolutionSystem.js`: Reglas y temporización de evolución musical (tipos de evolución, mutaciones, intensidad).

## Flujo de audio
1. Inicialización
   - `audioStore.initAudio()` llama a `audioEngine.initAudio()`.
   - Se configura el transporte (`setupTransportCallback`) para disparar reproducción de loops cada pulso.
   - `loopManager.initializeLoops(scale, audioEngine)` crea `NUM_LOOPS` con sus cadenas de audio.
2. Cadena de audio por loop (`audioEngine.createAudioChain`)
   - Se instancia el sintetizador (PolySynth/AM/FM/Pluck/Membrane).
   - Se crean envíos a delay y reverb, y paneo.
   - Conexiones: `synth -> (panner) -> masterGain` y envíos a `delay`/`reverb` según cantidades.
3. Transporte
   - Controlado por `audioEngine.togglePlay()`, `startTransport()`, `stopTransport()`.
   - Tempo en `audioEngine.tempo`; `updateDelayDivision()` ajusta división de delay.
4. Reproducción de loops
   - En cada pulso, `audioStore.playActiveLoops()` decide qué notas disparar.
   - `loopManager.playLoopNote()` cuantiza y envía notas al sintetizador.
5. Efectos globales
   - `audioEngine` mantiene `delay`, `reverb`, `masterGain`.
   - Ajustes globales: `updateMasterVolume()`, `updateDelayTime()`, `softResetDelayFeedback()`.

## Evolución y energía
- Auto-evolución (`audioStore` + `evolutionSystem`):
  - Intervalo e intensidad controlan cuándo y cuánto mutar.
  - Modos creativos: `momentum`, `callResponse`, `tensionRelease`, `classic` afectan selección de escala y mutaciones.
- Gestión de energía (`energyManager`):
  - Ajusta densidad/volumen adaptativos según loops activos y energía actual.

## Componentes UI
- `AppHeader.vue`:
  - Play/Pause, Regenerar todo, sliders de Tempo y Volumen, selector de división de delay.
  - Auto-evolución: iniciar/detener, progreso, abrir `StyleConfigDialog`.
  - Escalas: selector y etiquetas amigables.
- `LoopGrid.vue` y `LoopCard.vue`:
  - Lista de loops, controles por loop (activar, tamaño/longitud, delay/reverb, volumen, paneo, regenerar, editar synth).
- `SynthEditor.vue`:
  - Editor del sintetizador (tipo, oscilador, envelope, modulación) y aplicación/cancelación/preview.
- `StyleConfigDialog.vue`:
  - Configura intervalos/intensidad, momentum, call/response, tensión-release, bloqueo de escala, energía máxima.
- `PresetManagerDialog.vue`:
  - Gestión de presets (UI rica; la lógica se apoya en `presetStore`).

## Dependencias clave
- Tone.js: síntesis, efectos, transporte.
- Pinia: estado global.
- Vue 3: UI y composición.

## Consideraciones de modificación
- Mantener `audioEngine` como único responsable de objetos Tone.js.
- Al cambiar synth de un loop, usar `loopManager.updateLoopSynth()` (desconecta/dispone seguro y re-crea la cadena).
- Actualizaciones de parámetros de loop vía `audioStore.updateLoopParam(id, key, value)`.
- Cambios de escala global con `audioStore.updateScale(scaleName)`.
