import { getDb, eq, and } from '@comms/db';
import {
  conversations,
  messages,
  attachments,
  contacts,
  contactIdentities,
  channelConnections,
} from '@comms/db';
import {
  type BBMessage,
  bbDate,
  normalizeAddress,
  parseChatGuid,
  reactionFromAssociatedType,
  enqueueAttachment,
  publishEvent,
  logger,
} from '@comms/core';

const log = logger.child({ module: 'ingest' });

/** Find-or-create a contact for an iMessage handle address. */
async function resolveContact(address: string, displayName?: string | null): Promise<string> {
  const db = getDb();
  const norm = normalizeAddress(address);

  const existing = await db.query.contactIdentities.findFirst({
    where: and(eq(contactIdentities.kind, norm.kind), eq(contactIdentities.value, norm.value)),
  });
  if (existing) return existing.contactId;

  const [contact] = await db
    .insert(contacts)
    .values({ displayName: displayName ?? norm.raw })
    .returning({ id: contacts.id });
  const contactId = contact!.id;

  await db
    .insert(contactIdentities)
    .values({ contactId, kind: norm.kind, value: norm.value, rawValue: norm.raw })
    .onConflictDoNothing();

  return contactId;
}

/** Upsert the conversation for a chat GUID within an inbox. */
async function ensureConversation(
  inboxId: string,
  chatGuid: string,
  contactId: string | null,
  meta: { title?: string | null },
): Promise<typeof conversations.$inferSelect> {
  const db = getDb();
  const parsed = parseChatGuid(chatGuid);

  const found = await db.query.conversations.findFirst({
    where: and(
      eq(conversations.inboxId, inboxId),
      eq(conversations.providerChatGuid, chatGuid),
    ),
  });
  if (found) return found;

  const inserted = await db
    .insert(conversations)
    .values({
      inboxId,
      providerChatGuid: chatGuid,
      contactId,
      isGroup: parsed.isGroup,
      title: meta.title ?? (parsed.isGroup ? 'Group conversation' : null),
    })
    .onConflictDoNothing()
    .returning();

  if (inserted[0]) {
    await publishEvent({
      type: 'conversation.created',
      conversationId: inserted[0].id,
      inboxId,
    });
    return inserted[0];
  }

  // Lost a race — fetch the row the other worker created.
  const existing = await db.query.conversations.findFirst({
    where: and(
      eq(conversations.inboxId, inboxId),
      eq(conversations.providerChatGuid, chatGuid),
    ),
  });
  if (!existing) throw new Error(`Failed to upsert conversation for ${chatGuid}`);
  return existing;
}

/** Insert attachment rows (pending) and enqueue downloads to S3. */
async function ingestAttachments(connectionId: string, messageId: string, bb: BBMessage) {
  if (!bb.attachments?.length) return;
  const db = getDb();
  for (const att of bb.attachments) {
    const [row] = await db
      .insert(attachments)
      .values({
        messageId,
        providerAttachmentGuid: att.guid,
        fileName: att.transferName ?? null,
        mimeType: att.mimeType ?? null,
        sizeBytes: att.totalBytes ?? null,
        width: att.width ?? null,
        height: att.height ?? null,
        status: 'pending',
      })
      .returning({ id: attachments.id });
    if (row) {
      await enqueueAttachment({
        attachmentId: row.id,
        connectionId,
        providerAttachmentGuid: att.guid,
      });
    }
  }
}

/**
 * Ingest a `new-message` event. Handles three cases:
 *  1. Inbound customer message → new message row, bump conversation.
 *  2. Our own outbound echo (isFromMe + matching tempGuid) → reconcile the row.
 *  3. A message sent from the Mac/iPhone outside Comms (isFromMe, no tempGuid) → external.
 */
export async function ingestNewMessage(connectionId: string, bb: BBMessage): Promise<void> {
  const db = getDb();

  const conn = await db.query.channelConnections.findFirst({
    where: eq(channelConnections.id, connectionId),
  });
  if (!conn) throw new Error(`connection ${connectionId} not found`);

  const chatGuid = bb.chats?.[0]?.guid;
  if (!chatGuid) {
    log.warn({ guid: bb.guid }, 'new-message without a chat; skipping');
    return;
  }

  // Dedup: have we already stored this provider message?
  if (bb.guid) {
    const dup = await db.query.messages.findFirst({
      where: eq(messages.providerMessageGuid, bb.guid),
    });
    if (dup) {
      log.debug({ guid: bb.guid }, 'duplicate message; skipping');
      return;
    }
  }

  const reaction = reactionFromAssociatedType(bb.associatedMessageType);
  const sentAt = bbDate(bb.dateCreated) ?? new Date();

  // Case 2: reconcile our outbound echo by tempGuid.
  if (bb.isFromMe && bb.tempGuid) {
    const pending = await db.query.messages.findFirst({
      where: eq(messages.tempGuid, bb.tempGuid),
    });
    if (pending) {
      await db
        .update(messages)
        .set({
          providerMessageGuid: bb.guid,
          status: 'sent',
          sentAt,
          deliveredAt: bbDate(bb.dateDelivered),
          readAt: bbDate(bb.dateRead),
        })
        .where(eq(messages.id, pending.id));
      await publishEvent({
        type: 'message.updated',
        conversationId: pending.conversationId,
        inboxId: conn.inboxId,
        messageId: pending.id,
      });
      return;
    }
  }

  const contactId = bb.isFromMe
    ? null
    : bb.handle?.address
      ? await resolveContact(bb.handle.address, bb.chats?.[0]?.displayName)
      : null;

  const conversation = await ensureConversation(conn.inboxId, chatGuid, contactId, {
    title: bb.chats?.[0]?.displayName,
  });

  const [msg] = await db
    .insert(messages)
    .values({
      conversationId: conversation.id,
      providerMessageGuid: bb.guid,
      direction: bb.isFromMe ? 'outbound' : 'inbound',
      authorType: bb.isFromMe ? 'external' : 'contact',
      authorContactId: contactId,
      body: bb.text ?? null,
      subject: bb.subject ?? null,
      status: bb.isFromMe ? 'sent' : 'delivered',
      associatedMessageGuid: bb.associatedMessageGuid ?? null,
      reactionType: reaction,
      replyToMessageGuid: bb.threadOriginatorGuid ?? null,
      sentAt,
      deliveredAt: bbDate(bb.dateDelivered),
      readAt: bbDate(bb.dateRead),
    })
    .returning();

  if (!msg) return;
  await ingestAttachments(connectionId, msg.id, bb);

  // Bump conversation denormalized fields. Inbound reopens a closed ticket.
  const preview = bb.text?.slice(0, 280) ?? (bb.attachments?.length ? '📎 Attachment' : '');
  const isInbound = !bb.isFromMe;
  await db
    .update(conversations)
    .set({
      lastMessageAt: sentAt,
      lastMessagePreview: preview,
      ...(isInbound ? { lastInboundAt: sentAt } : {}),
      ...(isInbound
        ? { unreadCount: (conversation.unreadCount ?? 0) + 1 }
        : {}),
      ...(isInbound && conversation.status === 'closed' ? { status: 'open' as const } : {}),
    })
    .where(eq(conversations.id, conversation.id));

  await publishEvent({
    type: 'message.created',
    conversationId: conversation.id,
    inboxId: conn.inboxId,
    messageId: msg.id,
  });
  await publishEvent({
    type: 'conversation.updated',
    conversationId: conversation.id,
    inboxId: conn.inboxId,
  });
}

/** Ingest an `updated-message` event (delivered / read / edited / unsent). */
export async function ingestUpdatedMessage(connectionId: string, bb: BBMessage): Promise<void> {
  const db = getDb();
  if (!bb.guid) return;

  const existing = await db.query.messages.findFirst({
    where: eq(messages.providerMessageGuid, bb.guid),
  });
  if (!existing) {
    // We may not have seen the original yet; treat as a new message.
    return ingestNewMessage(connectionId, bb);
  }

  const delivered = bbDate(bb.dateDelivered);
  const read = bbDate(bb.dateRead);
  const edited = bbDate(bb.dateEdited);
  const retracted = bbDate(bb.dateRetracted);

  const conn = await db.query.channelConnections.findFirst({
    where: eq(channelConnections.id, connectionId),
  });

  await db
    .update(messages)
    .set({
      deliveredAt: delivered ?? existing.deliveredAt,
      readAt: read ?? existing.readAt,
      editedAt: edited ?? existing.editedAt,
      retractedAt: retracted ?? existing.retractedAt,
      isEdited: existing.isEdited || Boolean(edited),
      isRetracted: existing.isRetracted || Boolean(retracted),
      body: edited ? (bb.text ?? existing.body) : existing.body,
      status: read ? 'read' : delivered ? 'delivered' : existing.status,
      error: bb.error ? `send error ${bb.error}` : existing.error,
    })
    .where(eq(messages.id, existing.id));

  if (conn) {
    await publishEvent({
      type: 'message.updated',
      conversationId: existing.conversationId,
      inboxId: conn.inboxId,
      messageId: existing.id,
    });
  }
}
