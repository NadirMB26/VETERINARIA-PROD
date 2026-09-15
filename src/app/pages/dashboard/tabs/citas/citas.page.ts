import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { LoadingController, AlertController, ModalController } from '@ionic/angular';
import { Subscription, take } from 'rxjs';

import { CitaService } from 'src/app/core/services/cita.service';
import { Cita } from 'src/app/core/models/cita.model';
import { UserService } from 'src/app/core/services/user.service';
import { MascotaService } from 'src/app/core/services/mascota.service';
import { Mascota } from 'src/app/core/models/mascota.model';
import { ReasignarVeterinarioComponent } from 'src/app/shared/components/reasignar-veterinario/reasignar-veterinario.component';
import { DiagnosticoModalComponent } from 'src/app/shared/components/diagnostico-modal/diagnostico-modal.component';
import { DiagnosticoService } from 'src/app/core/services/diagnostico.service';
import { RegistroClinicoService } from 'src/app/core/services/registro-clinico.service';
import { categoriaCitaPorTipo } from 'src/app/core/models/catalogo-citas.model';
import { AuthService } from 'src/app/core/services/auth.service';
import { HorarioService, DOW_MAP, HorarioDia } from 'src/app/core/services/horario.service';
import { UtilidadesService } from 'src/app/core/services/utilidades.service';
import {
  TIPOS_SERVICIO_ESTETICA,
  labelTipoServicio,
} from 'src/app/core/services/citas-estetica.service';
import {
  normalizarEspecialidades,
  cubreTipoDeCita,
} from 'src/app/core/models/especialidades.model';
import { Producto } from 'src/app/core/models/producto.model';
import { ProductoService } from 'src/app/core/services/producto.service';
import { CitaVentaService } from 'src/app/core/services/cita-venta.service';
import { ItemVenta, Venta, saldoVenta } from 'src/app/core/models/venta.model';
import { MascotaDetalleComponent } from 'src/app/shared/components/mascota-detalle/mascota-detalle.component';
import { infoTipoCita } from 'src/app/core/models/catalogo-citas.model';

@Component({
  selector: 'app-cita',
  templateUrl: './citas.page.html',
  styleUrls: ['./citas.page.scss'],
  standalone: false,
})
export class CitaPage implements OnInit, OnDestroy {

  todasCitas: Cita[] = [];
  veterinarios: any[] = [];
  modo: 'crear' | 'editar' = 'crear';
  idCita = '';
  idCliente = '';
  idMascota = '';
  idVeterinario = '';
  idGroomer = '';
  tipoServicio: Cita['tipoServicio'] = '';
  observacionesCliente = '';
  fecha = '';
  horaInicio = '';
  horaFin = '';
  horasSeleccionadas: string[] = [];
  tipo = '';
  estado: Cita['estado'] = 'pendiente';
  notas = '';
  notasRecepcion = '';
  formularioEsValido = false;
  modalTitulo = 'Nueva cita';
  modalNuevaOpen = false;
  modalDetalleOpen = false;
  citaDetalle: Cita | null = null;
  clientes: any[] = [];
  mascotas: Mascota[] = [];
  groomers: any[] = [];
  slotsHora: string[] = [];
  uidActual = '';
  rolActual = '';
  nombreRecepcionista = '';
  slotsHabilitadosVet: Set<string> = new Set();
  /** Canal del profesional: veterinario (médico) o estética (groomer). */
  canal: 'veterinario' | 'estetica' = 'veterinario';
  puedeCrearCitas = false;
  puedeVerCitas = false;
  puedeReprogramar = false;
  puedeCancelarCitas = false;
  puedeDiagnosticar = false;
  existeDiagnostico = false;

  // ── Servicios de la cita y cuenta por cobrar ─────────────
  /** Catálogo de servicios activos (productos con tipo `servicio`). */
  serviciosCatalogo: Producto[] = [];
  /** Servicios elegidos para la cita (id + cantidad). */
  seleccionServicios: { idProducto: string; cantidad: number }[] = [];
  /** Venta vinculada mostrada en el detalle de la cita. */
  ventaDeCita: Venta | null = null;

  readonly TIPOS_LISTA = [
    { value: 'Consulta general', label: 'Consulta', clase: 'consulta' },
    { value: 'Vacunación', label: 'Vacunación', clase: 'vacuna' },
    { value: 'Cirugía', label: 'Cirugía', clase: 'cirugia' },
    { value: 'Urgencia', label: 'Urgencia', clase: 'urgencia' },
    { value: 'Control', label: 'Control', clase: 'control' },
    { value: 'Otro', label: 'Otro', clase: 'control' },
    { value: 'Estética', label: 'Estética', clase: 'estetica' },
  ];

  /** Tipos de servicio disponibles para citas de estética (Fase 2). */
  readonly TIPOS_SERVICIO = TIPOS_SERVICIO_ESTETICA;

  /** True cuando el formulario apunta a una cita de estética. */
  get esEstetica(): boolean {
    return this.tipo === 'Estética';
  }

  get esEsteticaDetalle(): boolean {
    return this.citaDetalle?.tipo === 'Estética';
  }

  get labelAsignado(): string {
    return this.esEstetica ? 'Groomer' : 'Veterinario';
  }

  get labelTipoServicioDetalle(): string {
    return labelTipoServicio(this.citaDetalle?.tipoServicio ?? '');
  }

  // ── Servicios de la cita ─────────────────────────────────
  /**
   * Un servicio es de estética si su categoría lo indica o si tiene tipo de
   * servicio estético; el resto aplica al canal médico. Así los servicios
   * guardados con categorías viejas también aparecen al agendar.
   */
  private esServicioEstetica(p: Producto): boolean {
    return p.categoria === 'estetica' || !!p.tipoServicioEstetica;
  }

  /** Servicios activos que aplican al canal/tipo elegido. */
  get serviciosDisponibles(): Producto[] {
    return this.serviciosCatalogo.filter(p => {
      if (p.estado !== 'activo') return false;
      if (this.canal === 'estetica') {
        if (!this.esServicioEstetica(p)) return false;
        return !p.tipoServicioEstetica || !this.tipoServicio || p.tipoServicioEstetica === this.tipoServicio;
      }
      if (this.esServicioEstetica(p)) return false;
      return !p.tipoCita || !this.tipo || p.tipoCita === this.tipo;
    });
  }

  /** Ítems de la cita listos para la venta (snapshot con precio actual). */
  get itemsServicioSeleccionados(): ItemVenta[] {
    return this.seleccionServicios
      .map(s => {
        const p = this.serviciosCatalogo.find(x => x.idProducto === s.idProducto);
        if (!p) return null;
        const cantidad = Math.max(1, s.cantidad);
        const precio = Number(p.precio) || 0;
        return {
          idProducto: p.idProducto,
          nombre: p.nombre,
          categoria: p.categoria,
          tipo: p.tipo,
          cantidad,
          precioUnitario: precio,
          subtotal: precio * cantidad,
        } as ItemVenta;
      })
      .filter((i): i is ItemVenta => !!i);
  }

  get totalServicios(): number {
    return this.itemsServicioSeleccionados.reduce((acc, i) => acc + i.subtotal, 0);
  }

  cantidadDe(idProducto: string): number {
    return this.seleccionServicios.find(s => s.idProducto === idProducto)?.cantidad ?? 0;
  }

  /** Etiqueta del mapeo del servicio para el listado del formulario. */
  etiquetaServicioCatalogo(p: Producto): string {
    if (p.tipoServicioEstetica) return labelTipoServicio(p.tipoServicioEstetica);
    return p.tipoCita ?? '';
  }

  toggleServicio(p: Producto) {
    if (this.cantidadDe(p.idProducto) > 0) {
      this.seleccionServicios = this.seleccionServicios.filter(s => s.idProducto !== p.idProducto);
    } else {
      this.seleccionServicios = [...this.seleccionServicios, { idProducto: p.idProducto, cantidad: 1 }];
    }
    this.validarFormulario();
  }

  cambiarCantidad(idProducto: string, delta: number) {
    this.seleccionServicios = this.seleccionServicios.map(s =>
      s.idProducto === idProducto
        ? { ...s, cantidad: Math.max(1, Math.min(99, s.cantidad + delta)) }
        : s
    );
    this.validarFormulario();
  }

  onTipoServicioChange() {
    this.podarSeleccionServicios();
    this.validarFormulario();
  }

  /** Quita de la selección los servicios que ya no aplican al canal/tipo. */
  private podarSeleccionServicios() {
    const validos = new Set(this.serviciosDisponibles.map(p => p.idProducto));
    this.seleccionServicios = this.seleccionServicios.filter(s => validos.has(s.idProducto));
  }

  /** Veterinarios activos filtrados por especialidad del tipo elegido. */
  get veterinariosDisponibles(): any[] {
    if (!this.tipo) return this.veterinarios;
    return this.veterinarios.filter(v =>
      cubreTipoDeCita(normalizarEspecialidades(v), this.tipo)
      || (v.uid ?? v.idVeterinario) === this.idVeterinario
    );
  }

  /** Profesionales según el canal: veterinarios (médico) o groomers (estética). */
  get profesionalesDisponibles(): any[] {
    return this.canal === 'estetica' ? this.groomers : this.veterinariosDisponibles;
  }

  /** El veterinario elegido no cubre el tipo seleccionado (bloqueo con aviso). */
  get veterinarioIncompatible(): boolean {
    if (!this.idVeterinario || !this.tipo || this.tipo === 'Estética') return false;
    const v = this.veterinarios.find(x => (x.uid ?? x.idVeterinario) === this.idVeterinario);
    if (!v) return false;
    return !cubreTipoDeCita(normalizarEspecialidades(v), this.tipo);
  }

  /** Tipos de cita ofrecidos según el canal y el profesional elegido. */
  get tiposDisponibles(): { value: string; label: string; clase: string }[] {
    if (this.canal === 'estetica') {
      return this.TIPOS_LISTA.filter(t => t.value === 'Estética');
    }
    const medicos = this.TIPOS_LISTA.filter(t => t.value !== 'Estética');
    const v = this.veterinarios.find(x => (x.uid ?? x.idVeterinario) === this.idVeterinario);
    if (!v) return medicos;
    // Veterinario primero: tipos limitados a sus especialidades.
    // En edición se conserva el tipo actual aunque el vet no lo cubra (aviso aparte).
    const esp = normalizarEspecialidades(v);
    return medicos.filter(t => cubreTipoDeCita(esp, t.value) || t.value === this.tipo);
  }

  /** Texto de la opción del profesional con sus especialidades. */
  labelOpcionProfesional(u: any): string {
    const nombre = `${u.Nombre ?? u.nombre ?? ''} ${u.Apellido ?? u.apellido ?? ''}`.trim();
    const esp = normalizarEspecialidades(u).join(' · ');
    return `${nombre} — ${esp}`;
  }

  get mostrarSelectorSlots(): boolean {
    if (this.canal === 'estetica' || this.esEstetica) return !!this.idGroomer && !!this.fecha;
    return !!this.idVeterinario && !!this.fecha;
  }

  get sinHorarioAsignado(): boolean {
    if (this.canal === 'estetica' || this.esEstetica) return false;
    return !!this.idVeterinario && !!this.fecha && this.slotsHabilitadosVet.size === 0;
  }

  get mostrarSlots(): boolean {
    if (this.canal === 'estetica' || this.esEstetica) return this.mostrarSelectorSlots;
    return this.mostrarSelectorSlots && this.slotsHabilitadosVet.size > 0;
  }

  private subs: Subscription[] = [];
  private mascotasSub?: Subscription;
  private horarioSvc = inject(HorarioService);
  private yaRevisó = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private citaSvc: CitaService,
    private userSvc: UserService,
    private mascotaSvc: MascotaService,
    private loadingCtrl: LoadingController,
    private modalCtrl: ModalController,
    private diagnosticoSvc: DiagnosticoService,
    private registroSvc: RegistroClinicoService,
    public authService: AuthService,
    private alertCtrl: AlertController,
    private util: UtilidadesService,
    private productoSvc: ProductoService,
    private citaVentaSvc: CitaVentaService,
  ) {}

  async ngOnInit() {
    this.generarSlots();
    await this.inicializarSesion();
    this.suscribirPrivilegios();
    await this.cargarListas();
    this.cargarCitasEnCalendario();
    this.subs.push(
      this.route.queryParams.subscribe(async params => {
        if (params['modo'] === 'editar' && params['id']) {
          this.modo = 'editar';
          this.idCita = params['id'];
          await this.cargarCitaEnFormulario(this.idCita);
          this.modalNuevaOpen = true;
        }
      })
    );
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
    this.mascotasSub?.unsubscribe();
  }

  private suscribirPrivilegios() {
    const esAdmin = this.rolActual === 'administrador';
    this.subs.push(
      this.authService.privilegios$.subscribe(p => {
        const pr = p ?? {};
        this.puedeCrearCitas = (esAdmin || pr['crearCitas'] === true) && this.rolActual !== 'veterinario';
        this.puedeVerCitas = esAdmin || pr['verCitas'] === true || pr['verCitasAsignadas'] === true;
        this.puedeReprogramar = (esAdmin || pr['reprogramarCitas'] === true) && this.rolActual !== 'veterinario';
        this.puedeCancelarCitas = esAdmin || pr['cancelarCitas'] === true || pr['reprogramarCitas'] === true;
        // Fase 1: escribir contenido clínico es exclusivo del veterinario con privilegio.
        this.puedeDiagnosticar = this.rolActual === 'veterinario' && pr['diagnosticarCitas'] === true;
      })
    );
  }

  async showDetail(cita: Cita) {
    this.citaDetalle = cita;
    this.ventaDeCita = null;
    this.modalDetalleOpen = true;
    if (cita && cita.idCita) {
      await this.refrescarExisteDiagnostico(cita.idCita);
      this.citaVentaSvc.getVentaPorCitaOnce(cita.idCita)
        .then(v => {
          if (this.citaDetalle?.idCita === cita.idCita) this.ventaDeCita = v;
        })
        .catch(() => undefined);
    } else {
      this.existeDiagnostico = false;
    }
  }

  /** Un cita tiene contenido clínico si existe su RegistroClínico (o legado). */
  private async refrescarExisteDiagnostico(idCita: string) {
    const reg = await this.registroSvc.getPorCitaOnce(idCita);
    const legado = reg ? null : await this.diagnosticoSvc.getOnce(idCita);
    this.existeDiagnostico = !!reg || !!legado;
  }

  esVeterinarioAsignado(): boolean {
    if (!this.citaDetalle) return false;
    return this.rolActual === 'veterinario' && this.citaDetalle.idVeterinario === this.uidActual;
  }

  async abrirDiagnosticoModal(soloLectura: boolean) {
    if (!this.citaDetalle) return;

    const cita = this.citaDetalle;

    const esVetAsignado = this.esVeterinarioAsignado();

    // Solo el veterinario asignado edita; el resto ve en modo lectura.
    if (!esVetAsignado) soloLectura = true;

    if (!this.puedeDiagnosticar && !soloLectura) {
      await this.util.showToast('No tienes permiso para registrar diagnósticos', 'warning');
      return;
    }

    const eraFinalizada = cita.estado === 'finalizada';

    if (!soloLectura && !eraFinalizada && cita.estado === 'pendiente') {
      await this.citaSvc.cambiarEstado(cita.idCita, 'en_proceso');
      this.citaDetalle = { ...cita, estado: 'en_proceso' };
    }

    const modal = await this.modalCtrl.create({
      component: DiagnosticoModalComponent,
      componentProps: {
        cita: this.citaDetalle,
        nombreVeterinario: this.getNombreVetActual(),
        soloLectura,
      },
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      backdropDismiss: false,
      cssClass: 'modal-diagnostico-desktop'
    });

    await modal.present();
    const { data } = await modal.onWillDismiss();

    if (data?.guardado) this.existeDiagnostico = true;

    // Transición de estado solo en el flujo de atención (cita aún no finalizada).
    if (!soloLectura && !eraFinalizada && esVetAsignado) {
      const nuevoEstado = data?.guardado ? 'finalizada' : 'pendiente';
      await this.citaSvc.cambiarEstado(cita.idCita, nuevoEstado);
      this.citaDetalle = { ...this.citaDetalle, estado: nuevoEstado };
    } else {
      await this.refrescarExisteDiagnostico(cita.idCita);
    }
  }

  private getNombreVetActual(): string {
    const v = this.veterinarios.find(v =>
      (v.uid ?? v.idVeterinario) === (this.rolActual === 'veterinario' ? this.uidActual : this.citaDetalle?.idVeterinario)
    );
    if (v) return `${v.Nombre ?? ''} ${v.Apellido ?? ''}`.trim();
    if (this.rolActual === 'veterinario') return this.nombreRecepcionista;
    return this.citaDetalle?.nombreVeterinario ?? '';
  }

  private cargarCitasEnCalendario() {
    const obs$ = this.rolActual === 'veterinario'
      ? this.citaSvc.getPorVeterinario(this.uidActual)
      : this.citaSvc.getTodas();

    this.subs.push(
      obs$.subscribe(citas => {
        this.todasCitas = [...citas];
        if (!this.yaRevisó) {
          this.yaRevisó = true;
          this.citaSvc.revisarVencidas();
        }
      })
    );
  }

  onCitaClick(cita: Cita) { this.showDetail(cita); }

  onSlotClick(event: { dateStr: string; hora: string }) {
    if (this.rolActual === 'veterinario') return;
    this.openNew(event.dateStr, event.hora);
  }

  openNew(dateStr?: string, hora?: string) {
    this.modo = 'crear';
    this.idCita = '';
    this.idCliente = '';
    this.idMascota = '';
    this.idVeterinario = '';
    this.idGroomer = '';
    this.tipoServicio = '';
    this.observacionesCliente = '';
    this.canal = 'veterinario';
    this.fecha = dateStr ?? this.hoy;
    this.horaInicio = '';
    this.horaFin = '';
    this.horasSeleccionadas = [];
    this.tipo = '';
    this.estado = 'pendiente';
    this.notas = '';
    this.notasRecepcion = '';
    this.seleccionServicios = [];
    this.mascotas = [];
    this.formularioEsValido = false;
    this.modalTitulo = hora ? `Nueva cita · ${hora}` : 'Nueva cita';

    if (hora && this.slotsHora.includes(hora)) this.toggleSlot(hora);
    this.modalNuevaOpen = true;
  }

  closeModal() {
    this.modalNuevaOpen = false;
    this.horasSeleccionadas = [];
  }

  closeDetail() {
    this.modalDetalleOpen = false;
    this.citaDetalle = null;
  }

  async editFromDetail() {
    if (!this.citaDetalle) return;

    const { editable, motivo } = this.citaEsEditable(this.citaDetalle);

    if (!editable) {
      await this.util.showToast(motivo, 'warning');
      return;
    }

    const cita = { ...this.citaDetalle };
    this.closeDetail();
    this.cargarEnFormulario(cita);
    this.modalNuevaOpen = true;
  }

  generarSlots() {
    const slots: string[] = [];

    for (let h = 8; h < 13; h++) {
      slots.push(`${String(h).padStart(2, '0')}:00`);
      slots.push(`${String(h).padStart(2, '0')}:30`);
    }

    for (let h = 13; h < 18; h++) {
      slots.push(`${String(h).padStart(2, '0')}:00`);
      slots.push(`${String(h).padStart(2, '0')}:30`);
    }

    this.slotsHora = slots;
  }

  toggleSlot(slot: string) {
    if (this.isSlotOcupado(slot)) return;

    const idx = this.slotsHora.indexOf(slot);
    const selIdx = this.horasSeleccionadas
      .map(s => this.slotsHora.indexOf(s))
      .sort((a, b) => a - b);

    if (this.horasSeleccionadas.includes(slot)) {
      if (selIdx.length === 1) {
        this.horasSeleccionadas = [];
      } else if (idx === selIdx[0]) {
        this.horasSeleccionadas = selIdx.slice(1).map(i => this.slotsHora[i]);
      } else if (idx === selIdx[selIdx.length - 1]) {
        this.horasSeleccionadas = selIdx.slice(0, -1).map(i => this.slotsHora[i]);
      } else {
        this.horasSeleccionadas = [slot];
      }
    } else {
      if (selIdx.length === 0) {
        this.horasSeleccionadas = [slot];
      } else {
        const min = selIdx[0];
        const max = selIdx[selIdx.length - 1];
        if (idx === min - 1) this.horasSeleccionadas = [slot, ...this.horasSeleccionadas];
        else if (idx === max + 1) this.horasSeleccionadas = [...this.horasSeleccionadas, slot];
        else this.horasSeleccionadas = [slot];
      }
    }

    if (this.horasSeleccionadas.length === 0) {
      this.horaInicio = '';
      this.horaFin = '';
    } else {
      const sorted = this.horasSeleccionadas
        .map(s => this.slotsHora.indexOf(s))
        .sort((a, b) => a - b)
        .map(i => this.slotsHora[i]);
      this.horaInicio = sorted[0];
      this.horaFin = this.util.sumarMinutos(sorted[sorted.length - 1], 30);
    }

    this.validarFormulario();
  }

  isSlotOcupado(slot: string): boolean {
    if (this.slotsHabilitadosVet.size > 0 && !this.slotsHabilitadosVet.has(slot)) {
      return true;
    }

    const asignado = this.esEstetica ? this.idGroomer : this.idVeterinario;
    if (!asignado || !this.fecha) return false;
    if (this.modo === 'crear' && this.esFechaPasada) return true;

    const slotMin = this.util.toMinutos(slot);
    const slotFinMin = slotMin + 30;

    return this.todasCitas.some(c => {
      if (c.idCita === this.idCita) return false;
      const idDeLaCita = this.esEstetica ? c.idGroomer : c.idVeterinario;
      if (idDeLaCita !== asignado) return false;
      if (c.fecha !== this.fecha) return false;
      if (c.estado === 'cancelada' || c.estado === 'no_asistio') return false;

      const cStart = this.util.toMinutos(c.horaInicio);
      const cEnd = this.util.toMinutos(c.horaFin);
      return slotMin < cEnd && slotFinMin > cStart;
    });
  }

  validarFormulario() {
    const esEstetica = this.tipo === 'Estética';
    const asignadoOk = esEstetica ? !!this.idGroomer : !!this.idVeterinario;
    const servicioOk = esEstetica ? !!this.tipoServicio : true;
    // Los servicios de la cita son opcionales: la cita puede no generar venta.
    // Bloqueo por especialidad: si el vet elegido no cubre el tipo, no se guarda.
    const tipoCubierto = !this.tipo || esEstetica || !this.veterinarioIncompatible;
    this.formularioEsValido = !!(
      this.idCliente && this.idMascota && asignadoOk && servicioOk &&
      this.fecha && !this.esFechaPasada &&
      this.horaInicio && this.tipo && tipoCubierto
    );
  }

  /** Cambia el canal del profesional (veterinario médico / estética). */
  seleccionarCanal(c: 'veterinario' | 'estetica') {
    if (this.canal === c) return;
    this.canal = c;
    if (c === 'estetica') {
      this.tipo = 'Estética';
    } else if (this.tipo === 'Estética') {
      // Conserva la asignación de groomer en memoria; aquí el canal es médico.
      this.tipo = '';
    }
    this.podarSeleccionServicios();
    this.validarFormulario();
  }

  /**
   * Elige el tipo de cita SIN borrar lo ya seleccionado (profesional, fecha
   * ni horas): solo ajusta el canal y revalida.
   */
  seleccionarTipo(t: { value: string }) {
    if (t.value === 'Estética') {
      this.canal = 'estetica';
      this.tipo = 'Estética';
    } else {
      this.canal = 'veterinario';
      this.tipo = t.value;
    }
    this.podarSeleccionServicios();
    this.validarFormulario();
  }

  onGroomerChange() {
    this.cargarSlotsDelVet();
  }

  private async cargarSlotsDelVet() {
    // Estética: los groomers no tienen horario configurado; no se restringe
    // ni se descartan las horas ya elegidas al cambiar de canal.
    if (this.canal === 'estetica' || this.esEstetica) {
      this.slotsHabilitadosVet = new Set();
      this.validarFormulario();
      return;
    }

    if (!this.idVeterinario || !this.fecha) {
      this.slotsHabilitadosVet = new Set();
      return;
    }

    try {
      const horarios = await this.horarioSvc.getHorariosOnce(this.idVeterinario);
      const date = new Date(this.fecha + 'T12:00:00');
      const diaNom = DOW_MAP[date.getDay()];
      const horarioDia = horarios.find((h: HorarioDia) => h.dia === diaNom);

      if (!horarioDia || !horarioDia.activo || horarioDia.turnos.length === 0) {
        this.slotsHabilitadosVet = new Set();
      } else {
        const slots = this.horarioSvc.getSlotsFromTurnos(horarioDia.turnos);
        this.slotsHabilitadosVet = new Set(slots);
      }
    } catch {
      this.slotsHabilitadosVet = new Set();
    }

    this.horasSeleccionadas = this.horasSeleccionadas.filter(s =>
      (this.slotsHabilitadosVet.size === 0 || this.slotsHabilitadosVet.has(s)) &&
      !this.isSlotOcupado(s)
    );
    if (this.horasSeleccionadas.length > 0) {
      const sorted = this.horasSeleccionadas
        .map(s => this.slotsHora.indexOf(s)).sort((a, b) => a - b)
        .map(i => this.slotsHora[i]);
      this.horaInicio = sorted[0];
      this.horaFin = this.util.sumarMinutos(sorted[sorted.length - 1], 30);
    } else {
      this.horaInicio = '';
      this.horaFin = '';
    }
    this.validarFormulario();
  }

  onVeterinarioChange() {
    this.cargarSlotsDelVet();
  }

  onFechaChange() {
    this.cargarSlotsDelVet();
  }

  async onClienteChange() {
    this.idMascota = '';
    this.mascotas = [];
    if (!this.idCliente) return;
    this.mascotasSub?.unsubscribe();
    this.mascotasSub = this.mascotaSvc.getMascotasPorCliente(this.idCliente)
      .subscribe(mascotas => {
        this.mascotas = mascotas.filter(m => m.estado === 'activo');
      });
  }

  private cargarEnFormulario(cita: Cita) {
    this.modo = 'editar';
    this.idCita = cita.idCita;
    this.idCliente = cita.idCliente;
    this.idVeterinario = cita.idVeterinario;
    this.idGroomer = cita.idGroomer ?? '';
    this.tipoServicio = cita.tipoServicio ?? '';
    this.observacionesCliente = cita.observacionesCliente ?? '';
    this.fecha = cita.fecha;
    this.horaInicio = cita.horaInicio;
    this.horaFin = cita.horaFin;
    this.tipo = cita.tipo;
    this.canal = cita.tipo === 'Estética' ? 'estetica' : 'veterinario';
    this.estado = cita.estado;
    this.notas = cita.notas;
    this.notasRecepcion = cita.notasRecepcion ?? '';
    this.seleccionServicios = (cita.itemsServicio ?? []).map(i => ({
      idProducto: i.idProducto,
      cantidad: i.cantidad,
    }));
    this.modalTitulo = 'Editar cita';

    this.horasSeleccionadas = this.slotsHora.filter(slot => {
      const s = this.util.toMinutos(slot);
      const fi = s + 30;
      const ci = this.util.toMinutos(cita.horaInicio);
      const cf = this.util.toMinutos(cita.horaFin);
      return s >= ci && fi <= cf;
    });

    this.mascotaSvc.getMascotasPorCliente(this.idCliente)
      .pipe(take(1))
      .subscribe(mascotas => {
        this.mascotas = mascotas.filter(m => m.estado === 'activo');
        this.idMascota = cita.idMascota;
        this.validarFormulario();
      });
  }

  private async cargarCitaEnFormulario(idCita: string) {
    const cita = await this.citaSvc.getCitaOnce(idCita);
    if (cita) this.cargarEnFormulario(cita);
  }

  private async inicializarSesion() {
    const resultado = this.authService.resolverRolActual();
    if (!resultado) return;

    this.uidActual = resultado.uid;
    this.rolActual = resultado.rol;

    // El nombre del usuario en sesión (recepción, admin o veterinario).
    const data = await this.userSvc.getDocumentOnce('recepcionistas', this.uidActual);
    if (data) {
      this.nombreRecepcionista = `${data.Nombre ?? ''} ${data.Apellido ?? ''}`.trim();
    } else {
      const admin = await this.userSvc.getDocumentOnce('administradores', this.uidActual);
      if (admin) {
        this.nombreRecepcionista = `${admin.Nombre ?? ''} ${admin.Apellido ?? ''}`.trim();
      } else {
        const vet = await this.userSvc.getDocumentOnce('veterinarios', this.uidActual);
        if (vet) {
          this.nombreRecepcionista = `${vet.Nombre ?? ''} ${vet.Apellido ?? ''}`.trim();
        }
      }
    }
  }

  private async cargarListas() {
    this.subs.push(
      this.userSvc.getTodosLosUsuarios().subscribe(users => {
        this.clientes = users.filter(u =>
          (u.rol === 'cliente' || u.coleccion === 'clientes') && u.estado === 'activo'
        );
        this.veterinarios = users.filter(u =>
          (u.rol === 'veterinario' || u.coleccion === 'veterinarios') && u.estado === 'activo'
        );
        this.groomers = users.filter(u =>
          (u.rol === 'groomer' || u.coleccion === 'groomers') && u.estado === 'activo'
        );
      })
    );

    // Catálogo de servicios para ligar la cita a una o más cuentas por cobrar.
    // Incluye documentos legados sin `tipo` cuya categoría sea de servicio.
    this.subs.push(
      this.productoSvc.getTodos().subscribe(productos => {
        this.serviciosCatalogo = productos.filter(p =>
          p.tipo === 'servicio'
          || (!p.tipo && (p.categoria === 'servicios' || p.categoria === 'estetica'))
        );
      })
    );
  }

  private getNombreCliente(): string {
    const c = this.clientes.find(x => x.idCliente === this.idCliente || x.uid === this.idCliente);
    if (!c) return '';
    return `${c.Nombre ?? c.nombre ?? ''} ${c.Apellido ?? c.apellido ?? ''}`.trim();
  }

  private getNombreMascota(): string {
    return this.mascotas.find(x => x.idMascota === this.idMascota)?.nombre ?? '';
  }

  private getNombreGroomer(): string {
    const g = this.groomers.find(x => x.idGroomer === this.idGroomer || x.uid === this.idGroomer);
    if (g) return `${g.Nombre ?? g.nombre ?? ''} ${g.Apellido ?? g.apellido ?? ''}`.trim();
    if (this.modo === 'editar' && this.idCita) {
      const citaExistente = this.todasCitas.find(c => c.idCita === this.idCita);
      return citaExistente?.nombreGroomer ?? '';
    }
    return '';
  }

  private getNombreVeterinario(): string {
    const v = this.veterinarios.find(x => x.idVeterinario === this.idVeterinario || x.uid === this.idVeterinario);
    if (v) return `${v.Nombre ?? v.nombre ?? ''} ${v.Apellido ?? v.apellido ?? ''}`.trim();
    if (this.modo === 'editar' && this.idCita) {
      const citaExistente = this.todasCitas.find(c => c.idCita === this.idCita);
      return citaExistente?.nombreVeterinario ?? '';
    }
    return '';
  }

  async guardar() {
    if (!this.formularioEsValido) {
      await this.util.showToast('Completa todos los campos requeridos', 'warning');
      return;
    }
    if (this.esFechaPasada) {
      await this.util.showToast('No se pueden registrar citas en fechas u horas pasadas', 'danger');
      return;
    }
    if (this.horaInicio && this.isSlotOcupado(this.horaInicio)) {
      await this.util.showToast('Ese horario ya está ocupado para el profesional seleccionado', 'danger');
      return;
    }
    // Bloqueo por especialidad (defensa; la UI ya lo impide).
    if (this.veterinarioIncompatible) {
      await this.util.showToast(
        'El veterinario elegido no cubre ese tipo de cita según su especialidad',
        'warning'
      );
      return;
    }

    const loading = await this.loadingCtrl.create({
      message: this.modo === 'crear' ? 'Registrando cita...' : 'Actualizando cita...',
    });
    await loading.present();
    try {
      const esEstetica = this.esEstetica;
      const payload: Omit<Cita, 'idCita' | 'idVenta' | 'fechaRegistro'> = {
        idCliente: this.idCliente,
        nombreCliente: this.getNombreCliente(),
        idMascota: this.idMascota,
        nombreMascota: this.getNombreMascota(),
        idVeterinario: esEstetica ? '' : this.idVeterinario,
        nombreVeterinario: esEstetica ? '' : this.getNombreVeterinario(),
        idRecepcionista: this.uidActual,
        nombreRecepcionista: this.nombreRecepcionista,
        fecha: this.fecha,
        horaInicio: this.horaInicio,
        horaFin: this.horaFin,
        tipo: this.tipo,
        categoria: this.categoriaParaTipo(this.tipo),
        estado: this.modo === 'crear' ? 'pendiente' : this.estado,
        notas: this.notas,
        // Fase 2: campos operativos de estética (idGroomer reemplaza al vet).
        ...(esEstetica ? {
          idGroomer: this.idGroomer,
          nombreGroomer: this.getNombreGroomer(),
          tipoServicio: this.tipoServicio,
          observacionesCliente: this.observacionesCliente.trim(),
          notasRecepcion: this.notasRecepcion.trim(),
        } : {}),
      };

      const items = this.itemsServicioSeleccionados;

      if (this.modo === 'crear') {
        const res = await this.citaVentaSvc.crearCitaConVenta(payload, items);
        this.closeModal();
        await this.util.showToast(
          res.idVenta
            ? 'Cita registrada. La cuenta quedó pendiente en Cobranza.'
            : 'Cita registrada correctamente',
          'success'
        );
      } else {
        const citaAnterior = this.todasCitas.find(c => c.idCita === this.idCita) ?? this.citaDetalle;
        const itemsAnteriores = citaAnterior?.itemsServicio ?? [];
        const firma = (lista: ItemVenta[]) =>
          JSON.stringify(lista.map(i => [i.idProducto, i.cantidad]).sort());
        if (this.idCita && firma(itemsAnteriores) !== firma(items)) {
          if (items.length) {
            // Solo se edita la venta si sigue pendiente y sin abonos.
            await this.citaVentaSvc.actualizarVentaDeCita(this.idCita, items);
          } else {
            // Se quitaron todos los servicios: se anula la cuenta por cobrar.
            await this.citaVentaSvc.quitarVentaDeCita(this.idCita);
          }
        }
        await this.citaSvc.actualizarCita(this.idCita, payload);
        await this.util.showToast('Cita actualizada correctamente', 'success');
        this.closeModal();
      }
    } catch (err: any) {
      console.error(err);
      await this.util.showToast(err?.message ?? 'Error al guardar la cita', 'danger');
    } finally {
      await loading.dismiss();
    }
  }

  /** Categoría clínica derivada del tipo de cita (catálogo F0). */
  private categoriaParaTipo(tipo: string) {
    return categoriaCitaPorTipo(tipo);
  }

  cancelar() { this.closeModal(); }

  getBadgeColor(estado: string): string { return this.util.getBadgeColorEstado(estado); }

  /** Saldo pendiente de la venta vinculada (0 si está pagada o anulada). */
  saldoDeVenta(v: Venta): number { return saldoVenta(v); }

  getClaseTipo(tipo: string): string { return this.util.getClaseTipo(tipo); }

  formatHora12Slot(hora: string): string { return this.util.formatHora12(hora); }

  /** Etiqueta del estado en español. */
  textoEstado(estado: string): string { return this.util.textoEstado(estado); }

  get esFechaPasada(): boolean {
    if (!this.fecha) return false;
    if (this.fecha < this.hoy) return true;
    if (this.fecha === this.hoy) {
      const ahora = new Date();
      const horaAhora = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;
      return this.horaFin !== '' && this.horaFin <= horaAhora;
    }
    return false;
  }

  get hoy(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  citaEsEditable(cita: Cita): { editable: boolean; motivo: string } {
    const estadosNoEditables: Record<string, string> = {
      finalizada: 'Esta cita ya fue finalizada',
      cancelada: 'Esta cita fue cancelada',
      no_asistio: 'El cliente no asistió a esta cita',
    };

    if (estadosNoEditables[cita.estado]) {
      return { editable: false, motivo: estadosNoEditables[cita.estado] };
    }

    const ahora = new Date();
    const fechaHoy = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
    const horaAhora = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;

    if (cita.fecha < fechaHoy) {
      return { editable: false, motivo: 'Esta cita pertenece a una fecha pasada' };
    }

    if (cita.fecha === fechaHoy && cita.horaFin <= horaAhora) {
      return { editable: false, motivo: 'El horario de esta cita ya pasó' };
    }

    return { editable: true, motivo: '' };
  }

  get puedeEditar(): boolean {
    if (!this.citaDetalle) return false;
    return this.citaEsEditable(this.citaDetalle).editable;
  }

  /** Abre el expediente de la mascota en la pestaña de la categoría de la cita. */
  async verExpedienteDesdeCita() {
    if (!this.citaDetalle) return;
    const cita = this.citaDetalle;
    const mascota = await this.mascotaSvc.getMascotaOnce(cita.idCliente, cita.idMascota);
    if (!mascota) {
      await this.util.showToast('No se encontró la mascota de la cita', 'warning');
      return;
    }
    const info = infoTipoCita(cita.tipo);
    const modal = await this.modalCtrl.create({
      component: MascotaDetalleComponent,
      componentProps: {
        mascota,
        modoExpediente: true,
        pestanaInicial: info?.pestañaExpediente ?? 'Cronología',
      },
      cssClass: 'modal-mascota-detalle',
      breakpoints: [0, 0.95, 1],
      initialBreakpoint: 0.95,
    });
    await modal.present();
  }

  async abrirReasignacion() {
    if (!this.citaDetalle) return;

    const modal = await this.modalCtrl.create({
      component: ReasignarVeterinarioComponent,
      componentProps: {
        cita: this.citaDetalle,
        nombreVeterinarioActual: this.citaDetalle.nombreVeterinario,
      },
      breakpoints: [1],
      initialBreakpoint: 1,
    });

    await modal.present();

    const { data } = await modal.onWillDismiss();
    if (data?.reasignado) this.closeDetail();
  }

  async cancelarCita() {
    if (!this.citaDetalle || this.citaDetalle.estado !== 'pendiente') return;
    if (!this.puedeCancelarCitas) {
      await this.util.showToast('No tienes permiso para cancelar citas', 'warning');
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Cancelar cita',
      message: `¿Confirmas la cancelación de la cita de ${this.citaDetalle.nombreMascota}?`,
      buttons: [
        { text: 'No', role: 'cancel' },
        {
          text: 'Sí, cancelar',
          handler: async () => {
            try {
              await this.citaSvc.cambiarEstado(this.citaDetalle!.idCita, 'cancelada');
              this.citaDetalle = { ...this.citaDetalle!, estado: 'cancelada' };
              this.todasCitas = this.todasCitas.map(c =>
                c.idCita === this.citaDetalle!.idCita ? { ...c, estado: 'cancelada' } : c
              );
              await this.util.showToast('Cita cancelada', 'success');
              this.closeDetail();
            } catch {
              await this.util.showToast('Error al cancelar la cita', 'danger');
            }
          },
        },
      ],
    });
    await alert.present();
  }

  /** Marca manualmente la cita como "no asistió". */
  async marcarNoAsistio() {
    if (!this.citaDetalle || this.citaDetalle.estado !== 'pendiente') return;
    if (!this.puedeCancelarCitas) {
      await this.util.showToast('No tienes permiso para esta acción', 'warning');
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Marcar como no asistió',
      message: `¿Confirmas que ${this.citaDetalle.nombreMascota} no asistió a la cita?`,
      buttons: [
        { text: 'No', role: 'cancel' },
        {
          text: 'Sí, no asistió',
          handler: async () => {
            try {
              await this.citaSvc.cambiarEstado(this.citaDetalle!.idCita, 'no_asistio');
              this.citaDetalle = { ...this.citaDetalle!, estado: 'no_asistio' };
              this.todasCitas = this.todasCitas.map(c =>
                c.idCita === this.citaDetalle!.idCita ? { ...c, estado: 'no_asistio' } : c
              );
              await this.util.showToast('Cita marcada como no asistió', 'success');
              this.closeDetail();
            } catch {
              await this.util.showToast('Error al actualizar la cita', 'danger');
            }
          },
        },
      ],
    });
    await alert.present();
  }
}
