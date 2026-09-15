import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Router } from '@angular/router';
import { Firestore, collection, getCountFromServer } from '@angular/fire/firestore';
import { AuthService } from 'src/app/core/services/auth.service';
import { UserService } from 'src/app/core/services/user.service';
import { CitaService } from 'src/app/core/services/cita.service';
import { VentaService } from 'src/app/core/services/venta.service';
import { ProductoService } from 'src/app/core/services/producto.service';
import { MascotaService } from 'src/app/core/services/mascota.service';
import { Cita } from 'src/app/core/models/cita.model';
import { Venta, metodosPagoNombre } from 'src/app/core/models/venta.model';
import { Producto, diasParaVencer } from 'src/app/core/models/producto.model';
import { Mascota } from 'src/app/core/models/mascota.model';
import { KpiCard } from 'src/app/shared/components/dashboard-widgets/dashboard-kpi-card/dashboard-kpi-card.component';
import { DatasetGrafico } from 'src/app/shared/components/dashboard-widgets/dashboard-chart-card/dashboard-chart-card.component';
import { EventoCalendario } from 'src/app/shared/components/dashboard-widgets/dashboard-calendar/dashboard-calendar.component';

const NOMBRES_MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: false
})
export class HomePage implements OnInit, OnDestroy {

  rol = '';
  uid = '';
  nombreUsuario = '';
  fotoUrl = '';
  fechaHoy = '';
  cargando = true;

  puedeVender = false;
  puedeVerVentas = false;

  kpis: KpiCard[] = [];

  citasRecientes: Cita[] = [];
  ventasRecientes: Venta[] = [];

  labelsMeses = NOMBRES_MESES;
  datasetCitas: DatasetGrafico[] = [];
  labelsUltimos6: string[] = [];
  datasetIngresos: DatasetGrafico[] = [];
  labelsTipos: string[] = [];
  datasetTipos: DatasetGrafico[] = [];
  totalConsultasMes = '';
  citasCalendario: EventoCalendario[] = [];

  private citas: Cita[] = [];
  private ventas: Venta[] = [];
  private productos: Producto[] = [];
  private mascotas: Mascota[] = [];
  private totalVeterinarios = 0;
  private cargas = { citas: false, ventas: false, productos: false, mascotas: false };

  private destroy$ = new Subject<void>();
  private router = inject(Router);

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private citaSvc: CitaService,
    private ventaSvc: VentaService,
    private productoSvc: ProductoService,
    private mascotaSvc: MascotaService,
    private firestore: Firestore,
  ) {}

  async ngOnInit() {
    this.rol = this.authService.getRolActual() ?? '';
    this.uid = this.authService.getUidActual() ?? '';

    const ahora = new Date();
    this.fechaHoy = ahora.toLocaleDateString('es-CO', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    // 1) Suscripciones de datos primero (nunca bloquean la UI).
    this.citaSvc.getTodas()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: citas => { this.citas = citas; this.cargas.citas = true; this.recalcular(); },
        error: err => { console.error('Dashboard: error cargando citas', err); this.cargas.citas = true; this.recalcular(); },
      });

    this.ventaSvc.getTodas()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ventas => { this.ventas = ventas; this.cargas.ventas = true; this.recalcular(); },
        error: err => { console.error('Dashboard: error cargando ventas', err); this.cargas.ventas = true; this.recalcular(); },
      });

    this.productoSvc.getTodos()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: productos => { this.productos = productos; this.cargas.productos = true; this.recalcular(); },
        error: err => { console.error('Dashboard: error cargando productos', err); this.cargas.productos = true; this.recalcular(); },
      });

    this.mascotaSvc.getTodas()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: mascotas => { this.mascotas = mascotas; this.cargas.mascotas = true; this.recalcular(); },
        error: err => { console.error('Dashboard: error cargando mascotas', err); this.cargas.mascotas = true; this.recalcular(); },
      });

    // 2) Perfil reactivo (foto/nombre en vivo) y conteos en paralelo y NO bloqueantes.
    const coleccion = this.userService.getColeccionPorRol(this.rol);
    (this.userService.getDocument(coleccion, this.uid) as Observable<any>)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: userData => {
          this.nombreUsuario = userData
            ? `${userData.Nombre ?? ''} ${userData.Apellido ?? ''}`.trim() || this.uid
            : this.uid;
          this.fotoUrl = userData?.fotoUrl ?? '';
        },
        error: err => {
          console.error('Dashboard: error cargando perfil', err);
          this.nombreUsuario = this.uid;
        },
      });
    void this.cargarConteoVeterinarios();

    // 3) Watchdog: la página nunca se queda pegada en skeletons.
    setTimeout(() => {
      if (this.cargando) {
        console.warn('Dashboard: watchdog activado, forzando render con datos parciales');
        (Object.keys(this.cargas) as (keyof typeof this.cargas)[]).forEach(k => { this.cargas[k] = true; });
        this.recalcular();
      }
    }, 10000);

    this.authService.privilegios$
      .pipe(takeUntil(this.destroy$))
      .subscribe(p => {
        const pr = p ?? {};
        const esAdmin = this.rol === 'administrador';
        this.puedeVender = esAdmin || pr['crearVentas'] === true;
        this.puedeVerVentas = esAdmin || pr['verVentas'] === true;
      });
  }

  get iniciales(): string {
    return this.nombreUsuario
      .trim()
      .split(' ')
      .slice(0, 2)
      .map(p => p[0] ?? '')
      .join('')
      .toUpperCase();
  }

  private async cargarConteoVeterinarios() {
    try {
      const vetCount = await getCountFromServer(collection(this.firestore, 'veterinarios'));
      this.totalVeterinarios = vetCount.data().count;
      this.recalcular();
    } catch (err) {
      console.error('Dashboard: error contando veterinarios', err);
      this.totalVeterinarios = 1;
      this.recalcular();
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get saludo(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }

  get subtituloHero(): string {
    const map: Record<string, string> = {
      administrador: 'Panel de administración · resumen general del negocio',
      recepcionista: 'Panel de recepción · citas y ventas del día',
      veterinario: 'Tus citas y pacientes del día',
    };
    return map[this.rol] ?? '';
  }

  // ── Helpers de fecha (hora local) ────────────────
  private fmt(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private parseFecha(fecha: string): Date {
    if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      const [y, m, d] = fecha.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date(fecha);
  }

  private hoy(): Date { return new Date(); }

  private enMes(fecha: string, anio: number, mes: number): boolean {
    const d = this.parseFecha(fecha);
    return d.getFullYear() === anio && d.getMonth() === mes;
  }

  private toMinutos(hora: string): number {
    const [h, m] = hora.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  private pct(actual: number, anterior: number): number | undefined {
    if (anterior <= 0) return actual > 0 ? undefined : 0;
    return Math.round(((actual - anterior) / anterior) * 100);
  }

  // ── Recálculo de todo el dashboard ───────────────
  private recalcular() {
    const completo = Object.values(this.cargas).every(v => v);
    if (!completo) return;
    this.cargando = false;
    this.calcularKpis();
    this.calcularGraficos();
    this.calcularRecientes();
  }

  private calcularKpis() {
    const ahora = this.hoy();
    const anio = ahora.getFullYear();
    const mes = ahora.getMonth();
    const hoyIso = this.fmt(ahora);
    const kpis: KpiCard[] = [];

    // ── 1. Citas de hoy ──
    const ayer = new Date(ahora);
    ayer.setDate(ayer.getDate() - 1);
    const ayerIso = this.fmt(ayer);

    const activasHoy = (c: Cita) => c.fecha === hoyIso && c.estado !== 'cancelada' && c.estado !== 'no_asistio';
    const citasHoy = this.citas.filter(activasHoy);
    const citasAyer = this.citas.filter(c => c.fecha === ayerIso && c.estado !== 'cancelada' && c.estado !== 'no_asistio');

    const sparkHoras = Array(12).fill(0);
    for (const c of citasHoy) {
      const h = this.toMinutos(c.horaInicio);
      sparkHoras[Math.min(11, Math.floor(h / 120))]++;
    }

    kpis.push({
      label: 'Hoy',
      titulo: 'Citas de hoy',
      valor: String(citasHoy.length),
      icono: 'calendar-outline',
      color: 'primary',
      variacion: this.pct(citasHoy.length, citasAyer.length),
      fuente: 'vs ayer',
      sparkline: sparkHoras,
    });

    // ── 2. Ingresos del mes ──
    const ventasMes = this.ventas.filter(v => this.enMes(v.fecha, anio, mes));
    const ingresosMes = ventasMes.reduce((a, v) => a + v.total, 0);

    const mesAnterior = new Date(anio, mes - 1, 1);
    const ventasMesAnt = this.ventas.filter(v => this.enMes(v.fecha, mesAnterior.getFullYear(), mesAnterior.getMonth()));
    const ingresosMesAnt = ventasMesAnt.reduce((a, v) => a + v.total, 0);

    const porSemana = Array(5).fill(0);
    for (const v of ventasMes) {
      const d = new Date(v.fecha);
      const semana = Math.min(4, Math.ceil(d.getDate() / 7) - 1);
      porSemana[semana] += v.total;
    }

    kpis.push({
      label: 'Mes actual',
      titulo: 'Ingresos del mes',
      valor: `$${ingresosMes.toLocaleString('es-CO')}`,
      icono: 'cash-outline',
      color: 'success',
      variacion: this.pct(ingresosMes, ingresosMesAnt),
      fuente: 'vs mes anterior',
      sparkline: porSemana,
    });

    // ── 3. Nuevos pacientes ──
    const nuevosMes = this.mascotas.filter(m => this.enMes(m.fechaRegistro, anio, mes));
    const nuevosMesAnt = this.mascotas.filter(m => this.enMes(m.fechaRegistro, mesAnterior.getFullYear(), mesAnterior.getMonth()));

    const nuevosPorMes: number[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(anio, mes - i, 1);
      nuevosPorMes.push(this.mascotas.filter(m => this.enMes(m.fechaRegistro, d.getFullYear(), d.getMonth())).length);
    }

    kpis.push({
      label: 'Mes actual',
      titulo: 'Nuevos pacientes',
      valor: String(nuevosMes.length),
      icono: 'paw-outline',
      color: 'purple',
      variacion: this.pct(nuevosMes.length, nuevosMesAnt.length),
      fuente: 'mascotas registradas',
      sparkline: nuevosPorMes,
    });

    // ── 4. Consultas realizadas ──
    const consultasMes = this.citas.filter(c => this.enMes(c.fecha, anio, mes) && c.estado === 'finalizada');
    const consultasMesAnt = this.citas.filter(c => this.enMes(c.fecha, mesAnterior.getFullYear(), mesAnterior.getMonth()) && c.estado === 'finalizada');

    const consultasPorMes: number[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(anio, mes - i, 1);
      consultasPorMes.push(this.citas.filter(c => this.enMes(c.fecha, d.getFullYear(), d.getMonth()) && c.estado === 'finalizada').length);
    }

    kpis.push({
      label: 'Mes actual',
      titulo: 'Consultas realizadas',
      valor: String(consultasMes.length),
      icono: 'medkit-outline',
      color: 'info',
      variacion: this.pct(consultasMes.length, consultasMesAnt.length),
      fuente: 'citas finalizadas',
      sparkline: consultasPorMes,
    });

    // ── 5. Vacunas por vencer ──
    const hoyDate = this.hoy();
    const vacunasPorVencer = this.productos.filter(p => {
      if (p.categoria !== 'medicamentos' || p.estado !== 'activo') return false;
      if (!p.fechaVencimiento) return false;
      const dias = diasParaVencer(p.fechaVencimiento);
      return dias !== null && dias >= 0 && dias <= 30;
    });

    kpis.push({
      label: 'Próximos 30 días',
      titulo: 'Vacunas por vencer',
      valor: String(vacunasPorVencer.length),
      icono: 'flask-outline',
      color: 'warning',
      variacion: undefined,
      fuente: 'medicamentos activos',
    });

    // ── 6. Tasa de cancelación ──
    const totalMes = this.citas.filter(c => this.enMes(c.fecha, anio, mes));
    const canceladasMes = totalMes.filter(c => c.estado === 'cancelada').length;
    const tasaMes = totalMes.length ? Math.round((canceladasMes / totalMes.length) * 100) : 0;

    const totalMesAnt = this.citas.filter(c => this.enMes(c.fecha, mesAnterior.getFullYear(), mesAnterior.getMonth()));
    const canceladasMesAnt = totalMesAnt.filter(c => c.estado === 'cancelada').length;
    const tasaMesAnt = totalMesAnt.length ? Math.round((canceladasMesAnt / totalMesAnt.length) * 100) : 0;

    const tasasPorMes: number[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(anio, mes - i, 1);
      const total = this.citas.filter(c => this.enMes(c.fecha, d.getFullYear(), d.getMonth()));
      const cancel = total.filter(c => c.estado === 'cancelada').length;
      tasasPorMes.push(total.length ? Math.round((cancel / total.length) * 100) : 0);
    }

    kpis.push({
      label: 'Mes actual',
      titulo: 'Tasa de cancelación',
      valor: `${tasaMes}%`,
      icono: 'close-circle-outline',
      color: 'pink',
      variacion: tasaMes - tasaMesAnt,
      variacionSufijo: ' pts',
      fuente: 'vs mes anterior',
      sparkline: tasasPorMes,
    });

    // ── 7. Pacientes activos ──
    const hace90 = new Date();
    hace90.setDate(hace90.getDate() - 90);
    const hace180 = new Date();
    hace180.setDate(hace180.getDate() - 180);
    const hace90Iso = this.fmt(hace90);
    const hace180Iso = this.fmt(hace180);

    const activos = new Set(
      this.citas
        .filter(c => c.fecha >= hace90Iso && c.estado !== 'cancelada' && c.estado !== 'no_asistio')
        .map(c => c.idMascota)
    );
    const activosPrevios = new Set(
      this.citas
        .filter(c => c.fecha >= hace180Iso && c.fecha < hace90Iso && c.estado !== 'cancelada' && c.estado !== 'no_asistio')
        .map(c => c.idMascota)
    );

    kpis.push({
      label: 'Últimos 90 días',
      titulo: 'Pacientes activos',
      valor: String(activos.size),
      icono: 'fitness-outline',
      color: 'info',
      variacion: this.pct(activos.size, activosPrevios.size),
      fuente: 'con consulta reciente',
    });

    // ── 8. Ocupación de agenda ──
    const horasMes = this.citas
      .filter(c => this.enMes(c.fecha, anio, mes) && c.estado !== 'cancelada' && c.estado !== 'no_asistio')
      .reduce((acc, c) => acc + (this.toMinutos(c.horaFin) - this.toMinutos(c.horaInicio)) / 60, 0);

    const diasLaborables = this.diasLaborablesMes(anio, mes);
    const cupo = Math.max(1, this.totalVeterinarios) * 8 * diasLaborables;
    const ocupacion = Math.min(100, Math.round((horasMes / cupo) * 100));

    kpis.push({
      label: 'Mes actual',
      titulo: 'Ocupación de agenda',
      valor: `${ocupacion}%`,
      icono: 'time-outline',
      color: 'purple',
      variacion: undefined,
      fuente: `${Math.max(1, this.totalVeterinarios)} vet(s) · ${diasLaborables} días`,
    });

    this.kpis = kpis;
  }

  private diasLaborablesMes(anio: number, mes: number): number {
    const total = new Date(anio, mes + 1, 0).getDate();
    let dias = 0;
    for (let d = 1; d <= total; d++) {
      const dia = new Date(anio, mes, d).getDay();
      if (dia !== 0 && dia !== 6) dias++;
    }
    return Math.max(1, dias);
  }

  private calcularGraficos() {
    const ahora = this.hoy();
    const anio = ahora.getFullYear();
    const mes = ahora.getMonth();

    // ── Barras: citas por mes, año actual vs anterior ──
    const actual = Array(12).fill(0);
    const anterior = Array(12).fill(0);
    for (const c of this.citas) {
      const d = this.parseFecha(c.fecha);
      if (d.getFullYear() === anio) actual[d.getMonth()]++;
      else if (d.getFullYear() === anio - 1) anterior[d.getMonth()]++;
    }
    this.datasetCitas = [
      { label: String(anio), datos: actual },
      { label: String(anio - 1), datos: anterior },
    ];

    // ── Área: ingresos consultas vs productos (6 meses) ──
    const labels: string[] = [];
    const servicios: number[] = [];
    const productos: number[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(anio, mes - i, 1);
      labels.push(NOMBRES_MESES[d.getMonth()]);
      let s = 0, p = 0;
      for (const v of this.ventas) {
        if (!this.enMes(v.fecha, d.getFullYear(), d.getMonth())) continue;
        for (const item of v.items) {
          if (item.tipo === 'servicio') s += item.subtotal;
          else p += item.subtotal;
        }
      }
      servicios.push(Math.round(s));
      productos.push(Math.round(p));
    }
    this.labelsUltimos6 = labels;
    this.datasetIngresos = [
      { label: 'Consultas', datos: servicios },
      { label: 'Productos', datos: productos },
    ];

    // ── Donut: citas por tipo (mes actual) ──
    const tiposOrden = ['consulta', 'vacuna', 'cirugia', 'control', 'urgencia'];
    const conteo: Record<string, number> = {};
    for (const c of this.citas) {
      if (!this.enMes(c.fecha, anio, mes)) continue;
      const t = (c.tipo ?? 'consulta').toLowerCase().trim();
      conteo[t] = (conteo[t] ?? 0) + 1;
    }
    const conTipo = (t: string) => conteo[t] ?? 0;
    const otros = Object.entries(conteo)
      .filter(([k]) => !tiposOrden.includes(k))
      .reduce((a, [, n]) => a + n, 0);

    this.labelsTipos = [...tiposOrden.map(t => t.charAt(0).toUpperCase() + t.slice(1)), ...(otros > 0 ? ['Otros'] : [])];
    this.datasetTipos = [{
      label: 'Tipo de cita',
      datos: [...tiposOrden.map(conTipo), ...(otros > 0 ? [otros] : [])],
    }];
    this.totalConsultasMes = String(Object.values(conteo).reduce((a, n) => a + n, 0));

    // ── Calendario: días con citas del mes actual ──
    const porDia: Record<string, number> = {};
    for (const c of this.citas) {
      if (!this.enMes(c.fecha, anio, mes)) continue;
      porDia[c.fecha] = (porDia[c.fecha] ?? 0) + 1;
    }
    this.citasCalendario = Object.entries(porDia)
      .map(([fecha, cantidad]) => ({ fecha, cantidad }));
  }

  private calcularRecientes() {
    this.citasRecientes = this.citas
      .filter(c => c.estado === 'finalizada')
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.horaInicio.localeCompare(a.horaInicio))
      .slice(0, 4);

    this.ventasRecientes = [...this.ventas]
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .slice(0, 4);
  }

  // ── Acciones rápidas ─────────────────────────────
  irAVentas() { this.router.navigate(['/layout/ventas']); }
  irACitas() { this.router.navigate(['/layout/citas']); }
  irAReportes() { this.router.navigate(['/layout/reportes']); }
  irAHistorial() { this.router.navigate(['/layout/historial-ventas']); }

  // ── Plantilla ────────────────────────────────────
  formatearFecha(fechaIso: string): string {
    const d = this.parseFecha(fechaIso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  metodosVentaTexto(v: Venta): string {
    return metodosPagoNombre(v);
  }
}
