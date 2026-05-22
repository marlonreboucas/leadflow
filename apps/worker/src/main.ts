import 'dotenv/config';
import pino from 'pino';
import { Worker, Queue } from 'bullmq';
import { QUEUES } from '@leadflow/shared';
import { connection } from './redis';
import { processors } from './processors';

const logger = pino({ name: 'worker', level: process.env.LOG_LEVEL ?? 'info' });

const queues = Object.values(QUEUES).map((name) => new Queue(name, { connection }));
logger.info({ queues: queues.map((q) => q.name) }, 'queues initialized');

const workers = (Object.entries(processors) as Array<[keyof typeof processors, (job: any) => Promise<any>]>).map(
  ([queueName, handler]) => {
    const w = new Worker(queueName as string, handler, {
      connection,
      concurrency: Number(process.env.WORKER_CONCURRENCY ?? 5),
    });
    w.on('failed', (job, err) => logger.error({ queue: queueName, jobId: job?.id, err: err.message }, 'job failed'));
    w.on('completed', (job) => logger.debug({ queue: queueName, jobId: job.id }, 'job completed'));
    return w;
  },
);

logger.info({ workers: workers.length }, 'worker started');

const SCAN_EVERY_MS = Number(process.env.SCANNER_INTERVAL_MS ?? 5 * 60 * 1000);
for (const [name, queueName] of [
  ['idle-lead', QUEUES.IDLE_LEAD_SCANNER],
  ['task-overdue', QUEUES.TASK_OVERDUE_SCANNER],
  ['appointment-reminder', QUEUES.APPOINTMENT_REMINDER_SCANNER],
] as const) {
  const q = new Queue(queueName, { connection });
  q.add('scan', {}, { repeat: { every: SCAN_EVERY_MS }, jobId: `repeat-${name}` }).catch((err) =>
    logger.warn({ err: err.message, queue: queueName }, 'scanner schedule failed'),
  );
}
logger.info({ everyMs: SCAN_EVERY_MS }, 'scanners scheduled');

async function shutdown() {
  logger.info('shutting down...');
  await Promise.all(workers.map((w) => w.close()));
  await Promise.all(queues.map((q) => q.close()));
  await connection.quit();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
