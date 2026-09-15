import { Component, Input, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { formatearTiempoRestante } from 'src/app/core/models/producto.model';

@Component({
  selector: 'app-countdown',
  templateUrl: './countdown.component.html',
  styleUrls: ['./countdown.component.scss'],
  standalone: false
})
export class CountdownComponent implements OnInit, OnDestroy {

  /** Fecha ISO (YYYY-MM-DD) en que termina la oferta. */
  @Input() fechaFin = '';

  /** Se dispara cuando el tiempo restante llega a 0 (la oferta expiró). */
  @Output() expirada = new EventEmitter<void>();

  texto = '';
  expirado = false;

  private timer: ReturnType<typeof setInterval> | null = null;

  ngOnInit() {
    // Se actualiza cada segundo con setInterval y se limpia en ngOnDestroy
    // para evitar memory leaks.
    this.tick();
    this.timer = setInterval(() => this.tick(), 1000);
  }

  ngOnDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private tick() {
    if (!this.fechaFin) return;
    const fin = new Date(this.fechaFin + 'T23:59:59');
    if (fin.getTime() - Date.now() <= 0) {
      if (!this.expirado) {
        this.expirado = true;
        this.texto = '';
        this.expirada.emit();
      }
      return;
    }
    this.texto = formatearTiempoRestante(this.fechaFin);
  }
}
