'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createRule, deleteRule, toggleRule, type RuleActions } from '@/server/actions/automations';
import { cn } from '@/lib/utils';

type Rule = {
  id: string;
  name: string;
  enabled: boolean;
  trigger: 'conversation_created' | 'message_received';
  conditions: { bodyContains?: string[] };
  actions: RuleActions;
};

const NO_CHANGE = '__none__';
const UNASSIGNED = '__unassigned__';

export function AutomationManager({
  rules,
  agents,
  allTags,
}: {
  rules: Rule[];
  agents: { id: string; name: string | null; email: string }[];
  allTags: { id: string; name: string; color: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState<'conversation_created' | 'message_received'>(
    'conversation_created',
  );
  const [keywords, setKeywords] = useState('');
  const [setStatus, setSetStatus] = useState<string>(NO_CHANGE);
  const [setPriority, setSetPriority] = useState<string>(NO_CHANGE);
  const [assignee, setAssignee] = useState<string>(NO_CHANGE);
  const [tagIds, setTagIds] = useState<string[]>([]);

  function reset() {
    setName('');
    setKeywords('');
    setSetStatus(NO_CHANGE);
    setSetPriority(NO_CHANGE);
    setAssignee(NO_CHANGE);
    setTagIds([]);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const actions: RuleActions = {};
    if (setStatus !== NO_CHANGE) actions.setStatus = setStatus as RuleActions['setStatus'];
    if (setPriority !== NO_CHANGE) actions.setPriority = setPriority as RuleActions['setPriority'];
    if (assignee !== NO_CHANGE) actions.assignToUserId = assignee === UNASSIGNED ? null : assignee;
    if (tagIds.length) actions.addTagIds = tagIds;

    if (Object.keys(actions).length === 0) {
      toast.error('Add at least one action.');
      return;
    }

    start(async () => {
      const res = await createRule({
        name,
        trigger,
        bodyContains: keywords.split(',').map((s) => s.trim()).filter(Boolean),
        actions,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      reset();
      router.refresh();
    });
  }

  const summarize = (r: Rule) => {
    const parts: string[] = [];
    const kw = r.conditions.bodyContains ?? [];
    parts.push(
      r.trigger === 'conversation_created' ? 'New conversation' : 'Any inbound message',
    );
    if (kw.length) parts.push(`containing "${kw.join('", "')}"`);
    const acts: string[] = [];
    if (r.actions.setStatus) acts.push(`status → ${r.actions.setStatus}`);
    if (r.actions.setPriority) acts.push(`priority → ${r.actions.setPriority}`);
    if (r.actions.assignToUserId !== undefined)
      acts.push(r.actions.assignToUserId ? 'assign agent' : 'unassign');
    if (r.actions.addTagIds?.length) acts.push(`add ${r.actions.addTagIds.length} tag(s)`);
    return `${parts.join(' ')} → ${acts.join(', ')}`;
  };

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="space-y-4 rounded-lg border p-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="r-name">Rule name</Label>
            <Input
              id="r-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Escalate refunds"
            />
          </div>
          <div className="space-y-2">
            <Label>Trigger</Label>
            <Select value={trigger} onValueChange={(v) => setTrigger(v as typeof trigger)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="conversation_created">New conversation</SelectItem>
                <SelectItem value="message_received">Any inbound message</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="r-keywords">Message contains (comma-separated, optional)</Label>
          <Input
            id="r-keywords"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="refund, cancel, angry"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label>Set status</Label>
            <Select value={setStatus} onValueChange={setSetStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CHANGE}>No change</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Set priority</Label>
            <Select value={setPriority} onValueChange={setSetPriority}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CHANGE}>No change</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Assign to</Label>
            <Select value={assignee} onValueChange={setAssignee}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CHANGE}>No change</SelectItem>
                <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name ?? a.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {allTags.length > 0 && (
          <div className="space-y-2">
            <Label>Add tags</Label>
            <div className="flex flex-wrap gap-1.5">
              {allTags.map((t) => {
                const active = tagIds.includes(t.id);
                return (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() =>
                      setTagIds((prev) =>
                        prev.includes(t.id) ? prev.filter((x) => x !== t.id) : [...prev, t.id],
                      )
                    }
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-xs transition-colors',
                      active ? 'border-transparent' : 'border-border text-muted-foreground',
                    )}
                    style={active ? { backgroundColor: `${t.color}20`, color: t.color } : undefined}
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <Button type="submit" disabled={pending}>
          {pending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          Create rule
        </Button>
      </form>

      <div className="divide-y rounded-lg border">
        {rules.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">No automations yet.</p>
        )}
        {rules.map((r) => (
          <div key={r.id} className="flex items-center gap-3 p-3">
            <Switch
              checked={r.enabled}
              onCheckedChange={(v) =>
                start(async () => {
                  await toggleRule(r.id, v);
                  router.refresh();
                })
              }
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{r.name}</p>
              <p className="truncate text-xs text-muted-foreground">{summarize(r)}</p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 shrink-0 text-destructive"
              onClick={() =>
                start(async () => {
                  await deleteRule(r.id);
                  router.refresh();
                })
              }
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
