import { requireUser } from '@/lib/session';
import { SettingsNav } from '@/components/app/settings-nav';

export const dynamic = 'force-dynamic';

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-6 md:px-6 md:py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your workspace, channels, and team.
        </p>
        <div className="mt-6">
          <SettingsNav />
          <div className="py-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
