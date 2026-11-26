import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { db } from './index.ts';
import {
  detalleEntradaApContrata,
  detalleSolicitudApContrata,
  empleados,
  entradasApContrata,
  inventarioApContrata,
  solicitudParentApContrata,
} from './schema.ts';

export class DomainError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function getEmpleadosList() {
  try {
    return await db.select().from(empleados).orderBy(asc(empleados.nombreCompleto));
  } catch (error) {
    console.error('Failed to query empleados:', error);
    throw new Error('No se pudo cargar el catálogo de empleados.', { cause: error });
  }
}

export async function getInventarioList() {
  try {
    const items = await db
      .select()
      .from(inventarioApContrata)
      .orderBy(asc(inventarioApContrata.codigoMaterial));

    const movs = await db
      .select({
        codigoMaterial: detalleSolicitudApContrata.codigoMaterial,
        totalDespachado: sql<string>`COALESCE(SUM(${detalleSolicitudApContrata.cantidadDespachada}), 0)`,
        totalDevuelto: sql<string>`COALESCE(SUM(${detalleSolicitudApContrata.cantidadDevuelta}), 0)`,
        totalME: sql<string>`COALESCE(SUM(${detalleSolicitudApContrata.cantidadME}), 0)`,
      })
      .from(detalleSolicitudApContrata)
      .groupBy(detalleSolicitudApContrata.codigoMaterial);

    const movMap = new Map(movs.map((m) => [m.codigoMaterial, m]));

    return items.map((item) => {
      const mov = movMap.get(item.codigoMaterial);
      const stockInicial = Number(item.stockInicial);
      const entradasTotal = Number(item.entradasTotal);
      const despachado = Number(mov?.totalDespachado ?? 0);
      const devueltoBE = Number(mov?.totalDevuelto ?? 0);
      const totalME = Number(mov?.totalME ?? 0);
      const existenciaActual = Number((stockInicial + entradasTotal - despachado + devueltoBE).toFixed(2));
      const stockMinimo = Number(item.stockMinimo);

      let estadoStock: 'Crítico' | 'Bajo' | 'Óptimo' = 'Óptimo';
      if (existenciaActual <= 0) estadoStock = 'Crítico';
      else if (existenciaActual <= stockMinimo) estadoStock = 'Bajo';

      return {
        codigoMaterial: item.codigoMaterial,
        nombreMaterial: item.nombreMaterial,
        um: item.um,
        familia: item.familia,
        estado: item.estado,
        precio: Number(item.precio),
        stockInicial,
        stockMinimo,
        entradasTotal,
        despachadoTotal: despachado,
        devueltoTotal: devueltoBE,
        totalME,
        existenciaActual,
        estadoStock,
      };
    });
  } catch (error) {
    console.error('Failed to query inventario:', error);
    throw new Error('No se pudo cargar el inventario AP Contrata.', { cause: error });
  }
}

export async function listSolicitudes() {
  try {
    const parents = await db
      .select()
      .from(solicitudParentApContrata)
      .orderBy(desc(solicitudParentApContrata.secuenciaNum));

    const empRows = await db.select().from(empleados);
    const empMap = new Map(empRows.map((e) => [e.cedula, e.nombreCompleto]));

    const detalles = await db
      .select({
        idDetalleSol: detalleSolicitudApContrata.idDetalleSol,
        idSolicitud: detalleSolicitudApContrata.idSolicitud,
        codigoMaterial: detalleSolicitudApContrata.codigoMaterial,
        numeroObraIncidencia: detalleSolicitudApContrata.numeroObraIncidencia,
        cantidadSolicitada: detalleSolicitudApContrata.cantidadSolicitada,
        cantidadDespachada: detalleSolicitudApContrata.cantidadDespachada,
        cantidadDevuelta: detalleSolicitudApContrata.cantidadDevuelta,
        cantidadME: detalleSolicitudApContrata.cantidadME,
        nombreMaterial: inventarioApContrata.nombreMaterial,
        um: inventarioApContrata.um,
      })
      .from(detalleSolicitudApContrata)
      .innerJoin(
        inventarioApContrata,
        eq(detalleSolicitudApContrata.codigoMaterial, inventarioApContrata.codigoMaterial),
      )
      .orderBy(asc(detalleSolicitudApContrata.idDetalleSol));

    const detallesBySol = new Map<string, typeof detalles>();
    for (const d of detalles) {
      const list = detallesBySol.get(d.idSolicitud) ?? [];
      list.push(d);
      detallesBySol.set(d.idSolicitud, list);
    }

    return parents.map((p) => {
      const lines = detallesBySol.get(p.idSolicitud) ?? [];
      const obrasUnicas = Array.from(
        new Set(lines.map((l) => l.numeroObraIncidencia).filter(Boolean)),
      );
      return {
        ...p,
        capatazNombre: empMap.get(p.capataz) ?? p.capataz,
        entregadoPorNombre: p.entregadoPor ? (empMap.get(p.entregadoPor) ?? p.entregadoPor) : '',
        obraResumen: obrasUnicas.join(', '),
        totalLineas: lines.length,
        totalSolicitado: lines.reduce((acc, l) => acc + Number(l.cantidadSolicitada), 0),
        totalDespachado: lines.reduce((acc, l) => acc + Number(l.cantidadDespachada), 0),
        totalDevuelto: lines.reduce((acc, l) => acc + Number(l.cantidadDevuelta), 0),
        totalME: lines.reduce((acc, l) => acc + Number(l.cantidadME), 0),
        detalles: lines.map((l) => ({
          idDetalleSol: l.idDetalleSol,
          idSolicitud: l.idSolicitud,
          codigoMaterial: l.codigoMaterial,
          nombreMaterial: l.nombreMaterial,
          um: l.um,
          numeroObraIncidencia: l.numeroObraIncidencia,
          cantidadSolicitada: Number(l.cantidadSolicitada),
          cantidadDespachada: Number(l.cantidadDespachada),
          cantidadDevuelta: Number(l.cantidadDevuelta),
          cantidadME: Number(l.cantidadME),
        })),
      };
    });
  } catch (error) {
    console.error('Failed to list solicitudes:', error);
    throw new Error('No se pudieron cargar las solicitudes AP Contrata.', { cause: error });
  }
}

export async function getSolicitudById(idSolicitud: string) {
  try {
    const rows = await db
      .select()
      .from(solicitudParentApContrata)
      .where(eq(solicitudParentApContrata.idSolicitud, idSolicitud));
    if (rows.length === 0) return null;

    const p = rows[0];
    const empRows = await db.select().from(empleados);
    const empMap = new Map(empRows.map((e) => [e.cedula, e.nombreCompleto]));
    const inv = await getInventarioList();
    const invMap = new Map(inv.map((i) => [i.codigoMaterial, i]));

    const lines = await db
      .select()
      .from(detalleSolicitudApContrata)
      .where(eq(detalleSolicitudApContrata.idSolicitud, idSolicitud))
      .orderBy(asc(detalleSolicitudApContrata.idDetalleSol));

    const obrasUnicas = Array.from(
      new Set(lines.map((l) => l.numeroObraIncidencia).filter(Boolean)),
    );

    return {
      ...p,
      capatazNombre: empMap.get(p.capataz) ?? p.capataz,
      entregadoPorNombre: p.entregadoPor ? (empMap.get(p.entregadoPor) ?? p.entregadoPor) : '',
      obraResumen: obrasUnicas.join(', '),
      detalles: lines.map((l) => {
        const mat = invMap.get(l.codigoMaterial);
        return {
          idDetalleSol: l.idDetalleSol,
          idSolicitud: l.idSolicitud,
          codigoMaterial: l.codigoMaterial,
          nombreMaterial: mat?.nombreMaterial ?? l.codigoMaterial,
          um: mat?.um ?? 'UND',
          precioUnit: mat?.precio ?? 0,
          stockVirtual: mat?.existenciaActual ?? 0,
          numeroObraIncidencia: l.numeroObraIncidencia,
          cantidadSolicitada: Number(l.cantidadSolicitada),
          cantidadDespachada: Number(l.cantidadDespachada),
          cantidadDevuelta: Number(l.cantidadDevuelta),
          cantidadME: Number(l.cantidadME),
        };
      }),
    };
  } catch (error) {
    console.error('Failed to get solicitud detail:', error);
    throw new Error('No se pudo obtener el detalle de la solicitud.', { cause: error });
  }
}

export interface CreateSolicitudInput {
  solicitanteUid: string;
  idSolicitante: string;
  area: string;
  bom: string;
  capataz: string;
  tipoInventario: string;
  tipoAtencion: string;
  comentariosSolicitante: string;
  items: Array<{
    codigoMaterial: string;
    numeroObraIncidencia: string;
    cantidadSolicitada: number;
  }>;
}

export async function createSolicitud(input: CreateSolicitudInput) {
  if (!input.capataz.trim()) {
    throw new DomainError('Debes seleccionar un Capataz.');
  }
  if (!input.area.trim()) {
    throw new DomainError('Debes seleccionar un Área.');
  }
  if (!input.comentariosSolicitante.trim()) {
    throw new DomainError('Los comentarios del solicitante son obligatorios.');
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new DomainError('No se puede guardar una solicitud vacía: agrega al menos 1 material.');
  }

  for (const item of input.items) {
    if (!item.codigoMaterial || !item.numeroObraIncidencia.trim()) {
      throw new DomainError('Cada material debe tener código y número de obra/incidencia.');
    }
    if (!Number.isFinite(item.cantidadSolicitada) || item.cantidadSolicitada <= 0) {
      throw new DomainError('La cantidad solicitada debe ser mayor a cero.');
    }
  }

  try {
    return await db.transaction(async (tx) => {
      // Advisory transaction lock guarantees gap-free sequential IDs under concurrent users
      await tx.execute(sql`SELECT pg_advisory_xact_lock(71001)`);

      const maxRow = await tx
        .select({ maxSeq: sql<number>`COALESCE(MAX(${solicitudParentApContrata.secuenciaNum}), 0)::int` })
        .from(solicitudParentApContrata);

      const nextSeq = (maxRow[0]?.maxSeq ?? 0) + 1;
      const idSolicitud = `SOLAPC_${String(nextSeq).padStart(4, '0')}`;

      await tx.insert(solicitudParentApContrata).values({
        idSolicitud,
        secuenciaNum: nextSeq,
        solicitanteUid: input.solicitanteUid,
        idSolicitante: input.idSolicitante,
        area: input.area.trim(),
        bom: input.bom.trim(),
        capataz: input.capataz.trim(),
        tipoInventario: input.tipoInventario.trim() || 'Aporte Contrata',
        tipoAtencion: input.tipoAtencion === 'Emergencia Nocturna' ? 'Emergencia Nocturna' : 'Normal',
        estadoSolicitud: 'Pendiente',
        comentariosSolicitante: input.comentariosSolicitante.trim(),
      });

      for (const item of input.items) {
        await tx.insert(detalleSolicitudApContrata).values({
          idSolicitud,
          codigoMaterial: item.codigoMaterial,
          numeroObraIncidencia: item.numeroObraIncidencia.trim(),
          cantidadSolicitada: item.cantidadSolicitada.toFixed(2),
          cantidadDespachada: '0',
          cantidadDevuelta: '0',
          cantidadME: '0',
        });
      }

      return { idSolicitud, secuenciaNum: nextSeq };
    });
  } catch (error) {
    if (error instanceof DomainError) throw error;
    console.error('Failed to create solicitud:', error);
    throw new Error('No se pudo guardar la solicitud en la base de datos.', { cause: error });
  }
}

export async function addDetalleMaterial(
  idSolicitud: string,
  item: { codigoMaterial: string; numeroObraIncidencia: string; cantidadSolicitada: number },
) {
  if (!item.codigoMaterial || !item.numeroObraIncidencia.trim()) {
    throw new DomainError('Código de material y N° de Obra/Incidencia son obligatorios.');
  }
  if (!Number.isFinite(item.cantidadSolicitada) || item.cantidadSolicitada <= 0) {
    throw new DomainError('La cantidad solicitada debe ser mayor a cero.');
  }

  try {
    return await db.transaction(async (tx) => {
      const parent = await tx
        .select()
        .from(solicitudParentApContrata)
        .where(eq(solicitudParentApContrata.idSolicitud, idSolicitud));
      if (parent.length === 0) throw new DomainError('Solicitud no encontrada.', 404);
      if (parent[0].estadoSolicitud !== 'Pendiente') {
        throw new DomainError(
          `No se pueden agregar materiales porque la solicitud está en estado ${parent[0].estadoSolicitud}.`,
        );
      }

      const inserted = await tx
        .insert(detalleSolicitudApContrata)
        .values({
          idSolicitud,
          codigoMaterial: item.codigoMaterial,
          numeroObraIncidencia: item.numeroObraIncidencia.trim(),
          cantidadSolicitada: item.cantidadSolicitada.toFixed(2),
        })
        .returning();

      return inserted[0];
    });
  } catch (error) {
    if (error instanceof DomainError) throw error;
    console.error('Failed to add detalle material:', error);
    throw new Error('No se pudo agregar el material a la solicitud.', { cause: error });
  }
}

export async function updateDetalleSolicitado(
  idSolicitud: string,
  idDetalleSol: number,
  updates: { cantidadSolicitada: number; numeroObraIncidencia?: string },
) {
  if (!Number.isFinite(updates.cantidadSolicitada) || updates.cantidadSolicitada <= 0) {
    throw new DomainError('La cantidad solicitada debe ser mayor a cero.');
  }

  try {
    return await db.transaction(async (tx) => {
      const parent = await tx
        .select()
        .from(solicitudParentApContrata)
        .where(eq(solicitudParentApContrata.idSolicitud, idSolicitud));
      if (parent.length === 0) throw new DomainError('Solicitud no encontrada.', 404);
      if (parent[0].estadoSolicitud !== 'Pendiente') {
        throw new DomainError(
          'Solo se puede editar la cantidad solicitada cuando la solicitud está Pendiente.',
        );
      }

      const setPayload: { cantidadSolicitada: string; numeroObraIncidencia?: string } = {
        cantidadSolicitada: updates.cantidadSolicitada.toFixed(2),
      };
      if (updates.numeroObraIncidencia && updates.numeroObraIncidencia.trim()) {
        setPayload.numeroObraIncidencia = updates.numeroObraIncidencia.trim();
      }

      const updated = await tx
        .update(detalleSolicitudApContrata)
        .set(setPayload)
        .where(
          and(
            eq(detalleSolicitudApContrata.idDetalleSol, idDetalleSol),
            eq(detalleSolicitudApContrata.idSolicitud, idSolicitud),
          ),
        )
        .returning();

      if (updated.length === 0) throw new DomainError('Línea de detalle no encontrada.', 404);
      return updated[0];
    });
  } catch (error) {
    if (error instanceof DomainError) throw error;
    console.error('Failed to update detalle:', error);
    throw new Error('No se pudo actualizar la línea de detalle.', { cause: error });
  }
}

export async function deleteDetalleMaterial(idSolicitud: string, idDetalleSol: number) {
  try {
    return await db.transaction(async (tx) => {
      const parent = await tx
        .select()
        .from(solicitudParentApContrata)
        .where(eq(solicitudParentApContrata.idSolicitud, idSolicitud));
      if (parent.length === 0) throw new DomainError('Solicitud no encontrada.', 404);
      if (parent[0].estadoSolicitud !== 'Pendiente') {
        throw new DomainError('Solo se pueden eliminar materiales en estado Pendiente.');
      }

      const currentLines = await tx
        .select({ id: detalleSolicitudApContrata.idDetalleSol })
        .from(detalleSolicitudApContrata)
        .where(eq(detalleSolicitudApContrata.idSolicitud, idSolicitud));
      if (currentLines.length <= 1) {
        throw new DomainError(
          'La solicitud debe mantener al menos 1 material. Si deseas anularla, usa Cancelar Solicitud.',
        );
      }

      const deleted = await tx
        .delete(detalleSolicitudApContrata)
        .where(
          and(
            eq(detalleSolicitudApContrata.idDetalleSol, idDetalleSol),
            eq(detalleSolicitudApContrata.idSolicitud, idSolicitud),
          ),
        )
        .returning();

      if (deleted.length === 0) throw new DomainError('Línea de detalle no encontrada.', 404);
      return deleted[0];
    });
  } catch (error) {
    if (error instanceof DomainError) throw error;
    console.error('Failed to delete detalle:', error);
    throw new Error('No se pudo eliminar el material de la solicitud.', { cause: error });
  }
}

export async function despacharSolicitud(
  idSolicitud: string,
  payload: {
    atendidoPor: string;
    entregadoPor: string;
    comentariosAlmacen: string;
    items: Array<{ idDetalleSol: number; cantidadDespachada: number }>;
  },
) {
  if (!payload.entregadoPor.trim()) {
    throw new DomainError('Debes indicar quién entrega en Almacén (Entregado por).');
  }

  try {
    return await db.transaction(async (tx) => {
      const parent = await tx
        .select()
        .from(solicitudParentApContrata)
        .where(eq(solicitudParentApContrata.idSolicitud, idSolicitud));
      if (parent.length === 0) throw new DomainError('Solicitud no encontrada.', 404);
      if (parent[0].estadoSolicitud !== 'Pendiente') {
        throw new DomainError('Solo se pueden despachar solicitudes en estado Pendiente.');
      }

      const currentLines = await tx
        .select()
        .from(detalleSolicitudApContrata)
        .where(eq(detalleSolicitudApContrata.idSolicitud, idSolicitud));

      if (currentLines.length === 0) {
        throw new DomainError('No se puede despachar una solicitud sin materiales.');
      }

      const qtyMap = new Map(payload.items.map((i) => [i.idDetalleSol, i.cantidadDespachada]));

      for (const line of currentLines) {
        const desp = qtyMap.has(line.idDetalleSol)
          ? Number(qtyMap.get(line.idDetalleSol))
          : Number(line.cantidadSolicitada);
        if (!Number.isFinite(desp) || desp < 0) {
          throw new DomainError('La cantidad despachada no puede ser negativa.');
        }
        await tx
          .update(detalleSolicitudApContrata)
          .set({ cantidadDespachada: desp.toFixed(2) })
          .where(eq(detalleSolicitudApContrata.idDetalleSol, line.idDetalleSol));
      }

      const updated = await tx
        .update(solicitudParentApContrata)
        .set({
          estadoSolicitud: 'Atendida',
          atendidoPor: payload.atendidoPor,
          entregadoPor: payload.entregadoPor.trim(),
          comentariosAlmacen: payload.comentariosAlmacen.trim(),
          fechaDespacho: new Date(),
        })
        .where(eq(solicitudParentApContrata.idSolicitud, idSolicitud))
        .returning();

      return updated[0];
    });
  } catch (error) {
    if (error instanceof DomainError) throw error;
    console.error('Failed to despachar solicitud:', error);
    throw new Error('No se pudo registrar el despacho de la solicitud.', { cause: error });
  }
}

export async function guardarDevolucionesQuickEdit(
  idSolicitud: string,
  payload: {
    comentariosAlmacen?: string;
    items: Array<{ idDetalleSol: number; cantidadDevuelta: number; cantidadME: number }>;
  },
) {
  try {
    return await db.transaction(async (tx) => {
      const parent = await tx
        .select()
        .from(solicitudParentApContrata)
        .where(eq(solicitudParentApContrata.idSolicitud, idSolicitud));
      if (parent.length === 0) throw new DomainError('Solicitud no encontrada.', 404);
      if (parent[0].estadoSolicitud !== 'Atendida') {
        throw new DomainError(
          'Las devoluciones solo pueden registrarse cuando la solicitud está en estado Atendida.',
        );
      }

      const lines = await tx
        .select()
        .from(detalleSolicitudApContrata)
        .where(eq(detalleSolicitudApContrata.idSolicitud, idSolicitud));
      const lineMap = new Map(lines.map((l) => [l.idDetalleSol, l]));

      for (const item of payload.items) {
        const line = lineMap.get(item.idDetalleSol);
        if (!line) throw new DomainError(`Línea de detalle ${item.idDetalleSol} no encontrada.`);

        const dev = Number(item.cantidadDevuelta);
        const me = Number(item.cantidadME);
        const desp = Number(line.cantidadDespachada);

        if (!Number.isFinite(dev) || !Number.isFinite(me) || dev < 0 || me < 0) {
          throw new DomainError('Las cantidades devueltas no pueden ser negativas.');
        }
        if (dev + me > desp) {
          throw new DomainError(
            `Material ${line.codigoMaterial}: la suma de Devuelto BE (${dev}) + M/E (${me}) supera lo despachado (${desp}).`,
          );
        }

        await tx
          .update(detalleSolicitudApContrata)
          .set({
            cantidadDevuelta: dev.toFixed(2),
            cantidadME: me.toFixed(2),
          })
          .where(eq(detalleSolicitudApContrata.idDetalleSol, item.idDetalleSol));
      }

      if (payload.comentariosAlmacen !== undefined) {
        await tx
          .update(solicitudParentApContrata)
          .set({ comentariosAlmacen: payload.comentariosAlmacen.trim() })
          .where(eq(solicitudParentApContrata.idSolicitud, idSolicitud));
      }

      return { ok: true };
    });
  } catch (error) {
    if (error instanceof DomainError) throw error;
    console.error('Failed to save devoluciones:', error);
    throw new Error('No se pudieron guardar las devoluciones.', { cause: error });
  }
}

export async function finalizarSolicitud(idSolicitud: string, comentariosAlmacen?: string) {
  try {
    return await db.transaction(async (tx) => {
      const parent = await tx
        .select()
        .from(solicitudParentApContrata)
        .where(eq(solicitudParentApContrata.idSolicitud, idSolicitud));
      if (parent.length === 0) throw new DomainError('Solicitud no encontrada.', 404);
      if (parent[0].estadoSolicitud !== 'Atendida') {
        throw new DomainError('Solo se pueden finalizar solicitudes en estado Atendida.');
      }

      const updated = await tx
        .update(solicitudParentApContrata)
        .set({
          estadoSolicitud: 'Finalizada',
          comentariosAlmacen:
            comentariosAlmacen !== undefined
              ? comentariosAlmacen.trim()
              : parent[0].comentariosAlmacen,
          fechaFinalizacion: new Date(),
        })
        .where(eq(solicitudParentApContrata.idSolicitud, idSolicitud))
        .returning();

      return updated[0];
    });
  } catch (error) {
    if (error instanceof DomainError) throw error;
    console.error('Failed to finalizar solicitud:', error);
    throw new Error('No se pudo finalizar la solicitud.', { cause: error });
  }
}

export async function cancelarSolicitud(
  idSolicitud: string,
  payload: { motivoCancelacion: string; atendidoPor: string },
) {
  if (!payload.motivoCancelacion.trim()) {
    throw new DomainError('Debes indicar el motivo de cancelación.');
  }

  try {
    return await db.transaction(async (tx) => {
      const parent = await tx
        .select()
        .from(solicitudParentApContrata)
        .where(eq(solicitudParentApContrata.idSolicitud, idSolicitud));
      if (parent.length === 0) throw new DomainError('Solicitud no encontrada.', 404);
      if (parent[0].estadoSolicitud !== 'Pendiente') {
        throw new DomainError('Solo se pueden cancelar solicitudes en estado Pendiente.');
      }

      await tx
        .update(detalleSolicitudApContrata)
        .set({ cantidadDespachada: '0', cantidadDevuelta: '0', cantidadME: '0' })
        .where(eq(detalleSolicitudApContrata.idSolicitud, idSolicitud));

      const updated = await tx
        .update(solicitudParentApContrata)
        .set({
          estadoSolicitud: 'Cancelada',
          motivoCancelacion: payload.motivoCancelacion.trim(),
          atendidoPor: payload.atendidoPor,
        })
        .where(eq(solicitudParentApContrata.idSolicitud, idSolicitud))
        .returning();

      return updated[0];
    });
  } catch (error) {
    if (error instanceof DomainError) throw error;
    console.error('Failed to cancelar solicitud:', error);
    throw new Error('No se pudo cancelar la solicitud.', { cause: error });
  }
}

export async function getConsolidadoRows() {
  try {
    const rows = await db
      .select({
        idDetalleSol: detalleSolicitudApContrata.idDetalleSol,
        idSolicitud: solicitudParentApContrata.idSolicitud,
        secuenciaNum: solicitudParentApContrata.secuenciaNum,
        fechaSolicitud: solicitudParentApContrata.fechaSolicitud,
        idSolicitante: solicitudParentApContrata.idSolicitante,
        area: solicitudParentApContrata.area,
        bom: solicitudParentApContrata.bom,
        capataz: solicitudParentApContrata.capataz,
        tipoInventario: solicitudParentApContrata.tipoInventario,
        tipoAtencion: solicitudParentApContrata.tipoAtencion,
        estadoSolicitud: solicitudParentApContrata.estadoSolicitud,
        numeroObraIncidencia: detalleSolicitudApContrata.numeroObraIncidencia,
        codigoMaterial: detalleSolicitudApContrata.codigoMaterial,
        nombreMaterial: inventarioApContrata.nombreMaterial,
        um: inventarioApContrata.um,
        precioUnit: inventarioApContrata.precio,
        cantidadSolicitada: detalleSolicitudApContrata.cantidadSolicitada,
        cantidadDespachada: detalleSolicitudApContrata.cantidadDespachada,
        cantidadDevuelta: detalleSolicitudApContrata.cantidadDevuelta,
        cantidadME: detalleSolicitudApContrata.cantidadME,
      })
      .from(detalleSolicitudApContrata)
      .innerJoin(
        solicitudParentApContrata,
        eq(detalleSolicitudApContrata.idSolicitud, solicitudParentApContrata.idSolicitud),
      )
      .innerJoin(
        inventarioApContrata,
        eq(detalleSolicitudApContrata.codigoMaterial, inventarioApContrata.codigoMaterial),
      )
      .orderBy(desc(solicitudParentApContrata.secuenciaNum), asc(detalleSolicitudApContrata.idDetalleSol));

    const empRows = await db.select().from(empleados);
    const empMap = new Map(empRows.map((e) => [e.cedula, e.nombreCompleto]));

    return rows.map((r) => {
      const solicitada = Number(r.cantidadSolicitada);
      const despachada = Number(r.cantidadDespachada);
      const devuelta = Number(r.cantidadDevuelta);
      const me = Number(r.cantidadME);
      const consumoNeto = Number((despachada - devuelta).toFixed(2));
      const precioUnit = Number(r.precioUnit);

      return {
        idDetalleSol: r.idDetalleSol,
        idSolicitud: r.idSolicitud,
        fechaSolicitud: r.fechaSolicitud,
        idSolicitante: r.idSolicitante,
        area: r.area,
        bom: r.bom,
        capatazNombre: empMap.get(r.capataz) ?? r.capataz,
        tipoInventario: r.tipoInventario,
        tipoAtencion: r.tipoAtencion,
        estadoSolicitud: r.estadoSolicitud,
        numeroObraIncidencia: r.numeroObraIncidencia,
        codigoMaterial: r.codigoMaterial,
        nombreMaterial: r.nombreMaterial,
        um: r.um,
        precioUnit,
        cantidadSolicitada: solicitada,
        cantidadDespachada: despachada,
        cantidadDevuelta: devuelta,
        cantidadME: me,
        consumoNeto,
        costoNeto: Number((consumoNeto * precioUnit).toFixed(2)),
      };
    });
  } catch (error) {
    console.error('Failed to get consolidado:', error);
    throw new Error('No se pudo generar el consolidado de materiales.', { cause: error });
  }
}

export async function registrarEntradaInventario(payload: {
  subtipoMovimiento: string;
  numeroFactura: string;
  proveedor: string;
  recibidoPor: string;
  observaciones: string;
  items: Array<{ codigoMaterial: string; cantidad: number; costoUnitario: number }>;
}) {
  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    throw new DomainError('Agrega al menos un material a la entrada.');
  }
  for (const item of payload.items) {
    if (!item.codigoMaterial || !Number.isFinite(item.cantidad) || item.cantidad <= 0) {
      throw new DomainError('Cada material debe tener cantidad mayor a 0.');
    }
    if (!Number.isFinite(item.costoUnitario) || item.costoUnitario < 0) {
      throw new DomainError('El costo unitario no puede ser negativo.');
    }
  }

  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(71002)`);
      const countRow = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(entradasApContrata);
      const nextNum = (countRow[0]?.count ?? 0) + 1;
      const idTransaccion = `ENTAP_${String(nextNum).padStart(4, '0')}`;

      await tx.insert(entradasApContrata).values({
        idTransaccion,
        subtipoMovimiento: payload.subtipoMovimiento || 'Compra',
        numeroFactura: payload.numeroFactura.trim(),
        proveedor: payload.proveedor.trim(),
        recibidoPor: payload.recibidoPor,
        observaciones: payload.observaciones.trim(),
      });

      for (const item of payload.items) {
        const total = item.cantidad * item.costoUnitario;
        await tx.insert(detalleEntradaApContrata).values({
          idTransaccion,
          codigoMaterial: item.codigoMaterial,
          cantidad: item.cantidad.toFixed(2),
          costoUnitario: item.costoUnitario.toFixed(2),
          costoTotal: total.toFixed(2),
        });

        // Update stock entrances total and overwrite Precio when costoUnitario > 0
        if (item.costoUnitario > 0) {
          await tx
            .update(inventarioApContrata)
            .set({
              entradasTotal: sql`${inventarioApContrata.entradasTotal} + ${item.cantidad.toFixed(2)}::numeric`,
              precio: item.costoUnitario.toFixed(2),
            })
            .where(eq(inventarioApContrata.codigoMaterial, item.codigoMaterial));
        } else {
          await tx
            .update(inventarioApContrata)
            .set({
              entradasTotal: sql`${inventarioApContrata.entradasTotal} + ${item.cantidad.toFixed(2)}::numeric`,
            })
            .where(eq(inventarioApContrata.codigoMaterial, item.codigoMaterial));
        }
      }

      return { idTransaccion };
    });
  } catch (error) {
    if (error instanceof DomainError) throw error;
    console.error('Failed to register entrada:', error);
    throw new Error('No se pudo registrar la entrada de inventario.', { cause: error });
  }
}
