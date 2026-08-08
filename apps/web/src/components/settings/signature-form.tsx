'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { updateSignaturePreference } from '@/server/actions/profile';

/**
 * Personal signature. Appended to replies you send from any inbox, ahead of
 * the inbox's own signature; leaving it blank falls back to the inbox one.
 */
export function SignatureForm({ signature: initial }: { signature: string }) {
  const [value, setValue] = useState(initial);
  const [pending, start] = useTransition();
  const dirty = value !== initial;

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await updateSignaturePreference(value);
          if (res.ok) toast.success(value.trim() ? 'Signature saved' : 'Signature removed');
          else toast.error(res.error);
        });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="signature">Your signature</Label>
        <Textarea
          id="signature"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder={'— Sam\nAcme Support'}
          className="resize-none font-mono text-[13px]"
        />
        <p className="text-xs text-muted-foreground">
          Added to the end of replies you send. Texting is informal — a name or a one-liner
          usually beats a block. Leave blank to use the inbox's signature instead.
        </p>
      </div>
      <Button type="submit" disabled={pending || !dirty}>
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save signature
      </Button>
    </form>
  );
}
