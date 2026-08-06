import { requireUser } from '@/lib/session';
import { listConversations, listInboxes, listTags, listAgents } from '@/server/queries';
import { ConversationListPane } from '@/components/inbox/conversation-list';
import { KeyboardShortcuts } from '@/components/app/keyboard-shortcuts';
import { TagQuickPicker } from '@/components/inbox/tag-quick-picker';

export const dynamic = 'force-dynamic';

export default async function InboxLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [conversations, inboxRows, tagRows, agentRows] = await Promise.all([
    // Load the working set once; the pane filters and sorts it client-side so
    // every filter change is instant.
    listConversations({ status: 'all' }),
    listInboxes(),
    listTags(),
    listAgents(),
  ]);

  return (
    <div className="flex h-full min-h-0 flex-1">
      <ConversationListPane
        conversations={conversations}
        currentUserId={user.id}
        currentUserName={user.name ?? 'You'}
        showChannels={inboxRows.length > 1}
        allTags={tagRows.map((t) => ({ id: t.id, name: t.name, color: t.color }))}
        agents={agentRows.map((a) => ({ id: a.id, name: a.name, email: a.email }))}
        inboxes={inboxRows.map((i) => ({ id: i.id, name: i.name }))}
      />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      <KeyboardShortcuts />
      <TagQuickPicker
        allTags={tagRows.map((t) => ({ id: t.id, name: t.name, color: t.color }))}
      />
    </div>
  );
}
