import { publishEvent } from '@comms/core';
import { getCurrentUser } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Record an agent's presence on a conversation (viewing / typing / left). */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  let body: { conversationId?: string; state?: string };
  try {
    body = await req.json();
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  const { conversationId, state } = body;
  if (!conversationId || (state !== 'viewing' && state !== 'typing' && state !== 'left')) {
    return new Response('Bad Request', { status: 400 });
  }

  await publishEvent({
    type: 'presence',
    conversationId,
    userId: user.id,
    userName: user.name ?? 'Agent',
    state,
  });
  return Response.json({ ok: true });
}
