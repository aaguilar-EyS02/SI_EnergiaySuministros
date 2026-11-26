import React, { useEffect, useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { AREAS_OPTIONS, ESTADOS_SOLICITUD, TIPOS_ATENCION } from '../lib/constants.ts';
import { useAuth } from '../context/AuthContext.tsx';
import type { ConsolidadoRow } from '../types.ts';

interface ConsolidadoViewProps {
  onSelectSolicitud: (idSolicitud: string) => void;
}

function escapeCsvCell(val: string | number): string {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export const ConsolidadoView: React.FC<ConsolidadoViewProps> = ({ onSelectSolicitud }) => {
  const { apiFetch } = useAuth();
  const [rows, setRows] = useState<ConsolidadoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState('Todas');
  const [estadoFilter, setEstadoFilter] = useState('Todos');
  const [atencionFilter, setAtencionFilter] = useState('Todas');

  const loadConsolidado = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<ConsolidadoRow[]>('/api/consolidado');
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el consolidado.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadConsolidado();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (areaFilter !== 'Todas' && r.area !== areaFilter) return false;
      if (estadoFilter !== 'Todos' && r.estadoSolicitud !== estadoFilter) return false;
      if (atencionFilter !== 'Todas' && r.tipoAtencion !== atencionFilter) return false;
      if (!q) return true;
      return (
        r.idSolicitud.toLowerCase().includes(q) ||
        r.numeroObraIncidencia.toLowerCase().includes(q) ||
        r.codigoMaterial.toLowerCase().includes(q) ||
        r.nombreMaterial.toLowerCase().includes(q) ||
        r.capatazNombre.toLowerCase().includes(q) ||
        r.area.toLowerCase().includes(q)
      );
    });
  }, [rows, search, areaFilter, estadoFilter, atencionFilter]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, r) => {
        acc.solicitado += r.cantidadSolicitada;
        acc.despachado += r.cantidadDespachada;
        acc.devuelto += r.cantidadDevuelta;
        acc.me += r.cantidadME;
        acc.neto += r.consumoNeto;
        acc.costo += r.costoNeto;
        return acc;
      },
      { solicitado: 0, despachado: 0, devuelto: 0, me: 0, neto: 0, costo: 0 },
    );
  }, [filtered]);

  const handleExportCsv = () => {
    const headers = [
      'IdSolicitud',
      'FechaSolicitud',
      'Area',
      'BOM',
      'Capataz',
      'TipoInventario',
      'TipoAtencion',
      'EstadoSolicitud',
      'NumeroObra_Incidencia',
      'CodigoMaterial',
      'NombreMaterial',
      'UM',
      'CantidadSolicitada',
      'Cantidaddespachada',
      'CantidadDevuelta',
      'CantidadME',
      'ConsumoNeto',
      'PrecioUnit',
      'CostoNeto',
    ];

    const lines = [
      headers.join(','),
      ...filtered.map((r) =>
        [
          r.idSolicitud,
          new Date(r.fechaSolicitud).toISOString().slice(0, 19).replace('T', ' '),
          r.area,
          r.bom,
          r.capatazNombre,
          r.tipoInventario,
          r.tipoAtencion,
          r.estadoSolicitud,
          r.numeroObraIncidencia,
          r.codigoMaterial,
          r.nombreMaterial,
          r.um,
          r.cantidadSolicitada,
          r.cantidadDespachada,
          r.cantidadDevuelta,
          r.cantidadME,
          r.consumoNeto,
          r.precioUnit.toFixed(2),
          r.costoNeto.toFixed(2),
        ]
          .map(escapeCsvCell)
          .join(','),
      ),
    ];

    // UTF-8 BOM ensures Excel in Spanish opens accents and columns cleanly
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Consolidado_APContrata_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Consolidado General de Materiales AP Contrata
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Cruce completo desde PostgreSQL (Solicitudes + Detalles + Inventario) para arqueo por área, sin omisión de columnas.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          disabled={filtered.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="w-4 h-4" />
          Exportar CSV (Excel)
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Summary metrics strip */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Registros</p>
          <p className="mt-1 text-xl font-bold text-slate-900 font-mono-num">{filtered.length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Solicitado</p>
          <p className="mt-1 text-xl font-bold text-slate-900 font-mono-num">
            {totals.solicitado.toLocaleString('es-NI')}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Despachado</p>
          <p className="mt-1 text-xl font-bold text-sky-700 font-mono-num">
            {totals.despachado.toLocaleString('es-NI')}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Devuelto BE</p>
          <p className="mt-1 text-xl font-bold text-emerald-700 font-mono-num">
            {totals.devuelto.toLocaleString('es-NI')}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Consumo Neto</p>
          <p className="mt-1 text-xl font-bold text-slate-900 font-mono-num">
            {totals.neto.toLocaleString('es-NI')}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Valor Neto</p>
          <p className="mt-1 text-xl font-bold text-slate-900 font-mono-num">
            ${totals.costo.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Filters bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar ID, obra, material, capataz..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          />
        </div>

        <select
          value={areaFilter}
          onChange={(e) => setAreaFilter(e.target.value)}
          className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
        >
          <option value="Todas">Todas las Áreas</option>
          {AREAS_OPTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>

        <select
          value={estadoFilter}
          onChange={(e) => setEstadoFilter(e.target.value)}
          className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
        >
          <option value="Todos">Todos los Estados</option>
          {ESTADOS_SOLICITUD.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>

        <select
          value={atencionFilter}
          onChange={(e) => setAtencionFilter(e.target.value)}
          className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
        >
          <option value="Todas">Toda Atención</option>
          {TIPOS_ATENCION.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-9 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No hay movimientos que coincidan con los filtros seleccionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="text-left py-3 px-3 font-medium">Solicitud</th>
                  <th className="text-left py-3 px-3 font-medium">Área / BOM</th>
                  <th className="text-left py-3 px-3 font-medium">Estado</th>
                  <th className="text-left py-3 px-3 font-medium">Obra / Incidencia</th>
                  <th className="text-left py-3 px-3 font-medium">Material</th>
                  <th className="text-right py-3 px-3 font-medium">Solic.</th>
                  <th className="text-right py-3 px-3 font-medium">Desp.</th>
                  <th className="text-right py-3 px-3 font-medium">Dev. BE</th>
                  <th className="text-right py-3 px-3 font-medium">Dev. M/E</th>
                  <th className="text-right py-3 px-3 font-medium">Neto</th>
                  <th className="text-right py-3 px-3 font-medium">Costo Neto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => (
                  <tr key={r.idDetalleSol} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onSelectSolicitud(r.idSolicitud)}
                        className="font-mono-num font-semibold text-sky-700 hover:underline cursor-pointer"
                      >
                        {r.idSolicitud}
                      </button>
                      {r.tipoAtencion === 'Emergencia Nocturna' && (
                        <p className="text-[11px] text-red-700 font-medium">Nocturna</p>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">
                      <p className="font-medium text-slate-900">{r.area}</p>
                      <p className="text-[11px] text-slate-500">{r.bom || r.capatazNombre}</p>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-700 whitespace-nowrap">
                      {r.estadoSolicitud}
                    </td>
                    <td className="py-2.5 px-3 font-mono-num text-slate-700 whitespace-nowrap">
                      {r.numeroObraIncidencia}
                    </td>
                    <td className="py-2.5 px-3">
                      <p className="font-medium text-slate-900">{r.nombreMaterial}</p>
                      <p className="font-mono-num text-[11px] text-slate-500">
                        {r.codigoMaterial} · {r.um}
                      </p>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-num">{r.cantidadSolicitada}</td>
                    <td className="py-2.5 px-3 text-right font-mono-num font-medium text-sky-700">
                      {r.cantidadDespachada}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-num text-emerald-700">
                      {r.cantidadDevuelta}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-num text-amber-700">
                      {r.cantidadME}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-num font-semibold text-slate-900">
                      {r.consumoNeto}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-num text-slate-900">
                      ${r.costoNeto.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
