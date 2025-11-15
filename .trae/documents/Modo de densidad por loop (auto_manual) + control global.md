## Objetivo
- Permitir densidad editable por loop con modo `auto` o `manual`.
- Si un loop está en `auto`, su densidad se calcula en función de los demás loops y un sesgo global.
- Si todos están en `auto`, el sistema calcula la densidad de cada uno automáticamente.
- Añadir un control global (slider en AppHeader) para orientar la densidad general.

## Cambios de Datos
- Metadata por loop (en `notesMatrix.loopMetadata`):
  - `densityMode`: `'auto' | 'manual'` (por defecto `'auto'`).
  - `manualDensity`: número 0–1 (cuando `densityMode==='manual'`).
  - `autoDensity`: número 0–1 (último cálculo; solo lectura).
- Mantener `density` como valor efectivo actual para compatibilidad, pero derivarlo de `densityMode`.

## Lógica de Densidad
- Nueva función `getEffectiveDensity(loopId)` que devuelve:
  - `manualDensity` si `densityMode==='manual'`.
  - `autoDensity` si `densityMode==='auto'`.
- Actualizar el cálculo automático:
  - Integrar un parámetro global `globalDensityBias` (0–1) que desplaza el rango `[MIN_DYNAMIC_DENSITY, MAX_DYNAMIC_DENSITY]`.
  - Calcular `autoDensity` solo para loops con `densityMode==='auto'`.
  - Mantener suavizado (debounce) y clamps.
- Respetar `options.density` como override explícito en regeneraciones.

## Integración en Código
- `src/composables/useMelodicGenerator.js`:
  - En `buildPatternOptions(meta, options)`, usar `density: (options.density ?? getEffectiveDensity(loopId))`.
  - Evitar dependencia directa de `meta.density`.
- `src/composables/useNotesMatrix.js`:
  - Añadir helpers: `setLoopDensityMode(loopId, mode)`, `setManualDensity(loopId, value)`, `getEffectiveDensity(loopId)`.
  - En `generateLoopNotes`, si `options.density` no viene, usar `getEffectiveDensity(loopId)`.
  - Al persistir, actualizar `density` con el efectivo y mantener `manualDensity/autoDensity` coherentes.
- `src/stores/audioStore.js`:
  - Estado `globalDensityBias` (0–1) y setters.
  - En `applyDynamicDensities`, actualizar `autoDensity` solo en loops `densityMode==='auto'` y escribir `density` efectivo; no tocar loops manuales.
- `src/stores/modules/energyManager.js`:
  - Extender `computeDynamicDensity(loops, bias)` para aplicar `bias`.
  - (Opcional V2) `computeAutoDensityPerLoop(loop, loops, bias)` para asignación diferenciada por loop.
- `src/stores/modules/loopManager.js`:
  - En `regenerateLoop`, pasar `options.density` calculado (target efectivo) al generador para que lo respete.

## UI/UX
- `AppHeader`:
  - Slider `globalDensityBias` 0–1 con label (p.ej. “Densidad global”).
  - Cambios actualizan el store y disparan `applyDynamicDensities` (sin regenerar de inmediato; opcional botón “Aplicar” para regenerar todos). 
- `LoopCard`:
  - Toggle `Auto / Manual` por loop.
  - Si `Manual`: slider 0–1 para `manualDensity` con lectura del valor actual.
  - Mostrar `Densidad efectiva` (lectura de `getEffectiveDensity`).
  - “Regenerar Loop” usa el `options.density` efectivo.

## Flujo de Regeneración
- Cuando se pulsa “Regenerar”:
  - Calcular `effectiveDensity` por loop y pasarla explícitamente en `options.density`.
  - El generador usa esa densidad (ya no ignora `options`).
- Regenerar todos: lo mismo, por cada loop activo.

## Interacción con Evolver
- Evolver debe respetar `densityMode`:
  - En `manual`: no modificar densidad/meta; si necesita variar, hacerlo temporalmente y restaurar `manualDensity`.
  - En `auto`: puede ajustar notas para alcanzar `autoDensity` objetivo usando `adjustLoopDensity`.
- En modo creativo, limitar los flips de densidad dentro del rango sesgado por `globalDensityBias`.

## Reglas y Seguridad
- Clamps estrictos 0–1 y límites de notas `[24, 96]` existentes.
- Debounce para evitar thrash al mover sliders.
- Cambios de densidad aplicados en fronteras de compás si el reloj global está disponible (suavidad auditiva).

## Migración y Compatibilidad
- Inicializar `densityMode='auto'` y `manualDensity=meta.density` para no romper presets.
- Mantener `density` actualizado con el efectivo para los componentes existentes.

## Validación
- Casos:
  - 1 loop manual alto, 3 auto: los auto se ajustan (menos densos) y regenerar respeta manual.
  - Todos auto: mover `globalDensityBias` baja/sube densidad y la mezcla permanece clara.
  - Evolver sobre manual: no cambia densidad; sobre auto: alcanza objetivo con `adjustLoopDensity`.

## Entregables
- Estado y helpers nuevos en `notesMatrix` y `audioStore`.
- Ajustes en `useMelodicGenerator`, `loopManager`, `energyManager`.
- UI: sliders/toggles en `AppHeader` y `LoopCard`.

¿Confirmas este plan para implementarlo? 