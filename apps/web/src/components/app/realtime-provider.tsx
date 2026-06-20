'use client';

import { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export type RealtimeEvent = {
  type: string;
  conversationId?: string;
  inboxId?: string;
  messageId?: string;
  userId?: string;
  userName?: string;
  state?: 'viewing' | 'typing' | 'left';
  [key: string]: unknown;
};

type Handler = (e: RealtimeEvent) => void;

interface RealtimeContext {
  subscribe: (h: Handler) => () => void;
  currentUser: { id: string; name: string | null; image: string | null };
}

const Ctx = createContext<RealtimeContext | null>(null);

const REFRESH_EVENTS = new Set([
  'message.created',
  'message.updated',
  'conversation.created',
  'conversation.updated',
  'connection.status',
]);

/**
 * Single SSE connection for the whole app. Components subscribe via `useRealtime`;
 * data-changing events also trigger a throttled `router.refresh()` so server
 * components re-render. Replaces per-component EventSource connections.
 */
export function RealtimeProvider({
  currentUser,
  children,
}: {
  currentUser: { id: string; name: string | null; image: string | null };
  children: React.ReactNode;
}) {
  const router = useRouter();
  const handlers = useRef(new Set<Handler>());
  const refreshPending = useRef(false);

  useEffect(() => {
    const source = new EventSource('/api/events');
    source.onmessage = (ev) => {
      let data: RealtimeEvent;
      try {
        data = JSON.parse(ev.data);
      } catch {
        return;
      }
      handlers.current.forEach((h) => {
        try {
          h(data);
        } catch {
          /* ignore handler errors */
        }
      });
      if (REFRESH_EVENTS.has(data.type) && !refreshPending.current) {
        refreshPending.current = true;
        setTimeout(() => {
          refreshPending.current = false;
          router.refresh();
        }, 400);
      }
    };
    return () => source.close();
  }, [router]);

  const subscribe = useCallback((h: Handler) => {
    handlers.current.add(h);
    return () => {
      handlers.current.delete(h);
    };
  }, []);

  return <Ctx.Provider value={{ subscribe, currentUser }}>{children}</Ctx.Provider>;
}

/** Subscribe to realtime events. The handler may change between renders. */
export function useRealtime(handler: Handler) {
  const ctx = useContext(Ctx);
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!ctx) return;
    return ctx.subscribe((e) => ref.current(e));
  }, [ctx]);
}

export function useCurrentUser() {
  return useContext(Ctx)?.currentUser ?? null;
}
