import React, { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { AREAS_OPTIONS, BOM_OPTIONS, TIPOS_ATENCION, TIPOS_INVENTARIO } from '../lib/constants.ts';
import type { Empleado, InventarioItem } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';

interface DraftLine {
  codigoMaterial: string;
  numeroObraIncidencia: string;
  cantidadSolicitada: string;
}

interface NuevaSolicitudModalProps {
  open: boolean;
  initialTipoAtencion?: 'Normal' | 'Emergencia Nocturna';
  forceEmergencyOnly?: boolean;
  empleados: Empleado[];
  inventario: InventarioItem[];
  onClose: () => void;
  onCreated: (idSolicitud: string) => void;
}

export const NuevaSolicitudModal: React.FC<NuevaSolicitudModalProps> = ({
  open,
  initialTipoAtencion = 'Normal',
  forceEmergencyOnly = false,
  empleados,
  inventario,
  onClose,
  onCreated,
}) => {
  const { apiFetch } = useAuth();
  const [area, setArea] = useState<string>('Alumbrado Público');
  const [bom, setBom] = useState<string>('BOM MASAYA');
  const [capataz, setCapataz] = useState<string>(empleados[0]?.cedula ?? '');
  const [tipoInventario, setTipoInventario] = useState<string>('Aporte Contrata');
  const [tipoAtencion, setTipoAtencion] = useState<'Normal' | 'Emergencia Nocturna'>(
    forceEmergencyOnly ? 'Emergencia Nocturna' : initialTipoAtencion,
  );
  const [comentariosSolicitante, setComentariosSolicitante] = useState<string>('');
  const [obraGeneral, setObraGeneral] = useState<string>('');
  const [lines, setLines] = useState<DraftLine[]>([
    { codigoMaterial: inventario[0]?.codigoMaterial ?? '', numeroObraIncidencia: '', cantidadSolicitada: '1' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const invMap = new Map(inventario.map((i) => [i.codigoMaterial, i]));

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      {
        codigoMaterial: inventario[0]?.codigoMaterial ?? '',
        numeroObraIncidencia: obraGeneral,
        cantidadSolicitada: '1',
      },
    ]);
  };

  const removeLine = (idx: number) => {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateLine = (idx: number, patch: Partial<DraftLine>) => {
    setLines((prev) => prev.map((line, i) => (i === idx ? { ...line, ...patch } : line)));
  };

  const applyObraToAll = (val: string) => {
    setObraGeneral(val);
    setLines((prev) => prev.map((l) => ({ ...l, numeroObraIncidencia: val })));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!capataz) {
      setError('Selecciona un Capataz.');
      return;
    }
    if (!comentariosSolicitante.trim()) {
      setError('Ingresa los comentarios o justificación de la solicitud.');
      return;
    }

    const parsedItems = lines.map((l) => ({
      codigoMaterial: l.codigoMaterial,
      numeroObraIncidencia: (l.numeroObraIncidencia || obraGeneral).trim(),
      cantidadSolicitada: Number(l.cantidadSolicitada),
    }));

    if (parsedItems.length === 0) {
      setError('No se puede guardar una solicitud vacía: agrega al menos 1 material.');
      return;
    }
    for (const item of parsedItems) {
      if (!item.codigoMaterial || !item.numeroObraIncidencia) {
        setError('Todos los materiales deben incluir código y N° de Obra / Incidencia.');
        return;
      }
      if (!Number.isFinite(item.cantidadSolicitada) || item.cantidadSolicitada <= 0) {
        setError('Todas las cantidades solicitadas deben ser mayores a 0.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await apiFetch<{ idSolicitud: string }>('/api/solicitudes', {
        method: 'POST',
        body: JSON.stringify({
          area,
          bom,
          capataz,
          tipoInventario,
          tipoAtencion: forceEmergencyOnly ? 'Emergencia Nocturna' : tipoAtencion,
          comentariosSolicitante,
          items: parsedItems,
        }),
      });
      onCreated(res.idSolicitud);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la solicitud.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-3xl bg-white border border-slate-200 rounded-xl overflow-hidden my-8">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {forceEmergencyOnly ? 'Registrar Emergencia Nocturna' : 'Nueva Solicitud AP Contrata'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              El consecutivo SOLAPC_XXXX se asigna de forma atómica en PostgreSQL al guardar.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-900 rounded-lg cursor-pointer"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Área</label>
              <select
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900"
              >
                {AREAS_OPTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">BOM</label>
              <select
                value={bom}
                onChange={(e) => setBom(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900"
              >
                {BOM_OPTIONS.map((b) => (
                  <option key={b || 'none'} value={b}>
                    {b || 'Sin BOM específico'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Capataz</label>
              <select
                value={capataz}
                onChange={(e) => setCapataz(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900"
              >
                <option value="">Seleccionar capataz...</option>
                {empleados.map((emp) => (
                  <option key={emp.cedula} value={emp.cedula}>
                    {emp.nombreCompleto} ({emp.municipio})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Tipo de Inventario</label>
              <select
                value={tipoInventario}
                onChange={(e) => setTipoInventario(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900"
              >
                {TIPOS_INVENTARIO.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Tipo de Atención</label>
              <select
                value={forceEmergencyOnly ? 'Emergencia Nocturna' : tipoAtencion}
                disabled={forceEmergencyOnly}
                onChange={(e) => setTipoAtencion(e.target.value as 'Normal' | 'Emergencia Nocturna')}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 disabled:bg-slate-100"
              >
                {TIPOS_ATENCION.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                N° Obra / Incidencia general
              </label>
              <input
                type="text"
                value={obraGeneral}
                onChange={(e) => applyObraToAll(e.target.value)}
                placeholder="Ej. INC-2026-4450"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 font-mono-num"
              />
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Detalle de Materiales</h3>
                <p className="text-xs text-slate-500">
                  Requiere al menos 1 material para habilitar el guardado.
                </p>
              </div>
              <button
                type="button"
                onClick={addLine}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar línea
              </button>
            </div>

            <div className="space-y-2.5">
              {lines.map((line, idx) => {
                const mat = invMap.get(line.codigoMaterial);
                return (
                  <div
                    key={idx}
                    className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center p-3 bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <div className="md:col-span-5">
                      <label className="block text-xs text-slate-500 mb-1">Material</label>
                      <select
                        value={line.codigoMaterial}
                        onChange={(e) => updateLine(idx, { codigoMaterial: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white text-slate-900"
                      >
                        {inventario.map((item) => (
                          <option key={item.codigoMaterial} value={item.codigoMaterial}>
                            {item.codigoMaterial} — {item.nombreMaterial}
                          </option>
                        ))}
                      </select>
                      {mat && (
                        <p className="mt-1 text-xs text-slate-500 font-mono-num">
                          Disp: {mat.existenciaActual} {mat.um} · ${mat.precio.toFixed(2)}
                        </p>
                      )}
                    </div>

                    <div className="md:col-span-4">
                      <label className="block text-xs text-slate-500 mb-1">N° Obra / Incidencia</label>
                      <input
                        type="text"
                        value={line.numeroObraIncidencia}
                        onChange={(e) => updateLine(idx, { numeroObraIncidencia: e.target.value })}
                        placeholder="INC-2026-..."
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white text-slate-900 font-mono-num"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs text-slate-500 mb-1">Cant. Sol.</label>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={line.cantidadSolicitada}
                        onChange={(e) => updateLine(idx, { cantidadSolicitada: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white text-slate-900 font-mono-num text-right"
                      />
                    </div>

                    <div className="md:col-span-1 flex justify-end pt-4">
                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
                        disabled={lines.length <= 1}
                        className="p-1.5 text-slate-400 hover:text-red-600 disabled:opacity-30 cursor-pointer"
                        aria-label="Eliminar línea"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Comentarios del Solicitante
            </label>
            <textarea
              rows={2}
              value={comentariosSolicitante}
              onChange={(e) => setComentariosSolicitante(e.target.value)}
              placeholder="Detalle de ubicación, sector, o referencia de turno nocturno..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900"
            />
          </div>

          <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
            >
              {submitting ? 'Guardando...' : 'Guardar Solicitud'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
