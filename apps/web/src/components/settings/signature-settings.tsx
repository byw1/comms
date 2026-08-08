'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { updateSignatureSettings } from '@/server/actions/admin';

/** Workspace-wide master switch for the signature mechanism. */
export function SignatureSettings({ enabled: initial }: { enabled: boolean }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial);
  const [pending, start] = useTransition();

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">Append signatures to replies</p>
        <p className="text-xs text-muted-foreground">
          When on, each reply carries the sender's personal signature — or the inbox's, if they
          haven't set one. Turn off to disable signatures everywhere, regardless of what anyone
          has configured.
        </p>
      </div>
      <Switch
        checked={enabled}
        disabled={pending}
        onCheckedChange={(v) => {
          setEnabled(v);
          start(async () => {
            const res = await updateSignatureSettings({ enabled: v });
            if (!res.ok) {
              setEnabled(!v);
              toast.error('error' in res ? res.error : 'Failed to save');
            } else {
              router.refresh();
            }
          });
        }}
      />
    </div>
  );
}
