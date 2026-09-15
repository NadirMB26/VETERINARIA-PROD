import { Component, Input } from '@angular/core';

export interface KpiCard {
  label: string;
  titulo: string;
  valor: string;
  icono: string;
  color: 'primary' | 'success' | 'warning' | 'info' | 'purple' | 'pink';
  variacion?: number;
  variacionSufijo?: string;
  fuente?: string;
  sparkline?: number[];
}

@Component({
  selector: 'app-dashboard-kpi-card',
  templateUrl: './dashboard-kpi-card.component.html',
  styleUrls: ['./dashboard-kpi-card.component.scss'],
  standalone: false
})
export class DashboardKpiCardComponent {

  @Input() kpi!: KpiCard;

  get tieneVariacion(): boolean {
    return this.kpi.variacion !== undefined && this.kpi.variacion !== null;
  }

  get absVariacion(): number {
    return Math.abs(this.kpi.variacion ?? 0);
  }

  get variacionClase(): string {
    const v = this.kpi.variacion ?? 0;
    if (v > 0) return 'kpi-card__variacion--up';
    if (v < 0) return 'kpi-card__variacion--down';
    return 'kpi-card__variacion--flat';
  }

  get variacionIcono(): string {
    const v = this.kpi.variacion ?? 0;
    if (v > 0) return 'arrow-up-outline';
    if (v < 0) return 'arrow-down-outline';
    return 'remove-outline';
  }

  get sparkClase(): string {
    const v = this.kpi.variacion ?? 0;
    if (v > 0) return 'kpi-card__spark--up';
    if (v < 0) return 'kpi-card__spark--down';
    return 'kpi-card__spark--flat';
  }

  puntosSparkline(): string {
    const s = this.kpi.sparkline ?? [];
    if (s.length < 2) return '';
    const max = Math.max(...s);
    const min = Math.min(...s);
    const rango = max - min || 1;
    const w = 100;
    const h = 30;
    return s.map((v, i) => {
      const x = (i / (s.length - 1)) * w;
      const y = h - 4 - ((v - min) / rango) * (h - 10);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }
}
