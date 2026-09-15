import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { LoadingController, ModalController } from '@ionic/angular';
import { Cita } from 'src/app/core/models/cita.model';
import { AgendaService } from 'src/app/core/services/agenda.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { UtilidadesService } from 'src/app/core/services/utilidades.service';
import { ReasignarVeterinarioComponent } from '../reasignar-veterinario/reasignar-veterinario.component';

/**
 * @description Panel de citas escaladas por groomers que aún no tienen
 * veterinario asignado. Permite auto-asignarse o abrir el reasignador.
 */
@Component({
  selector: 'app-alerta-escalado',
  templateUrl: './alerta-escalado.component.html',
  styleUrls: ['./alerta-escalado.component.scss'],
  standalone: false,
})
export class AlertaEscaladoComponent {

  @Input() citas: Cita[] = [];

  @Output() asignada = new EventEmitter<void>();

  private firestore = inject(Firestore);
  private auth = inject(AuthService);
  private agendaSvc = inject(AgendaService);
  private modalCtrl = inject(ModalController);
  private loadingCtrl = inject(LoadingController);
  private util = inject(UtilidadesService);

  formatHora(hora: string): string {
    return this.util.formatHora12Compact(hora);
  }

  async asignarme(cita: Cita) {
    const uid = this.auth.getUidActual() ?? '';
    if (!uid) return;

    const loading = await this.loadingCtrl.create({ message: 'Asignando cita...' });
    await loading.present();
    try {
      const snap = await getDoc(doc(this.firestore, 'veterinarios', uid));
      const data = snap.exists() ? snap.data() as any : {};
      const nombre = `${data.Nombre ?? ''} ${data.Apellido ?? ''}`.trim();
      await this.agendaSvc.asignarVeterinario(cita, { idVeterinario: uid, nombre });
      await loading.dismiss();
      await this.util.showToast('Cita asignada a tu agenda', 'success');
      this.asignada.emit();
    } catch (err: any) {
      await loading.dismiss();
      await this.util.showToast(err?.message ?? 'No se pudo asignar la cita', 'danger');
    }
  }

  async asignarA(cita: Cita) {
    const modal = await this.modalCtrl.create({
      component: ReasignarVeterinarioComponent,
      componentProps: { cita, nombreVeterinarioActual: '' },
      breakpoints: [1],
      initialBreakpoint: 1,
    });
    await modal.present();
    const { data } = await modal.onWillDismiss();
    if (data?.reasignado) {
      await this.util.showToast('Cita asignada correctamente', 'success');
      this.asignada.emit();
    }
  }
}
