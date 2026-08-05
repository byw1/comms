'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { Logo } from '@/components/brand';
import { NotificationsBell } from '@/components/app/notifications-bell';
import { cn } from '@/lib/utils';

/*
 * Mobile chrome for the app shell. Desktop (md+) is untouched: the sidebar sits
 * inline exactly as before. Below md, the sidebar becomes a slide-in drawer
 * opened from a slim top bar. Pure CSS transforms — no portal, no library.
 */

/** Slim top bar, only on mobile. */
export function MobileTopBar() {
  return (
    <div className="flex h-12 shrink-0 items-center justify-between border-b bg-surface px-2 md:hidden">
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event('comms:toggle-sidebar'))}
        className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:scale-95"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>
      <Logo size="sm" />
      <NotificationsBell />
    </div>
  );
}

/** Wraps the sidebar: inline on md+, left drawer with backdrop below md. */
export function SidebarShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const toggle = () => setOpen((o) => !o);
    window.addEventListener('comms:toggle-sidebar', toggle);
    return () => window.removeEventListener('comms:toggle-sidebar', toggle);
  }, []);

  // Navigating anywhere closes the drawer.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      <div
        aria-hidden
        onClick={() => setOpen(false)}
        className={cn(
          'fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 md:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 transition-transform duration-250 ease-smooth',
          'md:static md:z-auto md:translate-x-0 md:transition-none',
          open ? 'translate-x-0 shadow-xl' : '-translate-x-full',
        )}
      >
        {open && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute -right-11 top-2 z-50 rounded-lg bg-surface p-2 text-muted-foreground shadow-md md:hidden"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {children}
      </div>
    </>
  );
}

/** Wraps the ticket panel: inline on lg+, right slide-over below lg. */
export function DetailsPaneShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const toggle = () => setOpen((o) => !o);
    window.addEventListener('comms:toggle-details', toggle);
    return () => window.removeEventListener('comms:toggle-details', toggle);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      <div
        aria-hidden
        onClick={() => setOpen(false)}
        className={cn(
          'fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />
      <div
        className={cn(
          'fixed inset-y-0 right-0 z-50 transition-transform duration-250 ease-smooth',
          'lg:static lg:z-auto lg:translate-x-0 lg:transition-none',
          open ? 'translate-x-0 shadow-xl' : 'translate-x-full',
        )}
      >
        {children}
      </div>
    </>
  );
}
