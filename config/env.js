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
const DEFAULT_LOCAL_ORIGINS = ['http://localhost:3001', 'http://127.0.0.1:3001', 'http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5500', 'http://127.0.0.1:5500', 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:8080', 'http://127.0.0.1:8080'];
const DEFAULT_LOCAL_MONGODB_URI = 'mongodb://127.0.0.1:27017/flexy';
// Settings of the retired email (OTP) sign-in. They are ignored now; startup
// names any that are still set so they can be removed. Values are never printed.
const OBSOLETE_VARIABLES = ['RESEND_API_KEY', 'EMAIL_FROM', 'EMAIL_TRANSPORT'];

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

// In production a missing, short or publicly known secret must never be used,
// but refusing to boot takes the whole site down (Render keeps serving the last
// build that started). Instead derive a stable secret from MONGODB_URI, which
// already holds the database password: it survives restarts, so sessions do too,
// and anyone who could compute it already has full database access.
function deriveSecret(name, seed) {
    return crypto.createHmac('sha256', seed).update(`flexy:${name}`).digest('hex');
}

function resolveSecret(name, value, { isProduction, errors, warnings, seed }) {
    const fallback = () => {
        if (isProduction && seed) return deriveSecret(name, seed);
        return crypto.randomBytes(48).toString('hex');
    };
    const fallbackNote = isProduction && seed
        ? 'using a secret derived from MONGODB_URI instead. Set a strong value in the host environment'
        : 'using a random per-process secret instead (sessions end when the server restarts)';
    const generateHint = ` (generate one with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")`;

    if (!value) {
        if (isProduction && !seed) {
            errors.push(`${name} is required in production${generateHint}`);
            return null;
        }
        warnings.push(`${name} is not set; ${fallbackNote}${isProduction ? generateHint : ''}.`);
        return fallback();
    }
    if (KNOWN_PLACEHOLDER_SECRETS.has(value)) {
        warnings.push(`${name} is set to a publicly known placeholder value and is ignored; ${fallbackNote}.`);
        return fallback();
    }
    if (value.length < MIN_SECRET_LENGTH) {
        if (!isProduction) {
            warnings.push(`${name} must be at least ${MIN_SECRET_LENGTH} characters long.`);
            return value;
        }
        warnings.push(`${name} is shorter than ${MIN_SECRET_LENGTH} characters; strengthening it with MONGODB_URI. Set a longer value.`);
        return seed ? deriveSecret(`${name}:${value}`, seed) : value;
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

    const secretCtx = { isProduction, errors, warnings, seed: mongoUri };
    const accessSecret = resolveSecret('JWT_SECRET', env.JWT_SECRET, secretCtx);
    let refreshSecret = resolveSecret('JWT_REFRESH_SECRET', env.JWT_REFRESH_SECRET, secretCtx);
    if (accessSecret && accessSecret === refreshSecret) {
        warnings.push('JWT_SECRET and JWT_REFRESH_SECRET must be different values; deriving a separate refresh secret.');
        refreshSecret = deriveSecret('JWT_REFRESH_SECRET', accessSecret);
    }

    for (const name of OBSOLETE_VARIABLES) {
        if (env[name]) warnings.push(`${name} is no longer used (email sign-in was replaced by passwords) and can be removed.`);
    }

    // CORS_ORIGINS adds to the deployed frontend rather than replacing it, so a
    // stale value on the host can never lock the real site out of the API.
    const corsOrigins = [...new Set([
        ...DEFAULT_FRONTEND_ORIGINS,
        ...(env.CORS_ORIGINS ? parseList(env.CORS_ORIGINS) : (isProduction ? [] : DEFAULT_LOCAL_ORIGINS))
    ])];

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
    MIN_SECRET_LENGTH,
    OBSOLETE_VARIABLES
};
