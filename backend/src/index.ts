import express from 'express';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { prisma } from './services/prisma.js';
import { etherealEmailService } from './services/ethereal.js';
import { initializeRedisInfrastructure } from './services/redis.js';
import { startEmailWorker } from './services/worker.js';
import { runStartupReconciliation } from './services/reconciliation.js';
import routes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// Middleware
app.use(
  cors({
    origin: '*',
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Structured Request Logging (Pino HTTP)
app.use(
  pinoHttp({
    logger,
    autoLogging: {
      ignore: (req) => req.url?.startsWith('/health') || false,
    },
  })
);

// Mount API & Health Routes
app.use('/', routes);

// Global Error Handler Middleware
app.use(errorHandler);

const bootstrap = async () => {
  try {
    logger.info('⚙️ Bootstrapping ReachInbox Email Scheduler API & Worker Server...');

    // 1. Verify DB Connection First
    await prisma.$queryRaw`SELECT 1`;
    logger.info('📦 Database connection verified');

    // 2. Start Express API Server immediately so API & Dashboard are fully functional
    const server = app.listen(env.PORT, () => {
      logger.info('🚀 ============================================================= 🚀');
      logger.info(`✨ ReachInbox Email Scheduler API Server active on PORT: ${env.PORT}`);
      logger.info(`🔍 Healthcheck URL: http://localhost:${env.PORT}/health`);
      logger.info(`📊 Worker Concurrency: ${env.WORKER_CONCURRENCY} | Min Delay: ${env.MIN_DELAY_BETWEEN_EMAILS_MS}ms`);
      logger.info('🚀 ============================================================= 🚀');
    });

    // 3. Ensure Redis Infrastructure (Embedded fallback or External connection attempt)
    initializeRedisInfrastructure().catch((err) => {
      logger.warn({ error: err.message }, 'Redis infrastructure initialization warning');
    });

    // 4. Initialize Ethereal SMTP Account
    etherealEmailService.initialize().catch((err) => {
      logger.warn({ error: err.message }, 'Ethereal SMTP initialization deferred');
    });

    // 5. Start BullMQ Worker & Reconciliation Engine
    let worker: any = null;
    try {
      worker = startEmailWorker();
      runStartupReconciliation().catch((err) => {
        logger.warn('Startup reconciliation waiting for Redis connection');
      });
    } catch (workerErr: any) {
      logger.warn({ error: workerErr.message }, 'Worker initialization deferred');
    }

    const shutdown = async (signal: string) => {
      logger.info(`🛑 Received ${signal}. Gracefully shutting down...`);
      server.close();
      if (worker) await worker.close().catch(() => {});
      await prisma.$disconnect();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    logger.error({ error }, '❌ Fatal startup error. Terminating process.');
    process.exit(1);
  }
};

bootstrap();
