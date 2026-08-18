import { Router } from 'express';
import { z } from 'zod';
import { validateRequest } from '../middleware/validate.js';
import {
  scheduleEmails,
  getScheduledEmails,
  getSentEmails,
  cancelScheduledEmail,
  getEmailStats,
} from '../controllers/emailController.js';

const router = Router();

const scheduleEmailsSchema = {
  body: z.object({
    userId: z.string().min(1, 'userId is required'),
    senderEmail: z.string().email('Invalid senderEmail format'),
    recipients: z.array(z.string().email('Each recipient must be a valid email')).min(1, 'At least one recipient is required'),
    subject: z.string().min(1, 'Subject is required'),
    body: z.string().min(1, 'Body is required'),
    scheduledAt: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: 'scheduledAt must be a valid ISO date string',
    }),
    delayBetweenEmailsMs: z.number().optional(),
  }),
};

const cancelEmailSchema = {
  params: z.object({
    id: z.string().min(1, 'Email id is required'),
  }),
};

router.post('/schedule', validateRequest(scheduleEmailsSchema), scheduleEmails);
router.get('/scheduled', getScheduledEmails);
router.get('/sent', getSentEmails);
router.get('/stats', getEmailStats);
router.delete('/:id', validateRequest(cancelEmailSchema), cancelScheduledEmail);

export default router;
