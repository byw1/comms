'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { changePassword } from '@/server/actions/profile';

const EMPTY = { current: '', next: '', confirm: '' };

export function PasswordForm() {
  const [form, setForm] = useState(EMPTY);
  const [pending, start] = useTransition();

  const set = (key: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (form.next !== form.confirm) {
          toast.error('The new passwords do not match.');
          return;
        }
        start(async () => {
          const res = await changePassword({
            currentPassword: form.current,
            newPassword: form.next,
          });
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          toast.success('Password updated');
          setForm(EMPTY);
        });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="currentPassword">Current password</Label>
        <Input
          id="currentPassword"
          type="password"
          autoComplete="current-password"
          value={form.current}
          onChange={set('current')}
          required
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="newPassword">New password</Label>
          <Input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={form.next}
            onChange={set('next')}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm new password</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={form.confirm}
            onChange={set('confirm')}
            required
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">At least 8 characters.</p>

      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Change password
      </Button>
    </form>
  );
}
