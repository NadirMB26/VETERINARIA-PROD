import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { ModalController } from '@ionic/angular';
import { ConfiguracionAppService } from 'src/app/core/services/configuracion-app.service';
import { UtilidadesService } from 'src/app/core/services/utilidades.service';
import { ColorWheelPickerComponent } from 'src/app/shared/components/color-wheel-picker/color-wheel-picker.component';
import {
  ConfiguracionApp,
  getConfiguracionDefault,
  TEMAS_DISPONIBLES,
  ICONOS_DISPONIBLES,
  COLORES_DISPONIBLES,
} from 'src/app/core/models/configuracion-app.model';
import { tetradaDe, generarPaleta } from 'src/app/core/utils/color.util';

/** Tema derivado del círculo cromático (tétrada sobre el matiz base). */
interface TemaDerivado {
  id: string;
  nombre: string;
  colores: string[];
}

@Component({
  selector: 'app-configuracion-app',
  templateUrl: './configuracion-app.page.html',
  styleUrls: ['./configuracion-app.page.scss'],
  standalone: false
})
export class ConfiguracionAppPage implements OnInit, OnDestroy {

  iconos = ICONOS_DISPONIBLES;
  colores = COLORES_DISPONIBLES;

  /** Matiz que ancla la tétrada: color personalizado si existe, si no el del tema guardado. */
  private get matizBaseHex(): string {
    if (this.configuracion.colorPrimario) return this.configuracion.colorPrimario;
    const tema = TEMAS_DISPONIBLES.find(t => t.id === this.configuracion.tema);
    return tema?.colores[0] ?? '#00897B';
  }

  /**
   * 4 tarjetas de tema derivadas del círculo cromático (matices a 0/90/180/270°).
   * Se recalculan en vivo conforme cambia el color elegido en el círculo.
   */
  get temas(): TemaDerivado[] {
    return tetradaDe(this.matizBaseHex).map((hex, i) => {
      const paleta = generarPaleta(hex);
      return {
        id: hex,
        nombre: `Matiz ${i + 1}`,
        colores: paleta
          ? [paleta.colorPrimario, paleta.dark, paleta.light, paleta.tint]
          : [hex],
      };
    });
  }

  /** Compara por matiz (el color guardado puede venir en mayúsculas). */
  esTemaActivo(id: string): boolean {
    return id.toLowerCase() === this.matizBaseHex.toLowerCase();
  }

  configuracion: ConfiguracionApp = getConfiguracionDefault();
  cargando = true;
  guardando = false;
  modificado = false;

  private sub?: Subscription;
  private modalCtrl = inject(ModalController);

  constructor(
    private configSvc: ConfiguracionAppService,
    private util: UtilidadesService
  ) {}

  ngOnInit(): void {
    this.sub = this.configSvc.config$.subscribe(cfg => {
      this.configuracion = { ...getConfiguracionDefault(), ...(cfg ?? {}) };
      this.cargando = false;
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  /** Selecciona un matiz de la tétrada: se aplica como color primario personalizado. */
  seleccionarTema(id: string) {
    this.configuracion.colorPrimario = id;
    this.configSvc.aplicarColorPrimario(id);
    this.modificado = true;
  }

  // ── Color primario personalizado ─────────────────────
  get colorActual(): string {
    if (this.configuracion.colorPrimario) return this.configuracion.colorPrimario;
    const actual = getComputedStyle(document.documentElement)
      .getPropertyValue('--app-primary').trim();
    return actual || '#00897B';
  }

  async abrirPickerColor() {
    const modal = await this.modalCtrl.create({
      component: ColorWheelPickerComponent,
      componentProps: {
        color: this.colorActual,
        // Callbacks por componentProps (patrón robusto: no depende del timing de Ionic).
        onColorChange: (hex: string) => this.onColorEnVivo(hex),
        onConfirmar: () => { void modal.dismiss(); },
      },
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      cssClass: 'color-picker-modal',
    });
    await modal.present();
  }

  /** Preview en vivo mientras se arrastra el picker. */
  onColorEnVivo(color: string) {
    this.configuracion.colorPrimario = color;
    this.configSvc.aplicarColorPrimario(color);
    this.modificado = true;
  }

  /** Restablece al tema predefinido elegido. */
  restablecerColores() {
    this.configuracion.colorPrimario = undefined;
    this.configSvc.limpiarColorPrimario();
    this.modificado = true;
    this.util.showToast('Colores restablecidos al tema', 'success');
  }

  // ── Tipografía ───────────────────────────────────────
  get fontSeleccionada(): string {
    return this.configuracion.fontFamily ?? 'nunito';
  }

  onFontChange(id: string) {
    this.configuracion.fontFamily = id;
    this.configSvc.aplicarFuente(id);
    this.modificado = true;
  }

  restablecerFuente() {
    this.configuracion.fontFamily = undefined;
    this.configSvc.restablecerFuente();
    this.modificado = true;
    this.util.showToast('Fuente restablecida', 'success');
  }

  seleccionarIcono(icono: string) {
    this.configuracion.logoIcono = icono;
    this.modificado = true;
  }

  seleccionarColor(color: string) {
    this.configuracion.logoColor = color;
    this.modificado = true;
  }

  async onLogoSeleccionado(event: any) {
    const file = event.target.files?.[0];
    if (!file) return;

    const permitidos = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
    if (!permitidos.includes(file.type)) {
      this.util.showToast('Solo se permiten imágenes (PNG, JPG, SVG, WEBP)', 'danger');
      return;
    }
    if (file.size > 300 * 1024) {
      this.util.showToast('La imagen no puede superar 300 KB', 'danger');
      return;
    }

    try {
      this.configuracion.logoImagen = await this.fileToBase64(file);
      this.configuracion.logoTipo = 'imagen';
      this.modificado = true;
    } catch {
      this.util.showToast('No se pudo leer la imagen', 'danger');
    }
  }

  quitarImagen() {
    this.configuracion.logoImagen = '';
    this.configuracion.logoTipo = 'icono';
    this.modificado = true;
  }

  async guardar() {
    this.guardando = true;
    try {
      await this.configSvc.actualizar({ ...this.configuracion });
      this.util.showToast('Configuración guardada', 'success');
      this.modificado = false;
    } catch (err) {
      console.error(err);
      this.util.showToast('Error al guardar la configuración', 'danger');
    } finally {
      this.guardando = false;
    }
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}
