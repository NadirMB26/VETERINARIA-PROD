/**
 * @description
 * Genera la factura PDF de una venta con pdfmake.
 * Reutiliza el patrón de fuentes ya usado en historial-ventas.
 */
import { Injectable, inject } from '@angular/core';
import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import { Venta, getMetodoPagoInfo, saldoVenta } from '../models/venta.model';
import { ConfiguracionApp } from '../models/configuracion-app.model';

const pdfMakeX = pdfMake as any;
const pdfFontsX = pdfFonts as any;
pdfMakeX.vfs = pdfFontsX.pdfMake ? pdfFontsX.pdfMake.vfs : pdfFontsX.vfs;

const dinero = (n: number): string => `$${n.toLocaleString('es-CO')}`;

@Injectable({ providedIn: 'root' })
export class FacturaService {

  /** Genera el blob PDF de la factura (para habilitar el botón de descarga). */
  generarBlob(venta: Venta, cfg: ConfiguracionApp | null): Promise<Blob> {
    const doc = this.construirDocumento(venta, cfg);
    return pdfMakeX.createPdf(doc).getBlob() as Promise<Blob>;
  }

  /** Genera el PDF de la factura y lo descarga. */
  descargarFactura(venta: Venta, cfg: ConfiguracionApp | null) {
    const doc = this.construirDocumento(venta, cfg);
    pdfMakeX.createPdf(doc).download(`factura-${venta.idVenta}.pdf`);
  }

  private construirDocumento(venta: Venta, cfg: ConfiguracionApp | null): any {
    const nombre = cfg?.nombre || 'Veterinaria Canes';
    const subnombre = cfg?.subnombre || 'Clínica Veterinaria';
    const color = cfg?.logoColor || '#00897B';

    const cuerpoItems = venta.items.map(it => [
      { text: it.nombre, style: 'td' },
      { text: `${it.cantidad}`, style: 'td', alignment: 'center' },
      { text: dinero(it.precioUnitario), style: 'td', alignment: 'right' },
      { text: dinero(it.subtotal), style: 'td', alignment: 'right' },
    ]);

    const totalPagos = venta.pagos?.reduce((acc, p) => acc + (p.monto ?? 0), 0) ?? venta.abonado ?? 0;

    const cuerpoPagos = (venta.pagos?.length
      ? venta.pagos.map(p => {
          const vuelto = p.metodoPago === 'efectivo' && p.recibido
            ? Math.max(0, p.recibido - p.monto)
            : 0;
          const vueltoTexto = vuelto > 0
            ? `${dinero(vuelto)}${p.vueltoDestino === 'saldo' ? ' (saldo a favor)' : ''}`
            : '—';
          return [
            { text: getMetodoPagoInfo(p.metodoPago).nombre, style: 'td' },
            { text: dinero(p.monto), style: 'td', alignment: 'right' },
            { text: p.recibido ? dinero(p.recibido) : '—', style: 'td', alignment: 'right' },
            { text: vueltoTexto, style: 'td', alignment: 'right' },
          ];
        })
      : [[
          { text: getMetodoPagoInfo(venta.metodoPago).nombre, style: 'td' },
          { text: dinero(totalPagos), style: 'td', alignment: 'right' },
          { text: '—', style: 'td', alignment: 'right' },
          { text: '—', style: 'td', alignment: 'right' },
        ]]);

    const saldoPendiente = saldoVenta(venta);

    return {
      pageSize: 'A4',
      pageMargins: [36, 40, 36, 40],
      content: [
        // ── Encabezado ──
        {
          columns: [
            {
              width: '*',
              stack: [
                { text: nombre, style: 'nombreClinica' },
                { text: subnombre, style: 'subClinica' },
              ],
            },
            {
              width: 'auto',
              stack: [
                { text: 'FACTURA', style: 'tituloFactura', color },
                { text: `No. ${venta.idVenta.slice(0, 8).toUpperCase()}`, style: 'numFactura' },
              ],
              alignment: 'right',
            },
          ],
        },
        { canvas: [{ type: 'line', x1: 0, y1: 6, x2: 520, y2: 6, lineWidth: 2, lineColor: color }], margin: [0, 6, 0, 14] },

        // ── Datos generales ──
        {
          columns: [
            {
              width: '*',
              stack: [
                { text: 'Cliente', style: 'label' },
                { text: venta.nombreCliente, style: 'valor' },
                venta.nombreMascota ? { text: `Mascota: ${venta.nombreMascota}`, style: 'valor' } : {},
              ],
            },
            {
              width: 'auto',
              stack: [
                { text: 'Fecha', style: 'label', alignment: 'right' },
                { text: new Date(venta.fecha).toLocaleString('es-CO'), style: 'valor', alignment: 'right' },
                { text: `Atendido por: ${venta.nombreVendedor}`, style: 'valor', alignment: 'right' },
              ],
            },
          ],
        },
        { text: ' ', fontSize: 4 },

        // ── Ítems ──
        { text: 'Detalle de la compra', style: 'seccion' },
        {
          table: {
            widths: ['*', 50, 90, 90],
            headerRows: 1,
            body: [
              [
                { text: 'Producto / Servicio', style: 'th' },
                { text: 'Cant.', style: 'th', alignment: 'center' },
                { text: 'Precio', style: 'th', alignment: 'right' },
                { text: 'Subtotal', style: 'th', alignment: 'right' },
              ],
              ...cuerpoItems,
            ],
          },
          layout: 'lightHorizontalLines',
        },

        // ── Totales ──
        {
          columns: [
            { width: '*', text: '' },
            {
              width: 240,
              stack: [
                { columns: [{ text: 'Subtotal', style: 'totalLabel' }, { text: dinero(venta.subtotal), style: 'totalValor', alignment: 'right' }] },
                ...(venta.saldoAplicado > 0 ? [
                  { columns: [{ text: 'Saldo a favor aplicado', style: 'totalLabel' }, { text: `− ${dinero(venta.saldoAplicado)}`, style: 'totalValor', alignment: 'right' }] },
                ] : []),
                { canvas: [{ type: 'line', x1: 0, y1: 3, x2: 240, y2: 3, lineWidth: 0.7 }], margin: [0, 4, 0, 4] },
                { columns: [{ text: 'TOTAL', style: 'totalGrande', bold: true }, { text: dinero(venta.total), style: 'totalGrande', alignment: 'right', bold: true, color }] },
                ...(saldoPendiente > 0 ? [
                  { text: `Saldo pendiente: ${dinero(saldoPendiente)}`, style: 'pendiente', alignment: 'right' },
                ] : []),
              ],
            },
          ],
        },
        { text: ' ', fontSize: 4 },

        // ── Pagos ──
        { text: 'Pagos', style: 'seccion' },
        {
          table: {
            widths: ['*', 80, 80, 80],
            headerRows: 1,
            body: [
              [
                { text: 'Método', style: 'th' },
                { text: 'Monto', style: 'th', alignment: 'right' },
                { text: 'Recibido', style: 'th', alignment: 'right' },
                { text: 'Vuelto', style: 'th', alignment: 'right' },
              ],
              ...cuerpoPagos,
            ],
          },
          layout: 'lightHorizontalLines',
        },

        { text: ' ', fontSize: 8 },
        { text: '¡Gracias por su compra!', style: 'pie' },
      ],
      styles: {
        nombreClinica: { fontSize: 18, bold: true, color: '#1F2937' },
        subClinica: { fontSize: 10, color: '#6B7280', margin: [0, 2, 0, 0] },
        tituloFactura: { fontSize: 15, bold: true, alignment: 'right' },
        numFactura: { fontSize: 10, color: '#6B7280', alignment: 'right', margin: [0, 2, 0, 0] },
        label: { fontSize: 9, color: '#6B7280', margin: [0, 0, 0, 2] },
        valor: { fontSize: 11, color: '#1F2937', margin: [0, 0, 0, 2] },
        seccion: { fontSize: 12, bold: true, color: '#1F2937', margin: [0, 8, 0, 6] },
        th: { fontSize: 9, bold: true, color: '#ffffff', fillColor: color, margin: [2, 3, 2, 3] },
        td: { fontSize: 10, margin: [2, 3, 2, 3] },
        totalLabel: { fontSize: 10, color: '#374151' },
        totalValor: { fontSize: 10, color: '#374151' },
        totalGrande: { fontSize: 14, color: '#111827' },
        pendiente: { fontSize: 10, bold: true, color: '#B45309', margin: [0, 3, 0, 0] },
        pie: { fontSize: 11, alignment: 'center', color: '#6B7280', margin: [0, 6, 0, 0] },
      },
    };
  }
}
