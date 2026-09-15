import { Component, Input, OnDestroy, OnInit, inject } from '@angular/core';
import {
  Firestore,
  collection,
  onSnapshot,
  query,
  where,
} from '@angular/fire/firestore';
import { Cita } from 'src/app/core/models/cita.model';
import { labelTipoServicio } from 'src/app/core/services/citas-estetica.service';

/**
 * @description Mini-histórico de servicios de estética previos de una mascota.
 * No expone ningún dato clínico: solo servicios de estética finalizados.
 */
@Component({
  selector: 'app-historico-estetica-mini',
  templateUrl: './historico-estetica-mini.component.html',
  styleUrls: ['./historico-estetica-mini.component.scss'],
  standalone: false,
})
export class HistoricoEsteticaMiniComponent implements OnInit, OnDestroy {

  @Input() idMascota = '';

  /** Cita actual: se excluye del historial. */
  @Input() idCitaActual = '';

  servicios: Cita[] = [];

  private firestore = inject(Firestore);
  private unsub?: () => void;

  ngOnInit() {
    if (!this.idMascota) return;

    const q = query(
      collection(this.firestore, 'citas'),
      where('idMascota', '==', this.idMascota),
      where('categoria', '==', 'ESTETICA')
    );

    this.unsub = onSnapshot(
      q,
      snap => {
        this.servicios = snap.docs
          .map(d => ({ idCita: d.id, ...d.data() } as Cita))
          .filter(c => c.estado === 'finalizada' && c.idCita !== this.idCitaActual)
          .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.horaInicio.localeCompare(a.horaInicio))
          .slice(0, 5);
      },
      () => { this.servicios = []; }
    );
  }

  ngOnDestroy() {
    this.unsub?.();
  }

  labelServicio(tipo?: string): string {
    return labelTipoServicio(tipo ?? '');
  }

  resumen(cita: Cita): string {
    const checklist = (cita.checklistServicio ?? []).join(', ');
    return checklist || cita.notasServicio || '';
  }
}
