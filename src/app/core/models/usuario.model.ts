export interface PerfilUsuario {
  uid: string;
  rol: string;
  Nombre: string;
  Apellido: string;
  Telefono: string;
  Correo: string;
  estado: string;
  /** Número de cédula / documento de identidad (8-10 dígitos, único). */
  Cedula?: string;
  Especialidad?: string;
  /** Especialidades del veterinario (catálogo), usadas para agendar citas. */
  especialidades?: string[];
  fotoUrl?: string;
  saldoFavor?: number;
}

/**
 * Valida una cédula/documento de identidad: solo dígitos, entre 8 y 10.
 * @param cedula - Documento a validar (se recorta y limpia de espacios).
 */
export function cedulaValida(cedula?: string | null): boolean {
  return /^\d{8,10}$/.test((cedula ?? '').trim());
}

/** Devuelve solo los dígitos de un valor (bloquea letras, símbolos y negativos). */
export function soloDigitos(valor: string | number | null | undefined): string {
  return String(valor ?? '').replace(/\D/g, '');
}
