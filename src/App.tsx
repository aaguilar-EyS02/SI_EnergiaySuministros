import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ClipboardList,
  FileSpreadsheet,
  Boxes,
  Users,
  Plus,
  Moon,
  LogOut,
  Search,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { LoginScreen } from './components/LoginScreen.tsx';
import { NuevaSolicitudModal } from './components/NuevaSolicitudModal.tsx';
import { SolicitudDetailView } from './components/SolicitudDetailView.tsx';
import { ConsolidadoView } from './components/ConsolidadoView.tsx';
import { InventarioView } from './components/InventarioView.tsx';
import { UsuariosRolesView } from './components/UsuariosRolesView.tsx';
import { APP_ROLES, type AppRole } from './lib/constants.ts';
import type { Empleado, InventarioItem, SolicitudParent } from './types.ts';

type NavTab = 'solicitudes' | 'consolidado' | 'inventario' | 'usuarios';

const WorkspaceShell: React.FC = () => {
  const {
    authUser,
    effectiveRoles,
    previewRoles,
    isSimulatingRoles,
    loading: authLoading,
    logout,
    setPreviewRoles,
    apiFetch,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<NavTab>('solicitudes');
  const [selectedSolicitudId, setSelectedSolicitudId] = useState<string | null>(null);

  const [solicitudes, setSolicitudes] = useState<SolicitudParent[]>([]);
  const [inventario, setInventario] = useState<InventarioItem[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  const [estadoTab, setEstadoTab] = useState<string>('Todas');
  const [searchQuery, setSearchQuery] = useState('');
  const [modalMode, setModalMode] = useState<null | 'Normal' | 'Emergencia Nocturna'>(null);

  const loadAll = useCallback(async () => {
    if (!authUser) return;
    setLoadingData(true);
    setDataError(null);
    try {
      const [sols, inv, emps] = await Promise.all([
        apiFetch<SolicitudParent[]>('/api/solicitudes'),
        apiFetch<InventarioItem[]>('/api/inventario'),
        apiFetch<Empleado[]>('/api/empleados'),
      ]);
      setSolicitudes(sols);
      setInventario(inv);
      setEmpleados(emps);
    } catch (err) {
      setDataError(err instanceof Error ? err.message : 'No se pudieron cargar los datos.');
    } finally {
      setLoadingData(false);
    }
  }, [authUser, apiFetch]);

  useEffect(() => {
    if (authUser) {
      void loadAll();
    }
  }, [authUser, loadAll]);

  const filteredSolicitudes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return solicitudes.filter((s) => {
      if (estadoTab === 'Emergencia Nocturna') {
        if (s.tipoAtencion !== 'Emergencia Nocturna') return false;
      } else if (estadoTab !== 'Todas' && s.estadoSolicitud !== estadoTab) {
        return false;
      }

      if (!q) return true;
      return (
        s.idSolicitud.toLowerCase().includes(q) ||
        s.area.toLowerCase().includes(q) ||
        s.bom.toLowerCase().includes(q) ||
        s.capatazNombre.toLowerCase().includes(q) ||
        s.obraResumen.toLowerCase().includes(q) ||
        s.idSolicitante.toLowerCase().includes(q)
      );
    });
  }, [solicitudes, estadoTab, searchQuery]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-sm text-slate-600">Verificando sesión Google Workspace...</div>
      </div>
    );
  }

  if (!authUser) {
    return <LoginScreen />;
  }

  const isRealAdmin = authUser.roles.includes('Administrador');
  const canCreateNormal = effectiveRoles.some((r) =>
    ['Administrador', 'Generador', 'Solicitante', 'Editor'].includes(r),
  );
  const canCreateEmergency = effectiveRoles.some((r) =>
    ['Administrador', 'Generador', 'Solicitante', 'Jefe de Almacen', 'Editor'].includes(r),
  );

  const toggleSimulatedRole = (role: AppRole) => {
    const base = previewRoles ?? authUser.roles;
    const exists = base.includes(role);
    const next = exists ? base.filter((r) => r !== role) : [...base, role];
    if (next.length === 0) return;
    setPreviewRoles(next);
  };

  const navItems: Array<{ id: NavTab; label: string; icon: React.ReactNode; visible: boolean }> = [
    {
      id: 'solicitudes',
      label: 'Solicitudes AP Contrata',
      icon: <ClipboardList className="w-4 h-4" />,
      visible: true,
    },
    {
      id: 'consolidado',
      label: 'Consolidado CSV',
      icon: <FileSpreadsheet className="w-4 h-4" />,
      visible: true,
    },
    {
      id: 'inventario',
      label: 'Inventario y Entradas',
      icon: <Boxes className="w-4 h-4" />,
      visible: true,
    },
    {
      id: 'usuarios',
      label: 'Usuarios y Multi-Rol',
      icon: <Users className="w-4 h-4" />,
      visible: isRealAdmin,
    },
  ];

  const breadcrumbTitle =
    activeTab === 'solicitudes'
      ? selectedSolicitudId
        ? `AP Contrata / Solicitudes / ${selectedSolicitudId}`
        : 'AP Contrata / Solicitudes'
      : activeTab === 'consolidado'
        ? 'AP Contrata / Consolidado General'
        : activeTab === 'inventario'
          ? 'AP Contrata / Inventario y Entradas'
          : 'Administración / Usuarios y Multi-Rol';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-slate-200 flex flex-col justify-between shrink-0 no-print">
        <div className="p-5 space-y-6">
          <div>
            <p className="text-base font-bold text-slate-900 font-display tracking-tight">
              SI Energía y Suministros
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Espejo PostgreSQL · AP Contrata</p>
          </div>

          <nav className="space-y-1">
            {navItems
              .filter((n) => n.visible)
              .map((item) => {
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      if (item.id !== 'solicitudes') setSelectedSolicitudId(null);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-slate-900 text-white font-medium'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {item.icon}
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
          </nav>

          {/* Role Simulator Panel for Real Admins to test single & multi-role behavior */}
          {isRealAdmin && (
            <div className="pt-4 border-t border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-900">Probar Roles (Simulador)</p>
                {isSimulatingRoles && (
                  <button
                    type="button"
                    onClick={() => setPreviewRoles(null)}
                    className="inline-flex items-center gap-1 text-[11px] text-sky-700 hover:underline cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Restaurar
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">
                Activa uno o varios roles para validar permisos en pantalla y servidor.
              </p>
              <div className="space-y-1.5">
                {APP_ROLES.map((role) => {
                  const active = effectiveRoles.includes(role);
                  return (
                    <label
                      key={role}
                      className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggleSimulatedRole(role)}
                        className="rounded border-slate-300"
                      />
                      <span>{role}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 space-y-2">
          <div className="text-xs">
            <p className="font-semibold text-slate-900 truncate">{authUser.nombre}</p>
            <p className="text-slate-500 truncate">{authUser.email}</p>
            <p className="mt-1 text-[11px] text-slate-600">
              {isSimulatingRoles ? 'Simulando: ' : 'Roles: '}
              <span className="font-medium text-slate-900">{effectiveRoles.join(' · ')}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 no-print">
          <p className="text-xs font-medium text-slate-600 truncate">{breadcrumbTitle}</p>

          <div className="flex items-center gap-2.5 shrink-0">
            {canCreateEmergency && (
              <button
                type="button"
                onClick={() => setModalMode('Emergencia Nocturna')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Moon className="w-3.5 h-3.5" />
                Emergencia Nocturna
              </button>
            )}

            {canCreateNormal && (
              <button
                type="button"
                onClick={() => setModalMode('Normal')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Nueva Solicitud
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
          {dataError && (
            <div className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 no-print">
              {dataError}
            </div>
          )}

          {activeTab === 'solicitudes' && selectedSolicitudId ? (
            <SolicitudDetailView
              idSolicitud={selectedSolicitudId}
              empleados={empleados}
              inventario={inventario}
              onBack={() => setSelectedSolicitudId(null)}
              onChanged={() => void loadAll()}
            />
          ) : activeTab === 'solicitudes' ? (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl font-bold text-slate-900">
                    Solicitudes de Aporte Contrata
                  </h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Ciclo operativo: Pendiente ➔ Atendida (despacho) ➔ Finalizada (devoluciones QuickEdit).
                  </p>
                </div>

                <div className="relative w-full md:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar SOLAPC, obra, capataz..."
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                  />
                </div>
              </div>

              {/* Segmented filter tabs */}
              <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-lg w-fit">
                {['Todas', 'Pendiente', 'Atendida', 'Finalizada', 'Cancelada', 'Emergencia Nocturna'].map(
                  (tab) => {
                    const active = estadoTab === tab;
                    return (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setEstadoTab(tab)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          active
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {tab}
                      </button>
                    );
                  },
                )}
              </div>

              {/* Solicitudes List */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                {loadingData ? (
                  <div className="p-6 space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-14 bg-slate-100 rounded animate-pulse" />
                    ))}
                  </div>
                ) : filteredSolicitudes.length === 0 ? (
                  <div className="p-10 text-center space-y-3">
                    <p className="text-sm text-slate-600">
                      No hay solicitudes registradas con el filtro actual.
                    </p>
                    {canCreateNormal && (
                      <button
                        type="button"
                        onClick={() => setModalMode('Normal')}
                        className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg cursor-pointer"
                      >
                        Crear Primera Solicitud
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {filteredSolicitudes.map((s) => {
                      const stateStyle =
                        s.estadoSolicitud === 'Finalizada'
                          ? 'text-emerald-700'
                          : s.estadoSolicitud === 'Atendida'
                            ? 'text-sky-700'
                            : s.estadoSolicitud === 'Cancelada'
                              ? 'text-red-700'
                              : 'text-amber-700';

                      return (
                        <button
                          key={s.idSolicitud}
                          type="button"
                          onClick={() => setSelectedSolicitudId(s.idSolicitud)}
                          className="w-full text-left px-6 py-4 hover:bg-slate-50/80 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                              <span className="font-mono-num font-bold text-slate-900">
                                {s.idSolicitud}
                              </span>
                              <span className="text-slate-300" aria-hidden="true">
                                ·
                              </span>
                              <span className="font-medium text-slate-900">{s.area}</span>
                              {s.bom && (
                                <>
                                  <span className="text-slate-300" aria-hidden="true">
                                    ·
                                  </span>
                                  <span className="text-slate-600">{s.bom}</span>
                                </>
                              )}
                              {s.tipoAtencion === 'Emergencia Nocturna' && (
                                <>
                                  <span className="text-slate-300" aria-hidden="true">
                                    ·
                                  </span>
                                  <span className="text-xs font-semibold text-red-700">
                                    Emergencia Nocturna
                                  </span>
                                </>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                              <span>Capataz: {s.capatazNombre}</span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono-num">
                                Obra: {s.obraResumen || '—'}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono-num">
                                {new Date(s.fechaSolicitud).toLocaleDateString('es-NI')}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-5 shrink-0">
                            <div className="text-right font-mono-num text-xs">
                              <p className="text-slate-900 font-semibold">
                                {s.totalLineas ?? s.detalles.length} ítems · {s.totalDespachado ?? 0}/{s.totalSolicitado ?? 0} desp.
                              </p>
                              <p className={`font-semibold ${stateStyle}`}>{s.estadoSolicitud}</p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === 'consolidado' ? (
            <ConsolidadoView
              onSelectSolicitud={(id) => {
                setSelectedSolicitudId(id);
                setActiveTab('solicitudes');
              }}
            />
          ) : activeTab === 'inventario' ? (
            <InventarioView inventario={inventario} onRefresh={() => void loadAll()} />
          ) : (
            <UsuariosRolesView />
          )}
        </main>
      </div>

      {modalMode && (
        <NuevaSolicitudModal
          open={true}
          initialTipoAtencion={modalMode}
          forceEmergencyOnly={
            modalMode === 'Emergencia Nocturna' || (!canCreateNormal && canCreateEmergency)
          }
          empleados={empleados}
          inventario={inventario}
          onClose={() => setModalMode(null)}
          onCreated={(newId) => {
            setModalMode(null);
            setSelectedSolicitudId(newId);
            setActiveTab('solicitudes');
            void loadAll();
          }}
        />
      )}
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <WorkspaceShell />
    </AuthProvider>
  );
}
