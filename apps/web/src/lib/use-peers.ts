'use client';

import { useEffect, useState } from 'react';
import { useRealtime, useCurrentUser } from '@/components/app/realtime-provider';

export type Peer = {
  userId: string;
  name: string;
  state: 'viewing' | 'typing';
  expires: number;
};

/** A peer is forgotten this long after its last ping, if "left" never arrived. */
const PEER_TTL_MS = 8000;

/**
 * Other people in this conversation right now.
 *
 * Extracted from the presence bar so the composer can use the same state. Two
 * components deriving "who is typing" from the raw event stream independently
 * would eventually disagree, and the one that disagrees is the one that lets a
 * double reply through.
 */
export function usePeers(conversationId: string): Peer[] {
  const me = useCurrentUser();
  const [peers, setPeers] = useState<Record<string, Peer>>({});

  useRealtime((e) => {
    if (e.type !== 'presence' || e.conversationId !== conversationId) return;
    if (me && e.userId === me.id) return;
    setPeers((prev) => {
      const next = { ...prev };
      if (e.state === 'left') {
        if (e.userId) delete next[e.userId];
      } else if (e.userId) {
        next[e.userId] = {
          userId: e.userId,
          name: e.userName ?? 'Agent',
          state: e.state === 'typing' ? 'typing' : 'viewing',
          expires: Date.now() + PEER_TTL_MS,
        };
      }
      return next;
    });
  });

  // Expire stale peers — a browser that crashes never sends "left".
  useEffect(() => {
    const iv = setInterval(() => {
      setPeers((prev) => {
        const now = Date.now();
        let changed = false;
        const next: Record<string, Peer> = {};
        for (const [k, v] of Object.entries(prev)) {
          if (v.expires >= now) next[k] = v;
          else changed = true;
        }
        return changed ? next : prev;
      });
    }, 3000);
    return () => clearInterval(iv);
  }, []);

  // A conversation change must not carry the previous thread's peers over.
  useEffect(() => setPeers({}), [conversationId]);

  return Object.values(peers);
}

/** Just the people actively writing — what a collision warning cares about. */
export function useTypingPeers(conversationId: string): Peer[] {
  return usePeers(conversationId).filter((p) => p.state === 'typing');
}

export function firstNames(peers: Peer[]): string {
  return peers.map((p) => p.name.split(' ')[0]).join(', ');
}
