import { redirect } from 'next/navigation';

/**
 * `/settings` is the link everyone has in the sidebar and the command palette,
 * and most people who follow it are going to their own account — workspace
 * settings live one tab over, and agents cannot see them at all.
 */
export default function SettingsIndexPage() {
  redirect('/settings/profile');
}
