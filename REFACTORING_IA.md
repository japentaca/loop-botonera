# REFACTORIZACIÓN PARA AGENTE IA - MÚSICA MODULAR

## CRÍTICO: REGLAS DE EJECUCIÓN PARA AGENTE

### RESTRICCIONES ABSOLUTAS (VIOLAR = FALLAR)
1. **NUNCA RENOMBRAR ARCHIVOS EXISTENTES**
   - Mantener nombres originales siempre
   - Archivos nuevos: usar nombres descriptivos pero no cambiar existentes
   - Archivos deprecados: mover a `src/deprecated/` sin tocar originales

2. **SIN AUTOMATIZACIÓN DE TESTS**
   - No usar vitest, jest, ni ningún framework
   - Pruebas = usuario prueba manual con Chrome DevTools MCP
   - Verificar funcionalidad en navegador real

3. **VERIFICACIONES OBLIGATORIAS**
   - Después de CADA cambio: `npm run dev` debe funcionar
   - Después de CADA import: verificar que archivo existe realmente
   - Después de CADA función: revisar exports/imports coincidan

4. **MÁXIMO UN ARCHIVO POR SESIÓN**
   - No intentar refactorizar múltiples archivos
   - Completar y verificar uno antes de siguiente
   - Priorizar estabilidad sobre velocidad

## ANÁLISIS RÁPIDO - PROBLEMAS CRÍTICOS

### Archivo: `src/composables/useMusic.js`
**Problemas identificados:**
- ❌ Define escalas + genera patrones + melodías + acordes + cuantización
- ❌ Funciones mezcladas sin cohesión
- ❌ 300+ líneas sin separación de responsabilidades

**Funciones a extraer (en orden de prioridad):**
1. `getScaleNotes()` - teoría musical pura
2. `quantizeToScale()` - utilidad de cuantización  
3. `generateChordProgression()` - generación de acordes
4. `getPatternLengths()` - constantes de patrones

### Archivo: `src/composables/useMelodicGenerator.js`
**Problemas identificados:**
- ❌ Genera melodías + maneja contrapunto + selecciona patrones + regenera loops
- ❌ Acoplado a `notesMatrix` global
- ❌ Lógica de selección mezclada con generación

## PROTOCOLO DE EXTRACCIÓN

### Paso 1: Crear archivo auxiliar (misma carpeta)
```javascript
// src/composables/musicTheory.js
// EXTRAER: Solo funciones de teoría musical

export const SCALES = { /* constantes */ };
export const getScaleNotes = (scaleName) => { /* lógica */ };
export const getChordNotes = (chordType) => { /* lógica */ };
```

### Paso 2: Actualizar original (conservar imports)
```javascript
// src/composables/useMusic.js
import { SCALES, getScaleNotes, getChordNotes } from './musicTheory.js'

// MANTENER: Exportar funciones para compatibilidad
export { SCALES, getScaleNotes, getChordNotes }
```

### Paso 3: Verificar (CRÍTICO)
1. Chrome DevTools: ¿app carga sin errores?
2. ¿Generación musical funciona igual?
3. ¿Sin errores en consola?

## CHECKLIST DE VERIFICACIÓN

### Antes de cambiar código:
- [ ] Leer archivo completo actual
- [ ] Identificar funciones a extraer
- [ ] Verificar que archivo nuevo no existe

### Durante extracción:
- [ ] Copiar funciones exactamente (sin cambiar)
- [ ] Mantener exports originales en archivo viejo
- [ ] Verificar imports coinciden con archivos reales
- [ ] NOTA: Vite HMR actualiza automáticamente, no reiniciar servidor

### Después de extracción:
- [ ] Verificar HMR actualiza automáticamente (Vite no necesita reinicio)
- [ ] Chrome DevTools: sin errores de importación
- [ ] Funcionalidad musical: probar generación
- [ ] Consola: sin errores undefined/imports

## SECUENCIA PROPUESTA

### Sesión 1: Extraer teoría musical de useMusic.js
1. Crear `src/composables/musicTheory.js`
2. Mover solo funciones de escalas/acordes
3. Verificar funcionamiento completo

### Sesión 2: Extraer utilidades de useMusic.js  
1. Crear `src/composables/musicUtils.js`
2. Mover cuantización y validaciones
3. Verificar funcionamiento completo

### Sesión 3: Mejorar useMelodicGenerator.js
1. Extraer lógica de selección de patrones
2. Separar generación de orquestación
3. Verificar generación de loops musical

## MENSAJES DE ERROR COMUNES

### "Cannot find module"
- ERROR: Import apunta a archivo inexistente
- SOLUCIÓN: Verificar ruta exacta, mayúsculas, .js

### "export not found"
- ERROR: Función no exportada del archivo
- SOLUCIÓN: Agregar a exports del archivo origen

### "undefined is not a function"
- ERROR: Importación circular o incorrecta
- SOLUCIÓN: Verificar exports/imports coinciden exacto

## NOTAS TÉCNICAS IMPORTANTES

### VITE HMR (Hot Module Replacement)
- **NO REINICIAR** el servidor durante desarrollo
- Los cambios se aplican automáticamente al guardar
- Si hay errores, corregir y guardar de nuevo
- Solo reiniciar si el error persiste después de 10 segundos

### VERIFICACIÓN RÁPIDA CON HMR
1. Guardar cambios en archivo
2. Esperar 2-3 segundos
3. Verificar en Chrome DevTools: Network tab
4. Buscar "hmr" requests exitosos
5. Si hay fallo HMR: corregir error y guardar

## RECORDATORIO FINAL

**SIMPLE > PERFECTO**: Mejor un cambio pequeño que funcione que un gran plan que falle.

**VERIFICAR > SUPONER**: Si no puedes verificar, no hagas el cambio.

**FUNCIONANDO > REFACTORIZADO**: Código funcionando siempre mejor que código roto.

**HMR > REINICIO**: Vite actualiza solo, no interrumpas el flujo de desarrollo.

---

**ESTADO**: Listo para ejecutar Sesión 1
**PRÓXIMO PASO**: Extraer teoría musical de useMusic.js → musicTheory.js