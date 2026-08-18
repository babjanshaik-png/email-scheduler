import { User, Sender, ScheduledEmail, PaginatedResponse, EmailStats } from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

class ApiClient {
  private async fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const res = await fetch(url, {
      ...options,
      headers,
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'API request failed');
    }

    return json;
  }

  // Auth Endpoints
  public async googleLogin(email: string, name: string, avatar?: string): Promise<{ user: User; senders: Sender[] }> {
    return this.fetch<{ user: User; senders: Sender[] }>('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ email, name, avatar }),
    });
  }

  public async demoLogin(): Promise<{ user: User; senders: Sender[] }> {
    return this.fetch<{ user: User; senders: Sender[] }>('/api/auth/demo', {
      method: 'POST',
    });
  }

  // Scheduler Endpoints
  public async scheduleEmails(payload: {
    userId: string;
    senderEmail: string;
    recipients: string[];
    subject: string;
    body: string;
    scheduledAt: string;
    delayBetweenEmailsMs?: number;
  }): Promise<{ message: string; scheduledCount: number }> {
    return this.fetch<{ message: string; scheduledCount: number }>('/api/emails/schedule', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async getScheduledEmails(params: {
    page?: number;
    limit?: number;
    senderEmail?: string;
    status?: string;
  } = {}): Promise<PaginatedResponse<ScheduledEmail>> {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.senderEmail) query.set('senderEmail', params.senderEmail);
    if (params.status) query.set('status', params.status);

    return this.fetch<PaginatedResponse<ScheduledEmail>>(`/api/emails/scheduled?${query.toString()}`);
  }

  public async getSentEmails(params: {
    page?: number;
    limit?: number;
    senderEmail?: string;
    status?: string;
  } = {}): Promise<PaginatedResponse<ScheduledEmail>> {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.senderEmail) query.set('senderEmail', params.senderEmail);
    if (params.status) query.set('status', params.status);

    return this.fetch<PaginatedResponse<ScheduledEmail>>(`/api/emails/sent?${query.toString()}`);
  }

  public async cancelEmail(id: string): Promise<{ message: string }> {
    return this.fetch<{ message: string }>(`/api/emails/${id}`, {
      method: 'DELETE',
    });
  }

  public async getStats(): Promise<{ stats: EmailStats }> {
    return this.fetch<{ stats: EmailStats }>('/api/emails/stats');
  }

  public async getHealth(): Promise<any> {
    return this.fetch<any>('/health');
  }
}

export const api = new ApiClient();
