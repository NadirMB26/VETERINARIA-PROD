import { Injectable, inject } from '@angular/core';
import { Firestore, doc, setDoc, docData, getDoc, deleteField } from '@angular/fire/firestore';
import { Observable, of } from 'rxjs';
import { catchError, shareReplay, switchMap } from 'rxjs/operators';
import { ConfiguracionApp, getConfiguracionDefault } from '../models/configuracion-app.model';
import { generarPaleta } from '../utils/color.util';
import { FUENTES_DISPONIBLES, cargarFuente, FuenteDisponible } from '../models/fuentes.model';
import { AuthService } from './auth.service';

const COLECCION = 'configuracion';
const DOC_ID = 'app';

/** Variables derivadas del color primario que se aplican en runtime. */
const VARS_PRIMARIAS = [
  '--app-primary',
  '--app-primary-dark',
  '--app-primary-shade',
  '--app-primary-light',
  '--app-primary-tint',
  '--app-primary-xlight',
  '--app-primary-rgb',
] as const;

@Injectable({ providedIn: 'root' })
export class ConfiguracionAppService {

  private firestore = inject(Firestore);
  private authService = inject(AuthService);
  private docRef = doc(this.firestore, COLECCION, DOC_ID);

  /**
   * Configuración en vivo y a prueba de fallos: si la lectura falla (reglas,
   * red) emite `undefined` en lugar de romper la suscripción para siempre.
   */
  readonly config$: Observable<ConfiguracionApp | undefined> = this.getConfiguracion().pipe(
    catchError(err => {
      console.error('Error leyendo la configuración de la app:', err);
      return of(undefined);
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  getConfiguracion(): Observable<ConfiguracionApp | undefined> {
    return docData(this.docRef) as Observable<ConfiguracionApp | undefined>;
  }

  /**
   * Aplica la configuración al arrancar y la vuelve a leer cuando cambia la
   * sesión, de modo que el tema/color/fuente/título se apliquen aunque la
   * primera lectura ocurra sin autenticación (página de inicio sin sesión).
   */
  iniciar(): void {
    this.authService.user$
      .pipe(switchMap(() => this.config$))
      .subscribe(cfg => {
        this.aplicarConfiguracion(cfg ?? getConfiguracionDefault());
      });
  }

  async inicializarSiNoExiste(): Promise<void> {
    try {
      const snap = await getDoc(this.docRef);
      if (!snap.exists()) {
        await setDoc(this.docRef, getConfiguracionDefault());
      }
    } catch (err) {
      console.error('Error inicializando configuración de la app:', err);
    }
  }

  /**
   * Guarda la configuración creando el documento si aún no existe.
   * Los campos en `undefined` se eliminan (reset de color/fuente), porque
   * Firestore no admite `undefined` como valor de campo.
   */
  actualizar(cambios: Partial<ConfiguracionApp>): Promise<void> {
    const datos: Record<string, unknown> = {};
    for (const [clave, valor] of Object.entries(cambios)) {
      datos[clave] = valor === undefined ? deleteField() : valor;
    }
    return setDoc(this.docRef, datos as any, { merge: true });
  }

  aplicarTema(tema: string): void {
    document.documentElement.setAttribute('data-theme', tema);
  }

  aplicarTitulo(nombre: string): void {
    document.title = nombre;
  }

  /**
   * Aplica el color primario personalizado: deriva las 7 variables de la
   * paleta y las setea inline (modo `data-theme="custom"`).
   */
  aplicarColorPrimario(color: string | undefined): void {
    if (!color) {
      this.limpiarVarsPrimarias();
      return;
    }
    const paleta = generarPaleta(color);
    if (!paleta) return;

    const root = document.documentElement;
    root.style.setProperty('--app-primary', paleta.colorPrimario);
    root.style.setProperty('--app-primary-dark', paleta.dark);
    root.style.setProperty('--app-primary-shade', paleta.shade);
    root.style.setProperty('--app-primary-light', paleta.light);
    root.style.setProperty('--app-primary-tint', paleta.tint);
    root.style.setProperty('--app-primary-xlight', paleta.xlight);
    root.style.setProperty('--app-primary-rgb', paleta.rgb);
    root.setAttribute('data-theme', 'custom');
  }

  /** Quita el color personalizado y deja que el tema elegido mande. */
  limpiarColorPrimario(): void {
    this.limpiarVarsPrimarias();
    this.aplicarTema(this.configActual?.tema ?? 'teal');
  }

  private limpiarVarsPrimarias(): void {
    const root = document.documentElement;
    for (const v of VARS_PRIMARIAS) {
      root.style.removeProperty(v);
    }
    if (root.getAttribute('data-theme') === 'custom') {
      root.removeAttribute('data-theme');
    }
  }

  /** Aplica la fuente elegida (carga dinámica si es de Google Fonts). */
  aplicarFuente(fontId: string | undefined): void {
    const fuente = this.fuentePorId(fontId);
    if (fuente) {
      cargarFuente(fuente);
      document.documentElement.style.setProperty('--ion-font-family', fuente.css);
    } else {
      document.documentElement.style.removeProperty('--ion-font-family');
    }
  }

  restablecerFuente(): void {
    document.documentElement.style.removeProperty('--ion-font-family');
  }

  private fuentePorId(id: string | undefined): FuenteDisponible | undefined {
    return FUENTES_DISPONIBLES.find(f => f.id === id);
  }

  /** Referencia a la última config aplicada (para resets). */
  private configActual: ConfiguracionApp | null = null;

  aplicarConfiguracion(config: ConfiguracionApp): void {
    this.configActual = config;
    if (config.colorPrimario) {
      this.aplicarColorPrimario(config.colorPrimario);
    } else {
      this.aplicarTema(config.tema);
    }
    this.aplicarFuente(config.fontFamily);
    this.aplicarTitulo(config.nombre);
  }
}
