import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { AlertController, ModalController } from '@ionic/angular';
import { ProductoService } from 'src/app/core/services/producto.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { UtilidadesService } from 'src/app/core/services/utilidades.service';
import { ProductoModalComponent } from 'src/app/shared/components/producto-modal/producto-modal.component';
import {
  Producto,
  CategoriaProducto,
  CATEGORIAS_PRODUCTO,
  calcularEstadoProducto,
  ETIQUETAS_ESTADO_PRODUCTO,
  BADGE_CLASES_ESTADO_PRODUCTO,
  getCategoriaInfo,
} from 'src/app/core/models/producto.model';
import { labelTipoServicio } from 'src/app/core/services/citas-estetica.service';

@Component({
  selector: 'app-catalogo',
  templateUrl: './catalogo.page.html',
  styleUrls: ['./catalogo.page.scss'],
  standalone: false
})
export class CatalogoPage implements OnInit, OnDestroy {

  tipo: 'producto' | 'servicio' = 'producto';

  items: Producto[] = [];
  itemsFiltrados: Producto[] = [];
  busqueda = '';
  categoriaFiltro: CategoriaProducto | null = null;
  estadoFiltro: 'activo' | 'descontinuado' | 'todos' = 'todos';
  soloStockBajo = false;
  cargando = true;
  puedeGestionar = true;

  categorias = CATEGORIAS_PRODUCTO;

  private sub?: Subscription;

  private route = inject(ActivatedRoute);
  private productoSvc = inject(ProductoService);
  private authSvc = inject(AuthService);
  private util = inject(UtilidadesService);
  private modalCtrl = inject(ModalController);
  private alertCtrl = inject(AlertController);

  get titulo(): string {
    return this.tipo === 'producto' ? 'Productos' : 'Servicios';
  }

  get etiquetaSingular(): string {
    return this.tipo === 'producto' ? 'producto' : 'servicio';
  }

  ngOnInit(): void {
    this.tipo = this.route.snapshot.data['tipo'] ?? 'producto';
    this.puedeGestionar = this.authSvc.getRolActual() === 'administrador'
      || this.authSvc.tienePrivilegio('crearVentas');

    this.sub = this.productoSvc.getTodos().subscribe(lista => {
      this.items = lista.filter(p => this.tipoDe(p) === this.tipo);
      this.cargando = false;
      this.filtrar();
    });
  }

  /** Normaliza el tipo de un ítem: los documentos legados sin `tipo` se tratan como productos. */
  private tipoDe(p: Producto): 'producto' | 'servicio' {
    return p.tipo === 'servicio' ? 'servicio' : 'producto';
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  filtrar() {
    const texto = this.busqueda.trim().toLowerCase();
    this.itemsFiltrados = this.items.filter(p => {
      if (this.categoriaFiltro && p.categoria !== this.categoriaFiltro) return false;
      if (this.estadoFiltro !== 'todos' && p.estado !== this.estadoFiltro) return false;
      if (this.soloStockBajo) {
        const e = calcularEstadoProducto(p);
        if (e !== 'stock-bajo' && e !== 'agotado') return false;
      }
      if (!texto) return true;
      return p.nombre.toLowerCase().includes(texto)
        || p.descripcion?.toLowerCase().includes(texto)
        || p.sku?.toLowerCase().includes(texto);
    });
  }

  filtrarCategoria(cat: CategoriaProducto | null) {
    this.categoriaFiltro = this.categoriaFiltro === cat ? null : cat;
    this.filtrar();
  }

  filtrarEstado(estado: 'activo' | 'descontinuado' | 'todos') {
    this.estadoFiltro = this.estadoFiltro === estado ? 'todos' : estado;
    this.filtrar();
  }

  toggleStockBajo() {
    this.soloStockBajo = !this.soloStockBajo;
    this.filtrar();
  }

  iconoCategoria(p: Producto): string {
    return getCategoriaInfo(p.categoria).icon;
  }

  nombreCategoria(p: Producto): string {
    return getCategoriaInfo(p.categoria).nombre;
  }

  etiquetaEstado(p: Producto): string {
    return ETIQUETAS_ESTADO_PRODUCTO[calcularEstadoProducto(p)];
  }

  claseEstado(p: Producto): string {
    return BADGE_CLASES_ESTADO_PRODUCTO[calcularEstadoProducto(p)];
  }

  precio(p: Producto): string {
    return `$${p.precio.toLocaleString('es-CO')}`;
  }

  /** Etiqueta del mapeo del servicio: tipo de servicio estético o tipo de cita. */
  etiquetaServicio(p: Producto): string {
    if (p.tipoServicioEstetica) return labelTipoServicio(p.tipoServicioEstetica);
    return p.tipoCita ?? '';
  }

  async nuevoItem() {
    if (!this.puedeGestionar) {
      this.util.showToast('No tienes permiso para gestionar el catálogo', 'warning');
      return;
    }
    const modal = await this.modalCtrl.create({
      component: ProductoModalComponent,
      componentProps: { tipoFijo: this.tipo },
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      cssClass: 'producto-modal',
    });
    await modal.present();
  }

  async editarItem(p: Producto) {
    if (!this.puedeGestionar) {
      this.util.showToast('No tienes permiso para gestionar el catálogo', 'warning');
      return;
    }
    const modal = await this.modalCtrl.create({
      component: ProductoModalComponent,
      componentProps: { producto: p, tipoFijo: this.tipo },
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      cssClass: 'producto-modal',
    });
    await modal.present();
  }

  /** Soft delete: nunca borra físicamente, solo marca descontinuado para no romper el historial de ventas. */
  async toggleEstado(p: Producto) {
    if (!this.puedeGestionar) return;
    const nuevoEstado = p.estado === 'descontinuado' ? 'activo' : 'descontinuado';
    const accion = nuevoEstado === 'descontinuado' ? 'descontinuar' : 'reactivar';

    const alert = await this.alertCtrl.create({
      header: '¿Confirmar acción?',
      message: `¿Deseas ${accion} "${p.nombre}"? Los registros históricos de ventas no se ven afectados.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: accion.charAt(0).toUpperCase() + accion.slice(1),
          handler: async () => {
            try {
              await this.productoSvc.cambiarEstado(p.idProducto, nuevoEstado);
              this.util.showToast(`${p.nombre} ${nuevoEstado === 'descontinuado' ? 'descontinuado' : 'reactivado'}`, 'success');
            } catch {
              this.util.showToast('Error al cambiar el estado', 'danger');
            }
          }
        }
      ]
    });
    await alert.present();
  }
}
