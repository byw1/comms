/**
 * The keyboard map: one registry that owns every global shortcut.
 *
 * Three things depend on this file staying the single source of truth — the
 * handlers that fire actions, the `?` cheat sheet, and the settings editor. If
 * a binding lives anywhere else, the cheat sheet lies to people.
 *
 * A BINDING is a space-separated sequence of chords: `'j'`, `'mod+k'`, or
 * `'g i'` (press g, then i — Gmail's navigation idiom). Each action can hold
 * several alternatives, e.g. `['j', 'arrowdown']`.
 *
 * A CHORD is `[mod+][ctrl+][alt+][shift+]key`, always in that order and always
 * lowercase, so string equality is a valid comparison. `mod` is ⌘ on macOS and
 * Ctrl everywhere else, which is what lets one preset serve both.
 */

export type KeyActionId =
  | 'nav.next'
  | 'nav.prev'
  | 'nav.back'
  | 'conversation.close'
  | 'conversation.snooze'
  | 'conversation.reply'
  | 'conversation.tag'
  | 'compose.new'
  | 'app.search'
  | 'app.find'
  | 'app.help'
  | 'go.inbox'
  | 'go.mine'
  | 'go.unassigned'
  | 'go.closed';

export type KeyActionGroup = 'Navigation' | 'Triage' | 'Jump to' | 'Application';

export interface KeyActionMeta {
  id: KeyActionId;
  label: string;
  group: KeyActionGroup;
  /** Shown under the label in settings when the action needs explaining. */
  hint?: string;
}

/** Display order is the order of this array — both in settings and in `?`. */
export const KEY_ACTIONS: readonly KeyActionMeta[] = [
  { id: 'nav.next', label: 'Next conversation', group: 'Navigation' },
  { id: 'nav.prev', label: 'Previous conversation', group: 'Navigation' },
  { id: 'nav.back', label: 'Back to the list', group: 'Navigation' },

  {
    id: 'conversation.close',
    label: 'Close and advance',
    group: 'Triage',
    hint: 'Closes the conversation and opens the next one',
  },
  { id: 'conversation.snooze', label: 'Snooze…', group: 'Triage' },
  { id: 'conversation.tag', label: 'Tag…', group: 'Triage' },
  { id: 'conversation.reply', label: 'Reply', group: 'Triage', hint: 'Focuses the composer' },

  { id: 'go.inbox', label: 'All conversations', group: 'Jump to' },
  { id: 'go.mine', label: 'Assigned to me', group: 'Jump to' },
  { id: 'go.unassigned', label: 'Unassigned', group: 'Jump to' },
  { id: 'go.closed', label: 'Closed', group: 'Jump to' },

  { id: 'compose.new', label: 'New conversation', group: 'Application' },
  { id: 'app.search', label: 'Search / command palette', group: 'Application' },
  {
    id: 'app.find',
    label: 'Find in conversation',
    group: 'Application',
    hint: 'Searches the open thread rather than the page',
  },
  { id: 'app.help', label: 'Keyboard shortcuts', group: 'Application' },
] as const;

export type Keymap = Record<KeyActionId, string[]>;

export type PresetId = 'comms' | 'superhuman' | 'gmail';

export interface KeymapPreference {
  preset?: PresetId;
  /** Per-action overrides layered on top of the preset. */
  overrides?: Partial<Record<KeyActionId, string[]>>;
  /** Enter sends the message; when false, Enter is a newline and ⌘↵ sends. */
  enterSends?: boolean;
}

/**
 * Presets are MODELLED ON those apps, not copied from them — they cover the
 * bindings people actually have in muscle memory, and anything unique to Comms
 * keeps the Comms binding. Every one of them is editable.
 */
export const PRESETS: Record<
  PresetId,
  { label: string; description: string; keymap: Keymap }
> = {
  comms: {
    label: 'Comms',
    description: 'Built for texting: one key per action, no sequences to learn.',
    keymap: {
      'nav.next': ['j', 'arrowdown'],
      'nav.prev': ['k', 'arrowup'],
      'nav.back': ['u', 'escape'],
      'conversation.close': ['e'],
      'conversation.snooze': ['s'],
      'conversation.tag': ['t'],
      'conversation.reply': ['r'],
      'go.inbox': ['g i'],
      'go.mine': ['g m'],
      'go.unassigned': ['g u'],
      'go.closed': ['g c'],
      'compose.new': ['c'],
      'app.search': ['mod+k'],
      'app.find': ['mod+f'],
      'app.help': ['?'],
    },
  },
  superhuman: {
    label: 'Superhuman-style',
    description: 'e to mark done, h to snooze, ⌘K for everything else.',
    keymap: {
      'nav.next': ['j', 'arrowdown'],
      'nav.prev': ['k', 'arrowup'],
      'nav.back': ['u', 'escape'],
      'conversation.close': ['e'],
      // Superhuman puts "remind me" on h and keeps s for starring.
      'conversation.snooze': ['h'],
      'conversation.tag': ['l'],
      'conversation.reply': ['r'],
      'go.inbox': ['g i'],
      'go.mine': ['g m'],
      'go.unassigned': ['g u'],
      'go.closed': ['g e'],
      'compose.new': ['c'],
      'app.search': ['mod+k'],
      'app.find': ['mod+f'],
      'app.help': ['?'],
    },
  },
  gmail: {
    label: 'Gmail-style',
    description: 'e archives, b snoozes, l labels, / searches, g-then-key jumps.',
    keymap: {
      'nav.next': ['j', 'arrowdown'],
      'nav.prev': ['k', 'arrowup'],
      'nav.back': ['u', 'escape'],
      'conversation.close': ['e'],
      'conversation.snooze': ['b'],
      'conversation.tag': ['l'],
      'conversation.reply': ['r'],
      'go.inbox': ['g i'],
      'go.mine': ['g m'],
      'go.unassigned': ['g u'],
      'go.closed': ['g a'],
      'compose.new': ['c'],
      // Gmail searches with `/`. ⌘K stays bound too — it is too universal to
      // take away, and anyone who wants it gone can unbind it here.
      'app.search': ['/', 'mod+k'],
      'app.find': ['mod+f'],
      'app.help': ['?'],
    },
  },
};

export const DEFAULT_PRESET: PresetId = 'comms';
export const DEFAULT_ENTER_SENDS = true;

/** The user's effective bindings: preset, with their overrides layered on. */
export function resolveKeymap(pref?: KeymapPreference | null): Keymap {
  const base = PRESETS[pref?.preset ?? DEFAULT_PRESET]?.keymap ?? PRESETS[DEFAULT_PRESET].keymap;
  const resolved = { ...base } as Keymap;
  for (const [id, bindings] of Object.entries(pref?.overrides ?? {})) {
    if (!(id in resolved)) continue; // action removed in a later version
    // An empty array is meaningful: the user unbound this action on purpose.
    if (Array.isArray(bindings)) resolved[id as KeyActionId] = bindings;
  }
  return resolved;
}

export function resolveEnterSends(pref?: KeymapPreference | null): boolean {
  return pref?.enterSends ?? DEFAULT_ENTER_SENDS;
}

const MODIFIER_KEYS = new Set(['Shift', 'Meta', 'Control', 'Alt', 'CapsLock']);

export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent);
}

/**
 * Canonical chord for a keyboard event, or null if the event is only a
 * modifier being held.
 *
 * Shift is recorded only for named keys. For a printable character the shifted
 * form IS the identity — `?` is already `?`, and writing it `shift+/` would
 * mean two spellings of one key and a binding that never matches.
 */
export function chordFromEvent(
  e: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>,
  isMac = isMacPlatform(),
): string | null {
  if (MODIFIER_KEYS.has(e.key)) return null;

  const parts: string[] = [];
  if (isMac ? e.metaKey : e.ctrlKey) parts.push('mod');
  if (isMac ? e.ctrlKey : e.metaKey) parts.push('ctrl');
  if (e.altKey) parts.push('alt');

  const printable = e.key.length === 1 && e.key !== ' ';
  if (e.shiftKey && !printable) parts.push('shift');

  const key = e.key === ' ' ? 'space' : e.key.toLowerCase();
  parts.push(key);
  return parts.join('+');
}

const CHORD_SYMBOLS: Record<string, string> = {
  arrowdown: '↓',
  arrowup: '↑',
  arrowleft: '←',
  arrowright: '→',
  enter: '↵',
  escape: 'Esc',
  backspace: '⌫',
  delete: 'Del',
  tab: '⇥',
  space: 'Space',
  shift: '⇧',
  alt: '⌥',
  ctrl: '⌃',
};

/** One chord split into the pieces a row of `<kbd>` elements should render. */
export function formatChord(chord: string, isMac = isMacPlatform()): string[] {
  return chord.split('+').map((part) => {
    if (part === 'mod') return isMac ? '⌘' : 'Ctrl';
    if (part === 'alt') return isMac ? '⌥' : 'Alt';
    return CHORD_SYMBOLS[part] ?? (part.length === 1 ? part.toUpperCase() : part);
  });
}

/** A whole binding as display tokens, with sequences separated by `then`. */
export function formatBinding(binding: string, isMac = isMacPlatform()): string[][] {
  return binding
    .split(' ')
    .filter(Boolean)
    .map((chord) => formatChord(chord, isMac));
}

export function parseBinding(binding: string): string[] {
  return binding.split(' ').filter(Boolean);
}

/**
 * How a pressed sequence relates to the map.
 *
 * `pending` matters as much as `exact`: after `g` we must swallow the keypress
 * and wait, or `g` would fall through to whatever else is listening.
 */
export type MatchResult =
  | { kind: 'exact'; action: KeyActionId }
  | { kind: 'pending' }
  | { kind: 'none' };

export function matchSequence(keymap: Keymap, buffer: string[]): MatchResult {
  if (buffer.length === 0) return { kind: 'none' };
  const typed = buffer.join(' ');

  for (const action of KEY_ACTIONS) {
    for (const binding of keymap[action.id] ?? []) {
      if (binding === typed) return { kind: 'exact', action: action.id };
    }
  }

  for (const action of KEY_ACTIONS) {
    for (const binding of keymap[action.id] ?? []) {
      if (binding.startsWith(`${typed} `)) return { kind: 'pending' };
    }
  }

  return { kind: 'none' };
}

export interface BindingConflict {
  binding: string;
  actions: KeyActionId[];
}

/**
 * Bindings claimed by more than one action, including prefix collisions — `g`
 * and `g i` cannot both work, because the first would fire before the second
 * could be completed.
 */
export function findConflicts(keymap: Keymap): BindingConflict[] {
  const owners = new Map<string, KeyActionId[]>();
  for (const action of KEY_ACTIONS) {
    for (const binding of keymap[action.id] ?? []) {
      owners.set(binding, [...(owners.get(binding) ?? []), action.id]);
    }
  }

  const conflicts: BindingConflict[] = [];
  for (const [binding, actions] of owners) {
    if (actions.length > 1) {
      conflicts.push({ binding, actions });
      continue;
    }
    // A binding that is a strict prefix of another shadows it.
    for (const [other, otherActions] of owners) {
      if (other !== binding && other.startsWith(`${binding} `)) {
        conflicts.push({ binding, actions: [...actions, ...otherActions] });
        break;
      }
    }
  }
  return conflicts;
}

/** Which preset a keymap corresponds to, or null once it has been edited. */
export function detectPreset(keymap: Keymap): PresetId | null {
  for (const [id, preset] of Object.entries(PRESETS)) {
    const same = KEY_ACTIONS.every(
      (a) => (keymap[a.id] ?? []).join('|') === (preset.keymap[a.id] ?? []).join('|'),
    );
    if (same) return id as PresetId;
  }
  return null;
}

/** Only the actions that differ from the preset, so upgrades keep working. */
export function diffFromPreset(preset: PresetId, keymap: Keymap): KeymapPreference['overrides'] {
  const base = PRESETS[preset].keymap;
  const overrides: KeymapPreference['overrides'] = {};
  for (const action of KEY_ACTIONS) {
    const mine = keymap[action.id] ?? [];
    if (mine.join('|') !== (base[action.id] ?? []).join('|')) overrides[action.id] = mine;
  }
  return overrides;
}
