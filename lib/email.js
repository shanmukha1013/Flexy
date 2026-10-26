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
    constructor(message, { providerError, cause, timedOut = false } = {}) {
        super(message, cause ? { cause } : undefined);
        this.name = 'EmailDeliveryError';
        this.providerError = providerError;
        this.timedOut = timedOut;
        // Resend answers 429 when the account's sending rate or quota is exceeded.
        this.rateLimited = Boolean(providerError && providerError.statusCode === 429);
    }
}

function maskEmail(email) {
    const [local = '', domain = ''] = String(email).split('@');
    return `${local.slice(0, 2)}***@${domain}`;
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// Table-based layout with inline styles: the only markup that renders
// consistently across Gmail, Outlook and Apple Mail, on phones and desktops.
function otpEmailContent(code, ttlMinutes) {
    const safeCode = escapeHtml(code);
    const safeTtl = escapeHtml(ttlMinutes);
    const minutes = `${safeTtl} minute${String(ttlMinutes) === '1' ? '' : 's'}`;
    const font = "font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;";

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>Your Flexy verification code</title>
</head>
<body style="margin:0;padding:0;background-color:#F4F1E8;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#F4F1E8;">Your Flexy sign-in code expires in ${minutes}.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F4F1E8;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background-color:#FFFFFF;border:1px solid #E4DECF;border-radius:16px;">
        <tr>
          <td align="center" style="padding:32px 24px 4px;font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:bold;letter-spacing:6px;color:#4A5D23;">FLEXY</td>
        </tr>
        <tr>
          <td align="center" style="padding:0 24px;${font}font-size:13px;color:#8A856F;">Every Item Finds Its Value</td>
        </tr>
        <tr>
          <td style="padding:28px 32px 8px;${font}font-size:16px;line-height:24px;color:#2B2D2F;">Use this code to sign in to Flexy:</td>
        </tr>
        <tr>
          <td align="center" style="padding:8px 24px;">
            <div style="display:inline-block;padding:14px 22px;background-color:#F4F1E8;border:1px solid #E4DECF;border-radius:12px;font-family:'Courier New',Courier,monospace;font-size:34px;font-weight:bold;letter-spacing:10px;color:#4A5D23;">${safeCode}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px 0;${font}font-size:14px;line-height:22px;color:#4F4C44;">This code expires in <strong>${minutes}</strong> and works only once.</td>
        </tr>
        <tr>
          <td style="padding:12px 32px 0;${font}font-size:14px;line-height:22px;color:#4F4C44;"><strong>Do not share this code with anyone.</strong> Flexy will never ask you for it by phone, message or email.</td>
        </tr>
        <tr>
          <td style="padding:24px 32px 32px;${font}font-size:12px;line-height:18px;color:#8A856F;">If you did not try to sign in, you can ignore this email. Nobody can access your account without this code.</td>
        </tr>
      </table>
      <p style="margin:16px 0 0;${font}font-size:11px;color:#A39E89;">Sent by Flexy</p>
    </td>
  </tr>
</table>
</body>
</html>`;

    const text = [
        'FLEXY',
        '',
        'Use this code to sign in to Flexy:',
        '',
        `    ${code}`,
        '',
        `This code expires in ${ttlMinutes} minute${String(ttlMinutes) === '1' ? '' : 's'} and works only once.`,
        'Do not share this code with anyone. Flexy will never ask you for it by phone, message or email.',
        '',
        'If you did not try to sign in, you can ignore this email. Nobody can access your account without this code.'
    ].join('\n');

    return { subject: 'Your Flexy verification code', html, text };
}

function createEmailService(emailConfig, { logger = console, ResendClient = Resend, resendOptions, timeoutMs = SEND_TIMEOUT_MS } = {}) {
    const { transport, resendApiKey, from } = emailConfig;
    const client = transport === 'resend' && resendApiKey ? new ResendClient(resendApiKey, resendOptions) : null;

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

            // The Resend SDK has no timeout of its own but forwards `signal` to
            // fetch, so a hung request is actually cancelled. The race guards
            // against a client that ignores the signal.
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            const aborted = new Promise((_, reject) => {
                controller.signal.addEventListener('abort', () => reject(new Error(`timed out after ${timeoutMs}ms`)), { once: true });
            });

            let result;
            try {
                result = await Promise.race([
                    client.emails.send({ from, to, ...content }, { signal: controller.signal }),
                    aborted
                ]);
            } catch (err) {
                throw new EmailDeliveryError(
                    controller.signal.aborted ? `Email provider did not respond within ${timeoutMs}ms` : 'Email provider request failed',
                    { cause: err, timedOut: controller.signal.aborted }
                );
            } finally {
                clearTimeout(timer);
                aborted.catch(() => {});
            }

            // The SDK reports HTTP errors *and* network failures through `error`
            // (network failures arrive as application_error with statusCode null).
            if (result && result.error) {
                const { name, statusCode, message } = result.error;
                throw new EmailDeliveryError(message || 'Email provider rejected the message', {
                    providerError: { name, statusCode },
                    timedOut: controller.signal.aborted
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
    otpEmailContent,
    EmailNotConfiguredError,
    EmailDeliveryError,
    maskEmail,
    escapeHtml
};
