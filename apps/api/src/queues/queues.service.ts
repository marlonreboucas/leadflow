import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { QUEUES, type QueueName } from '@leadflow/shared';
import { env } from '../config/env';

@Injectable()
export class QueuesService implements OnModuleDestroy {
  private readonly connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  private readonly queues = new Map<QueueName, Queue>();

  constructor() {
    for (const name of Object.values(QUEUES)) {
      this.queues.set(name, new Queue(name, { connection: this.connection }));
    }
  }

  add<T>(name: QueueName, data: T, jobId?: string) {
    const queue = this.queues.get(name)!;
    return queue.add(name, data, jobId ? { jobId } : undefined);
  }

  async onModuleDestroy() {
    await Promise.all([...this.queues.values()].map((q) => q.close()));
    await this.connection.quit();
  }
}
