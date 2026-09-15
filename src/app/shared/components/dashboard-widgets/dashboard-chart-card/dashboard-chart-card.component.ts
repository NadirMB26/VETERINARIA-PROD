import { Component, Input, ViewChild, ElementRef, AfterViewInit, OnChanges, OnDestroy, NgZone, SimpleChanges, inject } from '@angular/core';
import {
  Chart,
  ChartConfiguration,
  ChartData,
  ChartType,
  registerables,
} from 'chart.js';

Chart.register(...registerables);

export interface DatasetGrafico {
  label: string;
  datos: number[];
}

@Component({
  selector: 'app-dashboard-chart-card',
  templateUrl: './dashboard-chart-card.component.html',
  styleUrls: ['./dashboard-chart-card.component.scss'],
  standalone: false
})
export class DashboardChartCardComponent implements AfterViewInit, OnChanges, OnDestroy {

  @Input() titulo = '';
  @Input() subtitulo?: string;
  @Input() tipo: 'bar' | 'line' | 'doughnut' = 'bar';
  @Input() labels: string[] = [];
  @Input() datasets: DatasetGrafico[] = [];
  @Input() altura = 260;
  @Input() totalCentro?: string;

  @ViewChild('canvasRef', { static: false }) canvasRef?: ElementRef<HTMLCanvasElement>;

  private chart?: Chart;
  private ngZone = inject(NgZone);

  private readonly paletaTokens = [
    '--app-primary', '--app-info', '--app-purple',
    '--app-warning', '--app-success', '--app-pink', '--app-danger',
  ];

  ngAfterViewInit(): void {
    this.ngZone.runOutsideAngular(() => this.crearChart());
  }

  ngOnChanges(cambios: SimpleChanges): void {
    if (!this.chart || !this.canvasRef) return;
    if (!cambios['datasets'] && !cambios['labels'] && !cambios['tipo']) return;
    this.ngZone.runOutsideAngular(() => this.actualizarChart());
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private cssVar(token: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(token).trim() || '#3B82F6';
  }

  private paleta(): string[] {
    return this.paletaTokens.map(t => this.cssVar(t));
  }

  private config(): ChartConfiguration {
    const colores = this.paleta();

    const datasets = this.datasets.map((ds, i) => {
      const color = colores[i % colores.length];

      if (this.tipo === 'bar') {
        return {
          label: ds.label,
          data: ds.datos,
          backgroundColor: color,
          borderRadius: 6,
          maxBarThickness: 28,
        };
      }

      if (this.tipo === 'line') {
        return {
          label: ds.label,
          data: ds.datos,
          borderColor: color,
          backgroundColor: `${color}26`,
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: color,
          borderWidth: 2,
        };
      }

      return {
        label: ds.label,
        data: ds.datos,
        backgroundColor: colores,
        borderColor: this.cssVar('--app-surface'),
        borderWidth: 3,
        hoverOffset: 6,
      };
    });

    const config: ChartConfiguration = {
      type: this.tipo as ChartType,
      data: { labels: this.labels, datasets } as ChartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false as any,
        layout: { padding: { top: 8 } },
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              boxWidth: 10,
              boxHeight: 10,
              usePointStyle: true,
              font: { size: 10, weight: 'bold' },
              color: this.cssVar('--app-text-2'),
            },
          },
          tooltip: {
            backgroundColor: this.cssVar('--app-text-1'),
            padding: 10,
            cornerRadius: 8,
          },
        },
        scales: this.tipo === 'doughnut' ? undefined : {
          x: {
            grid: { display: false },
            ticks: { color: this.cssVar('--app-text-3'), font: { size: 10 } },
          },
          y: {
            beginAtZero: true,
            grid: { color: `${this.cssVar('--app-border')}66` },
            ticks: {
              color: this.cssVar('--app-text-3'),
              font: { size: 10 },
              maxTicksLimit: 5,
              precision: 0,
            },
          },
        },
      },
    };

    if (this.tipo === 'doughnut') {
      (config.options as any).cutout = '74%';
    }

    return config;
  }

  private crearChart(): void {
    if (!this.canvasRef) return;
    this.chart = new Chart(this.canvasRef.nativeElement, this.config());
  }

  private actualizarChart(): void {
    if (!this.chart) return;
    const config = this.config();
    this.chart.data = config.data;
    this.chart.options = config.options as any;
    this.chart.update();
  }
}
