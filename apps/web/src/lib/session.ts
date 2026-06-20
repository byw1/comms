import 'server-only';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';

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

/** Require an admin/owner or throw. */
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== 'owner' && user.role !== 'admin') {
    throw new Error('Forbidden: admin access required');
  }
  return user;
}
