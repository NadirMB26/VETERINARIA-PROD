/**
 * @description
 * Componente de selector de clientes en formato popover.
 *
 * Permite buscar y seleccionar un cliente de la lista de clientes activos.
 * Se utiliza típicamente en formularios que requieren asociar una mascota
 * o cita a un cliente existente.
 *
 * @example
 * ```typescript
 * const popover = await this.popoverCtrl.create({
 *   component: ClienteSelectorComponent,
 *   componentProps: { /* opciones *\/ }
 * });
 * ```
 */
import { Component, OnInit, inject } from '@angular/core';
import { PopoverController } from '@ionic/angular';
import { UserService } from 'src/app/core/services/user.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-cliente-selector',
  templateUrl: './cliente-selector.component.html',
  styleUrls: ['./cliente-selector.component.scss'],
  standalone: false
})
export class ClienteSelectorComponent implements OnInit {

  /** Lista completa de clientes activos. */
  clientes: any[] = [];

  /** Lista de clientes filtrados según búsqueda. */
  filtrados: any[] = [];

  /** Texto de búsqueda para filtrar clientes. */
  busqueda = '';

  /** Indica si los datos están cargando. */
  cargando = true;

  private popoverCtrl = inject(PopoverController);
  private userSvc = inject(UserService);

  /**
   * @description Hook de inicialización del componente.
   */
  async ngOnInit() {
    try {
      const todos = await firstValueFrom(this.userSvc.getTodosLosUsuarios());
      this.clientes = todos.filter(u => u.rol === 'cliente');
      this.filtrados = [...this.clientes];
    } finally {
      this.cargando = false;
    }
  }

  /**
   * @description Filtra la lista de clientes según el texto de búsqueda.
   */
  filtrar() {
    const texto = this.busqueda.toLowerCase().trim();
    if (!texto) {
      this.filtrados = [...this.clientes];
      return;
    }
    this.filtrados = this.clientes.filter(c =>
      c.Nombre?.toLowerCase().includes(texto) ||
      c.Apellido?.toLowerCase().includes(texto) ||
      c.Correo?.toLowerCase().includes(texto) ||
      c.Telefono?.includes(texto)
    );
  }

  /**
   * @description Selecciona un cliente y cierra el popover.
   * @param cliente - Cliente seleccionado (o null para cerrar sin elegir).
   */
  seleccionar(cliente: any) {
    this.popoverCtrl.dismiss({ cliente });
  }

  /**
   * @description Devuelve las iniciales del nombre del cliente para el avatar.
   */
  iniciales(cliente: any): string {
    const n = (cliente.Nombre ?? '').trim();
    const a = (cliente.Apellido ?? '').trim();
    return `${n.charAt(0)}${a.charAt(0)}`.toUpperCase() || '?';
  }
}