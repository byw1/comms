'use client';

import { useEffect, useRef } from 'react';
import { useKeymap } from '@/components/app/keymap-provider';
import { chordFromEvent, matchSequence, type KeyActionId } from '@/lib/keymap';

/** How long a half-finished sequence like `g` waits for its second key. */
const SEQUENCE_TIMEOUT_MS = 1200;

export type ShortcutHandlers = Partial<Record<KeyActionId, () => void>>;

/**
 * True when keystrokes belong to whatever the user is typing into.
 *
 * Radix portals are included deliberately: an open dialog, menu or palette owns
 * the keyboard, and letting `e` close a conversation underneath an open dialog
 * is how people lose work.
 */
function isTyping(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return (
    document.querySelector(
      '[role="dialog"][data-state="open"], [role="menu"][data-state="open"]',
    ) !== null
  );
}

/**
 * Bind the user's configured shortcuts to actions.
 *
 * Only ONE component should call this — a second listener would double-fire
 * every action and make sequences race each other.
 */
export function useGlobalShortcuts(handlers: ShortcutHandlers) {
  const { keymap } = useKeymap();

  // Held in refs so the listener is installed once and never goes stale.
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const keymapRef = useRef(keymap);
  keymapRef.current = keymap;

  useEffect(() => {
    let buffer: string[] = [];
    let lastKeyAt = 0;

    function onKey(e: KeyboardEvent) {
      const chord = chordFromEvent(e);
      if (!chord) return;

      // A modifier chord (⌘K) is meant to work from anywhere, including a text
      // field. A bare letter is not — it is something the user is typing.
      const hasModifier = chord.includes('mod+') || chord.includes('ctrl+') || chord.includes('alt+');
      if (!hasModifier && isTyping()) {
        buffer = [];
        return;
      }

      const now = Date.now();
      if (now - lastKeyAt > SEQUENCE_TIMEOUT_MS) buffer = [];
      lastKeyAt = now;

      const attempt = [...buffer, chord];
      let result = matchSequence(keymapRef.current, attempt);

      // A sequence that went nowhere shouldn't swallow this key: retry it as
      // the start of a fresh one, so `g` then `j` still moves down the list.
      if (result.kind === 'none' && buffer.length > 0) {
        buffer = [];
        result = matchSequence(keymapRef.current, [chord]);
      }

      if (result.kind === 'pending') {
        buffer = attempt;
        e.preventDefault();
        return;
      }

      if (result.kind === 'exact') {
        buffer = [];
        const handler = handlersRef.current[result.action];
        if (!handler) return;
        e.preventDefault();
        handler();
        return;
      }

      buffer = [];
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
