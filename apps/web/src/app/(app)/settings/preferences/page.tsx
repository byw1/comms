import { resolvePreferences } from '@comms/db';
import { requireDbUser } from '@/lib/session';
import { AppearanceForm } from '@/components/settings/appearance-form';
import { NotificationPreferences } from '@/components/settings/notification-preferences';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

export default async function PreferencesSettingsPage() {
  const me = await requireDbUser();
  const prefs = resolvePreferences(me.preferences);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Preferences</h2>
        <p className="text-sm text-muted-foreground">
          How Comms looks and when it interrupts you. These apply to your account only.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <AppearanceForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <NotificationPreferences
            notifyMentions={prefs.notifyMentions}
            notificationSound={prefs.notificationSound}
          />
        </CardContent>
      </Card>
    </div>
  );
}
