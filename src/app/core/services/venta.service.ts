import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, doc, query, where, runTransaction } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Venta, saldoVenta } from '../models/venta.model';
import { Abono } from '../models/pago.model';
import { limpiarUndefined } from '../utils/firestore.util';

@Injectable({ providedIn: 'root' })
export class VentaService {

  private firestore = inject(Firestore);
  private ventasRef = collection(this.firestore, 'ventas');
  private pagosRef = collection(this.firestore, 'pagos');

  getTodas(): Observable<Venta[]> {
    return collectionData(this.ventasRef, { idField: 'idVenta' }) as Observable<Venta[]>;
  }

  getPorCliente(idCliente: string): Observable<Venta[]> {
    const q = query(this.ventasRef, where('idCliente', '==', idCliente));
    return collectionData(q, { idField: 'idVenta' }) as Observable<Venta[]>;
  }

  getPagosPorVenta(idVenta: string): Observable<Abono[]> {
    const q = query(this.pagosRef, where('idVenta', '==', idVenta));
    return collectionData(q, { idField: 'idPago' }) as Observable<Abono[]>;
  }

  getAbonosPorCliente(idCliente: string): Observable<Abono[]> {
    const q = query(this.pagosRef, where('idCliente', '==', idCliente));
    return collectionData(q, { idField: 'idPago' }) as Observable<Abono[]>;
  }

  async registrarVenta(venta: Omit<Venta, 'idVenta'>): Promise<string> {
    const idVenta = doc(this.ventasRef).id;
    const pagos = (venta.pagos ?? []).filter(p => p.monto > 0);

    for (const p of pagos) {
      if (!(p.monto > 0)) {
        throw new Error('El monto de cada pago debe ser mayor a 0');
      }
    }

    const totalPagado = (venta.saldoAplicado ?? 0) + pagos.reduce((acc, p) => acc + p.monto, 0);

    // Vuelto que el cliente dejó como saldo a favor (no es pago de esta venta).
    const vueltoASaldo = pagos.reduce((acc, p) => {
      if (p.metodoPago !== 'efectivo' || p.vueltoDestino !== 'saldo' || !p.recibido) return acc;
      return acc + Math.max(0, p.recibido - p.monto);
    }, 0);

    await runTransaction(this.firestore, async (tx) => {
      // ── FASE 1: TODAS las lecturas (Firestore exige reads antes que writes) ──
      const nuevosStock = new Map<string, number>();
      for (const item of venta.items) {
        if (item.tipo !== 'producto') continue;

        const prodRef = doc(this.firestore, 'productos', item.idProducto);
        const snap = await tx.get(prodRef);

        if (!snap.exists()) {
          throw new Error(`El producto ${item.nombre} ya no existe`);
        }

        const stockActual: number = snap.data()['stock'] ?? 0;
        if (stockActual < item.cantidad) {
          throw new Error(`Stock insuficiente para ${item.nombre}`);
        }

        nuevosStock.set(item.idProducto, stockActual - item.cantidad);
      }

      const saldoAplicado = venta.saldoAplicado ?? 0;

      // ── Ajuste real del saldo a favor del cliente ──
      // - Se descuenta el saldo a favor que el cliente usó para pagar esta venta.
      // - Se abona el excedente pagado sobre el total (sobrepago) y el vuelto en
      //   efectivo cuyo destino es "saldo a favor".
      // - La deuda a crédito (pago parcial o nulo) NO toca el saldo a favor: queda
      //   como venta 'pendiente' cobrable desde Cobranza.
      const montosPagados = pagos.reduce((acc, p) => acc + p.monto, 0);
      const excedentePagado = Math.max(0, montosPagados - venta.total);
      const deltaSaldoFavor = -saldoAplicado + excedentePagado + vueltoASaldo;

      let nuevoSaldoFavor: number | null = null;
      if (deltaSaldoFavor !== 0) {
        const clienteRef = doc(this.firestore, 'clientes', venta.idCliente);
        const clienteSnap = await tx.get(clienteRef);
        const saldoFavor = Number(clienteSnap.exists() ? (clienteSnap.data()['saldoFavor'] ?? 0) : 0);
        nuevoSaldoFavor = saldoFavor + deltaSaldoFavor;
        if (nuevoSaldoFavor < 0) {
          throw new Error('El cliente no tiene saldo a favor suficiente para aplicar a esta venta');
        }
      }

      // ── FASE 2: TODAS las escrituras ──
      for (const [idProducto, stock] of nuevosStock) {
        tx.update(doc(this.firestore, 'productos', idProducto), { stock });
      }

      if (nuevoSaldoFavor !== null) {
        tx.update(doc(this.firestore, 'clientes', venta.idCliente), { saldoFavor: nuevoSaldoFavor });
      }

      const abonado = Math.min(totalPagado, venta.total);
      const estadoPago = abonado >= venta.total ? 'pagado' : 'pendiente';

      const primerPago = pagos[0];
      const docVenta = {
        ...venta,
        pagos,
        metodoPago: venta.metodoPago ?? primerPago?.metodoPago ?? 'efectivo',
        soportePago: venta.soportePago ?? primerPago?.soportePago,
        abonado,
        estadoPago,
      };

      tx.set(doc(this.firestore, 'ventas', idVenta), limpiarUndefined(docVenta));
    });

    return idVenta;
  }

  async registrarAbono(idVenta: string, abono: Omit<Abono, 'idPago'>): Promise<void> {
    const idPago = doc(this.pagosRef).id;

    await runTransaction(this.firestore, async (tx) => {
      const ventaRef = doc(this.firestore, 'ventas', idVenta);
      const ventaSnap = await tx.get(ventaRef);

      if (!ventaSnap.exists()) {
        throw new Error('La venta ya no existe');
      }

      const ventaData = ventaSnap.data() as Venta;
      const saldo = saldoVenta(ventaData);
      if (abono.monto <= 0 || abono.monto > saldo) {
        throw new Error(`El abono no puede superar el saldo pendiente (${saldo})`);
      }

      const nuevoAbonado = (ventaData.abonado ?? 0) + abono.monto;
      const nuevoEstado = nuevoAbonado >= ventaData.total ? 'pagado' : 'pendiente';

      tx.update(ventaRef, { abonado: nuevoAbonado, estadoPago: nuevoEstado });
      tx.set(doc(this.firestore, 'pagos', idPago), limpiarUndefined(abono));
    });
  }
}
