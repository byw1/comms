import { listAgents } from '@/server/queries';
import { AddTeammate } from '@/components/settings/add-teammate';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { initials } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function TeamSettingsPage() {
  const agents = await listAgents();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Team</h2>
          <p className="text-sm text-muted-foreground">People with access to this workspace.</p>
        </div>
        <AddTeammate />
      </div>

      <div className="divide-y rounded-lg border">
        {agents.map((a) => (
          <div key={a.id} className="flex items-center gap-3 p-3">
            <Avatar className="h-8 w-8">
              {a.image && <AvatarImage src={a.image} alt={a.name ?? ''} />}
              <AvatarFallback className="text-xs">{initials(a.name ?? a.email)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{a.name ?? a.email}</p>
              <p className="truncate text-xs text-muted-foreground">{a.email}</p>
            </div>
            <Badge variant="secondary" className="capitalize">
              {a.role}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
