import { Component, Input, Output, EventEmitter } from '@angular/core';
import {
  FUENTES_DISPONIBLES,
  FuenteDisponible,
  cargarFuente,
} from 'src/app/core/models/fuentes.model';

@Component({
  selector: 'app-font-picker',
  templateUrl: './font-picker.component.html',
  styleUrls: ['./font-picker.component.scss'],
  standalone: false
})
export class FontPickerComponent {

  fuentes = FUENTES_DISPONIBLES;

  /** Id de la fuente seleccionada actualmente. */
  @Input() seleccionada = 'nunito';

  @Output() seleccionChange = new EventEmitter<string>();
  @Output() restablecer = new EventEmitter<void>();

  elegir(fuente: FuenteDisponible) {
    cargarFuente(fuente);
    this.seleccionada = fuente.id;
    this.seleccionChange.emit(fuente.id);
  }

  onRestablecer() {
    this.restablecer.emit();
  }
}
