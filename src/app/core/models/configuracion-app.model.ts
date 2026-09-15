export type TemasApp = 'teal' | 'azul' | 'esmeralda' | 'violeta';

export interface ConfiguracionApp {
  nombre: string;
  subnombre: string;
  tema: TemasApp;
  logoTipo: 'icono' | 'imagen';
  logoIcono: string;
  logoColor: string;
  logoImagen: string;
  /** Color primario personalizado (#RRGGBB). Si existe, se usa el modo "custom". */
  colorPrimario?: string;
  /** Id de la fuente elegida (ver FUENTES_DISPONIBLES); undefined = Nunito. */
  fontFamily?: string;
}

export interface TemaDisponible {
  id: TemasApp;
  nombre: string;
  colores: string[];
}

export const TEMAS_DISPONIBLES: TemaDisponible[] = [
  { id: 'teal',      nombre: 'Teal',      colores: ['#00897B', '#00695C', '#B2DFDF', '#E0F2F1'] },
  { id: 'azul',      nombre: 'Azul',      colores: ['#3B82F6', '#2563EB', '#BFDBFE', '#DBEAFE'] },
  { id: 'esmeralda', nombre: 'Esmeralda', colores: ['#10B981', '#059669', '#A7F3D0', '#D1FAE5'] },
  { id: 'violeta',   nombre: 'Violeta',   colores: ['#8B5CF6', '#7C3AED', '#C4B5FD', '#EDE9FE'] },
];

export const ICONOS_DISPONIBLES: string[] = [
  'paw', 'medkit', 'heart', 'pulse', 'shield',
  'ribbon', 'happy', 'sparkles', 'fitness', 'nutrition', 'water', 'bug',
];

export const COLORES_DISPONIBLES: string[] = [
  '#00897B', '#3B82F6', '#10B981', '#8B5CF6',
  '#F59E0B', '#EF4444', '#EC4899', '#1F2937',
];

export function getConfiguracionDefault(): ConfiguracionApp {
  return {
    nombre: 'Veterinaria Canes',
    subnombre: 'Clínica Veterinaria',
    tema: 'teal',
    logoTipo: 'icono',
    logoIcono: 'paw',
    logoColor: '#00897B',
    logoImagen: '',
  };
}
