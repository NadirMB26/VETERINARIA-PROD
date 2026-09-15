import { MetodoPago } from './venta.model';

export interface Abono {
  idPago: string;
  idVenta: string;
  idCliente: string;
  nombreCliente: string;
  monto: number;
  fecha: string;
  metodoPago: MetodoPago;
  soportePago?: string;
  idVendedor: string;
  nombreVendedor: string;
  nota?: string;
}

export interface AjusteSaldo {
  idAjuste: string;
  idCliente: string;
  nombreCliente: string;
  monto: number;
  fecha: string;
  idVendedor: string;
  nombreVendedor: string;
  nota?: string;
}
