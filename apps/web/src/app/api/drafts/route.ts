import { NextResponse } from 'next/server';
import { saveDraft } from '@/server/actions/drafts';

/**
 * Beacon target for the composer's last-moment draft flush.
 *
 * `navigator.sendBeacon` can't call a server action, and a normal fetch is
 * cancelled when the page goes away — which is the one moment we most need the
 * write to land. This route exists purely so closing a tab mid-sentence doesn't
 * lose the sentence.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      conversationId?: string;
      body?: string;
      isPrivateNote?: boolean;
    };
    if (!body?.conversationId) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    await saveDraft({
      conversationId: body.conversationId,
      body: body.body ?? '',
      isPrivateNote: Boolean(body.isPrivateNote),
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
