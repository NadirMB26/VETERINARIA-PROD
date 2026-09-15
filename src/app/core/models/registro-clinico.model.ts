/**
 * @description
 * Registro clínico (Fase 1) almacenado en la colección top-level
 * `registrosClinicos/{idRegistro}` de Firestore.
 *
 * Cada cita atendida genera un registro; su historial de correcciones vive
 * en la subcolección `registrosClinicos/{idRegistro}/ediciones/{idEdicion}`.
 */

export type CategoriaClinica =
  | 'PREVENTIVO'
  | 'DIAGNOSTICO'
  | 'CURATIVO'
  | 'QUIRURGICO'
  | 'EMERGENCIA'
  | 'ESTETICA';

/** Catálogo de categorías clínicas: etiqueta y color Ionic para UI. */
export const CATEGORIAS_CLINICAS: Record<CategoriaClinica, { label: string; color: string }> = {
  PREVENTIVO: { label: 'Preventivo', color: 'success' },
  DIAGNOSTICO: { label: 'Diagnóstico', color: 'primary' },
  CURATIVO: { label: 'Curativo', color: 'warning' },
  QUIRURGICO: { label: 'Quirúrgico', color: 'tertiary' },
  EMERGENCIA: { label: 'Emergencia', color: 'danger' },
  ESTETICA: { label: 'Estética', color: 'secondary' },
};

/**
 * @description Registro clínico de una mascota.
 */
export interface RegistroClinico {
  /** Identificador del documento en Firestore. */
  idRegistro: string;
  /** Identificador de la mascota. */
  idMascota: string;
  /** Identificador del cliente propietario. */
  idCliente: string;
  /** Cita que dio origen al registro (a lo sumo un registro por cita). */
  idCita?: string | null;
  /** Categoría clínica del registro. */
  categoria: CategoriaClinica;
  /** Anamnesis (reemplaza a "síntomas"). */
  anamnesis: string;
  /** Examen físico (opcional en Fase 1). */
  examenFisico?: string;
  /** Diagnóstico clínico. */
  diagnostico: string;
  /** Tratamiento indicado. */
  tratamiento: string;
  /** Medicamentos recetados. */
  medicamentos?: string;
  /** Observaciones adicionales. */
  observaciones?: string;
  /** Identificador del veterinario que emite el registro. */
  idVeterinario: string;
  /** Nombre del veterinario (denormalizado). */
  nombreVeterinario: string;
  /** Marca de tiempo ISO de creación. */
  fechaRegistro: string;
  /** Marca de tiempo ISO de la última actualización. */
  fechaActualizacion?: string;
  /** Motivo de la última corrección (solo si el registro fue corregido). */
  motivoUltimaCorreccion?: string | null;
}

/**
 * @description Entrada de auditoría de una corrección a un registro clínico.
 * Se guarda en `registrosClinicos/{idRegistro}/ediciones/{idEdicion}` y solo
 * se agrega (nunca se modifica ni elimina).
 */
export interface EdicionRegistro {
  /** Campo modificado. */
  campo: string;
  /** Valor anterior. */
  antes: string;
  /** Valor nuevo. */
  despues: string;
  /** Motivo obligatorio de la corrección. */
  motivo: string;
  /** Identificador del autor. */
  autorId: string;
  /** Nombre del autor. */
  autorNombre: string;
  /** Marca de tiempo ISO de la corrección. */
  fecha: string;
}

/** Datos mínimos para crear un registro clínico nuevo. */
export type NuevoRegistroClinico = Omit<RegistroClinico, 'idRegistro'>;
