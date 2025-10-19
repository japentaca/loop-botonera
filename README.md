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
- **Escalas musicales**: Incluye minor, major, pentatonic, blues, dorian, phrygian
- **Interfaz moderna**: Diseño oscuro con efectos visuales y animaciones
- **Preview en tiempo real**: Escucha los cambios antes de aplicarlos

## Tecnologías Utilizadas

- **Tone.js**: Framework de audio web para síntesis y efectos
- **Web Audio API**: Para procesamiento de audio de baja latencia
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

Para desarrollo local, puedes usar cualquier servidor web estático:

```bash
# Con Python 3
python -m http.server 8000

# Con Node.js
npx http-server -p 8000

# Con PHP
php -S localhost:8000
```

Luego abre `http://localhost:8000` en tu navegador.

## Licencia

Este proyecto es de código abierto. Siéntete libre de usar, modificar y distribuir.