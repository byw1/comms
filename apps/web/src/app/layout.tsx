import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';
import { Toaster } from '@/components/ui/sonner';

export const metadata: Metadata = {
  title: 'Comms',
  description: 'A shared team inbox and ticketing platform for iMessage and beyond.',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans text-foreground">
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}
