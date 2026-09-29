# AstroWave

## Integrantes

- Nicolás Córdova
- Sebastián Cuevas
- Andrés Seguel

## Idea del proyecto

Tomar bases de datos astronómicas, crear un script que mapee estos valores matemáticos a parámetros acústicos  

Ej:  

    -Distancia = Efecto (Eco, distorsión)  
    -Temperatura = Frecuencia en hercios  
    -Tipo de radiación = Timbre (tipo de instrumento o sintetizador)  

## Pregunta principal
Pregunta provisional que queremos estudiar.

¿Cómo podemos definir transformaciones matemáticas que mapeen las propiedades físicas de las estrellas (como temperatura, paralaje y tipo espectral) en atributos sonoros (pitch, reverberación, timbre) de forma coherente y reproducible?   

## Motivación

¿Por qué nos interesa este problema?
¿Qué esperamos aprender?

Buscamos representar relaciones físicas interpretables a través del sonido (sonificación), permitiendo experimentar datos astronómicos reales de una forma sensorial diferente. Esperamos aprender a extraer, limpiar y auditar datos desde catálogos astronómicos mediante programación, y conectar esos modelos matemáticos con la síntesis de audio computacional y el desarrollo web.

## Datos

- Fuente: Catálogo SIMBAD y TESS Input Catalog (TIC) vía MAST (usando Astroquery).
- Tipo de datos: Parámetros astrofísicos reales (Temperatura efectiva en Kelvin, Paralaje en milisegundos de arco).
- Formato: Descarga estructurada vía API consolidada en DataFrames de Pandas y exportada como CSV.
- Cantidad aproximada: Actualmente un listado de estrellas de prueba (Betelgeuse, Sirius, Rigel, Aldebaran, Vega, Polaris), pero la metodología es escalable a catálogos masivos.
- Etiquetas disponibles: Identificadores principales de las estrellas y clasificación de Tipo Espectral.
- Aspectos que todavía debemos investigar: Cómo manejar dinámicamente estrellas que exceden nuestros límites de mapeo (ej. Rigel con 12100 K que satura la frecuencia máxima), y afinar la relación exacta para el timbre/instrumento.

## Alcance inicial

¿Qué pensamos que sería razonable desarrollar durante el semestre?  
Durante el semestre desarrollaremos un flujo de trabajo que vaya desde la extracción automática y limpieza de datos astronómicos hasta la síntesis de audio. El objetivo final razonable es una página interactiva (frontend) con modelos 3D de las estrellas (Three.js), visualización de ondas (Wavesurfer.js) y la telemetría donde el usuario pueda "escuchar" la firma acústica de un catálogo seleccionado de astros.

## Pipeline provisional

Datos
→ Auditoría, extracción y limpieza (manejo de NaNs con Pandas)  
→ Modelo de transformación matemática (Mapeo de Teff a Frecuencia y Paralaje a Reverb)  
→ Almacenamiento estructurado (dataset_astrowave.csv)  
→ Síntesis de parámetros acústicos a señales de sonido (Python/Scipy)  
→ Despliegue en interfaz web interactiva (Frontend)  
## Posibles dificultades

- Gestión de datos: Manejar tablas con miles de filas de datos
- Ausencia de datos utilizables: Lidiar con valores físicos faltantes ($NaN$) en los registros, como ocurrió al buscar la distancia directa de Betelgeuse en SIMBAD o la ausencia de temperatura efectiva para estrellas como Polaris en el catálogo TIC.
- Cruces de catálogos (Cross-match): Evitar asociaciones espaciales erróneas al combinar identificadores de diferentes catálogos astronómicos (ej. SIMBAD vs Gaia).
  
## Estado actual

¿Qué hemos realizado hasta ahora?

- Auditoría profunda de los datos de Betelgeuse en SIMBAD y TIC mediante Jupyter Notebooks, documentando la procedencia de los valores.
- Desarrollo de un script automatizado (generar_dataset.py) que extrae variables reales, filtra registros incompletos y aplica funciones matemáticas de mapeo (frecuencia y reverberación).
- Consolidación del primer conjunto de datos funcional (dataset_astrowave.csv).

## Próximos pasos

1. Investigar la librería Scipy para dar inicio al Hito 2  
2. Crear script que lea la columna de AstroWave_Freq_Hz de nuestro dataset y genere los archivos wav  
3. Definir matemáticamente cómo la columna Tipo_Espectral modificará nuestro sonido  
