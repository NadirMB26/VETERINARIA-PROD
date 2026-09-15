import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, doc, setDoc, updateDoc, query, where, getDocs, deleteField } from '@angular/fire/firestore';
import { Storage, ref, uploadBytes, getDownloadURL, deleteObject } from '@angular/fire/storage';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Producto, fechaIsoHoy } from '../models/producto.model';

@Injectable({ providedIn: 'root' })
export class ProductoService {

  private firestore = inject(Firestore);
  private storage = inject(Storage);
  private productosRef = collection(this.firestore, 'productos');

  getTodos(): Observable<Producto[]> {
    return collectionData(this.productosRef, { idField: 'idProducto' }).pipe(
      map((productos) => {
        this.desactivarOfertasVencidas(productos as Producto[]);
        return productos as Producto[];
      })
    );
  }

  /**
   * "Job" en el fetch: las ofertas cuya fechaFin ya pasó se desactivan solas
   * (se limpian los campos de oferta), sin depender solo del countdown del
   * frontend. Un cron real requeriría Cloud Functions (opcional futuro).
   */
  private desactivarOfertasVencidas(productos: Producto[]) {
    const hoy = fechaIsoHoy();
    const vencidas = productos.filter(p =>
      p.ofertaTipo && p.ofertaFin && p.ofertaFin < hoy
    );
    for (const p of vencidas) {
      const cambios: Record<string, unknown> = {
        ofertaTipo: deleteField(),
        ofertaFin: deleteField(),
        cupon: deleteField(),
      };
      // La promoción venció: se restaura el precio normal y se libera la referencia.
      if (typeof p.precioAnterior === 'number' && p.precioAnterior > 0) {
        cambios['precio'] = p.precioAnterior;
        cambios['precioAnterior'] = deleteField();
      } else {
        cambios['precioAnterior'] = deleteField();
      }
      void updateDoc(doc(this.productosRef, p.idProducto), cambios).catch(() => undefined);
    }
  }

  /**
   * Comprueba si un SKU ya está en uso por otro producto.
   * @param sku - Código a verificar.
   * @param exceptoId - Id del producto en edición (se excluye de la búsqueda).
   */
  async existeSku(sku: string, exceptoId?: string): Promise<boolean> {
    const q = query(this.productosRef, where('sku', '==', sku));
    const snap = await getDocs(q);
    return snap.docs.some(d => d.id !== exceptoId);
  }

  async registrarProducto(data: Omit<Producto, 'idProducto' | 'fechaRegistro'>): Promise<string> {
    const ref = doc(this.productosRef);
    await setDoc(ref, {
      ...sinUndefined(data),
      fechaRegistro: new Date().toISOString(),
    });
    return ref.id;
  }

  actualizarProducto(idProducto: string, cambios: Partial<Producto>): Promise<void> {
    return updateDoc(doc(this.productosRef, idProducto), sinUndefined(cambios) as any);
  }

  cambiarEstado(idProducto: string, estado: 'activo' | 'descontinuado'): Promise<void> {
    return updateDoc(doc(this.productosRef, idProducto), { estado });
  }

  private imagenRef(idProducto: string) {
    return ref(this.storage, `productos/${idProducto}`);
  }

  async subirImagen(file: File, idProducto: string): Promise<string> {
    await uploadBytes(this.imagenRef(idProducto), file);
    return getDownloadURL(this.imagenRef(idProducto));
  }

  async eliminarImagen(idProducto: string): Promise<void> {
    try {
      await deleteObject(this.imagenRef(idProducto));
    } catch {
      // si no existe, no falla el flujo
    }
  }
}

function sinUndefined<T extends object>(obj: T): Partial<T> {
  const limpio: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) limpio[k] = v;
  }
  return limpio as Partial<T>;
}
