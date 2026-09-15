import { Component, Input, inject } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { Router } from '@angular/router';
import { AlertaNotificacion } from 'src/app/core/services/notificaciones.service';

@Component({
  selector: 'app-notificaciones-panel',
  templateUrl: './notificaciones-panel.component.html',
  styleUrls: ['./notificaciones-panel.component.scss'],
  standalone: false
})
export class NotificacionesPanelComponent {

  @Input() alertas: AlertaNotificacion[] = [];

  private modalCtrl = inject(ModalController);
  private router = inject(Router);

  async irA(alerta: AlertaNotificacion) {
    await this.modalCtrl.dismiss();
    this.router.navigate([alerta.ruta]);
  }

  cerrar() {
    this.modalCtrl.dismiss();
  }
}
