import { Injectable, computed, signal } from '@angular/core';
import { Producto, productoVendible } from '../models/producto.model';

export interface CarritoItem {
  producto: Producto;
  cantidad: number;
}

const KEY_CLIENTE = 'factura-cliente';
const KEY_ITEMS = 'factura-items';

@Injectable({ providedIn: 'root' })
export class CarritoService {

  private itemsSignal = signal<CarritoItem[]>([]);
  private clienteSignal = signal<any | null>(null);
  private saldoClienteSignal = signal(0);
  private usarSaldoSignal = signal(false);

  items = this.itemsSignal.asReadonly();
  cliente = this.clienteSignal.asReadonly();
  saldoCliente = this.saldoClienteSignal.asReadonly();
  usarSaldo = this.usarSaldoSignal.asReadonly();

  itemCount = computed(() => this.items().reduce((acc, it) => acc + it.cantidad, 0));

  subtotal = computed(() =>
    this.items().reduce((acc, it) => acc + it.producto.precio * it.cantidad, 0)
  );

  saldoAplicado = computed(() =>
    this.usarSaldo() ? Math.min(this.saldoCliente(), this.subtotal()) : 0
  );

  total = computed(() => this.subtotal() - this.saldoAplicado());

  maxCantidad(producto: Producto): number {
    return producto.tipo === 'servicio' ? Number.MAX_SAFE_INTEGER : producto.stock;
  }

  // ── Factura en curso ────────────────────────────────────

  iniciarFactura(cliente: any) {
    this.clienteSignal.set(cliente);
    this.saldoClienteSignal.set(Number(cliente?.saldoFavor ?? 0));
    this.usarSaldoSignal.set(false);
    this.itemsSignal.set([]);
    this.persistir();
  }

  /** Cambia el cliente de la factura en curso SIN perder los ítems del carrito. */
  cambiarCliente(cliente: any) {
    this.clienteSignal.set(cliente);
    this.saldoClienteSignal.set(Number(cliente?.saldoFavor ?? 0));
    this.usarSaldoSignal.set(false);
    this.persistir();
  }

  finalizarFactura() {
    this.resetSesion();
  }

  /** Limpia por completo el estado del carrito (p. ej. al cerrar sesión). */
  resetSesion() {
    this.clienteSignal.set(null);
    this.saldoClienteSignal.set(0);
    this.usarSaldoSignal.set(false);
    this.itemsSignal.set([]);
    localStorage.removeItem(KEY_CLIENTE);
    localStorage.removeItem(KEY_ITEMS);
  }

  /** Refresca el saldo a favor del cliente actual (tras consultarlo en Firestore). */
  actualizarSaldoCliente(monto: number) {
    this.saldoClienteSignal.set(Math.max(0, Number(monto) || 0));
  }

  toggleUsarSaldo(usar: boolean) {
    this.usarSaldoSignal.set(usar);
  }

  // ── Persistencia (sobrevive a recargas) ─────────────────

  cargarPersistido(productos: Producto[]) {
    try {
      const clienteRaw = localStorage.getItem(KEY_CLIENTE);
      if (clienteRaw) {
        const cliente = JSON.parse(clienteRaw);
        this.clienteSignal.set(cliente);
        this.saldoClienteSignal.set(Number(cliente?.saldoFavor ?? 0));
      }

      const itemsRaw = localStorage.getItem(KEY_ITEMS);
      if (itemsRaw) {
        const guardados: { idProducto: string; cantidad: number }[] = JSON.parse(itemsRaw);
        const items: CarritoItem[] = [];
        for (const g of guardados) {
          const producto = productos.find(p => p.idProducto === g.idProducto);
          if (!producto || !productoVendible(producto)) continue;
          const cantidad = Math.max(1, Math.min(g.cantidad, this.maxCantidad(producto)));
          items.push({ producto, cantidad });
        }
        this.itemsSignal.set(items);
      }
    } catch {
      this.finalizarFactura();
    }
  }

  private persistir() {
    const cliente = this.clienteSignal();
    if (cliente) {
      localStorage.setItem(KEY_CLIENTE, JSON.stringify(cliente));
    }
    localStorage.setItem(KEY_ITEMS, JSON.stringify(
      this.itemsSignal().map(it => ({ idProducto: it.producto.idProducto, cantidad: it.cantidad }))
    ));
  }

  // ── Carrito ─────────────────────────────────────────────

  agregar(producto: Producto): void {
    if (!productoVendible(producto)) return;

    const actual = this.itemsSignal();
    const existente = actual.find(it => it.producto.idProducto === producto.idProducto);

    if (existente) {
      this.cambiarCantidad(producto.idProducto, existente.cantidad + 1);
      return;
    }

    this.itemsSignal.set([...actual, { producto, cantidad: 1 }]);
    this.persistir();
  }

  cambiarCantidad(idProducto: string, cantidad: number): void {
    const items = this.itemsSignal();
    const item = items.find(it => it.producto.idProducto === idProducto);
    if (!item) return;

    const max = this.maxCantidad(item.producto);
    const clamp = Math.max(1, Math.min(cantidad, max));

    this.itemsSignal.set(
      items.map(it => it.producto.idProducto === idProducto ? { ...it, cantidad: clamp } : it)
    );
    this.persistir();
  }

  quitar(idProducto: string): void {
    this.itemsSignal.set(
      this.itemsSignal().filter(it => it.producto.idProducto !== idProducto)
    );
    this.persistir();
  }

  limpiar(): void {
    this.itemsSignal.set([]);
    this.persistir();
  }
}
