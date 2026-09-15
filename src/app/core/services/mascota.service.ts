/**
 * @description
 * Servicio de gestión de mascotas.
 *
 * Opera sobre la subcolección `clientes/{idCliente}/mascotas` y permite
 * consultar el conjunto global mediante `collectionGroup`. Cubre alta, lectura
 * (reactiva y puntual), actualización y baja de mascotas.
 */
import { Injectable, inject } from '@angular/core';
import {
  Firestore, doc, setDoc, docData, getDoc,
  collection, collectionData,
  updateDoc, query, where,
} from '@angular/fire/firestore';
import { Storage, ref, uploadBytes, getDownloadURL, deleteObject } from '@angular/fire/storage';
import { Observable, combineLatest, of } from 'rxjs';
import { collectionGroup } from '@angular/fire/firestore';
import { map } from 'rxjs/operators';
import { Mascota } from '../models/mascota.model';

@Injectable({ providedIn: 'root' })
export class MascotaService {

  private firestore = inject(Firestore);
  private storage = inject(Storage);

  /**
   * @description Referencia al documento de una mascota concreta.
   * @private
   * @param idCliente - Identificador del cliente propietario.
   * @param idMascota - Identificador de la mascota.
   * @returns Referencia al documento en Firestore.
   */
  private mascotaRef(idCliente: string, idMascota: string) {
    return doc(this.firestore, `clientes/${idCliente}/mascotas/${idMascota}`);
  }

  /**
   * @description Referencia a la colección de mascotas de un cliente.
   * @private
   * @param idCliente - Identificador del cliente.
   * @returns Referencia a la colección en Firestore.
   */
  private mascotasColRef(idCliente: string) {
    return collection(this.firestore, `clientes/${idCliente}/mascotas`);
  }

  /**
   * @description Registra una mascota.
   * @param data - Datos de la mascota; `idMascota` es opcional.
   * @returns El identificador de la mascota registrada.
   */
  async registrarMascota(data: Omit<Mascota, 'idMascota'> & { idMascota?: string }): Promise<string> {
    const idMascota = data.idMascota ?? this.generarIdMascota();
    const mascota: Mascota = {
      ...data,
      idMascota,
      estado: data.estado ?? 'activo',
      fechaRegistro: data.fechaRegistro ?? new Date().toISOString(),
    };
    await setDoc(this.mascotaRef(data.idCliente, idMascota), mascota);
    return idMascota;
  }

  /**
   * @description Emite todas las mascotas de todos los clientes en tiempo real.
   * @returns Observable con el conjunto global de mascotas.
   */
  getTodas(): Observable<Mascota[]> {
    return collectionData(
      collectionGroup(this.firestore, 'mascotas'),
      { idField: 'idMascota' }
    ) as Observable<Mascota[]>;
  }

  /**
   * @description Genera un identificador único de Firestore para una nueva mascota.
   * @private
   * @returns Identificador único.
   */
  private generarIdMascota(): string {
    return doc(collection(this.firestore, 'mascotas')).id;
  }

  /**
   * @description Emite en tiempo real las mascotas de un cliente concreto.
   * @param idCliente - Identificador del cliente.
   * @returns Observable con las mascotas del cliente.
   */
  getMascotasPorCliente(idCliente: string): Observable<Mascota[]> {
    return collectionData(
      this.mascotasColRef(idCliente),
      { idField: 'idMascota' }
    ) as Observable<Mascota[]>;
  }

  /**
   * @description Emite en tiempo real una mascota concreta.
   * @param idCliente - Identificador del cliente propietario.
   * @param idMascota - Identificador de la mascota.
   * @returns Observable con la mascota.
   */
  getMascota(idCliente: string, idMascota: string): Observable<Mascota> {
    return docData(
      this.mascotaRef(idCliente, idMascota),
      { idField: 'idMascota' }
    ) as Observable<Mascota>;
  }

  /**
   * @description Lee una sola vez (no reactivo) una mascota concreta.
   * @param idCliente - Identificador del cliente propietario.
   * @param idMascota - Identificador de la mascota.
   * @returns La mascota, o `null` si no existe.
   */
  async getMascotaOnce(idCliente: string, idMascota: string): Promise<Mascota | null> {
    const snap = await getDoc(this.mascotaRef(idCliente, idMascota));
    return snap.exists() ? ({ idMascota: snap.id, ...snap.data() } as Mascota) : null;
  }

  /**
   * @description Combina en tiempo real las mascotas de varios clientes.
   * @param idsClientes - Lista de identificadores de cliente.
   * @returns Observable con todas las mascotas de esos clientes.
   */
  getMascotasPorClientes(idsClientes: string[]): Observable<Mascota[]> {
    if (!idsClientes.length) return of([]);
    const observables = idsClientes.map(id =>
      collectionData(this.mascotasColRef(id), { idField: 'idMascota' }) as Observable<Mascota[]>
    );
    return combineLatest(observables).pipe(
      map(arrays => arrays.reduce((acc, curr) => acc.concat(curr), [] as Mascota[]))
    );
  }

  /**
   * @description Aplica una actualización parcial a una mascota.
   * @param idCliente - Identificador del cliente propietario.
   * @param idMascota - Identificador de la mascota.
   * @param cambios - Campos a modificar.
   */
  actualizarMascota(idCliente: string, idMascota: string, cambios: Partial<Mascota>): Promise<void> {
    return updateDoc(this.mascotaRef(idCliente, idMascota), cambios as any);
  }

  /**
   * @description Actualiza el peso de una mascota y registra la marca de tiempo del cambio.
   * @param idCliente - Identificador del cliente propietario.
   * @param idMascota - Identificador de la mascota.
   * @param nuevoPeso - Nuevo peso en kilogramos.
   */
  actualizarPeso(idCliente: string, idMascota: string, nuevoPeso: number): Promise<void> {
    return updateDoc(this.mascotaRef(idCliente, idMascota), {
      peso: nuevoPeso,
      ultimaActualizacionPeso: new Date().toISOString(),
    });
  }

  /**
   * @description Cambia el estado de actividad de una mascota.
   * @param idCliente - Identificador del cliente propietario.
   * @param idMascota - Identificador de la mascota.
   * @param estado - Nuevo estado.
   */
  cambiarEstado(idCliente: string, idMascota: string, estado: 'activo' | 'inactivo'): Promise<void> {
    return updateDoc(this.mascotaRef(idCliente, idMascota), { estado });
  }

  /**
   * @description Elimina permanentemente una mascota de Firestore.
   * @param idCliente - Identificador del cliente propietario.
   * @param idMascota - Identificador de la mascota.
   */
  async eliminarMascota(idCliente: string, idMascota: string): Promise<void> {
    const { deleteDoc } = await import('@angular/fire/firestore');
    await deleteDoc(this.mascotaRef(idCliente, idMascota));
  }

  /**
   * @description Devuelve el catálogo de razas disponibles para una especie.
   * @param especie - Especie a consultar.
   * @returns Lista de razas, o `['Otro']` si la especie no está catalogada.
   */
  async getRazasPorEspecie(especie: string): Promise<string[]> {
    const razas: Record<string, string[]> = {
      perro: ['Labrador', 'Golden Retriever', 'Bulldog', 'Pastor Alemán', 'Poodle', 'Otro'],
      gato: ['Siamés', 'Persa', 'Maine Coon', 'Bengalí', 'Ragdoll', 'Otro'],
      ave: ['Canario', 'Periquito', 'Loro', 'Cacatúa', 'Agapornis', 'Otro'],
      reptil: ['Iguana', 'Gecko', 'Tortuga', 'Camaleón', 'Serpiente', 'Otro'],
      otro: ['Otro'],
    };
    return razas[especie?.toLowerCase()] ?? ['Otro'];
  }

  /**
   * @description Sube la foto de una mascota a Storage y devuelve su URL.
   * @param idCliente - Identificador del cliente propietario.
   * @param idMascota - Identificador de la mascota.
   * @param file - Archivo de imagen.
   * @returns URL pública de la imagen.
   */
  async subirImagen(idCliente: string, idMascota: string, file: File): Promise<string> {
    const imgRef = ref(this.storage, `mascotas/${idCliente}/${idMascota}`);
    await uploadBytes(imgRef, file);
    return getDownloadURL(imgRef);
  }

  /**
   * @description Elimina la foto de una mascota de Storage (si existe).
   * @param idCliente - Identificador del cliente propietario.
   * @param idMascota - Identificador de la mascota.
   */
  async eliminarImagen(idCliente: string, idMascota: string): Promise<void> {
    try {
      await deleteObject(ref(this.storage, `mascotas/${idCliente}/${idMascota}`));
    } catch {
      // si no existe, no falla el flujo
    }
  }
}