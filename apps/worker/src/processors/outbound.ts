import { DelayedError, type Job } from 'bullmq';
import {
  type OutboundJob,
  type BBSendMethod,
  getObjectBytes,
  publishEvent,
  awaitSendSlot,
  takeSendQuota,
  loadConfig,
  logger,
} from '@comms/core';
import { getDb, eq } from '@comms/db';
import { messages, conversations, contacts } from '@comms/db';
import { loadConnection } from '../lib/connection.js';
import { withChatLock } from '../lib/lock.js';

const log = logger.child({ module: 'outbound' });

export async function processOutbound(job: Job<OutboundJob>, token?: string): Promise<void> {
  const { messageId, connectionId } = job.data;
  const db = getDb();
  const cfg = loadConfig();

  const msg = await db.query.messages.findFirst({
    where: eq(messages.id, messageId),
    with: { attachments: true },
  });
  if (!msg) {
    log.warn({ messageId }, 'outbound message not found; dropping');
    return;
  }
  // Idempotency: only send queued/failed messages, and never internal notes.
  if (msg.isPrivateNote || (msg.status !== 'queued' && msg.status !== 'failed')) return;

  const conv = await db.query.conversations.findFirst({
    where: eq(conversations.id, msg.conversationId),
  });
  if (!conv) throw new Error(`conversation ${msg.conversationId} missing for outbound message`);

  // TCPA guard: a contact who replied STOP is never messaged again until they
  // reply START. Enforced here (not only in the UI) so no code path bypasses it.
  if (conv.contactId) {
    const contact = await db.query.contacts.findFirst({
      where: eq(contacts.id, conv.contactId),
      columns: { optedOutAt: true },
    });
    if (contact?.optedOutAt) {
      await db
        .update(messages)
        .set({ status: 'failed', error: 'Contact has opted out (replied STOP). Send blocked.' })
        .where(eq(messages.id, msg.id));
      await publishEvent({
        type: 'message.updated',
        conversationId: conv.id,
        inboxId: conv.inboxId,
        messageId: msg.id,
      });
      log.warn({ messageId: msg.id }, 'send blocked: contact opted out');
      return;
    }
  }

  // Apple-ID protection: hard hourly/daily ceilings per connection. Over cap,
  // the job parks itself until the window rolls over — delayed, never dropped.
  const quota = await takeSendQuota(connectionId, cfg.SEND_HOURLY_CAP, cfg.SEND_DAILY_CAP);
  if (!quota.allowed) {
    log.warn(
      { messageId: msg.id, scope: quota.scope, retryInMs: quota.retryInMs },
      'send quota exhausted; delaying job',
    );
    await job.moveToDelayed(Date.now() + quota.retryInMs, token);
    throw new DelayedError();
  }

  const { client, connection } = await loadConnection(connectionId);
  const method: BBSendMethod = connection.capabilities?.privateApi ? 'private-api' : 'apple-script';

  await withChatLock(conv.id, async () => {
    await db.update(messages).set({ status: 'sending' }).where(eq(messages.id, msg.id));
    await publishEvent({
      type: 'message.updated',
      conversationId: conv.id,
      inboxId: connection.inboxId,
      messageId: msg.id,
    });

    try {
      // Pace sends per number to stay under Apple's iMessage throttling.
      await awaitSendSlot(connectionId, cfg.SEND_MIN_INTERVAL_MS);

      const attachment = msg.attachments?.find((a) => a.storageKey);
      let providerGuid: string | undefined;

      if (attachment?.storageKey) {
        const bytes = await getObjectBytes(attachment.storageKey);
        const result = await client.sendAttachment({
          chatGuid: conv.providerChatGuid,
          tempGuid: msg.tempGuid!,
          file: bytes,
          fileName: attachment.fileName ?? 'attachment',
          contentType: attachment.mimeType ?? undefined,
          message: msg.body ?? undefined,
          method,
        });
        providerGuid = result?.guid;
      } else {
        const result = await client.sendText({
          chatGuid: conv.providerChatGuid,
          tempGuid: msg.tempGuid!,
          message: msg.body ?? '',
          method,
          selectedMessageGuid: msg.replyToMessageGuid ?? undefined,
        });
        providerGuid = result?.guid;
      }

      await db
        .update(messages)
        .set({
          status: 'sent',
          sentAt: new Date(),
          providerMessageGuid: providerGuid ?? msg.providerMessageGuid,
          error: null,
        })
        .where(eq(messages.id, msg.id));

      // Optionally clear the unread badge / send a read receipt on reply.
      const inboxSettings = (
        await db.query.inboxes.findFirst({ where: (i, { eq: e }) => e(i.id, conv.inboxId) })
      )?.settings;
      if (inboxSettings?.markReadOnReply) {
        await client.markRead(conv.providerChatGuid).catch(() => {});
      }

      await publishEvent({
        type: 'message.updated',
        conversationId: conv.id,
        inboxId: connection.inboxId,
        messageId: msg.id,
      });
    } catch (err) {
      const message = (err as Error).message;
      await db
        .update(messages)
        .set({ status: 'failed', error: message })
        .where(eq(messages.id, msg.id));
      await publishEvent({
        type: 'message.updated',
        conversationId: conv.id,
        inboxId: connection.inboxId,
        messageId: msg.id,
      });
      log.error({ messageId: msg.id, err: message }, 'outbound send failed');
      throw err; // let BullMQ retry with backoff
    }
  });
}
