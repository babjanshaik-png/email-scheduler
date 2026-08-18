import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

interface TestAccount {
  user: string;
  pass: string;
  smtp: { host: string; port: number; secure: boolean };
  web: string;
}

class EtherealEmailService {
  private testAccount: TestAccount | null = null;
  private transporter: nodemailer.Transporter | null = null;

  /**
   * Initializes or re-uses Ethereal SMTP fake email credentials.
   * Pure SMTP communication service with zero scheduling or rate-limiting logic.
   */
  public async initialize(): Promise<TestAccount> {
    if (this.testAccount && this.transporter) {
      return this.testAccount;
    }

    try {
      if (env.ETHEREAL_USER && env.ETHEREAL_PASS) {
        this.testAccount = {
          user: env.ETHEREAL_USER,
          pass: env.ETHEREAL_PASS,
          smtp: { host: 'smtp.ethereal.email', port: 587, secure: false },
          web: 'https://ethereal.email/messages',
        };
      } else {
        this.testAccount = await nodemailer.createTestAccount();
      }

      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: this.testAccount.user,
          pass: this.testAccount.pass,
        },
      });

      logger.info('📧 ============================================================== 📧');
      logger.info(`✨ Ethereal SMTP Account Configured: ${this.testAccount.user}`);
      logger.info(`🌐 Ethereal Webmail Inbox URL: https://ethereal.email/messages`);
      logger.info('📧 ============================================================== 📧');

      return this.testAccount;
    } catch (error) {
      logger.error({ error }, '❌ Failed to initialize Ethereal SMTP account');
      throw error;
    }
  }

  public async sendEmail(params: {
    from: string;
    to: string;
    subject: string;
    body: string;
  }): Promise<{ messageId: string; previewUrl: string | null }> {
    if (!this.transporter) {
      await this.initialize();
    }

    logger.debug(
      { from: params.from, to: params.to, subject: params.subject },
      '📤 Executing Ethereal SMTP sendEmail'
    );

    const info = await this.transporter!.sendMail({
      from: params.from,
      to: params.to,
      subject: params.subject,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 24px; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #4f46e5; margin-top: 0;">${params.subject}</h2>
          <div style="font-size: 16px; line-height: 1.6; white-space: pre-wrap;">${params.body}</div>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="font-size: 12px; color: #64748b;">
            Sent via <strong>ReachInbox Production Email Scheduler</strong> • Ethereal SMTP Fake Delivery
          </p>
        </div>
      `,
      text: params.body,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info) || null;

    logger.info(
      { messageId: info.messageId, previewUrl, recipient: params.to },
      '✅ Email successfully delivered to Ethereal SMTP!'
    );

    return {
      messageId: info.messageId,
      previewUrl: typeof previewUrl === 'string' ? previewUrl : null,
    };
  }

  public getTestAccountEmail(): string {
    return this.testAccount?.user || 'test@ethereal.email';
  }
}

export const etherealEmailService = new EtherealEmailService();
