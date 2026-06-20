import { Worker } from 'bullmq';
import {
  QUEUE_NAMES,
  createRedis,
  getRedis,
  loadConfig,
  enqueueMaintenance,
  logger,
} from '@comms/core';
import { getDb, closeDb } from '@comms/db';
import { channelConnections } from '@comms/db';
import { processInbound } from './processors/inbound.js';
import { processOutbound } from './processors/outbound.js';
import { processAttachment } from './processors/attachments.js';
import { processMaintenance } from './processors/maintenance.js';

const log = logger.child({ service: 'worker' });

async function main() {
  loadConfig(true); // fail fast if DB/Redis/secret are missing
  getDb(); // warm the pool

  const workers: Worker[] = [
    new Worker(QUEUE_NAMES.inbound, processInbound, {
      connection: createRedis(),
      concurrency: 10,
    }),
    new Worker(QUEUE_NAMES.outbound, processOutbound, {
      connection: createRedis(),
      concurrency: 5,
    }),
    new Worker(QUEUE_NAMES.attachments, processAttachment, {
      connection: createRedis(),
      concurrency: 5,
    }),
    new Worker(QUEUE_NAMES.maintenance, processMaintenance, {
      connection: createRedis(),
      concurrency: 2,
    }),
  ];

  for (const w of workers) {
    w.on('failed', (job, err) =>
      log.error({ queue: w.name, jobId: job?.id, err: err.message }, 'job failed'),
    );
    w.on('error', (err) => log.error({ queue: w.name, err: err.message }, 'worker error'));
  }

  log.info('Comms worker started');

  // Periodic sweep: heartbeat each connection + unsnooze due conversations.
  // A short Redis lock ensures only one replica sweeps each tick.
  const sweep = async () => {
    const redis = getRedis();
    const got = await redis.set('comms:sweep:lock', '1', 'PX', 55_000, 'NX');
    if (!got) return;
    try {
      await enqueueMaintenance({ type: 'unsnooze' });
      const conns = await getDb()
        .select({ id: channelConnections.id })
        .from(channelConnections);
      for (const c of conns) {
        await enqueueMaintenance({ type: 'heartbeat', connectionId: c.id });
      }
    } catch (err) {
      log.warn({ err: (err as Error).message }, 'sweep failed');
    }
  };
  await sweep();
  const interval = setInterval(() => void sweep(), 60_000);

  const shutdown = async (signal: string) => {
    log.info({ signal }, 'shutting down worker');
    clearInterval(interval);
    await Promise.allSettled(workers.map((w) => w.close()));
    await closeDb();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  log.error({ err: err.message }, 'worker failed to start');
  process.exit(1);
});
