import { eq } from '@comms/db';
import { channelConnections } from '@comms/db';
import { enqueueInbound, logger } from '@comms/core';
import { db } from '@/server/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const log = logger.child({ route: 'bluebubbles-webhook' });

/**
 * Inbound BlueBubbles webhook. Authenticated by a per-connection secret carried
 * in the URL (BlueBubbles posts to the URL verbatim and signs nothing). We do
 * the minimum work here — validate + enqueue — and let the worker do the rest.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ connectionId: string }> },
) {
  const { connectionId } = await params;
  const url = new URL(req.url);
  const secret = url.searchParams.get('secret');

  const connection = await db.query.channelConnections.findFirst({
    where: eq(channelConnections.id, connectionId),
  });
  if (!connection || !secret || secret !== connection.webhookSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  let payload: { type?: string; data?: unknown };
  try {
    payload = await req.json();
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  if (!payload.type) return Response.json({ ok: true, ignored: true });

  try {
    await enqueueInbound({
      connectionId,
      type: payload.type,
      data: payload.data,
      receivedAt: Date.now(),
    });
  } catch (err) {
    log.error({ err: (err as Error).message }, 'failed to enqueue inbound event');
    return new Response('Queue error', { status: 503 });
  }

  return Response.json({ ok: true });
}
