// Runs in its own process without ever connecting MongoDB, to check that the
// server degrades cleanly instead of hanging or crashing.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const h = require('../helpers');

describe('without a database connection', () => {
    test('API routes return 503 quickly', async () => {
        const { app } = h.buildApp();
        const started = Date.now();
        const res = await request(app).get('/api/auctions');
        assert.equal(res.status, 503);
        assert.match(res.body.error, /database is unavailable/i);
        assert.ok(Date.now() - started < 2000);

        const otp = await request(app).post('/api/auth/request-otp').send({ email: 'a@example.test' });
        assert.equal(otp.status, 503);
    });

    test('the health endpoint reports the degraded state', async () => {
        const { app } = h.buildApp({ emailService: h.createFakeEmailService({ configured: false }) });
        const res = await request(app).get('/api/health');
        assert.equal(res.status, 503);
        assert.equal(res.body.status, 'degraded');
        assert.equal(res.body.database, 'disconnected');
        assert.equal(res.body.email, 'not_configured');
    });

    test('the static frontend is still served', async () => {
        const { app } = h.buildApp();
        const res = await request(app).get('/login.html');
        assert.equal(res.status, 200);
        assert.match(res.text, /FLEXY/);
    });
});

describe('HTTP behaviour', () => {
    test('unknown API routes return JSON 404 and other GETs fall back to index.html', async () => {
        const { app } = h.buildApp();
        const api = await request(app).get('/api/does-not-exist');
        assert.equal(api.status, 503); // database gate runs before routing
        const page = await request(app).get('/some/client/route');
        assert.equal(page.status, 200);
        assert.match(page.type, /html/);
        const post = await request(app).post('/some/client/route');
        assert.equal(post.status, 404);
    });

    test('malformed JSON returns 400 without a stack trace', async () => {
        const { app } = h.buildApp();
        const res = await request(app).post('/api/health').set('Content-Type', 'application/json').send('{"bad json');
        assert.equal(res.status, 400);
        assert.deepEqual(res.body, { error: 'Request body is not valid JSON' });
    });

    test('oversized bodies are rejected with 413', async () => {
        const { app } = h.buildApp();
        const res = await request(app).post('/api/auctions').set('Content-Type', 'application/json')
            .send(JSON.stringify({ blob: 'x'.repeat(17 * 1024 * 1024) }));
        assert.equal(res.status, 413);
    });

    test('CORS allows configured origins with credentials and ignores others', async () => {
        const { app } = h.buildApp();
        const allowed = await request(app).options('/api/auth/refresh')
            .set('Origin', 'https://flexy-peach.vercel.app').set('Access-Control-Request-Method', 'POST');
        assert.equal(allowed.headers['access-control-allow-origin'], 'https://flexy-peach.vercel.app');
        assert.equal(allowed.headers['access-control-allow-credentials'], 'true');

        const denied = await request(app).options('/api/auth/refresh')
            .set('Origin', 'https://evil.example').set('Access-Control-Request-Method', 'POST');
        assert.equal(denied.headers['access-control-allow-origin'], undefined);
    });

    test('security headers are set and x-powered-by is hidden', async () => {
        const { app } = h.buildApp();
        const res = await request(app).get('/login.html');
        assert.equal(res.headers['x-content-type-options'], 'nosniff');
        assert.equal(res.headers['x-powered-by'], undefined);
    });
});
