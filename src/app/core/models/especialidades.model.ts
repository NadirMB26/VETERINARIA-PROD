/**
 * @description
 * Catálogo de especialidades veterinarias y su relación con los tipos de
 * cita (corrección Fase 4b). Reemplaza la especialidad de texto libre por
 * selección múltiple ligada a qué citas puede atender cada veterinario.
 */

export const ESPECIALIDADES_VETERINARIO: string[] = [
  'Medicina General',
  'Medicina Interna',
  'Cirugía',
  'Dermatología',
  'Odontología',
  'Prevención y Vacunación',
  'Urgencias y Emergencias',
];

/**
 * Compatibilidad tipo de cita → especialidades que lo cubren.
 * `'*'` significa que cualquier especialidad lo cubre.
 */
export const COMPATIBILIDAD_TIPO_ESPECIALIDAD: Record<string, string[] | '*'> = {
  'Consulta general': ['Medicina General', 'Medicina Interna'],
  Vacunación: ['Prevención y Vacunación', 'Medicina General'],
  Cirugía: ['Cirugía', 'Medicina General'],
  Urgencia: '*',
  Control: ['Prevención y Vacunación', 'Medicina General'],
  Otro: '*',
  // Estética la atiende un groomer, nunca un veterinario.
  Estética: [],
};

/**
 * @description Normaliza las especialidades de un documento de veterinario.
 * Acepta el campo nuevo `especialidades` (array) o el legado `Especialidad`
 * (texto separado por comas). Si no coincide con el catálogo o está vacío,
 * devuelve ['Medicina General'] para que el profesional pueda seguir
 * agendando (fallback "General").
 */
export function normalizarEspecialidades(vet: any): string[] {
  const fuente = Array.isArray(vet?.especialidades)
    ? vet.especialidades
    : typeof vet?.Especialidad === 'string'
      ? vet.Especialidad.split(',').map((s: string) => s.trim())
      : [];

  const limpias = fuente.filter((e: string) => ESPECIALIDADES_VETERINARIO.includes(e));
  return limpias.length ? limpias : ['Medicina General'];
}

/**
 * @description Indica si un veterinario (por sus especialidades) puede
 * atender un tipo de cita.
 */
export function cubreTipoDeCita(especialidades: string[], tipo: string): boolean {
  if (tipo === 'Estética') return false;

  const compat = COMPATIBILIDAD_TIPO_ESPECIALIDAD[tipo];
  if (compat === undefined || compat === '*') return true;
  return especialidades.some(e => compat.includes(e));
}
