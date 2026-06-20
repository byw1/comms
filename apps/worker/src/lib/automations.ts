import { getDb, eq, and, asc } from '@comms/db';
import { automationRules, conversations, messages, conversationTags } from '@comms/db';
import { publishEvent, logger } from '@comms/core';

const log = logger.child({ module: 'automations' });

type Trigger = 'conversation_created' | 'message_received';

/**
 * Evaluate enabled automation rules for a trigger and apply matching actions to
 * the conversation. Conditions are ANDed; an empty condition set always matches.
 */
export async function runAutomations(
  trigger: Trigger,
  conversationId: string,
  ctx: { bodyText?: string | null },
): Promise<void> {
  const db = getDb();
  const rules = await db.query.automationRules.findMany({
    where: and(eq(automationRules.enabled, true), eq(automationRules.trigger, trigger)),
    orderBy: [asc(automationRules.sortOrder)],
  });
  if (rules.length === 0) return;

  const body = (ctx.bodyText ?? '').toLowerCase();

  for (const rule of rules) {
    const keywords = rule.conditions.bodyContains ?? [];
    if (keywords.length > 0) {
      const hit = keywords.some((k) => k.trim() && body.includes(k.toLowerCase().trim()));
      if (!hit) continue;
    }

    const a = rule.actions;
    const conv = await db.query.conversations.findFirst({
      where: eq(conversations.id, conversationId),
      columns: { id: true, inboxId: true },
    });
    if (!conv) return;

    const patch: Partial<typeof conversations.$inferInsert> = {};
    if (a.setStatus) patch.status = a.setStatus;
    if (a.setPriority) patch.priority = a.setPriority;
    if (a.assignToUserId !== undefined) patch.assigneeId = a.assignToUserId;
    if (Object.keys(patch).length > 0) {
      await db.update(conversations).set(patch).where(eq(conversations.id, conversationId));
    }
    for (const tagId of a.addTagIds ?? []) {
      await db
        .insert(conversationTags)
        .values({ conversationId, tagId })
        .onConflictDoNothing();
    }

    await db.insert(messages).values({
      conversationId,
      direction: 'outbound',
      authorType: 'system',
      body: `Automation "${rule.name}" applied`,
      status: 'sent',
      sentAt: new Date(),
    });
    await publishEvent({ type: 'conversation.updated', conversationId, inboxId: conv.inboxId });
    log.info({ ruleId: rule.id, conversationId }, 'automation applied');
  }
}
