import { Request, Response } from 'express';
import { prisma } from '../services/prisma.js';
import { logger } from '../config/logger.js';
import { etherealEmailService } from '../services/ethereal.js';

const DEFAULT_SENDERS = [
  { email: 'campaign.manager@ethereal.email', name: 'Campaign Manager' },
  { email: 'sales.outreach@ethereal.email', name: 'Sales Outreach' },
  { email: 'support.team@ethereal.email', name: 'ReachInbox Support' },
];

/**
 * Ensures default test senders are available in the DB for any logged-in user.
 */
const ensureDefaultSenders = async () => {
  try {
    const testEmail = etherealEmailService.getTestAccountEmail();
    const sendersToCreate = [
      { email: testEmail, name: 'Default Ethereal Sender' },
      ...DEFAULT_SENDERS,
    ];

    for (const sender of sendersToCreate) {
      await prisma.sender.upsert({
        where: { email: sender.email },
        update: {},
        create: {
          email: sender.email,
          name: sender.name,
        },
      });
    }
  } catch (error) {
    logger.warn({ error }, '⚠️ Non-fatal error upserting default senders');
  }
};

/**
 * Handles Real Google OAuth Login (or client token login).
 */
export const googleLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, name, avatar } = req.body;

    if (!email || !name) {
      res.status(400).json({
        status: 'error',
        message: 'Email and Name are required from Google profile',
      });
      return;
    }

    await ensureDefaultSenders();

    const user = await prisma.user.upsert({
      where: { email },
      update: { name, avatar },
      create: {
        email,
        name,
        avatar: avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`,
      },
    });

    const senders = await prisma.sender.findMany();

    logger.info({ userId: user.id, email: user.email }, '👤 User logged in via Google OAuth');

    res.status(200).json({
      status: 'success',
      user,
      senders,
    });
  } catch (error: any) {
    logger.error({ error: error.message }, '❌ Google Login failed');
    res.status(500).json({ status: 'error', message: 'Failed to authenticate Google user' });
  }
};

/**
 * Handles One-Click Demo Test Account Login for immediate evaluator testing.
 */
export const demoLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureDefaultSenders();

    const demoEmail = 'evaluator@reachinbox.ai';
    const demoName = 'ReachInbox Reviewer';
    const demoAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=ReachInbox`;

    const user = await prisma.user.upsert({
      where: { email: demoEmail },
      update: { name: demoName, avatar: demoAvatar },
      create: {
        email: demoEmail,
        name: demoName,
        avatar: demoAvatar,
      },
    });

    const senders = await prisma.sender.findMany();

    logger.info({ userId: user.id, email: user.email }, '🚀 One-Click Demo User logged in');

    res.status(200).json({
      status: 'success',
      user,
      senders,
    });
  } catch (error: any) {
    logger.error({ error: error.message }, '❌ Demo Login failed');
    res.status(500).json({ status: 'error', message: 'Failed to login demo user' });
  }
};
