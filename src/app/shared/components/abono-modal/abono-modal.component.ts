import { Component, Input, OnInit, inject } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { VentaService } from 'src/app/core/services/venta.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { UserService } from 'src/app/core/services/user.service';
import { UtilidadesService } from 'src/app/core/services/utilidades.service';
import { Venta, MetodoPago, METODOS_PAGO, saldoVenta, requiereSoportePago } from 'src/app/core/models/venta.model';

@Component({
  selector: 'app-abono-modal',
  templateUrl: './abono-modal.component.html',
  styleUrls: ['./abono-modal.component.scss'],
  standalone: false
})
export class AbonoModalComponent implements OnInit {

  @Input() venta!: Venta;

  metodosPago = METODOS_PAGO.filter(m => m.id !== 'credito');

  monto = 0;
  metodoPago: MetodoPago = 'efectivo';
  soportePago = '';
  nota = '';

  guardando = false;
  idVendedor = '';
  nombreVendedor = '';

  private modalCtrl = inject(ModalController);
  private ventaSvc = inject(VentaService);
  private authSvc = inject(AuthService);
  private userSvc = inject(UserService);
  private util = inject(UtilidadesService);

  ngOnInit(): void {
    this.monto = saldoVenta(this.venta);

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

  get saldo(): number {
    return saldoVenta(this.venta);
  }

  get requiereSoporte(): boolean {
    return requiereSoportePago(this.metodoPago);
  }

  get formValido(): boolean {
    return this.monto > 0 && this.monto <= this.saldo && (!this.requiereSoporte || !!this.soportePago);
  }

  cancelar() {
    this.modalCtrl.dismiss();
  }

  onMetodoPagoChange() {
    this.soportePago = '';
  }

  async onSoporteSeleccionado(event: any) {
    const file = event.target.files?.[0];
    if (!file) return;

    const permitidos = ['image/png', 'image/jpeg', 'image/webp'];
    if (!permitidos.includes(file.type)) {
      this.util.showToast('Solo se permiten imágenes (PNG, JPG, WEBP)', 'danger');
      return;
    }
    if (file.size > 300 * 1024) {
      this.util.showToast('El soporte no puede superar 300 KB', 'danger');
      return;
    }

    try {
      this.soportePago = await this.fileToBase64(file);
    } catch {
      this.util.showToast('No se pudo leer el soporte', 'danger');
    }
  }

  quitarSoporte() {
    this.soportePago = '';
  }

  async guardar() {
    if (!this.formValido || this.guardando) return;

    this.guardando = true;
    try {
      await this.ventaSvc.registrarAbono(this.venta.idVenta, {
        idVenta: this.venta.idVenta,
        idCliente: this.venta.idCliente,
        nombreCliente: this.venta.nombreCliente,
        monto: Number(this.monto),
        fecha: new Date().toISOString(),
        metodoPago: this.metodoPago,
        soportePago: this.soportePago || undefined,
        idVendedor: this.idVendedor,
        nombreVendedor: this.nombreVendedor,
        nota: this.nota.trim() || undefined,
      });

      this.util.showToast('Abono registrado correctamente', 'success');
      this.modalCtrl.dismiss({ guardado: true });
    } catch (err: any) {
      console.error(err);
      this.util.showToast(err?.message ?? 'Error al registrar el abono', 'danger');
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
