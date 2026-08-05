'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const ITEMS = [
  { href: '/settings', label: 'General' },
  { href: '/settings/inboxes', label: 'Inboxes & Channels' },
  { href: '/settings/team', label: 'Team' },
  { href: '/settings/tags', label: 'Tags' },
  { href: '/settings/macros', label: 'Macros' },
  { href: '/settings/automations', label: 'Automations' },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto border-b [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors',
              active
                ? 'border-foreground font-medium text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
