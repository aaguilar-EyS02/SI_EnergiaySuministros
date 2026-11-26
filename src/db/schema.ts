import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  nombre: text('nombre').notNull().default(''),
  almacen: text('almacen').notNull().default('Almacén Central'),
  activo: boolean('activo').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const userRoles = pgTable(
  'user_roles',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    role: text('role').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('user_roles_user_role_idx').on(table.userId, table.role)],
);

export const pendingEmailRoles = pgTable(
  'pending_email_roles',
  {
    id: serial('id').primaryKey(),
    email: text('email').notNull(),
    role: text('role').notNull(),
    nombre: text('nombre').notNull().default(''),
    almacen: text('almacen').notNull().default('Almacén Central'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('pending_email_role_idx').on(table.email, table.role)],
);

export const empleados = pgTable('empleados', {
  cedula: text('cedula').primaryKey(),
  nombreCompleto: text('nombre_completo').notNull(),
  municipio: text('municipio').notNull(),
  area: text('area').notNull(),
  cargo: text('cargo').notNull(),
  email: text('email').notNull().default(''),
  activo: boolean('activo').notNull().default(true),
});

export const inventarioApContrata = pgTable('inventario_ap_contrata', {
  codigoMaterial: text('codigo_material').primaryKey(),
  nombreMaterial: text('nombre_material').notNull(),
  um: text('um').notNull(),
  familia: text('familia').notNull(),
  estado: text('estado').notNull().default('Buen Estado'),
  precio: numeric('precio', { precision: 12, scale: 2 }).notNull().default('0.00'),
  stockInicial: numeric('stock_inicial', { precision: 12, scale: 2 }).notNull().default('0'),
  stockMinimo: numeric('stock_minimo', { precision: 12, scale: 2 }).notNull().default('0'),
  entradasTotal: numeric('entradas_total', { precision: 12, scale: 2 }).notNull().default('0'),
});

export const solicitudParentApContrata = pgTable('solicitud_parent_ap_contrata', {
  idSolicitud: text('id_solicitud').primaryKey(),
  secuenciaNum: integer('secuencia_num').notNull().unique(),
  fechaSolicitud: timestamp('fecha_solicitud').defaultNow().notNull(),
  solicitanteUid: text('solicitante_uid').references(() => users.uid),
  idSolicitante: text('id_solicitante').notNull(),
  area: text('area').notNull(),
  bom: text('bom').notNull().default(''),
  capataz: text('capataz').notNull(),
  tipoInventario: text('tipo_inventario').notNull().default('Aporte Contrata'),
  tipoAtencion: text('tipo_atencion').notNull().default('Normal'),
  estadoSolicitud: text('estado_solicitud').notNull().default('Pendiente'),
  comentariosSolicitante: text('comentarios_solicitante').notNull(),
  comentariosAlmacen: text('comentarios_almacen').notNull().default(''),
  atendidoPor: text('atendido_por').notNull().default(''),
  entregadoPor: text('entregado_por').notNull().default(''),
  motivoCancelacion: text('motivo_cancelacion').notNull().default(''),
  fechaDespacho: timestamp('fecha_despacho'),
  fechaFinalizacion: timestamp('fecha_finalizacion'),
});

export const detalleSolicitudApContrata = pgTable('detalle_solicitud_ap_contrata', {
  idDetalleSol: serial('id_detalle_sol').primaryKey(),
  idSolicitud: text('id_solicitud')
    .references(() => solicitudParentApContrata.idSolicitud, { onDelete: 'cascade' })
    .notNull(),
  codigoMaterial: text('codigo_material')
    .references(() => inventarioApContrata.codigoMaterial)
    .notNull(),
  numeroObraIncidencia: text('numero_obra_incidencia').notNull(),
  cantidadSolicitada: numeric('cantidad_solicitada', { precision: 12, scale: 2 }).notNull(),
  cantidadDespachada: numeric('cantidad_despachada', { precision: 12, scale: 2 }).notNull().default('0'),
  cantidadDevuelta: numeric('cantidad_devuelta', { precision: 12, scale: 2 }).notNull().default('0'),
  cantidadME: numeric('cantidad_me', { precision: 12, scale: 2 }).notNull().default('0'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const entradasApContrata = pgTable('entradas_ap_contrata', {
  idTransaccion: text('id_transaccion').primaryKey(),
  fechaRegistro: timestamp('fecha_registro').defaultNow().notNull(),
  subtipoMovimiento: text('subtipo_movimiento').notNull().default('Compra'),
  numeroFactura: text('numero_factura').notNull().default(''),
  proveedor: text('proveedor').notNull().default(''),
  recibidoPor: text('recibido_por').notNull(),
  observaciones: text('observaciones').notNull().default(''),
});

export const detalleEntradaApContrata = pgTable('detalle_entrada_ap_contrata', {
  idDetalle: serial('id_detalle').primaryKey(),
  idTransaccion: text('id_transaccion')
    .references(() => entradasApContrata.idTransaccion, { onDelete: 'cascade' })
    .notNull(),
  codigoMaterial: text('codigo_material')
    .references(() => inventarioApContrata.codigoMaterial)
    .notNull(),
  cantidad: numeric('cantidad', { precision: 12, scale: 2 }).notNull(),
  costoUnitario: numeric('costo_unitario', { precision: 12, scale: 2 }).notNull(),
  costoTotal: numeric('costo_total', { precision: 12, scale: 2 }).notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  roles: many(userRoles),
  solicitudes: many(solicitudParentApContrata),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.id],
  }),
}));

export const solicitudParentRelations = relations(solicitudParentApContrata, ({ one, many }) => ({
  solicitante: one(users, {
    fields: [solicitudParentApContrata.solicitanteUid],
    references: [users.uid],
  }),
  detalles: many(detalleSolicitudApContrata),
}));

export const detalleSolicitudRelations = relations(detalleSolicitudApContrata, ({ one }) => ({
  solicitud: one(solicitudParentApContrata, {
    fields: [detalleSolicitudApContrata.idSolicitud],
    references: [solicitudParentApContrata.idSolicitud],
  }),
  material: one(inventarioApContrata, {
    fields: [detalleSolicitudApContrata.codigoMaterial],
    references: [inventarioApContrata.codigoMaterial],
  }),
}));

export const inventarioRelations = relations(inventarioApContrata, ({ many }) => ({
  detallesSolicitud: many(detalleSolicitudApContrata),
  detallesEntrada: many(detalleEntradaApContrata),
}));

export const entradasRelations = relations(entradasApContrata, ({ many }) => ({
  detalles: many(detalleEntradaApContrata),
}));

export const detalleEntradaRelations = relations(detalleEntradaApContrata, ({ one }) => ({
  entrada: one(entradasApContrata, {
    fields: [detalleEntradaApContrata.idTransaccion],
    references: [entradasApContrata.idTransaccion],
  }),
  material: one(inventarioApContrata, {
    fields: [detalleEntradaApContrata.codigoMaterial],
    references: [inventarioApContrata.codigoMaterial],
  }),
}));
