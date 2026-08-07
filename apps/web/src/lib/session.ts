import 'server-only';
import { redirect } from 'next/navigation';
import { eq, users } from '@comms/db';
import { auth } from '@/auth';
import { db } from '@/server/db';

export type Role = 'owner' | 'admin' | 'agent';

export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}

/** Require an authenticated user or redirect to login. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

/** Owners and admins manage the workspace; agents only manage themselves. */
export function isAdminRole(role: Role | undefined | null): boolean {
  return role === 'owner' || role === 'admin';
}

/** Require an admin/owner or throw. Use in server actions. */
export async function requireAdmin() {
  const user = await requireUser();
  if (!isAdminRole(user.role)) {
    throw new Error('Forbidden: admin access required');
  }
  return user;
}

/**
 * The signed-in user's current database row. The JWT snapshots name/image/role
 * at sign-in, so anything that renders or gates on those should read here
 * instead — otherwise a profile edit or a role change stays invisible until the
 * user signs out and back in.
 */
export async function getCurrentDbUser() {
  const session = await getCurrentUser();
  if (!session?.id) return null;
  const row = await db.query.users.findFirst({
    where: eq(users.id, session.id),
    columns: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      status: true,
      preferences: true,
      hashedPassword: true,
    },
  });
  if (!row) return null;
  // Never hand a password hash to a caller; presence is all any of them need.
  const { hashedPassword, ...rest } = row;
  return { ...rest, hasPassword: Boolean(hashedPassword) };
}

export type CurrentDbUser = NonNullable<Awaited<ReturnType<typeof getCurrentDbUser>>>;

/** Same as `getCurrentDbUser`, but bounces to login when there is no row. */
export async function requireDbUser(): Promise<CurrentDbUser> {
  const user = await getCurrentDbUser();
  if (!user) redirect('/login');
  return user;
}

/**
 * Page-level admin guard. Unlike `requireAdmin` this redirects rather than
 * throwing — an agent who follows a stale admin link should land on their own
 * settings, not on an error page.
 */
export async function requireAdminPage(): Promise<CurrentDbUser> {
  const user = await requireDbUser();
  if (!isAdminRole(user.role)) redirect('/settings/profile');
  return user;
}
