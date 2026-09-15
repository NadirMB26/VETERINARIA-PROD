import { Component, Input, OnInit, OnDestroy, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { ModalController } from '@ionic/angular';
import { VentaService } from 'src/app/core/services/venta.service';
import {
  Venta,
  PagoVenta,
  metodosPagoNombre,
  getMetodoPagoInfo,
  saldoVenta,
} from 'src/app/core/models/venta.model';
import { Abono } from 'src/app/core/models/pago.model';

@Component({
  selector: 'app-venta-detalle-modal',
  templateUrl: './venta-detalle-modal.component.html',
  styleUrls: ['./venta-detalle-modal.component.scss'],
  standalone: false
})
export class VentaDetalleModalComponent implements OnInit, OnDestroy {

  @Input() venta!: Venta;

  abonos: Abono[] = [];

  private abonosSub?: Subscription;
  private modalCtrl = inject(ModalController);
  private ventaSvc = inject(VentaService);

  ngOnInit(): void {
    this.abonosSub = this.ventaSvc.getPagosPorVenta(this.venta.idVenta).subscribe(pagos => {
      this.abonos = [...pagos].sort((a, b) => b.fecha.localeCompare(a.fecha));
    });
  }

  ngOnDestroy(): void {
    this.abonosSub?.unsubscribe();
  }

  cerrar() {
    this.modalCtrl.dismiss();
  }

  metodosTexto(): string {
    return metodosPagoNombre(this.venta);
  }

  metodoNombre(metodo: string): string {
    return getMetodoPagoInfo(metodo).nombre;
  }

  metodoIcono(metodo: string): string {
    return getMetodoPagoInfo(metodo).icon;
  }

  /** Vuelto de un pago en efectivo (0 si no aplica). */
  vueltoDe(p: PagoVenta): number {
    if (p.metodoPago !== 'efectivo' || !p.recibido) return 0;
    return Math.max(0, p.recibido - p.monto);
  }

  saldo(): number {
    return saldoVenta(this.venta);
  }

  formatearFecha(fechaIso: string): string {
    const d = new Date(fechaIso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  iniciales(nombre: string): string {
    return (nombre || '?').trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();
  }
}
