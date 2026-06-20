import { redirect } from 'next/navigation';
import { loadConfig } from '@comms/core';
import { isSetupCompleted } from '@/server/settings';
import { getCurrentUser } from '@/lib/session';
import { Logo } from '@/components/brand';
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
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md animate-slide-up">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo size="lg" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Sign in to Comms</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Welcome back. Sign in to your shared inbox.
            </p>
          </div>
        </div>
        <LoginForm providers={providers} />
      </div>
    </main>
  );
}
