# Uso del sistema — Ciclos tonales y selectores

Este documento explica en detalle cómo usar el sistema, con énfasis en los "ciclos tonales" (tonal cycles) y lo que afecta cada tipo de selector: `global`, `group` y `loop`.

---

## 1. Visión general

El proyecto tiene varias piezas clave:

- `audioStore` (`src/stores/audioStore.js`): store central que gestiona el estado global (escala, tempo, loops, etc.) y coordina módulos como `loopManager`, `energyManager`, `audioEngine` y `evolutionSystem`.
- `notesMatrix` (`src/composables/useNotesMatrix.js`): matriz central de notas y metadatos por loop (escala local, baseNote, densidad, etc.).
- `tonalCycles` (`src/modules/tonalCycles.js`): módulo que programa y gestiona ciclos tonales. Un ciclo aplica transformaciones periódicas (p. ej. rotar la escala) sobre un objetivo (scope): global, group o loop.
- UI: `AppHeader.vue` (`src/components/AppHeader.vue`) contiene el panel para crear/controlar ciclos tonales.

---

## 2. ¿Qué es un ciclo tonal (Tonal Cycle)?

Un *ciclo tonal* es una tarea programada que se ejecuta periódicamente y aplica una acción musical: rotar el modo de la escala (rotateMode) o intentar desplazar la tonalidad (shiftKey). Sus configuraciones principales son:

- `scope` (alcance): `global`, `group` o `loop`.
- `strategy` (estrategia): `rotateMode`, `shiftKey`.
- `intervalBeats` (intervalo en negras/compases): cuántos beats esperar entre pasos.
- `snapToMeasure`: si verdadero, la ejecución se sincroniza con el siguiente compás.
- `allowMultiple`: permite crear varios ciclos con el mismo scope/target o solo actualiza uno existente.

Código relevante: `src/modules/tonalCycles.js` (funciones: `startCycle`, `_stepCycleImpl`, `listCycles`, `stopCycle`, `pauseCycle`, `resumeCycle`).

---

## 3. ¿Qué afecta cada selector? (Global, Group, Loop)

A continuación se detalla el efecto exacto de cada `scope` en los ciclos.

### 3.1 Scope `global`

- ¿Qué toca?: cambia la `audioStore.currentScale` (escala global) al siguiente modo (o intenta hacer shiftKey según la estrategia).
- Efectos prácticos:
  - Llama a `audioStore.updateScale(next)` — ver `src/stores/audioStore.js`.
  - `updateScale` cuantiza todos los loops activos mediante `loopManager.quantizeLoopNotes`, que a su vez usa `notesMatrix.quantizeAllActiveLoops` para aplicar la nueva escala a las notas.
  - Por lo tanto, un ciclo `global` afectará a todos los loops activos: actualizará `loopMetadata.scale` y cuantizará notas en cada loop. Además, el UI de escalas (selector global) mostrará la nueva escala activa.
- Uso típico: transiciones globales del proyecto (ej.: pasar de mayor a dórico cada X intervalos).

### 3.2 Scope `group` (Voice Group)

- ¿Qué toca?: afecta solo los loops que pertenecen a una voice group (grupo de voces) específica.
- Organización:
  - Los grupos están representados por `voiceGroupId` en `notesMatrix.loopMetadata` y se crean con `notesMatrix.linkLoopsAsVoices()`.
  - Se pueden listar con `notesMatrix.getAllVoiceGroups()` y obtener miembros con `notesMatrix.getGroupMembers(groupId)`.
- Efectos prácticos:
  - El ciclo iterará por los miembros del grupo (cada `id`) y, para cada loop, calculará el siguiente modo (`_rotateModeName`) y llamará a `notesMatrix.quantizeLoop(id, next)` y `notesMatrix.generateLoopNotes(id, { silent: true })`.
  - `quantizeLoop` actualiza `loopMetadata.scale` y cuantiza notas (solo las que queden dentro del rango de la escala nueva). `generateLoopNotes` regenerará el patrón para ese loop (en `silent` evita algunos cambios de metadatos visibles).
- Uso típico: transformar solo un grupo de voces (ej.: secciones que suenan como acompañamiento) sin alterar la escala global ni otras pistas.

### 3.3 Scope `loop`

- ¿Qué toca?: afecta a un loop individual (por `loopId`).
- Efectos prácticos:
  - El ciclo busca `loopId` específico, rota el modo del loop (o aplica shiftKey), y hace `notesMatrix.quantizeLoop(loopId, next)` y `notesMatrix.generateLoopNotes(loopId, { silent: true })`.
  - Cambiará la escala local del loop (metadato `meta.scale`) y cuantizará/regenerará notas de ese loop únicamente.
- Uso típico: controlar la transformación melódica de una voz concreta.

---

## 4. Estrategias (`strategy`)

- `rotateMode` (por defecto): rota entre modos/escala seteados en `MODE_SEQUENCE` dentro de `tonalCycles.js`: `['major','dorian','phrygian','lydian','mixolydian','minor','locrian']`.
  - Global: cambia la escala global entre modos.
  - Group/Loop: rota la escala local de cada loop afectado.

- `shiftKey`: behavior experimental/PoC en `tonalCycles` — intenta desplazar la tónica por semitonos o identificar una escala relacionada.
  - En el código actual crea una variable `related` con `getScale` pero no actualiza raíz de forma robusta; en muchos casos hace fallback a `rotateMode`.
  - Recomendación: utilízalo con cautela; aún está en desarrollo.

---

## 5. Programación y timing

- `intervalBeats`: valor en beats (negras), transformado a milisegundos según `audioStore.tempo` (BPM) y usado como `intervalMs`.
- `snapToMeasure`: cuando está habilitado, la primera ejecución se programa para el próximo compás (calculado con `_msToNextMeasure` en `tonalCycles.js`).
- El módulo calcula `lastStepTime` para mostrar un contador de siguiente paso en la UI (AppHeader).
- Si `startImmediately` es `false`, no se programará la repetición inmediatamente.

---

## 6. Inicio / actualización / finalización de ciclos

- Evitar duplicados: por defecto `startCycle` intenta evitar duplicados (compara scope + target). Si encuentra un ciclo ya existente con el mismo scope/target y `allowMultiple` es false, actualiza la configuración del ciclo existente (interval, strategy y snapToMeasure).
- `allowMultiple` puede ser usado para crear más de un ciclo apuntando al mismo target.
- Métodos disponibles:
  - `audioStore.startTonalCycle(cfg)` -> crea un ciclo y devuelve { id, step, stop, pause, resume }.
  - `audioStore.stopTonalCycle(id)` -> detiene el ciclo.
  - `audioStore.stepTonalCycle(id)` -> ejecuta un paso inmediato (sin afectar programación).
  - `audioStore.pauseTonalCycle(id)`, `.resumeTonalCycle(id)`.
- UI: en `AppHeader` tienes controles para Start/Stop/Step/Pause/Resume, la lista de ciclos activos y botones para re-scan.

---

## 7. Interacción con otras funciones/flags

- `scaleLocked` en `audioStore` existe como bandera (UI en `StyleConfigDialog`) pero actualmente no se aplica en `updateScale` ni en `tonalCycles.startCycle`, por lo tanto:
  - Aunque `scaleLocked` aparece en la UI, no impedirá que un ciclo global cambie la escala en esta versión. Esta limitación está documentada en el código y puede ser un feature por implementar.

- `quantizeLoop` cambia `loopMetadata.scale` y cuantiza/ajusta notas (limita cambios y asegura baseNote en la nueva escala).
- `generateLoopNotes` regenera notas según densidad, patternProbabilities y evita conflictos contrapuntísticos si el `counterpointService` lo permite.

---

## 8. Consejos y escenarios de uso

- Crear una transición global: cambiar entre modos cada 4 beats:
  - Scope: `global`, Strategy: `rotateMode`, Interval: 4 beats, Snap to measure: ON.
  - Resultado: el proyecto entero cambia la escala global; todas las pistas activas se cuantizan a la nueva escala.

- Acciones locales sin tocar proyecto:
  - Si quieres cambiar sólo la armonía de un solo loop o un grupo (voz), usa `group` o `loop`.
  - Esto solo cambia las notas/escala de lo afectado; el resto del proyecto permanece en la escala global.

- Combinaciones: puedes usar `allowMultiple` para crear varios ciclos que afecten el mismo loop con diferentes estrategia/intervalo (por ejemplo un ciclo de rotación por modo y otro que mute/regenerar cada diferente intervalo).

- Verificación: usa el overlay `Active cycles` en el UI para ver status, tiempo restante y pausar/resumir/stop de ciclos.

---

## 9. Notas de desarrollo — archivos relevantes

- Módulo de ciclos: `src/modules/tonalCycles.js` (lógica principal de configuración, scheduling y step impl.)
- Store audio: `src/stores/audioStore.js` (coordinación, API pública que UI y otros módulos usan)
- Matrix de notas: `src/composables/useNotesMatrix.js` (manejo granular de loops: metadatos, cuantización, generación)
- LoopManager (cuantización y regeneración en nivel loop): `src/stores/modules/loopManager.js`.
- UI controles: `src/components/AppHeader.vue` (panel para cycles y opciones en la UI)

---

## 10. Limitaciones conocidas y próximos pasos (recomendaciones)

- `shiftKey` es un PoC — el comportamiento aún puede necesitar mejoras para definir cómo rotar la tónica sin cambiar la modalidad.
- `scaleLocked` no evita cambios por ciclos; recomendar revisar si debería bloquear cambios globales.
 - `shiftKey` ahora realiza una transposición de la tónica por semitono de manera robusta:
   - En `scope = global` transpone todos los loops activos (ajusta `baseNote` y re-cuadriza).
   - En `scope = group` transpone y recuantiza los miembros del grupo.
   - En `scope = loop` transpone y recuantiza el loop concreto.
 - `scaleLocked` ahora evita que los ciclos globales cambien la escala: si `scaleLocked` está activo, los ciclos *no ejecutarán* `updateScale`. La UI aún permite cambios manuales de escala (toggle en `StyleConfigDialog`), pero el guardado evita cambios automáticos por ciclos.
- `tonalCycles` actualmente no actualiza la `baseNote` al cambiar escala (algunos ajustes en `loopManager` hacen este paso), revisar coherencia en casos de root diferente.

- Corrección reciente: se detectó que `tonalCycles` no respetaba correctamente el `intervalBeats` cuando el tempo se estaba proporcionando como un valor numérico (no como `ref.value`). Esto provocaba que el valor por defecto (120 BPM) se utilizara en lugar del tempo actual, por lo que el intervalo en ms se calculaba con un tempo erróneo y daba como resultado un intervalo menor. Se corrigió `_getTempoFromStore()` para leer `audioStore.tempo` tanto si es un `ref` como si es un número, y ahora `intervalBeats` se respeta de forma consistente.
 - Mejora: los ciclos ahora actualizan su `intervalMs` cuando se cambia el tempo global (llamando a `audioStore.updateTempo`), y reinician sus temporizadores para respetar el nuevo tempo sin que el usuario tenga que reiniciar cada ciclo.

---

Si quieres, puedo:
- Añadir ejemplos prácticos paso a paso con capturas UI o comandos (incluir botones a pulsar) para crear y probar cada tipo de ciclo.
- Actualizar código para que `scaleLocked` realmente bloquee cambios desde *tonal cycles* y `updateScale`.

¡Dime qué más quieres que incluya y lo agrego! ✅

---

## 11. Pasos rápidos — Quick Start (práctico)

Si quieres probar los ciclos de inmediato, sigue estos pasos rápidos:

- Asegúrate de inicializar audio (pulsando Play) para que las acciones se apliquen en audio y timing reales.
- Para crear un ciclo global de rotación de modo cada 4 beats:
  1. Abre el panel superior `Cycles` en el header.
  2. Selecciona `Scope` = Global.
  3. Selecciona `Strategy` = Rotate Mode.
  4. Ajusta `Interval (beats)` a `4`.
  5. Activa `Snap to measure` si quieres que inicie alineado al siguiente compás.
  6. Haz click en `Start`.

- Para crear un ciclo que afecte un grupo de voces:
  1. Crea o comprueba que existe un voice group (usa la función de agrupar loops en la UI o desde `notesMatrix.linkLoopsAsVoices`).
  2. En `Scope`, selecciona `Group` y elige el `groupId` correspondiente.
  3. Selecciona `Strategy` y `Interval`.
  4. Start.

- Para crear un ciclo en un loop específico:
  1. Selecciona `Scope` = Loop.
  2. Introduce el `loopId` (0..15).
  3. Start.

---

Si quieres, puedo añadir capturas del UI o comandos para automatizar la creación de ciclos desde código (ej.: `audioStore.startTonalCycle({ scope: 'global', intervalBeats: 8, strategy: 'rotateMode', snapToMeasure: true })`).
