import { Component, Input, Output, EventEmitter } from '@angular/core';
import {
  Producto,
  calcularDescuento,
  ofertaVigente,
  ETIQUETAS_ESTADO_PRODUCTO,
  BADGE_CLASES_ESTADO_PRODUCTO,
  calcularEstadoProducto,
  getCategoriaInfo,
} from 'src/app/core/models/producto.model';

@Component({
  selector: 'app-product-card',
  templateUrl: './product-card.component.html',
  styleUrls: ['./product-card.component.scss'],
  standalone: false
})
export class ProductCardComponent {

  @Input() producto!: Producto;

  /** Deshabilita el botón "Agregar" (ej. sin stock). */
  @Input() deshabilitado = false;

  /** Se emite al tocar "Agregar" con el producto seleccionado. */
  @Output() agregar = new EventEmitter<Producto>();

  /** Porcentaje de descuento (null si no aplica). */
  descuento(): number | null {
    return calcularDescuento(this.producto);
  }

  tieneOferta(): boolean {
    return ofertaVigente(this.producto);
  }

  precioAnteriorTexto(): string {
    const d = calcularDescuento(this.producto);
    return d === null ? '' : `$${this.producto.precioAnterior!.toLocaleString('es-CO')}`;
  }

  precioTexto(): string {
    return `$${this.producto.precio.toLocaleString('es-CO')}`;
  }

  etiquetaEstado(): string {
    return ETIQUETAS_ESTADO_PRODUCTO[calcularEstadoProducto(this.producto)];
  }

  claseEstado(): string {
    return BADGE_CLASES_ESTADO_PRODUCTO[calcularEstadoProducto(this.producto)];
  }

  iconoCategoria(): string {
    return getCategoriaInfo(this.producto.categoria).icon;
  }

  onAgregar() {
    this.agregar.emit(this.producto);
  }
}
