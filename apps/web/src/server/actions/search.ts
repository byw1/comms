'use server';

import { and, desc, eq, ilike, inArray, or } from '@comms/db';
import { conversations, messages, contacts } from '@comms/db';
import { db } from '@/server/db';
import { requireUser } from '@/lib/session';

export interface SearchHit {
  id: string;
  number: number;
  title: string;
  preview: string;
  lastMessageAt: string | null;
}

/**
 * Full-text-ish search across message bodies, contact names, and conversation
 * titles. Returns matching conversations, most-recent first.
 */
export async function searchConversations(term: string): Promise<SearchHit[]> {
  await requireUser();
  const q = term.trim();
  if (q.length < 2) return [];
  const like = `%${q}%`;

  const [msgMatches, contactMatches] = await Promise.all([
    db
      .selectDistinct({ id: messages.conversationId })
      .from(messages)
      .where(ilike(messages.body, like))
      .limit(100),
    db.selectDistinct({ id: contacts.id }).from(contacts).where(ilike(contacts.displayName, like)).limit(100),
  ]);

  const convIds = msgMatches.map((m) => m.id);
  const contactIds = contactMatches.map((c) => c.id);

  const conds = [ilike(conversations.title, like)];
  if (convIds.length) conds.push(inArray(conversations.id, convIds));
  if (contactIds.length) conds.push(inArray(conversations.contactId, contactIds));

  const rows = await db.query.conversations.findMany({
    where: or(...conds),
    orderBy: [desc(conversations.lastMessageAt)],
    limit: 20,
    with: { contact: { columns: { displayName: true } } },
  });

  return rows.map((c) => ({
    id: c.id,
    number: c.number,
    title: c.contact?.displayName ?? c.title ?? 'Unknown',
    preview: c.lastMessagePreview ?? '',
    lastMessageAt: c.lastMessageAt ? c.lastMessageAt.toISOString() : null,
  }));
}
