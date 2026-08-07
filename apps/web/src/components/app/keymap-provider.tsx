'use client';

import { createContext, useContext, useMemo } from 'react';
import {
  type Keymap,
  type KeymapPreference,
  resolveEnterSends,
  resolveKeymap,
} from '@/lib/keymap';

interface KeymapContextValue {
  keymap: Keymap;
  /** Enter sends the message; when false, Enter is a newline and ⌘↵ sends. */
  enterSends: boolean;
}

const KeymapContext = createContext<KeymapContextValue | null>(null);

/**
 * Makes the signed-in user's bindings available to every shortcut handler and
 * to the cheat sheet, so the two can never disagree.
 */
export function KeymapProvider({
  preference,
  children,
}: {
  preference: KeymapPreference | null | undefined;
  children: React.ReactNode;
}) {
  const value = useMemo(
    () => ({ keymap: resolveKeymap(preference), enterSends: resolveEnterSends(preference) }),
    [preference],
  );
  return <KeymapContext.Provider value={value}>{children}</KeymapContext.Provider>;
}

/** Falls back to the defaults so a component can render outside the provider. */
export function useKeymap(): KeymapContextValue {
  return (
    useContext(KeymapContext) ?? { keymap: resolveKeymap(null), enterSends: resolveEnterSends(null) }
  );
}
