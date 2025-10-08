import { config } from './index.js';

export interface EmailConfig {
    smtp: {
        host: string;
        port: number;
        secure: boolean;
        auth: {
            user: string;
            pass: string;
        };
        tls: {
            rejectUnauthorized: boolean;
        };
        connectionTimeout: number;
        greetingTimeout: number;
        socketTimeout: number;
    };
    from: {
        email: string;
        name: string;
    };
    templates: {
        welcome: string;
        emailVerification: string;
        passwordReset: string;
        passwordChanged: string;
        accountLocked: string;
        plannerShared: string;
        collaborationInvite: string;
        exportReady: string;
    };
    settings: {
        maxRetries: number;
        retryDelay: number;
        pool: boolean;
        maxConnections: number;
        maxMessages: number;
        rateDelta: number;
        rateLimit: number;
    };
}

export const emailConfig: EmailConfig = {
    smtp: {
        host: config.email.smtp.host,
        port: config.email.smtp.port,
        secure: config.email.smtp.port === 465,
        auth: {
            user: config.email.smtp.user,
            pass: config.email.smtp.pass,
        },
        tls: {
            rejectUnauthorized: config.app.env === 'production',
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000,
    },
    from: {
        email: config.email.from.email,
        name: config.email.from.name,
    },
    templates: {
        welcome: 'welcome',
        emailVerification: 'email-verification',
        passwordReset: 'password-reset',
        passwordChanged: 'password-changed',
        accountLocked: 'account-locked',
        plannerShared: 'planner-shared',
        collaborationInvite: 'collaboration-invite',
        exportReady: 'export-ready',
    },
    settings: {
        maxRetries: 3,
        retryDelay: 5000,
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        rateDelta: 1000,
        rateLimit: 10,
    },
};

// Email template configurations
export const emailTemplates = {
    welcome: {
        subject: 'Welcome to AI Planner! 🎉',
        template: 'welcome',
        variables: ['userName', 'appUrl', 'supportEmail'],
    },
    emailVerification: {
        subject: 'Verify your email address',
        template: 'email-verification',
        variables: ['userName', 'verificationUrl', 'expiryTime'],
    },
    passwordReset: {
        subject: 'Reset your password',
        template: 'password-reset',
        variables: ['userName', 'resetUrl', 'expiryTime'],
    },
    passwordChanged: {
        subject: 'Password changed successfully',
        template: 'password-changed',
        variables: ['userName', 'changeTime', 'supportEmail'],
    },
    accountLocked: {
        subject: 'Account locked for security',
        template: 'account-locked',
        variables: ['userName', 'lockoutTime', 'unlockTime', 'supportEmail'],
    },
    plannerShared: {
        subject: 'New planner shared with you',
        template: 'planner-shared',
        variables: ['recipientName', 'senderName', 'plannerTitle', 'plannerUrl'],
    },
    collaborationInvite: {
        subject: 'Collaboration invitation',
        template: 'collaboration-invite',
        variables: ['recipientName', 'senderName', 'plannerTitle', 'acceptUrl', 'declineUrl'],
    },
    exportReady: {
        subject: 'Your export is ready',
        template: 'export-ready',
        variables: ['userName', 'exportType', 'downloadUrl', 'expiryTime'],
    },
};

// Email validation patterns
export const emailPatterns = {
    validEmail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    disposableDomains: [
        'tempmail.com',
        '10minutemail.com',
        'guerrillamail.com',
        'mailinator.com',
        'throwaway.email',
        'yopmail.com',
    ],
    allowedDomains: [], // Empty means all domains allowed
};

// Email queue settings
export const emailQueueConfig = {
    name: 'email-queue',
    attempts: 3,
    backoff: {
        type: 'exponential',
        delay: 2000,
    },
    removeOnComplete: true,
    removeOnFail: false,
    delay: 0,
    priority: 1,
};

export default emailConfig;