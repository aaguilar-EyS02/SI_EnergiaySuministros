export const APP_ROLES = [
  'Administrador',
  'Generador',
  'Solicitante',
  'Jefe de Almacen',
  'Editor',
  'Consulta',
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const AREAS_OPTIONS = [
  'Alumbrado Público',
  'BOM',
  'Mantenimiento',
  'Obras',
  'Antifraude',
  'Operaciones Domiciliarias',
  'Poda',
  'Campaña',
  'Lectura y Reparto',
  'Administración',
] as const;

export const BOM_OPTIONS = [
  '',
  'BOM MASAYA',
  'BOM GRANADA',
  'BOM CARAZO',
  'BOM NANDAIME',
  'BOM MASATEPE',
  'BOM RIVAS',
  'BOM SAN JUAN DEL SUR',
  'BOM OMETEPE',
  'BOM MASAYA 2',
  'BOM MASAYA 3',
  'BOM RIVAS 2',
  'BOM CARAZO 2',
  'BOM GRANADA 2',
  'BOM GRANADA 3',
  'BOM ELEMENTO REPETIDO',
] as const;

export const TIPOS_INVENTARIO = ['Aporte Contrata', 'Stock Emergencia', 'Material Recuperado'] as const;

export const TIPOS_ATENCION = ['Normal', 'Emergencia Nocturna'] as const;

export const ESTADOS_SOLICITUD = ['Pendiente', 'Atendida', 'Finalizada', 'Cancelada'] as const;

export const SUBTIPOS_ENTRADA = ['Compra', 'Traspaso Central'] as const;
