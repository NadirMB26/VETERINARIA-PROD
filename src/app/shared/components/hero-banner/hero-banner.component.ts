import { Component, Input, OnInit, OnDestroy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { BannerSlide } from 'src/app/core/models/banner.model';

@Component({
  selector: 'app-hero-banner',
  templateUrl: './hero-banner.component.html',
  styleUrls: ['./hero-banner.component.scss'],
  standalone: false
})
export class HeroBannerComponent implements OnInit, OnDestroy {

  /** Slides configurados desde el panel de administración. */
  @Input() slides: BannerSlide[] = [];

  /** Intervalo de rotación automática en milisegundos. */
  @Input() intervaloMs = 5000;

  indice = 0;
  pausado = false;

  private timer: ReturnType<typeof setInterval> | null = null;

  private router = inject(Router);

  ngOnInit() {
    this.iniciar();
  }

  ngOnDestroy() {
    this.detener();
  }

  get activos(): BannerSlide[] {
    return this.slides;
  }

  /**
   * Rotación automática: avanza un slide cada `intervaloMs` con setInterval.
   * El timer se limpia en ngOnDestroy (y al pausar) para evitar memory leaks.
   */
  private iniciar() {
    if (this.activos.length < 2 || this.pausado) return;
    this.detener();
    this.timer = setInterval(() => {
      this.avanzar();
    }, this.intervaloMs);
  }

  private detener() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Pausa al pasar el mouse/tocar; se reanuda al salir. */
  pausar() {
    this.pausado = true;
    this.detener();
  }

  reanudar() {
    this.pausado = false;
    this.iniciar();
  }

  avanzar() {
    if (this.activos.length === 0) return;
    this.indice = (this.indice + 1) % this.activos.length;
  }

  retroceder() {
    if (this.activos.length === 0) return;
    this.indice = (this.indice - 1 + this.activos.length) % this.activos.length;
  }

  irA(indice: number) {
    this.indice = indice;
  }

  abrirSlide(slide: BannerSlide) {
    if (slide.link) {
      this.router.navigate([slide.link]);
    }
  }
}
