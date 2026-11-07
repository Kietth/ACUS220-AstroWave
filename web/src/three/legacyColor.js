import * as THREE from 'three';

// El prototipo se probó con three r128, que no aplicaba gestión de color.
// Estos ajustes reproducen ese aspecto con las versiones nuevas (r152+).
// Importar este módulo desde cada escena aplica el cambio una sola vez.
THREE.ColorManagement.enabled = false;

export const OUTPUT_COLOR_SPACE = THREE.LinearSRGBColorSpace;
// Desde r155 las intensidades de luz son físicas: se multiplican por PI para igualar r128.
export const LIGHT_SCALE = Math.PI;
