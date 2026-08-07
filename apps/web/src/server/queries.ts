import 'server-only';
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from '@comms/db';
import {
  conversations,
  conversationTags,
  messages,
  inboxes,
  channelConnections,
  users,
  tags,
  macros,
  automationRules,
  savedViews,
} from '@comms/db';
import { db } from '@/server/db';
import { INBOX_STATUSES } from '@/lib/conversation-folder';

export type ConversationFilter = {
  /**
   * 'active' is the inbox: open and pending only.
   *
   * Snoozed and closed conversations are deliberately NOT in it. Snoozing
   * something that stays in the list is just a label — the whole point is that
   * it leaves and comes back, the way it does in every mail client. Each has
   * its own view instead.
   */
  status?: 'open' | 'pending' | 'snoozed' | 'closed' | 'active' | 'all';
  assignee?: 'me' | 'unassigned' | string;
  inboxId?: string;
  tagIds?: string[];
  priorityIn?: Array<'low' | 'normal' | 'high' | 'urgent'>;
  slaBreached?: boolean;
  unreadOnly?: boolean;
  sort?: 'newest' | 'oldest' | 'priority';
  search?: string;
  currentUserId?: string;
};

/** SQL conditions shared by the list query and the per-view counts. */
function buildConversationWhere(filter: ConversationFilter) {
  const where = [];

  if (filter.status === 'active') {
    where.push(inArray(conversations.status, INBOX_STATUSES));
  } else if (filter.status && filter.status !== 'all') {
    where.push(eq(conversations.status, filter.status));
  }

  if (filter.inboxId) where.push(eq(conversations.inboxId, filter.inboxId));

  if (filter.assignee === 'unassigned') where.push(isNull(conversations.assigneeId));
  else if (filter.assignee === 'me' && filter.currentUserId) {
    where.push(eq(conversations.assigneeId, filter.currentUserId));
  } else if (filter.assignee && filter.assignee !== 'me') {
    where.push(eq(conversations.assigneeId, filter.assignee));
  }

  if (filter.priorityIn?.length) {
    where.push(inArray(conversations.priority, filter.priorityIn));
  }

  if (filter.slaBreached) where.push(sql`${conversations.slaBreachedAt} is not null`);
  if (filter.unreadOnly) where.push(sql`${conversations.unreadCount} > 0`);

  // Tag filter: conversation must carry EVERY selected tag (AND semantics —
  // narrowing is what people expect when they add a second tag).
  if (filter.tagIds?.length) {
    for (const tagId of filter.tagIds) {
      where.push(
        sql`exists (select 1 from ${conversationTags} ct where ct.conversation_id = ${conversations.id} and ct.tag_id = ${tagId})`,
      );
    }
  }

  if (filter.search) {
    where.push(
      or(
        ilike(conversations.lastMessagePreview, `%${filter.search}%`),
        ilike(conversations.title, `%${filter.search}%`),
      )!,
    );
  }

  return where;
}

function orderFor(sort: ConversationFilter['sort'], status?: ConversationFilter['status']) {
  // The question you have in the snoozed view is "what comes back next", not
  // "what was said most recently".
  if (status === 'snoozed') return [asc(conversations.snoozedUntil), desc(conversations.lastMessageAt)];

  if (sort === 'oldest') {
    return [asc(conversations.lastMessageAt), asc(conversations.createdAt)];
  }
  if (sort === 'priority') {
    // urgent → high → normal → low, then most recent within each band.
    return [
      sql`case ${conversations.priority} when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 else 3 end`,
      desc(conversations.lastMessageAt),
    ];
  }
  return [desc(conversations.lastMessageAt), desc(conversations.createdAt)];
}

export async function listConversations(filter: ConversationFilter = {}) {
  const where = buildConversationWhere(filter);

  return db.query.conversations.findMany({
    where: where.length ? and(...where) : undefined,
    orderBy: orderFor(filter.sort, filter.status),
    limit: 100,
    with: {
      // Identities come along so an unnamed thread can show the phone number
      // instead of a blank row.
      contact: {
        columns: { id: true, displayName: true, avatarUrl: true },
        with: { identities: { columns: { value: true, rawValue: true } } },
      },
      assignee: { columns: { id: true, name: true, image: true } },
      inbox: { columns: { id: true, name: true, color: true } },
      tags: { with: { tag: true } },
    },
  });
}

/** Live count for one saved view — powers the sidebar badges. */
export async function countConversations(filter: ConversationFilter): Promise<number> {
  const where = buildConversationWhere(filter);
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(conversations)
    .where(where.length ? and(...where) : undefined);
  return Number(row?.n ?? 0);
}

/** Saved views visible to a user: their own plus every shared one. */
export async function listSavedViews(userId: string) {
  const rows = await db.query.savedViews.findMany({
    where: or(eq(savedViews.ownerUserId, userId), eq(savedViews.isShared, true)),
    orderBy: [asc(savedViews.sortOrder), asc(savedViews.createdAt)],
  });

  return Promise.all(
    rows.map(async (v) => ({
      ...v,
      count: await countConversations({ ...v.filters, currentUserId: userId }),
    })),
  );
}

export type ConversationListItem = Awaited<ReturnType<typeof listConversations>>[number];

export async function getConversation(id: string) {
  return db.query.conversations.findFirst({
    where: eq(conversations.id, id),
    with: {
      contact: { with: { identities: true } },
      assignee: { columns: { id: true, name: true, image: true } },
      inbox: { columns: { id: true, name: true, color: true } },
      tags: { with: { tag: true } },
    },
  });
}

export async function getMessages(conversationId: string) {
  return db.query.messages.findMany({
    where: eq(messages.conversationId, conversationId),
    orderBy: [asc(messages.createdAt)],
    with: {
      attachments: true,
      authorUser: { columns: { id: true, name: true, image: true } },
    },
  });
}

export async function getConnectionForInbox(inboxId: string) {
  return db.query.channelConnections.findFirst({
    where: eq(channelConnections.inboxId, inboxId),
  });
}

export async function listInboxes() {
  return db.query.inboxes.findMany({
    orderBy: [desc(inboxes.isDefault), asc(inboxes.name)],
    with: { connections: true },
  });
}

export async function listAgents() {
  return db.query.users.findMany({
    where: eq(users.status, 'active'),
    columns: { id: true, name: true, email: true, image: true, role: true },
    orderBy: [asc(users.name)],
  });
}

export async function listTags() {
  return db.query.tags.findMany({ orderBy: [asc(tags.name)] });
}

export async function listMacros() {
  return db.query.macros.findMany({ orderBy: [asc(macros.name)] });
}

export async function listAutomationRules() {
  return db.query.automationRules.findMany({ orderBy: [asc(automationRules.sortOrder)] });
}

/** Sidebar counts as one SQL aggregate — replaces loading 1000 rows into Node. */
export async function inboxCounts(currentUserId: string) {
  const [row] = await db
    .select({
      // Every count uses the same definition of "in the inbox" as the list,
      // or a badge promises work that isn't there when you click it.
      open: sql<number>`count(*) filter (where ${conversations.status} in ('open','pending'))`,
      mine: sql<number>`count(*) filter (where ${conversations.assigneeId} = ${currentUserId} and ${conversations.status} in ('open','pending'))`,
      unassigned: sql<number>`count(*) filter (where ${conversations.assigneeId} is null and ${conversations.status} in ('open','pending'))`,
      snoozed: sql<number>`count(*) filter (where ${conversations.status} = 'snoozed')`,
      closed: sql<number>`count(*) filter (where ${conversations.status} = 'closed')`,
    })
    .from(conversations);
  return {
    open: Number(row?.open ?? 0),
    mine: Number(row?.mine ?? 0),
    unassigned: Number(row?.unassigned ?? 0),
    snoozed: Number(row?.snoozed ?? 0),
    closed: Number(row?.closed ?? 0),
  };
}

/**
 * Connections that are down (status != connected) or silently stale (still
 * marked connected but no heartbeat for 3+ minutes — the worker is dead or the
 * Mac is asleep). Feeds the channel-health banner's initial state.
 */
export async function listUnhealthyConnections() {
  const staleBefore = new Date(Date.now() - 3 * 60_000);
  const rows = await db
    .select({
      connectionId: channelConnections.id,
      status: channelConnections.status,
      lastHeartbeatAt: channelConnections.lastHeartbeatAt,
      inboxName: inboxes.name,
    })
    .from(channelConnections)
    .innerJoin(inboxes, eq(channelConnections.inboxId, inboxes.id));

  return rows
    .filter(
      (r) =>
        r.status === 'error' ||
        r.status === 'disconnected' ||
        (r.status === 'connected' && (!r.lastHeartbeatAt || r.lastHeartbeatAt < staleBefore)),
    )
    .map((r) => ({
      connectionId: r.connectionId,
      inboxName: r.inboxName,
      reason: (r.status === 'connected' ? 'stale' : 'error') as 'error' | 'stale',
    }));
}
