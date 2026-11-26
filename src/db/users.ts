import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from './index.ts';
import { pendingEmailRoles, userRoles, users } from './schema.ts';
import { APP_ROLES, type AppRole } from '../lib/constants.ts';

export interface UserWithRoles {
  id: number;
  uid: string;
  email: string;
  nombre: string;
  almacen: string;
  activo: boolean;
  roles: AppRole[];
  createdAt: Date;
}

const VALID_ROLE_SET = new Set<string>(APP_ROLES);

export function sanitizeRoles(input: unknown): AppRole[] {
  if (!Array.isArray(input)) return [];
  const unique = new Set<AppRole>();
  for (const item of input) {
    if (typeof item === 'string' && VALID_ROLE_SET.has(item)) {
      unique.add(item as AppRole);
    }
  }
  return Array.from(unique);
}

export async function getOrCreateUserWithRoles(
  uid: string,
  email: string,
  nombre?: string,
): Promise<UserWithRoles> {
  const normalizedEmail = email.trim().toLowerCase();
  const displayName = (nombre ?? '').trim() || normalizedEmail.split('@')[0] || 'Usuario';

  try {
    return await db.transaction(async (tx) => {
      const upserted = await tx
        .insert(users)
        .values({
          uid,
          email: normalizedEmail,
          nombre: displayName,
        })
        .onConflictDoUpdate({
          target: users.uid,
          set: {
            email: normalizedEmail,
          },
        })
        .returning();

      const userRow = upserted[0];

      const existingRoles = await tx
        .select({ role: userRoles.role })
        .from(userRoles)
        .where(eq(userRoles.userId, userRow.id));

      let assignedRoles = existingRoles
        .map((r) => r.role)
        .filter((r): r is AppRole => VALID_ROLE_SET.has(r));

      if (assignedRoles.length === 0) {
        const pending = await tx
          .select()
          .from(pendingEmailRoles)
          .where(eq(pendingEmailRoles.email, normalizedEmail));

        if (pending.length > 0) {
          const pendingRoles = sanitizeRoles(pending.map((p) => p.role));
          const meta = pending[0];
          if (meta.nombre || meta.almacen) {
            await tx
              .update(users)
              .set({
                nombre: meta.nombre || userRow.nombre,
                almacen: meta.almacen || userRow.almacen,
              })
              .where(eq(users.id, userRow.id));
            if (meta.nombre) userRow.nombre = meta.nombre;
            if (meta.almacen) userRow.almacen = meta.almacen;
          }
          for (const role of pendingRoles) {
            await tx
              .insert(userRoles)
              .values({ userId: userRow.id, role })
              .onConflictDoNothing();
          }
          await tx
            .delete(pendingEmailRoles)
            .where(eq(pendingEmailRoles.email, normalizedEmail));
          assignedRoles = pendingRoles;
        } else {
          const adminCountRows = await tx
            .select({ count: sql<number>`count(*)::int` })
            .from(userRoles)
            .where(eq(userRoles.role, 'Administrador'));

          const hasAnyAdmin = (adminCountRows[0]?.count ?? 0) > 0;
          const defaultRoles: AppRole[] = hasAnyAdmin
            ? ['Solicitante']
            : ['Administrador', 'Generador', 'Jefe de Almacen'];

          for (const role of defaultRoles) {
            await tx
              .insert(userRoles)
              .values({ userId: userRow.id, role })
              .onConflictDoNothing();
          }
          assignedRoles = defaultRoles;
        }
      }

      return {
        id: userRow.id,
        uid: userRow.uid,
        email: userRow.email,
        nombre: userRow.nombre,
        almacen: userRow.almacen,
        activo: userRow.activo,
        roles: assignedRoles,
        createdAt: userRow.createdAt,
      };
    });
  } catch (error) {
    console.error('Failed to sync user and roles:', error);
    throw new Error('No se pudo verificar el perfil de usuario.', { cause: error });
  }
}

export async function listAllUsersAndPending() {
  try {
    const allUsers = await db.select().from(users).orderBy(asc(users.id));
    const allRoles = await db.select().from(userRoles);
    const pending = await db.select().from(pendingEmailRoles).orderBy(asc(pendingEmailRoles.email));

    const rolesByUserId = new Map<number, AppRole[]>();
    for (const row of allRoles) {
      if (!VALID_ROLE_SET.has(row.role)) continue;
      const list = rolesByUserId.get(row.userId) ?? [];
      list.push(row.role as AppRole);
      rolesByUserId.set(row.userId, list);
    }

    const activeUsers = allUsers.map((u) => ({
      id: u.id,
      uid: u.uid,
      email: u.email,
      nombre: u.nombre,
      almacen: u.almacen,
      activo: u.activo,
      roles: rolesByUserId.get(u.id) ?? [],
      createdAt: u.createdAt,
    }));

    const pendingGrouped = new Map<
      string,
      { email: string; nombre: string; almacen: string; roles: AppRole[] }
    >();
    for (const p of pending) {
      if (!VALID_ROLE_SET.has(p.role)) continue;
      const existing = pendingGrouped.get(p.email) ?? {
        email: p.email,
        nombre: p.nombre,
        almacen: p.almacen,
        roles: [],
      };
      existing.roles.push(p.role as AppRole);
      pendingGrouped.set(p.email, existing);
    }

    return {
      users: activeUsers,
      pending: Array.from(pendingGrouped.values()),
    };
  } catch (error) {
    console.error('Failed to list users:', error);
    throw new Error('Error al consultar la lista de usuarios y roles.', { cause: error });
  }
}

export async function setUserRoles(userId: number, roles: AppRole[], nombre?: string, almacen?: string) {
  if (roles.length === 0) {
    throw new Error('Un usuario debe conservar al menos un rol asignado.');
  }

  try {
    return await db.transaction(async (tx) => {
      const target = await tx.select().from(users).where(eq(users.id, userId));
      if (target.length === 0) {
        throw new Error('Usuario no encontrado.');
      }

      if (nombre !== undefined || almacen !== undefined) {
        await tx
          .update(users)
          .set({
            nombre: nombre !== undefined ? nombre.trim() : target[0].nombre,
            almacen: almacen !== undefined ? almacen.trim() : target[0].almacen,
          })
          .where(eq(users.id, userId));
      }

      await tx.delete(userRoles).where(eq(userRoles.userId, userId));
      for (const role of roles) {
        await tx.insert(userRoles).values({ userId, role }).onConflictDoNothing();
      }

      const updated = await tx.select().from(users).where(eq(users.id, userId));
      return {
        ...updated[0],
        roles,
      };
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Usuario')) throw error;
    if (error instanceof Error && error.message.includes('al menos un rol')) throw error;
    console.error('Failed to update user roles:', error);
    throw new Error('No se pudieron actualizar los roles del usuario.', { cause: error });
  }
}

export async function toggleUserActive(userId: number, activo: boolean) {
  try {
    const updated = await db
      .update(users)
      .set({ activo })
      .where(eq(users.id, userId))
      .returning();
    if (updated.length === 0) {
      throw new Error('Usuario no encontrado.');
    }
    return updated[0];
  } catch (error) {
    if (error instanceof Error && error.message.includes('Usuario')) throw error;
    console.error('Failed to toggle user active:', error);
    throw new Error('No se pudo actualizar el estado del usuario.', { cause: error });
  }
}

export async function upsertPendingEmailRoles(
  email: string,
  roles: AppRole[],
  nombre: string,
  almacen: string,
) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    throw new Error('Ingresa un correo Google Workspace válido.');
  }
  if (roles.length === 0) {
    throw new Error('Selecciona al menos un rol para el usuario.');
  }

  try {
    return await db.transaction(async (tx) => {
      const existingUser = await tx.select().from(users).where(eq(users.email, normalizedEmail));
      if (existingUser.length > 0) {
        const uid = existingUser[0].id;
        await tx
          .update(users)
          .set({
            nombre: nombre.trim() || existingUser[0].nombre,
            almacen: almacen.trim() || existingUser[0].almacen,
          })
          .where(eq(users.id, uid));
        await tx.delete(userRoles).where(eq(userRoles.userId, uid));
        for (const role of roles) {
          await tx.insert(userRoles).values({ userId: uid, role }).onConflictDoNothing();
        }
        return { mode: 'existing' as const, email: normalizedEmail, roles };
      }

      await tx.delete(pendingEmailRoles).where(eq(pendingEmailRoles.email, normalizedEmail));
      for (const role of roles) {
        await tx.insert(pendingEmailRoles).values({
          email: normalizedEmail,
          role,
          nombre: nombre.trim(),
          almacen: almacen.trim() || 'Almacén Central',
        });
      }
      return { mode: 'pending' as const, email: normalizedEmail, roles };
    });
  } catch (error) {
    console.error('Failed to pre-assign email roles:', error);
    throw new Error('No se pudo registrar el acceso multi-rol para ese correo.', { cause: error });
  }
}

export async function deletePendingEmail(email: string) {
  try {
    await db
      .delete(pendingEmailRoles)
      .where(and(eq(pendingEmailRoles.email, email.trim().toLowerCase())));
  } catch (error) {
    console.error('Failed to delete pending email:', error);
    throw new Error('No se pudo eliminar el registro pendiente.', { cause: error });
  }
}
