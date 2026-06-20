'use server';

import { and, asc, desc, eq } from '@comms/db';
import { conversations, messages } from '@comms/db';
import {
  isAiEnabled,
  summarizeConversation,
  suggestReply,
  type TranscriptMessage,
} from '@comms/ai';
import { db } from '@/server/db';
import { requireUser } from '@/lib/session';

export type AiResult = { ok: true; text: string } | { ok: false; error: string };

async function loadTranscript(
  conversationId: string,
): Promise<{ contactName: string | null; transcript: TranscriptMessage[] } | null> {
  const conv = await db.query.conversations.findFirst({
    where: eq(conversations.id, conversationId),
    with: { contact: { columns: { displayName: true } } },
  });
  if (!conv) return null;

  const rows = await db.query.messages.findMany({
    where: and(eq(messages.conversationId, conversationId), eq(messages.isRetracted, false)),
    orderBy: [asc(messages.createdAt)],
    limit: 40,
    with: { authorUser: { columns: { name: true } } },
  });

  const transcript: TranscriptMessage[] = rows
    .filter((m) => m.authorType !== 'system' && (m.body ?? '').trim())
    .map((m) => ({
      role: m.authorType === 'contact' ? 'contact' : m.isPrivateNote ? 'note' : 'agent',
      author: m.authorUser?.name ?? null,
      text: m.body ?? '',
    }));

  return { contactName: conv.contact?.displayName ?? null, transcript };
}

export async function summarizeConversationAction(conversationId: string): Promise<AiResult> {
  await requireUser();
  if (!isAiEnabled()) return { ok: false, error: 'AI is not configured.' };
  const data = await loadTranscript(conversationId);
  if (!data) return { ok: false, error: 'Conversation not found.' };
  if (data.transcript.length === 0) return { ok: false, error: 'Nothing to summarize yet.' };
  try {
    const text = await summarizeConversation({
      contactName: data.contactName,
      messages: data.transcript,
    });
    return { ok: true, text };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function suggestReplyAction(conversationId: string): Promise<AiResult> {
  await requireUser();
  if (!isAiEnabled()) return { ok: false, error: 'AI is not configured.' };
  const data = await loadTranscript(conversationId);
  if (!data) return { ok: false, error: 'Conversation not found.' };

  // Brand-voice examples: recent real agent replies (not internal notes).
  const recent = await db.query.messages.findMany({
    where: and(
      eq(messages.direction, 'outbound'),
      eq(messages.authorType, 'agent'),
      eq(messages.isPrivateNote, false),
    ),
    orderBy: [desc(messages.createdAt)],
    limit: 8,
    columns: { body: true },
  });
  const brandVoiceExamples = recent
    .map((m) => m.body?.trim())
    .filter((b): b is string => Boolean(b))
    .slice(0, 6);

  try {
    const text = await suggestReply({
      contactName: data.contactName,
      messages: data.transcript,
      brandVoiceExamples,
    });
    return { ok: true, text };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
