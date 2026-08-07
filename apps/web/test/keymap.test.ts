import { describe, it, expect } from 'vitest';
import {
  KEY_ACTIONS,
  PRESETS,
  chordFromEvent,
  detectPreset,
  diffFromPreset,
  findConflicts,
  formatBinding,
  formatChord,
  matchSequence,
  resolveEnterSends,
  resolveKeymap,
  type Keymap,
  type PresetId,
} from '../src/lib/keymap';

/** A KeyboardEvent-shaped literal, since jsdom isn't loaded for this suite. */
const ev = (
  key: string,
  mods: { meta?: boolean; ctrl?: boolean; alt?: boolean; shift?: boolean } = {},
) => ({
  key,
  metaKey: Boolean(mods.meta),
  ctrlKey: Boolean(mods.ctrl),
  altKey: Boolean(mods.alt),
  shiftKey: Boolean(mods.shift),
});

describe('chordFromEvent', () => {
  it('normalizes plain keys to lowercase', () => {
    expect(chordFromEvent(ev('J'), true)).toBe('j');
    expect(chordFromEvent(ev('ArrowDown'), true)).toBe('arrowdown');
  });

  it('maps mod to Cmd on mac and Ctrl elsewhere', () => {
    expect(chordFromEvent(ev('k', { meta: true }), true)).toBe('mod+k');
    expect(chordFromEvent(ev('k', { ctrl: true }), false)).toBe('mod+k');
  });

  it('keeps the two ctrl keys distinct on mac', () => {
    // Ctrl on a Mac is a real, separate modifier — not an alias for Cmd.
    expect(chordFromEvent(ev('k', { ctrl: true }), true)).toBe('ctrl+k');
  });

  it('does not record shift for printable characters', () => {
    // `?` is already the shifted form; spelling it `shift+/` would give one key
    // two spellings and a binding that never matches.
    expect(chordFromEvent(ev('?', { shift: true }), true)).toBe('?');
  });

  it('does record shift for named keys', () => {
    expect(chordFromEvent(ev('Tab', { shift: true }), true)).toBe('shift+tab');
  });

  it('ignores a modifier pressed on its own', () => {
    expect(chordFromEvent(ev('Shift', { shift: true }), true)).toBeNull();
    expect(chordFromEvent(ev('Meta', { meta: true }), true)).toBeNull();
  });

  it('names the space bar', () => {
    expect(chordFromEvent(ev(' '), true)).toBe('space');
  });

  it('orders modifiers consistently so equality works', () => {
    expect(chordFromEvent(ev('k', { meta: true, alt: true }), true)).toBe('mod+alt+k');
  });
});

describe('matchSequence', () => {
  const keymap = resolveKeymap(null);

  it('matches a single chord', () => {
    expect(matchSequence(keymap, ['j'])).toEqual({ kind: 'exact', action: 'nav.next' });
  });

  it('reports a half-typed sequence as pending, not as a miss', () => {
    // This is what stops `g` leaking through to whatever else is listening.
    expect(matchSequence(keymap, ['g'])).toEqual({ kind: 'pending' });
  });

  it('completes a sequence', () => {
    expect(matchSequence(keymap, ['g', 'i'])).toEqual({ kind: 'exact', action: 'go.inbox' });
  });

  it('reports an unknown sequence as none', () => {
    expect(matchSequence(keymap, ['g', 'z'])).toEqual({ kind: 'none' });
    expect(matchSequence(keymap, ['z'])).toEqual({ kind: 'none' });
  });

  it('matches any of an action’s alternatives', () => {
    expect(matchSequence(keymap, ['arrowdown'])).toEqual({ kind: 'exact', action: 'nav.next' });
  });

  it('returns none for an empty buffer', () => {
    expect(matchSequence(keymap, [])).toEqual({ kind: 'none' });
  });
});

describe('presets', () => {
  const ids = Object.keys(PRESETS) as PresetId[];

  it.each(ids)('%s binds every action', (id) => {
    for (const action of KEY_ACTIONS) {
      expect(PRESETS[id].keymap[action.id], `${id} is missing ${action.id}`).toBeDefined();
    }
  });

  it.each(ids)('%s has no conflicting bindings', (id) => {
    expect(findConflicts(PRESETS[id].keymap)).toEqual([]);
  });

  it('gives Gmail its own snooze and search keys', () => {
    expect(PRESETS.gmail.keymap['conversation.snooze']).toEqual(['b']);
    expect(PRESETS.gmail.keymap['app.search']).toContain('/');
  });

  it('gives Superhuman h for snooze', () => {
    expect(PRESETS.superhuman.keymap['conversation.snooze']).toEqual(['h']);
  });
});

describe('resolveKeymap', () => {
  it('falls back to the default preset with no preference stored', () => {
    expect(resolveKeymap(null)).toEqual(PRESETS.comms.keymap);
    expect(resolveEnterSends(null)).toBe(true);
  });

  it('layers overrides on top of the chosen preset', () => {
    const resolved = resolveKeymap({
      preset: 'gmail',
      overrides: { 'conversation.close': ['y'] },
    });
    expect(resolved['conversation.close']).toEqual(['y']);
    // Untouched actions keep the preset's binding.
    expect(resolved['conversation.snooze']).toEqual(['b']);
  });

  it('treats an empty override as a deliberate unbind', () => {
    expect(resolveKeymap({ overrides: { 'app.help': [] } })['app.help']).toEqual([]);
  });

  it('ignores overrides for actions that no longer exist', () => {
    const resolved = resolveKeymap({
      overrides: { 'removed.action': ['q'] } as never,
    });
    expect(resolved).toEqual(PRESETS.comms.keymap);
  });

  it('falls back when the stored preset is unknown', () => {
    expect(resolveKeymap({ preset: 'nonsense' as PresetId })).toEqual(PRESETS.comms.keymap);
  });
});

describe('findConflicts', () => {
  it('flags two actions sharing a key', () => {
    const keymap: Keymap = { ...PRESETS.comms.keymap, 'conversation.tag': ['e'] };
    const conflicts = findConflicts(keymap);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.actions).toEqual(
      expect.arrayContaining(['conversation.close', 'conversation.tag']),
    );
  });

  it('flags a key that shadows a sequence starting with it', () => {
    // Binding `g` outright means `g i` can never complete.
    const keymap: Keymap = { ...PRESETS.comms.keymap, 'conversation.tag': ['g'] };
    const conflicts = findConflicts(keymap);
    expect(conflicts.some((c) => c.binding === 'g')).toBe(true);
  });

  it('is quiet when nothing collides', () => {
    expect(findConflicts(PRESETS.comms.keymap)).toEqual([]);
  });
});

describe('diffFromPreset', () => {
  it('stores only what the user changed', () => {
    const keymap: Keymap = { ...PRESETS.gmail.keymap, 'conversation.close': ['y'] };
    expect(diffFromPreset('gmail', keymap)).toEqual({ 'conversation.close': ['y'] });
  });

  it('stores nothing for an untouched preset', () => {
    expect(diffFromPreset('comms', PRESETS.comms.keymap)).toEqual({});
  });

  it('round-trips through resolveKeymap', () => {
    const edited: Keymap = { ...PRESETS.superhuman.keymap, 'nav.next': ['n'] };
    const stored = diffFromPreset('superhuman', edited);
    expect(resolveKeymap({ preset: 'superhuman', overrides: stored })).toEqual(edited);
  });
});

describe('detectPreset', () => {
  it('recognises an unedited preset', () => {
    expect(detectPreset(PRESETS.gmail.keymap)).toBe('gmail');
  });

  it('returns null once a key has been changed', () => {
    expect(detectPreset({ ...PRESETS.gmail.keymap, 'nav.next': ['n'] })).toBeNull();
  });
});

describe('display formatting', () => {
  it('shows the platform modifier', () => {
    expect(formatChord('mod+k', true)).toEqual(['⌘', 'K']);
    expect(formatChord('mod+k', false)).toEqual(['Ctrl', 'K']);
  });

  it('symbolises named keys', () => {
    expect(formatChord('arrowdown', true)).toEqual(['↓']);
    expect(formatChord('shift+tab', true)).toEqual(['⇧', '⇥']);
  });

  it('splits a sequence into its chords', () => {
    expect(formatBinding('g i', true)).toEqual([['G'], ['I']]);
  });
});
