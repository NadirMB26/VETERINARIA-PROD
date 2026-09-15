import { Component, OnInit, inject } from '@angular/core';
import { AlertController, ModalController } from '@ionic/angular';
import { BannerService } from 'src/app/core/services/banner.service';
import { UtilidadesService } from 'src/app/core/services/utilidades.service';
import { BannerSlide } from 'src/app/core/models/banner.model';
import { BannerFormModalComponent } from 'src/app/shared/components/banner-form-modal/banner-form-modal.component';

@Component({
  selector: 'app-banners',
  templateUrl: './banners.page.html',
  styleUrls: ['./banners.page.scss'],
  standalone: false
})
export class BannersPage implements OnInit {

  slides: BannerSlide[] = [];
  cargando = true;

  private bannerSvc = inject(BannerService);
  private modalCtrl = inject(ModalController);
  private alertCtrl = inject(AlertController);
  private util = inject(UtilidadesService);

  ngOnInit() {
    this.bannerSvc.getTodos().subscribe(lista => {
      this.slides = lista;
      this.cargando = false;
    });
  }

  async nuevoSlide() {
    const modal = await this.modalCtrl.create({
      component: BannerFormModalComponent,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      cssClass: 'banner-form-modal',
    });
    await modal.present();
  }

  async editarSlide(slide: BannerSlide) {
    const modal = await this.modalCtrl.create({
      component: BannerFormModalComponent,
      componentProps: { slide },
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      cssClass: 'banner-form-modal',
    });
    await modal.present();
  }

  subir(slide: BannerSlide) {
    void this.bannerSvc.reordenar(slide.id, this.slides, -1);
  }

  bajar(slide: BannerSlide) {
    void this.bannerSvc.reordenar(slide.id, this.slides, 1);
  }

  toggleActivo(slide: BannerSlide) {
    void this.bannerSvc.actualizar(slide.id, { activo: !slide.activo })
      .catch(() => this.util.showToast('Error al actualizar el slide', 'danger'));
  }

  async eliminar(slide: BannerSlide) {
    const alert = await this.alertCtrl.create({
      header: 'Eliminar banner',
      message: `¿Deseas eliminar "${slide.titulo || 'Banner'}"? Se quitará de la vitrina de ventas.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            try {
              await this.bannerSvc.eliminar(slide.id, slide.imagenUrl);
              this.util.showToast('Banner eliminado', 'success');
            } catch {
              this.util.showToast('Error al eliminar el banner', 'danger');
            }
          }
        }
      ]
    });
    await alert.present();
  }
}
