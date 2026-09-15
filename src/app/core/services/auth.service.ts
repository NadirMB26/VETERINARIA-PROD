import { Injectable, inject } from '@angular/core';
import { Auth, signInWithEmailAndPassword, signOut, user } from '@angular/fire/auth';
import { Firestore, doc, getDoc, onSnapshot } from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { CarritoService } from './carrito.service';

@Injectable({ providedIn: 'root' })
export class AuthService {

  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private carritoSvc = inject(CarritoService);

  private privilegiosUnsub: (() => void) | null = null;
  private estadoUnsub: (() => void) | null = null;

  user$ = user(this.auth);

  private _privilegios: any = (() => {
    try {
      return JSON.parse(localStorage.getItem('privilegios') ?? '{}');
    } catch {
      return {};
    }
  })();

  privilegios$ = new BehaviorSubject<any>(this._privilegios);

  constructor() {
    this.user$.subscribe(u => {
      if (u) {
        this.cargarPrivilegios(u.uid);
        const rol = this.getRolActual();
        if (rol) this.vigilarEstado(u.uid, rol);
      } else {
        this.estadoUnsub?.();
        this.estadoUnsub = null;
        this._privilegios = {};
        this.privilegios$.next({});
      }
    });
  }

  async login(email: string, password: string) {
    const cred = await signInWithEmailAndPassword(this.auth, email, password);
    const uid = cred.user.uid;
    let rol: string | null = null;
    try {
      rol = await this.getRol(uid);
    } catch (err: any) {
      if (err?.message === 'inactivo') {
        await signOut(this.auth);
        throw new Error('Tu cuenta está deshabilitada. Contacta al administrador.');
      }
      throw err;
    }

    if (!rol) throw new Error('Usuario no encontrado en ninguna colección');

    localStorage.setItem('uid', uid);
    localStorage.setItem('rol', rol);

    this.cargarPrivilegios(uid);
    this.vigilarEstado(uid, rol);
    this.router.navigate(['/layout']);
  }

  async getRol(uid: string): Promise<string | null> {
    // `clientes` se consulta al final: un groomer no puede leer esa colección
    // (las reglas solo permiten staff o al propio cliente) y leerla antes
    // abortaba el login con `permission-denied`.
    const colecciones = ['administradores', 'recepcionistas', 'veterinarios', 'groomers', 'clientes'];
    const roles = ['administrador', 'recepcionista', 'veterinario', 'groomer', 'cliente'];

    for (let i = 0; i < colecciones.length; i++) {
      try {
        const snap = await getDoc(doc(this.firestore, colecciones[i], uid));
        if (snap.exists()) {
          const data = snap.data() as any;
          if (data?.estado === 'inactivo') throw new Error('inactivo');
          return roles[i];
        }
      } catch (err: any) {
        // Cuenta deshabilitada: siempre corta el login.
        if (err?.message === 'inactivo') throw err;
        // Colección sin permiso de lectura (p. ej. groomer → clientes): se salta.
        if (err?.code === 'permission-denied') continue;
        throw err;
      }
    }
    return null;
  }

  /** Resuelve uid + rol del usuario actual sin hacer busqueda en colecciones. */
  resolverRolActual(): { uid: string; rol: string } | null {
    const uid = this.getUidActual();
    const rol = this.getRolActual();
    if (!uid || !rol) return null;
    return { uid, rol };
  }

  private cargarPrivilegios(uid: string): void {
    if (this.privilegiosUnsub) this.privilegiosUnsub();

    this.privilegiosUnsub = onSnapshot(
      doc(this.firestore, 'privilegios', uid),
      (snap) => {
        const data = snap.exists() ? snap.data() : {};
        this._privilegios = data;
        localStorage.setItem('privilegios', JSON.stringify(data));
        this.privilegios$.next(data);
      },
      (error) => {
        console.error('Error escuchando privilegios:', error);
        this._privilegios = {};
        localStorage.setItem('privilegios', '{}');
        this.privilegios$.next({});
      }
    );
  }

  /**
   * Escucha el documento del usuario en sesión y cierra la sesión en cuanto
   * su cuenta pasa a 'inactivo', para que no siga navegando con permisos
   * revocados.
   */
  private vigilarEstado(uid: string, rol: string): void {
    this.estadoUnsub?.();

    const colecciones: Record<string, string> = {
      administrador: 'administradores',
      cliente: 'clientes',
      recepcionista: 'recepcionistas',
      veterinario: 'veterinarios',
      groomer: 'groomers',
    };
    const coleccion = colecciones[rol];
    if (!coleccion) return;

    this.estadoUnsub = onSnapshot(
      doc(this.firestore, coleccion, uid),
      (snap) => {
        if (snap.exists() && snap.data()?.['estado'] === 'inactivo') {
          void this.logout();
        }
      },
      (error) => console.error('Error escuchando estado de la cuenta:', error)
    );
  }

  tienePrivilegio(clave: string): boolean {
    return this._privilegios?.[clave] === true;
  }

  async recargarPrivilegios(): Promise<void> {
    const uid = this.getUidActual();
    if (uid) this.cargarPrivilegios(uid);
  }

  /**
   * Cierra la sesión de forma robusta: aunque `signOut` falle (red, token),
   * siempre se limpia el estado local en memoria/almacenamiento y se regresa
   * al login, para que no quede información del usuario anterior.
   */
  async logout() {
    this.privilegiosUnsub?.();
    this.privilegiosUnsub = null;
    this.estadoUnsub?.();
    this.estadoUnsub = null;
    this._privilegios = {};
    this.privilegios$.next({});

    try {
      await signOut(this.auth);
    } catch (err) {
      console.warn('Error cerrando sesión en Firebase:', err);
    }

    this.carritoSvc.resetSesion();
    localStorage.clear();
    sessionStorage.clear();
    this.router.navigate(['/login'], { replaceUrl: true });
  }

  getRolActual(): string | null {
    return localStorage.getItem('rol');
  }

  getUidActual(): string | null {
    return localStorage.getItem('uid');
  }

  estaLogueado(): boolean {
    return !!localStorage.getItem('uid');
  }
}
