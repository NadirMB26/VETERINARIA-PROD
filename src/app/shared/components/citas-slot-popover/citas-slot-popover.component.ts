/**
 * @description
 * Componente de popover que muestra las citas agrupadas en un mismo slot horario.
 *
 * Se utiliza cuando múltiples citas coinciden en el mismo horario y veterinario,
 * permitiendo al usuario seleccionar una cita específica para ver su detalle
 * o crear una nueva cita en ese slot.
 *
 * @example
 * ```typescript
 * const popover = await this.popoverCtrl.create({
 *   component: CitasSlotPopoverComponent,
 *   componentProps: { citas: [cita1, cita2] }
 * });
 * ```
 */
import { Component, Input } from '@angular/core';
import { PopoverController } from '@ionic/angular';
import { Cita } from 'src/app/core/models/cita.model';

@Component({
  selector: 'app-citas-slot-popover',
  templateUrl: './citas-slot-popover.component.html',
  styleUrls: ['./citas-slot-popover.component.scss'],
  standalone: false,
})
export class CitasSlotPopoverComponent {

  /** Lista de citas que comparten el mismo slot horario. */
  @Input() citas: Cita[] = [];

  private readonly TIPO_COLORS: Record<string, string> = {
    'Consulta general': '#185FA5',
    'Vacunación': '#3B6D11',
    'Cirugía': '#A32D2D',
    'Urgencia': '#854F0B',
    'Control': '#534AB7',
  };

  /**
   * @description Constructor del componente.
   * @param popoverCtrl - Controlador de popovers de Ionic.
   */
  constructor(private popoverCtrl: PopoverController) {}

  /**
   * @description Selecciona una cita y cierra el popover.
   * @param cita - Cita seleccionada.
   */
  seleccionar(cita: Cita) {
    this.popoverCtrl.dismiss({ cita });
  }

  /**
   * @description Obtiene el color correspondiente al tipo de cita.
   * @param cita - Cita.
   * @returns Color en formato hexadecimal.
   */
  getColor(cita: Cita): string {
    return this.TIPO_COLORS[cita.tipo] ?? '#888';
  }

  /**
   * @description Obtiene la clase CSS del badge según el tipo de cita.
   * @param tipo - Tipo de cita.
   * @returns Clase CSS.
   */
  getBadgeClass(tipo: string): string {
    const map: Record<string, string> = {
      'Consulta general': 'badge-consulta',
      'Vacunación': 'badge-vacuna',
      'Cirugía': 'badge-cirugia',
      'Urgencia': 'badge-urgencia',
      'Control': 'badge-control',
    };
    return map[tipo] ?? 'badge-control';
  }

  /**
   * @description Cierra el popover sin seleccionar nada.
   */
  cerrar() {
    this.popoverCtrl.dismiss();
  }

  /**
   * @description Cierra el popover indicando que se quiere crear una nueva cita.
   */
  nuevaCita() {
    this.popoverCtrl.dismiss({ action: 'nueva' });
  }

  /**
   * @description Cierra el popover indicando que se quiere ver el día completo.
   */
  verDia() {
    this.popoverCtrl.dismiss({ action: 'verDia' });
  }

  /**
   * @description Obtiene la clase CSS del badge según el estado de la cita.
   * @param estado - Estado de la cita.
   * @returns Clase CSS.
   */
  getEstadoClass(estado?: string): string {
    const key = (estado ?? '').toLowerCase().replace(/ /g, '_').trim();
    const map: Record<string, string> = {
      pendiente: 'estado-pendiente',
      en_proceso: 'estado-proceso',
      finalizada: 'estado-finalizada',
      cancelada: 'estado-cancelada',
      no_asistio: 'estado-no-asistio',
    };
    return map[key] ?? 'estado-pendiente';
  }

  /**
   * @description Obtiene la etiqueta legible del estado de la cita.
   * @param estado - Estado de la cita.
   * @returns Etiqueta del estado en español.
   */
  getEstadoLabel(estado?: string): string {
    const key = (estado ?? '').toLowerCase().replace(/ /g, '_').trim();
    const map: Record<string, string> = {
      pendiente: 'Pendiente',
      en_proceso: 'En proceso',
      finalizada: 'Finalizada',
      cancelada: 'Cancelada',
      no_asistio: 'No asistió',
    };
    return map[key] ?? estado ?? 'Pendiente';
  }
}