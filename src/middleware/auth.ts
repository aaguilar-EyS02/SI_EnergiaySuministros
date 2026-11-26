import { Request, Response, NextFunction } from 'express';
import { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '../lib/firebase-admin.ts';
import { getOrCreateUserWithRoles, sanitizeRoles, type UserWithRoles } from '../db/users.ts';
import type { AppRole } from '../lib/constants.ts';

export interface AuthRequest extends Request {
  firebaseUser?: DecodedIdToken;
  authUser?: UserWithRoles;
  effectiveRoles?: AppRole[];
  isSimulatingRoles?: boolean;
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado: falta el token de sesión.' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const email = decodedToken.email;
    if (!email) {
      return res.status(401).json({ error: 'Tu cuenta Google no proporcionó un correo electrónico.' });
    }

    const dbUser = await getOrCreateUserWithRoles(
      decodedToken.uid,
      email,
      typeof decodedToken.name === 'string' ? decodedToken.name : undefined,
    );

    if (!dbUser.activo) {
      return res.status(403).json({ error: 'Tu usuario se encuentra desactivado en UsuariosAcceso.' });
    }

    req.firebaseUser = decodedToken;
    req.authUser = dbUser;

    // Only real database Administrators can preview/simulate arbitrary role combinations for testing
    const previewHeader = req.headers['x-preview-roles'];
    if (
      typeof previewHeader === 'string' &&
      previewHeader.trim().length > 0 &&
      dbUser.roles.includes('Administrador')
    ) {
      const requested = sanitizeRoles(previewHeader.split(',').map((s) => s.trim()));
      if (requested.length > 0) {
        req.effectiveRoles = requested;
        req.isSimulatingRoles = true;
        return next();
      }
    }

    req.effectiveRoles = dbUser.roles;
    req.isSimulatingRoles = false;
    return next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Sesión inválida o expirada. Vuelve a iniciar sesión.' });
  }
};

export const requireAnyRole = (allowed: AppRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const roles = req.effectiveRoles ?? [];
    const hasAccess = roles.some((r) => allowed.includes(r));
    if (!hasAccess) {
      return res.status(403).json({
        error: `Permiso denegado. Se requiere alguno de estos roles: ${allowed.join(', ')}.`,
      });
    }
    return next();
  };
};
