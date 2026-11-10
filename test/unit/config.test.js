const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { loadConfig, assertValidConfig, ConfigError, OBSOLETE_VARIABLES } = require('../../config/env');

const STRONG_A = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0';
const STRONG_B = 'z9y8x7w6v5u4t3s2r1q0p9o8n7m6l5k4j3i2h1g0';

const productionEnv = (overrides = {}) => ({
    NODE_ENV: 'production',
    MONGODB_URI: 'mongodb+srv://user:pass@cluster.example.net/flexy',
    JWT_SECRET: STRONG_A,
    JWT_REFRESH_SECRET: STRONG_B,
    ...overrides
});

describe('configuration', () => {
    test('a complete production config is valid', () => {
        const config = loadConfig(productionEnv());
        assert.deepEqual(config.errors, []);
        assert.deepEqual(config.warnings, []);
        assert.equal(config.isProduction, true);
        assert.equal(config.cookie.secure, true);
        assert.equal(config.cookie.sameSite, 'none');
        assert.equal(config.trustProxy, 1);
        assert.deepEqual(config.corsOrigins, ['https://flexy-peach.vercel.app']);
        assert.doesNotThrow(() => assertValidConfig(config));
    });

    test('production requires a database URI', () => {
        const config = loadConfig(productionEnv({ JWT_SECRET: '', JWT_REFRESH_SECRET: '', MONGODB_URI: '' }));
        assert.ok(config.errors.some(e => e.startsWith('JWT_SECRET is required')));
        assert.ok(config.errors.some(e => e.startsWith('JWT_REFRESH_SECRET is required')));
        assert.ok(config.errors.some(e => e.startsWith('MONGODB_URI is required')));
        assert.throws(() => assertValidConfig(config), ConfigError);
    });

    test('production without JWT secrets boots with stable secrets derived from MONGODB_URI', () => {
        const a = loadConfig(productionEnv({ JWT_SECRET: '', JWT_REFRESH_SECRET: '' }));
        const b = loadConfig(productionEnv({ JWT_SECRET: '', JWT_REFRESH_SECRET: '' }));
        assert.deepEqual(a.errors, []);
        assert.ok(a.warnings.some(w => w.startsWith('JWT_SECRET is not set')));
        assert.ok(a.jwt.accessSecret.length >= 64);
        assert.equal(a.jwt.accessSecret, b.jwt.accessSecret, 'survives restarts');
        assert.notEqual(a.jwt.accessSecret, a.jwt.refreshSecret);
        const other = loadConfig(productionEnv({ JWT_SECRET: '', MONGODB_URI: 'mongodb+srv://u:other@h/db' }));
        assert.notEqual(a.jwt.accessSecret, other.jwt.accessSecret);
    });

    for (const placeholder of ['flexy_secure_jwt_key_2026', 'flexy_secure_refresh_key_2026', 'super-secret-flexy-key-2026']) {
        test(`production never signs with the known placeholder secret "${placeholder}"`, () => {
            const config = loadConfig(productionEnv({ JWT_SECRET: placeholder }));
            assert.deepEqual(config.errors, []);
            assert.ok(config.warnings.some(w => w.includes('publicly known placeholder')));
            assert.notEqual(config.jwt.accessSecret, placeholder);
        });
    }

    test('production strengthens short secrets and separates identical ones', () => {
        const short = loadConfig(productionEnv({ JWT_SECRET: 'short' }));
        assert.deepEqual(short.errors, []);
        assert.ok(short.warnings.some(w => w.includes('shorter than 32')));
        assert.ok(short.jwt.accessSecret.length >= 64);
        const same = loadConfig(productionEnv({ JWT_REFRESH_SECRET: STRONG_A }));
        assert.ok(same.warnings.some(w => w.includes('must be different')));
        assert.notEqual(same.jwt.accessSecret, same.jwt.refreshSecret);
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

    test('no email provider is needed: email settings are not part of the config', () => {
        const config = loadConfig(productionEnv());
        assert.equal(config.email, undefined);
        assert.deepEqual(config.errors, []);
    });

    test('leftover email sign-in variables only produce a warning that names them, never their values', () => {
        const config = loadConfig(productionEnv({
            RESEND_API_KEY: 're_secret_value_123',
            EMAIL_FROM: 'Flexy <login@flexy.example>',
            EMAIL_TRANSPORT: 'console'
        }));
        assert.deepEqual(config.errors, []);
        for (const name of OBSOLETE_VARIABLES) {
            assert.ok(config.warnings.some(w => w.startsWith(`${name} is no longer used`)), name);
        }
        assert.doesNotMatch(config.warnings.join('\n'), /re_secret_value_123|login@flexy\.example/);
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

    test('CORS_ORIGINS adds to the deployed frontend and TRUST_PROXY overrides the default', () => {
        const config = loadConfig(productionEnv({ CORS_ORIGINS: 'https://a.example/, https://b.example', TRUST_PROXY: '2' }));
        assert.deepEqual(config.corsOrigins, ['https://flexy-peach.vercel.app', 'https://a.example', 'https://b.example']);
        assert.equal(config.trustProxy, 2);
    });
});
