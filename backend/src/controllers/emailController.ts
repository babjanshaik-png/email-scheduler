import { Request, Response } from 'express';
import { prisma } from '../services/prisma.js';
import { enqueueEmailJob, removeEmailJob, initEmailQueue } from '../services/queue.js';
import { etherealEmailService } from '../services/ethereal.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { randomUUID } from 'node:crypto';

/**
 * 1. Schedule Single or Batch Emails via API (Database-First Strategy)
 * Flow: API -> PostgreSQL (PENDING) -> BullMQ Queue (SCHEDULED)
 */
export const scheduleEmails = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      userId,
      senderEmail,
      recipients, // Array of strings (email addresses from CSV/Text or input)
      subject,
      body,
      scheduledAt, // ISO date string
      delayBetweenEmailsMs = env.MIN_DELAY_BETWEEN_EMAILS_MS,
    } = req.body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      res.status(400).json({ status: 'error', message: 'At least one recipient email is required' });
      return;
    }

    const baseStartTime = new Date(scheduledAt);
    if (isNaN(baseStartTime.getTime())) {
      res.status(400).json({ status: 'error', message: 'Invalid scheduledAt timestamp' });
      return;
    }

    const createdJobs: { id: string; jobId: string; recipient: string; scheduledTime: Date }[] = [];

    // DATABASE-FIRST STRATEGY:
    // Create database records first before enqueueing to BullMQ to prevent job loss if Redis is down.
    for (let i = 0; i < recipients.length; i++) {
      const recipientEmail = recipients[i].trim();
      if (!recipientEmail) continue;

      // Stagger scheduled time by delayBetweenEmailsMs for each recipient in the batch
      const targetTime = new Date(baseStartTime.getTime() + i * Number(delayBetweenEmailsMs));
      const tempId = randomUUID();
      const deterministicJobId = `email-${tempId}`;

      // Step 1: Persist in database first (Status: PENDING)
      const emailRecord = await prisma.scheduledEmail.create({
        data: {
          id: tempId,
          jobId: deterministicJobId,
          userId,
          senderEmail,
          recipientEmail,
          subject,
          body,
          scheduledAt: targetTime,
          status: 'PENDING',
        },
      });

      // Step 2: Enqueue in BullMQ with deterministic Job ID (Idempotent Job Mapping)
      await enqueueEmailJob({
        emailId: emailRecord.id,
        scheduledAt: targetTime,
      });

      // Step 3: Transition state to SCHEDULED in DB
      const updatedRecord = await prisma.scheduledEmail.update({
        where: { id: emailRecord.id },
        data: { status: 'SCHEDULED' },
      });

      createdJobs.push({
        id: updatedRecord.id,
        jobId: updatedRecord.jobId,
        recipient: updatedRecord.recipientEmail,
        scheduledTime: targetTime,
      });
    }

    logger.info(
      { userId, count: createdJobs.length, senderEmail },
      '🚀 Successfully scheduled email batch (Database-First + BullMQ)'
    );

    res.status(201).json({
      status: 'success',
      message: `Successfully scheduled ${createdJobs.length} email(s)`,
      scheduledCount: createdJobs.length,
      jobs: createdJobs,
    });
  } catch (error: any) {
    logger.error({ error: error.message }, '❌ Failed to schedule email batch');
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to schedule email batch',
    });
  }
};

/**
 * 2. Get Paginated Scheduled Emails (with optional Status & Sender filters)
 */
export const getScheduledEmails = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
    const skip = (page - 1) * limit;
    const { senderEmail, status, userId } = req.query;

    const where: any = {
      status: {
        in: status ? [String(status)] : ['PENDING', 'SCHEDULED', 'PROCESSING'],
      },
    };

    if (senderEmail) {
      where.senderEmail = String(senderEmail);
    }
    if (userId) {
      where.userId = String(userId);
    }

    const [emails, totalCount] = await Promise.all([
      prisma.scheduledEmail.findMany({
        where,
        orderBy: { scheduledAt: 'asc' },
        skip,
        take: limit,
      }),
      prisma.scheduledEmail.count({ where }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    res.status(200).json({
      status: 'success',
      data: emails,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
      },
    });
  } catch (error: any) {
    logger.error({ error: error.message }, '❌ Failed to fetch scheduled emails');
    res.status(500).json({ status: 'error', message: 'Failed to fetch scheduled emails' });
  }
};

/**
 * 3. Get Paginated Sent/Failed Emails (with optional Status & Sender filters)
 */
export const getSentEmails = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
    const skip = (page - 1) * limit;
    const { senderEmail, status, userId } = req.query;

    const where: any = {
      status: {
        in: status ? [String(status)] : ['SENT', 'FAILED', 'CANCELLED'],
      },
    };

    if (senderEmail) {
      where.senderEmail = String(senderEmail);
    }
    if (userId) {
      where.userId = String(userId);
    }

    const [emails, totalCount] = await Promise.all([
      prisma.scheduledEmail.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.scheduledEmail.count({ where }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    res.status(200).json({
      status: 'success',
      data: emails,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
      },
    });
  } catch (error: any) {
    logger.error({ error: error.message }, '❌ Failed to fetch sent emails');
    res.status(500).json({ status: 'error', message: 'Failed to fetch sent emails' });
  }
};

/**
 * 4. Cancel/Delete a Scheduled Email
 */
export const cancelScheduledEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const email = await prisma.scheduledEmail.findUnique({ where: { id } });
    if (!email) {
      res.status(404).json({ status: 'error', message: 'Scheduled email not found' });
      return;
    }

    if (email.status === 'SENT') {
      res.status(400).json({ status: 'error', message: 'Cannot cancel an email that has already been SENT' });
      return;
    }

    // Remove job from BullMQ Queue
    await removeEmailJob(id);

    // Update database status to CANCELLED
    const updated = await prisma.scheduledEmail.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    logger.info({ emailId: id, jobId: updated.jobId }, '🛑 Cancelled scheduled email successfully');

    res.status(200).json({
      status: 'success',
      message: 'Scheduled email cancelled successfully',
      data: updated,
    });
  } catch (error: any) {
    logger.error({ error: error.message }, '❌ Failed to cancel email');
    res.status(500).json({ status: 'error', message: 'Failed to cancel email' });
  }
};

/**
 * 5. Get Real-Time Dashboard Statistics
 */
export const getEmailStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const [scheduledCount, sentCount, failedCount, totalCount] = await Promise.all([
      prisma.scheduledEmail.count({
        where: { status: { in: ['PENDING', 'SCHEDULED', 'PROCESSING'] } },
      }),
      prisma.scheduledEmail.count({ where: { status: 'SENT' } }),
      prisma.scheduledEmail.count({ where: { status: 'FAILED' } }),
      prisma.scheduledEmail.count(),
    ]);

    const q = initEmailQueue();
    const delayedJobCount = await q.getDelayedCount();
    const activeJobCount = await q.getActiveCount();

    res.status(200).json({
      status: 'success',
      stats: {
        scheduled: scheduledCount,
        sent: sentCount,
        failed: failedCount,
        total: totalCount,
        queueDelayed: delayedJobCount,
        queueActive: activeJobCount,
        etherealAccount: etherealEmailService.getTestAccountEmail(),
        config: {
          concurrency: env.WORKER_CONCURRENCY,
          minDelayMs: env.MIN_DELAY_BETWEEN_EMAILS_MS,
          maxHourlyLimit: env.MAX_EMAILS_PER_HOUR_PER_SENDER,
        },
      },
    });
  } catch (error: any) {
    logger.error({ error: error.message }, '❌ Failed to get stats');
    res.status(500).json({ status: 'error', message: 'Failed to get statistics' });
  }
};
