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
 * Subscribe to realtime events. Returns an unsubscribe function. Creates a
 * dedicated connection because a subscribed ioredis client can't run commands.
 */
export function subscribeEvents(handler: (event: RealtimeEvent) => void): () => void {
  const sub = createRedis();
  void sub.subscribe(RT_CHANNEL);
  sub.on('message', (_channel, message) => {
    try {
      handler(JSON.parse(message) as RealtimeEvent);
    } catch {
      // ignore malformed payloads
    }
  });
  return () => {
    void sub.quit();
  };
}
