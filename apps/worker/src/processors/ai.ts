import type { Job } from 'bullmq';
import { type AiJob, publishEvent, logger } from '@comms/core';
import { isAiEnabled, triageConversation, type TranscriptMessage } from '@comms/ai';
import { getDb, eq, and, asc } from '@comms/db';
import { conversations, messages, tags, conversationTags } from '@comms/db';

const log = logger.child({ module: 'ai' });

export async function processAiJob(job: Job<AiJob>): Promise<void> {
  if (!isAiEnabled()) return;
  if (job.data.type !== 'triage') return;

  const db = getDb();
  const conv = await db.query.conversations.findFirst({
    where: eq(conversations.id, job.data.conversationId),
  });
  if (!conv) return;

  const rows = await db.query.messages.findMany({
    where: and(eq(messages.conversationId, conv.id), eq(messages.isRetracted, false)),
    orderBy: [asc(messages.createdAt)],
    limit: 40,
    with: { authorUser: { columns: { name: true } } },
  });

  const transcript: TranscriptMessage[] = rows
    .filter((m) => m.authorType !== 'system' && (m.body ?? '').trim())
    .map((m) => ({
      role:
        m.authorType === 'contact' ? 'contact' : m.isPrivateNote ? 'note' : 'agent',
      author: m.authorUser?.name ?? null,
      text: m.body ?? '',
    }));

  if (transcript.length === 0) return;

  let triage;
  try {
    triage = await triageConversation({ messages: transcript });
  } catch (err) {
    log.warn({ conversationId: conv.id, err: (err as Error).message }, 'triage failed');
    return;
  }

  // Apply priority only when it hasn't been set manually (still default 'normal').
  const patch: Partial<typeof conversations.$inferInsert> = {
    metadata: {
      ...(conv.metadata ?? {}),
      ai: {
        summary: triage.summary,
        topic: triage.topic,
        sentiment: triage.sentiment,
        suggestedTags: triage.suggestedTags,
        at: new Date().toISOString(),
      },
    },
  };
  if (conv.priority === 'normal' && triage.priority !== 'normal') {
    patch.priority = triage.priority;
  }
  await db.update(conversations).set(patch).where(eq(conversations.id, conv.id));

  // Apply any suggested tags that already exist (don't auto-create new tags).
  if (triage.suggestedTags.length) {
    const allTags = await db.query.tags.findMany();
    const byName = new Map(allTags.map((t) => [t.name.toLowerCase(), t.id]));
    for (const name of triage.suggestedTags) {
      const tagId = byName.get(name.toLowerCase());
      if (tagId) {
        await db
          .insert(conversationTags)
          .values({ conversationId: conv.id, tagId })
          .onConflictDoNothing();
      }
    }
  }

  await publishEvent({
    type: 'conversation.updated',
    conversationId: conv.id,
    inboxId: conv.inboxId,
  });
}
