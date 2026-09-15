import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { ModalController } from '@ionic/angular';
import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import * as ExcelJS from 'exceljs';
import { VentaService } from 'src/app/core/services/venta.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { UtilidadesService } from 'src/app/core/services/utilidades.service';
import { VentaDetalleModalComponent } from 'src/app/shared/components/venta-detalle-modal/venta-detalle-modal.component';
import { Venta, MetodoPago, METODOS_PAGO, getMetodoPagoInfo, metodosPagoNombre } from 'src/app/core/models/venta.model';

const pdfMakeX = pdfMake as any;
const pdfFontsX = pdfFonts as any;
pdfMakeX.vfs = pdfFontsX.pdfMake ? pdfFontsX.pdfMake.vfs : pdfFontsX.vfs;

const ENCABEZADOS = [
  'ID de venta', 'Fecha', 'Cliente', 'Mascota', 'Vendedor', 'Producto',
  'Categoría', 'Cantidad', 'Precio unitario', 'Subtotal', 'Método de pago',
];

@Component({
  selector: 'app-historial-ventas',
  templateUrl: './historial-ventas.page.html',
  styleUrls: ['./historial-ventas.page.scss'],
  standalone: false
})
export class HistorialVentasPage implements OnInit, OnDestroy {

  metodos = METODOS_PAGO;

  ventas: Venta[] = [];
  busqueda = '';
  metodoFiltro: MetodoPago | null = null;
  exportando = '';
  puedeVerVentas = true;

  private ventasSub?: Subscription;
  private modalCtrl = inject(ModalController);

  constructor(
    private ventaSvc: VentaService,
    private authSvc: AuthService,
    private util: UtilidadesService,
  ) {}

  async verDetalle(venta: Venta) {
    const modal = await this.modalCtrl.create({
      component: VentaDetalleModalComponent,
      componentProps: { venta },
      breakpoints: [0, 0.8, 1],
      initialBreakpoint: 0.8,
      cssClass: 'venta-detalle-modal',
    });
    await modal.present();
  }

  ngOnInit(): void {
    const esAdmin = this.authSvc.getRolActual() === 'administrador';
    this.authSvc.privilegios$.subscribe(p => {
      const pr = p ?? {};
      this.puedeVerVentas = esAdmin || pr['verVentas'] === true;
    });

    this.ventasSub = this.ventaSvc.getTodas().subscribe(ventas => {
      this.ventas = ventas;
    });
  }

  ngOnDestroy(): void {
    this.ventasSub?.unsubscribe();
  }

  get filtradas(): Venta[] {
    const texto = this.busqueda.trim().toLowerCase();
    return [...this.ventas]
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .filter(v => {
        if (this.metodoFiltro && v.metodoPago !== this.metodoFiltro) return false;
        if (!texto) return true;
        return v.idVenta.toLowerCase().includes(texto)
          || v.nombreCliente.toLowerCase().includes(texto)
          || (v.nombreVendedor ?? '').toLowerCase().includes(texto);
      });
  }

  metodoNombre(metodo: MetodoPago): string {
    return getMetodoPagoInfo(metodo).nombre;
  }

  metodosVenta(v: Venta): string {
    return metodosPagoNombre(v);
  }

  totalItems(v: Venta): number {
    return v.items.reduce((acc, it) => acc + it.cantidad, 0);
  }

  formatearFecha(fechaIso: string): string {
    const d = new Date(fechaIso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  filtrarPorMetodo(m: MetodoPago | null) {
    this.metodoFiltro = this.metodoFiltro === m ? null : m;
  }

  // ── Exportaciones (una fila por ítem, formato contador) ─────────────

  private filasPlanas(): any[][] {
    const filas: any[][] = [];
    for (const v of this.filtradas) {
      const mascota = v.nombreMascota || '';
      for (const item of v.items) {
        filas.push([
          v.idVenta,
          this.formatearFecha(v.fecha),
          v.nombreCliente,
          mascota,
          v.nombreVendedor || '',
          item.nombre,
          this.metodoNombreCategoria(item.categoria),
          item.cantidad,
          item.precioUnitario,
          item.subtotal,
          this.metodosVenta(v),
        ]);
      }
    }
    return filas;
  }
  private metodoNombreCategoria(categoria: string): string {
    const map: Record<string, string> = {
      medicamentos: 'Medicamentos', alimentos: 'Alimentos',
      accesorios: 'Accesorios', servicios: 'Servicios Médicos', estetica: 'Estética',
    };
    return map[categoria] ?? categoria;
  }

  private descargarBlob(blob: Blob, nombre: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private nombreArchivo(ext: string): string {
    const hoy = new Date().toISOString().slice(0, 10);
    return `ventas_${hoy}.${ext}`;
  }

  // CSV
  exportarCSV() {
    if (!this.puedeVerVentas) {
      this.util.showToast('No tienes permiso para exportar ventas', 'warning');
      return;
    }
    const filas = this.filasPlanas();
    if (filas.length === 0) {
      this.util.showToast('No hay ventas para exportar', 'warning');
      return;
    }

    const escapar = (valor: any) => {
      const s = String(valor ?? '');
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const lineas = [ENCABEZADOS.join(',')];
    for (const fila of filas) {
      lineas.push(fila.map(escapar).join(','));
    }

    const blob = new Blob(['\uFEFF' + lineas.join('\n')], { type: 'text/csv;charset=utf-8;' });
    this.descargarBlob(blob, this.nombreArchivo('csv'));
    this.util.showToast('CSV exportado', 'success');
  }

  // Excel (.xlsx) — exceljs
  async exportarExcel() {
    if (!this.puedeVerVentas) {
      this.util.showToast('No tienes permiso para exportar ventas', 'warning');
      return;
    }
    const filas = this.filasPlanas();
    if (filas.length === 0) {
      this.util.showToast('No hay ventas para exportar', 'warning');
      return;
    }

    this.exportando = 'excel';
    try {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Ventas');

      ws.columns = ENCABEZADOS.map((h, i) => ({
        header: h,
        width: i === 0 ? 14 : i === 4 || i === 5 ? 24 : 16,
      }));

      ws.addRows(filas);

      ws.getRow(1).font = { bold: true };
      ws.getRow(1).fill = {
        type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00897B' },
      };
      ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      ws.autoFilter = { from: 'A1', to: `K${ws.rowCount}` };

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      this.descargarBlob(blob, this.nombreArchivo('xlsx'));
      this.util.showToast('Excel exportado', 'success');
    } catch (err) {
      console.error(err);
      this.util.showToast('Error al exportar Excel', 'danger');
    } finally {
      this.exportando = '';
    }
  }

  // PDF — pdfmake
  exportarPDF() {
    if (!this.puedeVerVentas) {
      this.util.showToast('No tienes permiso para exportar ventas', 'warning');
      return;
    }
    const filas = this.filasPlanas();
    if (filas.length === 0) {
      this.util.showToast('No hay ventas para exportar', 'warning');
      return;
    }

    const body: any[] = [ENCABEZADOS.map(h => ({ text: h, style: 'th' }))];
    for (const fila of filas) {
      body.push(fila.map(c => ({ text: String(c ?? ''), style: 'td' })));
    }

    const docDefinition: any = {
      pageOrientation: 'landscape',
      pageMargins: [24, 32, 24, 32],
      content: [
        { text: 'Reporte de Ventas', style: 'header' },
        { text: `Generado: ${new Date().toLocaleString('es-CO')}`, style: 'sub' },
        { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 520, y2: 5, lineWidth: 1 }] },
        { text: `Ventas exportadas: ${this.filtradas.length} · Ítems: ${filas.length}`, style: 'sub' },
        { table: { widths: ['auto', 'auto', '*', '*', '*', '*', '*', 'auto', 'auto', 'auto', 'auto'], body }, layout: 'lightHorizontalLines' },
      ],
      styles: {
        header: { fontSize: 16, bold: true, alignment: 'center', margin: [0, 0, 0, 4] },
        sub: { fontSize: 9, alignment: 'center', margin: [0, 0, 0, 6], color: '#666666' },
        th: { fontSize: 7, bold: true, color: '#ffffff', fillColor: '#00897B' },
        td: { fontSize: 7, margin: [1, 1, 1, 1] },
      },
    };

    pdfMakeX.createPdf(docDefinition).download(this.nombreArchivo('pdf'));
    this.util.showToast('PDF exportado', 'success');
  }
}
