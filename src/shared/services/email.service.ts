import nodemailer, { Transporter, SendMailOptions } from 'nodemailer';
import { config } from '../config';
import { logger } from '../utils/logger';
import { EmailError } from '../utils/errors';
import { readFileSync } from 'fs';
import { join } from 'path';
import handlebars from 'handlebars';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
import { randomUUID } from 'crypto';
import { readdirSync } from 'fs';
import { TextEncoding } from 'nodemailer/lib/mailer';

/**
 * Email template data
 */
export interface EmailTemplateData {
  [key: string]: any;
}

/**
 * Email attachment
 */
export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
  encoding?: string;
  cid?: string;
}

/**
 * Email options
 */
export interface EmailOptions {
  to: string | string[];
  from?: string;
  subject: string;
  template?: string;
  templateData?: EmailTemplateData;
  html?: string;
  text?: string;
  attachments?: EmailAttachment[];
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  inReplyTo?: string;
  references?: string[];
  priority?: 'high' | 'normal' | 'low';
  headers?: Record<string, string>;
  messageId?: string;
  date?: Date;
  encoding?: string;
  textEncoding?: string;
}

/**
 * Email template
 */
export interface EmailTemplate {
  name: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Email service configuration
 */
export interface EmailServiceConfig {
  transport: 'smtp' | 'sendmail' | 'ses' | 'mailgun';
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
    pool?: boolean;
    maxConnections?: number;
    maxMessages?: number;
    rateDelta?: number;
    rateLimit?: number;
  };
  from: {
    name: string;
    email: string;
  };
  templates?: {
    path: string;
    engine: 'handlebars' | 'ejs' | 'pug';
  };
}

/**
 * Email sending result
 */
export interface EmailResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
  pending: string[];
  response: string;
  envelope: {
    from: string;
    to: string[];
  };
}

/**
 * Email queue item
 */
export interface EmailQueueItem {
  id: string;
  options: EmailOptions;
  attempts: number;
  maxAttempts: number;
  priority: number;
  scheduledFor?: Date;
  sentAt?: Date;
  error?: string;
}

/**
 * Email service
 */
export class EmailService {
  private transporter!: Transporter;
  private templates = new Map<string, handlebars.TemplateDelegate>();
  private templateCache = new Map<string, EmailTemplate>();
  private queue: EmailQueueItem[] = [];
  private isProcessing = false;
  private readonly config: EmailServiceConfig;

  constructor() {
    this.config = config.email;
    this.initializeTransporter();
    this.initializeTemplates();
    this.registerHelpers();
  }

  /**
   * Initialize email transporter
   */
  private initializeTransporter(): void {
    try {
      const transportOptions: SMTPTransport.Options = this.config.smtp!;


      // Initialize transporter with SMTP transport
      this.transporter = nodemailer.createTransport(transportOptions);

    } catch (error: any) {
      logger.error('Failed to initialize email transporter', { error: error.message });
      throw new EmailError(`Failed to initialize email transporter: ${error.message}`);
    }
  }

  /**
   * Initialize email templates
   */
  private initializeTemplates(): void {
    if (!this.config.templates) {
      return;
    }

    try {
      // Load built-in templates
      this.loadBuiltinTemplates();

      // Load custom templates if path provided
      if (this.config.templates.path) {
        this.loadCustomTemplates(this.config.templates.path);
      }

      logger.info('Email templates initialized', { count: this.templates.size });
    } catch (error: any) {
      logger.error('Failed to initialize email templates', { error: error.message });
      throw new EmailError(`Failed to initialize email templates: ${error.message}`);
    }
  }

  /**
   * Load built-in email templates
   */
  private loadBuiltinTemplates(): void {
    const builtinTemplates: EmailTemplate[] = [
      {
        name: 'welcome',
        subject: 'Welcome to AI Planner!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333;">Welcome to AI Planner!</h1>
            <p>Hi {{name}},</p>
            <p>Welcome to AI Planner! We're excited to have you on board.</p>
            <p>Get started by creating your first planner and let our AI help you stay organized.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="{{appUrl}}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
                Get Started
              </a>
            </div>
            <p>If you have any questions, feel free to reach out to our support team.</p>
            <p>Best regards,<br>The AI Planner Team</p>
          </div>
        `,
        text: `
          Welcome to AI Planner!

          Hi {{name}},

          Welcome to AI Planner! We're excited to have you on board.

          Get started by creating your first planner and let our AI help you stay organized.

          Visit: {{appUrl}}

          If you have any questions, feel free to reach out to our support team.

          Best regards,
          The AI Planner Team
        `,
      },
      {
        name: 'password-reset',
        subject: 'Reset your password',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333;">Reset your password</h1>
            <p>Hi {{name}},</p>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="{{resetUrl}}" style="background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
                Reset Password
              </a>
            </div>
            <p>If you didn't request this password reset, you can safely ignore this email.</p>
            <p>This link will expire in {{expiryHours}} hours.</p>
            <p>Best regards,<br>The AI Planner Team</p>
          </div>
        `,
        text: `
          Reset your password

          Hi {{name}},

          We received a request to reset your password. Click the link below to create a new password:

          {{resetUrl}}

          If you didn't request this password reset, you can safely ignore this email.

          This link will expire in {{expiryHours}} hours.

          Best regards,
          The AI Planner Team
        `,
      },
      {
        name: 'email-verification',
        subject: 'Verify your email address',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333;">Verify your email address</h1>
            <p>Hi {{name}},</p>
            <p>Thanks for signing up! Please verify your email address by clicking the button below:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="{{verificationUrl}}" style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
                Verify Email
              </a>
            </div>
            <p>If you didn't create an account, you can safely ignore this email.</p>
            <p>This link will expire in {{expiryHours}} hours.</p>
            <p>Best regards,<br>The AI Planner Team</p>
          </div>
        `,
        text: `
          Verify your email address

          Hi {{name}},

          Thanks for signing up! Please verify your email address by clicking the link below:

          {{verificationUrl}}

          If you didn't create an account, you can safely ignore this email.

          This link will expire in {{expiryHours}} hours.

          Best regards,
          The AI Planner Team
        `,
      },
      {
        name: 'two-factor-auth',
        subject: 'Your verification code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333;">Your verification code</h1>
            <p>Hi {{name}},</p>
            <p>Your verification code is:</p>
            <div style="text-align: center; margin: 30px 0;">
              <div style="background-color: #f8f9fa; padding: 20px; border-radius: 4px; font-size: 24px; font-weight: bold; letter-spacing: 4px;">
                {{code}}
              </div>
            </div>
            <p>This code will expire in {{expiryMinutes}} minutes.</p>
            <p>If you didn't request this code, please ignore this email.</p>
            <p>Best regards,<br>The AI Planner Team</p>
          </div>
        `,
        text: `
          Your verification code

          Hi {{name}},

          Your verification code is: {{code}}

          This code will expire in {{expiryMinutes}} minutes.

          If you didn't request this code, please ignore this email.

          Best regards,
          The AI Planner Team
        `,
      },
      {
        name: 'planner-shared',
        subject: '{{sharerName}} shared a planner with you',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333;">Planner shared with you</h1>
            <p>Hi {{recipientName}},</p>
            <p>{{sharerName}} has shared the planner "{{plannerTitle}}" with you.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="{{plannerUrl}}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
                View Planner
              </a>
            </div>
            <p>{{message}}</p>
            <p>Best regards,<br>The AI Planner Team</p>
          </div>
        `,
        text: `
          Planner shared with you

          Hi {{recipientName}},

          {{sharerName}} has shared the planner "{{plannerTitle}}" with you.

          View it here: {{plannerUrl}}

          {{message}}

          Best regards,
          The AI Planner Team
        `,
      },
      {
        name: 'task-assigned',
        subject: 'New task assigned to you',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333;">New task assigned to you</h1>
            <p>Hi {{assigneeName}},</p>
            <p>{{assignerName}} has assigned you a new task:</p>
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 4px; margin: 20px 0;">
              <h3>{{taskTitle}}</h3>
              <p>{{taskDescription}}</p>
              <p><strong>Due date:</strong> {{dueDate}}</p>
              <p><strong>Priority:</strong> {{priority}}</p>
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="{{taskUrl}}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
                View Task
              </a>
            </div>
            <p>Best regards,<br>The AI Planner Team</p>
          </div>
        `,
        text: `
          New task assigned to you

          Hi {{assigneeName}},

          {{assignerName}} has assigned you a new task:

          {{taskTitle}}
          {{taskDescription}}

          Due date: {{dueDate}}
          Priority: {{priority}}

          View it here: {{taskUrl}}

          Best regards,
          The AI Planner Team
        `,
      },
      {
        name: 'daily-summary',
        subject: 'Your daily summary - {{date}}',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333;">Your daily summary</h1>
            <p>Hi {{name}},</p>
            <p>Here's your summary for {{date}}:</p>
            
            <div style="margin: 20px 0;">
              <h3>Tasks completed: {{completedTasks}}</h3>
              <h3>Tasks remaining: {{remainingTasks}}</h3>
              <h3>Upcoming events: {{upcomingEvents}}</h3>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="{{appUrl}}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
                View Full Summary
              </a>
            </div>
            
            <p>Keep up the great work!</p>
            <p>Best regards,<br>The AI Planner Team</p>
          </div>
        `,
        text: `
          Your daily summary - {{date}}

          Hi {{name}},

          Here's your summary for {{date}}:

          Tasks completed: {{completedTasks}}
          Tasks remaining: {{remainingTasks}}
          Upcoming events: {{upcomingEvents}}

          View full summary: {{appUrl}}

          Keep up the great work!

          Best regards,
          The AI Planner Team
        `,
      },
    ];

    // Register built-in templates
    for (const template of builtinTemplates) {
      this.registerTemplate(template.name, template);
    }
  }

  /**
   * Load custom templates
   */
  private loadCustomTemplates(templatesPath: string): void {
    try {
      const templateFiles = readdirSync(templatesPath);

      for (const file of templateFiles) {
        if (file.endsWith('.hbs')) {
          const templateName = file.replace('.hbs', '');
          const templateContent = readFileSync(join(templatesPath, file), 'utf8');
          const template = handlebars.compile(templateContent);
          this.templates.set(templateName, template);
        }
      }

      logger.info('Custom templates loaded', { count: templateFiles.length });
    } catch (error: any) {
      logger.error('Failed to load custom templates', { error: error.message });
    }
  }

  /**
   * Register Handlebars helpers
   */
  private registerHelpers(): void {
    handlebars.registerHelper('formatDate', (date: Date, format: string) => {
      return new Date(date).toLocaleDateString();
    });

    handlebars.registerHelper('formatTime', (date: Date) => {
      return new Date(date).toLocaleTimeString();
    });

    handlebars.registerHelper('uppercase', (str: string) => {
      return str.toUpperCase();
    });

    handlebars.registerHelper('lowercase', (str: string) => {
      return str.toLowerCase();
    });

    handlebars.registerHelper('capitalize', (str: string) => {
      return str.charAt(0).toUpperCase() + str.slice(1);
    });
  }

  /**
   * Register email template
   */
  registerTemplate(name: string, template: EmailTemplate): void {
    try {
      this.templateCache.set(name, template);

      if (template.html) {
        const compiledHtml = handlebars.compile(template.html);
        this.templates.set(`${name}:html`, compiledHtml);
      }

      if (template.text) {
        const compiledText = handlebars.compile(template.text);
        this.templates.set(`${name}:text`, compiledText);
      }

      logger.debug('Template registered', { name });
    } catch (error: any) {
      logger.error('Failed to register template', { error: error.message, name });
      throw new EmailError(`Failed to register template: ${error.message}`);
    }
  }

  /**
   * Send email
   */
  async sendEmail(options: EmailOptions): Promise<EmailResult> {
    try {
      // Validate options
      this.validateEmailOptions(options);

      // Prepare email content
      const emailContent = await this.prepareEmailContent(options);

      // Create mail options
      const mailOptions: SendMailOptions = {
        from: options.from || `"${this.config.from.name}" <${this.config.from.email}>`,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        attachments: options.attachments,
        cc: options.cc ? (Array.isArray(options.cc) ? options.cc.join(', ') : options.cc) : undefined,
        bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc) : undefined,
        replyTo: options.replyTo,
        inReplyTo: options.inReplyTo,
        references: options.references,
        priority: options.priority,
        headers: options.headers,
        messageId: options.messageId,
        date: options.date,
        encoding: options.encoding,
        textEncoding: options.textEncoding as TextEncoding | undefined,
      };

      logger.info('Sending email', {
        to: options.to,
        subject: emailContent.subject,
        template: options.template,
      });

      // Send email
      const result = await this.transporter.sendMail(mailOptions);

      logger.info('Email sent successfully', {
        messageId: result.messageId,
        to: options.to,
        subject: emailContent.subject,
      });

      return {
        messageId: result.messageId,
        accepted: result.accepted || [],
        rejected: result.rejected || [],
        pending: result.pending || [],
        response: result.response,
        envelope: result.envelope,
      };

    } catch (error: any) {
      logger.error('Failed to send email', {
        error: error.message,
        to: options.to,
        subject: options.subject,
      });

      throw new EmailError(`Failed to send email: ${error.message}`);
    }
  }

  /**
   * Validate email options
   */
  private validateEmailOptions(options: EmailOptions): void {
    if (!options.to) {
      throw new EmailError('Recipient email address is required');
    }

    if (!options.subject) {
      throw new EmailError('Email subject is required');
    }

    if (!options.template && !options.html && !options.text) {
      throw new EmailError('Email content is required (template, html, or text)');
    }

    // Validate email addresses
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const validateEmail = (email: string) => {
      if (!emailRegex.test(email)) {
        throw new EmailError(`Invalid email address: ${email}`);
      }
    };

    if (Array.isArray(options.to)) {
      options.to.forEach(validateEmail);
    } else {
      validateEmail(options.to);
    }

    if (options.cc) {
      if (Array.isArray(options.cc)) {
        options.cc.forEach(validateEmail);
      } else {
        validateEmail(options.cc);
      }
    }

    if (options.bcc) {
      if (Array.isArray(options.bcc)) {
        options.bcc.forEach(validateEmail);
      } else {
        validateEmail(options.bcc);
      }
    }
  }

  /**
   * Prepare email content
   */
  private async prepareEmailContent(options: EmailOptions): Promise<{
    subject: string;
    html?: string;
    text?: string;
  }> {
    if (options.template) {
      return this.renderTemplate(options.template, options.templateData || {});
    }

    return {
      subject: options.subject,
      html: options.html,
      text: options.text,
    };
  }

  /**
   * Render email template
   */
  private renderTemplate(templateName: string, data: EmailTemplateData): {
    subject: string;
    html?: string;
    text?: string;
  } {
    const template = this.templateCache.get(templateName);

    if (!template) {
      throw new EmailError(`Template not found: ${templateName}`);
    }

    try {
      const subject = handlebars.compile(template.subject)(data);

      let html: string | undefined;
      let text: string | undefined;

      const htmlTemplate = this.templates.get(`${templateName}:html`);
      if (htmlTemplate) {
        html = htmlTemplate(data);
      }

      const textTemplate = this.templates.get(`${templateName}:text`);
      if (textTemplate) {
        text = textTemplate(data);
      }

      return { subject, html, text };
    } catch (error: any) {
      logger.error('Template rendering failed', { error: error.message, templateName });
      throw new EmailError(`Template rendering failed: ${error.message}`);
    }
  }

  /**
   * Send templated email
   */
  async sendTemplate(
    templateName: string,
    to: string | string[],
    templateData: EmailTemplateData,
    options: Partial<EmailOptions> = {},
  ): Promise<EmailResult> {
    // template always provides the subject
    const { subject, html, text } = this.renderTemplate(templateName, templateData);

    return this.sendEmail({
      ...options,          // extras (cc, bcc, attachments …)
      to,
      subject,             // guaranteed to exist
      template: templateName,
      templateData,
      html: html ?? options.html,
      text: text ?? options.text,
    });
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(to: string, name: string, appUrl: string): Promise<EmailResult> {
    return this.sendTemplate('welcome', to, { name, appUrl });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(
    to: string,
    name: string,
    resetUrl: string,
    expiryHours: number = 1
  ): Promise<EmailResult> {
    return this.sendTemplate('password-reset', to, {
      name,
      resetUrl,
      expiryHours,
    });
  }

  /**
   * Send email verification email
   */
  async sendEmailVerificationEmail(
    to: string,
    name: string,
    verificationUrl: string,
    expiryHours: number = 24
  ): Promise<EmailResult> {
    return this.sendTemplate('email-verification', to, {
      name,
      verificationUrl,
      expiryHours,
    });
  }

  /**
   * Send two-factor authentication email
   */
  async sendTwoFactorAuthEmail(
    to: string,
    name: string,
    code: string,
    expiryMinutes: number = 10
  ): Promise<EmailResult> {
    return this.sendTemplate('two-factor-auth', to, {
      name,
      code,
      expiryMinutes,
    });
  }

  /**
   * Send planner shared email
   */
  async sendPlannerSharedEmail(
    to: string,
    recipientName: string,
    sharerName: string,
    plannerTitle: string,
    plannerUrl: string,
    message: string = ''
  ): Promise<EmailResult> {
    return this.sendTemplate('planner-shared', to, {
      recipientName,
      sharerName,
      plannerTitle,
      plannerUrl,
      message,
    });
  }

  /**
   * Send task assigned email
   */
  async sendTaskAssignedEmail(
    to: string,
    assigneeName: string,
    assignerName: string,
    taskTitle: string,
    taskDescription: string,
    dueDate: string,
    priority: string,
    taskUrl: string
  ): Promise<EmailResult> {
    return this.sendTemplate('task-assigned', to, {
      assigneeName,
      assignerName,
      taskTitle,
      taskDescription,
      dueDate,
      priority,
      taskUrl,
    });
  }

  /**
   * Send daily summary email
   */
  async sendDailySummaryEmail(
    to: string,
    name: string,
    date: string,
    completedTasks: number,
    remainingTasks: number,
    upcomingEvents: number,
    appUrl: string
  ): Promise<EmailResult> {
    return this.sendTemplate('daily-summary', to, {
      name,
      date,
      completedTasks,
      remainingTasks,
      upcomingEvents,
      appUrl,
    });
  }

  /**
   * Queue email for later sending
   */
  queueEmail(options: EmailOptions, priority: number = 0): string {
    const id = randomUUID();

    const queueItem: EmailQueueItem = {
      id,
      options,
      attempts: 0,
      maxAttempts: 3,
      priority,
    };

    // Insert by priority
    const insertIndex = this.queue.findIndex(item => item.priority < priority);
    if (insertIndex === -1) {
      this.queue.push(queueItem);
    } else {
      this.queue.splice(insertIndex, 0, queueItem);
    }

    logger.info('Email queued', { id, to: options.to, priority });

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }

    return id;
  }

  /**
   * Process email queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift()!;

      try {
        await this.sendEmail(item.options);
        item.sentAt = new Date();
        logger.info('Queued email sent successfully', { id: item.id });
      } catch (error: any) {
        item.attempts++;
        item.error = error.message;

        if (item.attempts < item.maxAttempts) {
          // Re-queue for retry with exponential backoff
          const delay = Math.pow(2, item.attempts) * 1000; // 2s, 4s, 8s

          setTimeout(() => {
            this.queue.push(item);
            logger.warn('Email re-queued for retry', {
              id: item.id,
              attempts: item.attempts,
              nextRetryIn: delay
            });
          }, delay);
        } else {
          logger.error('Email failed after max attempts', {
            id: item.id,
            attempts: item.attempts,
            error: error.message
          });
        }
      }
    }

    this.isProcessing = false;
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    queued: number;
    processing: boolean;
  } {
    return {
      queued: this.queue.length,
      processing: this.isProcessing,
    };
  }

  /**
   * Clear email queue
   */
  clearQueue(): void {
    this.queue = [];
    logger.info('Email queue cleared');
  }

  /**
   * Send bulk emails
   */
  async sendBulkEmails(
    recipients: Array<{
      to: string;
      templateData?: EmailTemplateData;
    }>,
    templateName: string,
    extraOptions: Partial<EmailOptions> = {}
  ): Promise<EmailResult[]> {
    const results: EmailResult[] = [];

    for (const recipient of recipients) {
      try {
        const result = await this.sendTemplate(
          templateName,
          recipient.to,
          recipient.templateData || {},
          extraOptions
        );
        results.push(result);
      } catch (error: any) {
        logger.error('Bulk email failed for recipient', {
          error: error.message,
          to: recipient.to,
          template: templateName,
        });

        results.push({
          messageId: '',
          accepted: [],
          rejected: [recipient.to],
          pending: [],
          response: error.message,
          envelope: { from: this.config.from.email, to: [recipient.to] },
        });
      }
    }

    return results;
  }

  /**
   * Create email campaign
   */
  createCampaign(
    name: string,
    templateName: string,
    recipients: string[],
    templateData: EmailTemplateData = {}
  ): {
    name: string;
    id: string;
    recipients: string[];
    templateName: string;
    templateData: EmailTemplateData;
    send: () => Promise<EmailResult[]>;
  } {
    const campaignId = randomUUID();

    return {
      name,
      id: campaignId,
      recipients,
      templateName,
      templateData,
      send: async () => {
        logger.info('Starting email campaign', {
          campaignId,
          name,
          recipients: recipients.length
        });

        const results = await this.sendBulkEmails(
          recipients.map(to => ({ to, templateData })),
          templateName
        );

        logger.info('Email campaign completed', {
          campaignId,
          name,
          results: results.length
        });

        return results;
      },
    };
  }

  /**
   * Get email statistics
   */
  async getStats(): Promise<{
    sent: number;
    queued: number;
    failed: number;
    templates: number;
  }> {
    return {
      sent: 0, // Would need to track this in production
      queued: this.queue.length,
      failed: 0, // Would need to track this in production
      templates: this.templates.size,
    };
  }

  /**
   * Test email configuration
   */
  async testConfiguration(): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    try {
      const result = await this.transporter.verify();
      return {
        success: result,
        message: result ? 'Email configuration is valid' : 'Email configuration is invalid',
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Email configuration test failed',
        details: error.message,
      };
    }
  }

  /**
   * Create email preview
   */
  async createPreview(templateName: string, templateData: EmailTemplateData): Promise<{
    subject: string;
    html?: string;
    text?: string;
  }> {
    return this.renderTemplate(templateName, templateData);
  }

  /**
   * Get available templates
   */
  getAvailableTemplates(): string[] {
    return Array.from(this.templateCache.keys());
  }

  /**
   * Get template details
   */
  getTemplateDetails(templateName: string): EmailTemplate | null {
    return this.templateCache.get(templateName) || null;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    message: string;
    details?: any;
  }> {
    try {
      const result = await this.testConfiguration();
      return {
        status: result.success ? 'healthy' : 'unhealthy',
        message: result.message,
        details: result.details,
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        message: 'Email service health check failed',
        details: error.message,
      };
    }
  }
}

/**
 * Email template builder
 */
export class EmailTemplateBuilder {
  private template: Partial<EmailTemplate> = {};

  /**
   * Set template name
   */
  name(name: string): EmailTemplateBuilder {
    this.template.name = name;
    return this;
  }

  /**
   * Set subject
   */
  subject(subject: string): EmailTemplateBuilder {
    this.template.subject = subject;
    return this;
  }

  /**
   * Set HTML content
   */
  html(html: string): EmailTemplateBuilder {
    this.template.html = html;
    return this;
  }

  /**
   * Set text content
   */
  text(text: string): EmailTemplateBuilder {
    this.template.text = text;
    return this;
  }

  /**
   * Build template
   */
  build(): EmailTemplate {
    if (!this.template.name || !this.template.subject) {
      throw new Error('Template name and subject are required');
    }

    return this.template as EmailTemplate;
  }

  /**
   * Create welcome email template
   */
  static welcome(): EmailTemplateBuilder {
    return new EmailTemplateBuilder()
      .name('welcome')
      .subject('Welcome to AI Planner!')
      .html(`
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1>Welcome to AI Planner!</h1>
          <p>Hi {{name}},</p>
          <p>Welcome to AI Planner! We're excited to have you on board.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="{{appUrl}}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
              Get Started
            </a>
          </div>
        </div>
      `);
  }

  /**
   * Create password reset email template
   */
  static passwordReset(): EmailTemplateBuilder {
    return new EmailTemplateBuilder()
      .name('password-reset')
      .subject('Reset your password')
      .html(`
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1>Reset your password</h1>
          <p>Hi {{name}},</p>
          <p>Click the button below to reset your password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="{{resetUrl}}" style="background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
              Reset Password
            </a>
          </div>
        </div>
      `);
  }
}