'use client';

import { toast } from 'sonner';

/**
 * The one undo toast.
 *
 * Every mutating action in the app shows the same shape: what happened, an
 * Undo button, a few seconds of grace. Consistency is the entire feature —
 * once Undo is always there, people stop double-checking before they act,
 * which is where the speed actually comes from.
 *
 * The inverse runs as a normal server action. Nothing is deferred or staged:
 * the action already happened, and Undo is simply the opposite action with
 * the previous values, which the optimistic UI already had in hand.
 */
export function undoToast(
  message: string,
  undo: () => Promise<{ ok: boolean; error?: string }>,
  opts?: {
    description?: string;
    /** Called after a successful undo (refresh routers, restore local state). */
    onUndone?: () => void;
    durationMs?: number;
  },
) {
  toast(message, {
    description: opts?.description,
    duration: opts?.durationMs ?? 6000,
    action: {
      label: 'Undo',
      onClick: () => {
        void (async () => {
          const res = await undo();
          if (res.ok) {
            toast.success('Undone');
            opts?.onUndone?.();
          } else {
            toast.error(res.error ?? 'Could not undo');
          }
        })();
      },
    },
  });
}
