'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { createMacro, deleteMacro } from '@/server/actions/admin';

export function MacroManager({
  macros,
}: {
  macros: { id: string; name: string; body: string; shortcut: string | null }[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', body: '', shortcut: '' });
  const [pending, start] = useTransition();

  return (
    <div className="space-y-6">
      <form
        className="space-y-3 rounded-lg border p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.name.trim() || !form.body.trim()) return;
          start(async () => {
            const res = await createMacro(form);
            if (!res.ok) toast.error(res.error);
            else {
              setForm({ name: '', body: '', shortcut: '' });
              router.refresh();
            }
          });
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="m-name">Name</Label>
            <Input
              id="m-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Greeting"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="m-shortcut">Shortcut (optional)</Label>
            <Input
              id="m-shortcut"
              value={form.shortcut}
              onChange={(e) => setForm((f) => ({ ...f, shortcut: e.target.value }))}
              placeholder="/hi"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="m-body">Message</Label>
          <Textarea
            id="m-body"
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            placeholder="Hi! Thanks for reaching out…"
            rows={3}
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          Add macro
        </Button>
      </form>

      <div className="divide-y rounded-lg border">
        {macros.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">No macros yet.</p>
        )}
        {macros.map((m) => (
          <div key={m.id} className="flex items-start justify-between gap-3 p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {m.name}
                {m.shortcut && (
                  <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">
                    {m.shortcut}
                  </span>
                )}
              </p>
              <p className="line-clamp-2 text-xs text-muted-foreground">{m.body}</p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 shrink-0 text-destructive"
              onClick={() =>
                start(async () => {
                  await deleteMacro(m.id);
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
