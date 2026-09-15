import { Component, Input, OnInit, inject } from '@angular/core';
import { ModalController, PopoverController } from '@ionic/angular';
import { UserService } from 'src/app/core/services/user.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { UtilidadesService } from 'src/app/core/services/utilidades.service';
import { ClienteSelectorComponent } from 'src/app/shared/components/cliente-selector/cliente-selector.component';

@Component({
  selector: 'app-ajuste-saldo-modal',
  templateUrl: './ajuste-saldo-modal.component.html',
  styleUrls: ['./ajuste-saldo-modal.component.scss'],
  standalone: false
})
export class AjusteSaldoModalComponent implements OnInit {

  @Input() cliente?: any;

  clienteSeleccionado: any = null;
  direccion: 'sumar' | 'restar' = 'sumar';
  monto = 0;
  nota = '';

  guardando = false;
  idVendedor = '';
  nombreVendedor = '';

  private modalCtrl = inject(ModalController);
  private popoverCtrl = inject(PopoverController);
  private userSvc = inject(UserService);
  private authSvc = inject(AuthService);
  private util = inject(UtilidadesService);

  ngOnInit(): void {
    this.clienteSeleccionado = this.cliente ?? null;

    const uid = this.authSvc.getUidActual();
    const rol = this.authSvc.getRolActual();
    if (uid && rol) {
      this.idVendedor = uid;
      void this.userSvc.getDocumentOnce(this.userSvc.getColeccionPorRol(rol), uid).then(data => {
        if (data) {
          this.nombreVendedor = `${data.Nombre ?? ''} ${data.Apellido ?? ''}`.trim() || uid;
        }
      });
    }
  }

  get saldoFavorActual(): number {
    return Number(this.clienteSeleccionado?.saldoFavor ?? 0);
  }

  get formValido(): boolean {
    return !!this.clienteSeleccionado && this.monto > 0
      && (this.direccion === 'sumar' || this.monto <= this.saldoFavorActual);
  }

  cancelar() {
    this.modalCtrl.dismiss();
  }

  async seleccionarCliente() {
    const popover = await this.popoverCtrl.create({
      component: ClienteSelectorComponent,
      cssClass: 'cliente-selector-popover',
    });
    await popover.present();
    const { data } = await popover.onWillDismiss();
    if (data?.cliente) {
      this.clienteSeleccionado = data.cliente;
    }
  }

  async guardar() {
    if (!this.formValido || this.guardando) return;

    this.guardando = true;
    try {
      const uid = this.clienteSeleccionado.idCliente ?? this.clienteSeleccionado.uid;
      const delta = this.direccion === 'sumar' ? Number(this.monto) : -Number(this.monto);

      await this.userSvc.ajustarSaldoFavor(uid, delta);
      await this.userSvc.registrarAjusteSaldo({
        idCliente: uid,
        nombreCliente: `${this.clienteSeleccionado.Nombre ?? ''} ${this.clienteSeleccionado.Apellido ?? ''}`.trim(),
        monto: delta,
        fecha: new Date().toISOString(),
        idVendedor: this.idVendedor,
        nombreVendedor: this.nombreVendedor,
        nota: this.nota.trim() || undefined,
      });

      this.util.showToast('Saldo a favor actualizado', 'success');
      this.modalCtrl.dismiss({ guardado: true });
    } catch (err) {
      console.error(err);
      this.util.showToast('Error al ajustar el saldo', 'danger');
    } finally {
      this.guardando = false;
    }
  }
}
