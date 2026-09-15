import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  CollectionReference,
  query,
  where,
  getDocs,
  getDoc,
} from '@angular/fire/firestore';
import { Observable, take, Subject, interval } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Cita } from '../models/cita.model';
import { CitaVentaService } from './cita-venta.service';

@Injectable({ providedIn: 'root' })
export class CitaService {

  private col = 'citas';
  private citasRef: CollectionReference;
  private actualizando = false;
  private destroy$ = new Subject<void>();

  constructor(
    private firestore: Firestore,
    private citaVentaSvc: CitaVentaService,
  ) {
    this.citasRef = collection(this.firestore, this.col);
    interval(5 * 60 * 1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.revisarVencidas());
  }

  destroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getTodas(): Observable<Cita[]> {
    return new Observable(observer => {
      const unsub = onSnapshot(this.citasRef, snapshot => {
        const citas = snapshot.docs.map(d => ({
          idCita: d.id,
          ...d.data()
        } as Cita));
        observer.next(citas);
      });
      return () => unsub();
    });
  }

  getPorVeterinario(idVeterinario: string): Observable<Cita[]> {
    return new Observable(observer => {
      const q = query(
        collection(this.firestore, this.col),
        where('idVeterinario', '==', idVeterinario)
      );
      const unsub = onSnapshot(q, snapshot => {
        const citas = snapshot.docs.map(d => ({
          idCita: d.id,
          ...d.data()
        } as Cita));
        observer.next(citas);
      });
      return () => unsub();
    });
  }

  getPorCliente(idCliente: string): Observable<Cita[]> {
    return new Observable(observer => {
      const q = query(
        collection(this.firestore, this.col),
        where('idCliente', '==', idCliente)
      );
      const unsub = onSnapshot(q, snapshot => {
        const citas = snapshot.docs.map(d => ({ idCita: d.id, ...d.data() } as Cita));
        observer.next(citas);
      });
      return () => unsub();
    });
  }

  getCitasPorMascota(idMascota: string): Observable<Cita[]> {
    return new Observable(observer => {
      const q = query(
        collection(this.firestore, this.col),
        where('idMascota', '==', idMascota)
      );
      const unsub = onSnapshot(q, snapshot => {
        const citas = snapshot.docs.map(d => ({ idCita: d.id, ...d.data() } as Cita));
        observer.next(citas);
      });
      return () => unsub();
    });
  }

  async getCitaOnce(idCita: string): Promise<Cita | null> {
    const snap = await getDoc(doc(this.firestore, this.col, idCita));
    return snap.exists() ? ({ idCita: snap.id, ...snap.data() } as Cita) : null;
  }

  async crearCita(cita: Omit<Cita, 'idCita'>): Promise<string> {
    const esEstetica = cita.categoria === 'ESTETICA';
    const campoAsignado = esEstetica ? 'idGroomer' : 'idVeterinario';
    const idAsignado = esEstetica ? cita.idGroomer ?? '' : cita.idVeterinario;

    if (idAsignado &&
        await this.existeSolape(cita.fecha, cita.horaInicio, cita.horaFin, idAsignado, '', campoAsignado)) {
      throw new Error(esEstetica
        ? 'El groomer ya tiene una cita en ese horario'
        : 'El veterinario ya tiene una cita en ese horario');
    }

    const ref = await addDoc(
      collection(this.firestore, this.col),
      { ...cita, fechaRegistro: new Date().toISOString() }
    );
    return ref.id;
  }

  async actualizarCita(idCita: string, cambios: Partial<Cita>): Promise<void> {
    const esEstetica = cambios.categoria === 'ESTETICA';
    const campoAsignado = esEstetica ? 'idGroomer' : 'idVeterinario';
    const idAsignado = esEstetica ? (cambios.idGroomer ?? '') : (cambios.idVeterinario ?? '');

    if (cambios.fecha && cambios.horaInicio && cambios.horaFin && idAsignado) {
      if (await this.existeSolape(cambios.fecha, cambios.horaInicio, cambios.horaFin, idAsignado, idCita, campoAsignado)) {
        throw new Error(esEstetica
          ? 'El groomer ya tiene una cita en ese horario'
          : 'El veterinario ya tiene una cita en ese horario');
      }
    }
    await updateDoc(doc(this.firestore, this.col, idCita), cambios);
  }

  async cambiarEstado(idCita: string, estado: Cita['estado']): Promise<void> {
    await updateDoc(doc(this.firestore, this.col, idCita), { estado });
    // Cancelación o inasistencia: la cuenta por cobrar de la cita se anula.
    if (estado === 'cancelada' || estado === 'no_asistio') {
      await this.citaVentaSvc.anularVentaDeCita(idCita);
    }
  }

  async eliminarCita(idCita: string): Promise<void> {
    await deleteDoc(doc(this.firestore, this.col, idCita));
  }

  /**
   * @description Verifica si existe una cita activa que se solape con el rango dado.
   * @private
   */
  private async existeSolape(
    fecha: string,
    horaInicio: string,
    horaFin: string,
    idAsignado: string,
    idCitaExcluida = '',
    campo: 'idVeterinario' | 'idGroomer' = 'idVeterinario'
  ): Promise<boolean> {
    const q = query(
      this.citasRef,
      where(campo, '==', idAsignado),
      where('fecha', '==', fecha)
    );
    const snap = await getDocs(q);

    const ini = this.toMinutos(horaInicio);
    const fin = this.toMinutos(horaFin);

    return snap.docs.some(d => {
      if (d.id === idCitaExcluida) return false;
      const c = d.data() as Cita;
      if (c.estado === 'cancelada' || c.estado === 'no_asistio') return false;
      const cIni = this.toMinutos(c.horaInicio);
      const cFin = this.toMinutos(c.horaFin);
      return ini < cFin && fin > cIni;
    });
  }

  private toMinutos(hora: string): number {
    const [h, m] = hora.split(':').map(Number);
    return h * 60 + m;
  }

  async revisarVencidas(): Promise<void> {
    const rol = localStorage.getItem('rol');
    if (rol && !['administrador', 'recepcionista', 'veterinario'].includes(rol)) return;
    if (this.actualizando) return;
    this.actualizando = true;

    try {
      const ahora = new Date();
      const fechaHoy = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
      const horaAhora = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;

      const q = query(this.citasRef, where('fecha', '<=', fechaHoy));
      const snap = await getDocs(q);

      const vencidas = snap.docs
        .map(d => ({ idCita: d.id, ...d.data() } as Cita))
        .filter(c =>
          c.estado === 'pendiente' &&
          (c.fecha < fechaHoy || (c.fecha === fechaHoy && c.horaFin <= horaAhora))
        );

      for (const c of vencidas) {
        await this.cambiarEstado(c.idCita, 'no_asistio');
      }
    } finally {
      this.actualizando = false;
    }
  }
}
