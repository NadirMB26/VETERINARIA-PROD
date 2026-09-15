/**
 * Catálogo de fuentes disponibles para el selector de tipografía.
 * Nunito es la fuente actual de la app (por defecto).
 */
export interface FuenteDisponible {
  id: string;
  nombre: string;
  /** URL de Google Fonts (vacía si es la fuente del sistema por defecto). */
  googleUrl: string;
  /** Font-family CSS aplicable. */
  css: string;
}

export const FUENTES_DISPONIBLES: FuenteDisponible[] = [
  { id: 'nunito',     nombre: 'Nunito',     googleUrl: 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap', css: "'Nunito', sans-serif" },
  { id: 'inter',      nombre: 'Inter',      googleUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap', css: "'Inter', sans-serif" },
  { id: 'roboto',     nombre: 'Roboto',     googleUrl: 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;900&display=swap', css: "'Roboto', sans-serif" },
  { id: 'poppins',    nombre: 'Poppins',    googleUrl: 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap', css: "'Poppins', sans-serif" },
  { id: 'montserrat', nombre: 'Montserrat', googleUrl: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&display=swap', css: "'Montserrat', sans-serif" },
  { id: 'open-sans',  nombre: 'Open Sans',  googleUrl: 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700;800&display=swap', css: "'Open Sans', sans-serif" },
  { id: 'lato',       nombre: 'Lato',       googleUrl: 'https://fonts.googleapis.com/css2?family=Lato:wght@400;700;900&display=swap', css: "'Lato', sans-serif" },
  { id: 'quicksand',  nombre: 'Quicksand',  googleUrl: 'https://fonts.googleapis.com/css2?family=Quicksand:wght@400;600;700&display=swap', css: "'Quicksand', sans-serif" },
  { id: 'sistema',    nombre: 'Por defecto (sistema)', googleUrl: '', css: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
];

/** Caché de fuentes ya cargadas para no duplicar <link> de Google Fonts. */
const cargadas = new Set<string>();

/** Carga dinámicamente una fuente de Google Fonts (idempotente). */
export function cargarFuente(fuente: FuenteDisponible): void {
  if (!fuente.googleUrl || cargadas.has(fuente.id)) return;
  cargadas.add(fuente.id);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = fuente.googleUrl;
  document.head.appendChild(link);
}
