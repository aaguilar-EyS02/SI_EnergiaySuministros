import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Printer,
  Plus,
  Trash2,
  Pencil,
  Save,
  XCircle,
  Lock,
  PackageCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import type { Empleado, InventarioItem, SolicitudParent } from '../types.ts';

interface SolicitudDetailViewProps {
  idSolicitud: string;
  empleados: Empleado[];
  inventario: InventarioItem[];
  onBack: () => void;
  onChanged: () => void;
}

export const SolicitudDetailView: React.FC<SolicitudDetailViewProps> = ({
  idSolicitud,
  empleados,
  inventario,
  onBack,
  onChanged,
}) => {
  const { effectiveRoles, apiFetch } = useAuth();
  const [solicitud, setSolicitud] = useState<SolicitudParent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Add item (Pendiente - Generador/Solicitante/Admin)
  const [showAddRow, setShowAddRow] = useState(false);
  const [newCodigo, setNewCodigo] = useState(inventario[0]?.codigoMaterial ?? '');
  const [newObra, setNewObra] = useState('');
  const [newCantSol, setNewCantSol] = useState('1');

  // Edit single line CantidadSolicitada (Pendiente)
  const [editingLineId, setEditingLineId] = useState<number | null>(null);
  const [editCantSol, setEditCantSol] = useState('');
  const [editObra, setEditObra] = useState('');

  // Despacho panel (Pendiente -> Atendida for Jefe de Almacen / Admin)
  const [showDespacho, setShowDespacho] = useState(false);
  const [entregadoPor, setEntregadoPor] = useState(empleados[0]?.cedula ?? '');
  const [comentariosAlmacen, setComentariosAlmacen] = useState('');
  const [despachoQtyMap, setDespachoQtyMap] = useState<Record<number, string>>({});

  // QuickEdit Devoluciones inline (Atendida for Jefe de Almacen / Admin)
  const [quickEditActive, setQuickEditActive] = useState(false);
  const [devolucionMap, setDevolucionMap] = useState<Record<number, { be: string; me: string }>>({});
  const [comentariosDev, setComentariosDev] = useState('');

  // Cancel modal
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [motivoCancel, setMotivoCancel] = useState('');

  // Print preview modal
  const [showPrintActa, setShowPrintActa] = useState(false);

  const [busy, setBusy] = useState(false);

  const canEditPendiente = effectiveRoles.some((r) =>
    ['Administrador', 'Generador', 'Solicitante', 'Editor'].includes(r),
  );
  const canWarehouse = effectiveRoles.some((r) => ['Administrador', 'Jefe de Almacen'].includes(r));

  const loadDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<SolicitudParent>(`/api/solicitudes/${encodeURIComponent(idSolicitud)}`);
      setSolicitud(data);
      setNewObra(data.obraResumen.split(',')[0]?.trim() || '');
      const dMap: Record<number, string> = {};
      const qMap: Record<number, { be: string; me: string }> = {};
      for (const d of data.detalles) {
        dMap[d.idDetalleSol] = String(d.cantidadSolicitada);
        qMap[d.idDetalleSol] = {
          be: String(d.cantidadDevuelta),
          me: String(d.cantidadME),
        };
      }
      setDespachoQtyMap(dMap);
      setDevolucionMap(qMap);
      setComentariosDev(data.comentariosAlmacen || '');
      if (data.entregadoPor) setEntregadoPor(data.entregadoPor);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la solicitud.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDetail();
  }, [idSolicitud]);

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      await apiFetch(`/api/solicitudes/${encodeURIComponent(idSolicitud)}/detalles`, {
        method: 'POST',
        body: JSON.stringify({
          codigoMaterial: newCodigo,
          numeroObraIncidencia: newObra,
          cantidadSolicitada: Number(newCantSol),
        }),
      });
      setShowAddRow(false);
      setNewCantSol('1');
      setFeedback('Material agregado a la solicitud.');
      await loadDetail();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al agregar material.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveEditLine = async (idDetalleSol: number) => {
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      await apiFetch(
        `/api/solicitudes/${encodeURIComponent(idSolicitud)}/detalles/${idDetalleSol}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            cantidadSolicitada: Number(editCantSol),
            numeroObraIncidencia: editObra,
          }),
        },
      );
      setEditingLineId(null);
      setFeedback('Cantidad solicitada actualizada.');
      await loadDetail();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la línea.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteLine = async (idDetalleSol: number) => {
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      await apiFetch(
        `/api/solicitudes/${encodeURIComponent(idSolicitud)}/detalles/${idDetalleSol}`,
        { method: 'DELETE' },
      );
      setFeedback('Material eliminado de la solicitud.');
      await loadDetail();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la línea.');
    } finally {
      setBusy(false);
    }
  };

  const handleDespachar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!solicitud) return;
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      const items = solicitud.detalles.map((d) => ({
        idDetalleSol: d.idDetalleSol,
        cantidadDespachada: Number(despachoQtyMap[d.idDetalleSol] ?? d.cantidadSolicitada),
      }));
      await apiFetch(`/api/solicitudes/${encodeURIComponent(idSolicitud)}/despachar`, {
        method: 'POST',
        body: JSON.stringify({
          entregadoPor,
          comentariosAlmacen,
          items,
        }),
      });
      setShowDespacho(false);
      setFeedback('Solicitud despachada. Pasó a estado Atendida y se bloqueó agregar más materiales.');
      await loadDetail();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al despachar la solicitud.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveQuickEditDevoluciones = async () => {
    if (!solicitud) return;
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      const items = solicitud.detalles.map((d) => {
        const entry = devolucionMap[d.idDetalleSol] ?? {
          be: String(d.cantidadDevuelta),
          me: String(d.cantidadME),
        };
        return {
          idDetalleSol: d.idDetalleSol,
          cantidadDevuelta: Number(entry.be || 0),
          cantidadME: Number(entry.me || 0),
        };
      });
      await apiFetch(`/api/solicitudes/${encodeURIComponent(idSolicitud)}/devoluciones`, {
        method: 'PATCH',
        body: JSON.stringify({
          comentariosAlmacen: comentariosDev,
          items,
        }),
      });
      setQuickEditActive(false);
      setFeedback('Devoluciones guardadas desde QuickEdit.');
      await loadDetail();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar devoluciones.');
    } finally {
      setBusy(false);
    }
  };

  const handleFinalizar = async () => {
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      await apiFetch(`/api/solicitudes/${encodeURIComponent(idSolicitud)}/finalizar`, {
        method: 'POST',
        body: JSON.stringify({ comentariosAlmacen: comentariosDev }),
      });
      setQuickEditActive(false);
      setFeedback('Solicitud Finalizada. Todos los campos quedan en solo lectura.');
      await loadDetail();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo finalizar.');
    } finally {
      setBusy(false);
    }
  };

  const handleCancelar = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/solicitudes/${encodeURIComponent(idSolicitud)}/cancelar`, {
        method: 'POST',
        body: JSON.stringify({ motivoCancelacion: motivoCancel }),
      });
      setShowCancelModal(false);
      setFeedback('Solicitud cancelada conservando el consecutivo.');
      await loadDetail();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cancelar.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 space-y-4">
        <div className="h-6 w-48 bg-slate-100 rounded animate-pulse" />
        <div className="h-24 w-full bg-slate-100 rounded animate-pulse" />
        <div className="h-48 w-full bg-slate-100 rounded animate-pulse" />
      </div>
    );
  }

  if (!solicitud) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
        <p className="text-sm text-slate-600">{error || 'Solicitud no encontrada.'}</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-4 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg cursor-pointer"
        >
          Volver a Solicitudes
        </button>
      </div>
    );
  }

  const estadoColor =
    solicitud.estadoSolicitud === 'Finalizada'
      ? 'text-emerald-700'
      : solicitud.estadoSolicitud === 'Atendida'
        ? 'text-sky-700'
        : solicitud.estadoSolicitud === 'Cancelada'
          ? 'text-red-700'
          : 'text-amber-700';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 no-print">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al listado
        </button>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowPrintActa(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Vista Acta / PDF
          </button>

          {solicitud.estadoSolicitud === 'Pendiente' && canWarehouse && (
            <button
              type="button"
              onClick={() => setShowDespacho((v) => !v)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-sky-700 hover:bg-sky-800 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
            >
              <PackageCheck className="w-4 h-4" />
              Despachar Materiales
            </button>
          )}

          {solicitud.estadoSolicitud === 'Pendiente' && (canEditPendiente || canWarehouse) && (
            <button
              type="button"
              onClick={() => setShowCancelModal(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-red-700 bg-white border border-red-200 hover:bg-red-50 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
            >
              <XCircle className="w-4 h-4" />
              Cancelar Solicitud
            </button>
          )}

          {solicitud.estadoSolicitud === 'Atendida' && canWarehouse && (
            <button
              type="button"
              onClick={handleFinalizar}
              disabled={busy || quickEditActive}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              Finalizar Solicitud
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 no-print">
          {error}
        </div>
      )}
      {feedback && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 no-print">
          {feedback}
        </div>
      )}

      {/* Header metadata card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 no-print">
        <div className="flex flex-wrap items-baseline justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2.5 text-xs text-slate-500">
              <span>{solicitud.tipoInventario}</span>
              <span aria-hidden="true">·</span>
              <span className={solicitud.tipoAtencion === 'Emergencia Nocturna' ? 'text-red-700 font-medium' : ''}>
                {solicitud.tipoAtencion}
              </span>
              <span aria-hidden="true">·</span>
              <span>{new Date(solicitud.fechaSolicitud).toLocaleString('es-NI')}</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 font-mono-num">
              {solicitud.idSolicitud}
            </h1>
          </div>

          <div className="text-right">
            <p className="text-xs text-slate-500">Estado actual</p>
            <p className={`text-base font-semibold ${estadoColor}`}>{solicitud.estadoSolicitud}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-5 text-sm">
          <div>
            <p className="text-xs text-slate-500">N° de Obra / Incidencia</p>
            <p className="mt-0.5 font-semibold text-slate-900 font-mono-num">
              {solicitud.obraResumen || '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Área / BOM</p>
            <p className="mt-0.5 font-medium text-slate-900">
              {solicitud.area} {solicitud.bom ? `· ${solicitud.bom}` : ''}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Capataz Asignado</p>
            <p className="mt-0.5 font-medium text-slate-900">{solicitud.capatazNombre}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Solicitante</p>
            <p className="mt-0.5 font-medium text-slate-900 truncate">{solicitud.idSolicitante}</p>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="font-medium text-slate-700">Comentarios Solicitante: </span>
            <span className="text-slate-600">{solicitud.comentariosSolicitante}</span>
          </div>
          {(solicitud.comentariosAlmacen || solicitud.entregadoPorNombre || solicitud.motivoCancelacion) && (
            <div className="space-y-1">
              {solicitud.entregadoPorNombre && (
                <div>
                  <span className="font-medium text-slate-700">Entregado por: </span>
                  <span className="text-slate-600">{solicitud.entregadoPorNombre}</span>
                  {solicitud.atendidoPor && (
                    <span className="text-slate-400"> · Atendido: {solicitud.atendidoPor}</span>
                  )}
                </div>
              )}
              {solicitud.comentariosAlmacen && (
                <div>
                  <span className="font-medium text-slate-700">Almacén: </span>
                  <span className="text-slate-600">{solicitud.comentariosAlmacen}</span>
                </div>
              )}
              {solicitud.motivoCancelacion && (
                <div className="text-red-700">
                  <span className="font-medium">Motivo cancelación: </span>
                  <span>{solicitud.motivoCancelacion}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Despacho Form Panel (only Pendiente + Jefe de Almacen / Admin) */}
      {showDespacho && solicitud.estadoSolicitud === 'Pendiente' && canWarehouse && (
        <form
          onSubmit={handleDespachar}
          className="bg-white border border-sky-200 rounded-xl p-6 space-y-4 no-print"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Confirmar Despacho de Almacén
              </h2>
              <p className="text-xs text-slate-500">
                Ajusta las cantidades reales despachadas por material. Al confirmar, la solicitud pasará a estado Atendida.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Entregado por</label>
              <select
                value={entregadoPor}
                onChange={(e) => setEntregadoPor(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                {empleados.map((emp) => (
                  <option key={emp.cedula} value={emp.cedula}>
                    {emp.nombreCompleto} ({emp.cargo})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Comentarios de Almacén
              </label>
              <input
                type="text"
                value={comentariosAlmacen}
                onChange={(e) => setComentariosAlmacen(e.target.value)}
                placeholder="Observaciones de entrega..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              />
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="text-left py-2.5 px-3 font-medium">Material</th>
                  <th className="text-right py-2.5 px-3 font-medium">Stock Actual</th>
                  <th className="text-right py-2.5 px-3 font-medium">Solicitado</th>
                  <th className="text-right py-2.5 px-3 font-medium">A Despachar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {solicitud.detalles.map((d) => (
                  <tr key={d.idDetalleSol}>
                    <td className="py-2 px-3">
                      <span className="font-mono-num text-slate-500 mr-2">{d.codigoMaterial}</span>
                      <span className="font-medium text-slate-900">{d.nombreMaterial}</span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono-num text-slate-600">
                      {d.stockVirtual ?? 0} {d.um}
                    </td>
                    <td className="py-2 px-3 text-right font-mono-num text-slate-700">
                      {d.cantidadSolicitada}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={despachoQtyMap[d.idDetalleSol] ?? String(d.cantidadSolicitada)}
                        onChange={(e) =>
                          setDespachoQtyMap((prev) => ({
                            ...prev,
                            [d.idDetalleSol]: e.target.value,
                          }))
                        }
                        className="w-24 px-2 py-1 text-right font-mono-num border border-slate-300 rounded bg-white"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowDespacho(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 text-xs font-medium text-white bg-sky-700 hover:bg-sky-800 rounded-lg cursor-pointer"
            >
              {busy ? 'Despachando...' : 'Confirmar y Pasar a Atendida'}
            </button>
          </div>
        </form>
      )}

      {/* Detalle Inline Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden no-print">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Detalle de Materiales ({solicitud.detalles.length})
            </h2>
            <p className="text-xs text-slate-500">
              {solicitud.estadoSolicitud === 'Pendiente'
                ? 'En Pendiente el Generador/Solicitante puede agregar, editar Cantidad Solicitada o quitar líneas.'
                : solicitud.estadoSolicitud === 'Atendida'
                  ? 'En Atendida está bloqueado agregar materiales. Jefe de Almacén puede usar QuickEdit para devoluciones.'
                  : 'Registro cerrado en modo solo lectura.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {solicitud.estadoSolicitud === 'Pendiente' && canEditPendiente && (
              <button
                type="button"
                onClick={() => setShowAddRow((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar Material
              </button>
            )}

            {solicitud.estadoSolicitud === 'Atendida' && canWarehouse && !quickEditActive && (
              <button
                type="button"
                onClick={() => setQuickEditActive(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
                QuickEdit Devoluciones
              </button>
            )}

            {solicitud.estadoSolicitud === 'Atendida' && canWarehouse && quickEditActive && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuickEditActive(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveQuickEditDevoluciones}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-sky-700 hover:bg-sky-800 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  {busy ? 'Guardando...' : 'Guardar Devoluciones'}
                </button>
              </div>
            )}

            {solicitud.estadoSolicitud !== 'Pendiente' &&
              !(solicitud.estadoSolicitud === 'Atendida' && canWarehouse) && (
                <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                  <Lock className="w-3.5 h-3.5" />
                  Solo lectura
                </span>
              )}
          </div>
        </div>

        {/* Inline add row (only Pendiente + Generador/Solicitante) */}
        {showAddRow && solicitud.estadoSolicitud === 'Pendiente' && canEditPendiente && (
          <form
            onSubmit={handleAddMaterial}
            className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
          >
            <div className="md:col-span-5">
              <label className="block text-xs font-medium text-slate-700 mb-1">Material</label>
              <select
                value={newCodigo}
                onChange={(e) => setNewCodigo(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                {inventario.map((item) => (
                  <option key={item.codigoMaterial} value={item.codigoMaterial}>
                    {item.codigoMaterial} — {item.nombreMaterial} (Disp: {item.existenciaActual})
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                N° Obra / Incidencia
              </label>
              <input
                type="text"
                value={newObra}
                onChange={(e) => setNewObra(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-mono-num"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">Cant. Solic.</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={newCantSol}
                onChange={(e) => setNewCantSol(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-mono-num text-right"
              />
            </div>
            <div className="md:col-span-2 flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="flex-1 px-3 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                Agregar
              </button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
              <tr>
                <th className="text-left py-3 px-4 font-medium">Código</th>
                <th className="text-left py-3 px-4 font-medium">Material</th>
                <th className="text-left py-3 px-4 font-medium">U/M</th>
                <th className="text-left py-3 px-4 font-medium">Obra / Incidencia</th>
                <th className="text-right py-3 px-4 font-medium">Solicitado</th>
                <th className="text-right py-3 px-4 font-medium">Despachado</th>
                <th className="text-right py-3 px-4 font-medium">Devuelto BE</th>
                <th className="text-right py-3 px-4 font-medium">Devuelto M/E</th>
                <th className="text-right py-3 px-4 font-medium">Consumo Neto</th>
                {solicitud.estadoSolicitud === 'Pendiente' && canEditPendiente && (
                  <th className="text-right py-3 px-4 font-medium">Acciones</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {solicitud.detalles.map((d) => {
                const isEditingLine = editingLineId === d.idDetalleSol;
                const qEntry = devolucionMap[d.idDetalleSol] ?? {
                  be: String(d.cantidadDevuelta),
                  me: String(d.cantidadME),
                };
                const liveBE = quickEditActive ? Number(qEntry.be || 0) : d.cantidadDevuelta;
                const liveME = quickEditActive ? Number(qEntry.me || 0) : d.cantidadME;
                const invalidQuick = quickEditActive && liveBE + liveME > d.cantidadDespachada;
                const neto = Number((d.cantidadDespachada - liveBE).toFixed(2));

                return (
                  <tr key={d.idDetalleSol} className={invalidQuick ? 'bg-red-50/70' : 'hover:bg-slate-50/70'}>
                    <td className="py-2.5 px-4 font-mono-num text-xs text-slate-600 whitespace-nowrap">
                      {d.codigoMaterial}
                    </td>
                    <td className="py-2.5 px-4 text-slate-900 font-medium">{d.nombreMaterial}</td>
                    <td className="py-2.5 px-4 text-xs text-slate-500">{d.um}</td>
                    <td className="py-2.5 px-4 font-mono-num text-xs text-slate-700">
                      {isEditingLine ? (
                        <input
                          type="text"
                          value={editObra}
                          onChange={(e) => setEditObra(e.target.value)}
                          className="w-32 px-2 py-1 border border-slate-300 rounded bg-white text-xs"
                        />
                      ) : (
                        d.numeroObraIncidencia
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono-num text-slate-900">
                      {isEditingLine ? (
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={editCantSol}
                          onChange={(e) => setEditCantSol(e.target.value)}
                          className="w-20 px-2 py-1 border border-sky-400 rounded bg-white text-right text-xs"
                        />
                      ) : (
                        d.cantidadSolicitada
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono-num text-slate-900 font-medium">
                      {d.cantidadDespachada}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono-num">
                      {quickEditActive ? (
                        <input
                          type="number"
                          min="0"
                          max={d.cantidadDespachada}
                          step="0.01"
                          value={qEntry.be}
                          onChange={(e) =>
                            setDevolucionMap((prev) => ({
                              ...prev,
                              [d.idDetalleSol]: { ...qEntry, be: e.target.value },
                            }))
                          }
                          className="w-20 px-2 py-1 border border-sky-400 rounded bg-white text-right text-xs"
                        />
                      ) : (
                        <span className="text-emerald-700">{d.cantidadDevuelta}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono-num">
                      {quickEditActive ? (
                        <input
                          type="number"
                          min="0"
                          max={d.cantidadDespachada}
                          step="0.01"
                          value={qEntry.me}
                          onChange={(e) =>
                            setDevolucionMap((prev) => ({
                              ...prev,
                              [d.idDetalleSol]: { ...qEntry, me: e.target.value },
                            }))
                          }
                          className="w-20 px-2 py-1 border border-amber-400 rounded bg-white text-right text-xs"
                        />
                      ) : (
                        <span className={d.cantidadME > 0 ? 'text-amber-700 font-medium' : 'text-slate-500'}>
                          {d.cantidadME}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono-num font-semibold text-slate-900">
                      {neto}
                    </td>

                    {solicitud.estadoSolicitud === 'Pendiente' && canEditPendiente && (
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        {isEditingLine ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleSaveEditLine(d.idDetalleSol)}
                              disabled={busy}
                              className="px-2 py-1 text-xs font-medium text-white bg-sky-700 rounded cursor-pointer"
                            >
                              Guardar
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingLineId(null)}
                              className="px-2 py-1 text-xs text-slate-600 cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingLineId(d.idDetalleSol);
                                setEditCantSol(String(d.cantidadSolicitada));
                                setEditObra(d.numeroObraIncidencia);
                              }}
                              className="p-1.5 text-slate-500 hover:text-sky-700 cursor-pointer"
                              title="Editar cantidad solicitada"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteLine(d.idDetalleSol)}
                              disabled={solicitud.detalles.length <= 1 || busy}
                              className="p-1.5 text-slate-400 hover:text-red-600 disabled:opacity-30 cursor-pointer"
                              title="Eliminar material"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {quickEditActive && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div className="flex-1 min-w-[240px]">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Observaciones de devolución (Almacén)
              </label>
              <input
                type="text"
                value={comentariosDev}
                onChange={(e) => setComentariosDev(e.target.value)}
                placeholder="Detalle sobre sobrantes o material en mal estado..."
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
              />
            </div>
            <p className="text-xs text-slate-500">
              Regla: Devuelto BE + Devuelto M/E no puede superar Despachado.
            </p>
          </div>
        )}
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 no-print">
          <form
            onSubmit={handleCancelar}
            className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6 space-y-4"
          >
            <h3 className="text-base font-semibold text-slate-900">
              Cancelar Solicitud {solicitud.idSolicitud}
            </h3>
            <p className="text-xs text-slate-600">
              Se conservará el registro con estado Cancelada para mantener intacto el consecutivo.
            </p>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Motivo de cancelación
              </label>
              <textarea
                rows={3}
                required
                value={motivoCancel}
                onChange={(e) => setMotivoCancel(e.target.value)}
                placeholder="Ej. Requerimiento duplicado / obra reprogramada..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="px-3.5 py-2 text-xs font-medium text-slate-600 cursor-pointer"
              >
                Volver
              </button>
              <button
                type="submit"
                disabled={busy}
                className="px-4 py-2 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer"
              >
                Confirmar Cancelación
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Printable Acta Modal (with single N° Obra / Incidencia in header) */}
      {showPrintActa && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-4xl bg-white rounded-xl p-8 space-y-6 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 no-print">
              <h3 className="text-sm font-semibold text-slate-900">
                Vista Previa de Acta (N° Obra en Encabezado)
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir / Guardar PDF
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintActa(false)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>

            <div className="space-y-6 text-slate-900">
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                <div>
                  <p className="text-xs font-semibold text-slate-600">SI ENERGÍA Y SUMINISTROS</p>
                  <h2 className="text-xl font-bold mt-1">
                    ACTA DE DESPACHO Y DEVOLUCIÓN — APORTE CONTRATA
                  </h2>
                </div>
                <div className="text-right font-mono-num">
                  <p className="text-lg font-bold">{solicitud.idSolicitud}</p>
                  <p className="text-xs text-slate-600">Estado: {solicitud.estadoSolicitud}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs border border-slate-300 p-4 rounded-lg">
                <div>
                  <span className="text-slate-500">Tipo de Inventario:</span>
                  <p className="font-semibold">{solicitud.tipoInventario}</p>
                </div>
                <div>
                  <span className="text-slate-500">N° de Obra / Incidencia:</span>
                  <p className="font-semibold font-mono-num">{solicitud.obraResumen || '—'}</p>
                </div>
                <div>
                  <span className="text-slate-500">Tipo de Atención:</span>
                  <p className="font-semibold">{solicitud.tipoAtencion}</p>
                </div>
                <div>
                  <span className="text-slate-500">Área / BOM:</span>
                  <p className="font-semibold">
                    {solicitud.area} {solicitud.bom ? `· ${solicitud.bom}` : ''}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Capataz:</span>
                  <p className="font-semibold">{solicitud.capatazNombre}</p>
                </div>
                <div>
                  <span className="text-slate-500">Fecha Solicitud:</span>
                  <p className="font-semibold font-mono-num">
                    {new Date(solicitud.fechaSolicitud).toLocaleString('es-NI')}
                  </p>
                </div>
              </div>

              <table className="w-full text-xs border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-300 py-2 px-3 text-left">Código</th>
                    <th className="border border-slate-300 py-2 px-3 text-left">Descripción</th>
                    <th className="border border-slate-300 py-2 px-3 text-center">U/M</th>
                    <th className="border border-slate-300 py-2 px-3 text-right">Solicitado</th>
                    <th className="border border-slate-300 py-2 px-3 text-right">Despachado</th>
                    <th className="border border-slate-300 py-2 px-3 text-right">Devuelto BE</th>
                    <th className="border border-slate-300 py-2 px-3 text-right">Devuelto M/E</th>
                  </tr>
                </thead>
                <tbody>
                  {solicitud.detalles.map((d) => (
                    <tr key={d.idDetalleSol}>
                      <td className="border border-slate-300 py-1.5 px-3 font-mono-num">{d.codigoMaterial}</td>
                      <td className="border border-slate-300 py-1.5 px-3">{d.nombreMaterial}</td>
                      <td className="border border-slate-300 py-1.5 px-3 text-center">{d.um}</td>
                      <td className="border border-slate-300 py-1.5 px-3 text-right font-mono-num">
                        {d.cantidadSolicitada}
                      </td>
                      <td className="border border-slate-300 py-1.5 px-3 text-right font-mono-num">
                        {d.cantidadDespachada}
                      </td>
                      <td className="border border-slate-300 py-1.5 px-3 text-right font-mono-num">
                        {d.cantidadDevuelta}
                      </td>
                      <td className="border border-slate-300 py-1.5 px-3 text-right font-mono-num">
                        {d.cantidadME}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="grid grid-cols-3 gap-8 pt-10 text-center text-xs">
                <div className="border-t border-slate-400 pt-2">
                  <p className="font-semibold">Solicitante</p>
                  <p className="text-slate-500">{solicitud.idSolicitante}</p>
                </div>
                <div className="border-t border-slate-400 pt-2">
                  <p className="font-semibold">Entregado por (Almacén)</p>
                  <p className="text-slate-500">{solicitud.entregadoPorNombre || 'Pendiente'}</p>
                </div>
                <div className="border-t border-slate-400 pt-2">
                  <p className="font-semibold">Recibe Conforme (Capataz)</p>
                  <p className="text-slate-500">{solicitud.capatazNombre}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
