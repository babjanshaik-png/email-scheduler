import { Request, Response } from 'express';
import { prisma } from '../services/prisma.js';
import { queueRedisConnection, rateLimitRedisConnection } from '../services/redis.js';
import { logger } from '../config/logger.js';

export const getHealthStatus = async (req: Request, res: Response): Promise<void> => {
  let dbStatus = 'disconnected';
  let queueRedisStatus = 'disconnected';
  let rateLimitRedisStatus = 'disconnected';

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch (error) {
    logger.error({ error }, '❌ HealthCheck: Database ping failed');
  }

  if (queueRedisConnection.status === 'ready') {
    try {
      const queuePing = await queueRedisConnection.ping();
      if (queuePing === 'PONG') {
        queueRedisStatus = 'connected';
      }
    } catch (error) {
      logger.warn({ error }, '❌ HealthCheck: Queue Redis ping failed');
    }
  }

  if (rateLimitRedisConnection.status === 'ready') {
    try {
      const rlPing = await rateLimitRedisConnection.ping();
      if (rlPing === 'PONG') {
        rateLimitRedisStatus = 'connected';
      }
    } catch (error) {
      logger.warn({ error }, '❌ HealthCheck: RateLimit Redis ping failed');
    }
  }

  const isHealthy =
    dbStatus === 'connected' &&
    queueRedisStatus === 'connected' &&
    rateLimitRedisStatus === 'connected';

  const status = isHealthy
    ? 'healthy'
    : dbStatus === 'connected' || queueRedisStatus === 'connected'
    ? 'degraded'
    : 'unhealthy';

  res.status(status === 'unhealthy' ? 503 : 200).json({
    status,
    timestamp: new Date().toISOString(),
    services: {
      database: dbStatus,
      queueRedis: queueRedisStatus,
      rateLimitRedis: rateLimitRedisStatus,
      workers: 'active',
    },
  });
};
