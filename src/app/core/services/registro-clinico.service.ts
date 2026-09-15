/**
 * @description
 * Servicio de gestión de registros clínicos (Fase 1).
 *
 * Opera sobre la colección top-level `registrosClinicos` y su subcolección
 * de auditoría `ediciones`. Provee lectura en tiempo real por mascota/cita,
 * creación por veterinario, corrección con motivo obligatorio (batch + edición
 * de auditoría) y traslado de historial ante cambio de propietario.
 */
import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  limit,
  onSnapshot,
  writeBatch,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import {
  RegistroClinico,
  EdicionRegistro,
  NuevoRegistroClinico,
} from '../models/registro-clinico.model';

@Injectable({ providedIn: 'root' })
export class RegistroClinicoService {

  private firestore = inject(Firestore);

  private regCol() {
    return collection(this.firestore, 'registrosClinicos');
  }

  private regRef(idRegistro: string) {
    return doc(this.firestore, `registrosClinicos/${idRegistro}`);
  }

  /**
   * @description Emite en tiempo real los registros clínicos de una mascota,
   * ordenados del más reciente al más antiguo.
   */
  getPorMascota(idMascota: string): Observable<RegistroClinico[]> {
    return new Observable(observer => {
      const q = query(this.regCol(), where('idMascota', '==', idMascota));
      const unsub = onSnapshot(q, snap => {
        const lista = snap.docs.map(d => ({ idRegistro: d.id, ...d.data() } as RegistroClinico));
        lista.sort((a, b) => (b.fechaRegistro ?? '').localeCompare(a.fechaRegistro ?? ''));
        observer.next(lista);
      });
      return () => unsub();
    });
  }

  /**
   * @description Emite en tiempo real los registros clínicos ligados a una cita
   * (a lo sumo uno; la cita es el origen 1:1 del registro).
   */
  getPorCita(idCita: string): Observable<RegistroClinico[]> {
    return new Observable(observer => {
      const q = query(this.regCol(), where('idCita', '==', idCita), limit(1));
      const unsub = onSnapshot(q, snap => {
        observer.next(snap.docs.map(d => ({ idRegistro: d.id, ...d.data() } as RegistroClinico)));
      });
      return () => unsub();
    });
  }

  /** Lee una sola vez el registro clínico de una cita, o `null`. */
  async getPorCitaOnce(idCita: string): Promise<RegistroClinico | null> {
    const q = query(this.regCol(), where('idCita', '==', idCita), limit(1));
    const snap = await getDocs(q);
    const d = snap.docs[0];
    return d ? ({ idRegistro: d.id, ...d.data() } as RegistroClinico) : null;
  }

  /** Lee una sola vez un registro clínico por su id. */
  async getRegistroOnce(idRegistro: string): Promise<RegistroClinico | null> {
    const snap = await getDoc(this.regRef(idRegistro));
    return snap.exists() ? ({ idRegistro: snap.id, ...snap.data() } as RegistroClinico) : null;
  }

  /**
   * @description Emite en tiempo real las ediciones (auditoría) de un registro,
   * ordenadas cronológicamente.
   */
  getEdiciones(idRegistro: string): Observable<EdicionRegistro[]> {
    return collectionData(
      collection(this.firestore, `registrosClinicos/${idRegistro}/ediciones`),
      { idField: 'idEdicion' }
    ) as Observable<EdicionRegistro[]>;
  }

  /** Lee una sola vez las ediciones de un registro. */
  async getEdicionesOnce(idRegistro: string): Promise<EdicionRegistro[]> {
    const snap = await getDocs(
      collection(this.firestore, `registrosClinicos/${idRegistro}/ediciones`)
    );
    return snap.docs.map(d => d.data() as EdicionRegistro)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  }

  /**
   * @description Crea un registro clínico nuevo (solo veterinario).
   * @param registro - Datos del registro (sin `idRegistro`).
   * @returns El id del documento creado.
   */
  async crear(registro: NuevoRegistroClinico): Promise<string> {
    const ahora = new Date().toISOString();
    const ref = await addDoc(this.regCol(), {
      ...registro,
      fechaRegistro: registro.fechaRegistro ?? ahora,
      fechaActualizacion: ahora,
    });
    return ref.id;
  }

  /**
   * @description Corrige un registro clínico existente. Exige un motivo; escribe
   * el registro actualizado y una entrada de auditoría por campo en un batch.
   * @param idRegistro - Id del registro a corregir.
   * @param cambios - Campos modificados (solo los que realmente cambian).
   * @param motivo - Motivo de la corrección (obligatorio).
   * @param autor - Autor de la corrección (id y nombre).
   */
  async corregir(
    idRegistro: string,
    cambios: Partial<RegistroClinico>,
    motivo: string,
    autor: { uid: string; nombre: string }
  ): Promise<void> {
    if (!motivo?.trim()) {
      throw new Error('El motivo de la corrección es obligatorio');
    }

    const actual = await this.getRegistroOnce(idRegistro);
    if (!actual) throw new Error('El registro clínico no existe');

    const ahora = new Date().toISOString();
    const batch = writeBatch(this.firestore);

    batch.update(this.regRef(idRegistro), {
      ...cambios,
      fechaActualizacion: ahora,
      motivoUltimaCorreccion: motivo.trim(),
    });

    const ediciones = collection(this.firestore, `registrosClinicos/${idRegistro}/ediciones`);
    for (const [campo, valor] of Object.entries(cambios)) {
      if (!(campo in actual)) continue;
      const antes = actual[campo as keyof RegistroClinico];
      if (String(antes ?? '') === String(valor ?? '')) continue;
      batch.set(doc(ediciones), {
        campo,
        antes: String(antes ?? ''),
        despues: String(valor ?? ''),
        motivo: motivo.trim(),
        autorId: autor.uid,
        autorNombre: autor.nombre,
        fecha: ahora,
      });
    }

    await batch.commit();
  }

  /**
   * @description Traslada el historial clínico y de citas de una mascota al
   * nuevo propietario (cambio de dueño). Actualiza `idCliente` en sus
   * registros clínicos, citas y diagnósticos legados.
   *
   * Las reglas de Firestore autorizan este cambio solo si únicamente cambia
   * `idCliente` (no se pueden alterar campos clínicos con este método).
   *
   * @param idMascota - Identificador de la mascota migrada.
   * @param nuevoIdCliente - Nuevo cliente propietario.
   */
  async trasladarHistorial(idMascota: string, nuevoIdCliente: string): Promise<void> {
    const actualizar = (ref: any) => updateDoc(ref, { idCliente: nuevoIdCliente });

    // 1) Registros clínicos de la mascota.
    const regSnap = await getDocs(query(this.regCol(), where('idMascota', '==', idMascota)));
    await Promise.all(regSnap.docs.map(d => actualizar(doc(this.firestore, `registrosClinicos/${d.id}`))));

    // 2) Citas de la mascota (+ diagnósticos legados anidados).
    const citasSnap = await getDocs(query(collection(this.firestore, 'citas'), where('idMascota', '==', idMascota)));
    await Promise.all(citasSnap.docs.map(async c => {
      await actualizar(doc(this.firestore, `citas/${c.id}`));
      const diagRef = doc(this.firestore, `citas/${c.id}/diagnosticos/diagnostico`);
      const diagSnap = await getDoc(diagRef);
      if (diagSnap.exists()) await actualizar(diagRef);
    }));
  }
}
