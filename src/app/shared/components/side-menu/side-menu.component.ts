import { Component, Input, Output, EventEmitter, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { ConfiguracionAppService } from 'src/app/core/services/configuracion-app.service';
import { ConfiguracionApp } from 'src/app/core/models/configuracion-app.model';

@Component({
  selector: 'app-side-menu',
  templateUrl: './side-menu.component.html',
  styleUrls: ['./side-menu.component.scss'],
  standalone: false
})
export class SideMenuComponent implements OnInit, OnDestroy {

  @Input() uid = '';

  @Input() nombreUsuario = '';

  @Input() fotoUrl = '';

  @Input() rol = '';

  @Input() menuItems: any[] = [];

  @Output() logoutEvent = new EventEmitter<void>();

  @Output() irConfiguracion = new EventEmitter<void>();

  configuracion: ConfiguracionApp | null = null;

  private configSub?: Subscription;

  constructor(private configSvc: ConfiguracionAppService) {}

  ngOnInit(): void {
    this.configSub = this.configSvc.config$.subscribe(cfg => {
      this.configuracion = cfg ?? null;
    });
  }

  ngOnDestroy(): void {
    this.configSub?.unsubscribe();
  }

  get iniciales(): string {
    const partes = this.nombreUsuario.trim().split(' ');
    return (partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '');
  }

  get secciones(): string[] {
    return [...new Set(
      this.menuItems
        .filter(item => item.visible && item.seccion)
        .map(item => item.seccion!)
    )];
  }

  menuItemsSeccion(seccion: string): any[] {
    return this.menuItems.filter(item => item.visible && item.seccion === seccion);
  }

  logout() {
    this.logoutEvent.emit();
  }

  irAConfiguracion() {
    this.irConfiguracion.emit();
  }
}
