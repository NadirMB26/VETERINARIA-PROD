/**
 * @description
 * Une el agendamiento de citas con la venta/cuenta por cobrar.
 *
 * Toda cita se crea ligada a uno o más servicios del catálogo. En una sola
 * transacción se escriben la cita (con el snapshot de ítems y `idVenta`) y la
 * venta (`origen: 'cita'`) que alimenta Cobranza. El cobro inmediato es
 * posterior y opcional, reutilizando `VentaService.registrarAbono`.
 */
import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  runTransaction,
  updateDoc,
} from '@angular/fire/firestore';
import { Cita } from '../models/cita.model';
import { Producto } from '../models/producto.model';
import { ItemVenta, MetodoPago, Venta } from '../models/venta.model';
import { limpiarUndefined } from '../utils/firestore.util';
import { VentaService } from './venta.service';

export interface PagoInmediatoCita {
  monto: number;
  metodoPago: MetodoPago;
  soportePago?: string;
}

@Injectable({ providedIn: 'root' })
export class CitaVentaService {

  private firestore = inject(Firestore);
  private ventaSvc = inject(VentaService);

  private citasRef = collection(this.firestore, 'citas');
  private ventasRef = collection(this.firestore, 'ventas');

  /**
   * @description Crea la cita y su venta/cuenta por cobrar en una sola
   * transacción. Los ítems se re-precian desde el catálogo (fuente de verdad)
   * y, si son productos, se valida y descuenta stock.
   *
   * @returns Ids de cita y venta, y el total calculado.
   */
  async crearCitaConVenta(
    cita: Omit<Cita, 'idCita' | 'idVenta' | 'fechaRegistro'>,
    items: ItemVenta[],
  ): Promise<{ idCita: string; idVenta: string; total: number }> {
    if (!items.length) {
      throw new Error('La cita debe tener al menos un servicio');
    }

    // Validación de solape antes de escribir (la UI ya la hace; defensa extra).
    const esEstetica = cita.categoria === 'ESTETICA';
    const campo: 'idGroomer' | 'idVeterinario' = esEstetica ? 'idGroomer' : 'idVeterinario';
    const idAsignado = esEstetica ? (cita.idGroomer ?? '') : cita.idVeterinario;
    if (idAsignado) {
      const q = query(this.citasRef, where(campo, '==', idAsignado), where('fecha', '==', cita.fecha));
      const snap = await getDocs(q);
      const ini = this.toMinutos(cita.horaInicio);
      const fin = this.toMinutos(cita.horaFin);
      const solapa = snap.docs.some(d => {
        const c = d.data() as Cita;
        if (c.estado === 'cancelada' || c.estado === 'no_asistio') return false;
        return ini < this.toMinutos(c.horaFin) && fin > this.toMinutos(c.horaInicio);
      });
      if (solapa) {
        throw new Error(esEstetica
          ? 'El groomer ya tiene una cita en ese horario'
          : 'El veterinario ya tiene una cita en ese horario');
      }
    }

    const citaRef = doc(this.citasRef);
    const ventaRef = doc(this.ventasRef);

    return runTransaction(this.firestore, async (tx) => {
      // ── FASE 1: lecturas ──
      const itemsFinales: ItemVenta[] = [];
      const nuevosStock = new Map<string, number>();

      for (const item of items) {
        const prodRef = doc(this.firestore, 'productos', item.idProducto);
        const snap = await tx.get(prodRef);
        if (!snap.exists()) throw new Error(`El servicio "${item.nombre}" ya no existe`);

        const prod = snap.data() as Producto;
        if (prod.estado !== 'activo') {
          throw new Error(`El servicio "${prod.nombre}" no está disponible`);
        }

        const cantidad = Math.max(1, Number(item.cantidad) || 1);
        const precioUnitario = Number(prod.precio) || 0;
        itemsFinales.push({
          idProducto: item.idProducto,
          nombre: prod.nombre,
          categoria: prod.categoria,
          tipo: prod.tipo,
          cantidad,
          precioUnitario,
          subtotal: precioUnitario * cantidad,
        });

        if (prod.tipo === 'producto') {
          const stock = Number(prod.stock) || 0;
          if (stock < cantidad) throw new Error(`Stock insuficiente para ${prod.nombre}`);
          nuevosStock.set(item.idProducto, stock - cantidad);
        }
      }

      const subtotal = itemsFinales.reduce((acc, it) => acc + it.subtotal, 0);
      const total = subtotal;

      // ── FASE 2: escrituras ──
      for (const [idProducto, stock] of nuevosStock) {
        tx.update(doc(this.firestore, 'productos', idProducto), { stock });
      }

      tx.set(citaRef, limpiarUndefined({
        ...cita,
        itemsServicio: itemsFinales,
        totalEstimado: total,
        idVenta: ventaRef.id,
        fechaRegistro: new Date().toISOString(),
      }));

      tx.set(ventaRef, limpiarUndefined({
        idCliente: cita.idCliente,
        nombreCliente: cita.nombreCliente,
        idMascota: cita.idMascota,
        nombreMascota: cita.nombreMascota,
        idCita: citaRef.id,
        idGroomer: cita.idGroomer,
        origen: 'cita',
        fecha: cita.fecha,
        metodoPago: 'efectivo',
        // Una cita sin costo nace pagada y no aparece en Cobranza.
        estadoPago: total > 0 ? 'pendiente' : 'pagado',
        items: itemsFinales,
        subtotal,
        total,
        saldoAplicado: 0,
        abonado: 0,
        idVendedor: cita.idRecepcionista,
        nombreVendedor: cita.nombreRecepcionista,
      }));

      return { idCita: citaRef.id, idVenta: ventaRef.id, total };
    });
  }

  /**
   * @description Actualiza los servicios de una cita solo si su venta sigue
   * pendiente y sin abonos. Re-pricia desde el catálogo y sincroniza la cita.
   *
   * @returns El nuevo total, o 0 si la cita no tiene venta.
   */
  async actualizarVentaDeCita(idCita: string, items: ItemVenta[]): Promise<number> {
    if (!items.length) throw new Error('La cita debe tener al menos un servicio');

    const venta = await this.getVentaPorCitaOnce(idCita);
    if (!venta) return 0;

    if (venta.estadoPago !== 'pendiente' || (venta.abonado ?? 0) > 0) {
      throw new Error('La venta de la cita ya tiene abonos o no está pendiente');
    }

    const citaRef = doc(this.firestore, 'citas', idCita);
    const ventaRef = doc(this.firestore, 'ventas', venta.idVenta);

    return runTransaction(this.firestore, async (tx) => {
      const itemsFinales: ItemVenta[] = [];

      for (const item of items) {
        const snap = await tx.get(doc(this.firestore, 'productos', item.idProducto));
        if (!snap.exists()) throw new Error(`El servicio "${item.nombre}" ya no existe`);
        const prod = snap.data() as Producto;
        if (prod.estado !== 'activo') throw new Error(`El servicio "${prod.nombre}" no está disponible`);
        if (prod.tipo !== 'servicio') throw new Error('Solo se pueden agendar servicios en una cita');

        const cantidad = Math.max(1, Number(item.cantidad) || 1);
        const precioUnitario = Number(prod.precio) || 0;
        itemsFinales.push({
          idProducto: item.idProducto,
          nombre: prod.nombre,
          categoria: prod.categoria,
          tipo: prod.tipo,
          cantidad,
          precioUnitario,
          subtotal: precioUnitario * cantidad,
        });
      }

      const subtotal = itemsFinales.reduce((acc, it) => acc + it.subtotal, 0);
      const total = subtotal;

      tx.update(citaRef, { itemsServicio: itemsFinales, totalEstimado: total });
      tx.update(ventaRef, {
        items: itemsFinales,
        subtotal,
        total,
        estadoPago: total > 0 ? 'pendiente' : 'pagado',
      });

      return total;
    });
  }

  /**
   * @description Anula la venta pendiente de una cita (cancelación o no
   * asistencia). No anula ventas con abonos: esas requieren revisión manual.
   *
   * @returns true si la venta quedó anulada.
   */
  async anularVentaDeCita(idCita: string): Promise<boolean> {
    const venta = await this.getVentaPorCitaOnce(idCita);
    if (!venta || venta.estadoPago !== 'pendiente' || (venta.abonado ?? 0) > 0) {
      return false;
    }
    await updateDoc(doc(this.firestore, 'ventas', venta.idVenta), { estadoPago: 'anulada' });
    return true;
  }

  /** @description Registra cobros inmediatos sobre la venta de una cita. */
  async cobrarVenta(idVenta: string, pagos: PagoInmediatoCita[]): Promise<void> {
    const snap = await getDoc(doc(this.firestore, 'ventas', idVenta));
    if (!snap.exists()) throw new Error('La venta ya no existe');

    const venta = { idVenta: snap.id, ...snap.data() } as Venta;

    for (const p of pagos) {
      if (!(p.monto > 0)) continue;
      await this.ventaSvc.registrarAbono(idVenta, {
        idVenta,
        idCliente: venta.idCliente,
        nombreCliente: venta.nombreCliente,
        monto: p.monto,
        fecha: new Date().toISOString(),
        metodoPago: p.metodoPago,
        soportePago: p.soportePago,
        idVendedor: venta.idVendedor,
        nombreVendedor: venta.nombreVendedor,
        nota: 'Cobro al agendar cita',
      });
    }
  }

  /** @description Busca (una vez) la venta vinculada a una cita. */
  async getVentaPorCitaOnce(idCita: string): Promise<Venta | null> {
    const q = query(this.ventasRef, where('idCita', '==', idCita));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { idVenta: d.id, ...d.data() } as Venta;
  }

  private toMinutos(hora: string): number {
    const [h, m] = hora.split(':').map(Number);
    return h * 60 + m;
  }
}
