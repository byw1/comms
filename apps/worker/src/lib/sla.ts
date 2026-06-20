import { getDb, eq, and, lt, isNull, isNotNull, inArray } from '@comms/db';
import { conversations, messages, appSettings, notifications } from '@comms/db';
import { publishEvent } from '@comms/core';

export interface SlaSettings {
  firstResponseMinutes?: number;
  nextResponseMinutes?: number;
}

async function getSla(): Promise<SlaSettings | undefined> {
  const row = await getDb().query.appSettings.findFirst({ where: eq(appSettings.key, 'sla') });
  return (row?.value as SlaSettings | undefined) ?? undefined;
}

/**
 * On an inbound message: capture a pending CSAT rating if the customer replied
 * with a 1–5, otherwise (re)arm the SLA response clock.
 */
export async function onInboundSlaCsat(
  conversationId: string,
  conv: typeof conversations.$inferSelect,
  bbText: string | null | undefined,
): Promise<void> {
  const db = getDb();
  const meta = (conv.metadata ?? {}) as { csat?: { awaiting?: boolean } };

  if (meta.csat?.awaiting) {
    const match = (bbText ?? '').trim().match(/^([1-5])$/);
    if (match) {
      const score = Number(match[1]);
      await db
        .update(conversations)
        .set({
          csatScore: score,
          metadata: { ...(conv.metadata ?? {}), csat: { score, at: new Date().toISOString() } },
        })
        .where(eq(conversations.id, conversationId));
      await db.insert(messages).values({
        conversationId,
        direction: 'outbound',
        authorType: 'system',
        body: `Customer rated the support ${score}/5`,
        status: 'sent',
        sentAt: new Date(),
      });
      return;
    }
  }

  const sla = await getSla();
  if (sla?.nextResponseMinutes && conv.status !== 'closed') {
    const patch: Partial<typeof conversations.$inferInsert> = {
      nextResponseDueAt: new Date(Date.now() + sla.nextResponseMinutes * 60_000),
      slaBreachedAt: null,
    };
    if (!conv.firstResponseAt && !conv.firstResponseDueAt && sla.firstResponseMinutes) {
      patch.firstResponseDueAt = new Date(Date.now() + sla.firstResponseMinutes * 60_000);
    }
    await db.update(conversations).set(patch).where(eq(conversations.id, conversationId));
  }
}

/** Sweep for conversations past their response-due time and flag the breach. */
export async function checkSlaBreaches(): Promise<void> {
  const db = getDb();
  const breached = await db
    .update(conversations)
    .set({ slaBreachedAt: new Date() })
    .where(
      and(
        isNotNull(conversations.nextResponseDueAt),
        lt(conversations.nextResponseDueAt, new Date()),
        isNull(conversations.slaBreachedAt),
        inArray(conversations.status, ['open', 'pending']),
      ),
    )
    .returning({
      id: conversations.id,
      inboxId: conversations.inboxId,
      assigneeId: conversations.assigneeId,
      number: conversations.number,
    });

  for (const c of breached) {
    await db.insert(messages).values({
      conversationId: c.id,
      direction: 'outbound',
      authorType: 'system',
      body: 'SLA breached — response overdue',
      status: 'sent',
      sentAt: new Date(),
    });
    if (c.assigneeId) {
      await db.insert(notifications).values({
        userId: c.assigneeId,
        type: 'assignment',
        conversationId: c.id,
        body: `SLA breached on conversation #${c.number}`,
      });
      await publishEvent({ type: 'notification', userId: c.assigneeId });
    }
    await publishEvent({ type: 'conversation.updated', conversationId: c.id, inboxId: c.inboxId });
  }
}
