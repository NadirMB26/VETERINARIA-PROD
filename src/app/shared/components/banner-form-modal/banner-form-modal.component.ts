import { Component, Input, OnInit, inject } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { BannerService } from 'src/app/core/services/banner.service';
import { UtilidadesService } from 'src/app/core/services/utilidades.service';
import { BannerSlide } from 'src/app/core/models/banner.model';

@Component({
  selector: 'app-banner-form-modal',
  templateUrl: './banner-form-modal.component.html',
  styleUrls: ['./banner-form-modal.component.scss'],
  standalone: false
})
export class BannerFormModalComponent implements OnInit {

  @Input() slide?: BannerSlide;

  titulo = '';
  link = '';
  activo = true;

  fotoPreview = '';
  archivoImagen?: File;
  imagenQuitada = false;
  guardando = false;

  private modalCtrl = inject(ModalController);
  private bannerSvc = inject(BannerService);
  private util = inject(UtilidadesService);

  get esEdicion(): boolean {
    return !!this.slide;
  }

  get formValido(): boolean {
    return !!this.fotoPreview;
  }

  ngOnInit() {
    if (!this.slide) return;
    this.titulo = this.slide.titulo ?? '';
    this.link = this.slide.link ?? '';
    this.activo = this.slide.activo;
    this.fotoPreview = this.slide.imagenUrl;
  }

  cancelar() {
    this.modalCtrl.dismiss();
  }

  async onImagenSeleccionado(event: any) {
    const file = event.target.files?.[0];
    if (!file) return;

    const permitidos = ['image/png', 'image/jpeg', 'image/webp'];
    if (!permitidos.includes(file.type)) {
      this.util.showToast('Solo se permiten imágenes (PNG, JPG, WEBP)', 'warning');
      return;
    }
    if (file.size > 600 * 1024) {
      this.util.showToast('La imagen no puede superar 600 KB', 'warning');
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

    this.guardando = true;
    try {
      const base = {
        titulo: this.titulo.trim() || undefined,
        link: this.link.trim() || undefined,
        activo: this.activo,
      };

      if (this.esEdicion) {
        const cambios: any = { ...base };
        if (this.archivoImagen) {
          const url = await this.bannerSvc.subirImagen(this.archivoImagen, this.slide!.id);
          cambios.imagenUrl = url;
        } else if (this.imagenQuitada) {
          await this.bannerSvc.eliminarImagenSolo(this.slide!.id);
          cambios.imagenUrl = '';
        }
        await this.bannerSvc.actualizar(this.slide!.id, cambios);
      } else {
        const id = await this.bannerSvc.registrar({ ...base, imagenUrl: '' });
        const url = await this.bannerSvc.subirImagen(this.archivoImagen!, id);
        await this.bannerSvc.actualizar(id, { imagenUrl: url });
      }

      this.util.showToast(this.esEdicion ? 'Banner actualizado' : 'Banner creado', 'success');
      this.modalCtrl.dismiss({ guardado: true });
    } catch (err) {
      console.error(err);
      this.util.showToast('Error al guardar el banner', 'danger');
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
