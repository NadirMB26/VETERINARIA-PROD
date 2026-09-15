import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, of, Subscription } from 'rxjs';
import { PopoverController } from '@ionic/angular';
import { ProductoService } from 'src/app/core/services/producto.service';
import { CarritoService } from 'src/app/core/services/carrito.service';
import { VentaService } from 'src/app/core/services/venta.service';
import { MascotaService } from 'src/app/core/services/mascota.service';
import { UserService } from 'src/app/core/services/user.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { UtilidadesService } from 'src/app/core/services/utilidades.service';
import { BannerService } from 'src/app/core/services/banner.service';
import { FacturaService } from 'src/app/core/services/factura.service';
import { ConfiguracionAppService } from 'src/app/core/services/configuracion-app.service';
import { ConfiguracionApp } from 'src/app/core/models/configuracion-app.model';
import { BannerSlide } from 'src/app/core/models/banner.model';
import { ClienteSelectorComponent } from 'src/app/shared/components/cliente-selector/cliente-selector.component';
import { DisponibilidadFiltro } from './components/ventas-sidebar/ventas-sidebar.component';
import {
  Producto,
  CategoriaProducto,
  productoVendible,
  ofertaVigente,
  calcularEstadoProducto,
  getCategoriaInfo,
} from 'src/app/core/models/producto.model';
import {
  MetodoPago,
  MetodoPagoInfo,
  METODOS_PAGO_CHECKOUT,
  PagoVenta,
  requiereSoportePago,
} from 'src/app/core/models/venta.model';

interface PagoDraft {
  metodoPago: MetodoPago;
  montoStr: string;
  /** Efectivo recibido del cliente (solo método efectivo). */
  recibidoStr?: string;
  /** Destino del vuelto: 'efectivo' (se entrega) o 'saldo' (abono a saldo a favor). */
  vueltoDestino?: 'efectivo' | 'saldo';
  soportePago?: string;
}

const montoDe = (p: PagoDraft): number => {
  const n = Number(p.montoStr);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
};

@Component({
  selector: 'app-ventas',
  templateUrl: './ventas.page.html',
  styleUrls: ['./ventas.page.scss'],
  standalone: false
})
export class VentasPage implements OnInit, OnDestroy {

  metodosCheckout: MetodoPagoInfo[] = [
    ...METODOS_PAGO_CHECKOUT,
    { id: 'credito', nombre: 'Crédito (cliente debe)', icon: 'hourglass-outline' },
  ];

  productos: Producto[] = [];
  busqueda = '';
  categoriaFiltro: CategoriaProducto | null = null;
  tipoFiltro: 'producto' | 'servicio' | null = null;
  soloOfertas = false;
  disponibilidadFiltro: DisponibilidadFiltro = null;
  precioMin: number | null = null;
  precioMax: number | null = null;
  sidebarOpen = false;

  drawerOpen = false;

  mascotas: any[] = [];
  mascotaId = '';
  pagos: PagoDraft[] = [{ metodoPago: 'efectivo', montoStr: '' }];
  registrando = false;

  nombreVendedor = '';
  idVendedor = '';

  // ── Factura al finalizar la venta ──
  ventaRegistrada: any = null;
  generandoFactura = false;
  facturaLista = false;
  facturaUrl = '';
  configApp: ConfiguracionApp | null = null;

  private productosSub?: Subscription;
  private mascotasSub?: Subscription;

  private routeParamsSub?: Subscription;

  carrito = inject(CarritoService);
  private router = inject(Router);
  private bannerSvc = inject(BannerService);
  private facturaSvc = inject(FacturaService);
  private configSvc = inject(ConfiguracionAppService);

  /** Slides activos del banner promocional (configurado por el admin). */
  banners$: Observable<BannerSlide[]> = of([]);

  constructor(
    private route: ActivatedRoute,
    private productoSvc: ProductoService,
    private ventaSvc: VentaService,
    private mascotaSvc: MascotaService,
    private userSvc: UserService,
    private authSvc: AuthService,
    private util: UtilidadesService,
    private popoverCtrl: PopoverController,
  ) {}

  ngOnInit(): void {
    this.banners$ = this.bannerSvc.getActivos();

    this.configSvc.getConfiguracion().subscribe(cfg => {
      this.configApp = cfg ?? null;
    });

    this.productosSub = this.productoSvc.getTodos().subscribe(productos => {
      this.productos = productos;
      this.carrito.cargarPersistido(productos);
    });

    const uid = this.authSvc.getUidActual();
    const rol = this.authSvc.getRolActual();
    if (uid && rol) {
      void this.userSvc.getDocumentOnce(this.userSvc.getColeccionPorRol(rol), uid).then(data => {
        if (data) {
          this.idVendedor = uid;
          this.nombreVendedor = `${data.Nombre ?? ''} ${data.Apellido ?? ''}`.trim() || uid;
        }
      });
    }

    this.routeParamsSub = this.route.queryParams.subscribe(params => {
      const catalogo = params['catalogo'];
      this.tipoFiltro = catalogo === 'productos' || catalogo === 'servicios' ? catalogo : null;
    });
  }

  ngOnDestroy(): void {
    this.productosSub?.unsubscribe();
    this.mascotasSub?.unsubscribe();
    this.routeParamsSub?.unsubscribe();
  }

  /** Normaliza el tipo de un ítem: los documentos legados sin `tipo` se tratan como productos. */
  private tipoDe(p: Producto): 'producto' | 'servicio' {
    return p.tipo === 'servicio' ? 'servicio' : 'producto';
  }

  get filtrados(): Producto[] {
    const texto = this.busqueda.trim().toLowerCase();
    return this.productos.filter(p => {
      if (this.tipoFiltro && this.tipoDe(p) !== this.tipoFiltro) return false;
      if (this.categoriaFiltro && p.categoria !== this.categoriaFiltro) return false;
      if (this.soloOfertas && !ofertaVigente(p)) return false;
      if (this.disponibilidadFiltro) {
        const e = calcularEstadoProducto(p);
        if (this.disponibilidadFiltro === 'disponible' && e !== 'disponible') return false;
        if (this.disponibilidadFiltro === 'stock-bajo' && e !== 'stock-bajo') return false;
        if (this.disponibilidadFiltro === 'agotado' && e !== 'agotado') return false;
      }
      if (this.precioMin !== null && p.precio < this.precioMin) return false;
      if (this.precioMax !== null && p.precio > this.precioMax) return false;
      if (!texto) return true;
      return p.nombre.toLowerCase().includes(texto)
        || p.descripcion?.toLowerCase().includes(texto);
    });
  }

  /** Cantidad de filtros activos (para el badge del botón "Filtros" en mobile). */
  get filtrosActivos(): number {
    let n = 0;
    if (this.busqueda.trim()) n++;
    if (this.tipoFiltro) n++;
    if (this.categoriaFiltro) n++;
    if (this.soloOfertas) n++;
    if (this.disponibilidadFiltro) n++;
    if (this.precioMin !== null) n++;
    if (this.precioMax !== null) n++;
    return n;
  }

  onPrecioChange(rango: { min: number | null; max: number | null }) {
    this.precioMin = rango.min;
    this.precioMax = rango.max;
  }

  /** Productos con oferta vigente para la sección de ofertas. */
  get ofertasVigentes(): Producto[] {
    return this.productos.filter(ofertaVigente);
  }

  get contadorResultados(): number {
    return this.filtrados.length;
  }

  puedeVender(p: Producto): boolean {
    return productoVendible(p);
  }

  /** Ícono de categoría para el drawer del carrito. */
  iconoCategoria(p: Producto): string {
    return getCategoriaInfo(p.categoria).icon;
  }

  toggleOfertas() {
    this.soloOfertas = !this.soloOfertas;
  }

  irAGestion() {
    this.router?.navigate(['/layout/productos']);
  }

  // ── Factura en curso (cliente primero) ─────────────
  async agregarAlCarrito(p: Producto) {
    if (!this.carrito.cliente()) {
      this.util.showToast('Selecciona primero el cliente de la factura', 'warning');
      await this.seleccionarCliente();
      return;
    }
    this.carrito.agregar(p);
    this.util.showToast(`${p.nombre} agregado al carrito`, 'success');
  }

  async seleccionarCliente() {
    await this.abrirSelectorCliente();
  }

  private async abrirSelectorCliente() {
    const popover = await this.popoverCtrl.create({
      component: ClienteSelectorComponent,
      cssClass: 'cliente-selector-popover',
    });
    await popover.present();
    const { data } = await popover.onWillDismiss();
    if (data?.cliente) {
      // Si hay ítems en el carrito, solo se cambia el cliente (el carrito no se pierde).
      if (this.carrito.items().length > 0) {
        this.carrito.cambiarCliente(data.cliente);
        this.util.showToast('Cliente cambiado, carrito intacto', 'success');
      } else {
        this.carrito.iniciarFactura(data.cliente);
      }
      // Saldo a favor REAL desde Firestore (evita montos obsoletos tras ventas previas).
      const idCliente = data.cliente.idCliente ?? data.cliente.uid;
      this.userSvc.getDocumentOnce(this.userSvc.getColeccionPorRol('cliente'), idCliente).then(doc => {
        if (doc) this.carrito.actualizarSaldoCliente(Number(doc.saldoFavor ?? 0));
      });
      this.mascotaId = '';
      this.mascotas = [];
      this.resetPagos();
      this.cargarMascotasCliente();
    }
  }

  private cargarMascotasCliente() {
    const cliente = this.carrito.cliente();
    if (!cliente) return;
    this.mascotasSub?.unsubscribe();
    this.mascotasSub = this.mascotaSvc.getMascotasPorCliente(
      cliente.idCliente ?? cliente.uid
    ).subscribe(mascotas => { this.mascotas = mascotas; });
  }

  cerrarFactura() {
    this.carrito.finalizarFactura();
    this.mascotaId = '';
    this.mascotas = [];
    this.resetPagos();
  }

  cambiarCantidad(id: string, delta: number) {
    const item = this.carrito.items().find(i => i.producto.idProducto === id);
    if (item) this.carrito.cambiarCantidad(id, item.cantidad + delta);
  }

  // ── Drawer / checkout ──────────────────────────────
  abrirCarrito() {
    // Si quedó un panel de venta registrada de una venta anterior, se descarta.
    this.limpiarVentaOk();
    this.drawerOpen = true;
  }

  onCerrarDrawer() {
    this.limpiarVentaOk();
    this.drawerOpen = false;
  }

  /** Limpia el panel de "venta registrada" y libera el blob de la factura. */
  private limpiarVentaOk() {
    if (this.facturaUrl) URL.revokeObjectURL(this.facturaUrl);
    this.ventaRegistrada = null;
    this.facturaLista = false;
    this.facturaUrl = '';
    this.generandoFactura = false;
  }

  private resetPagos() {
    this.pagos = [{ metodoPago: 'efectivo', montoStr: '' }];
  }

  get totalVenta(): number {
    return this.carrito.total();
  }

  get sumaPagos(): number {
    return this.pagos.reduce((acc, p) => acc + montoDe(p), 0);
  }

  get saldoPendiente(): number {
    return Math.max(0, this.totalVenta - this.sumaPagos - this.carrito.saldoAplicado());
  }

  get pctPagado(): number {
    if (this.totalVenta <= 0) return 100;
    const pagado = this.sumaPagos + this.carrito.saldoAplicado();
    return Math.min(100, Math.round((pagado / this.totalVenta) * 100));
  }

  get pagadoCompleto(): boolean {
    return this.saldoPendiente <= 0;
  }

  get haySobrepago(): boolean {
    return this.sumaPagos > this.totalVenta;
  }

  get excedentePago(): number {
    return Math.max(0, this.sumaPagos - this.totalVenta);
  }

  requiereSoporteDe(p: PagoDraft): boolean {
    return requiereSoportePago(p.metodoPago);
  }

  soporteFaltaDe(p: PagoDraft): boolean {
    return this.requiereSoporteDe(p) && !p.soportePago;
  }

  setMetodoPago(idx: number, metodoPago: MetodoPago) {
    this.pagos = this.pagos.map((p, i) =>
      i === idx ? {
        ...p,
        metodoPago,
        soportePago: undefined,
        recibidoStr: undefined,
        vueltoDestino: undefined,
        montoStr: metodoPago === 'credito' ? '' : p.montoStr,
      } : p
    );
  }

  /** Indica si el vuelto de un pago en efectivo se abona a saldo a favor del cliente. */
  setVueltoDestino(idx: number, destino: 'efectivo' | 'saldo') {
    this.pagos = this.pagos.map((p, i) => i === idx ? { ...p, vueltoDestino: destino } : p);
  }

  setMonto(idx: number, valor: string) {
    // Solo dígitos: se descartan letras, símbolos y el signo negativo.
    const montoStr = String(valor ?? '').replace(/\D/g, '');
    this.pagos = this.pagos.map((p, i) => i === idx ? { ...p, montoStr } : p);
  }

  // ── Efectivo: monto recibido + vuelto ───────────────
  recibidoDe(p: PagoDraft): number {
    const n = Number(p.recibidoStr);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }

  /** El ngFor de pagos se identifica por índice para no recrear los inputs en cada tecla. */
  trackByPago(index: number): number {
    return index;
  }

  /**
   * Al ingresar el efectivo recibido se auto-completa el monto aplicado:
   * monto = min(recibido, saldo restante sin este pago). El vuelto se deriva.
   * Se escribe `recibidoStr` con lo tipeado para que el input no se reseteé
   * (el ngModel es de una sola vía y sin esta escritura el valor se pierde).
   */
  onRecibidoChange(idx: number, valor: string) {
    // Solo dígitos: se descartan letras, símbolos y el signo negativo.
    const recibidoStr = String(valor ?? '').replace(/\D/g, '');
    const recibido = recibidoStr ? Number(recibidoStr) : 0;
    const sinEstePago = this.sumaPagos - montoDe(this.pagos[idx]);
    const restante = Math.max(0, this.totalVenta - sinEstePago - this.carrito.saldoAplicado());
    const monto = Math.min(recibido, restante);
    this.pagos = this.pagos.map((p, i) =>
      i === idx ? { ...p, montoStr: monto > 0 ? String(monto) : '', recibidoStr } : p
    );
  }

  /** Vuelto a entregar: efectivo recibido menos monto aplicado. */
  vueltoDe(p: PagoDraft): number {
    if (p.metodoPago !== 'efectivo') return 0;
    return Math.max(0, this.recibidoDe(p) - montoDe(p));
  }

  agregarPago() {
    if (this.pagos.length >= 3) {
      this.util.showToast('Máximo 3 métodos de pago por venta', 'warning');
      return;
    }
    const usado = new Set(this.pagos.map(p => p.metodoPago));
    const libre = this.metodosCheckout.find(m => !usado.has(m.id) && m.id !== 'credito');
    const metodo = libre?.id ?? 'efectivo';
    const resto = Math.max(0, this.totalVenta - this.sumaPagos);
    this.pagos = [...this.pagos, { metodoPago: metodo, montoStr: resto ? String(resto) : '' }];
  }

  quitarPago(idx: number) {
    if (this.pagos.length === 1) {
      this.resetPagos();
      return;
    }
    this.pagos = this.pagos.filter((_, i) => i !== idx);
  }

  pagarTodo(idx: number) {
    const resto = Math.max(0, this.totalVenta - this.sumaPagos + montoDe(this.pagos[idx]));
    this.pagos = this.pagos.map((p, i) => i === idx ? { ...p, montoStr: String(resto) } : p);
  }

  async onSoporteSeleccionado(event: any, idx: number) {
    const file = event.target.files?.[0];
    if (!file) return;

    const permitidos = ['image/png', 'image/jpeg', 'image/webp'];
    if (!permitidos.includes(file.type)) {
      this.util.showToast('Solo se permiten imágenes (PNG, JPG, WEBP)', 'danger');
      return;
    }
    if (file.size > 300 * 1024) {
      this.util.showToast('El soporte no puede superar 300 KB', 'danger');
      return;
    }

    try {
      const base64 = await this.fileToBase64(file);
      this.pagos = this.pagos.map((p, i) => i === idx ? { ...p, soportePago: base64 } : p);
    } catch {
      this.util.showToast('No se pudo leer el soporte', 'danger');
    }
  }

  quitarSoporte(idx: number) {
    this.pagos = this.pagos.map((p, i) => i === idx ? { ...p, soportePago: undefined } : p);
  }

  get checkoutValido(): boolean {
    if (this.carrito.items().length === 0) return false;
    if (!this.carrito.cliente()) return false;
    if (this.pagos.some(p => this.soporteFaltaDe(p))) return false;
    // Debe haber al menos un pago real, saldo a favor aplicado o crédito explícito.
    if (this.sumaPagos <= 0 && this.carrito.saldoAplicado() <= 0) {
      return this.pagos.some(p => p.metodoPago === 'credito');
    }
    return true;
  }

  async registrarVenta() {
    if (!this.checkoutValido || this.registrando) return;

    this.registrando = true;
    try {
      const cliente = this.carrito.cliente();
      const items = this.carrito.items().map(it => ({
        idProducto: it.producto.idProducto,
        nombre: it.producto.nombre,
        categoria: it.producto.categoria,
        tipo: it.producto.tipo,
        cantidad: it.cantidad,
        precioUnitario: it.producto.precio,
        subtotal: it.producto.precio * it.cantidad,
      }));

      const subtotal = items.reduce((acc, it) => acc + it.subtotal, 0);
      const saldoAplicado = this.carrito.saldoAplicado();
      const mascota = this.mascotas.find(m => m.idMascota === this.mascotaId);

      const pagosValidos: PagoVenta[] = this.pagos
        .filter(p => montoDe(p) > 0)
        .map(p => {
          const vuelto = p.metodoPago === 'efectivo' ? this.vueltoDe(p) : 0;
          return {
            metodoPago: p.metodoPago,
            monto: montoDe(p),
            recibido: p.metodoPago === 'efectivo' && this.recibidoDe(p) > 0 ? this.recibidoDe(p) : undefined,
            ...(vuelto > 0 && p.vueltoDestino === 'saldo' ? { vueltoDestino: 'saldo' as const } : {}),
            soportePago: p.soportePago || undefined,
          };
        });

      const primerPago = pagosValidos[0];
      const totalVenta = subtotal - saldoAplicado;
      const abonado = Math.min(
        saldoAplicado + pagosValidos.reduce((acc, p) => acc + p.monto, 0),
        totalVenta
      );
      const estadoPago: 'pagado' | 'pendiente' = abonado >= totalVenta ? 'pagado' : 'pendiente';
      // Crédito explícito: el cliente no pagó nada y se eligió el método "Crédito".
      const esCredito = pagosValidos.length === 0 && this.pagos.some(p => p.metodoPago === 'credito');
      const metodoPagoFinal: MetodoPago = esCredito ? 'credito' : (primerPago?.metodoPago ?? 'efectivo');

      const idVenta = await this.ventaSvc.registrarVenta({
        idCliente: cliente.idCliente ?? cliente.uid,
        nombreCliente: `${cliente.Nombre ?? ''} ${cliente.Apellido ?? ''}`.trim(),
        idMascota: mascota?.idMascota,
        nombreMascota: mascota?.nombre,
        fecha: new Date().toISOString(),
        metodoPago: metodoPagoFinal,
        soportePago: primerPago?.soportePago,
        pagos: pagosValidos,
        estadoPago,
        items,
        subtotal,
        total: totalVenta,
        saldoAplicado,
        abonado,
        idVendedor: this.idVendedor,
        nombreVendedor: this.nombreVendedor,
      });

      // ── Factura PDF: se genera en segundo plano y se habilita el botón ──
      this.ventaRegistrada = {
        idVenta,
        idCliente: cliente.idCliente ?? cliente.uid,
        nombreCliente: `${cliente.Nombre ?? ''} ${cliente.Apellido ?? ''}`.trim(),
        idMascota: mascota?.idMascota,
        nombreMascota: mascota?.nombre,
        fecha: new Date().toISOString(),
        metodoPago: metodoPagoFinal,
        soportePago: primerPago?.soportePago,
        pagos: pagosValidos,
        estadoPago,
        items,
        subtotal,
        total: totalVenta,
        saldoAplicado,
        abonado,
        idVendedor: this.idVendedor,
        nombreVendedor: this.nombreVendedor,
      };
      this.facturaLista = false;
      this.facturaUrl = '';
      this.generandoFactura = true;
      this.cargarFactura();

      this.util.showToast('Venta registrada correctamente', 'success');
      this.carrito.finalizarFactura();
      this.mascotaId = '';
      this.mascotas = [];
      this.resetPagos();
    } catch (err: any) {
      console.error(err);
      this.util.showToast(err?.message ?? 'Error al registrar la venta', 'danger');
    } finally {
      this.registrando = false;
    }
  }

  /** Genera el blob de la factura en segundo plano; habilita el botón al terminar. */
  private async cargarFactura() {
    try {
      if (!this.ventaRegistrada) return;
      const blob = await this.facturaSvc.generarBlob(this.ventaRegistrada, this.configApp);
      this.facturaUrl = URL.createObjectURL(blob);
      this.facturaLista = true;
    } catch (err) {
      console.error('Error generando factura', err);
    } finally {
      this.generandoFactura = false;
    }
  }

  descargarFactura() {
    if (!this.facturaLista || !this.facturaUrl) return;
    const a = document.createElement('a');
    a.href = this.facturaUrl;
    a.download = `factura-${this.ventaRegistrada?.idVenta ?? 'venta'}.pdf`;
    a.click();
  }

  nuevaVenta() {
    this.limpiarVentaOk();
    this.drawerOpen = false;
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}
