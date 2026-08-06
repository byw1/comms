import { eq } from '@comms/db';
import { contacts } from '@comms/db';
import { getPresignedUrl, isStorageEnabled } from '@comms/core';
import { db } from '@/server/db';
import { getCurrentUser } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Redirect to a short-lived presigned URL for a synced address-book photo. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ contactId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { contactId } = await params;
  const contact = await db.query.contacts.findFirst({ where: eq(contacts.id, contactId) });
  if (!contact?.avatarStorageKey || !isStorageEnabled()) {
    return new Response('Not found', { status: 404 });
  }

  const url = await getPresignedUrl(contact.avatarStorageKey, 3600);
  return Response.redirect(url, 302);
}
