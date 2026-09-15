/**
 * @description
 * Servicio de citas de estética y groomer (Fase 2).
 *
 * Las citas `ESTETICA` son operativas (no clínicas): no generan
 * RegistroClínico. El groomer atiende, escribe notas del servicio y, si
 * detecta algo médico, escala creando una cita médica nueva vinculada.
 */
import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  writeBatch,
  onSnapshot,
  query,
  where,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Cita } from '../models/cita.model';
import { limpiarUndefined } from '../utils/firestore.util';

export const TIPOS_SERVICIO_ESTETICA: { value: Cita['tipoServicio']; label: string }[] = [
  { value: 'bano', label: 'Baño' },
  { value: 'corte', label: 'Corte' },
  { value: 'corte_y_bano', label: 'Corte y baño' },
  { value: 'deslanado', label: 'Deslanado' },
  { value: 'otro', label: 'Otro' },
];

export function labelTipoServicio(tipo: string): string {
  return TIPOS_SERVICIO_ESTETICA.find(t => t.value === tipo)?.label ?? tipo ?? '—';
}

@Injectable({ providedIn: 'root' })
export class CitasEsteticaService {

  private firestore = inject(Firestore);

  private citasCol() {
    return collection(this.firestore, 'citas');
  }

  /**
   * @description Emite en tiempo real las citas de estética asignadas a un
   * groomer (pendientes, en proceso y ya atendidas).
   */
  getPorGroomer(idGroomer: string): Observable<Cita[]> {
    return new Observable(observer => {
      const q = query(
        this.citasCol(),
        where('categoria', '==', 'ESTETICA'),
        where('idGroomer', '==', idGroomer)
      );
      const unsub = onSnapshot(q, snap => {
        const citas = snap.docs.map(d => ({ idCita: d.id, ...d.data() } as Cita));
        citas.sort((a, b) => b.fecha.localeCompare(a.fecha) || b.horaInicio.localeCompare(a.horaInicio));
        observer.next(citas);
      });
      return () => unsub();
    });
  }

  /**
   * @description Marca el inicio del servicio (pendiente → en proceso).
   */
  async iniciarServicio(idCita: string): Promise<void> {
    await updateDoc(doc(this.firestore, `citas/${idCita}`), {
      estado: 'en_proceso',
      fechaInicioServicio: new Date().toISOString(),
    });
  }

  /**
   * @description Guarda las notas del servicio, el checklist marcado y los
   * hallazgos no clínicos; finaliza la cita de estética. No genera ningún
   * RegistroClínico.
   */
  async guardarServicio(
    idCita: string,
    notasServicio: string,
    checklistServicio: string[] = [],
    hallazgosGroomer?: Cita['hallazgosGroomer'],
  ): Promise<void> {
    await updateDoc(doc(this.firestore, `citas/${idCita}`), limpiarUndefined({
      notasServicio: notasServicio.trim(),
      checklistServicio,
      hallazgosGroomer,
      estado: 'finalizada',
      fechaFinServicio: new Date().toISOString(),
    }));
  }

  /**
   * @description Escala la cita de estética a veterinario: crea una cita
   * médica nueva (DIAGNOSTICO o EMERGENCIA) con las notas y hallazgos del
   * groomer como observación inicial, y marca la cita de estética como
   * escalada y finalizada.
   *
   * @returns El id de la cita médica creada.
   */
  async escalarAVeterinario(
    cita: Cita,
    notasServicio: string,
    urgente: boolean,
    opciones?: { checklist?: string[]; hallazgos?: Cita['hallazgosGroomer'] },
  ): Promise<string> {
    const [fecha, horaInicio, horaFin] = this.proximoSlot();

    const partes: string[] = [];
    if (notasServicio.trim()) partes.push(notasServicio.trim());
    if (opciones?.hallazgos) {
      const h = opciones.hallazgos;
      const detalles = [
        h.piel ? `Piel: ${h.piel}` : '',
        h.parasitos ? 'Parásitos: sí' : '',
        h.nudos ? 'Nudos: sí' : '',
        h.comportamiento ? `Comportamiento: ${h.comportamiento}` : '',
        h.nota ? `Nota: ${h.nota}` : '',
      ].filter(Boolean).join('; ');
      if (detalles) partes.push(detalles);
    }

    const notas = partes.length
      ? `Detectado durante servicio de estética: ${partes.join(' · ')}`
      : 'Detectado durante servicio de estética: sin notas adicionales.';

    const nuevaRef = doc(collection(this.firestore, 'citas'));
    const batch = writeBatch(this.firestore);

    batch.set(nuevaRef, limpiarUndefined({
      idMascota: cita.idMascota,
      nombreMascota: cita.nombreMascota,
      idCliente: cita.idCliente,
      nombreCliente: cita.nombreCliente,
      idVeterinario: '',
      nombreVeterinario: '',
      idRecepcionista: cita.idRecepcionista ?? '',
      nombreRecepcionista: cita.nombreRecepcionista ?? '',
      fecha,
      horaInicio,
      horaFin,
      tipo: urgente ? 'Urgencia' : 'Consulta general',
      categoria: urgente ? 'EMERGENCIA' : 'DIAGNOSTICO',
      estado: 'pendiente',
      notas,
      fechaRegistro: new Date().toISOString(),
      // Marca la cita como escalada desde estética (regla de create del groomer).
      escaladoDesde: cita.idCita,
    }));

    batch.update(doc(this.firestore, `citas/${cita.idCita}`), limpiarUndefined({
      notasServicio: notasServicio.trim(),
      checklistServicio: opciones?.checklist ?? cita.checklistServicio ?? [],
      hallazgosGroomer: opciones?.hallazgos,
      escaladoAVeterinario: true,
      idCitaEscalada: nuevaRef.id,
      estado: 'finalizada',
      fechaFinServicio: new Date().toISOString(),
    }));

    await batch.commit();
    return nuevaRef.id;
  }

  /**
   * @description Próximo bloque libre de media hora dentro del horario hábil
   * (08:00–18:00). Fuera de ese rango agenda para mañana a las 08:00.
   * @private
   */
  private proximoSlot(): [string, string, string] {
    const ahora = new Date();
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const minutos = ahora.getHours() * 60 + ahora.getMinutes();
    const proxima = Math.ceil(minutos / 30) * 30;
    const inicioTotal = Math.max(proxima, 8 * 60);
    const fechaBase = inicioTotal <= 18 * 60 - 30 ? ahora : new Date(ahora.getTime() + 24 * 3600 * 1000);
    const minBase = inicioTotal <= 18 * 60 - 30 ? inicioTotal : 8 * 60;
    const hh = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    return [fmt(fechaBase), hh(minBase), hh(minBase + 30)];
  }
}
