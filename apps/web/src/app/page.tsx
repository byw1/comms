import { redirect } from 'next/navigation';
import { isSetupCompleted } from '@/server/settings';
import { getCurrentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function RootPage() {
  if (!(await isSetupCompleted())) redirect('/setup');
  const user = await getCurrentUser();
  redirect(user ? '/inbox' : '/login');
}
