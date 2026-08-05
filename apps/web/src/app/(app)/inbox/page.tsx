import Link from 'next/link';
import { MessagesSquare, Plug } from 'lucide-react';
import { listInboxes } from '@/server/queries';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default async function InboxEmptyPage() {
  const inboxes = await listInboxes();
  const hasConnection = inboxes.some((i) => i.connections.length > 0);

  return (
    <div className="relative flex h-full flex-1 items-center justify-center overflow-hidden p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-50 dark:opacity-25"
        style={{
          backgroundImage: 'radial-gradient(hsl(var(--border-strong)) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
          maskImage: 'radial-gradient(ellipse 60% 50% at 50% 50%, black, transparent)',
          WebkitMaskImage: 'radial-gradient(ellipse 60% 50% at 50% 50%, black, transparent)',
        }}
      />

      <div className="relative max-w-[340px] animate-slide-up text-center">
        {hasConnection ? (
          <>
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl border bg-surface shadow-sm">
              <MessagesSquare className="h-5 w-5 text-muted-foreground" />
            </div>
            <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Select a conversation</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
              Choose one from the list to start replying, or press{' '}
              <kbd className="rounded border bg-secondary px-1 py-px font-sans text-[11px]">⌘K</kbd>{' '}
              to search.
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Plug className="h-5 w-5" />
            </div>
            <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Connect your iMessage</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
              Comms talks to iMessage through a BlueBubbles server running on your Mac. Connect it to
              start receiving messages.
            </p>
            <Button asChild variant="brand" className="mt-5">
              <Link href="/settings/inboxes">Connect BlueBubbles</Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
