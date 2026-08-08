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
  csatEnabled?: boolean;
  signature?: string;
};

export function InboxSettings({ inboxId, settings }: { inboxId: string; settings: Settings }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [autoAssign, setAutoAssign] = useState(Boolean(settings.autoAssign));
  const [strategy, setStrategy] = useState<'round_robin' | 'least_busy'>(
    settings.assignStrategy ?? 'round_robin',
  );
  const [markRead, setMarkRead] = useState(Boolean(settings.markReadOnReply));
  const [csat, setCsat] = useState(Boolean(settings.csatEnabled));
  const [signature, setSignature] = useState(settings.signature ?? '');

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

      <div className="space-y-1.5">
        <div>
          <p className="text-sm font-medium">Inbox signature</p>
          <p className="text-xs text-muted-foreground">
            Appended to replies from this number when the sender has no personal signature.
            Workspace → Signatures turns the whole mechanism on or off.
          </p>
        </div>
        <textarea
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
          onBlur={() => {
            if (signature !== (settings.signature ?? '')) save({ signature });
          }}
          rows={2}
          maxLength={500}
          placeholder="— The Acme team"
          className="w-full resize-none rounded-lg border bg-transparent px-2.5 py-2 font-mono text-[12.5px] outline-none transition-colors focus:border-brand/50"
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Send CSAT survey on close</p>
          <p className="text-xs text-muted-foreground">
            Ask the customer to rate 1–5 over iMessage when a ticket is closed.
          </p>
        </div>
        <Switch
          checked={csat}
          disabled={pending}
          onCheckedChange={(v) => {
            setCsat(v);
            save({ csatEnabled: v });
          }}
        />
      </div>
    </div>
  );
}
