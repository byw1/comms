import 'server-only';
import { and, asc, desc, eq, ilike, isNull, or } from '@comms/db';
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

export async function inboxCounts(currentUserId: string) {
  const all = await db.query.conversations.findMany({
    columns: { id: true, status: true, assigneeId: true },
    limit: 1000,
  });
  return {
    open: all.filter((c) => c.status === 'open').length,
    mine: all.filter((c) => c.assigneeId === currentUserId && c.status !== 'closed').length,
    unassigned: all.filter((c) => !c.assigneeId && c.status !== 'closed').length,
    closed: all.filter((c) => c.status === 'closed').length,
  };
}
