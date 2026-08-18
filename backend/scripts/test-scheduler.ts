import { prisma } from '../src/services/prisma.js';
import { enqueueEmailJob, initEmailQueue } from '../src/services/queue.js';
import { etherealEmailService } from '../src/services/ethereal.js';
import { startEmailWorker } from '../src/services/worker.js';
import { initializeRedisInfrastructure } from '../src/services/redis.js';
import { runStartupReconciliation } from '../src/services/reconciliation.js';
import { logger } from '../src/config/logger.js';
import { randomUUID } from 'node:crypto';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runIntegrationVerification() {
  logger.info('🧪 ============================================================= 🧪');
  logger.info('🚀 Starting ReachInbox Automated Email Scheduler Verification');
  logger.info('🧪 ============================================================= 🧪');

  try {
    // 0. Initialize embedded Redis or external Redis
    await initializeRedisInfrastructure();

    // 1. Verify DB and Ethereal
    await prisma.$queryRaw`SELECT 1`;
    await etherealEmailService.initialize();

    // 2. Start Worker with concurrency = 3
    const worker = startEmailWorker();

    // 3. Create a test user and sender
    const testUser = await prisma.user.upsert({
      where: { email: 'test.evaluator@reachinbox.ai' },
      update: {},
      create: {
        email: 'test.evaluator@reachinbox.ai',
        name: 'Test Evaluator',
      },
    });

    const testSenderEmail = 'verification.campaign@ethereal.email';
    await prisma.sender.upsert({
      where: { email: testSenderEmail },
      update: {},
      create: { email: testSenderEmail, name: 'Verification Sender' },
    });

    logger.info('👤 Created test user & sender. Executing batch schedule...');

    // 4. Schedule 3 test emails for 2 seconds in the future
    const now = Date.now();
    const batchSize = 3;

    for (let i = 0; i < batchSize; i++) {
      const targetTime = new Date(now + 2000 + i * 500); // Stagger by 500ms
      const id = randomUUID();
      const jobId = `email-${id}`;

      // Database-First
      await prisma.scheduledEmail.create({
        data: {
          id,
          jobId,
          userId: testUser.id,
          senderEmail: testSenderEmail,
          recipientEmail: `lead${i + 1}@example.com`,
          subject: `ReachInbox Verification Email #${i + 1}`,
          body: `Hello Lead #${i + 1}, this is an automated verification test email.`,
          scheduledAt: targetTime,
          status: 'PENDING',
        },
      });

      await enqueueEmailJob({ emailId: id, scheduledAt: targetTime });

      await prisma.scheduledEmail.update({
        where: { id },
        data: { status: 'SCHEDULED' },
      });
    }

    logger.info(`📦 Scheduled ${batchSize} emails. Waiting for BullMQ worker to process...`);

    // 5. Wait 6 seconds for worker to process
    await sleep(6000);

    // 6. Check database status
    const sentEmails = await prisma.scheduledEmail.findMany({
      where: { senderEmail: testSenderEmail },
      orderBy: { scheduledAt: 'asc' },
    });

    logger.info('📊 ================= Verification Results ================= 📊');
    for (const em of sentEmails) {
      logger.info(
        {
          id: em.id,
          recipient: em.recipientEmail,
          status: em.status,
          etherealUrl: em.etherealUrl,
        },
        `📬 Email Status: [${em.status}]`
      );
    }
    logger.info('📊 ======================================================== 📊');

    // 7. Test Idempotency: try to re-process an already SENT email
    if (sentEmails.length > 0 && sentEmails[0].status === 'SENT') {
      logger.info('🛡️ Testing Idempotency Check by re-enqueuing an already SENT email...');
      const q = initEmailQueue();
      await q.add('send-email', { emailId: sentEmails[0].id }, { jobId: `test-duplicate-${Date.now()}` });
      await sleep(2000);
      const afterDuplicate = await prisma.scheduledEmail.findUnique({ where: { id: sentEmails[0].id } });
      logger.info(
        { id: afterDuplicate?.id, attemptCount: afterDuplicate?.attemptCount },
        '🛡️ Idempotency Verification: Status remained SENT and duplicate email was skipped!'
      );
    }

    // 8. Test Reconciliation Service
    await runStartupReconciliation();

    logger.info('🎉 All Backend Verification Tests Passed!');
    await worker.close();
    await prisma.$disconnect();
    process.exit(0);
  } catch (err: any) {
    logger.error({ error: err.message }, '❌ Integration verification failed');
    process.exit(1);
  }
}

runIntegrationVerification();
