// Rutas de los activos de marca (archivos en web/public/brand/). Único lugar donde viven los nombres.
const BASE = '/brand';

export const BRAND = {
  // Logotipo completo (símbolo + texto) para fondos oscuros
  logo: `${BASE}/astrowave-logotipo-color-oscuro.svg`,
  // Para fondos claros, por si se necesita (documentos, vistas previas)
  logoOnLight: `${BASE}/astrowave-logotipo-color-claro.svg`,
  symbol: `${BASE}/astrowave-simbolo-color-oscuro.svg`,
  symbolSimplified: `${BASE}/astrowave-simbolo-simplificado-color-oscuro.svg`,
};
