import { Injectable, inject } from '@angular/core';
import { Firestore, doc, setDoc, getDoc, updateDoc } from '@angular/fire/firestore';
import { Privilegios, getPrivilegiosDefault } from '../models/privilegios.model';

@Injectable({ providedIn: 'root' })
export class PrivilegiosService {

  private firestore = inject(Firestore);

  crearPrivilegiosDefault(uid: string, rol: string): Promise<void> {
    const privilegios = getPrivilegiosDefault(rol, uid);
    return setDoc(doc(this.firestore, 'privilegios', uid), privilegios);
  }

  async getPrivilegiosOnce(uid: string): Promise<any> {
    const snap = await getDoc(doc(this.firestore, 'privilegios', uid));
    return snap.exists() ? snap.data() : null;
  }

  actualizarPrivilegios(uid: string, cambios: Partial<Privilegios>): Promise<void> {
    return updateDoc(doc(this.firestore, 'privilegios', uid), cambios as any);
  }

  setPrivilegios(uid: string, privilegios: Privilegios): Promise<void> {
    return setDoc(doc(this.firestore, 'privilegios', uid), privilegios);
  }
}
