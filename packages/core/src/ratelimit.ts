import { getRedis } from './redis.js';

/**
 * Global per-connection send pacing. Atomically computes how long the caller must
 * wait before its send slot, enforcing a minimum interval between sends to one
 * BlueBubbles number across all workers — this keeps us under Apple's iMessage
 * throttling even when multiple agents reply to different chats at once.
 *
 * Returns the number of milliseconds to wait (0 if a slot is immediately free).
 */
const SLOT_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local interval = tonumber(ARGV[2])
local last = tonumber(redis.call('get', key) or '0')
local slot = now
if last + interval > now then slot = last + interval end
redis.call('set', key, slot, 'PX', 120000)
return slot - now
`;

export async function reserveSendSlot(
  connectionId: string,
  minIntervalMs: number,
): Promise<number> {
  if (minIntervalMs <= 0) return 0;
  const redis = getRedis();
  const wait = (await redis.eval(
    SLOT_LUA,
    1,
    `comms:sendslot:${connectionId}`,
    Date.now().toString(),
    String(minIntervalMs),
  )) as number;
  return Math.max(0, Number(wait));
}

/** Reserve a send slot and sleep until it's available. */
export async function awaitSendSlot(connectionId: string, minIntervalMs: number): Promise<void> {
  const wait = await reserveSendSlot(connectionId, minIntervalMs);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}
