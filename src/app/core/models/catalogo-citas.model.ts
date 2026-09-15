/**
 * @description
 * Catálogo único de tipos de cita (Fase 0).
 *
 * Une el tipo de cita del modal de agenda con:
 *  - la pestaña del expediente donde se muestra su historial (Fase 3),
 *  - la categoría clínica del RegistroClínico (Fase 1),
 *  - si genera registro clínico o es operativo (Estética → Fase 2),
 *  - los campos condicionales del formulario de cita (Fases 2/3),
 *  - el color visual con el que se identifica en la agenda.
 *
 * Agregar un tipo nuevo es agregar una entrada aquí, no código repetido.
 */
import { CategoriaClinica } from './registro-clinico.model';

/** Campos opcionales que un tipo de cita puede requerir en el formulario. */
export type CampoCondicionalCita =
  /** ¿Servicio a domicilio? */
  | 'servicioDomicilio'
  /** Repetir cita */
  | 'repetirCita'
  /** Tipo de servicio (solo Estética). */
  | 'tipoServicio'
  /** Asignar groomer en vez de veterinario (solo Estética). */
  | 'asignarGroomer';

export interface ItemCatalogoTipoCita {
  /** Valor exacto almacenado en `citas.tipo`. */
  tipo: string;
  /** Pestaña del expediente donde se agrupa su historial. */
  pestañaExpediente: string;
  /** Categoría clínica que deriva al crear el RegistroClínico. */
  categoria: CategoriaClinica;
  /** True si al atender la cita se genera un RegistroClínico. */
  generaRegistroClinico: boolean;
  /** Campos condicionales que exige el formulario de cita. */
  camposCondicionales: CampoCondicionalCita[];
  /** Clase CSS/token visual del tipo (agenda, badges). */
  color: string;
  /** Color Ionic para badges. */
  badgeColor: string;
}

/**
 * @description Catálogo maestro de tipos de cita.
 * (Las pestañas de expediente de Fase 3 se derivarán de aquí.)
 */
export const CATALOGO_TIPOS_CITA: ItemCatalogoTipoCita[] = [
  {
    tipo: 'Consulta general',
    pestañaExpediente: 'Consulta y control',
    categoria: 'DIAGNOSTICO',
    generaRegistroClinico: true,
    camposCondicionales: ['servicioDomicilio', 'repetirCita'],
    color: 'consulta',
    badgeColor: 'primary',
  },
  {
    tipo: 'Vacunación',
    pestañaExpediente: 'Vacunación',
    categoria: 'PREVENTIVO',
    generaRegistroClinico: true,
    camposCondicionales: ['servicioDomicilio', 'repetirCita'],
    color: 'vacuna',
    badgeColor: 'success',
  },
  {
    tipo: 'Cirugía',
    pestañaExpediente: 'Procedimientos',
    categoria: 'QUIRURGICO',
    generaRegistroClinico: true,
    camposCondicionales: [],
    color: 'cirugia',
    badgeColor: 'tertiary',
  },
  {
    tipo: 'Urgencia',
    pestañaExpediente: 'Emergencias',
    categoria: 'EMERGENCIA',
    generaRegistroClinico: true,
    camposCondicionales: [],
    color: 'urgencia',
    badgeColor: 'danger',
  },
  {
    tipo: 'Control',
    pestañaExpediente: 'Consulta y control',
    categoria: 'PREVENTIVO',
    generaRegistroClinico: true,
    camposCondicionales: ['servicioDomicilio'],
    color: 'control',
    badgeColor: 'warning',
  },
  {
    tipo: 'Otro',
    pestañaExpediente: 'Consulta y control',
    categoria: 'DIAGNOSTICO',
    generaRegistroClinico: true,
    camposCondicionales: [],
    color: 'control',
    badgeColor: 'medium',
  },
  {
    tipo: 'Estética',
    pestañaExpediente: 'Estética',
    categoria: 'ESTETICA',
    generaRegistroClinico: false,
    camposCondicionales: ['servicioDomicilio', 'tipoServicio', 'asignarGroomer'],
    color: 'estetica',
    badgeColor: 'secondary',
  },
];

/**
 * @description Devuelve la categoría clínica derivada del tipo de una cita.
 * @param tipo - Valor de `citas.tipo`.
 * @returns Categoría clínica, o `undefined` si el tipo no está catalogado.
 */
export function categoriaCitaPorTipo(tipo: string): CategoriaClinica | undefined {
  return CATALOGO_TIPOS_CITA.find(t => t.tipo === tipo)?.categoria;
}

/**
 * @description Devuelve la entrada del catálogo para un tipo de cita.
 * @param tipo - Valor de `citas.tipo`.
 * @returns Entrada del catálogo, o `undefined`.
 */
export function infoTipoCita(tipo: string): ItemCatalogoTipoCita | undefined {
  return CATALOGO_TIPOS_CITA.find(t => t.tipo === tipo);
}
