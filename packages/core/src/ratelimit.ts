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

// ---- Hard hourly/daily send quotas (per connection = per Apple ID) ----------

export interface QuotaResult {
  allowed: boolean;
  /** When not allowed: how long until the exhausted window rolls over. */
  retryInMs: number;
  scope?: 'hourly' | 'daily';
}

/**
 * Take one send from the connection's hourly + daily quota, atomically.
 * If either cap is exhausted the take is rolled back and the caller gets the
 * time until that window resets — delay the send, never drop it. Fixed UTC
 * windows (calendar hour / day) are deliberate: coarse but predictable, and
 * the Redis keys expire on their own.
 */
const QUOTA_LUA = `
local hkey, dkey = KEYS[1], KEYS[2]
local hcap = tonumber(ARGV[1])
local dcap = tonumber(ARGV[2])
local h = redis.call('incr', hkey)
if h == 1 then redis.call('pexpire', hkey, 3900000) end
local d = redis.call('incr', dkey)
if d == 1 then redis.call('pexpire', dkey, 90000000) end
if hcap > 0 and h > hcap then
  redis.call('decr', hkey)
  redis.call('decr', dkey)
  return 'hourly'
end
if dcap > 0 and d > dcap then
  redis.call('decr', hkey)
  redis.call('decr', dkey)
  return 'daily'
end
return 'ok'
`;

export async function takeSendQuota(
  connectionId: string,
  hourlyCap: number,
  dailyCap: number,
): Promise<QuotaResult> {
  if (hourlyCap <= 0 && dailyCap <= 0) return { allowed: true, retryInMs: 0 };
  const redis = getRedis();
  const now = new Date();
  const hourBucket = `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}-${now.getUTCHours()}`;
  const dayBucket = `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}`;

  const verdict = (await redis.eval(
    QUOTA_LUA,
    2,
    `comms:quota:h:${connectionId}:${hourBucket}`,
    `comms:quota:d:${connectionId}:${dayBucket}`,
    String(hourlyCap),
    String(dailyCap),
  )) as string;

  if (verdict === 'ok') return { allowed: true, retryInMs: 0 };

  const msToNextHour =
    (60 - now.getUTCMinutes()) * 60_000 - now.getUTCSeconds() * 1000 + 5_000;
  const msToNextDay =
    (24 - now.getUTCHours()) * 3_600_000 - now.getUTCMinutes() * 60_000 + 60_000;
  return {
    allowed: false,
    scope: verdict as 'hourly' | 'daily',
    retryInMs: verdict === 'hourly' ? msToNextHour : msToNextDay,
  };
}
