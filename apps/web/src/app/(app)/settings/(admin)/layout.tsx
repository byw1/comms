import { requireAdminPage } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * Everything under this route group changes the whole workspace, so it is
 * owner/admin only. The group adds no URL segment — `/settings/team` and
 * friends keep the paths they have always had.
 */
export default async function AdminSettingsLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage();
  return <>{children}</>;
}
