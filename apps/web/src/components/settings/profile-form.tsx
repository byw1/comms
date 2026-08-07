'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { initials } from '@/lib/utils';
import { updateProfile } from '@/server/actions/profile';

export function ProfileForm({
  name: initialName,
  image: initialImage,
  email,
}: {
  name: string;
  image: string;
  email: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [image, setImage] = useState(initialImage);
  const [pending, start] = useTransition();

  const dirty = name !== initialName || image !== initialImage;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await updateProfile({ name, image });
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          toast.success('Profile saved');
          router.refresh();
        });
      }}
    >
      <div className="flex items-center gap-4">
        <Avatar className="h-14 w-14 ring-1 ring-border">
          {image && <AvatarImage src={image} alt="" />}
          <AvatarFallback className="bg-brand-muted text-sm font-semibold text-brand">
            {initials(name || email)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-2">
          <Label htmlFor="avatar">Avatar URL</Label>
          <Input
            id="avatar"
            type="url"
            inputMode="url"
            value={image}
            onChange={(e) => setImage(e.target.value)}
            placeholder="https://example.com/you.jpg"
          />
          <p className="text-xs text-muted-foreground">Leave blank to use your initials instead.</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="displayName">Display name</Label>
        <Input
          id="displayName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          placeholder="Your name"
          required
        />
        <p className="text-xs text-muted-foreground">
          Teammates use this to @mention you in internal notes.
        </p>
      </div>

      <Button type="submit" disabled={pending || !dirty}>
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save profile
      </Button>
    </form>
  );
}
