import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-cliente-actual-panel',
  templateUrl: './cliente-actual-panel.component.html',
  styleUrls: ['./cliente-actual-panel.component.scss'],
  standalone: false
})
export class ClienteActualPanelComponent {

  /** Cliente seleccionado para la venta en curso (null si no hay). */
  @Input() cliente: any = null;

  /** Cantidad de ítems en el carrito actual. */
  @Input() cantidadItems = 0;

  @Output() seleccionar = new EventEmitter<void>();
  @Output() cambiar = new EventEmitter<void>();
  @Output() cerrar = new EventEmitter<void>();

  onSeleccionar() { this.seleccionar.emit(); }
  onCambiar() { this.cambiar.emit(); }
  onCerrar() { this.cerrar.emit(); }
}
