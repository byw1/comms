'use client';

import { useState, useTransition } from 'react';
import { signIn } from 'next-auth/react';
import { toast } from 'sonner';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

export function LoginForm({
  providers,
}: {
  providers: { magicLink: boolean; google: boolean; github: boolean };
}) {
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<'password' | 'magic' | 'oauth' | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const hasOAuth = providers.google || providers.github;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMode('password');
    startTransition(async () => {
      const res = await signIn('credentials', { email, password, redirect: false });
      if (res?.error) {
        toast.error('Invalid email or password.');
        setMode(null);
        return;
      }
      window.location.href = '/inbox';
    });
  }

  function magicLink() {
    if (!email) {
      toast.error('Enter your email first.');
      return;
    }
    setMode('magic');
    startTransition(async () => {
      await signIn('nodemailer', { email, redirect: false });
      toast.success('Check your email for a sign-in link.');
      setMode(null);
    });
  }

  return (
    <Card className="shadow-lg">
      <CardContent className="space-y-4 pt-5">
        <form onSubmit={onSubmit} className="space-y-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-[12.5px]">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-[12.5px]">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <Button
            type="submit"
            variant="brand"
            className="w-full"
            loading={pending && mode === 'password'}
            disabled={pending}
          >
            Sign in
          </Button>
        </form>

        {providers.magicLink && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={magicLink}
            loading={pending && mode === 'magic'}
            disabled={pending}
          >
            <Mail className="h-4 w-4" />
            Email me a sign-in link
          </Button>
        )}

        {hasOAuth && (
          <>
            <div className="relative py-1">
              <div className="divider-fade h-px" />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                or
              </span>
            </div>
            <div className="grid gap-2">
              {providers.google && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => signIn('google', { redirectTo: '/inbox' })}
                >
                  Continue with Google
                </Button>
              )}
              {providers.github && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => signIn('github', { redirectTo: '/inbox' })}
                >
                  Continue with GitHub
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
