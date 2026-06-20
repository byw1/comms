'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createTag, deleteTag } from '@/server/actions/admin';

const PRESET_COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#71717a'];

export function TagManager({ tags }: { tags: { id: string; name: string; color: string }[] }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[5]!);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-6">
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          start(async () => {
            const res = await createTag({ name, color });
            if (!res.ok) toast.error(res.error);
            else {
              setName('');
              router.refresh();
            }
          });
        }}
      >
        <div className="flex-1 space-y-2">
          <label className="text-sm font-medium">New tag</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Billing" />
        </div>
        <div className="flex gap-1.5 pb-2">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className="h-6 w-6 rounded-full ring-offset-2 transition-all"
              style={{
                backgroundColor: c,
                outline: color === c ? `2px solid ${c}` : 'none',
                outlineOffset: '2px',
              }}
              aria-label={c}
            />
          ))}
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </Button>
      </form>

      <div className="flex flex-wrap gap-2">
        {tags.length === 0 && <p className="text-sm text-muted-foreground">No tags yet.</p>}
        {tags.map((t) => (
          <span
            key={t.id}
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm"
            style={{ backgroundColor: `${t.color}20`, color: t.color }}
          >
            {t.name}
            <button
              onClick={() =>
                start(async () => {
                  await deleteTag(t.id);
                  router.refresh();
                })
              }
              className="opacity-60 hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
