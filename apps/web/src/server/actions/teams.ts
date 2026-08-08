'use server';

import { revalidatePath } from 'next/cache';
import { and, asc, eq, inArray, sql } from '@comms/db';
import { teams, teamMembers, users, conversations, contacts } from '@comms/db';
import { publishEvent } from '@comms/core';
import { db } from '@/server/db';
import { requireAdmin, requireUser } from '@/lib/session';

export type TeamResult = { ok: true } | { ok: false; error: string };

/**
 * Teams: the group a client's conversations belong to.
 *
 * The tables have existed since the first schema and nothing ever wrote to
 * them. These actions are what make `conversations.assignedTeamId` and
 * `contacts.ownerTeamId` mean something.
 *
 * A team is not a permission boundary — everyone in a shared inbox can see
 * everything, which is the point of a shared inbox. It is a routing and
 * attention boundary: whose queue this lands in, who gets told about it.
 */

export interface TeamRow {
  id: string;
  name: string;
  color: string;
  description: string | null;
  memberIds: string[];
  /** Open + pending conversations currently routed to this team. */
  openCount: number;
  /** Contacts permanently owned by this team. */
  clientCount: number;
}

export async function listTeams(): Promise<TeamRow[]> {
  await requireUser();

  const [rows, members, convCounts, contactCounts] = await Promise.all([
    db.query.teams.findMany({ orderBy: [asc(teams.name)] }),
    db.select({ teamId: teamMembers.teamId, userId: teamMembers.userId }).from(teamMembers),
    db
      .select({ teamId: conversations.assignedTeamId, n: sql<number>`count(*)` })
      .from(conversations)
      .where(inArray(conversations.status, ['open', 'pending']))
      .groupBy(conversations.assignedTeamId),
    db
      .select({ teamId: contacts.ownerTeamId, n: sql<number>`count(*)` })
      .from(contacts)
      .groupBy(contacts.ownerTeamId),
  ]);

  const openBy = new Map(convCounts.map((c) => [c.teamId, Number(c.n)]));
  const clientsBy = new Map(contactCounts.map((c) => [c.teamId, Number(c.n)]));

  return rows.map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color,
    description: t.description,
    memberIds: members.filter((m) => m.teamId === t.id).map((m) => m.userId),
    openCount: openBy.get(t.id) ?? 0,
    clientCount: clientsBy.get(t.id) ?? 0,
  }));
}

/**
 * Team ids the caller belongs to — drives the sidebar's team rows.
 *
 * Everything exported from a `'use server'` module is a callable endpoint, so
 * this authenticates even though its only callers are server components, and
 * ignores the requested id in favour of the session's own.
 */
export async function myTeamIds(_userId?: string): Promise<string[]> {
  const me = await requireUser();
  const rows = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, me.id));
  return rows.map((r) => r.teamId);
}

export async function createTeam(input: {
  name: string;
  color?: string;
  description?: string;
}): Promise<TeamResult> {
  await requireAdmin();
  const name = input.name.trim();
  if (!name) return { ok: false, error: 'Give the team a name.' };
  if (name.length > 60) return { ok: false, error: 'Name must be 60 characters or fewer.' };

  await db.insert(teams).values({
    name,
    color: input.color || '#71717a',
    description: input.description?.trim() || null,
  });
  revalidatePath('/settings/teams');
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function updateTeam(input: {
  id: string;
  name?: string;
  color?: string;
  description?: string | null;
}): Promise<TeamResult> {
  await requireAdmin();
  const patch: Partial<typeof teams.$inferInsert> = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) return { ok: false, error: 'Give the team a name.' };
    patch.name = name;
  }
  if (input.color !== undefined) patch.color = input.color;
  if (input.description !== undefined) patch.description = input.description?.trim() || null;
  if (Object.keys(patch).length === 0) return { ok: true };

  await db.update(teams).set(patch).where(eq(teams.id, input.id));
  revalidatePath('/settings/teams');
  revalidatePath('/', 'layout');
  return { ok: true };
}

/**
 * Delete a team. Conversations and contacts pointing at it fall back to
 * unrouted (the FKs are `set null`) rather than disappearing — deleting a
 * team must never hide a customer.
 */
export async function deleteTeam(id: string): Promise<TeamResult> {
  await requireAdmin();
  await db.delete(teams).where(eq(teams.id, id));
  revalidatePath('/settings/teams');
  revalidatePath('/inbox');
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function setTeamMembership(input: {
  teamId: string;
  userId: string;
  member: boolean;
}): Promise<TeamResult> {
  await requireAdmin();
  if (input.member) {
    await db
      .insert(teamMembers)
      .values({ teamId: input.teamId, userId: input.userId })
      .onConflictDoNothing();
  } else {
    await db
      .delete(teamMembers)
      .where(
        and(eq(teamMembers.teamId, input.teamId), eq(teamMembers.userId, input.userId)),
      );
  }
  revalidatePath('/settings/teams');
  revalidatePath('/', 'layout');
  return { ok: true };
}

/** Route one conversation to a team (or clear it). */
export async function assignConversationTeam(
  conversationId: string,
  teamId: string | null,
): Promise<TeamResult> {
  await requireUser();
  const conv = await db.query.conversations.findFirst({
    where: eq(conversations.id, conversationId),
    columns: { id: true, inboxId: true },
  });
  if (!conv) return { ok: false, error: 'Conversation not found.' };

  await db
    .update(conversations)
    .set({ assignedTeamId: teamId })
    .where(eq(conversations.id, conversationId));

  await publishEvent({ type: 'conversation.updated', conversationId, inboxId: conv.inboxId });
  revalidatePath('/inbox');
  revalidatePath(`/inbox/${conversationId}`);
  return { ok: true };
}

export type ClientTeamResult =
  | {
      ok: true;
      /**
       * Each moved conversation with the team it had BEFORE the move.
       *
       * Per-conversation, not one scalar: a thread may have been routed by
       * hand, by a macro or by an automation to something other than the
       * contact's owner team, and undo has to give each one its own value
       * back rather than flattening them all to the contact's old team.
       */
      moved: { id: string; previousTeamId: string | null }[];
      previousOwnerTeamId: string | null;
    }
  | { ok: false; error: string };

/**
 * Assign a CLIENT to a team — the durable version of routing.
 *
 * Future conversations inherit it at ingest, and the open ones move now:
 * classifying Acme and then finding today's Acme thread still in the wrong
 * queue would make the feature feel broken. Closed threads are left alone as
 * history. The moved ids come back so the caller can offer a real undo.
 */
export async function setContactTeam(
  contactId: string,
  teamId: string | null,
): Promise<ClientTeamResult> {
  await requireUser();
  const contact = await db.query.contacts.findFirst({
    where: eq(contacts.id, contactId),
    columns: { id: true, ownerTeamId: true },
  });
  if (!contact) return { ok: false, error: 'Contact not found.' };

  await db.update(contacts).set({ ownerTeamId: teamId }).where(eq(contacts.id, contactId));

  // Read each thread's own team before overwriting it, so undo can restore
  // exactly what was there.
  const before = await db
    .select({
      id: conversations.id,
      inboxId: conversations.inboxId,
      previousTeamId: conversations.assignedTeamId,
    })
    .from(conversations)
    .where(
      and(
        eq(conversations.contactId, contactId),
        inArray(conversations.status, ['open', 'pending', 'snoozed']),
      ),
    );

  const changed = before.filter((c) => c.previousTeamId !== teamId);
  if (changed.length) {
    await db
      .update(conversations)
      .set({ assignedTeamId: teamId })
      .where(inArray(conversations.id, changed.map((c) => c.id)));
  }

  for (const c of changed) {
    await publishEvent({
      type: 'conversation.updated',
      conversationId: c.id,
      inboxId: c.inboxId,
    });
  }

  revalidatePath('/inbox');
  revalidatePath('/', 'layout');
  return {
    ok: true,
    moved: changed.map((c) => ({ id: c.id, previousTeamId: c.previousTeamId })),
    previousOwnerTeamId: contact.ownerTeamId,
  };
}

/**
 * Undo a client reassignment: restore the contact's owner team and put each
 * conversation back on the team it individually had.
 */
export async function restoreContactTeam(
  contactId: string,
  ownerTeamId: string | null,
  moved: { id: string; previousTeamId: string | null }[],
): Promise<TeamResult> {
  await requireUser();
  await db.update(contacts).set({ ownerTeamId }).where(eq(contacts.id, contactId));

  // Group by target so N conversations cost one statement per distinct team,
  // not one per conversation.
  const byTeam = new Map<string | null, string[]>();
  for (const m of moved) {
    byTeam.set(m.previousTeamId, [...(byTeam.get(m.previousTeamId) ?? []), m.id]);
  }
  for (const [team, ids] of byTeam) {
    await db
      .update(conversations)
      .set({ assignedTeamId: team })
      .where(inArray(conversations.id, ids));
  }

  revalidatePath('/inbox');
  revalidatePath('/', 'layout');
  return { ok: true };
}

/** Active agents, for the membership editor. */
export async function listTeamCandidates() {
  await requireUser();
  return db.query.users.findMany({
    where: eq(users.status, 'active'),
    columns: { id: true, name: true, email: true, image: true },
    orderBy: [asc(users.name)],
  });
}
