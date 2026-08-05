import { notFound } from 'next/navigation';
import { loadConfig } from '@comms/core';
import { getConversation, getMessages, listAgents, listTags, listMacros } from '@/server/queries';
import { ThreadShell } from '@/components/inbox/thread-shell';
import { TicketPanel } from '@/components/inbox/ticket-panel';
import { ConversationHeader } from '@/components/inbox/conversation-header';

export const dynamic = 'force-dynamic';

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  const conversation = await getConversation(conversationId);
  if (!conversation) notFound();

  const [messages, agents, tags, macros] = await Promise.all([
    getMessages(conversationId),
    listAgents(),
    listTags(),
    listMacros(),
  ]);

  const contactName = conversation.contact?.displayName ?? conversation.title ?? 'Unknown';
  const aiEnabled = loadConfig().aiEnabled;
  const ai = (conversation.metadata as { ai?: { summary?: string; topic?: string; sentiment?: string } } | null)?.ai;

  return (
    <div className="flex h-full min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <ConversationHeader
          conversationId={conversation.id}
          number={conversation.number}
          name={contactName}
          status={conversation.status}
        />
        <ThreadShell
          conversationId={conversation.id}
          macros={macros.map((m) => ({ id: m.id, name: m.name, body: m.body }))}
          aiEnabled={aiEnabled}
          messages={messages.map((m) => ({
            id: m.id,
            body: m.body,
            authorType: m.authorType,
            direction: m.direction,
            isPrivateNote: m.isPrivateNote,
            status: m.status,
            authorName: m.authorUser?.name ?? null,
            reactionType: m.reactionType,
            createdAt: m.createdAt,
            sentAt: m.sentAt,
            readAt: m.readAt,
            deliveredAt: m.deliveredAt,
            attachments: m.attachments.map((a) => ({
              id: a.id,
              fileName: a.fileName,
              mimeType: a.mimeType,
              status: a.status,
            })),
          }))}
        />
      </div>
      <TicketPanel
        conversation={{
          id: conversation.id,
          status: conversation.status,
          priority: conversation.priority,
          assigneeId: conversation.assigneeId,
          contactName,
          contactIdentities: conversation.contact?.identities?.map((i) => i.value) ?? [],
          inboxName: conversation.inbox?.name ?? 'Inbox',
          tagIds: conversation.tags?.map((t) => t.tag.id) ?? [],
        }}
        agents={agents.map((a) => ({ id: a.id, name: a.name, email: a.email }))}
        allTags={tags.map((t) => ({ id: t.id, name: t.name, color: t.color }))}
        ai={ai ? { summary: ai.summary, topic: ai.topic, sentiment: ai.sentiment } : null}
        sla={{
          nextResponseDueAt: conversation.nextResponseDueAt,
          slaBreachedAt: conversation.slaBreachedAt,
          csatScore: conversation.csatScore,
        }}
      />
    </div>
  );
}
