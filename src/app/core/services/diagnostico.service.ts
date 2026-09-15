/**
 * @description
 * Diagnóstico clínico asociado a una cita.
 *
 * Se guarda como documento único `diagnostico` dentro de la subcolección
 * `citas/{idCita}/diagnosticos`, por lo que existe a lo sumo uno por cita.
 */
export interface Diagnostico {
  /** Identificador de la cita a la que pertenece el diagnóstico. */
  idCita: string;
  /** Identificador del veterinario que lo emite. */
  idVeterinario: string;
  /** Nombre del veterinario (denormalizado). */
  nombreVeterinario: string;
  /** Identificador de la mascota diagnosticada. */
  idMascota: string;
  /** Nombre de la mascota (denormalizado). */
  nombreMascota: string;
  /** Identificador del cliente propietario. */
  idCliente: string;
  /** Síntomas observados. */
  sintomas: string;
  /** Diagnóstico clínico. */
  diagnostico: string;
  /** Tratamiento indicado. */
  tratamiento: string;
  /** Medicamentos recetados. */
  medicamentos: string;
  /** Observaciones adicionales. */
  observaciones: string;
  /** Marca de tiempo ISO de creación del diagnóstico. */
  fechaDiagnostico: string;
  /** Marca de tiempo ISO de la última actualización. */
  fechaActualizacion: string;
}

/**
 * @description
 * Servicio de gestión de diagnósticos clínicos.
 *
 * Cada cita tiene como máximo un diagnóstico, almacenado con ID fijo
 * `diagnostico` en la subcolección `citas/{idCita}/diagnosticos`.
 *
 * @example
 * ```typescript
 * // Guardar un diagnóstico
 * await this.diagnosticoSvc.guardar(diagnostico);
 *
 * // Obtener diagnóstico en tiempo real
 * this.diagnosticoSvc.getByIdCita(idCita).subscribe(diag => {
 *   console.log(diag);
 * });
 * ```
 */
import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  doc,
  setDoc,
  docData,
  getDoc,
  updateDoc,
} from '@angular/fire/firestore';
import { Observable, of } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class DiagnosticoService {

  private firestore = inject(Firestore);

  /**
   * @description Referencia al documento único de diagnóstico de una cita.
   * @private
   * @param idCita - Identificador de la cita.
   * @returns Referencia al documento en Firestore.
   */
  private ref(idCita: string) {
    return doc(this.firestore, `citas/${idCita}/diagnosticos/diagnostico`);
  }

  /**
   * @description Crea o sobreescribe el diagnóstico de una cita.
   * @param diagnostico - Datos completos del diagnóstico.
   */
  async guardar(diagnostico: Diagnostico): Promise<void> {
    await setDoc(this.ref(diagnostico.idCita), {
      ...diagnostico,
      fechaActualizacion: new Date().toISOString(),
    });
  }

  /**
   * @description Emite en tiempo real el diagnóstico de una cita.
   * @param idCita - Identificador de la cita.
   * @returns Observable con el diagnóstico, o `undefined` si aún no existe.
   */
  getByIdCita(idCita: string): Observable<Diagnostico | undefined> {
    return docData(this.ref(idCita)) as Observable<Diagnostico | undefined>;
  }

  /**
   * @description Lee una sola vez el diagnóstico de una cita.
   * @param idCita - Identificador de la cita.
   * @returns El diagnóstico, o `null` si no existe.
   */
  async getOnce(idCita: string): Promise<Diagnostico | null> {
    const snap = await getDoc(this.ref(idCita));
    return snap.exists() ? (snap.data() as Diagnostico) : null;
  }

  /**
   * @description Aplica una actualización parcial al diagnóstico.
   * @param idCita - Identificador de la cita.
   * @param cambios - Campos a modificar.
   */
  async actualizar(idCita: string, cambios: Partial<Diagnostico>): Promise<void> {
    await updateDoc(this.ref(idCita), {
      ...cambios,
      fechaActualizacion: new Date().toISOString(),
    });
  }
}