import type { Job } from 'bullmq';
import { type InboundJob, type BBMessage, BB_EVENTS, publishEvent, logger } from '@comms/core';
import { getDb, eq, and } from '@comms/db';
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

/** BlueBubbles reports chat-scoped events with varying key names; try them all. */
function chatGuidOf(payload: Record<string, unknown>): string | undefined {
  return (payload.chatGuid ?? payload.guid ?? payload.chat_guid) as string | undefined;
}

/** Best-effort display name for whoever was added/removed from a group. */
function addressOf(payload: Record<string, unknown>): string {
  const raw =
    (payload.address as string | undefined) ??
    ((payload.handle as { address?: string } | undefined)?.address ?? undefined) ??
    (payload.updatedParticipant as string | undefined);
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

    case BB_EVENTS.messageSendError: {
      const bb = data as BBMessage;
      if (bb.guid) {
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
      const found = await resolveConversation(connectionId, chatGuidOf(payload));
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
      const newName =
        (payload.newName as string | undefined) ??
        (payload.displayName as string | undefined) ??
        null;
      await recordChatEvent(
        connectionId,
        chatGuidOf(payload),
        newName ? `Group renamed to "${newName}"` : 'Group name changed',
        newName ? { title: newName } : undefined,
      );
      return;
    }

    case BB_EVENTS.participantAdded:
      await recordChatEvent(
        connectionId,
        chatGuidOf(payload),
        `${addressOf(payload)} was added to the group`,
      );
      return;

    case BB_EVENTS.participantRemoved:
      await recordChatEvent(
        connectionId,
        chatGuidOf(payload),
        `${addressOf(payload)} was removed from the group`,
      );
      return;

    case BB_EVENTS.participantLeft:
      await recordChatEvent(
        connectionId,
        chatGuidOf(payload),
        `${addressOf(payload)} left the group`,
      );
      return;

    case BB_EVENTS.chatReadStatusChanged: {
      // The customer opened the thread on their device. Mirror it so agents
      // aren't chasing someone who has already seen the reply.
      const found = await resolveConversation(connectionId, chatGuidOf(payload));
      if (!found) return;
      const readOnTheirEnd = payload.read === true || payload.isRead === true;
      if (!readOnTheirEnd) return;

      const db = getDb();
      await db
        .update(messages)
        .set({ status: 'read', readAt: new Date() })
        .where(
          and(
            eq(messages.conversationId, found.conv.id),
            eq(messages.direction, 'outbound'),
            eq(messages.status, 'delivered'),
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
