'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { useRealtime } from '@/components/app/realtime-provider';
import { AnimatePresence, motion } from '@/components/ui/motion';

export type UnhealthyConnection = {
  connectionId: string;
  inboxName: string;
  reason: 'error' | 'stale';
};

/**
 * Full-width alert strip shown while any channel connection is down or its
 * heartbeat has gone stale (worker dead / Mac asleep). Server-rendered initial
 * state keeps it correct on load; `connection.status` realtime events flip it
 * live within one heartbeat tick (~60s worst case).
 */
export function ChannelHealthBanner({ initial }: { initial: UnhealthyConnection[] }) {
  const [down, setDown] = useState<Map<string, UnhealthyConnection>>(
    () => new Map(initial.map((c) => [c.connectionId, c])),
  );

  useRealtime((e) => {
    if (e.type !== 'connection.status') return;
    const id = e['connectionId'] as string | undefined;
    if (!id) return;
    setDown((prev) => {
      const next = new Map(prev);
      if (e['status'] === 'connected') next.delete(id);
      else next.set(id, { connectionId: id, inboxName: 'iMessage', reason: 'error' });
      return next;
    });
  });

  const list = Array.from(down.values());

  return (
    <AnimatePresence>
      {list.length > 0 && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          className="overflow-hidden"
        >
          <div className="flex items-center gap-2.5 border-b border-destructive/20 bg-destructive-muted px-4 py-2 text-[12.5px] text-destructive">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 flex-1 truncate">
              <span className="font-semibold">
                {list.length === 1 ? `${list[0]!.inboxName} bridge is down` : `${list.length} bridges are down`}
              </span>{' '}
              — new messages are not being received
              {list[0]!.reason === 'stale' && ' (no heartbeat — is the worker or Mac asleep?)'}
            </span>
            <span className="hidden shrink-0 text-[11.5px] opacity-80 sm:inline">
              Replies you send are held and delivered when it&apos;s back.
            </span>
            <Link
              href="/settings/inboxes"
              className="flex shrink-0 items-center gap-1 rounded-md bg-destructive px-2 py-1 text-[11.5px] font-medium text-destructive-foreground transition-transform hover:opacity-90 active:scale-95"
            >
              Update address
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
