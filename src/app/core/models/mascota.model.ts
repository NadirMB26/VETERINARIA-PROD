/**
 * @description
 * Mascota almacenada en la subcolección `clientes/{idCliente}/mascotas`.
 */
export interface Mascota {
  /** Identificador del documento de la mascota. */
  idMascota: string;
  /** Identificador del cliente propietario. */
  idCliente: string;
  /** Nombre de la mascota. */
  nombre: string;
  /** Especie (perro, gato, ave, reptil, otro). */
  especie: string;
  /** Raza dentro de la especie. */
  raza: string;
  /** Sexo de la mascota. */
  sexo: 'macho' | 'hembra';
  /** Fecha de nacimiento en formato ISO. */
  fechaNacimiento: string;
  /** Color del pelaje o plumaje. */
  color: string;
  /** Peso actual en kilogramos. */
  peso: number;
  /** Estado de actividad de la ficha. */
  estado: 'activo' | 'inactivo';
  /** Marca de tiempo ISO del registro. */
  fechaRegistro: string;
  /** Cliente anterior, presente si la mascota fue migrada. */
  idClienteAnterior?: string;
  /** Marca de tiempo ISO de la última migración de propietario. */
  fechaMigracion?: string;
  /** Antecedentes médicos opcionales. */
  antecedentes?: AntecedentesMedicos;
  /** URL de la foto de la mascota. */
  fotoUrl?: string;
}

/**
 * @description
 * Antecedentes médicos opcionales de una mascota.
 */
export interface AntecedentesMedicos {
  /** Alergias conocidas. */
  alergias?: string;
  /** Cirugías previas. */
  cirugias?: string;
  /** Enfermedades crónicas. */
  enfermedadesCr?: string;
  /** Esquema de vacunación. */
  esquemaVacunacion?: string;
  /** Indicaciones de dieta. */
  dieta?: string;
}
