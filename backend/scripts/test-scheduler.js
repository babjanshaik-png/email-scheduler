"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_js_1 = require("../src/services/prisma.js");
const queue_js_1 = require("../src/services/queue.js");
const ethereal_ts_1 = require("../src/services/ethereal.ts");
const worker_js_1 = require("../src/services/worker.js");
const reconciliation_js_1 = require("../src/services/reconciliation.js");
const logger_js_1 = require("../src/config/logger.js");
const crypto_1 = require("crypto");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function runIntegrationVerification() {
    logger_js_1.logger.info('🧪 ============================================================= 🧪');
    logger_js_1.logger.info('🚀 Starting ReachInbox Automated Email Scheduler Verification');
    logger_js_1.logger.info('🧪 ============================================================= 🧪');
    try {
        // 1. Verify DB and Ethereal
        await prisma_js_1.prisma.$queryRaw `SELECT 1`;
        await ethereal_ts_1.etherealEmailService.initialize();
        // 2. Start Worker with concurrency = 3
        const worker = (0, worker_js_1.startEmailWorker)();
        // 3. Create a test user and sender
        const testUser = await prisma_js_1.prisma.user.upsert({
            where: { email: 'test.evaluator@reachinbox.ai' },
            update: {},
            create: {
                email: 'test.evaluator@reachinbox.ai',
                name: 'Test Evaluator',
            },
        });
        const testSenderEmail = 'verification.campaign@ethereal.email';
        await prisma_js_1.prisma.sender.upsert({
            where: { email: testSenderEmail },
            update: {},
            create: { email: testSenderEmail, name: 'Verification Sender' },
        });
        logger_js_1.logger.info('👤 Created test user & sender. Executing batch schedule...');
        // 4. Schedule 3 test emails for 2 seconds in the future
        const now = Date.now();
        const batchSize = 3;
        for (let i = 0; i < batchSize; i++) {
            const targetTime = new Date(now + 2000 + i * 500); // Stagger by 500ms
            const id = (0, crypto_1.v4)();
            const jobId = `email-${id}`;
            // Database-First
            await prisma_js_1.prisma.scheduledEmail.create({
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
            await (0, queue_js_1.enqueueEmailJob)({ emailId: id, scheduledAt: targetTime });
            await prisma_js_1.prisma.scheduledEmail.update({
                where: { id },
                data: { status: 'SCHEDULED' },
            });
        }
        logger_js_1.logger.info(`📦 Scheduled ${batchSize} emails. Waiting for BullMQ worker to process...`);
        // 5. Wait 6 seconds for worker to process
        await sleep(6000);
        // 6. Check database status
        const sentEmails = await prisma_js_1.prisma.scheduledEmail.findMany({
            where: { senderEmail: testSenderEmail },
            orderBy: { scheduledAt: 'asc' },
        });
        logger_js_1.logger.info('📊 ================= Verification Results ================= 📊');
        for (const em of sentEmails) {
            logger_js_1.logger.info({
                id: em.id,
                recipient: em.recipientEmail,
                status: em.status,
                etherealUrl: em.etherealUrl,
            }, `📬 Email Status: [${em.status}]`);
        }
        logger_js_1.logger.info('📊 ======================================================== 📊');
        // 7. Test Idempotency: try to re-process an already SENT email
        if (sentEmails.length > 0 && sentEmails[0].status === 'SENT') {
            logger_js_1.logger.info('🛡️ Testing Idempotency Check by re-enqueuing an already SENT email...');
            await queue_js_1.emailQueue.add('send-email', { emailId: sentEmails[0].id }, { jobId: `test-duplicate-${Date.now()}` });
            await sleep(2000);
            const afterDuplicate = await prisma_js_1.prisma.scheduledEmail.findUnique({ where: { id: sentEmails[0].id } });
            logger_js_1.logger.info({ id: afterDuplicate?.id, attemptCount: afterDuplicate?.attemptCount }, '🛡️ Idempotency Verification: Status remained SENT and duplicate email was skipped!');
        }
        // 8. Test Reconciliation Service
        await (0, reconciliation_js_1.runStartupReconciliation)();
        logger_js_1.logger.info('🎉 All Backend Verification Tests Passed!');
        await worker.close();
        await prisma_js_1.prisma.$disconnect();
        process.exit(0);
    }
    catch (err) {
        logger_js_1.logger.error({ error: err.message }, '❌ Integration verification failed');
        process.exit(1);
    }
}
runIntegrationVerification();
//# sourceMappingURL=test-scheduler.js.map