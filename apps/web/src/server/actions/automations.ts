'use server';

import { revalidatePath } from 'next/cache';
import { eq } from '@comms/db';
import { automationRules } from '@comms/db';
import { db } from '@/server/db';
import { requireAdmin } from '@/lib/session';

export type RuleResult = { ok: true } | { ok: false; error: string };

export interface RuleActions {
  setStatus?: 'open' | 'pending' | 'snoozed' | 'closed';
  setPriority?: 'low' | 'normal' | 'high' | 'urgent';
  assignToUserId?: string | null;
  addTagIds?: string[];
}

export async function createRule(input: {
  name: string;
  trigger: 'conversation_created' | 'message_received';
  bodyContains: string[];
  actions: RuleActions;
}): Promise<RuleResult> {
  await requireAdmin();
  if (!input.name.trim()) return { ok: false, error: 'Name is required.' };
  await db.insert(automationRules).values({
    name: input.name.trim(),
    trigger: input.trigger,
    conditions: { bodyContains: input.bodyContains.map((s) => s.trim()).filter(Boolean) },
    actions: input.actions,
  });
  revalidatePath('/settings/automations');
  return { ok: true };
}

export async function toggleRule(id: string, enabled: boolean): Promise<RuleResult> {
  await requireAdmin();
  await db.update(automationRules).set({ enabled }).where(eq(automationRules.id, id));
  revalidatePath('/settings/automations');
  return { ok: true };
}

export async function deleteRule(id: string): Promise<RuleResult> {
  await requireAdmin();
  await db.delete(automationRules).where(eq(automationRules.id, id));
  revalidatePath('/settings/automations');
  return { ok: true };
}
