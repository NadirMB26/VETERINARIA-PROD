import { saldoVenta, Venta } from 'src/app/core/models/venta.model';
import { categoriaCitaPorTipo } from 'src/app/core/models/catalogo-citas.model';
import { cubreTipoDeCita, normalizarEspecialidades } from 'src/app/core/models/especialidades.model';

function ventaBase(parcial: Partial<Venta>): Venta {
  return {
    idVenta: 'v1',
    idCliente: 'c1',
    nombreCliente: 'Cliente',
    fecha: '2026-01-01',
    metodoPago: 'credito',
    estadoPago: 'pendiente',
    items: [],
    subtotal: 100,
    total: 100,
    saldoAplicado: 0,
    abonado: 0,
    idVendedor: 'u1',
    nombreVendedor: 'Recepción',
    ...parcial,
  };
}

describe('Citas y cuentas por cobrar', () => {
  it('calcula el saldo pendiente de una venta', () => {
    expect(saldoVenta(ventaBase({ abonado: 40 }))).toBe(60);
    expect(saldoVenta(ventaBase({ estadoPago: 'pagado', abonado: 100 }))).toBe(0);
  });

  it('una venta anulada no tiene saldo cobrable', () => {
    expect(saldoVenta(ventaBase({ estadoPago: 'anulada', abonado: 30 }))).toBe(0);
  });

  it('deriva la categoría clínica desde el tipo de cita', () => {
    expect(categoriaCitaPorTipo('Vacunación')).toBe('PREVENTIVO');
    expect(categoriaCitaPorTipo('Cirugía')).toBe('QUIRURGICO');
    expect(categoriaCitaPorTipo('Urgencia')).toBe('EMERGENCIA');
    expect(categoriaCitaPorTipo('Estética')).toBe('ESTETICA');
  });

  it('ningún veterinario cubre Estética', () => {
    expect(cubreTipoDeCita(['Medicina General'], 'Estética')).toBeFalse();
  });

  it('Urgencia la cubre cualquier especialidad', () => {
    expect(cubreTipoDeCita(['Dermatología'], 'Urgencia')).toBeTrue();
  });

  it('normaliza especialidades legadas y nuevas', () => {
    expect(normalizarEspecialidades({ Especialidad: 'Cirugía, Dermatología' }))
      .toEqual(['Cirugía', 'Dermatología']);
    expect(normalizarEspecialidades({ especialidades: ['Odontología'] }))
      .toEqual(['Odontología']);
    expect(normalizarEspecialidades({})).toEqual(['Medicina General']);
  });
});
