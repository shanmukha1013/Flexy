// lib/email.js
// Email delivery behind a small interface so a missing provider key never
// crashes the process and callers can tell "not configured" apart from
// "provider rejected the message".

const { Resend } = require('resend');

const SEND_TIMEOUT_MS = 10000;

class EmailNotConfiguredError extends Error {
    constructor() {
        super('Email delivery is not configured');
        this.name = 'EmailNotConfiguredError';
    }
}

class EmailDeliveryError extends Error {
    constructor(message, { providerError, cause } = {}) {
        super(message, cause ? { cause } : undefined);
        this.name = 'EmailDeliveryError';
        this.providerError = providerError;
    }
}

function maskEmail(email) {
    const [local = '', domain = ''] = String(email).split('@');
    return `${local.slice(0, 2)}***@${domain}`;
}

function withTimeout(promise, ms) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Email provider did not respond within ${ms}ms`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function otpEmailContent(code, ttlMinutes) {
    return {
        subject: 'Your Flexy verification code',
        text: `Your Flexy verification code is ${code}. It expires in ${ttlMinutes} minutes. If you did not request this code, you can ignore this email.`,
        html: `Welcome to Flexy.<br><br>Your verification code is:<br><br><strong style="font-size:20px;letter-spacing:4px">${code}</strong><br><br>This code expires in ${ttlMinutes} minutes.<br><br>If you did not request this code, you can ignore this email.`
    };
}

function createEmailService(emailConfig, { logger = console, ResendClient = Resend, timeoutMs = SEND_TIMEOUT_MS } = {}) {
    const { transport, resendApiKey, from } = emailConfig;
    const client = transport === 'resend' && resendApiKey ? new ResendClient(resendApiKey) : null;

    return {
        isConfigured() {
            return transport === 'console' || client !== null;
        },

        describe() {
            if (transport === 'console') return 'console (development only: codes are printed to this log)';
            return client ? `resend (from ${from})` : 'not configured (set RESEND_API_KEY)';
        },

        // Resolves once the provider has *accepted* the message. Acceptance is
        // not proof of inbox delivery; bounces are only visible in Resend.
        async sendOtp(to, code, ttlMinutes) {
            const content = otpEmailContent(code, ttlMinutes);

            if (transport === 'console') {
                logger.log(`[email:console] Verification code for ${to}: ${code} (expires in ${ttlMinutes} min)`);
                return { id: 'console', provider: 'console' };
            }
            if (!client) throw new EmailNotConfiguredError();

            let result;
            try {
                result = await withTimeout(client.emails.send({ from, to, ...content }), timeoutMs);
            } catch (err) {
                throw new EmailDeliveryError('Email provider request failed', { cause: err });
            }

            if (result && result.error) {
                throw new EmailDeliveryError(result.error.message || 'Email provider rejected the message', {
                    providerError: { name: result.error.name, statusCode: result.error.statusCode }
                });
            }
            if (!result || !result.data || !result.data.id) {
                throw new EmailDeliveryError('Email provider returned no message id');
            }
            return { id: result.data.id, provider: 'resend' };
        }
    };
}

module.exports = {
    createEmailService,
    EmailNotConfiguredError,
    EmailDeliveryError,
    maskEmail
};
