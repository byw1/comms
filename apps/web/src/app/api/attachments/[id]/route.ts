import { eq } from '@comms/db';
import { attachments } from '@comms/db';
import { getPresignedUrl, isStorageEnabled } from '@comms/core';
import { db } from '@/server/db';
import { getCurrentUser } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Redirect to a short-lived presigned URL for a stored attachment. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { id } = await params;
  const att = await db.query.attachments.findFirst({ where: eq(attachments.id, id) });
  if (!att || att.status !== 'stored' || !isStorageEnabled()) {
    return new Response('Not found', { status: 404 });
  }

  // `?rendition=playable` serves the browser-playable copy of a voice memo;
  // everything else gets the original bytes.
  const wantPlayable = new URL(req.url).searchParams.get('rendition') === 'playable';
  const key = wantPlayable ? (att.playableStorageKey ?? att.storageKey) : att.storageKey;
  if (!key) return new Response('Not found', { status: 404 });

  const url = await getPresignedUrl(key, 3600);
  return Response.redirect(url, 302);
}
