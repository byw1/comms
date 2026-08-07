import { requireDbUser } from '@/lib/session';
import { KeyboardForm } from '@/components/settings/keyboard-form';
import type { KeymapPreference } from '@/lib/keymap';

export const dynamic = 'force-dynamic';

export default async function KeyboardSettingsPage() {
  const me = await requireDbUser();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Keyboard shortcuts</h2>
        <p className="text-sm text-muted-foreground">
          Start from a preset, then rebind anything. Press{' '}
          <kbd className="rounded border bg-secondary px-1 py-px font-sans text-[11px]">?</kbd>{' '}
          anywhere in the app to see your current keys.
        </p>
      </div>

      <KeyboardForm
        preference={(me.preferences?.keymap as KeymapPreference | undefined) ?? null}
      />
    </div>
  );
}
