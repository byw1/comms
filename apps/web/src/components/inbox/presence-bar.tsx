'use client';

import { useEffect } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn, initials } from '@/lib/utils';
import { firstNames, usePeers, type Peer } from '@/lib/use-peers';

/** Shows other agents currently viewing/typing in this conversation (collision avoidance). */
export function PresenceBar({ conversationId }: { conversationId: string }) {
  const list = usePeers(conversationId);

  // Heartbeat our own "viewing" presence while this conversation is open.
  useEffect(() => {
    let active = true;
    const ping = (state: 'viewing' | 'left') =>
      fetch('/api/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, state }),
      }).catch(() => {});
    ping('viewing');
    const iv = setInterval(() => active && ping('viewing'), 4000);
    return () => {
      active = false;
      clearInterval(iv);
      ping('left');
    };
  }, [conversationId]);

  if (list.length === 0) return null;
  const typing = list.filter((p) => p.state === 'typing');

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-full border py-1 pl-1 pr-2.5 text-[11.5px]',
        typing.length > 0
          ? 'border-warning/30 bg-warning-muted text-warning'
          : 'border-border bg-secondary/60 text-muted-foreground',
      )}
    >
      <div className="flex -space-x-1.5">
        {list.slice(0, 3).map((p) => (
          <Avatar key={p.userId} className="h-5 w-5 ring-2 ring-surface">
            <AvatarFallback className="bg-secondary text-[9px] font-semibold">
              {initials(p.name)}
            </AvatarFallback>
          </Avatar>
        ))}
      </div>
      {typing.length > 0 ? (
        <span className="flex items-center gap-1.5">
          {firstNames(typing)} {typing.length > 1 ? 'are' : 'is'} typing
          {/* Three staggered dots, the universal "still writing" signal. */}
          <span className="flex items-end gap-[2px] pb-[2px]">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1 w-1 animate-typing-dot rounded-full bg-current"
                style={{ animationDelay: `${i * 160}ms` }}
              />
            ))}
          </span>
        </span>
      ) : (
        <span>{firstNames(list)} also here</span>
      )}
    </div>
  );
}
