import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { VentaService } from 'src/app/core/services/venta.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { UtilidadesService } from 'src/app/core/services/utilidades.service';
import { Venta, saldoVenta } from 'src/app/core/models/venta.model';

export interface FilaVendedor {
  idVendedor: string;
  vendedor: string;
  ventas: number;
  items: number;
  total: number;
  cobrado: number;
  pendiente: number;
}

type RangoPreset = 'hoy' | '7d' | '30d' | 'mes' | 'todo';

@Component({
  selector: 'app-reportes',
  templateUrl: './reportes.page.html',
  styleUrls: ['./reportes.page.scss'],
  standalone: false
})
export class ReportesPage implements OnInit, OnDestroy {

  ventas: Venta[] = [];
  rango: RangoPreset = '30d';
  desdeIso = '';
  hastaIso = '';
  exportando = false;
  puedeVerVentas = true;

  presets: { id: RangoPreset; label: string }[] = [
    { id: 'hoy', label: 'Hoy' },
    { id: '7d', label: '7 días' },
    { id: '30d', label: '30 días' },
    { id: 'mes', label: 'Este mes' },
    { id: 'todo', label: 'Todo' },
  ];

  private ventasSub?: Subscription;
  private authSvc = inject(AuthService);

  constructor(
    private ventaSvc: VentaService,
    private util: UtilidadesService,
  ) {}

  ngOnInit(): void {
    const esAdmin = this.authSvc.getRolActual() === 'administrador';
    this.authSvc.privilegios$.subscribe(p => {
      const pr = p ?? {};
      this.puedeVerVentas = esAdmin || pr['verVentas'] === true;
    });

    this.ventasSub = this.ventaSvc.getTodas().subscribe(ventas => {
      this.ventas = ventas;
    });

    this.aplicarPreset('30d');
  }

  ngOnDestroy(): void {
    this.ventasSub?.unsubscribe();
  }

  aplicarPreset(r: RangoPreset) {
    this.rango = r;
    const hoy = new Date();
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    if (r === 'hoy') {
      this.desdeIso = fmt(hoy);
      this.hastaIso = fmt(hoy);
    } else if (r === '7d') {
      const d = new Date(hoy);
      d.setDate(d.getDate() - 6);
      this.desdeIso = fmt(d);
      this.hastaIso = fmt(hoy);
    } else if (r === '30d') {
      const d = new Date(hoy);
      d.setDate(d.getDate() - 29);
      this.desdeIso = fmt(d);
      this.hastaIso = fmt(hoy);
    } else if (r === 'mes') {
      const d = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      this.desdeIso = fmt(d);
      this.hastaIso = fmt(hoy);
    } else {
      this.desdeIso = '';
      this.hastaIso = '';
    }
  }

  onRangoPersonalizado() {
    this.rango = 'todo';
  }

  private enRango(v: Venta): boolean {
    const t = new Date(v.fecha).getTime();
    const desde = this.desdeIso
      ? new Date(`${this.desdeIso}T00:00:00`).getTime()
      : Number.MIN_SAFE_INTEGER;
    const hasta = this.hastaIso
      ? new Date(`${this.hastaIso}T23:59:59.999`).getTime()
      : Number.MAX_SAFE_INTEGER;
    return t >= desde && t <= hasta;
  }

  get filtradas(): Venta[] {
    return this.ventas
      .filter(v => this.enRango(v))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }

  get porVendedor(): FilaVendedor[] {
    const map = new Map<string, FilaVendedor>();

    for (const v of this.filtradas) {
      const key = v.idVendedor || v.nombreVendedor || 'sin-vendedor';
      const fila = map.get(key) ?? {
        idVendedor: v.idVendedor,
        vendedor: v.nombreVendedor || 'Sin vendedor',
        ventas: 0,
        items: 0,
        total: 0,
        cobrado: 0,
        pendiente: 0,
      };
      fila.ventas += 1;
      fila.items += v.items.reduce((acc, it) => acc + it.cantidad, 0);
      fila.total += v.total;
      fila.cobrado += v.abonado ?? 0;
      fila.pendiente += saldoVenta(v);
      map.set(key, fila);
    }

    return [...map.values()].sort((a, b) => b.total - a.total);
  }

  get totales(): FilaVendedor {
    return this.porVendedor.reduce((acc, f) => ({
      idVendedor: '',
      vendedor: 'Total',
      ventas: acc.ventas + f.ventas,
      items: acc.items + f.items,
      total: acc.total + f.total,
      cobrado: acc.cobrado + f.cobrado,
      pendiente: acc.pendiente + f.pendiente,
    }), { idVendedor: '', vendedor: 'Total', ventas: 0, items: 0, total: 0, cobrado: 0, pendiente: 0 });
  }

  formatearFecha(fechaIso: string): string {
    const d = new Date(fechaIso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  exportarCSV() {
    if (!this.puedeVerVentas) {
      this.util.showToast('No tienes permiso para exportar reportes', 'warning');
      return;
    }
    const filas = this.porVendedor;
    if (filas.length === 0) {
      this.util.showToast('No hay datos para exportar', 'warning');
      return;
    }

    const encabezados = ['Vendedor', 'Ventas', 'Ítems', 'Total', 'Cobrado', 'Pendiente'];
    const escapar = (valor: any) => {
      const s = String(valor ?? '');
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const lineas = [encabezados.join(',')];
    for (const fila of filas) {
      lineas.push([fila.vendedor, fila.ventas, fila.items, fila.total, fila.cobrado, fila.pendiente]
        .map(escapar).join(','));
    }
    const t = this.totales;
    lineas.push(['Total', t.ventas, t.items, t.total, t.cobrado, t.pendiente].map(escapar).join(','));

    const blob = new Blob(['\uFEFF' + lineas.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte_vendedores_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.util.showToast('CSV exportado', 'success');
  }
}
