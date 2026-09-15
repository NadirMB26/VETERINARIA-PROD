/**
 * @description
 * Agenda operativa por rol: citas del veterinario, citas de estética del
 * groomer, alertas de escalados sin asignar y cierre de citas vencidas.
 *
 * Los rangos (hoy / semana / todas) se filtran en el cliente para evitar
 * índices compuestos en Firestore.
 */
import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from '@angular/fire/firestore';
import { Observable, map } from 'rxjs';
import { Cita } from '../models/cita.model';
import { CitasEsteticaService } from './citas-estetica.service';
import { CitaVentaService } from './cita-venta.service';

export interface ProfesionalAsignable {
  idVeterinario: string;
  nombre: string;
}

@Injectable({ providedIn: 'root' })
export class AgendaService {

  private firestore = inject(Firestore);
  private esteticaSvc = inject(CitasEsteticaService);
  private citaVentaSvc = inject(CitaVentaService);

  private citasRef = collection(this.firestore, 'citas');

  /** @description Citas médicas asignadas a un veterinario (sin estética). */
  getCitasVeterinario(idVeterinario: string): Observable<Cita[]> {
    const q = query(this.citasRef, where('idVeterinario', '==', idVeterinario));
    return (collectionData(q, { idField: 'idCita' }) as Observable<Cita[]>).pipe(
      map(lista => [...lista].sort((a, b) =>
        b.fecha.localeCompare(a.fecha) || b.horaInicio.localeCompare(a.horaInicio)
      ))
    );
  }

  /** @description Citas de estética asignadas a un groomer. */
  getCitasGroomer(idGroomer: string): Observable<Cita[]> {
    return this.esteticaSvc.getPorGroomer(idGroomer);
  }

  /** @description Citas escaladas por groomers que aún no tienen veterinario. */
  getEscaladasPendientes(): Observable<Cita[]> {
    const q = query(this.citasRef, where('idVeterinario', '==', ''));
    return (collectionData(q, { idField: 'idCita' }) as Observable<Cita[]>).pipe(
      map(lista => lista
        .filter(c => c.estado === 'pendiente' && !!c.escaladoDesde)
        .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.horaInicio.localeCompare(b.horaInicio))
      )
    );
  }

  /** @description Asigna un veterinario a una cita escalada. */
  async asignarVeterinario(cita: Cita, vet: ProfesionalAsignable): Promise<void> {
    await updateDoc(doc(this.firestore, 'citas', cita.idCita), {
      idVeterinario: vet.idVeterinario,
      nombreVeterinario: vet.nombre,
    });
  }

  /**
   * @description Marca como no asistidas las citas de estética vencidas del
   * groomer y anula sus cuentas por cobrar. Se ejecuta al abrir su agenda
   * (el cierre general de `CitaService` no corre para el rol groomer).
   */
  async revisarVencidasGroomer(idGroomer: string): Promise<void> {
    const ahora = new Date();
    const fechaHoy = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
    const horaAhora = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;

    const q = query(
      this.citasRef,
      where('categoria', '==', 'ESTETICA'),
      where('idGroomer', '==', idGroomer)
    );
    const snap = await getDocs(q);

    const vencidas = snap.docs
      .map(d => ({ idCita: d.id, ...d.data() } as Cita))
      .filter(c =>
        c.estado === 'pendiente' &&
        (c.fecha < fechaHoy || (c.fecha === fechaHoy && c.horaFin <= horaAhora))
      );

    for (const c of vencidas) {
      try {
        await updateDoc(doc(this.firestore, 'citas', c.idCita), { estado: 'no_asistio' });
        await this.citaVentaSvc.anularVentaDeCita(c.idCita);
      } catch {
        // Si falla una cita (p. ej. permisos), se continúa con las demás.
      }
    }
  }
}
