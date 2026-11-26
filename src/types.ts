import type { AppRole } from './lib/constants.ts';

export interface AuthUser {
  id: number;
  uid: string;
  email: string;
  nombre: string;
  almacen: string;
  activo: boolean;
  roles: AppRole[];
  createdAt: string;
}

export interface PendingWorkspaceUser {
  email: string;
  nombre: string;
  almacen: string;
  roles: AppRole[];
}

export interface Empleado {
  cedula: string;
  nombreCompleto: string;
  municipio: string;
  area: string;
  cargo: string;
  email: string;
  activo: boolean;
}

export interface InventarioItem {
  codigoMaterial: string;
  nombreMaterial: string;
  um: string;
  familia: string;
  estado: string;
  precio: number;
  stockInicial: number;
  stockMinimo: number;
  entradasTotal: number;
  despachadoTotal: number;
  devueltoTotal: number;
  totalME: number;
  existenciaActual: number;
  estadoStock: 'Crítico' | 'Bajo' | 'Óptimo';
}

export interface DetalleSolicitud {
  idDetalleSol: number;
  idSolicitud: string;
  codigoMaterial: string;
  nombreMaterial: string;
  um: string;
  precioUnit?: number;
  stockVirtual?: number;
  numeroObraIncidencia: string;
  cantidadSolicitada: number;
  cantidadDespachada: number;
  cantidadDevuelta: number;
  cantidadME: number;
}

export interface SolicitudParent {
  idSolicitud: string;
  secuenciaNum: number;
  fechaSolicitud: string;
  solicitanteUid: string | null;
  idSolicitante: string;
  area: string;
  bom: string;
  capataz: string;
  capatazNombre: string;
  tipoInventario: string;
  tipoAtencion: 'Normal' | 'Emergencia Nocturna';
  estadoSolicitud: 'Pendiente' | 'Atendida' | 'Finalizada' | 'Cancelada';
  comentariosSolicitante: string;
  comentariosAlmacen: string;
  atendidoPor: string;
  entregadoPor: string;
  entregadoPorNombre: string;
  motivoCancelacion: string;
  fechaDespacho: string | null;
  fechaFinalizacion: string | null;
  obraResumen: string;
  totalLineas?: number;
  totalSolicitado?: number;
  totalDespachado?: number;
  totalDevuelto?: number;
  totalME?: number;
  detalles: DetalleSolicitud[];
}

export interface ConsolidadoRow {
  idDetalleSol: number;
  idSolicitud: string;
  fechaSolicitud: string;
  idSolicitante: string;
  area: string;
  bom: string;
  capatazNombre: string;
  tipoInventario: string;
  tipoAtencion: string;
  estadoSolicitud: string;
  numeroObraIncidencia: string;
  codigoMaterial: string;
  nombreMaterial: string;
  um: string;
  precioUnit: number;
  cantidadSolicitada: number;
  cantidadDespachada: number;
  cantidadDevuelta: number;
  cantidadME: number;
  consumoNeto: number;
  costoNeto: number;
}
