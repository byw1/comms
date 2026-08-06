import type { Job } from 'bullmq';
import {
  type InboundJob,
  type BBMessage,
  BB_EVENTS,
  extractChatGuid,
  enqueueMaintenance,
  publishEvent,
  logger,
} from '@comms/core';
import { getDb, eq, and, inArray } from '@comms/db';
import { channelConnections, conversations, messages } from '@comms/db';
import { ingestNewMessage, ingestUpdatedMessage } from '../lib/ingest.js';

const log = logger.child({ module: 'inbound' });

/** Resolve the conversation a chat-scoped event belongs to. */
async function resolveConversation(connectionId: string, chatGuid: string | undefined) {
  if (!chatGuid) return null;
  const db = getDb();
  const conn = await db.query.channelConnections.findFirst({
    where: eq(channelConnections.id, connectionId),
  });
  if (!conn) return null;
  const conv = await db.query.conversations.findFirst({
    where: and(
      eq(conversations.inboxId, conn.inboxId),
      eq(conversations.providerChatGuid, chatGuid),
    ),
  });
  return conv ? { conv, inboxId: conn.inboxId } : null;
}

/**
 * Record a chat-level change in the conversation timeline. These events were
 * previously subscribed to and dropped on the floor, so group renames and
 * membership changes just silently happened.
 */
async function recordChatEvent(
  connectionId: string,
  chatGuid: string | undefined,
  body: string,
  patch?: Partial<typeof conversations.$inferInsert>,
) {
  const found = await resolveConversation(connectionId, chatGuid);
  if (!found) return;
  const db = getDb();

  if (patch && Object.keys(patch).length > 0) {
    await db.update(conversations).set(patch).where(eq(conversations.id, found.conv.id));
  }

  await db.insert(messages).values({
    conversationId: found.conv.id,
    direction: 'inbound',
    authorType: 'system',
    body,
    status: 'sent',
    sentAt: new Date(),
  });

  await publishEvent({
    type: 'conversation.updated',
    conversationId: found.conv.id,
    inboxId: found.inboxId,
  });
}

/**
 * Best-effort display name for whoever was added/removed from a group. These
 * events carry a serialized system Message, so the actor is on the message's
 * handle; the body text is the last resort.
 */
function addressOf(payload: Record<string, unknown>): string {
  const handle = payload.handle as { address?: string } | undefined;
  const raw =
    handle?.address ??
    (payload.address as string | undefined) ??
    (payload.otherHandle as string | undefined);
  return raw ?? 'Someone';
}

export async function processInbound(job: Job<InboundJob>): Promise<void> {
  const { connectionId, type, data } = job.data;
  const payload = (data ?? {}) as Record<string, unknown>;

  switch (type) {
    case BB_EVENTS.newMessage:
      await ingestNewMessage(connectionId, data as BBMessage);
      return;

    case BB_EVENTS.updatedMessage:
      await ingestUpdatedMessage(connectionId, data as BBMessage);
      return;

    case BB_EVENTS.newServer: {
      // The Mac's public URL rotated (Cloudflare quick tunnels change on every
      // restart). BlueBubbles tells us the new one as a bare string — so the
      // failure mode that used to silently kill the channel now self-heals.
      const url = typeof data === 'string' ? data.trim() : '';
      if (!/^https?:\/\//i.test(url)) {
        log.warn({ data }, 'new-server event without a usable URL');
        return;
      }
      const db = getDb();
      const conn = await db.query.channelConnections.findFirst({
        where: eq(channelConnections.id, connectionId),
      });
      if (!conn || conn.serverUrl === url.replace(/\/+$/, '')) return;

      await db
        .update(channelConnections)
        .set({ serverUrl: url.replace(/\/+$/, ''), lastError: null, status: 'connected' })
        .where(eq(channelConnections.id, connectionId));
      log.info({ connectionId, url }, 'server URL auto-updated from new-server event');

      // Re-register the webhook against the new address and backfill anything
      // missed while the old one was dead.
      await enqueueMaintenance({ type: 'reregister', connectionId }).catch(() => {});
      await enqueueMaintenance({ type: 'backfill', connectionId }).catch(() => {});
      await publishEvent({ type: 'connection.status', connectionId, status: 'connected' });
      return;
    }

    case BB_EVENTS.serverUpdate:
    case BB_EVENTS.helloWorld:
      log.debug({ type }, 'informational BlueBubbles event');
      return;

    case BB_EVENTS.messageSendError: {
      const bb = data as BBMessage;
      // Shape isn't documented — guard rather than burning BullMQ retries.
      if (typeof bb?.guid === 'string' && bb.guid) {
        const db = getDb();
        await db
          .update(messages)
          .set({ status: 'failed', error: `send error ${bb.error ?? ''}`.trim() })
          .where(eq(messages.providerMessageGuid, bb.guid));
      }
      log.warn({ guid: bb.guid }, 'message send error reported by BlueBubbles');
      return;
    }

    case BB_EVENTS.typingIndicator: {
      const found = await resolveConversation(connectionId, extractChatGuid(payload));
      if (found) {
        await publishEvent({
          type: 'typing',
          conversationId: found.conv.id,
          inboxId: found.inboxId,
          isTyping: Boolean(payload.display),
        });
      }
      return;
    }

    case BB_EVENTS.groupNameChange: {
      // Payload is a serialized system Message. The new title isn't in a
      // documented field, so prefer the chat's own displayName and only patch
      // conversations.title when we're confident — a wrong title is worse
      // than a generic note.
      const chats = payload.chats as Array<{ displayName?: string | null }> | undefined;
      const newName =
        chats?.[0]?.displayName ??
        (payload.groupTitle as string | undefined) ??
        (payload.newName as string | undefined) ??
        null;
      await recordChatEvent(
        connectionId,
        extractChatGuid(payload),
        newName ? `Group renamed to "${newName}"` : 'Group name changed',
        newName ? { title: newName } : undefined,
      );
      return;
    }

    case BB_EVENTS.participantAdded:
      await recordChatEvent(
        connectionId,
        extractChatGuid(payload),
        `${addressOf(payload)} was added to the group`,
      );
      return;

    case BB_EVENTS.participantRemoved:
      await recordChatEvent(
        connectionId,
        extractChatGuid(payload),
        `${addressOf(payload)} was removed from the group`,
      );
      return;

    case BB_EVENTS.participantLeft:
      await recordChatEvent(
        connectionId,
        extractChatGuid(payload),
        `${addressOf(payload)} left the group`,
      );
      return;

    case BB_EVENTS.chatReadStatusChanged: {
      // The customer opened the thread on their device. Mirror it so agents
      // aren't chasing someone who has already seen the reply.
      const found = await resolveConversation(connectionId, extractChatGuid(payload));
      if (!found) return;
      const readOnTheirEnd = payload.read === true || payload.isRead === true;
      if (!readOnTheirEnd) return;

      const db = getDb();
      // Include 'sent' as well as 'delivered': a message whose delivery
      // receipt hasn't landed yet would otherwise never be marked read.
      await db
        .update(messages)
        .set({ status: 'read', readAt: new Date() })
        .where(
          and(
            eq(messages.conversationId, found.conv.id),
            eq(messages.direction, 'outbound'),
            inArray(messages.status, ['sent', 'delivered']),
          ),
        );
      await publishEvent({
        type: 'conversation.updated',
        conversationId: found.conv.id,
        inboxId: found.inboxId,
      });
      return;
    }

    default:
      log.debug({ type }, 'unhandled inbound event type');
  }
}
