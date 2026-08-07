import { describe, it, expect } from 'vitest';
import {
  FOLDERS,
  INBOX_STATUSES,
  folderLabel,
  isFolderKey,
  matchesFolder,
  type ConversationStatus,
} from '../src/lib/conversation-folder';

const ALL_STATUSES: ConversationStatus[] = ['open', 'pending', 'snoozed', 'closed'];

describe('matchesFolder — the inbox', () => {
  it('holds open and pending', () => {
    expect(matchesFolder('open', 'active')).toBe(true);
    expect(matchesFolder('pending', 'active')).toBe(true);
  });

  it('does NOT hold snoozed — the bug this fixes', () => {
    // A snooze that leaves the thread in the list is just a label. It has to
    // actually leave, or the inbox stops meaning "things to deal with".
    expect(matchesFolder('snoozed', 'active')).toBe(false);
  });

  it('does not hold closed', () => {
    expect(matchesFolder('closed', 'active')).toBe(false);
  });
});

describe('matchesFolder — the other folders', () => {
  it('gives snoozed and closed their own folders', () => {
    expect(matchesFolder('snoozed', 'snoozed')).toBe(true);
    expect(matchesFolder('closed', 'closed')).toBe(true);
    expect(matchesFolder('open', 'snoozed')).toBe(false);
    expect(matchesFolder('snoozed', 'closed')).toBe(false);
  });

  it('everything means everything', () => {
    for (const status of ALL_STATUSES) {
      expect(matchesFolder(status, 'all')).toBe(true);
    }
  });

  it('narrows to a single status when asked for one', () => {
    expect(matchesFolder('open', 'open')).toBe(true);
    expect(matchesFolder('pending', 'open')).toBe(false);
  });
});

describe('folder partitioning', () => {
  it('puts every status in exactly one of inbox, snoozed and closed', () => {
    for (const status of ALL_STATUSES) {
      const homes = (['active', 'snoozed', 'closed'] as const).filter((f) =>
        matchesFolder(status, f),
      );
      expect(homes, `${status} should have exactly one home`).toHaveLength(1);
    }
  });

  it('leaves nothing stranded outside every folder', () => {
    for (const status of ALL_STATUSES) {
      const anywhere = FOLDERS.some((f) => f !== 'all' && matchesFolder(status, f));
      expect(anywhere, `${status} is not reachable from any folder`).toBe(true);
    }
  });

  it('agrees with the status list the server query uses', () => {
    for (const status of ALL_STATUSES) {
      expect(matchesFolder(status, 'active')).toBe(
        (INBOX_STATUSES as string[]).includes(status),
      );
    }
  });
});

describe('folder keys and labels', () => {
  it('recognises real folder keys and rejects junk', () => {
    expect(isFolderKey('snoozed')).toBe(true);
    expect(isFolderKey('nonsense')).toBe(false);
    expect(isFolderKey(null)).toBe(false);
    expect(isFolderKey(undefined)).toBe(false);
  });

  it('calls the default folder Inbox, not Active', () => {
    expect(folderLabel('active')).toBe('Inbox');
  });

  it('labels every folder', () => {
    for (const f of FOLDERS) expect(folderLabel(f)).toBeTruthy();
  });

  it('passes unknown keys through rather than rendering blank', () => {
    expect(folderLabel('mystery')).toBe('mystery');
  });
});
