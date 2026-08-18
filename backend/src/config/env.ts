import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('5000').transform((val) => parseInt(val, 10)),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_HOST: z.string().default('127.0.0.1'),
  REDIS_PORT: z.string().default('6379').transform((val) => parseInt(val, 10)),
  REDIS_PASSWORD: z.string().optional(),
  WORKER_CONCURRENCY: z.string().default('5').transform((val) => parseInt(val, 10)),
  MIN_DELAY_BETWEEN_EMAILS_MS: z.string().default('2000').transform((val) => parseInt(val, 10)),
  MAX_EMAILS_PER_HOUR_PER_SENDER: z.string().default('10').transform((val) => parseInt(val, 10)),
  GOOGLE_CLIENT_ID: z.string().optional().default('demo-client-id'),
  GOOGLE_CLIENT_SECRET: z.string().optional().default('demo-client-secret'),
  ETHEREAL_USER: z.string().optional().default('roselyn.boyer15@ethereal.email'),
  ETHEREAL_PASS: z.string().optional().default('gJZfqmaqMZ6nHyyAYv'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid environment variables detected at startup:');
    console.error(JSON.stringify(result.error.format(), null, 2));
    process.exit(1);
  }
  return result.data;
};

export const env = parseEnv();
