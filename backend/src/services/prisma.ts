import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger.js';

class PrismaService {
  private static instance: PrismaClient;

  public static getInstance(): PrismaClient {
    if (!PrismaService.instance) {
      PrismaService.instance = new PrismaClient({
        log: ['error', 'warn'],
      });
      logger.info('📦 Initialized Prisma Client Database Connection');
    }
    return PrismaService.instance;
  }
}

export const prisma = PrismaService.getInstance();
