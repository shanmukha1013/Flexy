// config/env.js
// Single source of truth for runtime configuration. Validates environment
// variables once at startup so misconfiguration fails loudly instead of
// surfacing later as a crash inside a request handler.

const crypto = require('crypto');

// Secrets that have appeared in this repository (or are common placeholders).
// Anything listed here must never be used to sign tokens in production.
const KNOWN_PLACEHOLDER_SECRETS = new Set([
    'flexy_secure_jwt_key_2026',
    'flexy_secure_refresh_key_2026',
    'super-secret-flexy-key-2026',
    'secret',
    'changeme',
    'change-me',
    'replace-me',
    'your_jwt_secret',
    'your-jwt-secret',
    'jwt_secret',
    'refresh_secret'
]);

const MIN_SECRET_LENGTH = 32;

// The deployed Vercel frontend. Overridable with CORS_ORIGINS.
const DEFAULT_FRONTEND_ORIGINS = ['https://flexy-peach.vercel.app'];
const DEFAULT_LOCAL_ORIGINS = ['http://localhost:3001', 'http://127.0.0.1:3001'];
const DEFAULT_LOCAL_MONGODB_URI = 'mongodb://127.0.0.1:27017/flexy';
const DEFAULT_EMAIL_FROM = 'Flexy <onboarding@resend.dev>';

class ConfigError extends Error {
    constructor(errors) {
        super(`Invalid configuration:\n  - ${errors.join('\n  - ')}`);
        this.name = 'ConfigError';
        this.errors = errors;
    }
}

function parseList(value) {
    return (value || '')
        .split(',')
        .map(s => s.trim().replace(/\/+$/, ''))
        .filter(Boolean);
}

function parseTrustProxy(value, isProduction) {
    if (value === undefined || value === '') return isProduction ? 1 : false;
    if (value === 'true') return true;
    if (value === 'false') return false;
    const hops = Number(value);
    return Number.isInteger(hops) && hops >= 0 ? hops : value;
}

function resolveSecret(name, value, { isProduction, errors, warnings }) {
    if (!value) {
        if (isProduction) {
            errors.push(`${name} is required in production (generate one with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")`);
            return null;
        }
        warnings.push(`${name} is not set; using a random per-process secret. Sessions will not survive a server restart.`);
        return crypto.randomBytes(48).toString('hex');
    }
    if (KNOWN_PLACEHOLDER_SECRETS.has(value)) {
        (isProduction ? errors : warnings).push(`${name} is set to a publicly known placeholder value and must be replaced.`);
    } else if (value.length < MIN_SECRET_LENGTH) {
        (isProduction ? errors : warnings).push(`${name} must be at least ${MIN_SECRET_LENGTH} characters long.`);
    }
    return value;
}

function loadConfig(env = process.env) {
    const errors = [];
    const warnings = [];

    const nodeEnv = env.NODE_ENV || 'development';
    const isProduction = nodeEnv === 'production';
    const isTest = nodeEnv === 'test';

    const port = env.PORT === undefined || env.PORT === '' ? 3001 : Number(env.PORT);
    if (!Number.isInteger(port) || port < 0 || port > 65535) {
        errors.push(`PORT must be an integer between 0 and 65535 (got "${env.PORT}").`);
    }

    // MongoDB: MONGODB_URI may contain a literal ${MONGODB_PASSWORD} placeholder
    // that is filled from a separate variable (existing Render convention).
    let mongoUri = env.MONGODB_URI || '';
    if (mongoUri.includes('${MONGODB_PASSWORD}')) {
        if (!env.MONGODB_PASSWORD) {
            errors.push('MONGODB_URI contains ${MONGODB_PASSWORD} but MONGODB_PASSWORD is not set.');
        }
        mongoUri = mongoUri.replace('${MONGODB_PASSWORD}', encodeURIComponent(env.MONGODB_PASSWORD || ''));
    }
    if (!mongoUri) {
        if (isProduction) {
            errors.push('MONGODB_URI is required in production.');
        } else if (!isTest) {
            mongoUri = DEFAULT_LOCAL_MONGODB_URI;
            warnings.push(`MONGODB_URI is not set; defaulting to local database ${DEFAULT_LOCAL_MONGODB_URI}.`);
        }
    }

    const secretCtx = { isProduction, errors, warnings };
    const accessSecret = resolveSecret('JWT_SECRET', env.JWT_SECRET, secretCtx);
    const refreshSecret = resolveSecret('JWT_REFRESH_SECRET', env.JWT_REFRESH_SECRET, secretCtx);
    if (env.JWT_SECRET && env.JWT_SECRET === env.JWT_REFRESH_SECRET) {
        (isProduction ? errors : warnings).push('JWT_SECRET and JWT_REFRESH_SECRET must be different values.');
    }

    // Email delivery. "console" prints codes to the server log and exists only
    // so the login flow can be exercised locally without a Resend account.
    const emailTransport = (env.EMAIL_TRANSPORT || 'resend').toLowerCase();
    if (!['resend', 'console'].includes(emailTransport)) {
        errors.push(`EMAIL_TRANSPORT must be "resend" or "console" (got "${env.EMAIL_TRANSPORT}").`);
    }
    if (emailTransport === 'console' && isProduction) {
        errors.push('EMAIL_TRANSPORT=console is not allowed in production; it would write login codes to the logs.');
    }
    const resendApiKey = env.RESEND_API_KEY || '';
    const emailFrom = env.EMAIL_FROM || DEFAULT_EMAIL_FROM;
    if (emailTransport === 'resend' && !resendApiKey) {
        warnings.push('RESEND_API_KEY is not set; OTP login is unavailable until it is configured (requests will return 503).');
    }
    if (isProduction && emailTransport === 'resend' && /@resend\.dev>?$/i.test(emailFrom)) {
        warnings.push('EMAIL_FROM uses the shared resend.dev sender, which only delivers to the Resend account owner. Verify a domain in Resend and set EMAIL_FROM to send codes to other users.');
    }

    const corsOrigins = env.CORS_ORIGINS
        ? parseList(env.CORS_ORIGINS)
        : [...DEFAULT_FRONTEND_ORIGINS, ...(isProduction ? [] : DEFAULT_LOCAL_ORIGINS)];

    return {
        nodeEnv,
        isProduction,
        isTest,
        port,
        mongoUri,
        trustProxy: parseTrustProxy(env.TRUST_PROXY, isProduction),
        corsOrigins,
        jwt: {
            accessSecret,
            refreshSecret,
            accessTtl: '15m',
            refreshTtl: '30d'
        },
        cookie: {
            // The production frontend (Vercel) and API (Render) are different
            // sites, so the refresh cookie must be SameSite=None; Secure there.
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax'
        },
        email: {
            transport: emailTransport,
            resendApiKey,
            from: emailFrom
        },
        errors,
        warnings
    };
}

function assertValidConfig(config) {
    if (config.errors.length > 0) throw new ConfigError(config.errors);
    return config;
}

module.exports = {
    loadConfig,
    assertValidConfig,
    ConfigError,
    KNOWN_PLACEHOLDER_SECRETS,
    MIN_SECRET_LENGTH
};
