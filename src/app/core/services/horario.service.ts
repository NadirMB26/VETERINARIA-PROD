export type DiaSemana =
  | 'lunes' | 'martes' | 'miercoles' | 'jueves'
  | 'viernes' | 'sabado' | 'domingo';

export interface Turno {
  inicio: string;
  fin: string;
}

export interface HorarioDia {
  dia: DiaSemana;
  activo: boolean;
  turnos: Turno[];
}

export const TURNOS_PRESET: Record<string, Turno> = {
  manana: { inicio: '08:00', fin: '12:00' },
  tarde: { inicio: '13:00', fin: '18:00' },
};

export const DIAS_SEMANA: DiaSemana[] = [
  'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'
];

export const DOW_MAP: Record<number, DiaSemana> = {
  0: 'domingo', 1: 'lunes', 2: 'martes', 3: 'miercoles',
  4: 'jueves', 5: 'viernes', 6: 'sabado',
};

import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
} from '@angular/fire/firestore';
import { Observable, of } from 'rxjs';
import { UtilidadesService } from 'src/app/core/services/utilidades.service';

@Injectable({ providedIn: 'root' })
export class HorarioService {

  private firestore = inject(Firestore);
  private util = inject(UtilidadesService);

  private horarioRef(uid: string, dia: DiaSemana) {
    return doc(this.firestore, `veterinarios/${uid}/horarios/${dia}`);
  }

  private horariosColRef(uid: string) {
    return collection(this.firestore, `veterinarios/${uid}/horarios`);
  }

  getHorarios(uid: string): Observable<HorarioDia[]> {
    return collectionData(this.horariosColRef(uid), { idField: 'dia' }) as Observable<HorarioDia[]>;
  }

  async getHorariosOnce(uid: string): Promise<HorarioDia[]> {
    const snap = await getDocs(this.horariosColRef(uid));
    return snap.docs.map(d => ({ dia: d.id as DiaSemana, ...d.data() } as HorarioDia));
  }

  async guardarHorario(uid: string, horario: HorarioDia): Promise<void> {
    await setDoc(this.horarioRef(uid, horario.dia), {
      activo: horario.activo,
      turnos: horario.turnos,
    });
  }

  async guardarTodosLosHorarios(uid: string, horarios: HorarioDia[]): Promise<void> {
    await Promise.all(horarios.map(h => this.guardarHorario(uid, h)));
  }

  async eliminarHorario(uid: string, dia: DiaSemana): Promise<void> {
    await deleteDoc(this.horarioRef(uid, dia));
  }

  async getTurnosParaFecha(uid: string, fechaStr: string): Promise<Turno[]> {
    const date = new Date(fechaStr + 'T12:00:00');
    const dia = DOW_MAP[date.getDay()];
    const horarios = await this.getHorariosOnce(uid);
    const horarioDia = horarios.find(h => h.dia === dia);
    if (!horarioDia || !horarioDia.activo) return [];
    return horarioDia.turnos;
  }

  getSlotsFromTurnos(turnos: Turno[]): string[] {
    const slots: string[] = [];
    for (const turno of turnos) {
      const [sh, sm] = turno.inicio.split(':').map(Number);
      const [eh, em] = turno.fin.split(':').map(Number);
      let mins = sh * 60 + sm;
      const end = eh * 60 + em;
      while (mins < end) {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
        mins += 30;
      }
    }
    return slots;
  }

  horaEstaEnTurno(hora: string, turnos: Turno[]): boolean {
    const mins = this.util.toMinutos(hora);
    return turnos.some(t => {
      const ini = this.util.toMinutos(t.inicio);
      const fin = this.util.toMinutos(t.fin);
      return mins >= ini && mins < fin;
    });
  }

  horarioVacio(dia: DiaSemana): HorarioDia {
    return { dia, activo: false, turnos: [] };
  }
}
