import type { Job } from 'bullmq';
import { type InboundJob, type BBMessage, BB_EVENTS, publishEvent, logger } from '@comms/core';
import { getDb, eq } from '@comms/db';
import { channelConnections, messages } from '@comms/db';
import { ingestNewMessage, ingestUpdatedMessage } from '../lib/ingest.js';

const log = logger.child({ module: 'inbound' });

export async function processInbound(job: Job<InboundJob>): Promise<void> {
  const { connectionId, type, data } = job.data;

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
      const payload = data as { guid?: string; display?: boolean };
      const db = getDb();
      const conn = await db.query.channelConnections.findFirst({
        where: eq(channelConnections.id, connectionId),
      });
      // Best-effort: surface typing to any agent viewing the thread.
      if (conn && payload.guid) {
        const conv = await db.query.conversations.findFirst({
          columns: { id: true },
          where: (c, { and, eq: e }) =>
            and(e(c.inboxId, conn.inboxId), e(c.providerChatGuid, payload.guid!)),
        });
        if (conv) {
          await publishEvent({
            type: 'typing',
            conversationId: conv.id,
            inboxId: conn.inboxId,
            isTyping: Boolean(payload.display),
          });
        }
      }
      return;
    }

    default:
      log.debug({ type }, 'unhandled inbound event type');
  }
}
