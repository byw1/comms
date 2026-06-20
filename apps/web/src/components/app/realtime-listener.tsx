'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Subscribes to the server's SSE stream and refreshes server components when
 * relevant events arrive. Refreshes are throttled to avoid hammering the server
 * during bursts.
 */
export function RealtimeListener() {
  const router = useRouter();
  const pending = useRef(false);

  useEffect(() => {
    const source = new EventSource('/api/events');
    const refresh = () => {
      if (pending.current) return;
      pending.current = true;
      setTimeout(() => {
        pending.current = false;
        router.refresh();
      }, 400);
    };

    source.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        if (
          event.type === 'message.created' ||
          event.type === 'message.updated' ||
          event.type === 'conversation.created' ||
          event.type === 'conversation.updated' ||
          event.type === 'connection.status'
        ) {
          refresh();
        }
      } catch {
        /* ignore */
      }
    };
    source.onerror = () => {
      // EventSource auto-reconnects; nothing to do.
    };

    return () => source.close();
  }, [router]);

  return null;
}
