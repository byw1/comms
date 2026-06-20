import { getRedis } from '@comms/core';

/**
 * Simple Redis mutex used to serialize outbound sends per conversation, so two
 * agents replying to the same iMessage thread don't interleave and trip Apple's
 * spam throttling. Acquire → run → release.
 */
export async function withChatLock<T>(
  conversationId: string,
  fn: () => Promise<T>,
  opts: { ttlMs?: number; waitMs?: number; retryMs?: number } = {},
): Promise<T> {
  const redis = getRedis();
  const key = `comms:lock:chat:${conversationId}`;
  const token = `${process.pid}-${Date.now()}-${Math.random()}`;
  const ttl = opts.ttlMs ?? 30_000;
  const deadline = Date.now() + (opts.waitMs ?? 25_000);

  // Spin until acquired or we give up (then BullMQ retry/backoff handles it).
  for (;;) {
    const ok = await redis.set(key, token, 'PX', ttl, 'NX');
    if (ok) break;
    if (Date.now() > deadline) throw new Error(`Timed out acquiring chat lock for ${conversationId}`);
    await new Promise((r) => setTimeout(r, opts.retryMs ?? 250));
  }

  try {
    return await fn();
  } finally {
    // Release only if we still own the lock.
    const lua = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end`;
    await redis.eval(lua, 1, key, token).catch(() => {});
  }
}
