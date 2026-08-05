import { getRedis, createRedis } from './redis.js';

/**
 * Lightweight realtime fan-out over Redis pub/sub. The worker and API publish
 * events; the web service's SSE endpoint subscribes and streams to browsers.
 */
export type RealtimeEvent =
  | { type: 'message.created'; conversationId: string; inboxId: string; messageId: string }
  | { type: 'message.updated'; conversationId: string; inboxId: string; messageId: string }
  | { type: 'conversation.created'; conversationId: string; inboxId: string }
  | { type: 'conversation.updated'; conversationId: string; inboxId: string }
  | { type: 'typing'; conversationId: string; inboxId: string; isTyping: boolean }
  | {
      type: 'presence';
      conversationId: string;
      userId: string;
      userName: string;
      state: 'viewing' | 'typing' | 'left';
    }
  | { type: 'notification'; userId: string }
  | { type: 'connection.status'; connectionId: string; status: string };

export const RT_CHANNEL = 'comms:rt';

export async function publishEvent(event: RealtimeEvent): Promise<void> {
  await getRedis().publish(RT_CHANNEL, JSON.stringify(event));
}

/**
 * Subscribe to realtime events. Returns an unsubscribe function.
 *
 * All subscribers in this process share ONE Redis connection: a subscribed
 * ioredis client can't run commands, so it must be dedicated — but it does not
 * need to be per-caller. The previous implementation opened a new Redis
 * connection per SSE stream (i.e. per browser tab), which is a connection-count
 * cliff on any managed Redis. The shared client lazily connects on the first
 * subscriber and quits when the last one leaves.
 */
const handlers = new Set<(event: RealtimeEvent) => void>();
let shared: ReturnType<typeof createRedis> | null = null;

function ensureSharedSubscriber() {
  if (shared) return;
  shared = createRedis();
  void shared.subscribe(RT_CHANNEL);
  shared.on('message', (_channel, message) => {
    let event: RealtimeEvent;
    try {
      event = JSON.parse(message) as RealtimeEvent;
    } catch {
      return; // malformed payload
    }
    for (const h of handlers) {
      try {
        h(event);
      } catch {
        // one bad handler must not break the fan-out
      }
    }
  });
}

export function subscribeEvents(handler: (event: RealtimeEvent) => void): () => void {
  ensureSharedSubscriber();
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
    if (handlers.size === 0 && shared) {
      void shared.quit();
      shared = null;
    }
  };
}
