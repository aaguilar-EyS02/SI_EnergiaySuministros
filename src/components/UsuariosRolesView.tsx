import React, { useEffect, useState } from 'react';
import { UserPlus, Trash2, Save } from 'lucide-react';
import { APP_ROLES, type AppRole } from '../lib/constants.ts';
import { useAuth } from '../context/AuthContext.tsx';
import type { AuthUser, PendingWorkspaceUser } from '../types.ts';

export const UsuariosRolesView: React.FC = () => {
  const { authUser, apiFetch, refreshProfile } = useAuth();
  const [usersList, setUsersList] = useState<AuthUser[]>([]);
  const [pendingList, setPendingList] = useState<PendingWorkspaceUser[]>([]);
  const [roleDrafts, setRoleDrafts] = useState<Record<number, AppRole[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Pre-assign form
  const [newEmail, setNewEmail] = useState('');
  const [newNombre, setNewNombre] = useState('');
  const [newAlmacen, setNewAlmacen] = useState('Almacén Central');
  const [newRoles, setNewRoles] = useState<AppRole[]>(['Generador', 'Jefe de Almacen']);
  const [saving, setSaving] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ users: AuthUser[]; pending: PendingWorkspaceUser[] }>(
        '/api/usuarios',
      );
      setUsersList(res.users);
      setPendingList(res.pending);
      const drafts: Record<number, AppRole[]> = {};
      for (const u of res.users) {
        drafts[u.id] = [...u.roles];
      }
      setRoleDrafts(drafts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar UsuariosAcceso.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const toggleDraftRole = (userId: number, role: AppRole) => {
    setRoleDrafts((prev) => {
      const current = prev[userId] ?? [];
      const exists = current.includes(role);
      const next = exists ? current.filter((r) => r !== role) : [...current, role];
      return { ...prev, [userId]: next };
    });
  };

  const handleSaveUserRoles = async (userId: number) => {
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const roles = roleDrafts[userId] ?? [];
      await apiFetch(`/api/usuarios/${userId}/roles`, {
        method: 'PUT',
        body: JSON.stringify({ roles }),
      });
      setFeedback('Roles actualizados en PostgreSQL.');
      await loadUsers();
      if (userId === authUser?.id) {
        await refreshProfile();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron actualizar los roles.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (userId: number, nextActive: boolean) => {
    setError(null);
    try {
      await apiFetch(`/api/usuarios/${userId}/estado`, {
        method: 'PATCH',
        body: JSON.stringify({ activo: nextActive }),
      });
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar el estado.');
    }
  };

  const handlePreassign = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      await apiFetch('/api/usuarios/preasignar', {
        method: 'POST',
        body: JSON.stringify({
          email: newEmail,
          nombre: newNombre,
          almacen: newAlmacen,
          roles: newRoles,
        }),
      });
      setNewEmail('');
      setNewNombre('');
      setFeedback('Cuenta Google Workspace preasignada con múltiples roles.');
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo preasignar la cuenta.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePending = async (email: string) => {
    setError(null);
    try {
      await apiFetch(`/api/usuarios/pendientes/${encodeURIComponent(email)}`, {
        method: 'DELETE',
      });
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">
          Usuarios Google Workspace y Control Multi-Rol
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          A diferencia de la columna única en AppSheet, aquí un mismo correo Workspace puede tener varios roles activos simultáneamente (ej. Generador + Jefe de Almacen).
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          {error}
        </div>
      )}
      {feedback && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
          {feedback}
        </div>
      )}

      {/* Pre-assign Google Workspace email */}
      <form
        onSubmit={handlePreassign}
        className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
      >
        <div className="flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-slate-700" />
          <h2 className="text-sm font-semibold text-slate-900">
            Asignar o Preasignar Correo Google Workspace
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Correo Google Workspace
            </label>
            <input
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="usuario@tudominio.com"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Nombre</label>
            <input
              type="text"
              value={newNombre}
              onChange={(e) => setNewNombre(e.target.value)}
              placeholder="Nombre completo"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Almacén</label>
            <input
              type="text"
              value={newAlmacen}
              onChange={(e) => setNewAlmacen(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-slate-700 mb-2">Roles asignados (múltiple selección)</p>
          <div className="flex flex-wrap gap-4">
            {APP_ROLES.map((role) => {
              const checked = newRoles.includes(role);
              return (
                <label key={role} className="inline-flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setNewRoles((prev) =>
                        checked ? prev.filter((r) => r !== role) : [...prev, role],
                      )
                    }
                    className="rounded border-slate-300"
                  />
                  <span>{role}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
          >
            Guardar Asignación Workspace
          </button>
        </div>
      </form>

      {/* Active Users Multi-Role Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">Usuarios Activos en Base de Datos</h2>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            <div className="h-10 bg-slate-100 rounded animate-pulse" />
            <div className="h-10 bg-slate-100 rounded animate-pulse" />
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {usersList.map((u) => {
              const draft = roleDrafts[u.id] ?? u.roles;
              const dirty =
                draft.length !== u.roles.length || draft.some((r) => !u.roles.includes(r));
              return (
                <div key={u.id} className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {u.nombre || u.email}
                      {u.id === authUser?.id && (
                        <span className="ml-2 text-xs font-normal text-sky-700">(Tu sesión)</span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">
                      {u.email} · {u.almacen} · {u.activo ? 'Activo' : 'Desactivado'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    {APP_ROLES.map((role) => (
                      <label key={role} className="inline-flex items-center gap-1.5 text-xs text-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={draft.includes(role)}
                          onChange={() => toggleDraftRole(u.id, role)}
                          className="rounded border-slate-300"
                        />
                        <span>{role}</span>
                      </label>
                    ))}

                    <div className="flex items-center gap-2 ml-2">
                      <button
                        type="button"
                        onClick={() => handleSaveUserRoles(u.id)}
                        disabled={!dirty || saving}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-sky-700 hover:bg-sky-800 disabled:opacity-40 rounded-lg cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        Guardar
                      </button>
                      {u.id !== authUser?.id && (
                        <button
                          type="button"
                          onClick={() => handleToggleActive(u.id, !u.activo)}
                          className="px-2.5 py-1.5 text-xs font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                        >
                          {u.activo ? 'Desactivar' : 'Activar'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pending Workspace emails */}
      {pendingList.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900">
              Cuentas Workspace Preasignadas (pendientes de primer ingreso)
            </h2>
          </div>
          <div className="divide-y divide-slate-100">
            {pendingList.map((p) => (
              <div key={p.email} className="px-6 py-3.5 flex items-center justify-between gap-4 text-xs">
                <div>
                  <p className="font-semibold text-slate-900">{p.email}</p>
                  <p className="text-slate-500">
                    {p.nombre || 'Sin nombre'} · {p.almacen} · Roles: {p.roles.join(', ')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeletePending(p.email)}
                  className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
