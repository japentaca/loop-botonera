# Guía de Modificaciones para el Agente IA

Pasos y puntos de extensión frecuentes para modificar o ampliar la aplicación de forma segura.

## Cambios simples (globales)
- Cambiar tempo:
  - `audioStore.updateTempo(nuevoTempo)`
- Ajustar volumen maestro:
  - `audioStore.updateMasterVolume()` (usar slider UI en `AppHeader`)
- Modificar división de delay:
  - `audioStore.updateDelayDivision('8n' | '8t' | '4n' | etc.)`
- Cambiar escala global:
  - `audioStore.updateScale('major' | 'dorian' | ...)`

## Actualizar parámetros de un loop
- Usar `audioStore.updateLoopParam(loopId, key, value)` para keys existentes:
  - `delayAmount`, `reverbAmount`, `volume`, `pan`, `length`.
- Si agrega un nuevo parámetro:
  1. Extienda la estructura del loop en `loopManager.createBasicLoop` y `createLoop`.
  2. Asegure persistencia en `presetStore.captureCurrentState()` y restauración en `applyPresetToState()`.
  3. Conecte su impacto en audio dentro de `audioEngine.createAudioChain` o enrutado que corresponda.
  4. Añada control UI en `LoopCard.vue` y mapee a `audioStore.updateLoopParam`.

## Reemplazar sintetizador de un loop
- API: `audioStore.updateLoopSynth(loopId, synthConfig)`.
- `synthConfig` ejemplo:
```js
{
  synthType: 'FMSynth',
  oscillatorType: 'sawtooth',
  envelope: { attack: 0.05, decay: 0.2, sustain: 0.6, release: 1.0 },
  harmonicity: 2.5,
  modulationIndex: 12
}
```
- Internamente: `loopManager.updateLoopSynth` desconecta y `dispose` el anterior, luego crea cadena nueva con `audioEngine.createAudioChain`.

## Añadir un nuevo tipo de sintetizador
1. `audioEngine.createAudioChain`: ampliar el `switch(synthType)` y crear instancia Tone adecuada.
2. `loopManager.synthTypes`: incluir el nuevo tipo para distribución aleatoria.
3. `synthStore.synthTypes`: agregarlo para selección en el editor.
4. `SynthEditor.vue`: añadir opción en el `<select>` si procede.

## Añadir una nueva escala musical
1. `useMusic.useScales().scales`: incorporar la nueva escala y su nombre en `scaleNamesSpanish`.
2. UI (`AppHeader.vue`): la lista usa `Object.keys(scales)`, por lo que aparecerá automáticamente.
3. Verifique cuantización en `useNoteUtils.quantizeToScale` si se necesita ajuste especial.

## Extender evolución musical
1. `stores/modules/evolutionSystem.js`: añadir nuevo `evolutionType` y reglas de mutación.
2. `audioStore.evolveMusic()`: integrar selección/aplicación del nuevo tipo.
3. UI: `AppHeader.vue` y/o `StyleConfigDialog.vue` para exponer el modo.

## Ajustes de energía sónica
- Parámetros en `energyManager`: densidad y volumen adaptativos.
- UI en `StyleConfigDialog.vue`: `energyManagement`, `maxSonicEnergy`, `energyReductionFactor`.
- Al cambiar lógica: asegure que `initializeLoops` reciba `getAdaptiveVolume`/`getAdaptiveDensity` si aplica.

## Persistencia de presets
- `presetStore.captureCurrentState()` debe incluir cualquier campo nuevo del loop o global.
- `presetStore.applyPresetToState(preset)` debe restaurar esos valores usando métodos del `audioStore`.
- Servicio: `presetService.js` valida estructura y migra versión.

## Depuración de audio
- Verifique `audioEngine.audioInitialized` antes de crear cadenas.
- `BYPASS_EFFECTS_FOR_TEST` en `audioEngine`: útil para aislar problemas.
- `softResetDelayFeedback()` si hay acumulación en delay.
- Revise conexiones: panner/delaySend/reverbSend y su mezcla.

## Checklist al terminar un cambio
- ¿Se respeta la encapsulación (stores → módulos → Tone)?
- ¿La UI expone controles acordes y llama métodos del store?
- ¿Preset captura/aplica el estado nuevo?
- ¿Se probaron play/pause, cambio de escala, regeneración y auto-evolución?
