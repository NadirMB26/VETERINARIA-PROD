import { Component, Input, OnInit, inject } from '@angular/core';
import { LoadingController, ModalController } from '@ionic/angular';
import {
  MetodoPago,
  METODOS_PAGO_CHECKOUT,
  Venta,
  formatearPrecio,
  saldoVenta,
} from 'src/app/core/models/venta.model';
import { CitaVentaService } from 'src/app/core/services/cita-venta.service';
import { UtilidadesService } from 'src/app/core/services/utilidades.service';

/**
 * @description Confirmación de la venta generada al agendar una cita.
 * Permite cobrar total/parcial en el momento o dejar la cuenta pendiente
 * para Cobranza.
 */
@Component({
  selector: 'app-confirmacion-venta-modal',
  templateUrl: './confirmacion-venta-modal.component.html',
  styleUrls: ['./confirmacion-venta-modal.component.scss'],
  standalone: false,
})
export class ConfirmacionVentaModalComponent implements OnInit {

  @Input() venta!: Venta;

  metodos = METODOS_PAGO_CHECKOUT;
  metodoPago: MetodoPago = 'efectivo';
  monto = 0;
  soportePago = '';
  guardando = false;

  private modalCtrl = inject(ModalController);
  private loadingCtrl = inject(LoadingController);
  private citaVentaSvc = inject(CitaVentaService);
  private util = inject(UtilidadesService);

  ngOnInit() {
    this.monto = this.saldo;
  }

  get saldo(): number { return saldoVenta(this.venta); }
  get total(): number { return this.venta.total; }
  get esGratis(): boolean { return this.venta.total <= 0; }
  get yaPagada(): boolean { return this.venta.estadoPago !== 'pendiente'; }
  get requiereSoporte(): boolean { return this.metodoPago === 'transferencia' || this.metodoPago === 'otro'; }
  get montoValido(): boolean { return this.monto > 0 && this.monto <= this.saldo; }
  get puedeCobrar(): boolean {
    return !this.guardando && this.montoValido && (!this.requiereSoporte || !!this.soportePago.trim());
  }

  precio(v: number): string { return formatearPrecio(v); }

  onMonto(valor: any) {
    const solo = String(valor ?? '').replace(/\D/g, '');
    this.monto = solo ? Number(solo) : 0;
  }

  usarTotal() { this.monto = this.saldo; }

  async cobrar() {
    if (!this.puedeCobrar) return;

    const loading = await this.loadingCtrl.create({ message: 'Registrando cobro...' });
    await loading.present();
    this.guardando = true;
    try {
      await this.citaVentaSvc.cobrarVenta(this.venta.idVenta, [{
        monto: this.monto,
        metodoPago: this.metodoPago,
        soportePago: this.requiereSoporte ? this.soportePago.trim() : undefined,
      }]);
      await loading.dismiss();
      await this.util.showToast('Cobro registrado correctamente', 'success');
      await this.modalCtrl.dismiss({ cobrado: true });
    } catch (err: any) {
      await loading.dismiss();
      await this.util.showToast(err?.message ?? 'Error al registrar el cobro', 'danger');
    } finally {
      this.guardando = false;
    }
  }

  cerrar() { this.modalCtrl.dismiss({ cobrado: false }); }
}
