import { notFound } from 'next/navigation';
import { loadConfig } from '@comms/core';
import {
  getConversation,
  getMessages,
  listAgents,
  listTags,
  listMacros,
  getConnectionForInbox,
  getPersonContext,
} from '@/server/queries';
import { ThreadShell } from '@/components/inbox/thread-shell';
import { getMyDraft } from '@/server/actions/drafts';
import { TicketPanel } from '@/components/inbox/ticket-panel';
import { ConversationHeader } from '@/components/inbox/conversation-header';
import { DetailsPaneShell } from '@/components/app/mobile-shell';
import { addressFromChatGuid, conversationName, formatAddress } from '@/lib/naming';

export const dynamic = 'force-dynamic';

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  const conversation = await getConversation(conversationId);
  if (!conversation) notFound();

  const [messages, agents, tags, macros, connection, draft, person] = await Promise.all([
    getMessages(conversationId),
    listAgents(),
    listTags(),
    listMacros(),
    getConnectionForInbox(conversation.inboxId),
    getMyDraft(conversationId),
    getPersonContext(conversationId, conversation.contactId),
  ]);

  // Tapbacks, typing indicators and edits all require the BlueBubbles Private
  // API; hide the affordances entirely when the Mac can't deliver them.
  const canReact = Boolean(connection?.capabilities?.privateApi);

  const contactName = conversationName({
    contactName: conversation.contact?.displayName,
    contactAddress: conversation.contact?.identities?.[0]?.value,
    chatGuid: conversation.providerChatGuid,
    title: conversation.title,
    isGroup: conversation.isGroup,
  });
  const contactIdentities =
    conversation.contact?.identities
      ?.map((i) => formatAddress(i.rawValue ?? i.value) ?? i.value)
      .filter((v): v is string => Boolean(v)) ?? [];
  const aiEnabled = loadConfig().aiEnabled;
  const ai = (
    conversation.metadata as {
      ai?: { summary?: string; topic?: string; sentiment?: string; draft?: string };
    } | null
  )?.ai;

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
          macros={macros.map((m) => ({
            id: m.id,
            name: m.name,
            body: m.body,
            shortcut: m.shortcut,
            hasActions: Object.keys(m.actions ?? {}).length > 0,
          }))}
          aiEnabled={aiEnabled}
          aiDraft={ai?.draft ?? null}
          initialDraft={draft}
          canReact={canReact}
          messages={messages.map((m) => ({
            id: m.id,
            body: m.body,
            providerMessageGuid: m.providerMessageGuid,
            authorType: m.authorType,
            direction: m.direction,
            isPrivateNote: m.isPrivateNote,
            status: m.status,
            error: m.error,
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
              isVoiceMemo: a.isVoiceMemo,
              playable: Boolean(a.playableStorageKey),
              transcript: a.transcript,
              transcriptSource: a.transcriptSource,
            })),
          }))}
        />
      </div>
      <DetailsPaneShell>
        <TicketPanel
          conversation={{
          id: conversation.id,
          status: conversation.status,
          priority: conversation.priority,
          assigneeId: conversation.assigneeId,
          contactName,
          contactIdentities: contactIdentities.length
            ? contactIdentities
            : // Fall back to the address in the chat GUID rather than claiming
              // we have no contact info for a thread we can clearly reply to.
              [formatAddress(addressFromChatGuid(conversation.providerChatGuid))].filter(
                (v): v is string => Boolean(v),
              ),
          inboxName: conversation.inbox?.name ?? 'Inbox',
          tagIds: conversation.tags?.map((t) => t.tag.id) ?? [],
        }}
        person={{
          name: contactName,
          avatarUrl: conversation.contact?.avatarUrl ?? null,
          addresses: person.addresses,
          lastMessageAt: person.lastMessageAt?.toISOString() ?? null,
          lastInboundAt: person.lastInboundAt?.toISOString() ?? null,
          firstMessageAt: person.firstMessageAt?.toISOString() ?? null,
          totalMessages: person.totalMessages,
          recentMessages: person.recentMessages,
          photos: person.photos,
          photoCount: person.photoCount,
          isGroup: conversation.isGroup,
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
      </DetailsPaneShell>
    </div>
  );
}
