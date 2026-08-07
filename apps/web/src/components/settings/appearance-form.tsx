'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, type Theme } from '@/components/app/theme-provider';
import { cn } from '@/lib/utils';

const THEMES: { value: Theme; label: string; icon: React.ElementType }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export function AppearanceForm() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1 rounded-lg bg-secondary/70 p-0.5">
        {THEMES.map((t) => {
          const Icon = t.icon;
          const active = theme === t.value;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setTheme(t.value)}
              aria-pressed={active}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-[0.4rem] px-3 py-2 text-[13px] font-medium transition-all duration-200 ease-smooth',
                active
                  ? 'bg-surface text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Saved on this device. <span className="font-medium">System</span> follows your operating
        system and switches live.
      </p>
    </div>
  );
}
