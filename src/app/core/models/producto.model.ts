export type CategoriaProducto = 'medicamentos' | 'alimentos' | 'accesorios' | 'servicios' | 'estetica';

export interface CategoriaInfo {
  id: CategoriaProducto;
  nombre: string;
  icon: string;
}

export const CATEGORIAS_PRODUCTO: CategoriaInfo[] = [
  { id: 'medicamentos', nombre: 'Medicamentos',  icon: 'medkit-outline' },
  { id: 'alimentos',    nombre: 'Alimentos',     icon: 'nutrition-outline' },
  { id: 'accesorios',   nombre: 'Accesorios',    icon: 'bag-handle-outline' },
  { id: 'servicios',    nombre: 'Servicios Médicos', icon: 'fitness-outline' },
  { id: 'estetica',     nombre: 'Estética',      icon: 'cut-outline' },
];

export type EstadoProducto = 'disponible' | 'stock-bajo' | 'por-vencer' | 'agotado' | 'descontinuado';

export interface Producto {
  idProducto: string;
  nombre: string;
  descripcion?: string;
  categoria: CategoriaProducto;
  tipo: 'producto' | 'servicio';
  /**
   * Tipo de cita médico que cubre este servicio (valor exacto de
   * `CATALOGO_TIPOS_CITA.tipo`, ej. 'Consulta general', 'Vacunación').
   * Permite filtrar el servicio al agendar una cita médica.
   */
  tipoCita?: string;
  /** Tipo de servicio de estética que representa (solo categoría `estetica`). */
  tipoServicioEstetica?: 'bano' | 'corte' | 'corte_y_bano' | 'deslanado' | 'otro';
  /** Duración estimada del servicio en minutos. */
  duracionMin?: number;
  /** Pasos/insumos que incluye el servicio (checklist que ve el groomer). */
  incluye?: string[];
  /**
   * Precio vigente que se cobra. Si hay promoción activa, este es el precio
   * con descuento; `precioAnterior` conserva el precio normal para restaurarlo
   * cuando la promoción se quita o vence.
   */
  precio: number;
  /** Costo de adquisición (opcional, solo informativo). */
  costo?: number;
  /** Código interno único (opcional). */
  sku?: string;
  stock: number;
  stockMinimo: number;
  fechaVencimiento?: string;
  fotoUrl?: string;
  /**
   * Precio normal antes de la promoción: si es mayor que `precio`, se muestra
   * tachado con badge de descuento y es el valor al que se restaura el precio
   * cuando la promoción termina.
   */
  precioAnterior?: number;
  /** Tipo de oferta activa sobre el producto. */
  ofertaTipo?: 'diaria' | 'semanal';
  /** Fecha ISO (YYYY-MM-DD) en que expira la oferta. */
  ofertaFin?: string;
  /** Etiqueta secundaria opcional, ej. "Cupón 30% OFF". */
  cupon?: string;
  estado: 'activo' | 'descontinuado';
  fechaRegistro: string;
}

export const DIAS_POR_VENCER = 30;

export function getCategoriaInfo(categoria: string): CategoriaInfo {
  return CATEGORIAS_PRODUCTO.find(c => c.id === categoria) ?? CATEGORIAS_PRODUCTO[0];
}

export function diasParaVencer(fechaVencimiento?: string): number | null {
  if (!fechaVencimiento) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const venc = new Date(fechaVencimiento + 'T00:00:00');
  return Math.round((venc.getTime() - hoy.getTime()) / 86400000);
}

export function calcularEstadoProducto(p: Producto): EstadoProducto {
  if (p.estado === 'descontinuado') return 'descontinuado';
  if (p.tipo === 'servicio') return 'disponible';
  if (p.stock <= 0) return 'agotado';
  const dias = diasParaVencer(p.fechaVencimiento);
  if (dias !== null && dias <= DIAS_POR_VENCER) return 'por-vencer';
  if (p.stock <= p.stockMinimo) return 'stock-bajo';
  return 'disponible';
}

/**
 * Calcula el porcentaje de descuento de un producto.
 * Fórmula: Math.round((1 - precioActual/precioAnterior) * 100).
 * Devuelve null si no hay precio anterior o el descuento no aplica.
 */
export function calcularDescuento(p: Producto): number | null {
  if (!p.precioAnterior || p.precioAnterior <= 0) return null;
  if (p.precio >= p.precioAnterior) return null;
  return Math.round((1 - p.precio / p.precioAnterior) * 100);
}

/**
 * Calcula el precio de promoción a partir del precio normal y el porcentaje
 * de descuento a aplicar (ej. 5 = 5%). El resultado se redondea a pesos.
 * Solo acepta descuentos entre 1 y 99; fuera de ese rango devuelve el precio normal.
 */
export function calcularPrecioPromocion(precioNormal: number, pctDescuento: number): number {
  const normal = Math.max(0, Number(precioNormal) || 0);
  const pct = Number(pctDescuento) || 0;
  if (pct < 1 || pct > 99) return normal;
  return Math.round(normal * (1 - pct / 100));
}

/**
 * Determina si la oferta de un producto está vigente (no expirada).
 * `precio` es el precio vigente que se cobra; la oferta solo se muestra
 * si hay descuento real y la fecha de fin no ha pasado.
 */
export function ofertaVigente(p: Producto): boolean {
  if (!p.ofertaTipo || !p.ofertaFin) return false;
  if (calcularDescuento(p) === null) return false;
  return p.ofertaFin >= fechaIsoHoy();
}

/** Fecha de hoy en formato YYYY-MM-DD (local). */
export function fechaIsoHoy(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Tiempo restante hasta `fechaFin` en días/horas/minutos/segundos.
 * Se usa para el countdown en vivo de las ofertas.
 */
export function tiempoRestanteOferta(fechaFin: string): { d: number; h: number; m: number; s: number; total: number } {
  const fin = new Date(fechaFin + 'T23:59:59');
  const diff = Math.max(0, fin.getTime() - Date.now());
  const s = Math.floor(diff / 1000);
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
    total: s,
  };
}

/** Formatea el tiempo restante: "Xd Xh Xm Xs" o "Xh Xm Xs" si faltan menos de 24h. */
export function formatearTiempoRestante(fechaFin: string): string {
  const t = tiempoRestanteOferta(fechaFin);
  if (t.d > 0) return `${t.d}d ${t.h}h ${t.m}m ${t.s}s`;
  return `${t.h}h ${t.m}m ${t.s}s`;
}

export function productoVendible(p: Producto): boolean {
  return p.estado === 'activo'
    && (p.tipo === 'servicio' || p.stock > 0)
    && !(p.tipo === 'producto'
      && diasParaVencer(p.fechaVencimiento) !== null
      && diasParaVencer(p.fechaVencimiento)! <= DIAS_POR_VENCER);
}

export const ETIQUETAS_ESTADO_PRODUCTO: Record<EstadoProducto, string> = {
  'disponible': 'Disponible',
  'stock-bajo': 'Stock bajo',
  'por-vencer': 'Por vencer',
  'agotado': 'Agotado',
  'descontinuado': 'Descontinuado',
};

export const BADGE_CLASES_ESTADO_PRODUCTO: Record<EstadoProducto, string> = {
  'disponible': 'badge-disponible',
  'stock-bajo': 'badge-stock-bajo',
  'por-vencer': 'badge-por-vencer',
  'agotado': 'badge-agotado',
  'descontinuado': 'badge-descontinuado',
};
