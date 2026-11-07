<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="web/public/brand/astrowave-logotipo-color-oscuro.svg">
    <source media="(prefers-color-scheme: light)" srcset="web/public/brand/astrowave-logotipo-color-claro.svg">
    <img alt="AstroWave Logo" src="web/public/brand/astrowave-logotipo-color-oscuro.svg" width="380">
  </picture>

  <p align="center">
    <strong>Motor de sonificación astronómica y visualización espacial 3D en tiempo real.</strong>
  </p>

  <p align="center">
    <img src="https://img.shields.io/badge/Estado-Hito_3_(Producci%C3%B3n)-2dd4bf?style=for-the-badge" alt="Estado Hito 3" />
    <img src="https://img.shields.io/badge/Versi%C3%B3n-0.2.0-ffd45e?style=for-the-badge" alt="Versión 0.2.0" />
    <img src="https://img.shields.io/badge/ACUS220-UACh-0b1a2b?style=for-the-badge" alt="ACUS220 UACh" />
  </p>

  <p align="center">
    <img src="https://img.shields.io/badge/React_18-20232A?style=flat-square&logo=react&logoColor=61DAFB" alt="React" />
    <img src="https://img.shields.io/badge/Three.js-000000?style=flat-square&logo=threedotjs&logoColor=white" alt="Three.js" />
    <img src="https://img.shields.io/badge/Web_Audio_API-FF5722?style=flat-square&logo=html5&logoColor=white" alt="Web Audio API" />
    <img src="https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite" />
    <img src="https://img.shields.io/badge/Vitest-6E9F18?style=flat-square&logo=vitest&logoColor=white" alt="Vitest" />
    <img src="https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python" />
    <img src="https://img.shields.io/badge/SciPy-8CAAE6?style=flat-square&logo=scipy&logoColor=white" alt="SciPy" />
    <img src="https://img.shields.io/badge/Pandas-150458?style=flat-square&logo=pandas&logoColor=white" alt="Pandas" />
    <img src="https://img.shields.io/badge/NumPy-013243?style=flat-square&logo=numpy&logoColor=white" alt="NumPy" />
    <img src="https://img.shields.io/badge/Astropy-F89939?style=flat-square&logo=astropy&logoColor=white" alt="Astropy" />
  </p>
</div>

---

## Descripción General

**AstroWave** transforma parámetros astrofísicos reales (temperatura efectiva $T_{\text{eff}}$, paralaje trigonométrico y clasificación espectral) obtenidos de los catálogos **SIMBAD** y **TESS Input Catalog (TIC)** en firmas acústicas reproducibles. El sistema consta de un pipeline offline de extracción y síntesis en Python y una aplicación web interactiva con motor de síntesis en tiempo real y renderizado WebGL.

## Arquitectura del Sistema

```text
├── data/
│   ├── audio/                  # Exportaciones PCM 16-bit (.wav)
│   └── dataset_astrowave.csv   # Dataset consolidado y auditado
├── src/
│   ├── generar_dataset.py      # Ingesta desde SIMBAD / MAST (TIC)
│   └── generar_audio.py        # Motor DSP offline con SciPy
└── web/
    ├── public/brand/           # Activos vectoriales de identidad visual
    └── src/
        ├── audio/              # Síntesis en tiempo real (Web Audio API)
        ├── components/         # Interfaz React y osciloscopio Canvas 2D
        ├── data/               # Catálogo estelar estático (stars.json)
        ├── domain/             # Modelos matemáticos físico-acústicos y tests
        ├── hooks/              # Control de estado de reproducción
        ├── styles/             # Tokens de diseño y animaciones CSS
        └── three/              # Escena WebGL, shaders GLSL y vuelo espacial
```

## Modelo de Mapeo Físico-Acústico

| Variable Física | Unidad | Parámetro Acústico | Modelo de Transformación |
| :--- | :---: | :--- | :--- |
| Temperatura Efectiva ($T_{\text{eff}}$) | $\text{K}$ | Frecuencia Fundamental ($f_0$) | Interpolación por tramos / curva exponencial acotada en $[220, 880]\text{ Hz}$ |
| Tipo Espectral | MK (O–M) | Timbre / Forma de Onda | O, B $\rightarrow$ Sawtooth · A, F $\rightarrow$ Square · G $\rightarrow$ Triangle · K, M $\rightarrow$ Sine |
| Paralaje ($\varpi$) | $\text{mas}$ | Espacialidad (Wet Mix / Delay) | Atenuación logarítmica inversa acotada en $[0.10, 0.60]$ ($300\text{ ms}$ de delay) |
| Frecuencia Emitida | $\text{Hz}$ | Ganancia Psicoacústica | Atenuación lineal compensada entre $1.00$ ($220\text{ Hz}$) y $0.15$ ($880\text{ Hz}$) |

## Estado del Proyecto

- [x] **Hito 1 — Extracción y Mapeo Matemático:** consultas cruzadas automatizadas en SIMBAD y MAST (TIC), limpieza de valores ausentes (`NaN`) y formulación de funciones de sonificación.
- [x] **Hito 2 — Síntesis DSP Offline:** generación por lotes de señales de audio normalizadas en formato `.wav` ($44.1\text{ kHz}$, 16-bit PCM) con envolvente ADSR, eco y compensación de sonoridad.
- [x] **Hito 3 — Frontend Interactivo y Cierre:** aplicación web con intro cinemática de vuelo espacial en Three.js (shaders GLSL procedimentales y campo warp), doble proyección interactiva (Cielo y Vecindad 3D), síntesis nativa mediante `AudioContext`, visualización de onda en tiempo real y suite de pruebas unitarias con Vitest.

## Despliegue Local

### Frontend Web

```bash
cd web
npm install
npm run dev
```

Otros comandos disponibles:

```bash
npm run test      # Pruebas unitarias (Vitest)
npm run build     # Build de producción
npm run preview   # Vista previa del build
```

### Pipeline de Datos y Audio (Python)

```bash
pip install numpy pandas scipy astroquery
python src/generar_dataset.py
python src/generar_audio.py
```

## Autores

- Nicolás Córdova
- Sebastián Cuevas
- Andrés Seguel