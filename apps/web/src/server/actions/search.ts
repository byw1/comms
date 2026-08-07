'use server';

import { desc, eq, inArray, sql } from '@comms/db';
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
 * Search across message bodies, contact names, and conversation titles.
 *
 * Message bodies use Postgres full-text search (websearch syntax: quoted
 * phrases, OR, -exclusions) against the GIN index on
 * to_tsvector('english', body). Names/titles use pg_trgm similarity so
 * substring and slightly-misspelled matches still hit their GIN trigram
 * indexes. Both are index-backed — the previous implementation was three
 * ILIKE '%term%' sequential scans.
 */
export async function searchConversations(term: string): Promise<SearchHit[]> {
  await requireUser();
  const q = term.trim();
  if (q.length < 2) return [];

  const [msgMatches, contactMatches] = await Promise.all([
    db
      .selectDistinct({ id: messages.conversationId })
      .from(messages)
      .where(
        sql`to_tsvector('english', coalesce(${messages.body}, '')) @@ websearch_to_tsquery('english', ${q})`,
      )
      .limit(100),
    db
      .selectDistinct({ id: contacts.id })
      .from(contacts)
      .where(sql`${contacts.displayName} % ${q} OR ${contacts.displayName} ILIKE ${'%' + q + '%'}`)
      .limit(100),
  ]);

  const convIds = msgMatches.map((m) => m.id);
  const contactIds = contactMatches.map((c) => c.id);

  const conds = [sql`${conversations.title} % ${q}`, sql`${conversations.title} ILIKE ${'%' + q + '%'}`];
  if (convIds.length) conds.push(inArray(conversations.id, convIds));
  if (contactIds.length) conds.push(inArray(conversations.contactId, contactIds));

  const rows = await db.query.conversations.findMany({
    where: sql.join(
      conds.map((c) => sql`(${c})`),
      sql` OR `,
    ),
    orderBy: [desc(conversations.lastMessageAt)],
    limit: 20,
    with: { contact: { columns: { displayName: true } } },
  });

  return rows.map((c) => ({
    id: c.id,
    number: c.number,
    title: c.contact?.displayName?.trim() || c.title?.trim() || 'Unknown contact',
    preview: c.lastMessagePreview ?? '',
    lastMessageAt: c.lastMessageAt ? c.lastMessageAt.toISOString() : null,
  }));
}
