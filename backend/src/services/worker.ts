import { Worker, Job } from 'bullmq';
import { QUEUE_NAME, emailQueue, EmailJobPayload } from './queue.js';
import { queueRedisConnection, rateLimitRedisConnection } from './redis.js';
import { prisma } from './prisma.js';
import { etherealEmailService } from './ethereal.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Returns an hour window formatting string, e.g., "2026-07-26-18".
 */
export const getHourWindowKey = (date: Date): string => {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const h = String(date.getUTCHours()).padStart(2, '0');
  return `${y}-${m}-${d}-${h}`;
};

/**
 * Calculates the start of the next UTC hour window.
 */
export const getNextHourWindow = (currentDate: Date): Date => {
  const next = new Date(currentDate);
  next.setUTCHours(next.getUTCHours() + 1, 0, 0, 0);
  return next;
};

/**
 * BullMQ Worker Engine
 * Exclusively responsible for concurrency, delayed job execution, idempotency checks,
 * rate limiting via distributed Redis counters, and retry backoff handling.
 */
export const startEmailWorker = (): Worker<EmailJobPayload> => {
  logger.info(
    { concurrency: env.WORKER_CONCURRENCY, minDelayMs: env.MIN_DELAY_BETWEEN_EMAILS_MS },
    '🚀 Starting BullMQ Email Worker Engine'
  );

  const worker = new Worker<EmailJobPayload>(
    QUEUE_NAME,
    async (job: Job<EmailJobPayload>) => {
      const { emailId } = job.data;
      logger.debug({ jobId: job.id, emailId }, '⚙️ Worker picked up delayed job');

      // 1. Worker Idempotency Check (Database First Check)
      const emailRecord = await prisma.scheduledEmail.findUnique({
        where: { id: emailId },
      });

      if (!emailRecord) {
        logger.warn({ emailId, jobId: job.id }, '⚠️ Email record not found in DB. Skipping job.');
        return { status: 'SKIPPED_NOT_FOUND' };
      }

      // If already SENT or CANCELLED, never execute duplicate delivery
      if (emailRecord.status === 'SENT') {
        logger.info(
          { emailId, jobId: job.id, sentAt: emailRecord.sentAt },
          '✅ Idempotency Check: Email was already SENT. Skipping job to prevent duplicate delivery.'
        );
        return { status: 'SKIPPED_ALREADY_SENT' };
      }

      if (emailRecord.status === 'CANCELLED') {
        logger.info(
          { emailId, jobId: job.id },
          '🛑 Idempotency Check: Email was CANCELLED by user. Skipping delivery.'
        );
        return { status: 'SKIPPED_CANCELLED' };
      }

      // Mark as PROCESSING
      await prisma.scheduledEmail.update({
        where: { id: emailId },
        data: {
          status: 'PROCESSING',
          attemptCount: { increment: 1 },
        },
      });

      // 2. Check Distributed Redis Hourly Rate-Limiting Counters
      const hourKey = getHourWindowKey(new Date());
      const rateLimitKey = `rate_limit:${hourKey}:${emailRecord.senderEmail}`;
      const currentCountStr = await rateLimitRedisConnection.get(rateLimitKey);
      const currentCount = currentCountStr ? parseInt(currentCountStr, 10) : 0;

      logger.debug(
        { senderEmail: emailRecord.senderEmail, hourKey, currentCount, maxLimit: env.MAX_EMAILS_PER_HOUR_PER_SENDER },
        '📊 Checking distributed hourly rate limit counter'
      );

      // If hourly limit is reached, DO NOT drop or fail the job! Reschedule to next hour window.
      if (currentCount >= env.MAX_EMAILS_PER_HOUR_PER_SENDER) {
        const nextHour = getNextHourWindow(new Date());
        const delayMs = Math.max(1000, nextHour.getTime() - Date.now());
        const newJobId = `${emailRecord.jobId}-resched-${Date.now()}`;

        logger.warn(
          {
            emailId,
            senderEmail: emailRecord.senderEmail,
            currentCount,
            maxLimit: env.MAX_EMAILS_PER_HOUR_PER_SENDER,
            nextHour: nextHour.toISOString(),
          },
          '⏳ Hourly rate limit exceeded for sender! Rescheduling job to next hour window without dropping.'
        );

        // Update scheduledAt in DB and enqueue for next hour window
        await prisma.scheduledEmail.update({
          where: { id: emailId },
          data: {
            status: 'SCHEDULED',
            scheduledAt: nextHour,
            jobId: newJobId,
            errorMessage: `Rescheduled due to hourly rate limit (${currentCount}/${env.MAX_EMAILS_PER_HOUR_PER_SENDER} sent in ${hourKey})`,
          },
        });

        await emailQueue.add(
          'send-email',
          { emailId },
          {
            jobId: newJobId,
            delay: delayMs,
          }
        );

        return { status: 'RESCHEDULED_RATE_LIMIT', nextHour: nextHour.toISOString() };
      }

      // 3. Enforce Minimum Delay Throttling Between Each Email Send
      if (env.MIN_DELAY_BETWEEN_EMAILS_MS > 0) {
        await sleep(env.MIN_DELAY_BETWEEN_EMAILS_MS);
      }

      // 4. Increment Distributed Redis Rate-Limit Counter Atomically
      await rateLimitRedisConnection.incr(rateLimitKey);
      await rateLimitRedisConnection.expire(rateLimitKey, 7200); // 2 hours TTL

      // 5. Execute SMTP Send via Ethereal Email Service (Pure SMTP client)
      try {
        const { messageId, previewUrl } = await etherealEmailService.sendEmail({
          from: emailRecord.senderEmail,
          to: emailRecord.recipientEmail,
          subject: emailRecord.subject,
          body: emailRecord.body,
        });

        // Update DB Record to SENT
        await prisma.scheduledEmail.update({
          where: { id: emailId },
          data: {
            status: 'SENT',
            sentAt: new Date(),
            etherealUrl: previewUrl,
            errorMessage: null,
          },
        });

        logger.info(
          { emailId, recipient: emailRecord.recipientEmail, previewUrl },
          '🎉 Successfully processed and delivered scheduled email!'
        );

        return { status: 'SENT', messageId, previewUrl };
      } catch (error: any) {
        logger.error(
          { emailId, error: error?.message || error },
          '❌ SMTP send failed. BullMQ will apply exponential backoff retry.'
        );
        throw error; // Throwing triggers BullMQ exponential backoff retry
      }
    },
    {
      connection: queueRedisConnection,
      concurrency: env.WORKER_CONCURRENCY,
    }
  );

  worker.on('failed', async (job, err) => {
    if (!job) return;
    const { emailId } = job.data;
    const maxAttempts = job.opts.attempts || 3;
    const currentAttempts = job.attemptsMade;

    logger.error(
      { jobId: job.id, emailId, currentAttempts, maxAttempts, error: err.message },
      '⚠️ Worker job attempt failed'
    );

    // If max retry attempts exceeded, mark as FAILED in PostgreSQL
    if (currentAttempts >= maxAttempts) {
      logger.error(
        { emailId, jobId: job.id },
        '🛑 Max retry attempts reached. Marking email record as FAILED in DB.'
      );
      await prisma.scheduledEmail.update({
        where: { id: emailId },
        data: {
          status: 'FAILED',
          errorMessage: `Delivery failed after ${currentAttempts} attempts: ${err.message}`,
        },
      });
    }
  });

  worker.on('error', (err) => {
    if ((worker as any)._errorLogged) return;
    (worker as any)._errorLogged = true;
    logger.warn({ error: err.message }, '⚠️ BullMQ Worker connection offline');
  });

  return worker;
};
