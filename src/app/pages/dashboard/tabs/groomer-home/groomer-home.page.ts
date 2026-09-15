import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { ModalController } from '@ionic/angular';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AuthService } from 'src/app/core/services/auth.service';
import { AgendaService } from 'src/app/core/services/agenda.service';
import { labelTipoServicio } from 'src/app/core/services/citas-estetica.service';
import { Cita } from 'src/app/core/models/cita.model';
import { ServicioEsteticaModalComponent } from 'src/app/shared/components/servicio-estetica-modal/servicio-estetica-modal.component';
import { UtilidadesService } from 'src/app/core/services/utilidades.service';

/**
 * @description Estación de servicio del groomer: tablero por estados
 * (por iniciar / en proceso / finalizadas hoy / escaladas) y calendario
 * compartido en modo estética.
 */
@Component({
  selector: 'app-groomer-home',
  templateUrl: './groomer-home.page.html',
  styleUrls: ['./groomer-home.page.scss'],
  standalone: false,
})
export class GroomerHomePage implements OnInit, OnDestroy {

  private firestore = inject(Firestore);
  private agendaSvc = inject(AgendaService);
  private auth = inject(AuthService);
  private modalCtrl = inject(ModalController);
  private util = inject(UtilidadesService);
  private destroy$ = new Subject<void>();

  groomerUid = '';
  groomerNombre = '';
  groomerApellido = '';

  todas: Cita[] = [];
  hoy = '';
  vista: 'agenda' | 'calendario' = 'agenda';
  /** El calendario de estética no usa filtro por profesional. */
  readonly sinProfesionales: any[] = [];

  constructor() {
    const d = new Date();
    this.hoy = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  get iniciales(): string {
    return `${this.groomerNombre?.[0] ?? ''}${this.groomerApellido?.[0] ?? ''}`.toUpperCase();
  }

  get porIniciar(): Cita[] {
    return this.todas
      .filter(c => c.estado === 'pendiente')
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.horaInicio.localeCompare(b.horaInicio));
  }

  get enProceso(): Cita[] {
    return this.todas
      .filter(c => c.estado === 'en_proceso')
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.horaInicio.localeCompare(b.horaInicio));
  }

  get finalizadasHoy(): Cita[] {
    return this.todas
      .filter(c => c.estado === 'finalizada' && c.fecha === this.hoy)
      .sort((a, b) => b.horaInicio.localeCompare(a.horaInicio));
  }

  get escaladas(): Cita[] {
    return this.todas
      .filter(c => c.escaladoAVeterinario)
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }

  get historial(): Cita[] {
    return this.todas.filter(c => c.estado === 'finalizada' && c.fecha !== this.hoy);
  }

  get proximaCita(): Cita | null {
    const ahora = `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;
    return this.porIniciar
      .filter(c => c.fecha > this.hoy || (c.fecha === this.hoy && c.horaInicio >= ahora))[0] ?? null;
  }

  ngOnInit() {
    this.groomerUid = this.auth.getUidActual() ?? '';
    this.cargarPerfil();
    this.cargarCitas();
    // El cierre general de vencidas no corre para groomer: se hace aquí.
    if (this.groomerUid) {
      void this.agendaSvc.revisarVencidasGroomer(this.groomerUid).catch(() => undefined);
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async cargarPerfil() {
    if (!this.groomerUid) return;
    const snap = await getDoc(doc(this.firestore, 'groomers', this.groomerUid));
    if (snap.exists()) {
      const data = snap.data() as any;
      this.groomerNombre = data.Nombre ?? '';
      this.groomerApellido = data.Apellido ?? '';
    }
  }

  private cargarCitas() {
    this.agendaSvc.getCitasGroomer(this.groomerUid)
      .pipe(takeUntil(this.destroy$))
      .subscribe(citas => {
        this.todas = citas;
      });
  }

  async abrirCita(cita: Cita) {
    if (cita.estado === 'cancelada' || cita.estado === 'no_asistio') return;

    const modal = await this.modalCtrl.create({
      component: ServicioEsteticaModalComponent,
      componentProps: {
        cita,
        nombreGroomer: `${this.groomerNombre} ${this.groomerApellido}`.trim(),
      },
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      backdropDismiss: false,
      cssClass: 'modal-servicio-estetica-desktop',
    });
    await modal.present();
  }

  onSlotClick(_slot: { dateStr: string; hora: string }) {
    // El groomer no agenda desde el calendario.
  }

  labelServicio(tipo: string): string {
    return labelTipoServicio(tipo);
  }

  resumenChecklist(cita: Cita): string {
    const items = cita.itemsServicio ?? [];
    if (!items.length) return '';
    return items.map(i => i.nombre).join(' + ');
  }

  textoEstado(estado: string): string {
    const map: Record<string, string> = {
      pendiente: 'Por iniciar',
      en_proceso: 'En proceso',
      finalizada: 'Atendida',
      cancelada: 'Cancelada',
      no_asistio: 'No asistió',
    };
    return map[estado] ?? estado;
  }

  colorEstado(estado: string): string {
    const map: Record<string, string> = {
      pendiente: 'warning',
      en_proceso: 'primary',
      finalizada: 'success',
      cancelada: 'medium',
      no_asistio: 'danger',
    };
    return map[estado] ?? 'medium';
  }

  formatHora12(hora: string): string {
    return this.util.formatHora12Compact(hora);
  }
}
