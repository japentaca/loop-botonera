# Plan de Refactorización - Arquitectura Musical Modular

## Resumen Ejecutivo

Este documento describe el plan para refactorizar la arquitectura del generador de música con loops, abordando las violaciones del principio de responsabilidad única y estableciendo una estructura modular y mantenible.

## Problemas Actuales Identificados

### Violaciones de Responsabilidad Única (SRP)

1. **`useMelodicGenerator.js`**
   - ❌ Genera melodías, maneja contrapunto, selecciona patrones, regenera loops
   - ❌ Mezcla generación con lógica de actualización de estado

2. **`useMusic.js`**
   - ❌ Define escalas, genera patrones rítmicos, melodías, acordes, cuantización
   - ❌ Acumulación de responsabilidades no relacionadas

3. **`evolutionSystem.js`**
   - ❌ Evoluciona loops pero también genera notas y muta patrones
   - ❌ Duplicación de lógica de generación

4. **`patternGenerators.js`**
   - ❌ Genera patrones pero también maneja posicionamiento y distribución
   - ❌ Acoplamiento entre generación y estrategia de colocación

### Duplicaciones de Código

- Generación de escalas: `useMusic.js` y `counterpointService.js`
- Cuantización a escala: implementada en múltiples módulos
- Generación de notas posibles: duplicada en varios archivos
- Validación de rangos MIDI: repetida en varios lugares

## Nueva Arquitectura Propuesta

```
src/
├── core/                          # Núcleo del sistema - Funciones puras
│   ├── musicTheory/              # Teoría musical pura
│   │   ├── scales.js             # Solo definiciones de escalas
│   │   ├── intervals.js          # Cálculos de intervalos
│   │   ├── noteUtils.js          # Utilidades de notas MIDI
│   │   └── chordDefinitions.js   # Definiciones de acordes
│   │
│   ├── generators/               # Generadores de formas musicales
│   │   ├── patternGenerator.js   # ÚNICO generador de patrones
│   │   ├── melodyGenerator.js    # Generador de melodías
│   │   ├── rhythmGenerator.js    # Generador de ritmos
│   │   └── chordGenerator.js     # Generador de acordes
│   │
│   └── validators/               # Validadores puros
│       ├── rangeValidator.js     # Validación de rangos MIDI
│       ├── scaleValidator.js     # Validación de escalas
│       └── noteValidator.js      # Validación de notas
│
├── services/                     # Servicios de aplicación
│   ├── musicalFormService.js     # ORQUESTADOR PRINCIPAL de formas musicales
│   ├── counterpointService.js    # Solo lógica de contrapunto
│   ├── evolutionService.js       # Solo orquestación de evolución
│   └── harmonyService.js         # Servicio de análisis armónico
│
└── composables/                  # Interfaz con Vue
    ├── useMusicalForms.js        # Punto único de acceso para formas
    ├── useScales.js              # Solo escalas
    ├── useEvolution.js           # Solo evolución
    └── useCounterpoint.js        # Solo contrapunto
```

## Principios de Diseño

### 1. Responsabilidad Única
Cada módulo tiene UNA y solo UNA responsabilidad claramente definida.

### 2. Unidireccionalidad
Los módulos solo pueden llamar a sus dependencias, nunca entre sí.

### 3. Centralización
Todas las formas musicales pasan obligatoriamente por `musicalFormService.js`.

### 4. Pureza Funcional
Las funciones de generación son puras: mismo input = mismo output.

### 5. Inmutabilidad
Los datos musicales no se modifican directamente, se generan nuevas versiones.

## Fases de Implementación

### Fase 1: Crear el Núcleo (Core) - Semana 1

**Objetivo**: Establecer las bases con funciones puras e independientes.

#### Tareas Específicas:
1. **Crear `core/musicTheory/scales.js`**
   - Extraer todas las definiciones de escalas de `useMusic.js`
   - Implementar solo funciones de acceso a escalas
   - Tests: 100% cobertura

2. **Crear `core/musicTheory/noteUtils.js`**
   - Extraer funciones de utilidad MIDI (clamp, conversión, etc.)
   - Eliminar dependencias circulares
   - Implementar validaciones puras

3. **Crear `core/validators/rangeValidator.js`**
   - Centralizar toda validación de rangos MIDI
   - Funciones puras de validación
   - Documentar límites y reglas

4. **Crear `core/generators/patternGenerator.js`**
   - Consolidar TODA la generación de patrones existente
   - Interfaz unificada para todos los tipos de patrones
   - Eliminar dependencias de estado

**Entregables**: Núcleo funcional con tests completos.

### Fase 2: Servicio Central - Semana 2

**Objetivo**: Crear el orquestador principal que coordina toda la generación.

#### Tareas Específicas:
1. **Crear `services/musicalFormService.js`**
   - Implementar patrón Facade para todos los generadores
   - Coordinar generación de melodías, ritmos, acordes
   - Gestionar escalas globales y validaciones
   - Interfaz única para todos los composables

2. **Refactorizar `services/counterpointService.js`**
   - Eliminar toda generación de notas
   - Enfocarse solo en análisis y resolución de conflictos
   - Depender solo del núcleo para validaciones

3. **Crear `services/evolutionService.js`**
   - Reemplazar `evolutionSystem.js` actual
   - Solo orquestación, sin generación directa
   - Delegar toda mutación a `musicalFormService`

**Entregables**: Servicio central operativo con interfaz limpia.

### Fase 3: Refactorización de Composables - Semana 3

**Objetivo**: Adaptar la interfaz Vue a la nueva arquitectura.

#### Tareas Específicas:
1. **Crear `composables/useMusicalForms.js`**
   - Punto único de acceso para generación de formas
   - Interfaz simplificada y coherente
   - Manejo de errores centralizado

2. **Refactorizar `composables/useScales.js`**
   - Solo acceso a escalas del núcleo
   - Eliminar toda generación de patrones
   - Interfaz reactiva para Vue

3. **Crear `composables/useEvolution.js`**
   - Reemplazar interfaz actual del sistema de evolución
   - Delegar a `evolutionService`
   - Mantener reactividad Vue

4. **Deprecar `useMelodicGenerator.js`**
   - Migrar funcionalidad a nuevos composables
   - Mantener compatibilidad temporal
   - Plan de eliminación gradual

**Entregables**: Composables refactorizados con misma interfaz pública.

### Fase 4: Migración y Testing - Semana 4

**Objetivo**: Asegurar transición sin regresiones.

#### Tareas Específicas:
1. **Tests de Integración**
   - Verificar equivalencia de resultados
   - Tests de regresión para casos críticos
   - Benchmarks de rendimiento

2. **Migración Gradual**
   - Implementar switches de feature flags
   - Permitir rollback inmediato
   - Monitoreo de errores en tiempo real

3. **Documentación y Capacitación**
   - Documentar nuevas APIs
   - Ejemplos de uso para cada módulo
   - Guías de contribución para desarrolladores

4. **Limpieza Final**
   - Eliminar código deprecado
   - Optimizar imports y dependencias
   - Revisión de código final

**Entregables**: Sistema completamente refactorizado y operativo.

## Interfaces de los Módulos Principales

### `musicalFormService.js`
```javascript
// Interfaz principal - único punto de acceso para generación
const musicalFormService = {
  generateMelody(options),
  generateRhythm(options),
  generateChordProgression(options),
  generatePattern(type, options),
  applyEvolution(loopId, strategy),
  resolveCounterpoint(loops, options)
}
```

### `useMusicalForms.js`
```javascript
// Interfaz Vue - mantiene reactividad
const useMusicalForms = () => ({
  generateLoopMelody(loopId, options),
  regenerateLoop(loopId, currentPulse),
  regenerateAllLoops(currentPulse),
  applyEvolutionToLoop(loopId, strategy),
  resolveLoopConflicts(loopId)
})
```

## Criterios de Aceptación

### Para cada módulo:
- ✅ **Tests unitarios** con mínimo 90% cobertura
- ✅ **Documentación** completa de API pública
- ✅ **Sin dependencias circulares** 
- ✅ **Interfaz coherente** con el resto del sistema
- ✅ **Sin efectos secundarios** en funciones puras

### Para el sistema completo:
- ✅ **Compatibilidad retroactiva** durante transición
- ✅ **Sin regresiones** en funcionalidad
- ✅ **Mejora de rendimiento** o mantenimiento
- ✅ **Reducción de complejidad ciclomática** > 30%

## Riesgos y Mitigación

### Riesgo 1: Regresiones en Generación Musical
**Mitigación**: Tests de equivalencia exhaustivos, feature flags para rollback inmediato.

### Riesgo 2: Complejidad de Migración
**Mitigación**: Migración gradual por módulos, mantener APIs compatibles temporalmente.

### Riesgo 3: Rendimiento
**Mitigación**: Benchmarks continuos, optimización de algoritmos críticos.

## Métricas de Éxito

- **Reducción de duplicación de código**: > 70%
- **Complejidad ciclomática promedio**: < 10 por módulo
- **Tiempo de carga**: Mantener o mejorar
- **Estabilidad**: Cero regresiones en funcionalidad core
- **Mantenibilidad**: Nuevos features requieren < 50% tiempo adicional

## Próximos Pasos

1. **Aprobar plan** y asignar recursos
2. **Crear rama feature** `feature/modular-architecture`
3. **Comenzar Fase 1** con `core/musicTheory/scales.js`
4. **Establecer CI/CD** para tests automáticos
5. **Revisión semanal** de progreso y ajustes

---

**Nota**: Este plan es vivo y puede ajustarse según descubrimientos durante la implementación. El objetivo principal es mejorar la mantenibilidad sin comprometer la funcionalidad musical.