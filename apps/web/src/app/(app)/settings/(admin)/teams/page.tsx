import { listTeams, listTeamCandidates } from '@/server/actions/teams';
import { TeamManager } from '@/components/settings/team-manager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

export default async function TeamsSettingsPage() {
  const [teams, agents] = await Promise.all([listTeams(), listTeamCandidates()]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Teams</h2>
        <p className="text-sm text-muted-foreground">
          Groups that conversations route to. Assign a client to a team once and every thread they
          start goes there — no per-thread filing.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your teams</CardTitle>
        </CardHeader>
        <CardContent>
          <TeamManager
            teams={teams}
            agents={agents.map((a) => ({
              id: a.id,
              name: a.name,
              email: a.email,
              image: a.image,
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How routing works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5 text-sm text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">By client.</span> Open a conversation and
            assign the contact to a team in the details panel. Their open threads move immediately
            and everything they send later inherits it automatically.
          </p>
          <p>
            <span className="font-medium text-foreground">By topic.</span> An automation rule can
            route a single conversation to a team — for &ldquo;anything mentioning invoice goes to
            Billing&rdquo;, where the team depends on the message rather than the person.
          </p>
          <p>
            <span className="font-medium text-foreground">Then find it.</span> Each team you belong
            to gets a sidebar row with a live count, and any team filter can be saved as a folder.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
