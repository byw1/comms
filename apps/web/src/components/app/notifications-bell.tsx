'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRealtime, useCurrentUser } from '@/components/app/realtime-provider';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from '@/server/actions/notifications';
import { relativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';

export function NotificationsBell() {
  const me = useCurrentUser();
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [, start] = useTransition();

  const load = useCallback(async () => {
    const res = await listNotifications();
    setItems(res.items);
    setUnread(res.unread);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtime((e) => {
    if (e.type === 'notification' && me && e.userId === me.id) void load();
  });

  function open(item: NotificationItem) {
    start(async () => {
      if (!item.read) await markNotificationRead(item.id);
      if (item.conversationId) router.push(`/inbox/${item.conversationId}`);
      void load();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="relative rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          {unread > 0 && (
            <button
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => start(async () => {
                await markAllNotificationsRead();
                void load();
              })}
            >
              Mark all read
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <div className="px-2 py-6 text-center text-sm text-muted-foreground">
            You&apos;re all caught up.
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {items.map((item) => (
              <DropdownMenuItem
                key={item.id}
                onClick={() => open(item)}
                className={cn('flex flex-col items-start gap-0.5', !item.read && 'bg-accent/40')}
              >
                <span className="text-sm">{item.body}</span>
                <span className="text-xs text-muted-foreground">
                  {relativeTime(item.createdAt)}
                </span>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
