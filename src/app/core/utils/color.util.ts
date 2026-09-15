/**
 * Utilidades de color para el selector de tema.
 * Conversión HSV ↔ RGB ↔ HEX (sin librerías externas) y generación
 * de la paleta primaria derivada de un solo color base.
 */

export interface HSV { h: number; s: number; v: number; }
export interface RGB { r: number; g: number; b: number; }

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Convierte un HEX (#RGB o #RRGGBB) a RGB. Devuelve null si es inválido. */
export function hexToRgb(hex: string): RGB | null {
  let limpio = (hex ?? '').trim().replace('#', '');
  if (limpio.length === 3) {
    limpio = limpio.split('').map(c => c + c).join('');
  }
  if (!/^[0-9a-fA-F]{6}$/.test(limpio)) return null;
  return {
    r: parseInt(limpio.slice(0, 2), 16),
    g: parseInt(limpio.slice(2, 4), 16),
    b: parseInt(limpio.slice(4, 6), 16),
  };
}

export function rgbToHex(rgb: RGB): string {
  const a = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return `#${a(rgb.r)}${a(rgb.g)}${a(rgb.b)}`;
}

/** RGB → HSV (h 0-360, s 0-1, v 0-1). */
export function rgbToHsv(rgb: RGB): HSV {
  const r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

/** HSV → RGB (h 0-360, s 0-1, v 0-1). */
export function hsvToRgb(hsv: HSV): RGB {
  const h = ((hsv.h % 360) + 360) % 360;
  const s = clamp(hsv.s, 0, 1);
  const v = clamp(hsv.v, 0, 1);
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60)      { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else              { r = c; b = x; }
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
}

/** HEX → HSV (cómodo para inicializar el picker). */
export function hexToHsv(hex: string): HSV | null {
  const rgb = hexToRgb(hex);
  return rgb ? rgbToHsv(rgb) : null;
}

/** HSV → HEX. */
export function hsvToHex(hsv: HSV): string {
  return rgbToHex(hsvToRgb(hsv));
}

const mezclar = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);

/** Mezcla dos colores RGB con proporción t (0 = a, 1 = b). */
export function mezclarRgb(a: RGB, b: RGB, t: number): RGB {
  return {
    r: mezclar(a.r, b.r, t),
    g: mezclar(a.g, b.g, t),
    b: mezclar(a.b, b.b, t),
  };
}

export interface PaletaPrimaria {
  colorPrimario: string;
  dark: string;
  shade: string;
  light: string;
  tint: string;
  xlight: string;
  rgb: string;
}

/**
 * Deriva la paleta primaria completa a partir de un color base.
 * Mismo criterio visual que los temas predefinidos (base → oscuros/claros).
 */
export function generarPaleta(hex: string): PaletaPrimaria | null {
  const base = hexToRgb(hex);
  if (!base) return null;

  const blanco = { r: 255, g: 255, b: 255 };
  const negro = { r: 0, g: 0, b: 0 };

  const color = rgbToHex(base);
  return {
    colorPrimario: color,
    dark: rgbToHex(mezclarRgb(base, negro, 0.25)),      // hover / variantes oscuras
    shade: rgbToHex(mezclarRgb(base, negro, 0.45)),     // fondo de barras/acentos
    light: rgbToHex(mezclarRgb(base, blanco, 0.55)),    // bordes suaves
    tint: rgbToHex(mezclarRgb(base, blanco, 0.85)),     // fondos claros
    xlight: rgbToHex(mezclarRgb(base, blanco, 0.93)),   // fondos muy claros
    rgb: `${base.r}, ${base.g}, ${base.b}`,
  };
}

/**
 * Convierte un HSL/HSV a cadena CSS para el cuadro de saturación/valor:
 * degradado horizontal blanco→color y vertical transparente→negro.
 */
/**
 * Genera una tétrada a partir de un color base: `cantidad` colores
 * equidistantes sobre el círculo cromático (por defecto 4 matices a 90°),
 * conservando la saturación y el valor del color base para mantener la armonía.
 */
export function tetradaDe(hex: string, cantidad = 4): string[] {
  const hsv = hexToHsv(hex);
  if (!hsv) return [];
  const colores: string[] = [];
  for (let i = 0; i < cantidad; i++) {
    colores.push(hsvToHex({ ...hsv, h: (hsv.h + (360 / cantidad) * i) % 360 }));
  }
  return colores;
}

/** Normaliza un color HEX para comparaciones (minúsculas). */
export function normalizarHex(hex: string): string {
  return (hex ?? '').trim().toLowerCase().replace('#', '');
}

export function hsvGradientes(hue: number): { horizontal: string; vertical: string } {
  const c = hsvToHex({ h: hue, s: 1, v: 1 });
  return {
    horizontal: `linear-gradient(to right, #ffffff, ${c})`,
    vertical: 'linear-gradient(to top, #000000, rgba(0,0,0,0))',
  };
}
