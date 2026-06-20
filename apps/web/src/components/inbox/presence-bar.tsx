'use client';

import { useEffect, useState } from 'react';
import { useRealtime, useCurrentUser } from '@/components/app/realtime-provider';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { initials } from '@/lib/utils';

type Peer = { userId: string; name: string; state: 'viewing' | 'typing'; expires: number };

/** Shows other agents currently viewing/typing in this conversation (collision avoidance). */
export function PresenceBar({ conversationId }: { conversationId: string }) {
  const me = useCurrentUser();
  const [peers, setPeers] = useState<Record<string, Peer>>({});

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

  useRealtime((e) => {
    if (e.type !== 'presence' || e.conversationId !== conversationId) return;
    if (me && e.userId === me.id) return;
    setPeers((prev) => {
      const next = { ...prev };
      if (e.state === 'left') {
        if (e.userId) delete next[e.userId];
      } else if (e.userId) {
        next[e.userId] = {
          userId: e.userId,
          name: e.userName ?? 'Agent',
          state: e.state === 'typing' ? 'typing' : 'viewing',
          expires: Date.now() + 8000,
        };
      }
      return next;
    });
  });

  // Expire stale peers (missed "left" events).
  useEffect(() => {
    const iv = setInterval(() => {
      setPeers((prev) => {
        const now = Date.now();
        let changed = false;
        const next: Record<string, Peer> = {};
        for (const [k, v] of Object.entries(prev)) {
          if (v.expires >= now) next[k] = v;
          else changed = true;
        }
        return changed ? next : prev;
      });
    }, 3000);
    return () => clearInterval(iv);
  }, []);

  const list = Object.values(peers);
  if (list.length === 0) return null;
  const typing = list.filter((p) => p.state === 'typing');
  const firstNames = (ps: Peer[]) => ps.map((p) => p.name.split(' ')[0]).join(', ');

  return (
    <div className="flex items-center gap-2 text-xs text-warning">
      <div className="flex -space-x-2">
        {list.slice(0, 3).map((p) => (
          <Avatar key={p.userId} className="h-6 w-6 border-2 border-card">
            <AvatarFallback className="text-[10px]">{initials(p.name)}</AvatarFallback>
          </Avatar>
        ))}
      </div>
      <span>
        {typing.length > 0
          ? `${firstNames(typing)} ${typing.length > 1 ? 'are' : 'is'} typing…`
          : `${firstNames(list)} also here`}
      </span>
    </div>
  );
}
