import 'server-only';
import { and, asc, desc, eq, ilike, isNull, or, sql } from '@comms/db';
import {
  conversations,
  messages,
  inboxes,
  channelConnections,
  users,
  tags,
  macros,
  automationRules,
} from '@comms/db';
import { db } from '@/server/db';

export type ConversationFilter = {
  status?: 'open' | 'pending' | 'snoozed' | 'closed' | 'all';
  assignee?: 'me' | 'unassigned' | string;
  inboxId?: string;
  search?: string;
  currentUserId?: string;
};

export async function listConversations(filter: ConversationFilter = {}) {
  const where = [];
  if (filter.status && filter.status !== 'all') {
    where.push(eq(conversations.status, filter.status));
  }
  if (filter.inboxId) where.push(eq(conversations.inboxId, filter.inboxId));
  if (filter.assignee === 'unassigned') where.push(isNull(conversations.assigneeId));
  else if (filter.assignee === 'me' && filter.currentUserId) {
    where.push(eq(conversations.assigneeId, filter.currentUserId));
  } else if (filter.assignee && filter.assignee !== 'me') {
    where.push(eq(conversations.assigneeId, filter.assignee));
  }
  if (filter.search) {
    where.push(
      or(
        ilike(conversations.lastMessagePreview, `%${filter.search}%`),
        ilike(conversations.title, `%${filter.search}%`),
      )!,
    );
  }

  return db.query.conversations.findMany({
    where: where.length ? and(...where) : undefined,
    orderBy: [desc(conversations.lastMessageAt), desc(conversations.createdAt)],
    limit: 100,
    with: {
      contact: { columns: { id: true, displayName: true, avatarUrl: true } },
      assignee: { columns: { id: true, name: true, image: true } },
      inbox: { columns: { id: true, name: true, color: true } },
      tags: { with: { tag: true } },
    },
  });
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
      open: sql<number>`count(*) filter (where ${conversations.status} = 'open')`,
      mine: sql<number>`count(*) filter (where ${conversations.assigneeId} = ${currentUserId} and ${conversations.status} != 'closed')`,
      unassigned: sql<number>`count(*) filter (where ${conversations.assigneeId} is null and ${conversations.status} != 'closed')`,
      closed: sql<number>`count(*) filter (where ${conversations.status} = 'closed')`,
    })
    .from(conversations);
  return {
    open: Number(row?.open ?? 0),
    mine: Number(row?.mine ?? 0),
    unassigned: Number(row?.unassigned ?? 0),
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
