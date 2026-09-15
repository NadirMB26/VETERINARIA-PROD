export type MetodoPago = 'efectivo' | 'tarjeta' | 'transferencia' | 'credito' | 'otro';

export interface MetodoPagoInfo {
  id: MetodoPago;
  nombre: string;
  icon: string;
}

export const METODOS_PAGO: MetodoPagoInfo[] = [
  { id: 'efectivo',     nombre: 'Efectivo',     icon: 'cash-outline' },
  { id: 'tarjeta',      nombre: 'Tarjeta',      icon: 'card-outline' },
  { id: 'transferencia',nombre: 'Transferencia',icon: 'swap-horizontal-outline' },
  { id: 'credito',      nombre: 'Crédito',      icon: 'hourglass-outline' },
  { id: 'otro',         nombre: 'Otro',         icon: 'ellipsis-horizontal-circle-outline' },
];

export const METODOS_PAGO_CHECKOUT: MetodoPagoInfo[] =
  METODOS_PAGO.filter(m => m.id !== 'credito');

export interface ItemVenta {
  idProducto: string;
  nombre: string;
  categoria: string;
  tipo: 'producto' | 'servicio';
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export interface PagoVenta {
  metodoPago: MetodoPago;
  monto: number;
  /** Efectivo recibido del cliente (solo método efectivo); el vuelto se deriva. */
  recibido?: number;
  /** Destino del vuelto en efectivo: 'efectivo' (se entrega en físico) o 'saldo' (se abona a saldo a favor). */
  vueltoDestino?: 'efectivo' | 'saldo';
  soportePago?: string;
}

export interface Venta {
  idVenta: string;
  idCliente: string;
  nombreCliente: string;
  idMascota?: string;
  nombreMascota?: string;
  /** Cita que originó la venta (si nació del agendamiento). */
  idCita?: string;
  /** Groomer asignado a la cita de estética que originó la venta. */
  idGroomer?: string;
  /** Origen de la venta: cita agendada o venta de mostrador. */
  origen?: 'cita' | 'mostrador';
  fecha: string;
  metodoPago: MetodoPago;
  soportePago?: string;
  pagos?: PagoVenta[];
  estadoPago: 'pagado' | 'pendiente' | 'anulada';
  items: ItemVenta[];
  subtotal: number;
  total: number;
  saldoAplicado: number;
  abonado: number;
  idVendedor: string;
  nombreVendedor: string;
}

export function ventaAnulada(v: Pick<Venta, 'estadoPago'>): boolean {
  return v.estadoPago === 'anulada';
}

export function saldoVenta(v: Venta): number {
  if (ventaAnulada(v)) return 0;
  return v.total - (v.abonado ?? 0);
}

export function metodosPagoNombre(v: Pick<Venta, 'metodoPago' | 'pagos'>): string {
  const metodos = (v.pagos?.length ? v.pagos : [{ metodoPago: v.metodoPago } as PagoVenta])
    .map(p => getMetodoPagoInfo(p.metodoPago).nombre);
  return [...new Set(metodos)].join(' + ');
}

export function saldoFavorCliente(cliente: any): number {
  return Number(cliente?.saldoFavor ?? 0);
}

export function requiereSoportePago(metodo: MetodoPago): boolean {
  return metodo === 'transferencia' || metodo === 'otro';
}

export function getMetodoPagoInfo(metodo: string): MetodoPagoInfo {
  return METODOS_PAGO.find(m => m.id === metodo) ?? METODOS_PAGO[0];
}

export function formatearPrecio(valor: number): string {
  return `$${valor.toLocaleString('es-CO')}`;
}
