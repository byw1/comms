'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { updateInboxSettings } from '@/server/actions/connections';

type Settings = {
  autoAssign?: boolean;
  assignStrategy?: 'round_robin' | 'least_busy';
  markReadOnReply?: boolean;
};

export function InboxSettings({ inboxId, settings }: { inboxId: string; settings: Settings }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [autoAssign, setAutoAssign] = useState(Boolean(settings.autoAssign));
  const [strategy, setStrategy] = useState<'round_robin' | 'least_busy'>(
    settings.assignStrategy ?? 'round_robin',
  );
  const [markRead, setMarkRead] = useState(Boolean(settings.markReadOnReply));

  function save(patch: Settings) {
    start(async () => {
      const res = await updateInboxSettings(inboxId, patch);
      if (!res.ok) toast.error('Failed to save settings');
      else router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Auto-assign new conversations</p>
          <p className="text-xs text-muted-foreground">Route incoming chats to an available agent.</p>
        </div>
        <Switch
          checked={autoAssign}
          disabled={pending}
          onCheckedChange={(v) => {
            setAutoAssign(v);
            save({ autoAssign: v });
          }}
        />
      </div>

      {autoAssign && (
        <div className="flex items-center justify-between gap-4">
          <Label className="text-sm">Assignment strategy</Label>
          <Select
            value={strategy}
            disabled={pending}
            onValueChange={(v) => {
              const s = v as 'round_robin' | 'least_busy';
              setStrategy(s);
              save({ assignStrategy: s });
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="round_robin">Round robin</SelectItem>
              <SelectItem value="least_busy">Least busy</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Send read receipts on reply</p>
          <p className="text-xs text-muted-foreground">
            Marks the chat read in iMessage when an agent replies (requires Private API).
          </p>
        </div>
        <Switch
          checked={markRead}
          disabled={pending}
          onCheckedChange={(v) => {
            setMarkRead(v);
            save({ markReadOnReply: v });
          }}
        />
      </div>
    </div>
  );
}
