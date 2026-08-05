import { Logo } from '@/components/brand';

/**
 * Shared frame for the signed-out pages (login, setup). The backdrop is a faint
 * dot grid plus a brand-tinted radial glow — enough to stop the page reading as
 * a blank white sheet, quiet enough not to compete with the form.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface-sunken p-4">
      {/* Dot grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.55] dark:opacity-30"
        style={{
          backgroundImage: 'radial-gradient(hsl(var(--border-strong)) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
          maskImage: 'radial-gradient(ellipse 70% 55% at 50% 45%, black, transparent)',
          WebkitMaskImage: 'radial-gradient(ellipse 70% 55% at 50% 45%, black, transparent)',
        }}
      />
      {/* Brand glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 -translate-y-1/3 rounded-full opacity-[0.16] blur-[110px]"
        style={{ background: 'hsl(var(--brand))' }}
      />

      <div className="relative w-full max-w-[400px] animate-slide-up">
        <div className="mb-7 flex flex-col items-center gap-3.5 text-center">
          <Logo size="lg" showWordmark={false} />
          <div>
            <h1 className="text-[1.35rem] font-semibold tracking-[-0.02em]">{title}</h1>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        {children}
        {footer && <div className="mt-5 text-center text-xs text-muted-foreground">{footer}</div>}
      </div>
    </main>
  );
}
