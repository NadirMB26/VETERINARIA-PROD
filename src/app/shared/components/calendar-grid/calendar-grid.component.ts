/**
 * @description
 * Día del calendario con información básica.
 */
export interface DiaCalendario {
  /** Fecha en formato YYYY-MM-DD. */
  dateStr: string;
  /** Día de la semana abreviado (Dom, Lun, Mar...). */
  dow: string;
  /** Número del día del mes. */
  num: number;
  /** Indica si es el día actual. */
  isToday: boolean;
}

/**
 * @description
 * Día del mini calendario (vista mensual).
 */
export interface MiniDay {
  /** Fecha en formato YYYY-MM-DD. */
  dateStr: string;
  /** Número del día del mes. */
  num: number;
  /** Indica si es el día actual. */
  isToday: boolean;
  /** Indica si está seleccionado en la semana actual. */
  isSelected: boolean;
  /** Indica si pertenece a otro mes. */
  otherMonth: boolean;
}

/**
 * @description
 * Componente de cuadrícula de calendario para visualización de citas.
 *
 * Muestra una vista de semana o día con slots horarios de 30 minutos,
 * permite filtrar por veterinario, tipo de cita y mascota, e integra
 * los horarios laborales de cada veterinario para bloquear slots fuera
 * de su jornada.
 *
 * @example
 * ```html
 * <app-calendar-grid
 *   [citas]="todasCitas"
 *   [veterinarios]="veterinarios"
 *   (citaClick)="showDetail($event)"
 *   (slotClick)="openNew($event.dateStr, $event.hora)">
 * </app-calendar-grid>
 * ```
 */
import { Component, Input, Output, EventEmitter, OnInit, OnChanges, inject } from '@angular/core';
import { PopoverController } from '@ionic/angular';
import { Cita } from 'src/app/core/models/cita.model';
import { CitasSlotPopoverComponent } from '../citas-slot-popover/citas-slot-popover.component';
import { HorarioService, Turno, DOW_MAP } from 'src/app/core/services/horario.service';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const VET_COLORS = ['#185FA5', '#3B6D11', '#A32D2D', '#854F0B', '#534AB7', '#0C6B6B', '#8B2F8B', '#1A6B6B'];

@Component({
  selector: 'app-calendar-grid',
  templateUrl: './calendar-grid.component.html',
  styleUrls: ['./calendar-grid.component.scss'],
  standalone: false,
})
export class CalendarGridComponent implements OnInit, OnChanges {

  /** Lista de todas las citas. */
  @Input() citas: Cita[] = [];

  /** Lista de veterinarios disponibles. */
  @Input() veterinarios: any[] = [];

  /** Indica si se debe mostrar el filtro de veterinario. */
  @Input() mostrarFiltroVet: boolean = true;

  /**
   * Modo de agenda: `clinico` (veterinarios) o `estetica` (groomers).
   * En estética el color y la etiqueta del profesional salen de la cita.
   */
  @Input() modo: 'clinico' | 'estetica' = 'clinico';

  /** Si se indica, el calendario se abre con ese veterinario prefiltrado (sin persistir). */
  @Input() vetPredefinido: string = '';

  /** Evento emitido al hacer clic en una cita. */
  @Output() citaClick = new EventEmitter<Cita>();

  /** Evento emitido al hacer clic en un slot horario vacío. */
  @Output() slotClick = new EventEmitter<{ dateStr: string; hora: string }>();

  private horarioService = inject(HorarioService);

  /** Identificador del veterinario seleccionado en el filtro. */
  filtroVeterinario = '';

  /** Tipo de cita seleccionado en el filtro. */
  filtroTipo = '';

  /** Identificador de la mascota seleccionada en el filtro. */
  filtroMascota = '';

  /** Estado de la cita seleccionado en el filtro. */
  filtroEstado = '';

  /** Fecha de inicio de la semana actual. */
  weekStart!: Date;

  /** Fecha actual. */
  today: Date = new Date();

  /** Fecha base para el mini calendario. */
  miniBase!: Date;

  /** Lista de días de la semana actual. */
  weekDays: DiaCalendario[] = [];

  /** Lista de días del mini calendario. */
  miniDays: MiniDay[] = [];

  /** Etiqueta del mes actual en el mini calendario. */
  miniMonthLabel = '';

  /** Etiqueta del rango de fechas de la semana actual. */
  weekLabel = '';

  /** Lista de horas disponibles para la cuadrícula (cada 30 min de 8:00 a 18:00). */
  horasGrid: string[] = [];

  /** Vista actual: 'semana' o 'dia'. */
  vistaActual: 'semana' | 'dia' = 'semana';

  /** Día seleccionado en la vista de día. */
  diaSeleccionado!: DiaCalendario;

  /** Mapa de slots habilitados por fecha para el veterinario filtrado. */
  slotsHabilitados: Map<string, Set<string>> = new Map();

  /** Indica si están cargando los horarios. */
  cargandoHorarios = false;

  readonly DAYS = DAYS;

  readonly TIPOS_LEYENDA = [
    { label: 'Consulta', value: 'Consulta general', bg: '#E6F1FB', border: '#185FA5' },
    { label: 'Vacunación', value: 'Vacunación', bg: '#EAF3DE', border: '#3B6D11' },
    { label: 'Cirugía', value: 'Cirugía', bg: '#FCEBEB', border: '#A32D2D' },
    { label: 'Urgencia', value: 'Urgencia', bg: '#FAEEDA', border: '#854F0B' },
    { label: 'Control', value: 'Control', bg: '#EEEDFE', border: '#534AB7' },
    { label: 'Otro', value: 'Otro', bg: '#EEEDFE', border: '#534AB7' },
  ];

  readonly ESTADOS_FILTRO = [
    { label: 'Pendiente', value: 'pendiente', color: '#f59e0b' },
    { label: 'En proceso', value: 'en_proceso', color: '#3b82f6' },
    { label: 'Finalizada', value: 'finalizada', color: '#10b981' },
    { label: 'Cancelada', value: 'cancelada', color: '#9ca3af' },
    { label: 'No asistió', value: 'no_asistio', color: '#6b7280' },
  ];

  /**
   * @description Constructor del componente.
   * @param popoverCtrl - Controlador de popovers de Ionic.
   */
  constructor(private popoverCtrl: PopoverController) {}

  /**
   * @description Hook de inicialización del componente.
   */
  ngOnInit() {
    this.cargarPreferencias();

    this.horasGrid = [
      '08:00', '08:30', '09:00', '09:30',
      '10:00', '10:30', '11:00', '11:30',
      '12:00', '12:30', '13:00', '13:30',
      '14:00', '14:30', '15:00', '15:30',
      '16:00', '16:30', '17:00', '17:30',
    ];

    this.renderWeekDays();
    this.renderMini();
    this.diaSeleccionado = this.weekDays.find(d => d.isToday) ?? this.weekDays[0];
    if (this.filtroVeterinario) this.actualizarSlotsHabilitados();
  }

  /**
   * @description Restaura preferencias de la última sesión (filtros, vista, semana).
   * @private
   */
  private cargarPreferencias() {
    try {
      const vista = localStorage.getItem('calendar-vista');
      this.vistaActual = vista === 'dia' ? 'dia' : 'semana';

      if (this.modo === 'estetica') {
        // La agenda de estética no hereda los filtros clínicos de la sesión.
        this.filtroVeterinario = '';
        this.filtroTipo = '';
        this.filtroMascota = '';
        this.filtroEstado = '';
      } else {
        const vet = localStorage.getItem('calendar-filtro-vet');
        this.filtroVeterinario = vet || this.vetPredefinido;
        this.filtroTipo = localStorage.getItem('calendar-filtro-tipo') ?? '';
        this.filtroMascota = localStorage.getItem('calendar-filtro-mascota') ?? '';
        this.filtroEstado = localStorage.getItem('calendar-filtro-estado') ?? '';
      }

      const semanaRaw = localStorage.getItem('calendar-semana');
      if (semanaRaw) {
        const d = new Date(semanaRaw);
        if (!isNaN(d.getTime())) this.weekStart = this.getWeekStart(d);
      } else {
        this.weekStart = this.getWeekStart(this.today);
      }
      this.miniBase = new Date(this.weekStart.getFullYear(), this.weekStart.getMonth(), 1);
    } catch {
      this.weekStart = this.getWeekStart(this.today);
      this.miniBase = new Date(this.today.getFullYear(), this.today.getMonth(), 1);
    }
  }

  /**
   * @description Persiste las preferencias de la sesión.
   * @private
   */
  private persistirPreferencias() {
    // En modo estética no se pisan las preferencias clínicas del veterinario.
    if (this.modo === 'estetica') return;
    try {
      localStorage.setItem('calendar-vista', this.vistaActual);
      localStorage.setItem('calendar-filtro-vet', this.filtroVeterinario);
      localStorage.setItem('calendar-filtro-tipo', this.filtroTipo);
      localStorage.setItem('calendar-filtro-mascota', this.filtroMascota);
      localStorage.setItem('calendar-filtro-estado', this.filtroEstado);
      localStorage.setItem('calendar-semana', this.weekStart.toISOString());
    } catch {
      // almacenamiento no disponible
    }
  }

  /**
   * @description Hook de cambios en las propiedades de entrada.
   */
  ngOnChanges() {
    if (this.weekDays.length) this.renderMini();
  }

  /**
   * @description Abre un popover con las citas de un slot horario con múltiples citas.
   * @param event - Evento del clic.
   * @param citas - Lista de citas en el slot.
   * @param dateStr - Fecha del slot.
   * @param hora - Hora del slot.
   */
  async abrirSlotPopover(event: Event, citas: Cita[], dateStr: string, hora: string) {
    event.stopPropagation();

    const popover = await this.popoverCtrl.create({
      component: CitasSlotPopoverComponent,
      componentProps: { citas },
      event,
      translucent: false,
      cssClass: 'citas-slot-popover',
    });

    await popover.present();

    const { data } = await popover.onDidDismiss();

    if (data?.cita) this.showDetail(data.cita);
    if (data?.action === 'nueva') this.openNew(dateStr, hora);
  }

  /**
   * @description Obtiene la fecha actual en formato YYYY-MM-DD.
   * @returns Fecha actual.
   */
  get todayStr(): string { return this.fmtDate(this.today); }

  /**
   * @description Obtiene todas las citas.
   * @returns Lista de citas.
   */
  get todasCitas(): Cita[] { return this.citas; }

  /**
   * @description Obtiene las citas filtradas según veterinario, tipo y mascota.
   * @returns Lista de citas filtradas.
   */
  get citasFiltradas(): Cita[] {
    return this.citas.filter(c => {
      const okVet = !this.filtroVeterinario || c.idVeterinario === this.filtroVeterinario;
      const okTipo = !this.filtroTipo || c.tipo === this.filtroTipo;
      const okMascota = !this.filtroMascota || c.idMascota === this.filtroMascota;
      const okEstado = !this.filtroEstado || c.estado === this.filtroEstado;
      return okVet && okTipo && okMascota && okEstado;
    });
  }

  /**
   * @description Obtiene las mascotas únicas con conteo de citas.
   * @returns Lista de mascotas únicas.
   */
  get mascotasUnicas(): { id: string; nombre: string; count: number }[] {
    const map = new Map<string, { nombre: string; count: number }>();
    this.citas.forEach(c => {
      if (!map.has(c.idMascota))
        map.set(c.idMascota, { nombre: c.nombreMascota, count: 0 });
      map.get(c.idMascota)!.count++;
    });
    return Array.from(map.entries())
      .map(([id, v]) => ({ id, nombre: v.nombre, count: v.count }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  /**
   * @description Cambia el filtro de veterinario.
   * @param id - Identificador del veterinario.
   */
  setFiltroVeterinario(id: string) {
    this.filtroVeterinario = id;
    this.actualizarSlotsHabilitados();
    this.persistirPreferencias();
  }

  /**
   * @description Cambia el filtro de tipo de cita.
   * @param tipo - Tipo de cita.
   */
  setFiltroTipo(tipo: string) {
    this.filtroTipo = tipo;
    this.persistirPreferencias();
  }

  /**
   * @description Cambia el filtro de mascota.
   * @param id - Identificador de la mascota.
   */
  setFiltroMascota(id: string) {
    this.filtroMascota = id;
    this.persistirPreferencias();
  }

  /**
   * @description Cambia el filtro de estado de la cita.
   * @param estado - Estado de la cita.
   */
  setFiltroEstado(estado: string) {
    this.filtroEstado = estado;
    this.persistirPreferencias();
  }

  /** Etiqueta en español del filtro de estado. */
  etiquetaEstadoFiltro(estado: string): string {
    const e = this.ESTADOS_FILTRO.find(x => x.value === estado);
    return e?.label ?? estado;
  }

  /** Citas que coinciden con un estado (vacío = todas). */
  getCitasPorEstado(estado: string): Cita[] {
    return this.citas.filter(c => !estado || c.estado === estado);
  }

  /**
   * @description Limpia todos los filtros aplicados.
   */
  limpiarFiltros() {
    this.filtroVeterinario = '';
    this.filtroTipo = '';
    this.filtroMascota = '';
    this.filtroEstado = '';
    this.slotsHabilitados.clear();
    this.persistirPreferencias();
  }

  cambiarVista(vista: 'semana' | 'dia') {
    this.vistaActual = vista;
    this.persistirPreferencias();
  }

  sidebarVisible = false;

  toggleSidebar() {
    this.sidebarVisible = !this.sidebarVisible;
  }

  /**
   * @description Verifica si una cita debe aparecer atenuada por los filtros.
   * @param cita - Cita a verificar.
   * @returns `true` si la cita debe atenuarse.
   */
  isCitaDimmed(cita: Cita): boolean {
    if (!this.filtroVeterinario && !this.filtroTipo && !this.filtroMascota && !this.filtroEstado) return false;
    const okVet = !this.filtroVeterinario || cita.idVeterinario === this.filtroVeterinario;
    const okTipo = !this.filtroTipo || cita.tipo === this.filtroTipo;
    const okMascota = !this.filtroMascota || cita.idMascota === this.filtroMascota;
    const okEstado = !this.filtroEstado || cita.estado === this.filtroEstado;
    return !(okVet && okTipo && okMascota && okEstado);
  }

  /**
   * @description Obtiene las citas de un veterinario específico.
   * @param idVet - Identificador del veterinario.
   * @returns Lista de citas.
   */
  getCitasPorVet(idVet: string): Cita[] { return this.citas.filter(c => c.idVeterinario === idVet); }

  /**
   * @description Obtiene las citas de un tipo específico.
   * @param tipo - Tipo de cita.
   * @returns Lista de citas.
   */
  getCitasPorTipo(tipo: string): Cita[] { return this.citas.filter(c => c.tipo === tipo); }

  /**
   * @description Obtiene la clase CSS para el tamaño del bloque de cita.
   * @param horaInicio - Hora de inicio.
   * @param horaFin - Hora de fin.
   * @returns Clase CSS.
   */
  getCbSize(horaInicio: string, horaFin: string): string {
    const h = this.calcHeight(horaInicio, horaFin);
    if (h < 30) return 'cb-xs';
    if (h < 54) return 'cb-sm';
    if (h < 80) return 'cb-md';
    return '';
  }

  /**
   * @description Carga los slots habilitados para el veterinario filtrado.
   */
  async actualizarSlotsHabilitados() {
    if (!this.filtroVeterinario) {
      this.slotsHabilitados.clear();
      return;
    }

    this.cargandoHorarios = true;
    this.slotsHabilitados = new Map();

    try {
      const horarios = await this.horarioService.getHorariosOnce(this.filtroVeterinario);
      const horarioMap = new Map(horarios.map(h => [h.dia, h]));

      for (const dia of this.weekDays) {
        const date = new Date(dia.dateStr + 'T12:00:00');
        const diaNom = DOW_MAP[date.getDay()];
        const horarioDia = horarioMap.get(diaNom);

        if (!horarioDia || !horarioDia.activo) {
          this.slotsHabilitados.set(dia.dateStr, new Set());
        } else {
          const slots = this.horarioService.getSlotsFromTurnos(horarioDia.turnos);
          this.slotsHabilitados.set(dia.dateStr, new Set(slots));
        }
      }
    } finally {
      this.cargandoHorarios = false;
    }
  }

  /**
   * @description Obtiene el estado visual del slot horario.
   * @param dateStr - Fecha del slot.
   * @param hora - Hora del slot.
   * @returns Estado del slot.
   */
  getEstadoSlot(dateStr: string, hora: string): 'libre' | 'ocupado' | 'bloqueado' | 'sin-filtro' {
    if (!this.filtroVeterinario) return 'sin-filtro';

    const slots = this.slotsHabilitados.get(dateStr);
    if (!slots) return 'sin-filtro';

    if (!slots.has(hora)) return 'bloqueado';

    const tieneCita = this.slotOcupadoPorCita(dateStr, hora);

    return tieneCita ? 'ocupado' : 'libre';
  }

  /**
   * @description Verifica si un slot está ocupado por una cita activa
   * (detección por rango, no por hora de inicio exacta).
   */
  slotOcupadoPorCita(dateStr: string, hora: string): boolean {
    const ini = this.horaToMin(hora);
    const fin = ini + 30;

    return this.citas.some(c =>
      c.idVeterinario === this.filtroVeterinario &&
      c.fecha === dateStr &&
      !['cancelada', 'no_asistio'].includes(c.estado) &&
      ini < this.horaToMin(c.horaFin) && fin > this.horaToMin(c.horaInicio)
    );
  }

  private horaToMin(hora: string): number {
    const [h, m] = hora.split(':').map(Number);
    return h * 60 + m;
  }

  /**
   * @description Verifica si un slot es clickeable.
   * @param dateStr - Fecha del slot.
   * @param hora - Hora del slot.
   * @returns `true` si el slot puede ser clickeado.
   */
  slotEsClickeable(dateStr: string, hora: string): boolean {
    const estado = this.getEstadoSlot(dateStr, hora);
    return estado === 'libre' || estado === 'sin-filtro';
  }

  /**
   * @description Desplaza la semana actual n semanas hacia adelante/atrás.
   * @param n - Número de semanas a desplazar.
   */
  shiftWeek(n: number) {
    this.weekStart.setDate(this.weekStart.getDate() + n * 7);
    this.weekStart = new Date(this.weekStart);
    this.renderWeekDays();
    this.miniBase = new Date(this.weekStart.getFullYear(), this.weekStart.getMonth(), 1);
    this.renderMini();
    this.persistirPreferencias();
    if (this.filtroVeterinario) this.actualizarSlotsHabilitados();
  }

  /**
   * @description Va al día actual en el calendario.
   */
  goToday() {
    this.weekStart = this.getWeekStart(this.today);
    this.renderWeekDays();
    this.diaSeleccionado = this.weekDays.find(d => d.isToday) ?? this.weekDays[0];
    this.miniBase = new Date(this.today.getFullYear(), this.today.getMonth(), 1);
    this.renderMini();
    this.persistirPreferencias();
    if (this.filtroVeterinario) this.actualizarSlotsHabilitados();
  }

  /**
   * @description Salta a una fecha específica en el calendario.
   * @param dateStr - Fecha destino en formato YYYY-MM-DD.
   */
  jumpToDate(dateStr: string) {
    const d = new Date(dateStr + 'T12:00:00');
    this.weekStart = this.getWeekStart(d);
    this.renderWeekDays();
    this.diaSeleccionado = this.weekDays.find(w => w.dateStr === dateStr) ?? this.weekDays[0];
    this.renderMini();
    if (this.filtroVeterinario) this.actualizarSlotsHabilitados();
  }

  /**
   * @description Desplaza el mini calendario n meses.
   * @param n - Número de meses a desplazar.
   */
  shiftMini(n: number) {
    this.miniBase.setMonth(this.miniBase.getMonth() + n);
    this.miniBase = new Date(this.miniBase);
    this.renderMini();
  }

  /**
   * @description Renderiza los días de la semana actual.
   */
  renderWeekDays() {
    const todayStr = this.fmtDate(this.today);
    this.weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(this.weekStart);
      d.setDate(d.getDate() + i);
      return {
        dateStr: this.fmtDate(d),
        dow: DAYS[d.getDay()],
        num: d.getDate(),
        isToday: this.fmtDate(d) === todayStr,
      };
    });
    const end = new Date(this.weekStart);
    end.setDate(end.getDate() + 6);
    const sm = MONTHS[this.weekStart.getMonth()];
    const em = MONTHS[end.getMonth()];
    this.weekLabel = sm === em
      ? `${sm} ${this.weekStart.getDate()}–${end.getDate()}, ${this.weekStart.getFullYear()}`
      : `${sm} ${this.weekStart.getDate()} – ${em} ${end.getDate()}, ${this.weekStart.getFullYear()}`;
  }

  /**
   * @description Renderiza el mini calendario mensual.
   */
  renderMini() {
    this.miniMonthLabel = `${MONTHS[this.miniBase.getMonth()]} ${this.miniBase.getFullYear()}`;
    const todayStr = this.fmtDate(this.today);
    const first = new Date(this.miniBase.getFullYear(), this.miniBase.getMonth(), 1);
    const start = new Date(first);
    start.setDate(start.getDate() - first.getDay());

    this.miniDays = Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const ds = this.fmtDate(d);
      return {
        dateStr: ds,
        num: d.getDate(),
        isToday: ds === todayStr,
        isSelected: this.weekDays.some(w => w.dateStr === ds),
        otherMonth: d.getMonth() !== this.miniBase.getMonth(),
      };
    });
  }

  /**
   * @description Obtiene las citas de un día específico (respeta los filtros activos).
   * @param dateStr - Fecha en formato YYYY-MM-DD.
   * @returns Lista de citas del día.
   */
  getCitasDelDia(dateStr: string): Cita[] {
    return this.citas
      .filter(c => {
        const okFecha = c.fecha === dateStr;
        const okVet = !this.filtroVeterinario || c.idVeterinario === this.filtroVeterinario;
        const okTipo = !this.filtroTipo || c.tipo === this.filtroTipo;
        const okMascota = !this.filtroMascota || c.idMascota === this.filtroMascota;
        const okEstado = !this.filtroEstado || c.estado === this.filtroEstado;
        return okFecha && okVet && okTipo && okMascota && okEstado;
      })
      .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
  }

  /**
   * @description Citas activas (sin canceladas/no_asistidas) de un día.
   */
  getCitasActivasDelDia(dateStr: string): Cita[] {
    return this.getCitasDelDia(dateStr)
      .filter(c => !['cancelada', 'no_asistio'].includes(c.estado));
  }

  /**
   * @description Clase CSS del estado de la cita para bloques del grid.
   */
  getClaseEstadoCita(estado: string): string {
    return 'cb-estado-' + (estado ?? 'pendiente').replace('_', '-');
  }

  /**
   * @description Indica si una cita se solapa con otra activa del mismo día.
   */
  citaTieneConflicto(cita: Cita, dateStr: string): boolean {
    const ini = this.horaToMin(cita.horaInicio);
    const fin = this.horaToMin(cita.horaFin);
    return this.citas.some(c =>
      c.idCita !== cita.idCita &&
      c.fecha === dateStr &&
      !['cancelada', 'no_asistio'].includes(c.estado) &&
      ini < this.horaToMin(c.horaFin) && fin > this.horaToMin(c.horaInicio)
    );
  }

  /**
   * @description Cantidad de citas activas de un día (para el mini calendario).
   */
  miniCitas(dateStr: string): number {
    return this.citas.filter(c =>
      c.fecha === dateStr && !['cancelada', 'no_asistio'].includes(c.estado)
    ).length;
  }

  /**
   * @description Posición vertical (px) de la línea "ahora".
   */
  get lineaAhoraTop(): number {
    const ahora = new Date();
    return ((ahora.getHours() - 8) * 60 + ahora.getMinutes()) / 30 * 48;
  }

  /**
   * @description Indica si debe mostrarse la línea "ahora" en una fecha.
   */
  mostrarLineaAhora(dateStr: string): boolean {
    return dateStr === this.todayStr;
  }

  /**
   * @description Verifica si una cita es la próxima del día.
   * @param cita - Cita a verificar.
   * @returns `true` si es la próxima cita.
   */
  esProximaCita(cita: Cita): boolean {
    if (cita.fecha !== this.todayStr) return false;
    if (['finalizada', 'cancelada', 'no_asistio'].includes(cita.estado)) return false;

    const ahora = new Date();
    const horaAhora = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;

    const proxima = this.getCitasDelDia(this.todayStr)
      .find(c =>
        !['finalizada', 'cancelada', 'no_asistio'].includes(c.estado) &&
        c.horaInicio >= horaAhora
      );

    return !!proxima && proxima.idCita === cita.idCita;
  }

  /**
   * @description Calcula la posición superior de un bloque de cita en píxeles.
   * @param horaInicio - Hora de inicio.
   * @returns Posición top en píxeles.
   */
  calcTop(horaInicio: string): number {
    const [h, m] = horaInicio.split(':').map(Number);
    return ((h - 8) * 60 + m) / 30 * 48;
  }

  /**
   * @description Calcula la altura de un bloque de cita en píxeles.
   * @param horaInicio - Hora de inicio.
   * @param horaFin - Hora de fin.
   * @returns Altura en píxeles.
   */
  calcHeight(horaInicio: string, horaFin: string): number {
    const [sh, sm] = horaInicio.split(':').map(Number);
    const [eh, em] = horaFin.split(':').map(Number);
    const diff = ((eh - 8) * 60 + em) - ((sh - 8) * 60 + sm);
    return Math.max((diff / 30) * 48 - 2, 22);
  }

  /**
   * @description Obtiene la clase CSS según el tipo de cita.
   * @param tipo - Tipo de cita.
   * @returns Clase CSS.
   */
  getClaseTipo(tipo: string): string {
    const map: Record<string, string> = {
      'Consulta general': 'cita-consulta',
      'Vacunación': 'cita-vacuna',
      'Cirugía': 'cita-cirugia',
      'Urgencia': 'cita-urgencia',
      'Control': 'cita-control',
      'Otro': 'cita-control',
    };
    return map[tipo] ?? 'cita-control';
  }

  /**
   * @description Obtiene el color asignado a un veterinario (estable por ID).
   * @param vet - Veterinario.
   * @returns Color en formato hexadecimal.
   */
  getVetColor(vet: any): string {
    return this.getVetColorById(vet.uid ?? vet.idVeterinario);
  }

  /**
   * @description Obtiene el color asignado a un veterinario por su ID (mapa estable).
   * @param id - Identificador del veterinario.
   * @returns Color en formato hexadecimal.
   */
  getVetColorById(id: string): string {
    const ids = this.veterinarios
      .map(v => (v.uid ?? v.idVeterinario))
      .filter(Boolean)
      .sort();
    const idx = ids.indexOf(id);
    return idx >= 0 ? VET_COLORS[idx % VET_COLORS.length] : '#888';
  }

  /**
   * @description Obtiene el color del veterinario de una cita.
   * @param cita - Cita.
   * @returns Color en formato hexadecimal.
   */
  getVetColorByCita(cita: Cita): string {
    if (this.modo === 'estetica') return '#8B2F8B';
    return this.getVetColorById(cita.idVeterinario);
  }

  /** Nombre del profesional de la cita (veterinario o groomer según el modo). */
  nombreProfesional(cita: Cita): string {
    if (this.modo === 'estetica') return cita.nombreGroomer ?? '';
    return cita.nombreVeterinario ?? '';
  }

  /**
   * @description Obtiene el nombre del veterinario por su ID.
   * @param id - Identificador del veterinario.
   * @returns Nombre completo.
   */
  getNombreVetById(id: string): string {
    const v = this.veterinarios.find(v => (v.uid ?? v.idVeterinario) === id);
    if (!v) return '';
    return `${v.Nombre ?? ''} ${v.Apellido ?? ''}`.trim();
  }

  /**
   * @description Emite el evento para abrir un nuevo slot.
   * @param dateStr - Fecha del slot.
   * @param hora - Hora del slot.
   */
  openNew(dateStr: string, hora: string) {
    this.slotClick.emit({ dateStr, hora });
  }

  /**
   * @description Emite el evento para mostrar el detalle de una cita.
   * @param cita - Cita seleccionada.
   */
  showDetail(cita: Cita) {
    this.citaClick.emit(cita);
  }

  /**
   * @description Formatea una hora para la etiqueta de la cuadrícula.
   * @param hora - Hora en formato HH:mm.
   * @returns Etiqueta formateada (ej: "8am", "9am").
   */
  formatHoraLabel(hora: string): string {
    const [h, m] = hora.split(':').map(Number);
    if (m !== 0) return '';
    const ampm = h >= 12 ? 'pm' : 'am';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}${ampm}`;
  }

  /**
   * @description Formatea una hora en formato corto sin AM/PM.
   * @param hora - Hora en formato HH:mm.
   * @returns Hora formateada (ej: "2", "2:30").
   */
  formatHora12Short(hora: string): string {
    const [h, m] = hora.split(':').map(Number);
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return m === 0 ? `${h12}` : `${h12}:${String(m).padStart(2, '0')}`;
  }

  /**
   * @description Obtiene AM/PM de una hora.
   * @param hora - Hora en formato HH:mm.
   * @returns 'am' o 'pm'.
   */
  getAmPm(hora: string): string {
    const [h] = hora.split(':').map(Number);
    return h >= 12 ? 'pm' : 'am';
  }

  /**
   * @description Obtiene el inicio de la semana de una fecha.
   * @private
   * @param d - Fecha base.
   * @returns Fecha del domingo de esa semana.
   */
  private getWeekStart(d: Date): Date {
    const dt = new Date(d);
    dt.setDate(dt.getDate() - dt.getDay());
    dt.setHours(0, 0, 0, 0);
    return dt;
  }

  /**
   * @description Formatea una fecha a YYYY-MM-DD.
   * @private
   * @param d - Fecha a formatear.
   * @returns Fecha en formato YYYY-MM-DD.
   */
  private fmtDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /**
   * @description Obtiene el nombre de una mascota por su ID.
   * @param id - Identificador de la mascota.
   * @returns Nombre de la mascota.
   */
  getNombreMascota(id: string): string {
    return this.mascotasUnicas.find(m => m.id === id)?.nombre ?? '';
  }

  /**
   * @description Agrupa las citas de un día por componentes conexas de solape:
   * las citas que se solapan (aunque no compartan hora de inicio) quedan en un
   * mismo grupo y se dibujan como un bloque colapsado "N citas".
   * @param dateStr - Fecha.
   * @returns Grupos ordenados por hora de inicio.
   */
  getGruposDelDia(dateStr: string): { citas: Cita[]; inicio: string; fin: string; top: number; height: number }[] {
    const citas = this.getCitasDelDia(dateStr)
      .filter(c => !this.isCitaDimmed(c))
      .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio) || a.horaFin.localeCompare(b.horaFin));

    const grupos: { citas: Cita[]; inicio: string; fin: string; top: number; height: number }[] = [];

    for (const c of citas) {
      const cIni = this.horaToMin(c.horaInicio);
      const cFin = this.horaToMin(c.horaFin);
      const ultimo = grupos[grupos.length - 1];

      if (ultimo && cIni < this.horaToMin(ultimo.fin)) {
        ultimo.citas.push(c);
        if (cFin > this.horaToMin(ultimo.fin)) ultimo.fin = c.horaFin;
      } else {
        grupos.push({ citas: [c], inicio: c.horaInicio, fin: c.horaFin, top: 0, height: 0 });
      }
    }

    for (const g of grupos) {
      g.top = this.calcTop(g.inicio);
      g.height = this.calcHeight(g.inicio, g.fin);
    }

    return grupos;
  }

  /** Etiqueta en español del estado (para la cola de hoy). */
  estadoCitaLabel(estado: string): string {
    const map: Record<string, string> = {
      pendiente: 'Pendiente',
      en_proceso: 'En proceso',
      finalizada: 'Finalizada',
      cancelada: 'Cancelada',
      no_asistio: 'No asistió',
    };
    return map[estado] ?? estado;
  }
}