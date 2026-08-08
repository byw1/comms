'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, Loader2, Plus, Trash2, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createTeam,
  deleteTeam,
  setTeamMembership,
  updateTeam,
  type TeamRow,
} from '@/server/actions/teams';
import { cn, initials } from '@/lib/utils';

const COLORS = ['#71717a', '#0ea5e9', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444'];

/**
 * Teams: who a client's conversations belong to.
 *
 * A team is a routing and attention boundary, not a permission one — everyone
 * in a shared inbox can still see everything, which is what makes it shared.
 * The counts on each row are the honest measure of whether a team is real:
 * a team with no clients and no open work is a name somebody typed once.
 */
export function TeamManager({
  teams,
  agents,
}: {
  teams: TeamRow[];
  agents: { id: string; name: string | null; email: string; image: string | null }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[1]!);
  const [expanded, setExpanded] = useState<string | null>(null);

  function add() {
    if (!name.trim()) return;
    start(async () => {
      const res = await createTeam({ name, color });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Created ${name.trim()}`);
      setName('');
      router.refresh();
    });
  }

  function remove(team: TeamRow) {
    start(async () => {
      const res = await deleteTeam(team.id);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(
          team.openCount > 0
            ? `Deleted ${team.name} — its ${team.openCount} open conversation${team.openCount === 1 ? '' : 's'} moved to no team`
            : `Deleted ${team.name}`,
        );
        router.refresh();
      }
    });
  }

  function toggleMember(teamId: string, userId: string, member: boolean) {
    start(async () => {
      const res = await setTeamMembership({ teamId, userId, member });
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <div className="min-w-[180px] flex-1 space-y-2">
          <Label htmlFor="team-name">New team</Label>
          <Input
            id="team-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Enterprise"
            maxLength={60}
          />
        </div>
        <div className="flex items-center gap-1 pb-1">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`Colour ${c}`}
              className={cn(
                'h-6 w-6 rounded-full border-2 transition-transform active:scale-90',
                color === c ? 'border-foreground' : 'border-transparent',
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <Button type="submit" disabled={pending || !name.trim()}>
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
          Add team
        </Button>
      </form>

      {teams.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-muted-foreground">
            <UsersRound className="h-4 w-4" />
          </div>
          <p className="text-sm font-medium">No teams yet</p>
          <p className="max-w-[360px] text-xs text-muted-foreground">
            Create one, then assign a client to it from their contact panel — every conversation
            they start after that routes to the team automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {teams.map((t) => (
            <div key={t.id} className="rounded-lg border">
              <div className="flex items-center gap-2.5 px-3 py-2.5">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: t.color }}
                />
                <input
                  defaultValue={t.name}
                  onBlur={(e) => {
                    if (e.target.value.trim() && e.target.value !== t.name) {
                      start(async () => {
                        await updateTeam({ id: t.id, name: e.target.value });
                        router.refresh();
                      });
                    }
                  }}
                  className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
                />
                <span className="shrink-0 text-xs text-muted-foreground">
                  {t.clientCount} client{t.clientCount === 1 ? '' : 's'} · {t.openCount} open
                </span>
                <button
                  type="button"
                  onClick={() => setExpanded(expanded === t.id ? null : t.id)}
                  className="shrink-0 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {t.memberIds.length} member{t.memberIds.length === 1 ? '' : 's'}
                </button>
                <button
                  type="button"
                  onClick={() => remove(t)}
                  disabled={pending}
                  aria-label={`Delete ${t.name}`}
                  className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive-muted hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {expanded === t.id && (
                <div className="border-t px-3 py-2">
                  <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                    Members — round-robin assignment draws from this list
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {agents.map((a) => {
                      const member = t.memberIds.includes(a.id);
                      return (
                        <button
                          key={a.id}
                          type="button"
                          disabled={pending}
                          onClick={() => toggleMember(t.id, a.id, !member)}
                          className={cn(
                            'flex items-center gap-1.5 rounded-md border px-2 py-1 text-[12px] transition-all active:scale-95',
                            member
                              ? 'border-brand bg-brand-muted text-brand'
                              : 'text-muted-foreground hover:border-border-strong hover:bg-accent',
                          )}
                        >
                          {member ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-secondary text-[8px] font-semibold">
                              {initials(a.name ?? a.email)}
                            </span>
                          )}
                          {a.name ?? a.email}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
