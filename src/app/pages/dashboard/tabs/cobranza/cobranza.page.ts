import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Subscription, firstValueFrom } from 'rxjs';
import { ModalController } from '@ionic/angular';
import { VentaService } from 'src/app/core/services/venta.service';
import { UserService } from 'src/app/core/services/user.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { UtilidadesService } from 'src/app/core/services/utilidades.service';
import { AbonoModalComponent } from 'src/app/shared/components/abono-modal/abono-modal.component';
import { AjusteSaldoModalComponent } from 'src/app/shared/components/ajuste-saldo-modal/ajuste-saldo-modal.component';
import { Venta, saldoVenta, getMetodoPagoInfo } from 'src/app/core/models/venta.model';
import { Abono } from 'src/app/core/models/pago.model';

@Component({
  selector: 'app-cobranza',
  templateUrl: './cobranza.page.html',
  styleUrls: ['./cobranza.page.scss'],
  standalone: false
})
export class CobranzaPage implements OnInit, OnDestroy {

  ventas: Venta[] = [];
  busqueda = '';
  soloPendientes = true;
  soloCitas = false;
  puedeCobrar = true;

  clienteDetalle: Venta | null = null;
  pagosDetalle: Abono[] = [];

  private ventasSub?: Subscription;
  private pagosSub?: Subscription;

  constructor(
    private ventaSvc: VentaService,
    private userSvc: UserService,
    private authSvc: AuthService,
    private util: UtilidadesService,
    private modalCtrl: ModalController,
  ) {}

  ngOnInit(): void {
    const esAdmin = this.authSvc.getRolActual() === 'administrador';
    this.authSvc.privilegios$.subscribe(p => {
      const pr = p ?? {};
      this.puedeCobrar = esAdmin || pr['crearVentas'] === true;
    });

    this.ventasSub = this.ventaSvc.getTodas().subscribe(ventas => {
      this.ventas = ventas;
    });
  }

  ngOnDestroy(): void {
    this.ventasSub?.unsubscribe();
    this.pagosSub?.unsubscribe();
  }

  get pendientes(): Venta[] {
    return this.ventas.filter(v => v.estadoPago === 'pendiente');
  }

  get filtradas(): Venta[] {
    const texto = this.busqueda.trim().toLowerCase();
    return [...(this.soloPendientes ? this.pendientes : this.ventas)]
      .filter(v => !this.soloCitas || v.origen === 'cita')
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .filter(v => {
        if (!texto) return true;
        return v.idVenta.toLowerCase().includes(texto)
          || v.nombreCliente.toLowerCase().includes(texto)
          || (v.nombreMascota ?? '').toLowerCase().includes(texto);
      });
  }

  /** True si la venta nació del agendamiento de una cita. */
  esCita(v: Venta): boolean {
    return v.origen === 'cita';
  }

  etiquetaEstado(v: Venta): string {
    const map: Record<string, string> = {
      pagado: 'Pagado',
      pendiente: 'Pendiente',
      anulada: 'Anulada',
    };
    return map[v.estadoPago] ?? v.estadoPago;
  }

  get deudaTotal(): number {
    return this.pendientes.reduce((acc, v) => acc + saldoVenta(v), 0);
  }

  saldoDe(v: Venta): number {
    return saldoVenta(v);
  }

  metodoNombre(metodo: string): string {
    return getMetodoPagoInfo(metodo).nombre;
  }

  formatearFecha(fechaIso: string): string {
    const d = new Date(fechaIso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // ── Modal: abono ─────────────────────────────────────
  async registrarAbono(v: Venta) {
    if (!this.puedeCobrar) {
      this.util.showToast('No tienes permiso para registrar abonos', 'warning');
      return;
    }
    const modal = await this.modalCtrl.create({
      component: AbonoModalComponent,
      componentProps: { venta: v },
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      cssClass: 'abono-modal',
    });
    await modal.present();
  }

  // ── Modal: detalle deuda (historial de abonos) ───────
  async verDetalle(v: Venta) {
    this.clienteDetalle = v;
    this.pagosDetalle = [];
    this.pagosSub?.unsubscribe();
    this.pagosSub = this.ventaSvc.getPagosPorVenta(v.idVenta).subscribe(pagos => {
      this.pagosDetalle = [...pagos].sort((a, b) => b.fecha.localeCompare(a.fecha));
    });
  }

  cerrarDetalle() {
    this.clienteDetalle = null;
    this.pagosSub?.unsubscribe();
  }

  // ── Modal: ajuste de saldo a favor ────────────────────
  async ajustarSaldo() {
    if (!this.puedeCobrar) {
      this.util.showToast('No tienes permiso para ajustar saldos', 'warning');
      return;
    }
    const modal = await this.modalCtrl.create({
      component: AjusteSaldoModalComponent,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      cssClass: 'ajuste-saldo-modal',
    });
    await modal.present();
  }
}
