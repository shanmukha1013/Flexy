const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { loadConfig, assertValidConfig, ConfigError } = require('../../config/env');

const STRONG_A = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0';
const STRONG_B = 'z9y8x7w6v5u4t3s2r1q0p9o8n7m6l5k4j3i2h1g0';

const productionEnv = (overrides = {}) => ({
    NODE_ENV: 'production',
    MONGODB_URI: 'mongodb+srv://user:pass@cluster.example.net/flexy',
    JWT_SECRET: STRONG_A,
    JWT_REFRESH_SECRET: STRONG_B,
    RESEND_API_KEY: 're_live_example',
    EMAIL_FROM: 'Flexy <login@flexy.example>',
    ...overrides
});

describe('configuration', () => {
    test('a complete production config is valid', () => {
        const config = loadConfig(productionEnv());
        assert.deepEqual(config.errors, []);
        assert.equal(config.isProduction, true);
        assert.equal(config.cookie.secure, true);
        assert.equal(config.cookie.sameSite, 'none');
        assert.equal(config.trustProxy, 1);
        assert.deepEqual(config.corsOrigins, ['https://flexy-peach.vercel.app']);
        assert.doesNotThrow(() => assertValidConfig(config));
    });

    test('production requires JWT secrets and a database URI', () => {
        const config = loadConfig(productionEnv({ JWT_SECRET: '', JWT_REFRESH_SECRET: '', MONGODB_URI: '' }));
        assert.ok(config.errors.some(e => e.startsWith('JWT_SECRET is required')));
        assert.ok(config.errors.some(e => e.startsWith('JWT_REFRESH_SECRET is required')));
        assert.ok(config.errors.some(e => e.startsWith('MONGODB_URI is required')));
        assert.throws(() => assertValidConfig(config), ConfigError);
    });

    for (const placeholder of ['flexy_secure_jwt_key_2026', 'flexy_secure_refresh_key_2026', 'super-secret-flexy-key-2026']) {
        test(`production rejects the known placeholder secret "${placeholder}"`, () => {
            const config = loadConfig(productionEnv({ JWT_SECRET: placeholder }));
            assert.ok(config.errors.some(e => e.includes('publicly known placeholder')));
        });
    }

    test('production rejects short and identical secrets', () => {
        assert.ok(loadConfig(productionEnv({ JWT_SECRET: 'short' })).errors.some(e => e.includes('at least 32')));
        assert.ok(loadConfig(productionEnv({ JWT_REFRESH_SECRET: STRONG_A })).errors.some(e => e.includes('must be different')));
    });

    test('development generates ephemeral secrets instead of using hardcoded ones', () => {
        const a = loadConfig({ NODE_ENV: 'development' });
        const b = loadConfig({ NODE_ENV: 'development' });
        assert.deepEqual(a.errors, []);
        assert.ok(a.jwt.accessSecret.length >= 64);
        assert.notEqual(a.jwt.accessSecret, b.jwt.accessSecret);
        assert.notEqual(a.jwt.accessSecret, a.jwt.refreshSecret);
        assert.ok(a.warnings.some(w => w.startsWith('JWT_SECRET is not set')));
    });

    test('a missing Resend key is a warning, not a startup failure', () => {
        const config = loadConfig(productionEnv({ RESEND_API_KEY: '' }));
        assert.deepEqual(config.errors, []);
        assert.ok(config.warnings.some(w => w.startsWith('RESEND_API_KEY is not set')));
    });

    test('the console email transport is refused in production', () => {
        const config = loadConfig(productionEnv({ EMAIL_TRANSPORT: 'console' }));
        assert.ok(config.errors.some(e => e.includes('EMAIL_TRANSPORT=console is not allowed in production')));
        assert.deepEqual(loadConfig({ NODE_ENV: 'development', EMAIL_TRANSPORT: 'console' }).errors, []);
    });

    test('an unknown email transport is rejected', () => {
        assert.ok(loadConfig({ EMAIL_TRANSPORT: 'smtp' }).errors.some(e => e.includes('EMAIL_TRANSPORT must be')));
    });

    test('the shared resend.dev sender triggers a production warning', () => {
        const config = loadConfig(productionEnv({ EMAIL_FROM: '' }));
        assert.equal(config.email.from, 'Flexy <onboarding@resend.dev>');
        assert.ok(config.warnings.some(w => w.includes('shared resend.dev sender')));
    });

    test('MONGODB_PASSWORD is substituted and URL-encoded', () => {
        const config = loadConfig(productionEnv({
            MONGODB_URI: 'mongodb+srv://flexy:${MONGODB_PASSWORD}@cluster.example.net/db',
            MONGODB_PASSWORD: 'p@ss/word'
        }));
        assert.equal(config.mongoUri, 'mongodb+srv://flexy:p%40ss%2Fword@cluster.example.net/db');
        const missing = loadConfig(productionEnv({ MONGODB_URI: 'mongodb://u:${MONGODB_PASSWORD}@h/db', MONGODB_PASSWORD: '' }));
        assert.ok(missing.errors.some(e => e.includes('MONGODB_PASSWORD is not set')));
    });

    test('development falls back to the local database and local CORS origins', () => {
        const config = loadConfig({ NODE_ENV: 'development' });
        assert.equal(config.mongoUri, 'mongodb://127.0.0.1:27017/flexy');
        assert.ok(config.corsOrigins.includes('http://localhost:3001'));
        assert.equal(config.cookie.secure, false);
        assert.equal(config.cookie.sameSite, 'lax');
        assert.equal(config.trustProxy, false);
    });

    test('PORT defaults to 3001, accepts 0 (any free port) and rejects junk', () => {
        assert.equal(loadConfig({}).port, 3001);
        assert.equal(loadConfig({ PORT: '0' }).port, 0);
        assert.equal(loadConfig({ PORT: '8080' }).port, 8080);
        assert.ok(loadConfig({ PORT: 'abc' }).errors.some(e => e.startsWith('PORT must be')));
    });

    test('CORS_ORIGINS and TRUST_PROXY override the defaults', () => {
        const config = loadConfig(productionEnv({ CORS_ORIGINS: 'https://a.example/, https://b.example', TRUST_PROXY: '2' }));
        assert.deepEqual(config.corsOrigins, ['https://a.example', 'https://b.example']);
        assert.equal(config.trustProxy, 2);
    });
});
