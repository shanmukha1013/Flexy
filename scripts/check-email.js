// scripts/check-email.js
// Sends one sample verification email through the configured provider, to
// confirm that RESEND_API_KEY, EMAIL_FROM and the recipient are accepted.
// No database is needed. The sample code is random, never printed, never
// stored, and cannot be used to sign in.
//
// Usage: npm run email:check -- you@example.com

require('dotenv').config({ quiet: true });
const { loadConfig } = require('../config/env');
const { createEmailService } = require('../lib/email');
const { generateOtp, OTP_TTL_MS } = require('../lib/otp');
const { normalizeEmail } = require('../lib/validation');

async function main() {
    const to = normalizeEmail(process.argv[2] || '');
    if (!to) {
        console.error('Usage: npm run email:check -- you@example.com');
        return 2;
    }

    const config = loadConfig();
    if (config.email.transport !== 'resend') {
        console.error(`EMAIL_TRANSPORT is "${config.email.transport}", not "resend": nothing to check.`);
        return 2;
    }
    const service = createEmailService(config.email, { logger: { log() {} } });
    if (!service.isConfigured()) {
        console.error('RESEND_API_KEY is not set. Add it to .env (see .env.example).');
        return 1;
    }

    console.log(`Sending a sample verification email from ${config.email.from} to ${to} ...`);
    try {
        const { id } = await service.sendOtp(to, generateOtp(), OTP_TTL_MS / 60000);
        console.log(`Accepted by Resend (message id ${id}).`);
        console.log('Acceptance is not delivery: check the inbox and spam folder, or the Emails page in the Resend dashboard.');
        return 0;
    } catch (err) {
        const provider = err.providerError || {};
        const tag = provider.name ? ` [${provider.name}${provider.statusCode ? ' ' + provider.statusCode : ''}]` : '';
        console.error(`Not sent: ${err.message}${tag}`);
        if (provider.statusCode === 401) {
            console.error('Hint: the API key is missing, invalid or revoked.');
        } else if (provider.statusCode === 403) {
            console.error('Hint: the shared onboarding@resend.dev sender only delivers to the Resend account owner. Verify a domain in Resend and set EMAIL_FROM to send to anyone else.');
        } else if (provider.statusCode === 429) {
            console.error('Hint: the Resend account hit its rate limit or quota.');
        }
        return 1;
    }
}

main().then(code => process.exit(code));
