'use server';

import { and, eq, desc, sql } from '@comms/db';
import { drafts, conversations } from '@comms/db';
import { db } from '@/server/db';
import { requireUser } from '@/lib/session';

/**
 * Unsent replies, kept server-side rather than in localStorage.
 *
 * localStorage would be simpler but wrong for this product: a draft is worth
 * keeping precisely because you walked away, and walking away often means a
 * different device. It also has to be readable by the conversation list to put
 * a marker on the row, which a browser-local store cannot do.
 */

export type SaveDraftInput = {
  conversationId: string;
  body: string;
  isPrivateNote?: boolean;
  replyToMessageId?: string | null;
};

/**
 * Upsert the caller's draft for a conversation.
 *
 * An empty body deletes the row instead of storing '' — otherwise every
 * conversation you ever opened and typed a character into would keep a draft
 * marker forever.
 */
export async function saveDraft(input: SaveDraftInput): Promise<{ ok: boolean }> {
  const me = await requireUser();
  const body = input.body ?? '';

  if (!body.trim()) {
    await db
      .delete(drafts)
      .where(and(eq(drafts.conversationId, input.conversationId), eq(drafts.userId, me.id)));
    return { ok: true };
  }

  await db
    .insert(drafts)
    .values({
      conversationId: input.conversationId,
      userId: me.id,
      body,
      isPrivateNote: input.isPrivateNote ?? false,
      replyToMessageId: input.replyToMessageId ?? null,
    })
    .onConflictDoUpdate({
      target: [drafts.conversationId, drafts.userId],
      set: {
        body,
        isPrivateNote: input.isPrivateNote ?? false,
        replyToMessageId: input.replyToMessageId ?? null,
        updatedAt: new Date(),
      },
    });

  return { ok: true };
}

/** Drop the draft once its message is actually sent. */
export async function clearDraft(conversationId: string): Promise<{ ok: boolean }> {
  const me = await requireUser();
  await db
    .delete(drafts)
    .where(and(eq(drafts.conversationId, conversationId), eq(drafts.userId, me.id)));
  return { ok: true };
}

export type PendingDraft = {
  conversationId: string;
  body: string;
  isPrivateNote: boolean;
  updatedAt: Date;
  conversationTitle: string | null;
};

/** Every draft the caller has going, newest first — powers the Drafts folder. */
export async function listMyDrafts(): Promise<PendingDraft[]> {
  const me = await requireUser();
  const rows = await db
    .select({
      conversationId: drafts.conversationId,
      body: drafts.body,
      isPrivateNote: drafts.isPrivateNote,
      updatedAt: drafts.updatedAt,
      conversationTitle: conversations.title,
    })
    .from(drafts)
    .innerJoin(conversations, eq(conversations.id, drafts.conversationId))
    .where(eq(drafts.userId, me.id))
    .orderBy(desc(drafts.updatedAt))
    .limit(200);
  return rows;
}

/** Conversation ids the caller has a draft in — the list marks these rows. */
export async function myDraftConversationIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ conversationId: drafts.conversationId })
    .from(drafts)
    .where(and(eq(drafts.userId, userId), sql`length(btrim(${drafts.body})) > 0`));
  return rows.map((r) => r.conversationId);
}

/** The caller's draft for one conversation, for restoring the composer. */
export async function getMyDraft(
  conversationId: string,
): Promise<{ body: string; isPrivateNote: boolean } | null> {
  const me = await requireUser();
  const [row] = await db
    .select({ body: drafts.body, isPrivateNote: drafts.isPrivateNote })
    .from(drafts)
    .where(and(eq(drafts.conversationId, conversationId), eq(drafts.userId, me.id)))
    .limit(1);
  return row ?? null;
}
