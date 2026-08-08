'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, Loader2, MapPin, MessageSquare, ShieldAlert, UserPlus } from 'lucide-react';
import { nameContact } from '@/server/actions/contacts';
import { localTimeForAddress, zoneForAddress } from '@/lib/area-code-time';
import { zoneLabel } from '@/lib/intro';
import { cn } from '@/lib/utils';

export interface InstantIntroProps {
  contactId: string | null;
  /** Formatted number/address the thread is with. */
  address: string | null;
  /** Raw address for the area-code lookup. */
  rawAddress: string | null;
  /** Conversations we've had with this same identity, this one included. */
  conversationCount: number;
  /** "Sarah" / "Acme" pulled from their first message, when they said so. */
  introducedName: string | null;
  introducedCompany: string | null;
  optedOut: boolean;
}

/**
 * Instant Intro: everything the app can tell you about an unknown number,
 * shown before you decide how (or whether) to answer.
 *
 * Rendered only while the contact has no name — the moment they're
 * identified, the person card takes over and this disappears. The one-click
 * "save name" is the point: the app noticed the introduction so nobody has
 * to retype it.
 */
export function InstantIntro(p: InstantIntroProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const zone = zoneForAddress(p.rawAddress ?? p.address);
  const region = zoneLabel(zone);
  const local = localTimeForAddress(p.rawAddress ?? p.address);
  const isFirstContact = p.conversationCount <= 1;

  function saveName() {
    if (!p.contactId || !p.introducedName) return;
    start(async () => {
      const res = await nameContact({
        contactId: p.contactId!,
        name: p.introducedName!,
        company: p.introducedCompany,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setSaved(true);
      toast.success(`Saved as ${p.introducedName}`);
      router.refresh();
    });
  }

  return (
    <div className="mx-4 mt-4 rounded-xl border border-brand-border/60 bg-brand-muted/40 p-3">
      <p className="type-micro mb-2 flex items-center gap-1.5 text-brand">
        <ShieldAlert className="h-3 w-3" />
        {isFirstContact ? 'New — first time reaching out' : 'Unknown number'}
      </p>

      <div className="space-y-1.5 text-[12.5px]">
        {region && (
          <p className="flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            {region}
            {local && (
              <span className={cn(local.unsociable && 'text-warning')}>
                · {local.time} their time
              </span>
            )}
          </p>
        )}
        <p className="flex items-center gap-1.5 text-muted-foreground">
          <MessageSquare className="h-3 w-3 shrink-0" />
          {isFirstContact
            ? 'No previous conversations with this number'
            : `${p.conversationCount - 1} previous conversation${p.conversationCount === 2 ? '' : 's'}`}
        </p>
        {p.optedOut && (
          <p className="flex items-center gap-1.5 font-medium text-destructive">
            <ShieldAlert className="h-3 w-3 shrink-0" />
            Opted out (replied STOP) — sending is blocked
          </p>
        )}
      </div>

      {p.introducedName && (
        <div className="mt-2.5 rounded-lg border bg-surface p-2.5">
          <p className="text-[12px] text-muted-foreground">They introduced themselves as</p>
          <p className="mt-0.5 text-[13px] font-semibold">
            {p.introducedName}
            {p.introducedCompany && (
              <span className="font-normal text-muted-foreground"> · {p.introducedCompany}</span>
            )}
          </p>
          {p.contactId && (
            <button
              type="button"
              onClick={saveName}
              disabled={pending || saved}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-[11.5px] font-medium text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
            >
              {saved ? (
                <Check className="h-3 w-3" />
              ) : pending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <UserPlus className="h-3 w-3" />
              )}
              {saved ? 'Saved' : `Save contact as ${p.introducedName}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
