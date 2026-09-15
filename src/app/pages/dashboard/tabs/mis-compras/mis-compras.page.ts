import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { VentaService } from 'src/app/core/services/venta.service';
import { UserService } from 'src/app/core/services/user.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { Venta, saldoVenta, getMetodoPagoInfo, metodosPagoNombre } from 'src/app/core/models/venta.model';
import { Abono } from 'src/app/core/models/pago.model';

@Component({
  selector: 'app-mis-compras',
  templateUrl: './mis-compras.page.html',
  styleUrls: ['./mis-compras.page.scss'],
  standalone: false
})
export class MisComprasPage implements OnInit, OnDestroy {

  ventas: Venta[] = [];
  saldoFavor = 0;

  ventaDetalle: Venta | null = null;
  abonosDetalle: Abono[] = [];

  private ventasSub?: Subscription;
  private perfilSub?: Subscription;
  private pagosSub?: Subscription;
  private authSvc = inject(AuthService);

  constructor(
    private ventaSvc: VentaService,
    private userSvc: UserService,
  ) {}

  ngOnInit(): void {
    const uid = this.authSvc.getUidActual();
    if (!uid) return;

    this.perfilSub = this.userSvc.getPerfilActual().subscribe(perfil => {
      this.saldoFavor = Number(perfil?.saldoFavor ?? 0);
    });

    this.ventasSub = this.ventaSvc.getPorCliente(uid).subscribe(ventas => {
      this.ventas = ventas;
    });
  }

  ngOnDestroy(): void {
    this.ventasSub?.unsubscribe();
    this.perfilSub?.unsubscribe();
    this.pagosSub?.unsubscribe();
  }

  get deudas(): Venta[] {
    return this.ventas
      .filter(v => v.estadoPago === 'pendiente' && saldoVenta(v) > 0)
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }

  get historial(): Venta[] {
    return [...this.ventas].sort((a, b) => b.fecha.localeCompare(a.fecha));
  }

  get deudaTotal(): number {
    return this.deudas.reduce((acc, v) => acc + saldoVenta(v), 0);
  }

  saldoDe(v: Venta): number {
    return saldoVenta(v);
  }

  metodoNombre(metodo: string): string {
    return getMetodoPagoInfo(metodo).nombre;
  }

  metodosVenta(v: Venta): string {
    return metodosPagoNombre(v);
  }

  formatearFecha(fechaIso: string): string {
    const d = new Date(fechaIso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  async verVenta(v: Venta) {
    this.ventaDetalle = v;
    this.abonosDetalle = [];
    this.pagosSub?.unsubscribe();
    this.pagosSub = this.ventaSvc.getPagosPorVenta(v.idVenta).subscribe(pagos => {
      this.abonosDetalle = [...pagos].sort((a, b) => b.fecha.localeCompare(a.fecha));
    });
  }

  cerrarDetalle() {
    this.ventaDetalle = null;
    this.pagosSub?.unsubscribe();
  }
}
