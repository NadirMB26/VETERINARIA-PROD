import { NavigationService } from './navigation.service';

describe('NavigationService', () => {
  let service: NavigationService;

  beforeEach(() => {
    service = new NavigationService();
  });

  it('muestra solo la agenda propia a veterinario y groomer', () => {
    const menuVet = service.construirMenu('veterinario', { verHistorialMascota: true, verCitasAsignadas: true });
    const menuGroomer = service.construirMenu('groomer', {});

    const vetVeAgenda = menuVet.find(i => i.label === 'Diagnosticar Citas')?.visible;
    const groomerVeServicios = menuGroomer.find(i => i.label === 'Mis servicios')?.visible;

    expect(vetVeAgenda).toBeTrue();
    expect(groomerVeServicios).toBeTrue();
    expect(menuGroomer.find(i => i.label === 'Usuarios')?.visible).toBeFalse();
    expect(menuGroomer.find(i => i.label === 'Cobranza')?.visible).toBeFalse();
  });

  it('el groomer no accede a expediente clínico ni ventas', () => {
    const perm = service.calcularPermisos('groomer', {});

    expect(perm.puedeVerMascotas).toBeFalse();
    expect(perm.puedeVerCitas).toBeFalse();
    expect(perm.puedeVerVentas).toBeFalse();
    expect(perm.puedeVerEstetica).toBeTrue();
  });

  it('respeta privilegios de recepción para ventas y citas', () => {
    const sinPrivilegios = service.calcularPermisos('recepcionista', {});
    const conPrivilegios = service.calcularPermisos('recepcionista', {
      crearVentas: true,
      verVentas: true,
      verCitas: true,
      verMascotas: true,
    });

    expect(sinPrivilegios.puedeVender).toBeFalse();
    expect(conPrivilegios.puedeVender).toBeTrue();
    expect(conPrivilegios.puedeVerCitas).toBeTrue();
    expect(conPrivilegios.puedeVerMascotas).toBeTrue();
  });

  it('el cliente solo ve su inicio, mascotas, citas y compras', () => {
    const menu = service.construirMenu('cliente', {});
    const visibles = menu.filter(i => i.visible).map(i => i.label);

    expect(visibles).toContain('Mis Compras');
    expect(visibles).not.toContain('Usuarios');
    expect(visibles).not.toContain('Cobranza');
  });
});
