'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateSlaSettings } from '@/server/actions/admin';

export function SlaForm({
  sla,
}: {
  sla: { firstResponseMinutes?: number; nextResponseMinutes?: number };
}) {
  const [first, setFirst] = useState(sla.firstResponseMinutes?.toString() ?? '');
  const [next, setNext] = useState(sla.nextResponseMinutes?.toString() ?? '');
  const [pending, start] = useTransition();

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await updateSlaSettings({
            firstResponseMinutes: first ? Number(first) : undefined,
            nextResponseMinutes: next ? Number(next) : undefined,
          });
          if (res.ok) toast.success('Saved');
          else toast.error(res.error);
        });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="first">First response (minutes)</Label>
          <Input
            id="first"
            type="number"
            min={0}
            value={first}
            onChange={(e) => setFirst(e.target.value)}
            placeholder="e.g. 30"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="next">Response time (minutes)</Label>
          <Input
            id="next"
            type="number"
            min={0}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder="e.g. 60"
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Leave blank to disable. Conversations that go unanswered past the response time are flagged
        as breached and the assignee is notified.
      </p>
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save SLA targets
      </Button>
    </form>
  );
}
