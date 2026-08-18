import { Queue } from 'bullmq';
import { queueRedisConnection } from './redis.js';
import { logger } from '../config/logger.js';

export const QUEUE_NAME = 'reachinbox-email-scheduler';

export let emailQueue: Queue;

/**
 * BullMQ Queue Instance - Exclusively responsible for enqueueing jobs.
 * This file contains zero worker processing or scheduling loop logic.
 */
export const initEmailQueue = (): Queue => {
  if (!emailQueue) {
    emailQueue = new Queue(QUEUE_NAME, {
      connection: queueRedisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000, // 5s, 10s, 20s exponential backoff
        },
        removeOnComplete: false,
        removeOnFail: false,
      },
    });
  }
  return emailQueue;
};

export interface EmailJobPayload {
  emailId: string;
}

/**
 * Enqueues a delayed job into BullMQ after the record has been persisted in PostgreSQL/SQLite.
 * Uses a deterministic jobId (email-{id}) to guarantee a strict 1:1 mapping and prevent duplicate jobs.
 */
export const enqueueEmailJob = async (params: {
  emailId: string;
  scheduledAt: Date;
}): Promise<{ jobId: string; delayMs: number }> => {
  const q = initEmailQueue();
  const now = Date.now();
  const delayMs = Math.max(0, params.scheduledAt.getTime() - now);
  const jobId = `email-${params.emailId}`;

  logger.info(
    { emailId: params.emailId, jobId, delayMs, scheduledAt: params.scheduledAt.toISOString() },
    '📥 Enqueueing email job into BullMQ Queue'
  );

  await q.add(
    'send-email',
    { emailId: params.emailId },
    {
      jobId,
      delay: delayMs,
    }
  );

  return { jobId, delayMs };
};

/**
 * Cancels a scheduled job from BullMQ by its deterministic jobId.
 */
export const removeEmailJob = async (emailId: string): Promise<boolean> => {
  const q = initEmailQueue();
  const jobId = `email-${emailId}`;
  const job = await q.getJob(jobId);
  if (job) {
    await job.remove();
    logger.info({ emailId, jobId }, '🗑️ Removed scheduled job from BullMQ');
    return true;
  }
  return false;
};
