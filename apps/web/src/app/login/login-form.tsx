'use client';

import { useState, useTransition } from 'react';
import { signIn } from 'next-auth/react';
import { toast } from 'sonner';
import { Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export function LoginForm({
  providers,
}: {
  providers: { magicLink: boolean; google: boolean; github: boolean };
}) {
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const hasOAuth = providers.google || providers.github;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await signIn('credentials', { email, password, redirect: false });
      if (res?.error) {
        toast.error('Invalid email or password.');
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
    startTransition(async () => {
      await signIn('nodemailer', { email, redirect: false });
      toast.success('Check your email for a sign-in link.');
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
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
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
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
          <Button type="submit" className="w-full" disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sign in
          </Button>
        </form>

        {providers.magicLink && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={magicLink}
            disabled={pending}
          >
            <Mail className="mr-2 h-4 w-4" />
            Email me a sign-in link
          </Button>
        )}

        {hasOAuth && (
          <>
            <div className="relative">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                or continue with
              </span>
            </div>
            <div className="grid gap-2">
              {providers.google && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => signIn('google', { redirectTo: '/inbox' })}
                >
                  Continue with Google
                </Button>
              )}
              {providers.github && (
                <Button
                  type="button"
                  variant="outline"
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
