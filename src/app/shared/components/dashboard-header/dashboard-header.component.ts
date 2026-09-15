/**
 * @description
 * Componente de cabecera del dashboard.
 *
 * Muestra el título correspondiente según el rol del usuario autenticado y
 * una campana con el contador de alertas en vivo; al tocarla abre el panel
 * de notificaciones.
 */
import { Component, Input, OnInit, inject } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { NotificacionesService } from 'src/app/core/services/notificaciones.service';
import { NotificacionesPanelComponent } from '../notificaciones-panel/notificaciones-panel.component';

@Component({
  selector: 'app-dashboard-header',
  templateUrl: './dashboard-header.component.html',
  styleUrls: ['./dashboard-header.component.scss'],
  standalone: false
})
export class DashboardHeaderComponent implements OnInit {

  /** Rol del usuario actual. */
  @Input() rol: string = '';

  private notifSvc = inject(NotificacionesService);
  private modalCtrl = inject(ModalController);

  ngOnInit() {
    this.notifSvc.iniciar();
  }

  get contadorAlertas(): number {
    return this.notifSvc.alertas().length;
  }

  async abrirNotificaciones() {
    const modal = await this.modalCtrl.create({
      component: NotificacionesPanelComponent,
      componentProps: { alertas: this.notifSvc.alertas() },
      breakpoints: [0, 0.5, 1],
      initialBreakpoint: 0.5,
      cssClass: 'notificaciones-modal',
    });
    await modal.present();
  }

  /**
   * @description Obtiene el título de la cabecera según el rol.
   * @returns Título personalizado por rol.
   */
  get titulo(): string {
    return this.rol === 'administrador'
      ? 'Panel Admin'
      : this.rol === 'veterinario'
        ? 'Panel Veterinario'
        : this.rol === 'recepcionista'
          ? 'Panel Recepcionista'
          : 'Mi Panel';
  }
}
