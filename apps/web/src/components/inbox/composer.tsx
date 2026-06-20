'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Send, Loader2, Zap, StickyNote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { sendMessage } from '@/server/actions/inbox';
import { AiAssist } from '@/components/inbox/ai-assist';
import { cn } from '@/lib/utils';

export function Composer({
  conversationId,
  macros,
  aiEnabled,
}: {
  conversationId: string;
  macros: { id: string; name: string; body: string }[];
  aiEnabled: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [isNote, setIsNote] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLTextAreaElement>(null);

  function submit() {
    const trimmed = body.trim();
    if (!trimmed) return;
    start(async () => {
      const res = await sendMessage({ conversationId, body: trimmed, isPrivateNote: isNote });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setBody('');
      router.refresh();
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function insertMacro(text: string) {
    setBody((b) => (b ? `${b}\n${text}` : text));
    ref.current?.focus();
  }

  return (
    <div className={cn('border-t p-3', isNote && 'bg-warning/5')}>
      <div className="flex items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <Switch id="note-mode" checked={isNote} onCheckedChange={setIsNote} />
          <Label htmlFor="note-mode" className="flex items-center gap-1.5 text-xs">
            <StickyNote className="h-3.5 w-3.5" />
            Internal note
          </Label>
        </div>
        <div className="flex items-center gap-1">
          {aiEnabled && <AiAssist conversationId={conversationId} onDraft={setBody} />}
          {macros.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
                  <Zap className="h-3.5 w-3.5" />
                  Macros
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 p-1">
                <div className="max-h-64 overflow-y-auto">
                  {macros.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => insertMacro(m.body)}
                      className="flex w-full flex-col items-start rounded-md px-2.5 py-2 text-left text-sm hover:bg-accent"
                    >
                      <span className="font-medium">{m.name}</span>
                      <span className="line-clamp-1 text-xs text-muted-foreground">{m.body}</span>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      <div className="flex items-end gap-2">
        <Textarea
          ref={ref}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={isNote ? 'Write an internal note…' : 'Type a message…'}
          className="max-h-40 min-h-[44px] resize-none"
          rows={1}
        />
        <Button onClick={submit} disabled={pending || !body.trim()} size="icon" className="h-11 w-11 shrink-0">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
      <p className="px-1 pt-1.5 text-[11px] text-muted-foreground">
        Enter to send · Shift+Enter for a new line
      </p>
    </div>
  );
}
