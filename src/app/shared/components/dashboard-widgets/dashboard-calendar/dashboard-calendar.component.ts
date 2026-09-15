import { Component, Input, OnInit } from '@angular/core';

export interface EventoCalendario {
  fecha: string;
  cantidad: number;
}

@Component({
  selector: 'app-dashboard-calendar',
  templateUrl: './dashboard-calendar.component.html',
  styleUrls: ['./dashboard-calendar.component.scss'],
  standalone: false
})
export class DashboardCalendarComponent implements OnInit {

  @Input() eventos: EventoCalendario[] = [];

  mes = new Date();
  readonly diasSemana = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];

  ngOnInit(): void {
    this.mes = this.inicioMes(new Date());
  }

  get etiquetaMes(): string {
    return this.mes.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
      .replace(/^./, c => c.toUpperCase());
  }

  get celdas(): (Date | null)[] {
    const anio = this.mes.getFullYear();
    const mesNum = this.mes.getMonth();
    const offset = (new Date(anio, mesNum, 1).getDay() + 6) % 7;
    const totalDias = new Date(anio, mesNum + 1, 0).getDate();
    const celdas: (Date | null)[] = Array(offset).fill(null);
    for (let d = 1; d <= totalDias; d++) {
      celdas.push(new Date(anio, mesNum, d));
    }
    return celdas;
  }

  cantidadDe(fecha: Date): number {
    const clave = this.fmt(fecha);
    return this.eventos.find(e => e.fecha === clave)?.cantidad ?? 0;
  }

  esHoy(fecha: Date): boolean {
    return this.fmt(fecha) === this.fmt(new Date());
  }

  esMesActual(): boolean {
    const ahora = new Date();
    return this.mes.getFullYear() === ahora.getFullYear() && this.mes.getMonth() === ahora.getMonth();
  }

  mesAnterior() {
    this.mes = new Date(this.mes.getFullYear(), this.mes.getMonth() - 1, 1);
  }

  mesSiguiente() {
    this.mes = new Date(this.mes.getFullYear(), this.mes.getMonth() + 1, 1);
  }

  volverHoy() {
    this.mes = this.inicioMes(new Date());
  }

  private inicioMes(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  private fmt(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
