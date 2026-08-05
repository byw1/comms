import { redirect } from 'next/navigation';
import { loadConfig } from '@comms/core';
import { isSetupCompleted } from '@/server/settings';
import { getCurrentUser } from '@/lib/session';
import { AuthShell } from '@/components/app/auth-shell';
import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  if (!(await isSetupCompleted())) redirect('/setup');
  if (await getCurrentUser()) redirect('/inbox');

  const cfg = loadConfig();
  const providers = {
    magicLink: cfg.smtpEnabled,
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    github: Boolean(process.env.GITHUB_ID && process.env.GITHUB_SECRET),
  };

  return (
    <AuthShell title="Sign in to Comms" subtitle="Welcome back to your shared inbox.">
      <LoginForm providers={providers} />
    </AuthShell>
  );
}
