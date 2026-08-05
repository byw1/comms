'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Sparkles, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { summarizeConversationAction, suggestReplyAction } from '@/server/actions/ai';

export function AiAssist({
  conversationId,
  onDraft,
}: {
  conversationId: string;
  onDraft: (text: string) => void;
}) {
  const [pending, start] = useTransition();
  const [summary, setSummary] = useState<string | null>(null);
  // Track which button fired so only that one shows a spinner.
  const [active, setActive] = useState<'suggest' | 'summarize' | null>(null);

  function suggest() {
    setActive('suggest');
    start(async () => {
      const res = await suggestReplyAction(conversationId);
      if (res.ok) {
        onDraft(res.text);
        toast.success('Draft inserted — review before sending.');
      } else {
        toast.error(res.error);
      }
      setActive(null);
    });
  }

  function summarize() {
    setActive('summarize');
    start(async () => {
      const res = await summarizeConversationAction(conversationId);
      if (res.ok) setSummary(res.text);
      else toast.error(res.error);
      setActive(null);
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className="gap-1.5 text-brand hover:bg-brand-muted hover:text-brand"
        onClick={suggest}
        loading={pending && active === 'suggest'}
        disabled={pending}
      >
        <Sparkles className="h-3.5 w-3.5" />
        Suggest reply
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className="gap-1.5"
        onClick={summarize}
        loading={pending && active === 'summarize'}
        disabled={pending}
      >
        <FileText className="h-3.5 w-3.5" />
        Summarize
      </Button>

      <Dialog open={summary !== null} onOpenChange={(o) => !o && setSummary(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-muted text-brand">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              Conversation summary
            </DialogTitle>
            <DialogDescription className="whitespace-pre-wrap pt-2 text-[13.5px] leading-relaxed text-foreground">
              {summary}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
}
