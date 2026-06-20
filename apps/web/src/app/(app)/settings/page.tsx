import { getOrgSettings } from '@/server/settings';
import { getCurrentUser } from '@/lib/session';
import { GeneralForm } from '@/components/settings/general-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

export default async function GeneralSettingsPage() {
  const org = await getOrgSettings();
  const user = await getCurrentUser();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workspace</CardTitle>
        </CardHeader>
        <CardContent>
          <GeneralForm orgName={org.orgName ?? 'Comms'} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            <span className="text-muted-foreground">Name:</span> {user?.name ?? '—'}
          </p>
          <p>
            <span className="text-muted-foreground">Email:</span> {user?.email}
          </p>
          <p>
            <span className="text-muted-foreground">Role:</span>{' '}
            <span className="capitalize">{user?.role}</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
