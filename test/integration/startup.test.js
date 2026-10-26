// Spawns the real entry point (server.js) to verify process-level behaviour:
// signup and login against a real server, production fail-fast on bad
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

    test('starts with just a database (no email provider) and serves signup and login', async () => {
        const server = startServer({ MONGODB_URI: mongod.getUri('flexy_startup') });
        try {
            const [, port] = await server.waitFor(/running on port (\d+)/);
            await server.waitFor(/Connected to MongoDB/);
            assert.doesNotMatch(server.output(), /RESEND|Email delivery/i);

            const base = `http://127.0.0.1:${port}`;
            const post = (path, body, headers = {}) => fetch(`${base}${path}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Origin: base, ...headers },
                body: JSON.stringify(body)
            });
            const health = await fetch(`${base}/api/health`).then(r => r.json());
            assert.equal(health.database, 'connected');

            const password = 'Startup check 2026';
            const signup = await post('/api/auth/signup', {
                fullName: 'Startup Check', username: 'startup_check', phone: '+91 98765 43210',
                email: 'startup@example.test', password, confirmPassword: password
            });
            assert.equal(signup.status, 201);

            const login = await post('/api/auth/login', { identifier: 'startup@example.test', password });
            assert.equal(login.status, 200);
            const { token } = await login.json();
            const me = await fetch(`${base}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
            assert.equal((await me.json()).username, 'startup_check');

            const refresh = await post('/api/auth/refresh', {}, { Cookie: login.headers.get('set-cookie').split(';')[0] });
            assert.equal(refresh.status, 200);

            const otp = await post('/api/auth/request-otp', { email: 'startup@example.test' });
            assert.equal(otp.status, 404);

            const missing = await fetch(`${base}/api/not-a-route`);
            assert.equal(missing.status, 404);
            assert.deepEqual(await missing.json(), { error: 'API route not found' });
            assert.doesNotMatch(server.output(), new RegExp(password));
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

    test('production starts with leftover Resend variables, naming them without printing their values', async () => {
        const server = startServer({
            NODE_ENV: 'production',
            MONGODB_URI: mongod.getUri('flexy_prod_ok'),
            JWT_SECRET: 'p'.repeat(40),
            JWT_REFRESH_SECRET: 'q'.repeat(40),
            RESEND_API_KEY: 're_placeholder_not_used',
            EMAIL_FROM: 'Flexy <login@leftover.example>'
        });
        try {
            const [, port] = await server.waitFor(/running on port (\d+) \(production\)/);
            await server.waitFor(/Connected to MongoDB/);
            assert.match(server.output(), /RESEND_API_KEY is no longer used/);
            assert.match(server.output(), /EMAIL_FROM is no longer used/);
            assert.doesNotMatch(server.output(), /re_placeholder_not_used|leftover\.example/);
            const health = await fetch(`http://127.0.0.1:${port}/api/health`).then(r => r.json());
            assert.equal(health.status, 'ok');
        } finally {
            await server.stop();
        }
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
