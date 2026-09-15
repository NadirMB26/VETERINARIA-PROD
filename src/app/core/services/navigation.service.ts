import { Injectable } from '@angular/core';

export interface ItemNavegacion {
  label?: string;
  icon: string;
  ruta?: string;
  href?: string;
  tab?: string;
  seccion?: string;
  visible: boolean;
}

export interface PermisosNavegacion {
  esAdmin: boolean;
  esRecepcionista: boolean;
  esVeterinario: boolean;
  esGroomer: boolean;
  esCliente: boolean;
  esStaff: boolean;
  puedeVerUsuarios: boolean;
  puedeVerMascotas: boolean;
  puedeVerCitas: boolean;
  puedeVerHistorial: boolean;
  puedeVender: boolean;
  puedeVerVentas: boolean;
  puedeVerEstetica: boolean;
}

@Injectable({ providedIn: 'root' })
export class NavigationService {

  calcularPermisos(rol: string, privilegios: any): PermisosNavegacion {
    const p = privilegios ?? {};
    const esAdmin = rol === 'administrador';
    const esRecepcionista = rol === 'recepcionista';
    const esVeterinario = rol === 'veterinario';
    const esGroomer = rol === 'groomer';
    const esCliente = rol === 'cliente';
    const esStaff = esAdmin || esRecepcionista || esVeterinario;

    return {
      esAdmin, esRecepcionista, esVeterinario, esGroomer, esCliente, esStaff,
      puedeVerUsuarios: esAdmin || (esRecepcionista && !!p['verUsuarios']),
      puedeVerMascotas: esAdmin
        || (esRecepcionista && !!p['verMascotas'])
        || (esVeterinario && !!p['verHistorialMascota'])
        || esCliente,
      puedeVerCitas: esAdmin
        || (esRecepcionista && !!p['verCitas'])
        || (esVeterinario && !!p['verCitasAsignadas'])
        || esCliente,
      puedeVerHistorial: esAdmin || (esVeterinario && !!p['verHistorialMascota']),
      puedeVender: esAdmin || (esRecepcionista && !!p['crearVentas']),
      puedeVerVentas: esAdmin || (esRecepcionista && !!p['verVentas']),
      puedeVerEstetica: esGroomer,
    };
  }

  construirMenu(rol: string, privilegios: any): ItemNavegacion[] {
    const perm = this.calcularPermisos(rol, privilegios);

    return [
      { label: 'Inicio', icon: 'home-outline', ruta: '/layout/dashboard', seccion: 'General', visible: perm.esStaff },
      { label: 'Inicio', icon: 'home-outline', ruta: '/layout/cliente-home', seccion: 'General', visible: perm.esCliente },
      { label: 'Diagnosticar Citas', icon: 'home-outline', ruta: '/layout/veterinario-home', seccion: 'General', visible: perm.esVeterinario },
      { label: 'Mis servicios', icon: 'cut-outline', ruta: '/layout/groomer-home', seccion: 'General', visible: perm.puedeVerEstetica },
      { label: 'Usuarios', icon: 'people-outline', ruta: '/layout/usuarios', seccion: 'Administración', visible: perm.puedeVerUsuarios },
      { label: 'Configuración de la App', icon: 'settings-outline', ruta: '/layout/configuracion-app', seccion: 'Administración', visible: perm.esAdmin },
      { label: 'Mascotas', icon: 'paw-outline', ruta: '/layout/mascotas', seccion: 'Pacientes y Agenda', visible: perm.puedeVerMascotas },
      { label: 'Citas', icon: 'calendar-outline', ruta: '/layout/citas', seccion: 'Pacientes y Agenda', visible: perm.puedeVerCitas },
      { label: 'Productos', icon: 'cube-outline', ruta: '/layout/productos', seccion: 'Catálogo y Ventas', visible: perm.puedeVender },
      { label: 'Servicios', icon: 'fitness-outline', ruta: '/layout/servicios', seccion: 'Catálogo y Ventas', visible: perm.puedeVender },
      { label: 'Ventas', icon: 'cart-outline', ruta: '/layout/ventas', seccion: 'Catálogo y Ventas', visible: perm.puedeVender },
      { label: 'Historial de Ventas', icon: 'receipt-outline', ruta: '/layout/historial-ventas', seccion: 'Catálogo y Ventas', visible: perm.puedeVerVentas },
      { label: 'Cobranza', icon: 'cash-outline', ruta: '/layout/cobranza', seccion: 'Catálogo y Ventas', visible: perm.puedeVerVentas },
      { label: 'Mis Compras', icon: 'bag-check-outline', ruta: '/layout/mis-compras', seccion: 'Catálogo y Ventas', visible: perm.esCliente },
      { label: 'Reportes', icon: 'bar-chart-outline', ruta: '/layout/reportes', seccion: 'Reportes y Administración', visible: perm.puedeVerVentas },
    ];
  }

  construirTabs(rol: string, privilegios: any): ItemNavegacion[] {
    const perm = this.calcularPermisos(rol, privilegios);

    return [
      { tab: 'dashboard', href: '/layout/dashboard', icon: 'home-outline', label: 'Inicio', visible: perm.esStaff },
      { tab: 'groomer-home', href: '/layout/groomer-home', icon: 'cut-outline', label: 'Servicios', visible: perm.puedeVerEstetica },
      { tab: 'cliente-home', href: '/layout/cliente-home', icon: 'home-outline', label: 'Inicio', visible: perm.esCliente },
      { tab: 'usuarios', href: '/layout/usuarios', icon: 'people-outline', label: 'Usuarios', visible: perm.puedeVerUsuarios },
      { tab: 'mascotas', href: '/layout/mascotas', icon: 'paw-outline', label: 'Mascotas', visible: perm.puedeVerMascotas },
      { tab: 'citas', href: '/layout/citas', icon: 'calendar-outline', label: 'Citas', visible: perm.puedeVerCitas },
    ].filter(t => t.visible);
  }
}
