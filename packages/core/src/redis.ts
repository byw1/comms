import { Redis, type RedisOptions } from 'ioredis';

let shared: Redis | undefined;

/**
 * Options tuned for BullMQ + Railway. `maxRetriesPerRequest: null` is required by
 * BullMQ workers. `family: 0` lets ioredis resolve both IPv4 and IPv6, which
 * matters on Railway's private network (legacy envs are IPv6-only).
 */
export function redisOptions(): RedisOptions {
  return {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    family: 0,
    retryStrategy: (times) => Math.min(times * 200, 5000),
  };
}

export function createRedis(url = process.env.REDIS_URL): Redis {
  if (!url) throw new Error('REDIS_URL is not set. Comms cannot connect to Redis.');
  return new Redis(url, redisOptions());
}

/** Shared connection for pub/sub publishing and general commands. */
export function getRedis(): Redis {
  if (!shared) shared = createRedis();
  return shared;
}

export { Redis };
