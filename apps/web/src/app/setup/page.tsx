import { redirect } from 'next/navigation';
import { isSetupCompleted } from '@/server/settings';
import { AuthShell } from '@/components/app/auth-shell';
import { SetupForm } from './setup-form';

export const dynamic = 'force-dynamic';

export default async function SetupPage() {
  if (await isSetupCompleted()) redirect('/login');

  return (
    <AuthShell
      title="Welcome to Comms"
      subtitle="Create your admin account to finish setting up your workspace."
      footer="You'll connect your iMessage number in the next step."
    >
      <SetupForm />
    </AuthShell>
  );
}
