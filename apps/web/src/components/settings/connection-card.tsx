'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, RefreshCw, Webhook, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { testConnection, reRegisterWebhook, disconnect } from '@/server/actions/connections';
import { cn } from '@/lib/utils';

export function ConnectionCard({
  connection,
}: {
  connection: {
    id: string;
    serverUrl: string;
    status: string;
    privateApi: boolean;
    serverVersion?: string;
    lastError?: string | null;
    webhookRegistered: boolean;
  };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const connected = connection.status === 'connected';

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {connected ? (
              <CheckCircle2 className="h-4 w-4 text-success" />
            ) : (
              <XCircle className="h-4 w-4 text-destructive" />
            )}
            <span className="truncate text-sm font-medium">{connection.serverUrl}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className={cn('capitalize', connected && 'text-success')}>
              {connection.status}
            </Badge>
            <Badge variant={connection.privateApi ? 'default' : 'secondary'}>
              {connection.privateApi ? 'Private API' : 'Basic mode'}
            </Badge>
            {connection.serverVersion && (
              <Badge variant="outline">v{connection.serverVersion}</Badge>
            )}
            <Badge variant={connection.webhookRegistered ? 'outline' : 'destructive'}>
              {connection.webhookRegistered ? 'Webhook active' : 'Webhook missing'}
            </Badge>
          </div>
          {connection.lastError && (
            <p className="mt-2 text-xs text-destructive">{connection.lastError}</p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await testConnection(connection.id);
              if (res.ok) toast.success('Connection healthy');
              else toast.error(res.error ?? 'Connection failed');
              router.refresh();
            })
          }
        >
          {pending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          )}
          Test
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await reRegisterWebhook(connection.id);
              if (res.ok) toast.success('Webhook re-registered');
              else toast.error(res.error ?? 'Failed');
              router.refresh();
            })
          }
        >
          <Webhook className="mr-1.5 h-3.5 w-3.5" />
          Re-register webhook
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await disconnect(connection.id);
              toast.success('Disconnected');
              router.refresh();
            })
          }
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Disconnect
        </Button>
      </div>
    </div>
  );
}
