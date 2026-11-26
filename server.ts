import express from 'express';
import * as dotenv from 'dotenv';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { requireAnyRole, requireAuth, type AuthRequest } from './src/middleware/auth.ts';
import {
  deletePendingEmail,
  listAllUsersAndPending,
  sanitizeRoles,
  setUserRoles,
  toggleUserActive,
  upsertPendingEmailRoles,
} from './src/db/users.ts';
import {
  addDetalleMaterial,
  cancelarSolicitud,
  createSolicitud,
  deleteDetalleMaterial,
  despacharSolicitud,
  DomainError,
  finalizarSolicitud,
  getConsolidadoRows,
  getEmpleadosList,
  getInventarioList,
  getSolicitudById,
  guardarDevolucionesQuickEdit,
  listSolicitudes,
  registrarEntradaInventario,
  updateDetalleSolicitado,
} from './src/db/apContrata.ts';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '1mb' }));

function sendError(res: express.Response, error: unknown, fallback = 'Error interno del servidor.') {
  if (error instanceof DomainError) {
    return res.status(error.status).json({ error: error.message });
  }
  const message = error instanceof Error ? error.message : fallback;
  return res.status(500).json({ error: message });
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// Current authenticated user + DB roles + simulated roles (for Admins)
app.get('/api/me', requireAuth, (req: AuthRequest, res) => {
  res.json({
    user: req.authUser,
    effectiveRoles: req.effectiveRoles,
    isSimulatingRoles: Boolean(req.isSimulatingRoles),
  });
});

// Catalogs
app.get('/api/empleados', requireAuth, async (_req, res) => {
  try {
    const data = await getEmpleadosList();
    res.json(data);
  } catch (error) {
    sendError(res, error);
  }
});

app.get('/api/inventario', requireAuth, async (_req, res) => {
  try {
    const data = await getInventarioList();
    res.json(data);
  } catch (error) {
    sendError(res, error);
  }
});

app.post(
  '/api/entradas',
  requireAuth,
  requireAnyRole(['Administrador', 'Jefe de Almacen', 'Editor']),
  async (req: AuthRequest, res) => {
    try {
      const result = await registrarEntradaInventario({
        subtipoMovimiento: String(req.body?.subtipoMovimiento ?? 'Compra'),
        numeroFactura: String(req.body?.numeroFactura ?? ''),
        proveedor: String(req.body?.proveedor ?? ''),
        recibidoPor: req.authUser?.email ?? '',
        observaciones: String(req.body?.observaciones ?? ''),
        items: Array.isArray(req.body?.items) ? req.body.items : [],
      });
      res.status(201).json(result);
    } catch (error) {
      sendError(res, error);
    }
  },
);

// Solicitudes AP Contrata
app.get('/api/solicitudes', requireAuth, async (_req, res) => {
  try {
    const data = await listSolicitudes();
    res.json(data);
  } catch (error) {
    sendError(res, error);
  }
});

app.get('/api/solicitudes/:id', requireAuth, async (req, res) => {
  try {
    const data = await getSolicitudById(String(req.params.id));
    if (!data) return res.status(404).json({ error: 'Solicitud no encontrada.' });
    return res.json(data);
  } catch (error) {
    return sendError(res, error);
  }
});

app.post(
  '/api/solicitudes',
  requireAuth,
  requireAnyRole(['Administrador', 'Generador', 'Solicitante', 'Jefe de Almacen', 'Editor']),
  async (req: AuthRequest, res) => {
    try {
      const roles = req.effectiveRoles ?? [];
      const tipoAtencion = String(req.body?.tipoAtencion ?? 'Normal');
      const isOnlyWarehouse =
        roles.includes('Jefe de Almacen') &&
        !roles.includes('Administrador') &&
        !roles.includes('Generador') &&
        !roles.includes('Solicitante');

      if (isOnlyWarehouse && tipoAtencion !== 'Emergencia Nocturna') {
        return res.status(403).json({
          error:
            'El rol Jefe de Almacen solo puede crear solicitudes de tipo Emergencia Nocturna.',
        });
      }

      const result = await createSolicitud({
        solicitanteUid: req.authUser!.uid,
        idSolicitante: req.authUser!.email,
        area: String(req.body?.area ?? ''),
        bom: String(req.body?.bom ?? ''),
        capataz: String(req.body?.capataz ?? ''),
        tipoInventario: String(req.body?.tipoInventario ?? 'Aporte Contrata'),
        tipoAtencion,
        comentariosSolicitante: String(req.body?.comentariosSolicitante ?? ''),
        items: Array.isArray(req.body?.items) ? req.body.items : [],
      });
      return res.status(201).json(result);
    } catch (error) {
      return sendError(res, error);
    }
  },
);

app.post(
  '/api/solicitudes/:id/detalles',
  requireAuth,
  requireAnyRole(['Administrador', 'Generador', 'Solicitante', 'Editor']),
  async (req: AuthRequest, res) => {
    try {
      const created = await addDetalleMaterial(String(req.params.id), {
        codigoMaterial: String(req.body?.codigoMaterial ?? ''),
        numeroObraIncidencia: String(req.body?.numeroObraIncidencia ?? ''),
        cantidadSolicitada: Number(req.body?.cantidadSolicitada),
      });
      res.status(201).json(created);
    } catch (error) {
      sendError(res, error);
    }
  },
);

app.patch(
  '/api/solicitudes/:id/detalles/:idDetalle',
  requireAuth,
  requireAnyRole(['Administrador', 'Generador', 'Solicitante', 'Editor']),
  async (req: AuthRequest, res) => {
    try {
      const updated = await updateDetalleSolicitado(
        String(req.params.id),
        Number(req.params.idDetalle),
        {
          cantidadSolicitada: Number(req.body?.cantidadSolicitada),
          numeroObraIncidencia:
            typeof req.body?.numeroObraIncidencia === 'string'
              ? req.body.numeroObraIncidencia
              : undefined,
        },
      );
      res.json(updated);
    } catch (error) {
      sendError(res, error);
    }
  },
);

app.delete(
  '/api/solicitudes/:id/detalles/:idDetalle',
  requireAuth,
  requireAnyRole(['Administrador', 'Generador', 'Solicitante', 'Editor']),
  async (req: AuthRequest, res) => {
    try {
      const deleted = await deleteDetalleMaterial(
        String(req.params.id),
        Number(req.params.idDetalle),
      );
      res.json(deleted);
    } catch (error) {
      sendError(res, error);
    }
  },
);

app.post(
  '/api/solicitudes/:id/despachar',
  requireAuth,
  requireAnyRole(['Administrador', 'Jefe de Almacen']),
  async (req: AuthRequest, res) => {
    try {
      const result = await despacharSolicitud(String(req.params.id), {
        atendidoPor: req.authUser!.email,
        entregadoPor: String(req.body?.entregadoPor ?? ''),
        comentariosAlmacen: String(req.body?.comentariosAlmacen ?? ''),
        items: Array.isArray(req.body?.items) ? req.body.items : [],
      });
      res.json(result);
    } catch (error) {
      sendError(res, error);
    }
  },
);

app.patch(
  '/api/solicitudes/:id/devoluciones',
  requireAuth,
  requireAnyRole(['Administrador', 'Jefe de Almacen']),
  async (req: AuthRequest, res) => {
    try {
      const result = await guardarDevolucionesQuickEdit(String(req.params.id), {
        comentariosAlmacen:
          typeof req.body?.comentariosAlmacen === 'string'
            ? req.body.comentariosAlmacen
            : undefined,
        items: Array.isArray(req.body?.items) ? req.body.items : [],
      });
      res.json(result);
    } catch (error) {
      sendError(res, error);
    }
  },
);

app.post(
  '/api/solicitudes/:id/finalizar',
  requireAuth,
  requireAnyRole(['Administrador', 'Jefe de Almacen']),
  async (req: AuthRequest, res) => {
    try {
      const result = await finalizarSolicitud(
        String(req.params.id),
        typeof req.body?.comentariosAlmacen === 'string'
          ? req.body.comentariosAlmacen
          : undefined,
      );
      res.json(result);
    } catch (error) {
      sendError(res, error);
    }
  },
);

app.post(
  '/api/solicitudes/:id/cancelar',
  requireAuth,
  requireAnyRole(['Administrador', 'Generador', 'Solicitante', 'Jefe de Almacen']),
  async (req: AuthRequest, res) => {
    try {
      const result = await cancelarSolicitud(String(req.params.id), {
        motivoCancelacion: String(req.body?.motivoCancelacion ?? ''),
        atendidoPor: req.authUser!.email,
      });
      res.json(result);
    } catch (error) {
      sendError(res, error);
    }
  },
);

// Consolidado General (visible regardless of role)
app.get('/api/consolidado', requireAuth, async (_req, res) => {
  try {
    const data = await getConsolidadoRows();
    res.json(data);
  } catch (error) {
    sendError(res, error);
  }
});

// Multi-Role User Management (Administrators only — checks real DB roles!)
app.get('/api/usuarios', requireAuth, (req: AuthRequest, res, next) => {
  if (!req.authUser?.roles.includes('Administrador')) {
    return res
      .status(403)
      .json({ error: 'Solo un Administrador real puede gestionar usuarios y multi-roles.' });
  }
  return next();
}, async (_req, res) => {
  try {
    const data = await listAllUsersAndPending();
    res.json(data);
  } catch (error) {
    sendError(res, error);
  }
});

app.put('/api/usuarios/:id/roles', requireAuth, async (req: AuthRequest, res) => {
  if (!req.authUser?.roles.includes('Administrador')) {
    return res
      .status(403)
      .json({ error: 'Solo un Administrador real puede modificar roles.' });
  }
  try {
    const userId = Number(req.params.id);
    const roles = sanitizeRoles(req.body?.roles);
    if (userId === req.authUser.id && !roles.includes('Administrador')) {
      return res.status(400).json({
        error:
          'No puedes quitarte el rol Administrador a ti mismo. Usa el Simulador de Roles en la barra superior para probar otros perfiles sin perder acceso.',
      });
    }
    const updated = await setUserRoles(
      userId,
      roles,
      typeof req.body?.nombre === 'string' ? req.body.nombre : undefined,
      typeof req.body?.almacen === 'string' ? req.body.almacen : undefined,
    );
    return res.json(updated);
  } catch (error) {
    return sendError(res, error);
  }
});

app.patch('/api/usuarios/:id/estado', requireAuth, async (req: AuthRequest, res) => {
  if (!req.authUser?.roles.includes('Administrador')) {
    return res.status(403).json({ error: 'Solo un Administrador real puede activar/desactivar.' });
  }
  try {
    const userId = Number(req.params.id);
    if (userId === req.authUser.id && req.body?.activo === false) {
      return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta.' });
    }
    const updated = await toggleUserActive(userId, Boolean(req.body?.activo));
    return res.json(updated);
  } catch (error) {
    return sendError(res, error);
  }
});

app.post('/api/usuarios/preasignar', requireAuth, async (req: AuthRequest, res) => {
  if (!req.authUser?.roles.includes('Administrador')) {
    return res.status(403).json({ error: 'Solo un Administrador real puede preasignar cuentas.' });
  }
  try {
    const roles = sanitizeRoles(req.body?.roles);
    const result = await upsertPendingEmailRoles(
      String(req.body?.email ?? ''),
      roles,
      String(req.body?.nombre ?? ''),
      String(req.body?.almacen ?? 'Almacén Central'),
    );
    return res.status(201).json(result);
  } catch (error) {
    return sendError(res, error);
  }
});

app.delete('/api/usuarios/pendientes/:email', requireAuth, async (req: AuthRequest, res) => {
  if (!req.authUser?.roles.includes('Administrador')) {
    return res.status(403).json({ error: 'Solo un Administrador real puede eliminar.' });
  }
  try {
    await deletePendingEmail(decodeURIComponent(String(req.params.email)));
    return res.json({ ok: true });
  } catch (error) {
    return sendError(res, error);
  }
});

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
