'use server';

import { revalidatePath } from 'next/cache';
import { eq, and, inArray } from '@comms/db';
import { conversations, messages, conversationTags, users, notifications, inboxes } from '@comms/db';
import { newTempGuid, enqueueOutbound, publishEvent } from '@comms/core';
import { db } from '@/server/db';
import { requireUser } from '@/lib/session';
import { getConnectionForInbox } from '@/server/queries';

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Parse @mentions in an internal note and notify matched teammates. */
async function notifyMentions(
  conversationId: string,
  body: string,
  authorUserId: string,
  authorName: string,
) {
  const tokens = Array.from(body.matchAll(/@([\w.+-]+)/g)).map((m) => m[1]!.toLowerCase());
  if (tokens.length === 0) return;

  const all = await db.query.users.findMany({
    where: eq(users.status, 'active'),
    columns: { id: true, name: true, email: true },
  });
  const matched = new Set<string>();
  for (const u of all) {
    if (u.id === authorUserId) continue;
    const nameKey = (u.name ?? '').toLowerCase().replace(/\s+/g, '');
    const emailLocal = u.email.split('@')[0]!.toLowerCase();
    if (tokens.some((t) => t === nameKey || t === emailLocal || t === u.email.toLowerCase())) {
      matched.add(u.id);
    }
  }
  for (const userId of matched) {
    await db.insert(notifications).values({
      userId,
      type: 'mention',
      conversationId,
      actorUserId: authorUserId,
      body: `${authorName} mentioned you in a note`,
    });
    await publishEvent({ type: 'notification', userId });
  }
}

/** Send a reply (queued for the worker) or save an internal note. */
export async function sendMessage(input: {
  conversationId: string;
  body: string;
  isPrivateNote?: boolean;
  replyToMessageGuid?: string;
}): Promise<ActionResult> {
  const user = await requireUser();
  const body = input.body.trim();
  if (!body) return { ok: false, error: 'Message is empty.' };

  const conv = await db.query.conversations.findFirst({
    where: eq(conversations.id, input.conversationId),
  });
  if (!conv) return { ok: false, error: 'Conversation not found.' };

  const connection = await getConnectionForInbox(conv.inboxId);
  if (!input.isPrivateNote && !connection) {
    return { ok: false, error: 'This inbox has no connected channel.' };
  }

  const [msg] = await db
    .insert(messages)
    .values({
      conversationId: conv.id,
      direction: 'outbound',
      authorType: input.isPrivateNote ? 'agent' : 'agent',
      authorUserId: user.id,
      body,
      isPrivateNote: Boolean(input.isPrivateNote),
      status: input.isPrivateNote ? 'sent' : 'queued',
      tempGuid: input.isPrivateNote ? null : newTempGuid(),
      replyToMessageGuid: input.replyToMessageGuid ?? null,
      sentAt: input.isPrivateNote ? new Date() : null,
    })
    .returning();

  if (!msg) return { ok: false, error: 'Failed to create message.' };

  await db
    .update(conversations)
    .set({
      lastMessageAt: new Date(),
      lastMessagePreview: input.isPrivateNote ? `📝 ${body.slice(0, 200)}` : body.slice(0, 280),
      unreadCount: 0,
      firstResponseAt: conv.firstResponseAt ?? (input.isPrivateNote ? null : new Date()),
      // A real reply (not an internal note) satisfies the SLA response clock.
      ...(input.isPrivateNote ? {} : { nextResponseDueAt: null, slaBreachedAt: null }),
    })
    .where(eq(conversations.id, conv.id));

  if (!input.isPrivateNote && connection) {
    await enqueueOutbound({
      messageId: msg.id,
      conversationId: conv.id,
      connectionId: connection.id,
    });
  }

  if (input.isPrivateNote) {
    await notifyMentions(conv.id, body, user.id, user.name ?? 'A teammate');
  }

  await publishEvent({
    type: 'message.created',
    conversationId: conv.id,
    inboxId: conv.inboxId,
    messageId: msg.id,
  });
  revalidatePath(`/inbox/${conv.id}`);
  return { ok: true };
}

async function systemEvent(conversationId: string, inboxId: string, text: string, actorId: string) {
  await db.insert(messages).values({
    conversationId,
    direction: 'outbound',
    authorType: 'system',
    authorUserId: actorId,
    body: text,
    status: 'sent',
    sentAt: new Date(),
  });
  await publishEvent({ type: 'conversation.updated', conversationId, inboxId });
}

/** Update ticket attributes (status, priority, assignee) and log a timeline event. */
export async function updateConversation(input: {
  id: string;
  status?: 'open' | 'pending' | 'snoozed' | 'closed';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  assigneeId?: string | null;
  snoozedUntil?: string | null;
}): Promise<ActionResult> {
  const user = await requireUser();
  const conv = await db.query.conversations.findFirst({ where: eq(conversations.id, input.id) });
  if (!conv) return { ok: false, error: 'Conversation not found.' };

  const patch: Partial<typeof conversations.$inferInsert> = {};
  const events: string[] = [];

  if (input.status && input.status !== conv.status) {
    patch.status = input.status;
    if (input.status === 'closed') patch.closedAt = new Date();
    // Pause the SLA response clock while not actively open (pending/snoozed/closed).
    if (input.status !== 'open') patch.nextResponseDueAt = null;
    events.push(`marked the ticket as ${input.status}`);
  }
  if (input.priority && input.priority !== conv.priority) {
    patch.priority = input.priority;
    events.push(`set priority to ${input.priority}`);
  }
  if (input.assigneeId !== undefined && input.assigneeId !== conv.assigneeId) {
    patch.assigneeId = input.assigneeId;
    events.push(input.assigneeId ? `assigned the ticket` : `unassigned the ticket`);
  }
  if (input.snoozedUntil !== undefined) {
    patch.snoozedUntil = input.snoozedUntil ? new Date(input.snoozedUntil) : null;
  }

  if (Object.keys(patch).length === 0) return { ok: true };

  await db.update(conversations).set(patch).where(eq(conversations.id, conv.id));
  for (const e of events) await systemEvent(conv.id, conv.inboxId, `${user.name ?? 'Agent'} ${e}`, user.id);

  // On close, optionally send a CSAT survey over the channel and await the rating.
  if (input.status === 'closed' && conv.status !== 'closed') {
    const inbox = await db.query.inboxes.findFirst({ where: eq(inboxes.id, conv.inboxId) });
    const connection = await getConnectionForInbox(conv.inboxId);
    if (inbox?.settings?.csatEnabled && connection) {
      const body =
        inbox.settings.csatMessage ||
        'Thanks for reaching out! How would you rate your support experience? Reply with a number from 1 (poor) to 5 (great).';
      const [m] = await db
        .insert(messages)
        .values({
          conversationId: conv.id,
          direction: 'outbound',
          authorType: 'agent',
          authorUserId: user.id,
          body,
          status: 'queued',
          tempGuid: newTempGuid(),
        })
        .returning();
      if (m) {
        await enqueueOutbound({
          messageId: m.id,
          conversationId: conv.id,
          connectionId: connection.id,
        });
      }
      await db
        .update(conversations)
        .set({
          metadata: { ...(conv.metadata ?? {}), csat: { awaiting: true, at: new Date().toISOString() } },
        })
        .where(eq(conversations.id, conv.id));
    }
  }

  await publishEvent({ type: 'conversation.updated', conversationId: conv.id, inboxId: conv.inboxId });
  revalidatePath('/inbox');
  revalidatePath(`/inbox/${conv.id}`);
  return { ok: true };
}

export async function toggleTag(conversationId: string, tagId: string): Promise<ActionResult> {
  await requireUser();
  const existing = await db.query.conversationTags.findFirst({
    where: and(
      eq(conversationTags.conversationId, conversationId),
      eq(conversationTags.tagId, tagId),
    ),
  });
  if (existing) {
    await db
      .delete(conversationTags)
      .where(
        and(
          eq(conversationTags.conversationId, conversationId),
          eq(conversationTags.tagId, tagId),
        ),
      );
  } else {
    await db.insert(conversationTags).values({ conversationId, tagId }).onConflictDoNothing();
  }
  revalidatePath(`/inbox/${conversationId}`);
  return { ok: true };
}

/** Apply a status/assignee change to many conversations at once. */
export async function bulkUpdateConversations(
  ids: string[],
  patch: { status?: 'open' | 'pending' | 'closed'; assigneeId?: string | null },
): Promise<ActionResult> {
  await requireUser();
  if (ids.length === 0) return { ok: true };

  const set: Partial<typeof conversations.$inferInsert> = {};
  if (patch.status) {
    set.status = patch.status;
    if (patch.status === 'closed') set.closedAt = new Date();
    if (patch.status !== 'open') set.nextResponseDueAt = null;
  }
  if (patch.assigneeId !== undefined) set.assigneeId = patch.assigneeId;
  if (Object.keys(set).length === 0) return { ok: true };

  await db.update(conversations).set(set).where(inArray(conversations.id, ids));
  revalidatePath('/inbox');
  return { ok: true };
}

/** Mark a conversation read (clears the unread badge in Comms). */
export async function markRead(conversationId: string): Promise<ActionResult> {
  await requireUser();
  await db
    .update(conversations)
    .set({ unreadCount: 0 })
    .where(eq(conversations.id, conversationId));
  return { ok: true };
}
