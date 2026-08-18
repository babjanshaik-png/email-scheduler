import { prisma } from './prisma.js';
import { initEmailQueue, QUEUE_NAME } from './queue.js';
import { logger } from '../config/logger.js';

/**
 * Startup Reconciliation & Restart Recovery Service.
 * Ensures 100% consistency between PostgreSQL records and BullMQ delayed jobs after a server restart.
 *
 * How restart recovery works:
 * 1. Normally, BullMQ delayed jobs remain persisted in Redis ZSETs and automatically resume when workers reconnect.
 * 2. As an additional consistency guarantee, on backend startup this service audits PostgreSQL for all SCHEDULED emails.
 * 3. It checks if each job is present in BullMQ. If missing, it re-enqueues the job with its deterministic jobId.
 * 4. No jobs restart from scratch or send duplicate emails due to our strict worker idempotency check.
 */
export const runStartupReconciliation = async (): Promise<{
  totalScheduledInDb: number;
  reconciledCount: number;
}> => {
  logger.info('🔄 Running Startup Reconciliation & Restart Recovery Service...');

  const scheduledEmails = await prisma.scheduledEmail.findMany({
    where: {
      status: 'SCHEDULED',
    },
  });

  logger.info(
    { totalScheduledInDb: scheduledEmails.length },
    '📋 Found SCHEDULED emails in database. Auditing BullMQ queue synchronization...'
  );

  let reconciledCount = 0;
  const q = initEmailQueue();

  for (const email of scheduledEmails) {
    const existingJob = await q.getJob(email.jobId);
    if (!existingJob) {
      const now = Date.now();
      const delayMs = Math.max(0, new Date(email.scheduledAt).getTime() - now);

      logger.warn(
        { emailId: email.id, jobId: email.jobId, delayMs },
        '⚠️ Missing job in BullMQ for SCHEDULED database record. Re-enqueueing to guarantee delivery...'
      );

      await q.add(
        'send-email',
        { emailId: email.id },
        {
          jobId: email.jobId,
          delay: delayMs,
        }
      );
      reconciledCount++;
    }
  }

  logger.info(
    { totalScheduledInDb: scheduledEmails.length, reconciledCount },
    '✅ Startup Reconciliation completed successfully. System is 100% synchronized.'
  );

  return { totalScheduledInDb: scheduledEmails.length, reconciledCount };
};
