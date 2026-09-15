import { Component, Input, Output, EventEmitter } from '@angular/core';
import {
  CategoriaProducto,
  CATEGORIAS_PRODUCTO,
} from 'src/app/core/models/producto.model';

export type DisponibilidadFiltro = 'disponible' | 'stock-bajo' | 'agotado' | null;

@Component({
  selector: 'app-ventas-sidebar',
  templateUrl: './ventas-sidebar.component.html',
  styleUrls: ['./ventas-sidebar.component.scss'],
  standalone: false
})
export class VentasSidebarComponent {

  categorias = CATEGORIAS_PRODUCTO;
  mostrarTodas = false;

  @Input() busqueda = '';
  @Input() tipoFiltro: 'producto' | 'servicio' | null = null;
  @Input() categoriaFiltro: CategoriaProducto | null = null;
  @Input() soloOfertas = false;
  @Input() disponibilidadFiltro: DisponibilidadFiltro = null;
  @Input() precioMin: number | null = null;
  @Input() precioMax: number | null = null;
  @Input() contadorResultados = 0;

  @Output() busquedaChange = new EventEmitter<string>();
  @Output() tipoChange = new EventEmitter<'producto' | 'servicio' | null>();
  @Output() categoriaChange = new EventEmitter<CategoriaProducto | null>();
  @Output() ofertasChange = new EventEmitter<boolean>();
  @Output() disponibilidadChange = new EventEmitter<DisponibilidadFiltro>();
  @Output() precioChange = new EventEmitter<{ min: number | null; max: number | null }>();
  @Output() cerrar = new EventEmitter<void>();

  get categoriasVisibles(): typeof this.categorias {
    return this.mostrarTodas ? this.categorias : this.categorias.slice(0, 8);
  }

  get hayFiltros(): boolean {
    return !!this.busqueda.trim()
      || !!this.tipoFiltro
      || !!this.categoriaFiltro
      || this.soloOfertas
      || !!this.disponibilidadFiltro
      || this.precioMin !== null
      || this.precioMax !== null;
  }

  onBusqueda(valor: string) {
    this.busquedaChange.emit(valor);
  }

  toggleTipo(tipo: 'producto' | 'servicio') {
    this.tipoChange.emit(this.tipoFiltro === tipo ? null : tipo);
  }

  toggleCategoria(cat: CategoriaProducto) {
    this.categoriaChange.emit(this.categoriaFiltro === cat ? null : cat);
  }

  toggleOfertas(activo: boolean) {
    this.ofertasChange.emit(activo);
  }

  toggleDisponibilidad(estado: 'disponible' | 'stock-bajo' | 'agotado') {
    this.disponibilidadChange.emit(this.disponibilidadFiltro === estado ? null : estado);
  }

  onPrecioMin(valor: string) {
    this.precioChange.emit({ min: valor === '' ? null : Number(valor) || 0, max: this.precioMax });
  }

  onPrecioMax(valor: string) {
    this.precioChange.emit({ min: this.precioMin, max: valor === '' ? null : Number(valor) || 0 });
  }

  limpiar() {
    this.busquedaChange.emit('');
    this.tipoChange.emit(null);
    this.categoriaChange.emit(null);
    this.ofertasChange.emit(false);
    this.disponibilidadChange.emit(null);
    this.precioChange.emit({ min: null, max: null });
  }
}
