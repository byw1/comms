'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Sparkles, FileText, Loader2 } from 'lucide-react';
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

  function suggest() {
    start(async () => {
      const res = await suggestReplyAction(conversationId);
      if (res.ok) {
        onDraft(res.text);
        toast.success('Draft inserted — review before sending.');
      } else {
        toast.error(res.error);
      }
    });
  }

  function summarize() {
    start(async () => {
      const res = await summarizeConversationAction(conversationId);
      if (res.ok) setSummary(res.text);
      else toast.error(res.error);
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 gap-1.5 text-xs"
        onClick={suggest}
        disabled={pending}
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
        Suggest reply
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 gap-1.5 text-xs"
        onClick={summarize}
        disabled={pending}
      >
        <FileText className="h-3.5 w-3.5" />
        Summarize
      </Button>

      <Dialog open={summary !== null} onOpenChange={(o) => !o && setSummary(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Conversation summary
            </DialogTitle>
            <DialogDescription className="whitespace-pre-wrap pt-2 text-sm text-foreground">
              {summary}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
}
