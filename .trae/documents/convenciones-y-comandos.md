# Convenciones de Desarrollo y Comandos Útiles

Guía práctica para mantener coherencia al modificar y extender el proyecto.

## Estructura del proyecto (convenciones)
- `src/components/`: componentes de UI (AppHeader, LoopGrid, LoopCard, SynthEditor, StyleConfigDialog, PresetManagerDialog).
- `src/stores/`: stores Pinia principales (`audioStore`, `presetStore`, `synthStore`).
- `src/stores/modules/`: módulos especializados (`audioEngine`, `loopManager`, `energyManager`, `evolutionSystem`).
- `src/composables/`: utilidades musicales (`useMusic`) y relacionadas.
- `src/services/`: servicios de persistencia (`presetService`).

## Principios de diseño
- Orquestación central en `audioStore`: cualquier cambio global debería exponerse como método en este store.
- Encapsulación de Tone.js: creación y conexión de objetos de audio a través de `audioEngine` y `loopManager`.
- Seguridad al reemplazar sintetizadores: desconectar y `dispose` del anterior en `loopManager.updateLoopSynth()`.
- Separación de preocupaciones:
  - UI → llama a stores y muestra estado.
  - Stores → coordinan módulos y exponen métodos públicos.
  - Módulos → implementan lógica específica (audio, loops, energía, evolución).
- Persistencia: usar `presetStore` + `presetService` para guardar/cargar configuraciones completas.

## Patrones comunes
- Actualización de parámetros de loop:
  - `audioStore.updateLoopParam(loopId, key, value)`.
- Cambio de escala global:
  - `audioStore.updateScale('lydian')` → re-cuantiza y actualiza loops.
- Evolución musical:
  - `audioStore.startAutoEvolve()`, `audioStore.updateEvolveInterval(4)`, `audioStore.updateEvolveIntensity(0.7)`.
- Efectos globales:
  - `audioStore.updateDelayDivision('8t')`, `audioStore.updateMasterVolume()`.

## Comandos útiles (asumidos)
> Ajustar según `package.json` real. Valores típicos para proyectos Vue+Vite.

- Instalar dependencias:
  - `npm install`
- Desarrollo (servidor local):
  - `npm run dev`
- Construcción de producción:
  - `npm run build`
- Previsualización de build:
  - `npm run preview`

## Recomendaciones de prueba manual
- Reproducir, ajustar tempo y volumen desde `AppHeader`.
- Cambiar escala y verificar cuantización de notas en los loops.
- Editar sintetizador de un loop y previsualizar.
- Regenerar loops y validar efectos (delay/reverb) y paneo.
- Activar auto-evolución y observar progresión (momentum, call/response, tensión-release).
- Guardar/duplicar/eliminar presets y restaurar configuraciones.

## Notas de mantenimiento
- Mantener nombres idiomáticos en español para etiquetas UI y documentación.
- Evitar acoplamiento entre componentes y módulos; usar stores como interfaz.
- Registrar errores en consola con mensajes claros (como hace `audioStore.initAudio`).
- Documentar nuevas funciones y parámetros en `.trae/documents` al añadir funcionalidades.
