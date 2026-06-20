'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { createFirstAdmin } from '@/server/actions/auth';

export function SetupForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ orgName: '', name: '', email: '', password: '' });

  function update(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createFirstAdmin(form);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const signInResult = await signIn('credentials', {
        email: form.email,
        password: form.password,
        redirect: false,
      });
      if (signInResult?.error) {
        toast.success('Account created. Please sign in.');
        router.push('/login');
        return;
      }
      router.push('/inbox');
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="orgName">Workspace name</Label>
            <Input
              id="orgName"
              placeholder="Acme Support"
              value={form.orgName}
              onChange={update('orgName')}
              autoComplete="organization"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Your name</Label>
            <Input
              id="name"
              placeholder="Jane Doe"
              value={form.name}
              onChange={update('name')}
              autoComplete="name"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="jane@acme.com"
              value={form.email}
              onChange={update('email')}
              autoComplete="username"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="At least 8 characters"
              value={form.password}
              onChange={update('password')}
              autoComplete="new-password"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create workspace
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
