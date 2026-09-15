interface Veterinario {
  idVeterinario: string;
  Nombre: string;
  Apellido: string;
  Especialidad?: string;
  especialidades?: string[];
  estado: string;
}

import { Component, Input, OnInit, inject } from '@angular/core';
import { ModalController, LoadingController } from '@ionic/angular';
import { Firestore, collection, collectionData, query, where, getDocs } from '@angular/fire/firestore';
import { map } from 'rxjs';

import { CitaService } from 'src/app/core/services/cita.service';
import { Cita } from 'src/app/core/models/cita.model';
import { HorarioService, DOW_MAP } from 'src/app/core/services/horario.service';
import { UtilidadesService } from 'src/app/core/services/utilidades.service';
import { normalizarEspecialidades, cubreTipoDeCita } from 'src/app/core/models/especialidades.model';

@Component({
  selector: 'app-reasignar-veterinario',
  templateUrl: './reasignar-veterinario.component.html',
  standalone: false,
  styleUrls: ['./reasignar-veterinario.component.scss']
})
export class ReasignarVeterinarioComponent implements OnInit {

  @Input() cita!: Cita;

  @Input() nombreVeterinarioActual = '';

  private firestore = inject(Firestore);
  private citaSvc = inject(CitaService);
  private modalCtrl = inject(ModalController);
  private loadingCtrl = inject(LoadingController);
  private horarioSvc = inject(HorarioService);
  private util = inject(UtilidadesService);

  veterinarios: Veterinario[] = [];

  veterinariosFiltrados: Veterinario[] = [];

  veterinarioSeleccionado: Veterinario | null = null;

  terminoBusqueda = '';

  motivoReasignacion = '';

  disponibilidad: Map<string, boolean> = new Map();

  razonBloqueo: Map<string, 'horario' | 'cita'> = new Map();

  cargandoDisponibilidad = false;

  async ngOnInit() {
    collectionData(
      collection(this.firestore, 'veterinarios'),
      { idField: 'idVeterinario' }
    ).pipe(
      map((lista: any[]) =>
        lista.filter(v =>
          v.estado === 'activo' &&
          v.idVeterinario !== this.cita.idVeterinario &&
          // Solo especialistas que cubren el tipo de cita (corrección F4b).
          cubreTipoDeCita(normalizarEspecialidades(v), this.cita.tipo)
        )
      )
    ).subscribe(async vets => {
      this.veterinarios = vets;
      this.veterinariosFiltrados = vets;
      await this.verificarDisponibilidad(vets);
    });
  }

  private async verificarDisponibilidad(vets: Veterinario[]) {
    this.cargandoDisponibilidad = true;
    this.disponibilidad.clear();
    this.razonBloqueo.clear();

    const date = new Date(this.cita.fecha + 'T12:00:00');
    const diaNom = DOW_MAP[date.getDay()];
    const estadosOcupados: Cita['estado'][] = ['pendiente', 'en_proceso'];

    await Promise.all(
      vets.map(async vet => {
        const horarios = await this.horarioSvc.getHorariosOnce(vet.idVeterinario);
        const horarioDia = horarios.find(h => h.dia === diaNom);

        if (!horarioDia || !horarioDia.activo || horarioDia.turnos.length === 0) {
          this.disponibilidad.set(vet.idVeterinario, false);
          this.razonBloqueo.set(vet.idVeterinario, 'horario');
          return;
        }

        const slots = new Set(this.horarioSvc.getSlotsFromTurnos(horarioDia.turnos));
        const citaInicioM = this.util.toMinutos(this.cita.horaInicio);
        const citaFinM = this.util.toMinutos(this.cita.horaFin);
        let cur = citaInicioM;
        let dentroHorario = true;

        while (cur < citaFinM) {
          const s = `${String(Math.floor(cur / 60)).padStart(2, '0')}:${String(cur % 60).padStart(2, '00')}`;
          if (!slots.has(s)) { dentroHorario = false; break; }
          cur += 30;
        }

        if (!dentroHorario) {
          this.disponibilidad.set(vet.idVeterinario, false);
          this.razonBloqueo.set(vet.idVeterinario, 'horario');
          return;
        }

        const q = query(
          collection(this.firestore, 'citas'),
          where('idVeterinario', '==', vet.idVeterinario),
          where('fecha', '==', this.cita.fecha),
        );

        const snap = await getDocs(q);
        const citasDelDia = snap.docs
          .map(d => ({ idCita: d.id, ...d.data() } as Cita))
          .filter(c =>
            estadosOcupados.includes(c.estado) &&
            c.idCita !== this.cita.idCita
          );

        const haySolapamiento = citasDelDia.some(c =>
          this.cita.horaInicio < c.horaFin &&
          this.cita.horaFin > c.horaInicio
        );

        if (haySolapamiento) {
          this.disponibilidad.set(vet.idVeterinario, false);
          this.razonBloqueo.set(vet.idVeterinario, 'cita');
        } else {
          this.disponibilidad.set(vet.idVeterinario, true);
        }
      })
    );

    this.cargandoDisponibilidad = false;
  }

  estaDisponible(vet: Veterinario): boolean {
    return this.disponibilidad.get(vet.idVeterinario) ?? true;
  }

  getMotivoBloqueo(vet: Veterinario): string {
    const razon = this.razonBloqueo.get(vet.idVeterinario);
    if (razon === 'horario') return 'Fuera de su horario · ' + this.cita.horaInicio + ' – ' + this.cita.horaFin;
    if (razon === 'cita') return 'Ocupado · ' + this.cita.horaInicio + ' – ' + this.cita.horaFin;
    return '';
  }

  filtrar(evento: Event) {
    const q = (evento.target as HTMLInputElement).value.toLowerCase();
    this.terminoBusqueda = q;
    this.veterinariosFiltrados = this.veterinarios.filter(v =>
      `${v.Nombre} ${v.Apellido}`.toLowerCase().includes(q) ||
      normalizarEspecialidades(v).join(' ').toLowerCase().includes(q)
    );
  }

  seleccionar(vet: Veterinario) {
    if (!this.estaDisponible(vet)) return;
    this.veterinarioSeleccionado =
      this.veterinarioSeleccionado?.idVeterinario === vet.idVeterinario ? null : vet;
  }

  iniciales(vet: Veterinario): string {
    return `${vet.Nombre[0]}${vet.Apellido[0]}`.toUpperCase();
  }

  async reasignar() {
    if (!this.veterinarioSeleccionado) return;

    const sigue = await this.verificarVetDisponibleAhora(this.veterinarioSeleccionado);
    if (!sigue) {
      await this.util.showToast(
        `${this.veterinarioSeleccionado.Nombre} ya no está disponible en ese horario`,
        'warning'
      );
      await this.verificarDisponibilidad(this.veterinarios);
      this.veterinarioSeleccionado = null;
      return;
    }

    const loading = await this.loadingCtrl.create({ message: 'Reasignando veterinario...' });
    await loading.present();

    try {
      const notaReasignacion =
        `[Reasignación ${new Date().toLocaleDateString('es-CO')}] ` +
        `Sustituto de: ${this.nombreVeterinarioActual}. ` +
        (this.motivoReasignacion ? `Motivo: ${this.motivoReasignacion}. ` : '') +
        `Nuevo: ${this.veterinarioSeleccionado.Nombre} ${this.veterinarioSeleccionado.Apellido}.`;

      const notasActualizadas = this.cita.notas
        ? `${this.cita.notas}\n${notaReasignacion}`
        : notaReasignacion;

      await this.citaSvc.actualizarCita(this.cita.idCita, {
        idVeterinario: this.veterinarioSeleccionado.idVeterinario,
        nombreVeterinario: `${this.veterinarioSeleccionado.Nombre} ${this.veterinarioSeleccionado.Apellido}`,
        notas: notasActualizadas,
      } as any);

      await loading.dismiss();
      await this.util.showToast('Veterinario reasignado correctamente', 'success');
      await this.modalCtrl.dismiss({ reasignado: true });

    } catch (error) {
      await loading.dismiss();
      await this.util.showToast('Error al reasignar el veterinario', 'danger');
      console.error(error);
    }
  }

  private async verificarVetDisponibleAhora(vet: Veterinario): Promise<boolean> {
    const date = new Date(this.cita.fecha + 'T12:00:00');
    const diaNom = DOW_MAP[date.getDay()];

    const horarios = await this.horarioSvc.getHorariosOnce(vet.idVeterinario);
    const horarioDia = horarios.find(h => h.dia === diaNom);
    if (!horarioDia || !horarioDia.activo || horarioDia.turnos.length === 0) return false;

    const slots = new Set(this.horarioSvc.getSlotsFromTurnos(horarioDia.turnos));
    const citaInicioM = this.util.toMinutos(this.cita.horaInicio);
    const citaFinM = this.util.toMinutos(this.cita.horaFin);
    let cur = citaInicioM;

    while (cur < citaFinM) {
      const s = `${String(Math.floor(cur / 60)).padStart(2, '0')}:${String(cur % 60).padStart(2, '00')}`;
      if (!slots.has(s)) return false;
      cur += 30;
    }

    const q = query(
      collection(this.firestore, 'citas'),
      where('idVeterinario', '==', vet.idVeterinario),
      where('fecha', '==', this.cita.fecha),
    );
    const snap = await getDocs(q);

    return !snap.docs
      .map(d => ({ idCita: d.id, ...d.data() } as Cita))
      .filter(c =>
        ['pendiente', 'en_proceso'].includes(c.estado) &&
        c.idCita !== this.cita.idCita
      )
      .some(c =>
        this.cita.horaInicio < c.horaFin &&
        this.cita.horaFin > c.horaInicio
      );
  }

  cerrar() {
    this.modalCtrl.dismiss({ reasignado: false });
  }
}
