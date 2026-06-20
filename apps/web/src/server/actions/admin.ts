'use server';

import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';
import { eq } from '@comms/db';
import { users, tags, macros } from '@comms/db';
import { db } from '@/server/db';
import { requireAdmin } from '@/lib/session';
import { getOrgSettings, setSetting } from '@/server/settings';

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function createTeammate(input: {
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'agent';
}): Promise<ActionResult> {
  await requireAdmin();
  const email = input.email.trim().toLowerCase();
  if (!email.includes('@')) return { ok: false, error: 'Enter a valid email.' };
  if (input.password.length < 8) return { ok: false, error: 'Password must be 8+ characters.' };

  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) return { ok: false, error: 'A user with that email already exists.' };

  await db.insert(users).values({
    name: input.name.trim() || email,
    email,
    hashedPassword: await bcrypt.hash(input.password, 12),
    role: input.role,
    status: 'active',
    emailVerified: new Date(),
  });
  revalidatePath('/settings/team');
  return { ok: true };
}

export async function setUserRole(
  userId: string,
  role: 'owner' | 'admin' | 'agent',
): Promise<ActionResult> {
  await requireAdmin();
  await db.update(users).set({ role }).where(eq(users.id, userId));
  revalidatePath('/settings/team');
  return { ok: true };
}

export async function createTag(input: { name: string; color: string }): Promise<ActionResult> {
  await requireAdmin();
  const name = input.name.trim();
  if (!name) return { ok: false, error: 'Tag name is required.' };
  await db
    .insert(tags)
    .values({ name, color: input.color || '#71717a' })
    .onConflictDoNothing();
  revalidatePath('/settings/tags');
  return { ok: true };
}

export async function deleteTag(id: string): Promise<ActionResult> {
  await requireAdmin();
  await db.delete(tags).where(eq(tags.id, id));
  revalidatePath('/settings/tags');
  return { ok: true };
}

export async function createMacro(input: {
  name: string;
  body: string;
  shortcut?: string;
}): Promise<ActionResult> {
  const admin = await requireAdmin();
  const name = input.name.trim();
  if (!name) return { ok: false, error: 'Macro name is required.' };
  await db.insert(macros).values({
    name,
    body: input.body,
    shortcut: input.shortcut?.trim() || null,
    createdByUserId: admin.id,
  });
  revalidatePath('/settings/macros');
  return { ok: true };
}

export async function deleteMacro(id: string): Promise<ActionResult> {
  await requireAdmin();
  await db.delete(macros).where(eq(macros.id, id));
  revalidatePath('/settings/macros');
  return { ok: true };
}

export async function updateOrgName(orgName: string): Promise<ActionResult> {
  await requireAdmin();
  const current = await getOrgSettings();
  await setSetting('org', { ...current, orgName: orgName.trim() || 'Comms' });
  revalidatePath('/settings');
  return { ok: true };
}
