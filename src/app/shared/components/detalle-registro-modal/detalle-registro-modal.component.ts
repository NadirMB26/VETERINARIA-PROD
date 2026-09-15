/**
 * @description
 * Modal de detalle de una nota clínica (RegistroClínico, Fase 1/3).
 *
 * Sustituye la vista "a pantalla completa" de la Historia del paciente:
 * se abre desde cualquier pestaña del expediente al pulsar 👁 y muestra el
 * contenido completo según la categoría. Para staff incluye: PDF, envío por
 * correo y edición (corrección con motivo, vía DiagnosticoModalComponent).
 */
import { Component, Input, inject } from '@angular/core';
import { ModalController, LoadingController } from '@ionic/angular';
import {
  RegistroClinico,
  CATEGORIAS_CLINICAS,
  CategoriaClinica,
} from 'src/app/core/models/registro-clinico.model';
import { Cita } from 'src/app/core/models/cita.model';
import { RegistroClinicoService } from 'src/app/core/services/registro-clinico.service';
import { DiagnosticoModalComponent } from '../diagnostico-modal/diagnostico-modal.component';
import { UtilidadesService } from 'src/app/core/services/utilidades.service';
import { AuthService } from 'src/app/core/services/auth.service';
import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';

const pdfMakeX = pdfMake as any;
const pdfFontsX = pdfFonts as any;
pdfMakeX.vfs = pdfFontsX.pdfMake ? pdfFontsX.pdfMake.vfs : pdfFontsX.vfs;

@Component({
  selector: 'app-detalle-registro-modal',
  templateUrl: './detalle-registro-modal.component.html',
  styleUrls: ['./detalle-registro-modal.component.scss'],
  standalone: false,
})
export class DetalleRegistroModalComponent {

  /** Registro clínico a mostrar. */
  @Input() registro!: RegistroClinico;

  /** Cita que originó el registro (si existe). */
  @Input() cita: Cita | null = null;

  /** Resumen de la mascota para el encabezado del PDF. */
  @Input() mascotaResumen: { nombre?: string; especie?: string; raza?: string; sexo?: string } | null = null;

  /** Edición (corrección con motivo) permitida para el veterinario. */
  @Input() habilitarEdicion = true;

  private modalCtrl = inject(ModalController);
  private loadingCtrl = inject(LoadingController);
  private registroSvc = inject(RegistroClinicoService);
  private util = inject(UtilidadesService);
  private auth = inject(AuthService);

  get rolActual(): string {
    return this.auth.getRolActual() ?? '';
  }

  get esStaff(): boolean {
    return ['administrador', 'recepcionista', 'veterinario'].includes(this.rolActual);
  }

  /** Solo el veterinario con privilegio corrige; requiere cita para abrir el flujo. */
  get puedeEditar(): boolean {
    return this.habilitarEdicion
      && this.rolActual === 'veterinario'
      && this.auth.tienePrivilegio('diagnosticarCitas')
      && !!this.cita
      && this.cita!.estado !== 'cancelada'
      && this.cita!.estado !== 'no_asistio';
  }

  get categoria(): CategoriaClinica | null {
    return this.registro?.categoria ?? null;
  }

  get labelCategoria(): string {
    return this.categoria ? (CATEGORIAS_CLINICAS[this.categoria]?.label ?? this.categoria) : '';
  }

  get colorCategoria(): string {
    return this.categoria ? (CATEGORIAS_CLINICAS[this.categoria]?.color ?? 'medium') : 'medium';
  }

  get fechaDisplay(): string {
    const iso = this.registro?.fechaRegistro;
    return this.cita?.fecha ?? (iso ? this.formatearFecha(iso) : '');
  }

  formatearFecha(iso: string): string {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  async editar() {
    if (!this.puedeEditar || !this.cita) return;

    const modal = await this.modalCtrl.create({
      component: DiagnosticoModalComponent,
      componentProps: {
        cita: this.cita,
        nombreVeterinario: this.registro?.nombreVeterinario ?? this.cita.nombreVeterinario,
        soloLectura: false,
      },
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      backdropDismiss: false,
      cssClass: 'modal-diagnostico-desktop',
    });
    await modal.present();
    const { data } = await modal.onWillDismiss();

    if (data?.guardado) {
      // Refresca el registro local para reflejar la corrección auditada.
      const refrescado = await this.registroSvc.getRegistroOnce(this.registro.idRegistro);
      if (refrescado) this.registro = refrescado;
      await this.util.showToast('Corrección guardada y auditada', 'success');
    }
  }

  generarPDF() {
    if (!this.registro) return;
    const r = this.registro;
    const m = this.mascotaResumen ?? {};

    const docDefinition: any = {
      content: [
        { text: 'Reporte Médico Veterinario', style: 'header' },
        { text: `Fecha: ${this.fechaDisplay}`, style: 'subheader' },
        { text: `Atendido por: Dr/Dra. ${r.nombreVeterinario || '—'}`, style: 'subheader' },
        { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 1 }] },
        { text: '\nDatos del Paciente', style: 'sectionHeader' },
        { text: `Nombre: ${m.nombre ?? ''} · Especie/Raza: ${m.especie ?? ''} ${m.raza ?? ''} · Sexo: ${m.sexo ?? ''}` },
        { text: '\nDetalles Clínicos', style: 'sectionHeader' },
        { text: `Categoría: ${this.labelCategoria}`, bold: true, margin: [0, 5, 0, 2] },
        { text: 'Anamnesis:', bold: true, margin: [0, 10, 0, 2] },
        { text: r.anamnesis || 'No registrado' },
        ...(r.examenFisico ? [
          { text: 'Examen físico:', bold: true, margin: [0, 10, 0, 2] },
          { text: r.examenFisico },
        ] : []),
        { text: 'Diagnóstico:', bold: true, margin: [0, 10, 0, 2] },
        { text: r.diagnostico || 'No registrado' },
        { text: 'Tratamiento:', bold: true, margin: [0, 10, 0, 2] },
        { text: r.tratamiento || 'No registrado' },
        { text: 'Medicamentos:', bold: true, margin: [0, 10, 0, 2] },
        { text: r.medicamentos || 'Ninguno' },
        { text: 'Observaciones:', bold: true, margin: [0, 10, 0, 2] },
        { text: r.observaciones || 'Ninguna' },
        ...(r.motivoUltimaCorreccion ? [
          { text: '\nÚltima corrección:', bold: true, margin: [0, 10, 0, 2] },
          { text: r.motivoUltimaCorreccion },
        ] : []),
      ],
      styles: {
        header: { fontSize: 20, bold: true, alignment: 'center', margin: [0, 0, 0, 10] },
        subheader: { fontSize: 12, alignment: 'center', margin: [0, 0, 0, 5] },
        sectionHeader: { fontSize: 14, bold: true, color: '#3880ff', margin: [0, 10, 0, 5] }
      }
    };

    pdfMakeX.createPdf(docDefinition).download(`Reporte_${(m.nombre ?? 'mascota').replace(/\s+/g, '_')}_${this.fechaDisplay.replace(/\//g, '-')}.pdf`);
  }

  enviarPorCorreo() {
    const r = this.registro;
    const m = this.mascotaResumen ?? {};
    const cuerpo = [
      `Reporte médico de ${m.nombre ?? ''}`,
      `Fecha: ${this.fechaDisplay}`,
      `Atendido por: ${r.nombreVeterinario || '—'}`,
      `Categoría: ${this.labelCategoria}`,
      '',
      `Anamnesis: ${r.anamnesis || '—'}`,
      r.examenFisico ? `Examen físico: ${r.examenFisico}` : null,
      `Diagnóstico: ${r.diagnostico || '—'}`,
      `Tratamiento: ${r.tratamiento || '—'}`,
      r.medicamentos ? `Medicamentos: ${r.medicamentos}` : null,
      r.observaciones ? `Observaciones: ${r.observaciones}` : null,
      r.motivoUltimaCorreccion ? `Última corrección: ${r.motivoUltimaCorreccion}` : null,
    ].filter(Boolean).join('\n');

    window.location.href = `mailto:?subject=${encodeURIComponent(`Reporte médico · ${m.nombre ?? ''}`)}&body=${encodeURIComponent(cuerpo)}`;
  }

  cerrar() {
    this.modalCtrl.dismiss();
  }
}
