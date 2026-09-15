/**
 * @description
 * Cita veterinaria almacenada en la colección `citas` de Firestore.
 *
 * Cada cita denormaliza los nombres de mascota, cliente, veterinario y
 * recepcionista para evitar lecturas adicionales al mostrar las agendas.
 */
import { CategoriaClinica } from './registro-clinico.model';
import { ItemVenta } from './venta.model';

export interface Cita {
  /** Identificador del documento en Firestore. */
  idCita: string;
  /** Identificador de la mascota atendida. */
  idMascota: string;
  /** Nombre de la mascota (denormalizado). */
  nombreMascota: string;
  /** Identificador del cliente dueño de la mascota. */
  idCliente: string;
  /** Nombre del cliente (denormalizado). */
  nombreCliente: string;
  /** Identificador del veterinario asignado. */
  idVeterinario: string;
  /** Nombre del veterinario (denormalizado). */
  nombreVeterinario: string;
  /** Identificador del recepcionista que registró la cita. */
  idRecepcionista: string;
  /** Nombre del recepcionista (denormalizado). */
  nombreRecepcionista: string;
  /** Fecha de la cita en formato `YYYY-MM-DD`. */
  fecha: string;
  /** Hora de inicio en formato `HH:mm`. */
  horaInicio: string;
  /** Hora de fin en formato `HH:mm`. */
  horaFin: string;
  /** Tipo o motivo de la cita. */
  tipo: string;
  /** Categoría clínica derivada del tipo (Fase 1). Ausente en citas antiguas. */
  categoria?: CategoriaClinica;
  /** Estado actual del ciclo de vida de la cita. */
  estado: 'pendiente' | 'en_proceso' | 'finalizada' | 'cancelada' | 'no_asistio';
  /** Notas libres asociadas a la cita. */
  notas: string;
  /** Marca de tiempo ISO del momento de registro. */
  fechaRegistro: string;

  // ── Servicios y cuenta por cobrar (agendamiento) ─────────
  /** Servicios del catálogo agendados (snapshot de nombre, precio y cantidad). */
  itemsServicio?: ItemVenta[];
  /** Suma de los servicios agendados. */
  totalEstimado?: number;
  /** Venta/cuenta por cobrar generada al agendar. */
  idVenta?: string;

  // ── Estética / Groomer (Fase 2, solo cuando categoria === 'ESTETICA') ──
  /** Groomer asignado en lugar de veterinario. */
  idGroomer?: string;
  /** Nombre del groomer (denormalizado). */
  nombreGroomer?: string;
  /** Tipo de servicio estético agendado. */
  tipoServicio?: 'bano' | 'corte' | 'corte_y_bano' | 'deslanado' | 'otro' | '';
  /** Observaciones dadas por el cliente al agendar. */
  observacionesCliente?: string;
  /** Notas que recepción añade después de agendar y antes del servicio. */
  notasRecepcion?: string;
  /** Notas del servicio escritas por el groomer al finalizar. */
  notasServicio?: string;
  /** Pasos del servicio (catálogo) que el groomer marcó como realizados. */
  checklistServicio?: string[];
  /** Hallazgos no clínicos del groomer al finalizar el servicio. */
  hallazgosGroomer?: {
    piel?: string;
    parasitos?: boolean;
    nudos?: boolean;
    comportamiento?: string;
    nota?: string;
  };
  /** Marca ISO de cuándo el groomer inició el servicio. */
  fechaInicioServicio?: string;
  /** Marca ISO de cuándo el groomer finalizó el servicio. */
  fechaFinServicio?: string;
  /** True si el groomer escaló un hallazgo médico a veterinario. */
  escaladoAVeterinario?: boolean;
  /** Id de la cita médica creada por el escalado. */
  idCitaEscalada?: string;
  /** En la cita escalada: id de la cita de estética que la originó. */
  escaladoDesde?: string;
}
