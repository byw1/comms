'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateOrgName } from '@/server/actions/admin';

export function GeneralForm({ orgName }: { orgName: string }) {
  const [value, setValue] = useState(orgName);
  const [pending, start] = useTransition();

  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await updateOrgName(value);
          if (res.ok) toast.success('Saved');
          else toast.error(res.error);
        });
      }}
    >
      <div className="flex-1 space-y-2">
        <Label htmlFor="orgName">Workspace name</Label>
        <Input id="orgName" value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save
      </Button>
    </form>
  );
}
