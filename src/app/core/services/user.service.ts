/**
 * @description
 * Servicio de gestión de usuarios.
 *
 * Crea cuentas en Firebase Auth y sus documentos en la colección
 * correspondiente al rol (`administradores`, `recepcionistas`, `veterinarios`,
 * `clientes`), asignando privilegios por defecto. También gestiona la lectura
 * de usuarios, el perfil de la sesión actual y el cambio de contraseña.
 */
import { Injectable, inject } from '@angular/core';
import { Auth, createUserWithEmailAndPassword, EmailAuthProvider, getAuth, reauthenticateWithCredential, signInWithEmailAndPassword, signOut, updatePassword } from '@angular/fire/auth';
import { initializeApp, getApps } from '@angular/fire/app';
import { Firestore, where, doc, setDoc, docData, getDoc, collection, collectionData, updateDoc, query, limit, getDocs, increment } from '@angular/fire/firestore';
import { Observable, combineLatest, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { Storage, ref, uploadBytes, getDownloadURL, deleteObject } from '@angular/fire/storage';
import { PrivilegiosService } from './privilegios.service';
import { PerfilUsuario } from '../models/usuario.model';
import { AjusteSaldo } from '../models/pago.model';
import { limpiarUndefined } from '../utils/firestore.util';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class UserService {

  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private storage = inject(Storage);
  private privilegiosService = inject(PrivilegiosService);

  /**
   * @description Crea la cuenta en Firebase Auth usando una app secundaria,
   * de modo que la sesión del usuario que registra (admin/recepción) no se
   * reemplace. Si no había sesión (bootstrap del primer admin), inicia sesión
   * en la app principal para que las escrituras queden autenticadas.
   * @param email - Correo del nuevo usuario.
   * @param password - Contraseña del nuevo usuario.
   * @returns Uid de la cuenta creada.
   */
  private async crearCuentaAuth(email: string, password: string): Promise<string> {
    const appSecundaria = getApps().find(a => a.name === 'secundaria')
      ?? initializeApp(environment.firebaseConfig, 'secundaria');
    const authSecundaria = getAuth(appSecundaria);
    const habiaSesion = !!this.auth.currentUser;

    try {
      const cred = await createUserWithEmailAndPassword(authSecundaria, email, password);
      if (!habiaSesion) {
        await signInWithEmailAndPassword(this.auth, email, password);
      }
      return cred.user.uid;
    } finally {
      await signOut(authSecundaria);
    }
  }

  /**
   * @description Registra un administrador.
   * @param data - Datos del administrador, incluida la contraseña.
   */
  async registerAdministrador(data: any) {
    const uid = await this.crearCuentaAuth(data.Correo, data.Contrasena);

    await setDoc(doc(this.firestore, 'administradores', uid), {
      idAdministrador: uid,
      Cedula: data.Cedula,
      Nombre: data.Nombre,
      Apellido: data.Apellido,
      Telefono: data.Telefono,
      Correo: data.Correo,
      estado: data.estado ?? 'activo',
      fechaRegistro: new Date().toISOString(),
    });

    await this.privilegiosService.crearPrivilegiosDefault(uid, 'administrador');
  }

  /**
   * @description Registra un recepcionista.
   * @param data - Datos del recepcionista, incluida la contraseña.
   */
  async registerRecepcionista(data: any) {
    const uid = await this.crearCuentaAuth(data.Correo, data.Contrasena);

    await setDoc(doc(this.firestore, 'recepcionistas', uid), {
      idRecepcionista: uid,
      Cedula: data.Cedula,
      Nombre: data.Nombre,
      Apellido: data.Apellido,
      Telefono: data.Telefono,
      Correo: data.Correo,
      estado: data.estado ?? 'activo',
      idAdministrador: data.idAdministrador,
      fechaRegistro: new Date().toISOString(),
    });

    await this.privilegiosService.crearPrivilegiosDefault(uid, 'recepcionista');
  }

  /**
   * @description Registra un veterinario.
   * @param data - Datos del veterinario, incluida la contraseña y especialidad.
   */
  async registerVeterinario(data: any) {
    const uid = await this.crearCuentaAuth(data.Correo, data.Contrasena);

    await setDoc(doc(this.firestore, 'veterinarios', uid), {
      idVeterinario: uid,
      Cedula: data.Cedula,
      Nombre: data.Nombre,
      Apellido: data.Apellido,
      Telefono: data.Telefono,
      Correo: data.Correo,
      Especialidad: data.Especialidad,
      especialidades: Array.isArray(data.especialidades) ? data.especialidades : [],
      estado: data.estado ?? 'activo',
      idAdministrador: data.idAdministrador,
      fechaRegistro: new Date().toISOString(),
    });

    await this.privilegiosService.crearPrivilegiosDefault(uid, 'veterinario');
  }

  /**
   * @description Registra un groomer (Fase 2).
   * @param data - Datos del groomer, incluida la contraseña.
   */
  async registerGroomer(data: any) {
    const uid = await this.crearCuentaAuth(data.Correo, data.Contrasena);

    await setDoc(doc(this.firestore, 'groomers', uid), {
      idGroomer: uid,
      Cedula: data.Cedula,
      Nombre: data.Nombre,
      Apellido: data.Apellido,
      Telefono: data.Telefono,
      Correo: data.Correo,
      estado: data.estado ?? 'activo',
      idAdministrador: data.idAdministrador,
      fechaRegistro: new Date().toISOString(),
    });

    await this.privilegiosService.crearPrivilegiosDefault(uid, 'groomer');
  }

  /**
   * @description Registra un cliente.
   * @param data - Datos del cliente, incluida la contraseña.
   */
  async registerCliente(data: any) {
    const uid = await this.crearCuentaAuth(data.Correo, data.Contrasena);

    await setDoc(doc(this.firestore, 'clientes', uid), {
      idCliente: uid,
      Cedula: data.Cedula,
      Nombre: data.Nombre,
      Apellido: data.Apellido,
      Telefono: data.Telefono,
      Correo: data.Correo,
      estado: data.estado ?? 'activo',
      idAdministrador: data.idAdministrador,
      fechaRegistro: new Date().toISOString(),
    });

    await this.privilegiosService.crearPrivilegiosDefault(uid, 'cliente');
  }

  /**
   * @description Emite en tiempo real todos los usuarios del sistema.
   * @returns Observable con el conjunto completo de usuarios.
   */
  getTodosLosUsuarios(): Observable<any[]> {
    const admins$ = collectionData(
      collection(this.firestore, 'administradores'), { idField: 'uid' }
    ).pipe(map((u: any[]) => u.map(x => ({ ...x, rol: 'administrador' }))));

    const clientes$ = collectionData(
      collection(this.firestore, 'clientes'), { idField: 'uid' }
    ).pipe(map((u: any[]) => u.map(x => ({ ...x, rol: 'cliente' }))));

    const recepcionistas$ = collectionData(
      collection(this.firestore, 'recepcionistas'), { idField: 'uid' }
    ).pipe(map((u: any[]) => u.map(x => ({ ...x, rol: 'recepcionista' }))));

    const veterinarios$ = collectionData(
      collection(this.firestore, 'veterinarios'), { idField: 'uid' }
    ).pipe(map((u: any[]) => u.map(x => ({ ...x, rol: 'veterinario' }))));

    const groomers$ = collectionData(
      collection(this.firestore, 'groomers'), { idField: 'uid' }
    ).pipe(map((u: any[]) => u.map(x => ({ ...x, rol: 'groomer' }))));

    return combineLatest([admins$, clientes$, recepcionistas$, veterinarios$, groomers$]).pipe(
      map(([a, c, r, v, g]) => [...a, ...c, ...r, ...v, ...g])
    );
  }

  /**
   * @description Lee una sola vez un documento de usuario.
   * @param coleccion - Colección del rol.
   * @param uid - Identificador del usuario.
   * @returns Los datos del documento, o `null` si no existe.
   */
  async getDocumentOnce(coleccion: string, uid: string): Promise<any | null> {
    const snap = await getDoc(doc(this.firestore, coleccion, uid));
    return snap.exists() ? snap.data() : null;
  }

  /**
   * @description Emite en tiempo real un documento de usuario.
   * @param coleccion - Colección del rol.
   * @param uid - Identificador del usuario.
   */
  getDocument(coleccion: string, uid: string) {
    return docData(doc(this.firestore, coleccion, uid));
  }

  /**
   * @description Comprueba si existe al menos un administrador en la base de datos.
   * @returns `true` si ya hay usuarios; `false` si la base está vacía.
   */
  async existeAlgunUsuario(): Promise<boolean> {
    const ref = collection(this.firestore, 'administradores');
    const q = query(ref, limit(1));
    const snap = await getDocs(q);
    return !snap.empty;
  }

  /**
   * @description Cambia el estado de actividad de un usuario.
   * @param coleccion - Colección del rol.
   * @param uid - Identificador del usuario.
   * @param estado - Nuevo estado.
   */
  cambiarEstado(coleccion: string, uid: string, estado: string) {
    return updateDoc(doc(this.firestore, coleccion, uid), { estado });
  }

  /**
   * @description Aplica una actualización parcial al documento de un usuario.
   * @param coleccion - Colección del rol.
   * @param uid - Identificador del usuario.
   * @param cambios - Campos a modificar.
   */
  actualizarUsuario(coleccion: string, uid: string, cambios: any): Promise<void> {
    return updateDoc(doc(this.firestore, coleccion, uid), cambios);
  }

  /**
   * @description Traduce un rol a su colección de Firestore.
   * @param rol - Rol del usuario.
   * @returns El nombre de la colección correspondiente.
   */
  getColeccionPorRol(rol: string): string {
    const map: Record<string, string> = {
      administrador: 'administradores',
      cliente: 'clientes',
      recepcionista: 'recepcionistas',
      veterinario: 'veterinarios',
      groomer: 'groomers',
    };
    return map[rol];
  }

  /**
   * @description Inicia sesión con correo y contraseña en Firebase Auth.
   * @param email - Correo electrónico.
   * @param password - Contraseña.
   */
  login(email: string, password: string) {
    return signInWithEmailAndPassword(this.auth, email, password);
  }

  /**
   * @description Emite en tiempo real el perfil del usuario en sesión.
   * @returns Observable con el perfil, o `null` si no hay sesión.
   */
  getPerfilActual(): Observable<PerfilUsuario | null> {
    const uid = localStorage.getItem('uid');
    const rol = localStorage.getItem('rol');
    if (!uid || !rol) return of(null);

    const coleccion = this.getColeccionPorRol(rol);
    return (docData(doc(this.firestore, coleccion, uid)) as Observable<any>).pipe(
      map(data => data ? ({ ...data, uid, rol } as PerfilUsuario) : null)
    );
  }

  /**
   * @description Actualiza el perfil del usuario en sesión.
   * @param cambios - Campos del perfil a modificar.
   * @throws Error si no hay sesión activa.
   */
  async actualizarPerfilActual(cambios: Partial<PerfilUsuario>): Promise<void> {
    const uid = localStorage.getItem('uid');
    const rol = localStorage.getItem('rol');
    if (!uid || !rol) throw new Error('Sin sesión');

    const { rol: _r, uid: _u, estado: _e, ...camposEditables } = cambios as any;
    await updateDoc(doc(this.firestore, this.getColeccionPorRol(rol), uid), camposEditables);
  }

  /**
   * @description Cambia la contraseña del usuario en sesión.
   * @param passwordActual - Contraseña vigente.
   * @param passwordNuevo - Nueva contraseña.
   * @throws Error si no hay sesión activa.
   */
  async cambiarPasswordActual(passwordActual: string, passwordNuevo: string): Promise<void> {
    const usuario = this.auth.currentUser;
    if (!usuario?.email) throw new Error('Sin sesión');

    const credencial = EmailAuthProvider.credential(usuario.email, passwordActual);
    await reauthenticateWithCredential(usuario, credencial);
    await updatePassword(usuario, passwordNuevo);
  }

  /**
   * @description Comprueba si una cédula ya está registrada.
   * @param cedula - Cédula a buscar.
   * @param exceptoUid - Uid que se excluye de la búsqueda (útil al editar).
   * @returns `true` si la cédula existe en cualquier colección.
   */
  async existeCedula(cedula: string, exceptoUid?: string): Promise<boolean> {
    const colecciones = [
      'administradores',
      'clientes',
      'recepcionistas',
      'veterinarios',
      'groomers'
    ];

    for (const nombreColeccion of colecciones) {
      const ref = collection(this.firestore, nombreColeccion);
      const q = query(ref, where('Cedula', '==', cedula));
      const snapshot = await getDocs(q);
      for (const docSnap of snapshot.docs) {
        if (docSnap.id !== exceptoUid) return true;
      }
    }
    return false;
  }

  /**
   * @description Ajusta el saldo a favor de un cliente (suma o resta, atómico).
   * @param uid - Identificador del cliente.
   * @param delta - Cantidad a sumar (positiva) o restar (negativa).
   */
  ajustarSaldoFavor(uid: string, delta: number): Promise<void> {
    return updateDoc(doc(this.firestore, 'clientes', uid), { saldoFavor: increment(delta) });
  }

  /**
   * @description Sube la foto de perfil de un usuario a Storage y devuelve su URL.
   * @param uid - Identificador del usuario.
   * @param file - Archivo de imagen.
   * @returns URL pública de la imagen.
   */
  async subirImagen(uid: string, file: File): Promise<string> {
    const imgRef = ref(this.storage, `usuarios/${uid}`);
    await uploadBytes(imgRef, file);
    return getDownloadURL(imgRef);
  }

  /**
   * @description Elimina la foto de perfil de un usuario de Storage (si existe).
   * @param uid - Identificador del usuario.
   */
  async eliminarImagen(uid: string): Promise<void> {
    try {
      await deleteObject(ref(this.storage, `usuarios/${uid}`));
    } catch {
      // si no existe, no falla el flujo
    }
  }

  /**
   * @description Registra un movimiento de ajuste de saldo a favor (trazabilidad).
   * @param ajuste - Datos del ajuste (sin idAjuste).
   */
  registrarAjusteSaldo(ajuste: Omit<AjusteSaldo, 'idAjuste'>): Promise<void> {
    const refDoc = doc(collection(this.firestore, 'ajustes-saldo'));
    return setDoc(refDoc, limpiarUndefined(ajuste));
  }
}