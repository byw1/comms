'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Trash2, GitMerge, AlertTriangle, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { deleteInbox, mergeInboxes, renameInbox } from '@/server/actions/inboxes';

/**
 * Manage a single inbox: rename, merge into another, or delete.
 *
 * Merge exists specifically to recover from the duplicate-inbox situation that
 * disconnect+reconnect used to create — it moves the conversations across
 * instead of making you choose between two halves of your history.
 */
export function InboxActions({
  inbox,
  otherInboxes,
}: {
  inbox: {
    id: string;
    name: string;
    conversationCount: number;
    messageCount: number;
    hasConnection: boolean;
  };
  otherInboxes: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [renameOpen, setRenameOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [name, setName] = useState(inbox.name);
  const [target, setTarget] = useState(otherInboxes[0]?.id ?? '');

  const hasHistory = inbox.conversationCount > 0;

  function doRename() {
    start(async () => {
      const res = await renameInbox(inbox.id, name);
      if (res.ok) {
        toast.success('Renamed');
        setRenameOpen(false);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function doMerge() {
    start(async () => {
      const res = await mergeInboxes({ sourceInboxId: inbox.id, targetInboxId: target });
      if (res.ok) {
        toast.success(res.message ?? 'Merged');
        setMergeOpen(false);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function doDelete() {
    start(async () => {
      const res = await deleteInbox(inbox.id, { confirmDeleteMessages: true });
      if (res.ok) {
        toast.success(res.message ?? 'Deleted');
        setDeleteOpen(false);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button size="xs" variant="ghost" onClick={() => setRenameOpen(true)}>
          <Pencil className="h-3.5 w-3.5" />
          Rename
        </Button>
        {otherInboxes.length > 0 && (
          <Button size="xs" variant="ghost" onClick={() => setMergeOpen(true)}>
            <GitMerge className="h-3.5 w-3.5" />
            Merge into…
          </Button>
        )}
        <Button
          size="xs"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete inbox
        </Button>
      </div>

      {/* Rename */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename inbox</DialogTitle>
          </DialogHeader>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button onClick={doRename} loading={pending} disabled={!name.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge */}
      <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Merge &ldquo;{inbox.name}&rdquo; into another inbox</DialogTitle>
            <DialogDescription>
              Every conversation moves across, then this inbox is removed. Nothing is deleted — if
              the same conversation exists on both sides, the messages are combined. This is the
              safe way to clean up a duplicate.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-1">
            <Label className="text-[12.5px]">Move everything into</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an inbox" />
              </SelectTrigger>
              <SelectContent>
                {otherInboxes.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="pt-1 text-[11.5px] text-muted-foreground">
              {inbox.conversationCount} conversation
              {inbox.conversationCount === 1 ? '' : 's'} will move.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMergeOpen(false)}>
              Cancel
            </Button>
            <Button onClick={doMerge} loading={pending} disabled={!target}>
              Merge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete &ldquo;{inbox.name}&rdquo;?</DialogTitle>
            <DialogDescription>
              {hasHistory ? (
                <span className="flex gap-2 rounded-lg border border-destructive/25 bg-destructive-muted p-2.5 text-destructive">
                  <AlertTriangle className="mt-px h-4 w-4 shrink-0" />
                  <span>
                    This permanently deletes {inbox.conversationCount} conversation
                    {inbox.conversationCount === 1 ? '' : 's'} and {inbox.messageCount} message
                    {inbox.messageCount === 1 ? '' : 's'}. This cannot be undone.
                    {otherInboxes.length > 0 && ' Use “Merge into…” instead if you want to keep them.'}
                  </span>
                </span>
              ) : (
                'This inbox is empty, so nothing will be lost.'
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={doDelete} loading={pending}>
              {hasHistory ? 'Delete everything' : 'Delete inbox'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
