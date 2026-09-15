export interface ResumenVeterinario {
  citasHoy: number;
  citasPendientes: number;
  pacientesAtendidos: number;
  proximaCita: Cita | null;
}

import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { Observable, of, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AuthService } from 'src/app/core/services/auth.service';
import { CitaService } from 'src/app/core/services/cita.service';
import { AgendaService } from 'src/app/core/services/agenda.service';
import { MascotaService } from 'src/app/core/services/mascota.service';
import { Cita } from 'src/app/core/models/cita.model';
import { ModalController } from '@ionic/angular';
import { DiagnosticoModalComponent } from 'src/app/shared/components/diagnostico-modal/diagnostico-modal.component';
import { MascotaDetalleComponent } from 'src/app/shared/components/mascota-detalle/mascota-detalle.component';
import { DiagnosticoService } from 'src/app/core/services/diagnostico.service';
import { RegistroClinicoService } from 'src/app/core/services/registro-clinico.service';
import { UtilidadesService } from 'src/app/core/services/utilidades.service';
import { normalizarEspecialidades } from 'src/app/core/models/especialidades.model';
import { infoTipoCita } from 'src/app/core/models/catalogo-citas.model';

@Component({
  selector: 'app-home-veterinario',
  templateUrl: './home-veterinario.page.html',
  styleUrls: ['./home-veterinario.page.scss'],
  standalone: false,
})
export class HomeVeterinarioPage implements OnInit, OnDestroy {

  private modalCtrl = inject(ModalController);
  private diagnosticoSvc = inject(DiagnosticoService);
  private registroSvc = inject(RegistroClinicoService);
  private auth = inject(AuthService);
  private firestore = inject(Firestore);
  private citaService = inject(CitaService);
  private agendaSvc = inject(AgendaService);
  private mascotaSvc = inject(MascotaService);
  private util = inject(UtilidadesService);
  private destroy$ = new Subject<void>();

  existeDiagnostico = false;
  citaSeleccionada: Cita | null = null;
  modalDetalleOpen = false;
  privilegios: any = {};
  vetUid = '';
  vetNombre = '';
  vetApellido = '';
  vetEspecialidad = '';
  vetFotoUrl = '';
  todasCitas$: Observable<Cita[]> = of([]);
  escaladas$: Observable<Cita[]> = of([]);
  citasActuales: Cita[] = [];
  veterinarios$: Observable<any[]> = of([]);
  resumen: ResumenVeterinario = {
    citasHoy: 0,
    citasPendientes: 0,
    pacientesAtendidos: 0,
    proximaCita: null,
  };
  today = new Date();

  constructor(
    public authService: AuthService,
  ) {}

  get todayStr(): string {
    const d = this.today;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  get saludoHora(): string {
    const h = this.today.getHours();
    if (h < 12) return 'Buenos días';
    if (h < 18) return 'Buenas tardes';
    return 'Buenas noches';
  }

  get inicialesVet(): string {
    return `${this.vetNombre?.[0] ?? ''}${this.vetApellido?.[0] ?? ''}`.toUpperCase();
  }

  accionesRapidas = [
    {
      icon: '🗓',
      label: 'Mis citas',
      sub: 'Pendientes y confirmadas',
      ruta: '/layout/citas',
    },
    {
      icon: '📋',
      label: 'Diagnosticar',
      sub: 'Registrar diagnóstico',
      ruta: '/layout/citas',
    },
    {
      icon: '🐾',
      label: 'Historial',
      sub: 'Ver historial de mascotas',
      ruta: '/layout/mascotas',
    },
  ];

  ngOnInit() {
    this.vetUid = this.auth.getUidActual() ?? '';
    this.cargarPerfil();
    this.cargarCitas();

    this.auth.privilegios$.pipe(takeUntil(this.destroy$)).subscribe(p => {
      this.privilegios = p;
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async cargarPerfil() {
    if (!this.vetUid) return;
    const snap = await getDoc(doc(this.firestore, 'veterinarios', this.vetUid));
    if (snap.exists()) {
      const data = snap.data() as any;
      this.vetNombre = data.Nombre ?? '';
      this.vetApellido = data.Apellido ?? '';
      this.vetEspecialidad = normalizarEspecialidades(data).join(' · ');
      this.vetFotoUrl = data.fotoUrl ?? '';
    }
  }

  cargarCitas() {
    this.todasCitas$ = this.agendaSvc.getCitasVeterinario(this.vetUid);

    this.todasCitas$.pipe(takeUntil(this.destroy$)).subscribe(citas => {
      this.citasActuales = citas;
      this.calcularResumen(citas);
    });

    this.cargarEscaladas();

    this.veterinarios$ = of([{
      uid: this.vetUid,
      idVeterinario: this.vetUid,
      Nombre: this.vetNombre,
      Apellido: this.vetApellido,
    }]);
  }

  /** Citas escaladas por groomers pendientes de asignar. */
  cargarEscaladas() {
    this.escaladas$ = this.agendaSvc.getEscaladasPendientes();
  }

  /** Citas de hoy aún por atender, ordenadas por hora. */
  get citasHoyPendientes(): Cita[] {
    return this.citasActuales
      .filter(c => c.fecha === this.todayStr && !['finalizada', 'cancelada', 'no_asistio'].includes(c.estado))
      .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
  }

  /** Abre el expediente de la mascota en la pestaña de la categoría de la cita. */
  async verExpediente(cita: Cita) {
    const mascota = await this.mascotaSvc.getMascotaOnce(cita.idCliente, cita.idMascota);
    if (!mascota) {
      this.util.showToast('No se encontró la mascota de la cita', 'warning');
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

  calcularResumen(citas: Cita[]) {
    const misCitas = citas.filter(c => c.idVeterinario === this.vetUid);
    const hoy = misCitas.filter(c => c.fecha === this.todayStr);

    const ahora = `${String(this.today.getHours()).padStart(2, '0')}:${String(this.today.getMinutes()).padStart(2, '0')}`;

    const proxima = hoy
      .filter(c => !['finalizada', 'cancelada', 'no_asistio'].includes(c.estado) && c.horaInicio >= ahora)
      .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))[0] ?? null;

    this.resumen = {
      citasHoy: hoy.length,
      citasPendientes: misCitas.filter(c => c.estado === 'pendiente').length,
      pacientesAtendidos: misCitas.filter(c => c.estado === 'finalizada').length,
      proximaCita: proxima,
    };
  }

  async onCitaClick(cita: Cita) {
    if (cita.idVeterinario !== this.vetUid) return;
    if (cita.estado === 'cancelada' || cita.estado === 'no_asistio') return;

    const puedeDiagnosticar = this.auth.tienePrivilegio('diagnosticarCitas');
    if (!puedeDiagnosticar) {
      this.util.showToast('No tienes permiso para registrar diagnósticos', 'warning');
      return;
    }

    this.citaSeleccionada = cita;
    await this.refrescarExisteDiagnostico(cita.idCita);
    await this.abrirDiagnosticoModal();
  }

  /** La cita tiene contenido clínico si existe su RegistroClínico (o legado). */
  private async refrescarExisteDiagnostico(idCita: string) {
    const reg = await this.registroSvc.getPorCitaOnce(idCita);
    const legado = reg ? null : await this.diagnosticoSvc.getOnce(idCita);
    this.existeDiagnostico = !!reg || !!legado;
  }

  async abrirDiagnosticoModal() {
    if (!this.citaSeleccionada) return;

    const idCita = this.citaSeleccionada.idCita;
    const cita = this.citaSeleccionada;
    const eraFinalizada = cita.estado === 'finalizada';

    if (!eraFinalizada && cita.estado === 'pendiente') {
      await this.citaService.cambiarEstado(idCita, 'en_proceso');
      this.citaSeleccionada = { ...cita, estado: 'en_proceso' };
    }

    const modal = await this.modalCtrl.create({
      component: DiagnosticoModalComponent,
      componentProps: {
        cita: this.citaSeleccionada,
        nombreVeterinario: `${this.vetNombre} ${this.vetApellido}`,
        soloLectura: false,
      },
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      backdropDismiss: false,
      cssClass: 'modal-diagnostico-desktop',
    });

    await modal.present();
    const { data } = await modal.onWillDismiss();

    if (data?.guardado) {
      this.existeDiagnostico = true;
    }

    // Solo se mueve el estado en el flujo de atención de una cita no finalizada.
    if (!eraFinalizada) {
      const nuevoEstado = data?.guardado ? 'finalizada' : 'pendiente';
      await this.citaService.cambiarEstado(idCita, nuevoEstado);
      this.citaSeleccionada = { ...this.citaSeleccionada, estado: nuevoEstado };

      const msg = data?.guardado ? 'Registro clínico guardado correctamente' : 'Registro clínico cancelado';
      const color = data?.guardado ? 'success' : 'warning';
      this.util.showToast(msg, color);
    } else {
      await this.refrescarExisteDiagnostico(idCita);
    }
  }

  onSlotClick(_slot: { dateStr: string; hora: string }) {
  }

  badgeEstado(estado: string): string {
    const map: Record<string, string> = {
      pendiente: 'badge-pendiente',
      confirmada: 'badge-confirmada',
      finalizada: 'badge-finalizada',
      cancelada: 'badge-cancelada',
      no_asistio: 'badge-cancelada',
    };
    return map[estado] ?? 'badge-pendiente';
  }

  textoEstado(estado: string): string {
    return this.util.textoEstado(estado);
  }

  formatHora12(hora: string): string {
    return this.util.formatHora12Compact(hora);
  }
}
