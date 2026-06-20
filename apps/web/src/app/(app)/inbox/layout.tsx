import { requireUser } from '@/lib/session';
import { listConversations } from '@/server/queries';
import { ConversationListPane } from '@/components/inbox/conversation-list';

export const dynamic = 'force-dynamic';

export default async function InboxLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const conversations = await listConversations({});

  return (
    <div className="flex h-full min-h-0 flex-1">
      <ConversationListPane
        conversations={conversations}
        currentUserId={user.id}
        currentUserName={user.name ?? 'You'}
      />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
