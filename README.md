# Loop Synth Machine 🎹

Una aplicación web interactiva para crear loops musicales con sintetizadores basada en Tone.js. Cada canal tiene su propio sintetizador configurable con editor de formas de onda y envolventes ADSR.

## Características

- **8 canales de loops independientes**: Cada canal puede tener su propio patrón, sintetizador y configuración
- **Editor de sintetizador avanzado**: 
  - Tipos de sintetizador: Synth, AMSynth, FMSynth, PluckSynth, MembraneSynth
  - Formas de onda: sine, triangle, square, sawtooth, fmsquare, pwm, pulse
  - Control completo de envolvente ADSR (Attack, Decay, Sustain, Release)
  - Controles específicos para FM y AM (harmonicity, modulationIndex)
- **Efectos globales**: Delay y Reverb configurables por canal
- **Escalas musicales**: Incluye minor, major, pentatonic, blues, dorian, phrygian y más
- **Interfaz moderna**: Diseño oscuro con efectos visuales y animaciones
- **Preview en tiempo real**: Escucha los cambios antes de aplicarlos

### 🆕 Nuevas Características

- **Patrones Polirrítmicos**: Loops con diferentes longitudes que crean ritmos complejos (ratios 3:2, 3:4, 5:4, 7:4, etc.)
- **Progresiones de Acordes**: Sistema avanzado con templates de progresiones (I-IV-V, ii-V-I, etc.) y generación de melodías conscientes de acordes
- **Modos de Evolución por Estilo**: 7 estilos musicales predefinidos (Ambient, Jazz, Techno, Classical, Minimal, Experimental, World) que controlan el comportamiento de la evolución automática

Ver [FEATURES.md](FEATURES.md) para documentación completa de las nuevas características.

## Tecnologías Utilizadas

- **Tone.js**: Framework de audio web para síntesis y efectos
- **Web Audio API**: Para procesamiento de audio de baja latencia
- **Vue 3**: Framework reactivo para la interfaz
- **Pinia**: Gestión de estado
- **HTML5/CSS3**: Interfaz responsiva y moderna
- **JavaScript ES6+**: Programación funcional y orientada a objetos

## Cómo Usar

1. Abre `index.html` en un navegador web moderno
2. Haz clic en el botón de play (▶) para iniciar el audio
3. Activa los canales que desees usando los botones L1-L8
4. Ajusta los parámetros con los controles deslizantes
5. Usa "🎛️ Editar Synth" para acceder al editor avanzado de cada canal
6. Experimenta con diferentes sintetizadores y formas de onda

## Tipos de Sintetizadores

### Synth Básico
Sintetizador estándar con oscilador y envolvente ADSR.

### AM Synth (Amplitude Modulation)
Sintetizador con modulación de amplitud para timbres más complejos.

### FM Synth (Frequency Modulation)
Sintetizador con modulación de frecuencia para sonidos metálicos y de campana.

### Pluck Synth
Sintetizador especializado en sonidos de cuerdas pulsadas.

### Membrane Synth
Sintetizador para sonidos de percusión y membranas.

## Controles de Envolvente ADSR

- **Attack**: Tiempo que tarda el sonido en alcanzar su volumen máximo
- **Decay**: Tiempo que tarda en bajar al nivel de sustain
- **Sustain**: Nivel de volumen mantenido mientras se mantiene la nota
- **Release**: Tiempo que tarda en silenciarse al soltar la nota

## Desarrollo

Para desarrollo local:

```bash
# Instalar dependencias
npm install

# Servidor de desarrollo
npm run dev

# Compilar para producción
npm run build

# Ejecutar tests
npm run test

# Tests en modo watch
npm run test:watch
```

Luego abre `http://localhost:5173` en tu navegador.

## Licencia

Este proyecto es de código abierto. Siéntete libre de usar, modificar y distribuir.