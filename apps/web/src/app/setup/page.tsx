import { redirect } from 'next/navigation';
import { isSetupCompleted } from '@/server/settings';
import { Logo } from '@/components/brand';
import { SetupForm } from './setup-form';

export const dynamic = 'force-dynamic';

export default async function SetupPage() {
  if (await isSetupCompleted()) redirect('/login');

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md animate-slide-up">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo size="lg" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Welcome to Comms</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your admin account to finish setting up your workspace.
            </p>
          </div>
        </div>
        <SetupForm />
      </div>
    </main>
  );
}
