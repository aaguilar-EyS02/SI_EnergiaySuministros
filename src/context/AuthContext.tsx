import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import type { AppRole } from '../lib/constants.ts';
import type { AuthUser } from '../types.ts';

interface AuthContextValue {
  firebaseUser: User | null;
  authUser: AuthUser | null;
  effectiveRoles: AppRole[];
  previewRoles: AppRole[] | null;
  isSimulatingRoles: boolean;
  loading: boolean;
  authError: string | null;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  setPreviewRoles: (roles: AppRole[] | null) => void;
  refreshProfile: () => Promise<void>;
  apiFetch: <T = unknown>(url: string, options?: RequestInit) => Promise<T>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [effectiveRoles, setEffectiveRoles] = useState<AppRole[]>([]);
  const [previewRoles, setPreviewRolesState] = useState<AppRole[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const apiFetch = useCallback(
    async <T = unknown>(url: string, options: RequestInit = {}, overridePreview?: AppRole[] | null): Promise<T> => {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Debes iniciar sesión con Google Workspace.');
      }
      const idToken = await currentUser.getIdToken();
      const headers = new Headers(options.headers || {});
      headers.set('Authorization', `Bearer ${idToken}`);
      if (options.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }

      const activePreview = overridePreview !== undefined ? overridePreview : previewRoles;
      if (activePreview && activePreview.length > 0) {
        headers.set('X-Preview-Roles', activePreview.join(','));
      }

      const res = await fetch(url, { ...options, headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Error ${res.status} al comunicarse con el servidor.`);
      }
      return data as T;
    },
    [previewRoles],
  );

  const syncBackendProfile = useCallback(
    async (user: User, activePreview?: AppRole[] | null) => {
      setAuthError(null);
      try {
        const idToken = await user.getIdToken();
        const headers: Record<string, string> = {
          Authorization: `Bearer ${idToken}`,
        };
        if (activePreview && activePreview.length > 0) {
          headers['X-Preview-Roles'] = activePreview.join(',');
        }
        const res = await fetch('/api/me', { headers });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || 'No se pudo cargar tu perfil.');
        }
        setAuthUser(data.user);
        setEffectiveRoles(data.effectiveRoles ?? data.user?.roles ?? []);
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : 'Error de autenticación.');
        setAuthUser(null);
        setEffectiveRoles([]);
      }
    },
    [],
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        await syncBackendProfile(user, previewRoles);
      } else {
        setAuthUser(null);
        setEffectiveRoles([]);
        setPreviewRolesState(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [syncBackendProfile]);

  const setPreviewRoles = useCallback(
    (roles: AppRole[] | null) => {
      const next = roles && roles.length > 0 ? roles : null;
      setPreviewRolesState(next);
      if (auth.currentUser) {
        void syncBackendProfile(auth.currentUser, next);
      }
    },
    [syncBackendProfile],
  );

  const refreshProfile = useCallback(async () => {
    if (auth.currentUser) {
      await syncBackendProfile(auth.currentUser, previewRoles);
    }
  }, [previewRoles, syncBackendProfile]);

  const loginWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo completar el inicio de sesión.';
      setAuthError(msg);
    }
  }, []);

  const logout = useCallback(async () => {
    setPreviewRolesState(null);
    setAuthUser(null);
    setEffectiveRoles([]);
    await signOut(auth);
  }, []);

  const isSimulatingRoles = Boolean(
    previewRoles && previewRoles.length > 0 && authUser?.roles.includes('Administrador'),
  );

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        authUser,
        effectiveRoles,
        previewRoles,
        isSimulatingRoles,
        loading,
        authError,
        loginWithGoogle,
        logout,
        setPreviewRoles,
        refreshProfile,
        apiFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider.');
  return ctx;
}
