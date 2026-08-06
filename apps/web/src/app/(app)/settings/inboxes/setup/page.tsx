import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { listInboxes } from '@/server/queries';
import { BlueBubblesWizard } from '@/components/settings/bluebubbles-wizard';

export const dynamic = 'force-dynamic';

export default async function BlueBubblesSetupPage() {
  const inboxes = await listInboxes();
  const hasExisting = inboxes.some((i) => i.connections.length > 0);

  return (
    <div className="space-y-5">
      <Link
        href="/settings/inboxes"
        className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to channels
      </Link>

      <div>
        <h2 className="text-lg font-semibold tracking-[-0.01em]">Connect your iMessage</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Six short steps, about fifteen minutes. Most of it happens on the Mac you&apos;ll leave
          running — you can close this page and come back; we&apos;ll remember where you were.
        </p>
      </div>

      <BlueBubblesWizard hasExisting={hasExisting} />
    </div>
  );
}
