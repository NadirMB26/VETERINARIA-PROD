import { Component, Input, OnInit, inject } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { ProductoService } from 'src/app/core/services/producto.service';
import { UtilidadesService } from 'src/app/core/services/utilidades.service';
import {
  Producto,
  CategoriaProducto,
  CategoriaInfo,
  CATEGORIAS_PRODUCTO,
  calcularDescuento,
  calcularPrecioPromocion,
} from 'src/app/core/models/producto.model';
import { CATALOGO_TIPOS_CITA } from 'src/app/core/models/catalogo-citas.model';
import { Cita } from 'src/app/core/models/cita.model';
import { TIPOS_SERVICIO_ESTETICA } from 'src/app/core/services/citas-estetica.service';

@Component({
  selector: 'app-producto-modal',
  templateUrl: './producto-modal.component.html',
  styleUrls: ['./producto-modal.component.scss'],
  standalone: false
})
export class ProductoModalComponent implements OnInit {

  @Input() producto?: Producto;

  /** Si se indica, el tipo queda fijo (CRUD separado de productos/servicios) y no se muestra el selector. */
  @Input() tipoFijo?: 'producto' | 'servicio';

  categorias = CATEGORIAS_PRODUCTO;

  /** Tipos de cita médicos que puede cubrir un servicio (Estética va por groomer). */
  readonly tiposCita = CATALOGO_TIPOS_CITA.filter(t => t.tipo !== 'Estética');

  /** Tipos de servicio de estética disponibles. */
  readonly tiposServicioEstetica = TIPOS_SERVICIO_ESTETICA;

  nombre = '';
  categoria: CategoriaProducto = 'medicamentos';
  tipo: 'producto' | 'servicio' = 'producto';
  precio = 0;
  costo = 0;
  sku = '';
  stock = 0;
  stockMinimo = 5;
  fechaVencimiento = '';
  descripcion = '';

  // ── Metadatos de servicios (agendamiento) ──────────────
  /** Tipo de cita médico que cubre el servicio. */
  tipoCita = '';
  /** Tipo de servicio estético (solo categoría `estetica`). */
  tipoServicioEstetica: Cita['tipoServicio'] = '';
  /** Duración estimada en minutos. */
  duracionMin = 0;
  /** Pasos/insumos que incluye el servicio. */
  incluye: string[] = [];
  nuevoIncluye = '';

  fotoPreview = '';
  archivoImagen?: File;
  imagenQuitada = false;

  guardando = false;

  private modalCtrl = inject(ModalController);
  private productoSvc = inject(ProductoService);
  private util = inject(UtilidadesService);

  get esEdicion(): boolean {
    return !!this.producto;
  }

  /** En CRUD separado el tipo no se puede cambiar. */
  get tipoBloqueado(): boolean {
    return !!this.tipoFijo || this.esEdicion;
  }

  get esServicio(): boolean {
    return this.tipo === 'servicio';
  }

  /**
   * Categorías ofrecidas: un servicio solo puede ser médico (`servicios`) o
   * de estética (`estetica`); un producto puede ser cualquiera.
   */
  get categoriasDisponibles(): CategoriaInfo[] {
    if (this.tipo !== 'servicio') return this.categorias;
    return this.categorias.filter(c => c.id === 'servicios' || c.id === 'estetica');
  }

  /**
   * Normaliza la categoría de un servicio: los registros viejos guardados con
   * categoría de producto (p. ej. "medicamentos") pasan a `servicios`, para que
   * aparezcan al agendar citas.
   */
  private normalizarCategoriaServicio() {
    if (this.tipo !== 'servicio') return;
    if (this.categoria !== 'servicios' && this.categoria !== 'estetica') {
      this.categoria = 'servicios';
    }
  }

  /** Servicio de estética: usa tipo de servicio (baño, corte...). */
  get esServicioEstetica(): boolean {
    return this.esServicio && this.categoria === 'estetica';
  }

  /** Servicio médico: se mapea a un tipo de cita. */
  get esServicioMedico(): boolean {
    return this.esServicio && this.categoria !== 'estetica';
  }

  agregarIncluye() {
    const valor = this.nuevoIncluye.trim();
    if (!valor || this.incluye.includes(valor)) return;
    this.incluye = [...this.incluye, valor];
    this.nuevoIncluye = '';
  }

  quitarIncluye(indice: number) {
    this.incluye = this.incluye.filter((_, i) => i !== indice);
  }

  ngOnInit(): void {
    if (this.tipoFijo) this.tipo = this.tipoFijo;
    if (!this.producto) {
      this.normalizarCategoriaServicio();
      return;
    }
    this.nombre = this.producto.nombre;
    this.categoria = this.producto.categoria;
    this.tipo = this.producto.tipo;
    this.costo = this.producto.costo ?? 0;
    this.sku = this.producto.sku ?? '';
    this.stock = this.producto.stock;
    this.stockMinimo = this.producto.stockMinimo;
    this.fechaVencimiento = this.producto.fechaVencimiento ?? '';
    this.descripcion = this.producto.descripcion ?? '';
    this.fotoPreview = this.producto.fotoUrl ?? '';
    // Si el producto está en promoción (precio con descuento), el campo "Precio"
    // muestra el precio NORMAL y el % de descuento se deriva de la diferencia.
    const tienePromocion = !!this.producto.precioAnterior
      && this.producto.precioAnterior > this.producto.precio;
    this.precio = tienePromocion
      ? (this.producto.precioAnterior ?? this.producto.precio)
      : this.producto.precio;
    this.descuentoPct = tienePromocion ? (calcularDescuento(this.producto) ?? 0) : 0;
    this.ofertaTipo = this.producto.ofertaTipo ?? '';
    this.ofertaFin = this.producto.ofertaFin ?? '';
    this.cupon = this.producto.cupon ?? '';
    this.tipoCita = this.producto.tipoCita ?? '';
    this.tipoServicioEstetica = this.producto.tipoServicioEstetica ?? '';
    this.duracionMin = this.producto.duracionMin ?? 0;
    this.incluye = [...(this.producto.incluye ?? [])];
    this.normalizarCategoriaServicio();
  }

  get formValido(): boolean {
    if (this.nombre.trim().length === 0) return false;
    if (this.precio < 0 || this.costo < 0) return false;
    if (this.tipo === 'producto' && (this.stock < 0 || this.stockMinimo < 0)) return false;
    if (this.muestraOferta && this.ofertaTipo && !this.descuentoValido()) return false;
    return true;
  }

  /** El % de descuento debe estar entre 1 y 99 y el precio normal debe ser mayor a 0. */
  descuentoValido(): boolean {
    return this.descuentoPct >= 1 && this.descuentoPct <= 99 && this.precio > 0;
  }

  /**
   * Sanitiza entradas numéricas: conserva solo dígitos (bloquea letras,
   * símbolos y negativos) y aplica un máximo opcional.
   */
  soloDigitos(valor: any, max?: number): number {
    const solo = String(valor ?? '').replace(/\D/g, '');
    if (solo === '') return 0;
    const n = Number(solo);
    return max !== undefined ? Math.min(n, max) : n;
  }

  /** Precio de oferta en vivo = precio normal − % de descuento. */
  get precioOfertaVista(): number {
    return calcularPrecioPromocion(this.precio, this.descuentoPct);
  }

  get muestraOferta(): boolean {
    return this.tipo === 'producto';
  }

  get etiquetaTipo(): string {
    return this.tipo === 'producto' ? 'Producto' : 'Servicio';
  }

  private fechaIsoHoy(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // ── Campos de oferta (opcional) ──────────────────────
  ofertaTipo: 'diaria' | 'semanal' | '' = '';
  ofertaFin = '';
  /** Porcentaje de descuento a aplicar (ej. 5 = 5%). */
  descuentoPct = 0;
  cupon = '';

  cancelar() {
    this.modalCtrl.dismiss();
  }

  async onImagenSeleccionado(event: any) {
    const file = event.target.files?.[0];
    if (!file) return;

    const permitidos = ['image/png', 'image/jpeg', 'image/webp'];
    if (!permitidos.includes(file.type)) {
      this.util.showToast('Solo se permiten imágenes (PNG, JPG, WEBP)', 'danger');
      return;
    }
    if (file.size > 500 * 1024) {
      this.util.showToast('La imagen no puede superar 500 KB', 'danger');
      return;
    }

    try {
      this.fotoPreview = await this.fileToBase64(file);
      this.archivoImagen = file;
      this.imagenQuitada = false;
    } catch {
      this.util.showToast('No se pudo leer la imagen', 'danger');
    }
  }

  quitarImagen() {
    this.fotoPreview = '';
    this.archivoImagen = undefined;
    this.imagenQuitada = true;
  }

  async guardar() {
    if (!this.formValido || this.guardando) return;

    if (this.tipo === 'servicio' && this.categoria !== 'servicios' && this.categoria !== 'estetica') {
      await this.util.showToast('Selecciona la categoría "Servicios Médicos" o "Estética"', 'warning');
      return;
    }

    const sku = this.sku.trim();
    if (sku) {
      try {
        const duplicado = await this.productoSvc.existeSku(sku, this.producto?.idProducto);
        if (duplicado) {
          await this.util.showToast('Ya existe un producto con ese SKU', 'warning');
          return;
        }
      } catch {
        // si la consulta falla, se continúa sin bloquear el guardado
      }
    }

    this.guardando = true;
    try {
      const esProducto = this.tipo === 'producto';
      const precioNormal = Math.max(0, Number(this.precio) || 0);
      const pct = Number(this.descuentoPct) || 0;
      const data: any = {
        nombre: this.nombre.trim(),
        categoria: this.categoria,
        tipo: this.tipo,
        precio: precioNormal,
        costo: esProducto && Number(this.costo) > 0 ? Number(this.costo) : undefined,
        sku: esProducto && sku ? sku : undefined,
        stock: esProducto ? Number(this.stock) || 0 : 0,
        stockMinimo: esProducto ? Number(this.stockMinimo) || 0 : 0,
        fechaVencimiento: esProducto ? this.fechaVencimiento : undefined,
        descripcion: this.descripcion.trim(),
        estado: 'activo',
      };

      // Metadatos de servicio: tipo de cita (médico) o tipo de servicio (estética).
      if (!esProducto) {
        data.tipoCita = this.esServicioMedico ? (this.tipoCita || '') : '';
        data.tipoServicioEstetica = this.esServicioEstetica ? (this.tipoServicioEstetica || '') : '';
        data.duracionMin = Number(this.duracionMin) > 0 ? Number(this.duracionMin) : 0;
        data.incluye = [...this.incluye];
      }

      // Oferta activa cuando hay tipo, fecha de fin futura y % de descuento válido (1-99).
      // El precio con descuento se calcula solo; el normal se conserva en `precioAnterior`.
      const hayOferta = esProducto
        && this.ofertaTipo
        && this.ofertaFin
        && this.ofertaFin >= this.fechaIsoHoy()
        && pct >= 1 && pct <= 99
        && precioNormal > 0;
      if (hayOferta) {
        data.precio = calcularPrecioPromocion(precioNormal, pct);
        data.precioAnterior = precioNormal;
        data.ofertaTipo = this.ofertaTipo;
        data.ofertaFin = this.ofertaFin;
        data.cupon = this.cupon.trim() || undefined;
      } else {
        // Sin promoción vigente: se cobra el precio normal y se limpia/restaura lo anterior.
        data.precio = precioNormal;
        data.precioAnterior = undefined;
        data.ofertaTipo = undefined;
        data.ofertaFin = undefined;
        data.cupon = undefined;
      }

      let idProducto = this.producto?.idProducto ?? '';

      if (this.esEdicion) {
        const cambios: any = { ...data };
        if (this.archivoImagen) {
          const url = await this.productoSvc.subirImagen(this.archivoImagen, this.producto!.idProducto);
          cambios.fotoUrl = url;
        } else if (this.imagenQuitada) {
          cambios.fotoUrl = '';
          await this.productoSvc.eliminarImagen(this.producto!.idProducto);
        }
        await this.productoSvc.actualizarProducto(this.producto!.idProducto, cambios);
      } else {
        idProducto = await this.productoSvc.registrarProducto(data);
        if (this.archivoImagen) {
          const url = await this.productoSvc.subirImagen(this.archivoImagen, idProducto);
          await this.productoSvc.actualizarProducto(idProducto, { fotoUrl: url });
        }
      }

      this.util.showToast(
        this.esEdicion ? `${this.etiquetaTipo} actualizado` : `${this.etiquetaTipo} creado`,
        'success'
      );
      this.modalCtrl.dismiss({ guardado: true });
    } catch (err) {
      console.error(err);
      this.util.showToast(`Error al guardar el ${this.etiquetaTipo.toLowerCase()}`, 'danger');
    } finally {
      this.guardando = false;
    }
  }

  async descontinuar() {
    if (!this.producto) return;
    try {
      const nuevoEstado = this.producto.estado === 'descontinuado' ? 'activo' : 'descontinuado';
      await this.productoSvc.cambiarEstado(this.producto.idProducto, nuevoEstado);
      this.util.showToast(nuevoEstado === 'descontinuado' ? `${this.etiquetaTipo} descontinuado` : `${this.etiquetaTipo} reactivado`, 'success');
      this.modalCtrl.dismiss({ guardado: true });
    } catch (err) {
      console.error(err);
      this.util.showToast('Error al cambiar el estado', 'danger');
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
