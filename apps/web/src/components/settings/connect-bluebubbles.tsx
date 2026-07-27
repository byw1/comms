'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { connectBlueBubbles } from '@/server/actions/connections';

export function ConnectBlueBubbles({ hasExisting = false }: { hasExisting?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [form, setForm] = useState({ name: 'iMessage', serverUrl: '', password: '' });

  function update(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await connectBlueBubbles(form);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `Connected!${res.privateApi ? ' Private API detected.' : ''}${
          res.webhookRegistered ? '' : ' (Webhook needs a public URL — re-register once deployed.)'
        }`,
      );
      setOpen(false);
      setForm({ name: 'iMessage', serverUrl: '', password: '' });
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-1.5 h-4 w-4" />
          {hasExisting ? 'Connect another number' : 'Connect BlueBubbles'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>
              {hasExisting ? 'Connect another number' : 'Connect a BlueBubbles server'}
            </DialogTitle>
            <DialogDescription>
              Enter the URL and password of the BlueBubbles server for this number (running on the
              Mac signed in to that Apple ID). Comms will verify the connection and register a
              webhook automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Inbox name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={update('name')}
                placeholder={hasExisting ? 'Support · +1 555…' : 'iMessage'}
              />
              <p className="text-xs text-muted-foreground">
                Give each number a distinct name (e.g. the team or phone number) so you can tell
                channels apart in the inbox.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="serverUrl">Server URL</Label>
              <Input
                id="serverUrl"
                value={form.serverUrl}
                onChange={update('serverUrl')}
                placeholder="https://your-tunnel.trycloudflare.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Server password</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={update('password')}
                placeholder="Your BlueBubbles password"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Connect
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
