export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

export interface Sender {
  id: string;
  email: string;
  name: string;
}

export type EmailStatus =
  | 'PENDING'
  | 'SCHEDULED'
  | 'PROCESSING'
  | 'SENT'
  | 'FAILED'
  | 'CANCELLED'
  | 'RESCHEDULED_RATE_LIMIT';

export interface ScheduledEmail {
  id: string;
  jobId: string;
  userId: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledAt: string;
  sentAt?: string | null;
  status: EmailStatus;
  errorMessage?: string | null;
  etherealUrl?: string | null;
  attemptCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  status: string;
  data: T[];
  pagination: PaginationMeta;
}

export interface EmailStats {
  scheduled: number;
  sent: number;
  failed: number;
  total: number;
  queueDelayed: number;
  queueActive: number;
  etherealAccount: string;
  config: {
    concurrency: number;
    minDelayMs: number;
    maxHourlyLimit: number;
  };
}
