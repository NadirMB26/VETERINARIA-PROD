import { Injectable, inject } from '@angular/core';
import { Firestore, doc, setDoc, docData, updateDoc, getDoc } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { ConfiguracionApp, getConfiguracionDefault } from '../models/configuracion-app.model';
import { generarPaleta } from '../utils/color.util';
import { FUENTES_DISPONIBLES, cargarFuente, FuenteDisponible } from '../models/fuentes.model';

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
  private docRef = doc(this.firestore, COLECCION, DOC_ID);

  getConfiguracion(): Observable<ConfiguracionApp | undefined> {
    return docData(this.docRef) as Observable<ConfiguracionApp | undefined>;
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

  actualizar(cambios: Partial<ConfiguracionApp>): Promise<void> {
    return updateDoc(this.docRef, cambios as any);
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
