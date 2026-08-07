'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import type { UserPreferences } from '@comms/db';
import { Switch } from '@/components/ui/switch';
import { playNotificationTone } from '@/lib/notification-sound';
import { updateNotificationPreferences } from '@/server/actions/profile';

function Row({
  id,
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <label htmlFor={id} className="text-sm font-medium">
          {title}
        </label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}

export function NotificationPreferences({
  notifyMentions,
  notificationSound,
}: {
  notifyMentions: boolean;
  notificationSound: boolean;
}) {
  const [mentions, setMentions] = useState(notifyMentions);
  const [sound, setSound] = useState(notificationSound);
  const [pending, start] = useTransition();

  function save(patch: UserPreferences, revert: () => void) {
    start(async () => {
      const res = await updateNotificationPreferences(patch);
      if (!res.ok) {
        revert();
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <Row
        id="notify-mentions"
        title="Mentions"
        description="Notify me when a teammate @mentions me in an internal note."
        checked={mentions}
        disabled={pending}
        onChange={(v) => {
          setMentions(v);
          save({ notifyMentions: v }, () => setMentions(!v));
        }}
      />
      <div className="border-t pt-4">
        <Row
          id="notification-sound"
          title="Notification sound"
          description="Play a short tone when a notification arrives while Comms is open."
          checked={sound}
          disabled={pending}
          onChange={(v) => {
            setSound(v);
            // Play it on the way in so the choice is audible, not theoretical.
            if (v) playNotificationTone();
            save({ notificationSound: v }, () => setSound(!v));
          }}
        />
      </div>
    </div>
  );
}
