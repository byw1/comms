'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Sparkles } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { updateConversation, toggleTag } from '@/server/actions/inbox';
import { cn, initials } from '@/lib/utils';

const UNASSIGNED = '__unassigned__';

export function TicketPanel({
  conversation,
  agents,
  allTags,
  ai,
}: {
  conversation: {
    id: string;
    status: string;
    priority: string;
    assigneeId: string | null;
    contactName: string;
    contactIdentities: string[];
    inboxName: string;
    tagIds: string[];
  };
  agents: { id: string; name: string | null; email: string }[];
  allTags: { id: string; name: string; color: string }[];
  ai?: { summary?: string; topic?: string; sentiment?: string } | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? 'Something went wrong');
      else router.refresh();
    });
  }

  return (
    <aside className="flex w-72 shrink-0 flex-col gap-5 overflow-y-auto border-l bg-card p-4">
      <section>
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback>{initials(conversation.contactName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-medium">{conversation.contactName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {conversation.contactIdentities[0] ?? 'No contact info'}
            </p>
          </div>
        </div>
      </section>

      {ai?.summary && (
        <>
          <Separator />
          <section className="space-y-1.5">
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Sparkles className="h-3 w-3" />
              AI summary
            </p>
            <p className="text-sm">{ai.summary}</p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {ai.topic && (
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{ai.topic}</span>
              )}
              {ai.sentiment && (
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs capitalize text-muted-foreground">
                  {ai.sentiment}
                </span>
              )}
            </div>
          </section>
        </>
      )}

      <Separator />

      <section className="space-y-3">
        <Field label="Assignee">
          <Select
            value={conversation.assigneeId ?? UNASSIGNED}
            onValueChange={(v) =>
              run(() =>
                updateConversation({
                  id: conversation.id,
                  assigneeId: v === UNASSIGNED ? null : v,
                }),
              )
            }
            disabled={pending}
          >
            <SelectTrigger>
              <SelectValue placeholder="Unassigned" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name ?? a.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Status">
          <Select
            value={conversation.status}
            onValueChange={(v) =>
              run(() =>
                updateConversation({
                  id: conversation.id,
                  status: v as 'open' | 'pending' | 'snoozed' | 'closed',
                }),
              )
            }
            disabled={pending}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="snoozed">Snoozed</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="Priority">
          <Select
            value={conversation.priority}
            onValueChange={(v) =>
              run(() =>
                updateConversation({
                  id: conversation.id,
                  priority: v as 'low' | 'normal' | 'high' | 'urgent',
                }),
              )
            }
            disabled={pending}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </section>

      <Separator />

      <section>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Tags
        </p>
        {allTags.length === 0 ? (
          <p className="text-xs text-muted-foreground">No tags yet.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {allTags.map((t) => {
              const active = conversation.tagIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  disabled={pending}
                  onClick={() => run(() => toggleTag(conversation.id, t.id))}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs transition-colors',
                    active ? 'border-transparent' : 'border-border text-muted-foreground hover:bg-accent',
                  )}
                  style={active ? { backgroundColor: `${t.color}20`, color: t.color } : undefined}
                >
                  {t.name}
                </button>
              );
            })}
          </div>
        )}
      </section>

      <Separator />

      <section className="text-xs text-muted-foreground">
        <p>
          Inbox: <span className="text-foreground">{conversation.inboxName}</span>
        </p>
      </section>
    </aside>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}
