import React from 'react';
import { ShieldCheck, Layers, FileSpreadsheet, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

export const LoginScreen: React.FC = () => {
  const { loginWithGoogle, authError, loading } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-4xl bg-white border border-slate-200 rounded-xl overflow-hidden grid md:grid-cols-5">
        <div className="md:col-span-3 p-8 md:p-10 flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-200">
          <div>
            <p className="text-xs font-medium text-sky-700 tracking-wide">
              SI Energía y Suministros
            </p>
            <h1 className="mt-2 text-2xl md:text-3xl font-bold text-slate-900 tracking-tight text-balance">
              Módulo de Solicitudes AP Contrata
            </h1>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed max-w-md">
              Entorno espejo sobre PostgreSQL con autenticación Google Workspace y control de acceso multi-rol para solicitudes, despachos, devoluciones en QuickEdit y consolidados.
            </p>
          </div>

          <div className="mt-8 space-y-4">
            <div className="flex items-start gap-3">
              <Layers className="w-5 h-5 text-slate-700 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-slate-900">Consecutivo transaccional sin duplicados</p>
                <p className="text-xs text-slate-500">
                  Secuencia atómica SOLAPC_XXXX en servidor para evitar colisiones entre sesiones concurrentes.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-slate-700 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-slate-900">Arquitectura multi-rol por cuenta Workspace</p>
                <p className="text-xs text-slate-500">
                  Asigna uno o varios roles simultáneos por usuario (Generador, Jefe de Almacén, Administrador).
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <FileSpreadsheet className="w-5 h-5 text-slate-700 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-slate-900">Consolidado general y QuickEdit de devoluciones</p>
                <p className="text-xs text-slate-500">
                  Exportación directa a CSV compatible con Excel y actas imprimibles con obra única en encabezado.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 p-8 md:p-10 bg-slate-50/70 flex flex-col justify-center">
          <h2 className="text-lg font-semibold text-slate-900">Acceso con Google Workspace</h2>
          <p className="mt-2 text-xs text-slate-600 leading-relaxed">
            Inicia sesión con tu correo corporativo de Google. Si eres el primer usuario en ingresar, recibirás acceso Administrador y Multi-Rol para configurar al equipo.
          </p>

          {authError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {authError}
            </div>
          )}

          <button
            type="button"
            onClick={loginWithGoogle}
            disabled={loading}
            className="mt-6 w-full flex items-center justify-center gap-2.5 px-4 py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Continuar con Google</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <p className="mt-4 text-xs text-slate-500">
            Sesión verificada en servidor mediante Firebase Auth.
          </p>
        </div>
      </div>
    </div>
  );
};
