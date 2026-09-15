/**
 * @description
 * Servicio de notificaciones en vivo (Fase 1: alertas).
 *
 * Combina los observables existentes de citas, ventas y productos para
 * derivar alertas según el rol del usuario en sesión. No crea colecciones
 * nuevas en Firestore.
 *
 * Es consciente de la sesión: se reinicia automáticamente cuando cambia el
 * usuario autenticado (login/logout sin recargar) y vacía las alertas al
 * cerrar sesión, evitando que queden datos del usuario anterior.
 */
import { Injectable, inject, signal } from '@angular/core';
import { combineLatest, Subscription, Observable, interval } from 'rxjs';
import { map } from 'rxjs/operators';
import { Firestore, doc, docData } from '@angular/fire/firestore';
import { CitaService } from './cita.service';
import { VentaService } from './venta.service';
import { ProductoService } from './producto.service';
import { UserService } from './user.service';
import { AuthService } from './auth.service';
import { Cita } from '../models/cita.model';
import { Venta, saldoVenta } from '../models/venta.model';
import { Producto, calcularEstadoProducto } from '../models/producto.model';
import { PerfilUsuario } from '../models/usuario.model';

export interface AlertaNotificacion {
  id: string;
  icono: string;
  titulo: string;
  detalle: string;
  ruta: string;
}

@Injectable({ providedIn: 'root' })
export class NotificacionesService {

  private firestore = inject(Firestore);
  private citaSvc = inject(CitaService);
  private ventaSvc = inject(VentaService);
  private productoSvc = inject(ProductoService);
  private userSvc = inject(UserService);
  private authSvc = inject(AuthService);

  /** Alertas vigentes según el rol del usuario en sesión. */
  alertas = signal<AlertaNotificacion[]>([]);

  /** Suscripción combinada de la sesión actual. */
  private sub?: Subscription;

  /** Tick periódico que refresca las alertas (limpieza automática al cambiar de día). */
  private tickSub?: Subscription;

  /** Usuario/rol a los que está anclada la suscripción actual. */
  private uidActual = '';
  private rolActual = '';

  /** Últimos datos recibidos (para recalcular en memoria sin depender de Firestore). */
  private citasCache: Cita[] = [];
  private ventasCache: Venta[] = [];
  private productosCache: Producto[] = [];
  private perfilCache: PerfilUsuario | null = null;

  constructor() {
    // Ante cualquier cambio de sesión se reinicia el flujo (login/logout).
    this.authSvc.user$.subscribe(u => {
      if (!u) {
        this.detener();
        return;
      }
      const rol = this.authSvc.getRolActual() ?? '';
      if (rol && u.uid !== this.uidActual) this.reiniciar(u.uid, rol);
    });
  }

  /**
   * @description Inicia la suscripción combinada de la sesión actual si aún
   * no está activa (o si cambió el usuario). El header la invoca al montar.
   */
  iniciar() {
    const uid = this.authSvc.getUidActual();
    const rol = this.authSvc.getRolActual();
    if (!uid || !rol) {
      this.detener();
      return;
    }
    if (this.sub && uid === this.uidActual) return;
    this.reiniciar(uid, rol);
  }

  /** Arranca las suscripciones ancladas a un usuario/rol concreto. */
  private reiniciar(uid: string, rol: string) {
    this.detener();
    this.uidActual = uid;
    this.rolActual = rol;

    this.sub = combineLatest([
      this.citaSvc.getTodas(),
      this.ventaSvc.getTodas(),
      this.productoSvc.getTodos(),
      this.perfilDe(uid, rol),
    ]).subscribe(([citas, ventas, productos, perfil]) => {
      this.citasCache = citas;
      this.ventasCache = ventas;
      this.productosCache = productos;
      this.perfilCache = perfil;
      this.recalcular();
    });

    // Recomputo periódico: con la fecha/hora actuales se limpian solas las
    // alertas de citas de días anteriores y las que ya vencieron su hora,
    // sin esperar cambios en Firestore ni recargar la app.
    this.tickSub = interval(60_000).subscribe(() => this.recalcular());
  }

  /** Recalcula las alertas con los datos ya recibidos y la fecha/hora actuales. */
  private recalcular() {
    if (!this.sub) return;
    this.alertas.set(this.construirAlertas(
      this.citasCache,
      this.ventasCache,
      this.productosCache,
      this.perfilCache,
    ));
  }

  /** Cancela las suscripciones y limpia las alertas de la sesión anterior. */
  private detener() {
    this.sub?.unsubscribe();
    this.sub = undefined;
    this.tickSub?.unsubscribe();
    this.tickSub = undefined;
    this.uidActual = '';
    this.rolActual = '';
    this.citasCache = [];
    this.ventasCache = [];
    this.productosCache = [];
    this.perfilCache = null;
    this.alertas.set([]);
  }

  /** Stream del documento de perfil del usuario en sesión. */
  private perfilDe(uid: string, rol: string): Observable<PerfilUsuario | null> {
    const coleccion = this.userSvc.getColeccionPorRol(rol);
    return (docData(doc(this.firestore, coleccion, uid)) as Observable<any>).pipe(
      map((data: any) => data ? ({ ...data, uid, rol } as PerfilUsuario) : null)
    );
  }

  private construirAlertas(
    citas: Cita[],
    ventas: Venta[],
    productos: Producto[],
    perfil: PerfilUsuario | null,
  ): AlertaNotificacion[] {
    const rol = this.rolActual;
    const uid = this.uidActual;
    const hoy = this.fechaHoy();

    if (rol === 'administrador' || rol === 'recepcionista') {
      return this.alertasStaff(citas, ventas, productos, hoy);
    }

    if (rol === 'veterinario') {
      return this.alertasVeterinario(citas, uid, hoy);
    }

    if (rol === 'cliente') {
      return this.alertasCliente(citas, ventas, perfil, uid, hoy);
    }

    return [];
  }

  private alertasStaff(
    citas: Cita[],
    ventas: Venta[],
    productos: Producto[],
    hoy: string,
  ): AlertaNotificacion[] {
    const alertas: AlertaNotificacion[] = [];

    // Pendientes cuya hora ya venció se excluyen (el job las pasa a no_asistio);
    // las en_proceso se mantienen mientras el staff las gestione.
    const horaAhora = this.horaAhora();
    const citasHoy = citas.filter(c =>
      c.fecha === hoy &&
      (c.estado === 'en_proceso' ||
        (c.estado === 'pendiente' && c.horaFin > horaAhora))
    );
    if (citasHoy.length) {
      alertas.push({
        id: 'citas-pendientes-hoy',
        icono: 'calendar-outline',
        titulo: `${citasHoy.length} cita${citasHoy.length === 1 ? '' : 's'} pendiente${citasHoy.length === 1 ? '' : 's'} hoy`,
        detalle: citasHoy.slice(0, 3).map(c => `${c.horaInicio} · ${c.nombreMascota}`).join(', '),
        ruta: '/layout/citas',
      });
    }

    const stockCritico = productos.filter(p => {
      const e = calcularEstadoProducto(p);
      return e === 'stock-bajo' || e === 'agotado';
    });
    if (stockCritico.length) {
      const agotados = stockCritico.filter(p => p.stock <= 0).length;
      alertas.push({
        id: 'stock-critico',
        icono: 'cube-outline',
        titulo: `${stockCritico.length} producto${stockCritico.length === 1 ? '' : 's'} con stock ${agotados ? 'bajo o agotado' : 'bajo'}`,
        detalle: stockCritico.slice(0, 3).map(p => p.nombre).join(', '),
        ruta: '/layout/ventas?catalogo=productos',
      });
    }

    const creditosPendientes = ventas.filter(v => v.estadoPago === 'pendiente');
    if (creditosPendientes.length) {
      const total = creditosPendientes.reduce((acc, v) => acc + saldoVenta(v), 0);
      alertas.push({
        id: 'ventas-credito',
        icono: 'cash-outline',
        titulo: `${creditosPendientes.length} venta${creditosPendientes.length === 1 ? '' : 's'} a crédito sin cobrar`,
        detalle: `Saldo total: $${total.toLocaleString('es-CO')}`,
        ruta: '/layout/cobranza',
      });
    }

    return alertas;
  }

  private alertasVeterinario(citas: Cita[], uid: string, hoy: string): AlertaNotificacion[] {
    const alertas: AlertaNotificacion[] = [];

    // Solo citas asignadas al veterinario: las pendientes cuya hora ya venció
    // se excluyen (el job las pasa a no_asistio); las en_proceso se mantienen.
    const horaAhora = this.horaAhora();
    const misCitasHoy = citas.filter(c =>
      c.fecha === hoy &&
      c.idVeterinario === uid &&
      (c.estado === 'en_proceso' ||
        (c.estado === 'pendiente' && c.horaFin > horaAhora))
    );
    if (misCitasHoy.length) {
      alertas.push({
        id: 'mis-citas-hoy',
        icono: 'calendar-outline',
        titulo: `${misCitasHoy.length} cita${misCitasHoy.length === 1 ? '' : 's'} pendiente${misCitasHoy.length === 1 ? '' : 's'} hoy`,
        detalle: misCitasHoy.slice(0, 3).map(c => `${c.horaInicio} · ${c.nombreMascota}`).join(', '),
        ruta: '/layout/citas',
      });
    }

    return alertas;
  }

  private alertasCliente(
    citas: Cita[],
    ventas: Venta[],
    perfil: PerfilUsuario | null,
    uid: string,
    hoy: string,
  ): AlertaNotificacion[] {
    const alertas: AlertaNotificacion[] = [];

    const proxima = citas
      .filter(c =>
        c.idCliente === uid &&
        c.fecha >= hoy &&
        !['finalizada', 'cancelada', 'no_asistio'].includes(c.estado)
      )
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.horaInicio.localeCompare(b.horaInicio))[0];
    if (proxima) {
      alertas.push({
        id: 'proxima-cita',
        icono: 'calendar-outline',
        titulo: 'Próxima cita',
        detalle: `${proxima.fecha} ${proxima.horaInicio} · ${proxima.nombreMascota} · ${proxima.nombreVeterinario}`,
        ruta: '/layout/cliente-home',
      });
    }

    const deudas = ventas.filter(v => v.idCliente === uid && v.estadoPago === 'pendiente');
    if (deudas.length) {
      const total = deudas.reduce((acc, v) => acc + saldoVenta(v), 0);
      alertas.push({
        id: 'deudas-pendientes',
        icono: 'cash-outline',
        titulo: `${deudas.length} deuda${deudas.length === 1 ? '' : 's'} pendiente${deudas.length === 1 ? '' : 's'}`,
        detalle: `Saldo total: $${total.toLocaleString('es-CO')}`,
        ruta: '/layout/mis-compras',
      });
    }

    if ((perfil?.saldoFavor ?? 0) > 0) {
      alertas.push({
        id: 'saldo-favor',
        icono: 'wallet-outline',
        titulo: 'Saldo a favor disponible',
        detalle: `Tienes $${perfil!.saldoFavor!.toLocaleString('es-CO')} a tu favor`,
        ruta: '/layout/mis-compras',
      });
    }

    return alertas;
  }

  private fechaHoy(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /** Hora actual en formato HH:mm (comparable con `horaFin` de las citas). */
  private horaAhora(): string {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
}
