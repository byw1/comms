import { listAutomationRules, listAgents, listTags } from '@/server/queries';
import { AutomationManager } from '@/components/settings/automation-manager';

export const dynamic = 'force-dynamic';

export default async function AutomationsSettingsPage() {
  const [rules, agents, tags] = await Promise.all([
    listAutomationRules(),
    listAgents(),
    listTags(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Automations</h2>
        <p className="text-sm text-muted-foreground">
          Automatically triage, route, and tag conversations when they arrive.
        </p>
      </div>
      <AutomationManager
        rules={rules.map((r) => ({
          id: r.id,
          name: r.name,
          enabled: r.enabled,
          trigger: r.trigger,
          conditions: r.conditions,
          actions: r.actions,
        }))}
        agents={agents.map((a) => ({ id: a.id, name: a.name, email: a.email }))}
        allTags={tags.map((t) => ({ id: t.id, name: t.name, color: t.color }))}
      />
    </div>
  );
}
