import React, { useState } from 'react';
import { PackagePlus, X, Plus, Trash2 } from 'lucide-react';
import { SUBTIPOS_ENTRADA } from '../lib/constants.ts';
import { useAuth } from '../context/AuthContext.tsx';
import type { InventarioItem } from '../types.ts';

interface InventarioViewProps {
  inventario: InventarioItem[];
  onRefresh: () => void;
}

export const InventarioView: React.FC<InventarioViewProps> = ({ inventario, onRefresh }) => {
  const { effectiveRoles, apiFetch } = useAuth();
  const [search, setSearch] = useState('');
  const [showEntrada, setShowEntrada] = useState(false);

  const [subtipoMovimiento, setSubtipoMovimiento] = useState<string>('Compra');
  const [numeroFactura, setNumeroFactura] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [lines, setLines] = useState<Array<{ codigoMaterial: string; cantidad: string; costoUnitario: string }>>([
    {
      codigoMaterial: inventario[0]?.codigoMaterial ?? '',
      cantidad: '10',
      costoUnitario: String(inventario[0]?.precio ?? 0),
    },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const canRegisterEntry = effectiveRoles.some((r) =>
    ['Administrador', 'Jefe de Almacen', 'Editor'].includes(r),
  );

  const filtered = inventario.filter((i) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      i.codigoMaterial.toLowerCase().includes(q) ||
      i.nombreMaterial.toLowerCase().includes(q) ||
      i.familia.toLowerCase().includes(q)
    );
  });

  const handleOpenEntrada = () => {
    setError(null);
    setFeedback(null);
    setLines([
      {
        codigoMaterial: inventario[0]?.codigoMaterial ?? '',
        cantidad: '10',
        costoUnitario: String(inventario[0]?.precio ?? 0),
      },
    ]);
    setShowEntrada(true);
  };

  const handleSubmitEntrada = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch<{ idTransaccion: string }>('/api/entradas', {
        method: 'POST',
        body: JSON.stringify({
          subtipoMovimiento,
          numeroFactura,
          proveedor,
          observaciones,
          items: lines.map((l) => ({
            codigoMaterial: l.codigoMaterial,
            cantidad: Number(l.cantidad),
            costoUnitario: Number(l.costoUnitario),
          })),
        }),
      });
      setShowEntrada(false);
      setNumeroFactura('');
      setProveedor('');
      setObservaciones('');
      setFeedback(
        `Entrada ${res.idTransaccion} registrada. El stock y el Precio de catálogo se actualizaron automáticamente.`,
      );
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la entrada.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Inventario AP Contrata</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Existencia calculada en tiempo real: Stock Inicial + Entradas - Despachado + Devuelto BE.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar material o familia..."
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white w-56"
          />
          {canRegisterEntry && (
            <button
              type="button"
              onClick={handleOpenEntrada}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
            >
              <PackagePlus className="w-4 h-4" />
              Registrar Entrada
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
          {feedback}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="text-left py-3 px-4 font-medium">Código</th>
                <th className="text-left py-3 px-4 font-medium">Material</th>
                <th className="text-left py-3 px-4 font-medium">Familia</th>
                <th className="text-center py-3 px-4 font-medium">U/M</th>
                <th className="text-right py-3 px-4 font-medium">Precio Unit.</th>
                <th className="text-right py-3 px-4 font-medium">Inicial + Entr.</th>
                <th className="text-right py-3 px-4 font-medium">Despachado</th>
                <th className="text-right py-3 px-4 font-medium">Devuelto BE</th>
                <th className="text-right py-3 px-4 font-medium">Existencia</th>
                <th className="text-right py-3 px-4 font-medium">M/E</th>
                <th className="text-left py-3 px-4 font-medium">Estado Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((item) => {
                const stateColor =
                  item.estadoStock === 'Crítico'
                    ? 'text-red-700 font-semibold'
                    : item.estadoStock === 'Bajo'
                      ? 'text-amber-700 font-semibold'
                      : 'text-emerald-700 font-medium';
                return (
                  <tr key={item.codigoMaterial} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-4 font-mono-num text-slate-600 whitespace-nowrap">
                      {item.codigoMaterial}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-900">{item.nombreMaterial}</td>
                    <td className="py-2.5 px-4 text-slate-600">{item.familia}</td>
                    <td className="py-2.5 px-4 text-center text-slate-500">{item.um}</td>
                    <td className="py-2.5 px-4 text-right font-mono-num text-slate-900">
                      ${item.precio.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono-num text-slate-600">
                      {item.stockInicial + item.entradasTotal}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono-num text-sky-700">
                      {item.despachadoTotal}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono-num text-emerald-700">
                      {item.devueltoTotal}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono-num font-bold text-slate-900">
                      {item.existenciaActual}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono-num text-amber-700">
                      {item.totalME}
                    </td>
                    <td className={`py-2.5 px-4 whitespace-nowrap ${stateColor}`}>
                      {item.estadoStock} (min {item.stockMinimo})
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Registrar Entrada Modal (updates stock + overwrites Precio) */}
      {showEntrada && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Registrar Entrada de Inventario AP Contrata
                </h2>
                <p className="text-xs text-slate-500">
                  Suma stock al inventario y sobrescribe automáticamente el Precio unitario del catálogo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEntrada(false)}
                className="p-2 text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitEntrada} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Subtipo</label>
                  <select
                    value={subtipoMovimiento}
                    onChange={(e) => setSubtipoMovimiento(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    {SUBTIPOS_ENTRADA.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">N° Factura</label>
                  <input
                    type="text"
                    value={numeroFactura}
                    onChange={(e) => setNumeroFactura(e.target.value)}
                    placeholder="FAC-00192"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Proveedor</label>
                  <input
                    type="text"
                    value={proveedor}
                    onChange={(e) => setProveedor(e.target.value)}
                    placeholder="Distribuidora Eléctrica"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-700">Materiales ingresados</span>
                  <button
                    type="button"
                    onClick={() =>
                      setLines((prev) => [
                        ...prev,
                        {
                          codigoMaterial: inventario[0]?.codigoMaterial ?? '',
                          cantidad: '1',
                          costoUnitario: String(inventario[0]?.precio ?? 0),
                        },
                      ])
                    }
                    className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Agregar fila
                  </button>
                </div>

                {lines.map((line, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2 items-center p-2.5 bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <div className="col-span-6">
                      <select
                        value={line.codigoMaterial}
                        onChange={(e) => {
                          const code = e.target.value;
                          const mat = inventario.find((m) => m.codigoMaterial === code);
                          setLines((prev) =>
                            prev.map((l, i) =>
                              i === idx
                                ? {
                                    ...l,
                                    codigoMaterial: code,
                                    costoUnitario: mat ? String(mat.precio) : l.costoUnitario,
                                  }
                                : l,
                            ),
                          );
                        }}
                        className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded bg-white"
                      >
                        {inventario.map((item) => (
                          <option key={item.codigoMaterial} value={item.codigoMaterial}>
                            {item.codigoMaterial} — {item.nombreMaterial}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={line.cantidad}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((l, i) => (i === idx ? { ...l, cantidad: e.target.value } : l)),
                          )
                        }
                        placeholder="Cant."
                        className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded bg-white text-right font-mono-num"
                      />
                    </div>
                    <div className="col-span-3">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.costoUnitario}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((l, i) =>
                              i === idx ? { ...l, costoUnitario: e.target.value } : l,
                            ),
                          )
                        }
                        placeholder="Costo Unit."
                        className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded bg-white text-right font-mono-num"
                      />
                    </div>
                    <div className="col-span-1 text-right">
                      <button
                        type="button"
                        disabled={lines.length <= 1}
                        onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                        className="p-1 text-slate-400 hover:text-red-600 disabled:opacity-30 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Observaciones</label>
                <input
                  type="text"
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowEntrada(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
                >
                  {submitting ? 'Guardando...' : 'Guardar Entrada y Actualizar Precios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
