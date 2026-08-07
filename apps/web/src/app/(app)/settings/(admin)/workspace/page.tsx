import { getOrgSettings, getSetting } from '@/server/settings';
import { GeneralForm } from '@/components/settings/general-form';
import { SlaForm } from '@/components/settings/sla-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

export default async function WorkspaceSettingsPage() {
  const org = await getOrgSettings();
  const sla =
    (await getSetting<{ firstResponseMinutes?: number; nextResponseMinutes?: number }>('sla')) ??
    {};

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Workspace</h2>
        <p className="text-sm text-muted-foreground">
          Settings that apply to everyone on this workspace.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Name</CardTitle>
        </CardHeader>
        <CardContent>
          <GeneralForm orgName={org.orgName ?? 'Comms'} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Service-level targets (SLA)</CardTitle>
        </CardHeader>
        <CardContent>
          <SlaForm sla={sla} />
        </CardContent>
      </Card>
    </div>
  );
}
