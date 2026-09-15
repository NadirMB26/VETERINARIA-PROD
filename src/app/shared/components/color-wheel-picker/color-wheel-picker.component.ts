import { Component, Input, Output, EventEmitter } from '@angular/core';
import {
  HSV,
  hexToHsv,
  hsvToHex,
  hsvGradientes,
} from 'src/app/core/utils/color.util';

@Component({
  selector: 'app-color-wheel-picker',
  templateUrl: './color-wheel-picker.component.html',
  styleUrls: ['./color-wheel-picker.component.scss'],
  standalone: false
})
export class ColorWheelPickerComponent {

  /** Expone Math para usarlo en la plantilla. */
  Math = Math;

  /** Color inicial en formato #RRGGBB. */
  @Input() set color(valor: string) {
    const hsv = hexToHsv(valor);
    if (hsv) {
      this.hsv = hsv;
      this.hsvInicial = { ...hsv };
    }
  }

  /** Se emite en vivo con cada cambio del color (#RRGGBB). */
  @Output() colorChange = new EventEmitter<string>();

  @Output() confirmado = new EventEmitter<string>();

  /** Callbacks opcionales (patrón modal de Ionic): se pasan por componentProps. */
  @Input() onColorChange?: (hex: string) => void;
  @Input() onConfirmar?: (hex: string) => void;

  /** HSV actual (h 0-360, s 0-1, v 0-1). */
  hsv: HSV = { h: 200, s: 0.6, v: 0.8 };
  hsvInicial: HSV = { h: 200, s: 0.6, v: 0.8 };

  /** Ángulo del marcador en el anillo (grados). */
  get angulo(): number {
    return this.hsv.h;
  }

  /** Posición del punto en el cuadro SV (porcentajes). */
  get sx(): number {
    return this.hsv.s * 100;
  }

  get sy(): number {
    return (1 - this.hsv.v) * 100;
  }

  get gradientes() {
    return hsvGradientes(this.hsv.h);
  }

  get colorHex(): string {
    return hsvToHex(this.hsv);
  }

  get colorAnteriorHex(): string {
    return hsvToHex(this.hsvInicial);
  }

  /** Indica si el arrastre está activo (para fijar el marcador). */
  arrastrando = false;

  // ── Anillo de matiz ──────────────────────────────────
  onAnilloDown(event: PointerEvent) {
    event.preventDefault();
    this.arrastrando = true;
    this.actualizarHueDesdeEvento(event);
    window.addEventListener('pointermove', this.moverAnillo);
    window.addEventListener('pointerup', this.terminarAnillo);
  }

  private moverAnillo = (event: PointerEvent) => {
    this.actualizarHueDesdeEvento(event);
  };

  private terminarAnillo = () => {
    this.arrastrando = false;
    window.removeEventListener('pointermove', this.moverAnillo);
    window.removeEventListener('pointerup', this.terminarAnillo);
    this.emitir();
  };

  private actualizarHueDesdeEvento(event: PointerEvent) {
    const anillo = (event.target as HTMLElement).closest('.cwp__anillo') as HTMLElement | null;
    if (!anillo) return;
    const rect = anillo.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const rad = Math.atan2(event.clientY - cy, event.clientX - cx);
    let h = (rad * 180) / Math.PI + 90;
    if (h < 0) h += 360;
    this.hsv = { ...this.hsv, h: h % 360 };
    this.emitir();
  }

  // ── Cuadro de saturación/valor ───────────────────────
  onBoxDown(event: PointerEvent) {
    event.preventDefault();
    this.arrastrando = true;
    this.actualizarSvDesdeEvento(event);
    window.addEventListener('pointermove', this.moverBox);
    window.addEventListener('pointerup', this.terminarBox);
  }

  private moverBox = (event: PointerEvent) => {
    this.actualizarSvDesdeEvento(event);
  };

  private terminarBox = () => {
    this.arrastrando = false;
    window.removeEventListener('pointermove', this.moverBox);
    window.removeEventListener('pointerup', this.terminarBox);
    this.emitir();
  };

  private actualizarSvDesdeEvento(event: PointerEvent) {
    const box = (event.target as HTMLElement).closest('.cwp__box') as HTMLElement | null;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    this.hsv = {
      ...this.hsv,
      s: Math.min(1, Math.max(0, x)),
      v: Math.min(1, Math.max(0, 1 - y)),
    };
    this.emitir();
  }

  // ── Inputs numéricos H/S/V ───────────────────────────
  onHueInput(valor: string) {
    const n = Number(valor);
    if (!Number.isFinite(n)) return;
    this.hsv = { ...this.hsv, h: ((n % 360) + 360) % 360 };
    this.emitir();
  }

  onSatInput(valor: string) {
    const n = Number(valor);
    if (!Number.isFinite(n)) return;
    this.hsv = { ...this.hsv, s: Math.min(100, Math.max(0, n)) / 100 };
    this.emitir();
  }

  onValInput(valor: string) {
    const n = Number(valor);
    if (!Number.isFinite(n)) return;
    this.hsv = { ...this.hsv, v: Math.min(100, Math.max(0, n)) / 100 };
    this.emitir();
  }

  // ── Emisión ──────────────────────────────────────────
  private emitir() {
    this.colorChange.emit(this.colorHex);
    this.onColorChange?.(this.colorHex);
  }

  confirmar() {
    this.hsvInicial = { ...this.hsv };
    this.confirmado.emit(this.colorHex);
    this.onConfirmar?.(this.colorHex);
  }
}
