import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, doc, setDoc, updateDoc, deleteDoc, getDocs, query, orderBy, limit } from '@angular/fire/firestore';
import { Storage, ref, uploadBytes, getDownloadURL, deleteObject } from '@angular/fire/storage';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { BannerSlide } from '../models/banner.model';

@Injectable({ providedIn: 'root' })
export class BannerService {

  private firestore = inject(Firestore);
  private storage = inject(Storage);
  private bannersRef = collection(this.firestore, 'banners');

  /** Emite en tiempo real los slides activos, ordenados por `orden`. */
  getActivos(): Observable<BannerSlide[]> {
    return collectionData(this.bannersRef, { idField: 'id' }).pipe(
      map(lista => (lista as BannerSlide[])
        .filter(b => b.activo)
        .sort((a, b) => a.orden - b.orden))
    );
  }

  getTodos(): Observable<BannerSlide[]> {
    return collectionData(this.bannersRef, { idField: 'id' }).pipe(
      map(lista => (lista as BannerSlide[]).sort((a, b) => a.orden - b.orden))
    );
  }

  async registrar(data: Omit<BannerSlide, 'id' | 'fechaRegistro' | 'orden'>): Promise<string> {
    const orden = await this.proximoOrden();
    const ref = doc(this.bannersRef);
    await setDoc(ref, {
      ...data,
      orden,
      fechaRegistro: new Date().toISOString(),
    });
    return ref.id;
  }

  actualizar(id: string, cambios: Partial<BannerSlide>): Promise<void> {
    return updateDoc(doc(this.bannersRef, id), cambios);
  }

  async eliminar(id: string, imagenUrl?: string): Promise<void> {
    await deleteDoc(doc(this.bannersRef, id));
    if (imagenUrl) {
      try {
        await deleteObject(ref(this.storage, `banners/${id}`));
      } catch {
        // si no existe, no falla el flujo
      }
    }
  }

  /** Elimina solo el archivo de imagen de un slide (sin borrar el documento). */
  async eliminarImagenSolo(id: string): Promise<void> {
    try {
      await deleteObject(ref(this.storage, `banners/${id}`));
    } catch {
      // si no existe, no falla el flujo
    }
  }

  /** Reordena: mueve el slide una posición (delta = -1 subir, +1 bajar). */
  async reordenar(id: string, lista: BannerSlide[], delta: number): Promise<void> {
    const idx = lista.findIndex(b => b.id === id);
    const destino = idx + delta;
    if (idx < 0 || destino < 0 || destino >= lista.length) return;

    const a = lista[idx];
    const b = lista[destino];
    await Promise.all([
      updateDoc(doc(this.bannersRef, a.id), { orden: b.orden }),
      updateDoc(doc(this.bannersRef, b.id), { orden: a.orden }),
    ]);
  }

  async subirImagen(file: File, id: string): Promise<string> {
    const imgRef = ref(this.storage, `banners/${id}`);
    await uploadBytes(imgRef, file);
    return getDownloadURL(imgRef);
  }

  private async proximoOrden(): Promise<number> {
    const q = query(this.bannersRef, orderBy('orden', 'desc'), limit(1));
    const snap = await getDocs(q);
    return snap.empty ? 0 : ((snap.docs[0].data() as BannerSlide).orden ?? 0) + 1;
  }
}
