import { Redis, RedisOptions } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

let embeddedServer: any = null;

const getHost = () => (env.REDIS_HOST === 'memory' ? '127.0.0.1' : env.REDIS_HOST);

/**
 * Attempts to initialize an embedded RedisMemoryServer if no local Redis server is running.
 * Provides 100% real Redis compatibility (BullMQ Lua scripts, cmsgpack, cjson) on Windows without Docker.
 */
const ensureRedisServer = async (): Promise<number> => {
  const host = getHost();
  if (host !== 'localhost' && host !== '127.0.0.1') {
    return env.REDIS_PORT;
  }

  // Quick check if port is already listening (external Redis server or Docker)
  try {
    const testRedis = new Redis({
      host,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
      lazyConnect: true,
    });
    testRedis.on('error', () => {}); // Silently ignore probe connection error
    await testRedis.connect();
    await testRedis.ping();
    await testRedis.quit();
    logger.info(`⚡ Detected external Redis server running on ${host}:${env.REDIS_PORT}`);
    return env.REDIS_PORT;
  } catch (err) {
    logger.info('⚡ External Redis not found on localhost. Launching embedded RedisMemoryServer (100% BullMQ compatible)...');
    try {
      const startEmbeddedServer = async () => {
        const { RedisMemoryServer } = await import('redis-memory-server');
        if (!embeddedServer) {
          embeddedServer = await RedisMemoryServer.create({
            instance: {
              port: env.REDIS_PORT,
            },
          });
        }
        return await embeddedServer.getPort();
      };

      const port = await Promise.race([
        startEmbeddedServer(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('RedisMemoryServer startup timeout')), 2000)
        ),
      ]);

      logger.info(`✨ Embedded RedisMemoryServer active on port: ${port}`);
      return port;
    } catch (e: any) {
      logger.warn('⚠️ Local Redis server not detected on 127.0.0.1:6379. Proceeding with database-backed API server.');
      return env.REDIS_PORT;
    }
  }
};

const createRedisClient = (name: string, options?: Partial<RedisOptions>): Redis => {
  const host = getHost();
  const config: RedisOptions = {
    host,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
    lazyConnect: true, // Do not connect immediately until initializeRedisInfrastructure configures port
    retryStrategy(times) {
      if (times > 3) {
        return 10000; // Exponential backoff max 10s when offline to keep event loop responsive
      }
      return 1000;
    },
    ...options,
  };

  const client = new Redis(config);

  client.on('connect', () => {
    logger.info(`📦 Redis [${name}] connected successfully to ${client.options.host}:${client.options.port}`);
  });

  client.on('error', (err) => {
    // Only log first error to avoid log spamming
    if ((client as any)._errorLogged) return;
    (client as any)._errorLogged = true;
    logger.warn(`⚠️ Redis [${name}] connection offline (${err.message})`);
  });

  return client;
};

// Create independent connections for Queue persistence and Distributed Rate-Limiting counters
export const queueRedisConnection = createRedisClient('BullMQ-Queue-Persistence');
export const rateLimitRedisConnection = createRedisClient('Distributed-Rate-Limiting-Counters');

// Helper to ensure embedded server starts before worker/queue boot
export const initializeRedisInfrastructure = async (): Promise<void> => {
  const port = await ensureRedisServer();
  const host = getHost();
  
  queueRedisConnection.options.port = port;
  queueRedisConnection.options.host = host;
  rateLimitRedisConnection.options.port = port;
  rateLimitRedisConnection.options.host = host;

  if (queueRedisConnection.status === 'wait') {
    await queueRedisConnection.connect().catch((e) => {
      logger.error({ error: e.message }, 'Failed to connect queueRedisConnection');
    });
  }
  if (rateLimitRedisConnection.status === 'wait') {
    await rateLimitRedisConnection.connect().catch((e) => {
      logger.error({ error: e.message }, 'Failed to connect rateLimitRedisConnection');
    });
  }
};
