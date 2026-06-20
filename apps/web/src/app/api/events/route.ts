import { subscribeEvents } from '@comms/core';
import { getCurrentUser } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Server-Sent Events stream of realtime updates (new messages, ticket changes). */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | undefined;
  let ping: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      send({ type: 'ready' });
      unsubscribe = subscribeEvents((event) => {
        try {
          send(event);
        } catch {
          /* stream closed */
        }
      });
      ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          /* stream closed */
        }
      }, 25_000);

      req.signal.addEventListener('abort', () => {
        if (ping) clearInterval(ping);
        unsubscribe?.();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      if (ping) clearInterval(ping);
      unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
