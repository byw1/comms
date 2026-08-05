'use client';

import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from '@/components/app/theme-provider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
    </ThemeProvider>
  );
}
