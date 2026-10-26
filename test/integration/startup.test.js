// Spawns the real entry point (server.js) to verify process-level behaviour:
// the original crash on a missing RESEND_API_KEY, production fail-fast on bad
// configuration, and degraded mode when MongoDB is unreachable.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const { MongoMemoryServer } = require('mongodb-memory-server');

const SERVER = path.join(__dirname, '..', '..', 'server.js');

// Run from the temp dir so a developer's local .env is never picked up, and
// blank out every variable the server reads.
function startServer(env) {
    const child = spawn(process.execPath, [SERVER], {
        cwd: os.tmpdir(),
        env: {
            PATH: process.env.PATH,
            SYSTEMROOT: process.env.SYSTEMROOT,
            NODE_ENV: 'development',
            PORT: '0',
            MONGODB_URI: '',
            MONGODB_PASSWORD: '',
            JWT_SECRET: '',
            JWT_REFRESH_SECRET: '',
            RESEND_API_KEY: '',
            EMAIL_TRANSPORT: '',
            EMAIL_FROM: '',
            CORS_ORIGINS: '',
            TRUST_PROXY: '',
            ...env
        },
        stdio: ['ignore', 'pipe', 'pipe']
    });
    let output = '';
    child.stdout.on('data', d => { output += d; });
    child.stderr.on('data', d => { output += d; });
    const exited = new Promise(resolve => child.on('exit', code => resolve(code)));
    return {
        child,
        exited,
        output: () => output,
        waitFor(pattern, ms = 15000) {
            return new Promise((resolve, reject) => {
                const started = Date.now();
                const poll = setInterval(() => {
                    const match = output.match(pattern);
                    if (match) { clearInterval(poll); resolve(match); }
                    else if (Date.now() - started > ms || child.exitCode !== null) {
                        clearInterval(poll);
                        reject(new Error(`Did not see ${pattern} (exit ${child.exitCode}). Output:\n${output}`));
                    }
                }, 50);
            });
        },
        stop() {
            if (child.exitCode === null) child.kill();
            return exited;
        }
    };
}

describe('server.js startup', () => {
    let mongod;
    before(async () => { mongod = await MongoMemoryServer.create(); });
    after(async () => { await mongod.stop(); });

    test('starts without RESEND_API_KEY and reports email login as unavailable', async () => {
        const server = startServer({ MONGODB_URI: mongod.getUri('flexy_startup') });
        try {
            const [, port] = await server.waitFor(/running on port (\d+)/);
            await server.waitFor(/Connected to MongoDB/);
            assert.match(server.output(), /RESEND_API_KEY is not set/);
            assert.doesNotMatch(server.output(), /Missing API key/);

            const base = `http://127.0.0.1:${port}`;
            const health = await fetch(`${base}/api/health`).then(r => r.json());
            assert.equal(health.database, 'connected');
            assert.equal(health.email, 'not_configured');

            const otp = await fetch(`${base}/api/auth/request-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'startup@example.test' })
            });
            assert.equal(otp.status, 503);

            const missing = await fetch(`${base}/api/not-a-route`);
            assert.equal(missing.status, 404);
            assert.deepEqual(await missing.json(), { error: 'API route not found' });
        } finally {
            await server.stop();
        }
    });

    test('the console transport delivers codes to the log in development only', async () => {
        const server = startServer({ MONGODB_URI: mongod.getUri('flexy_startup_console'), EMAIL_TRANSPORT: 'console' });
        try {
            const [, port] = await server.waitFor(/running on port (\d+)/);
            await server.waitFor(/Connected to MongoDB/);
            const base = `http://127.0.0.1:${port}`;
            const sent = await fetch(`${base}/api/auth/request-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'dev@example.test' })
            });
            assert.equal(sent.status, 200);
            const [, code] = await server.waitFor(/Verification code for dev@example\.test: (\d{6})/);

            const verified = await fetch(`${base}/api/auth/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'dev@example.test', code })
            });
            assert.equal(verified.status, 200);
            assert.ok((await verified.json()).token);
        } finally {
            await server.stop();
        }
    });

    test('production refuses to start with missing or placeholder secrets', async () => {
        const server = startServer({
            NODE_ENV: 'production',
            MONGODB_URI: mongod.getUri('flexy_prod'),
            JWT_SECRET: 'flexy_secure_jwt_key_2026'
        });
        const code = await server.exited;
        assert.equal(code, 1);
        assert.match(server.output(), /JWT_SECRET is set to a publicly known placeholder/);
        assert.match(server.output(), /JWT_REFRESH_SECRET is required in production/);
        assert.doesNotMatch(server.output(), /running on port/);
    });

    test('production refuses EMAIL_TRANSPORT=console', async () => {
        const server = startServer({
            NODE_ENV: 'production',
            MONGODB_URI: mongod.getUri('flexy_prod'),
            JWT_SECRET: 'p'.repeat(40),
            JWT_REFRESH_SECRET: 'q'.repeat(40),
            EMAIL_TRANSPORT: 'console'
        });
        assert.equal(await server.exited, 1);
        assert.match(server.output(), /EMAIL_TRANSPORT=console is not allowed in production/);
    });

    test('development keeps serving (with 503s) when MongoDB is unreachable', async () => {
        const server = startServer({ MONGODB_URI: 'mongodb://127.0.0.1:1/flexy_unreachable' });
        try {
            const [, port] = await server.waitFor(/running on port (\d+)/);
            await server.waitFor(/Continuing without a database/, 20000);
            const res = await fetch(`http://127.0.0.1:${port}/api/auctions`);
            assert.equal(res.status, 503);
            const page = await fetch(`http://127.0.0.1:${port}/login.html`);
            assert.equal(page.status, 200);
            assert.equal(server.child.exitCode, null);
        } finally {
            await server.stop();
        }
    });
});
