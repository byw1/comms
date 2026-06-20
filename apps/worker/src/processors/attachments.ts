import type { Job } from 'bullmq';
import {
  type AttachmentJob,
  isStorageEnabled,
  putObject,
  publishEvent,
  logger,
} from '@comms/core';
import { getDb, eq } from '@comms/db';
import { attachments, messages } from '@comms/db';
import { loadConnection } from '../lib/connection.js';

const log = logger.child({ module: 'attachments' });

export async function processAttachment(job: Job<AttachmentJob>): Promise<void> {
  const { attachmentId, connectionId, providerAttachmentGuid } = job.data;
  const db = getDb();

  const att = await db.query.attachments.findFirst({ where: eq(attachments.id, attachmentId) });
  if (!att) return;
  if (att.status === 'stored') return;

  if (!isStorageEnabled()) {
    await db
      .update(attachments)
      .set({ status: 'failed' })
      .where(eq(attachments.id, attachmentId));
    log.warn('object storage disabled; cannot persist attachment');
    return;
  }

  const { client } = await loadConnection(connectionId);
  const { bytes, contentType } = await client.downloadAttachment(providerAttachmentGuid, {
    original: true,
  });

  const ext = (att.fileName?.split('.').pop() ?? 'bin').toLowerCase().slice(0, 8);
  const key = `attachments/${att.messageId}/${attachmentId}.${ext}`;
  await putObject(key, bytes, att.mimeType ?? contentType ?? undefined);

  await db
    .update(attachments)
    .set({ status: 'stored', storageKey: key, sizeBytes: att.sizeBytes ?? bytes.byteLength })
    .where(eq(attachments.id, attachmentId));

  const msg = await db.query.messages.findFirst({
    columns: { id: true, conversationId: true },
    where: eq(messages.id, att.messageId),
  });
  if (msg) {
    const conv = await db.query.conversations.findFirst({
      columns: { inboxId: true },
      where: (c, { eq: e }) => e(c.id, msg.conversationId),
    });
    if (conv) {
      await publishEvent({
        type: 'message.updated',
        conversationId: msg.conversationId,
        inboxId: conv.inboxId,
        messageId: msg.id,
      });
    }
  }
}
