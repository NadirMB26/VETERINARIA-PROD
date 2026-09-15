export interface PrivilegiosRecepcionista {
  crearUsuarios: boolean;
  editarUsuarios: boolean;
  verUsuarios: boolean;
  crearMascotas: boolean;
  editarMascotas: boolean;
  verMascotas: boolean;
  crearCitas: boolean;
  cancelarCitas: boolean;
  reprogramarCitas: boolean;
  verCitas: boolean;
  crearVentas: boolean;
  verVentas: boolean;
}

export interface PrivilegiosVeterinario {
  verCitasAsignadas: boolean;
  diagnosticarCitas: boolean;
  verHistorialMascota: boolean;
}

export interface PrivilegiosCliente {}
export interface PrivilegiosAdministrador {}
export interface PrivilegiosGroomer {}

export type Privilegios =
  | (PrivilegiosRecepcionista & { rol: 'recepcionista'; uid: string })
  | (PrivilegiosVeterinario & { rol: 'veterinario'; uid: string })
  | (PrivilegiosCliente & { rol: 'cliente'; uid: string })
  | (PrivilegiosGroomer & { rol: 'groomer'; uid: string })
  | (PrivilegiosAdministrador & { rol: 'administrador'; uid: string });

export function getPrivilegiosDefault(rol: string, uid: string): Privilegios {
  switch (rol) {
    case 'recepcionista':
      return {
        uid, rol: 'recepcionista',
        crearUsuarios: true, editarUsuarios: true, verUsuarios: true,
        crearMascotas: true, editarMascotas: true, verMascotas: true,
        crearCitas: true, cancelarCitas: true, reprogramarCitas: true, verCitas: true,
        crearVentas: true, verVentas: true,
      };
    case 'veterinario':
      return {
        uid, rol: 'veterinario',
        verCitasAsignadas: true, diagnosticarCitas: true, verHistorialMascota: true,
      };
    case 'cliente':
      return { uid, rol: 'cliente' };
    case 'groomer':
      return { uid, rol: 'groomer' };
    case 'administrador':
    default:
      return { uid, rol: 'administrador' };
  }
}
