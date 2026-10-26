// Exercises the real Resend SDK over real HTTP against a local stand-in for
// api.resend.com (the SDK's baseUrl option). This covers the SDK's actual
// request format and error handling without any email leaving the machine.
// It is NOT proof of inbox delivery; only a live send with a real key is.
const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const request = require('supertest');
const OTPVerification = require('../../models/OTPVerification');
const { createEmailService } = require('../../lib/email');
const h = require('../helpers');

let mongod;
let fakeResend;
let fakeUrl;
let behaviour;
let received;
const hangingResponses = [];

before(async () => {
    mongod = await h.startDatabase();
    fakeResend = http.createServer((req, res) => {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            received.push({ method: req.method, url: req.url, headers: req.headers, body: body ? JSON.parse(body) : null });
            behaviour(req, res);
        });
    });
    await new Promise(resolve => fakeResend.listen(0, '127.0.0.1', resolve));
    fakeUrl = `http://127.0.0.1:${fakeResend.address().port}`;
});

after(async () => {
    for (const res of hangingResponses) res.destroy();
    fakeResend.closeAllConnections();
    await new Promise(resolve => fakeResend.close(resolve));
    await h.stopDatabase(mongod);
});

beforeEach(async () => {
    await h.clearDatabase();
    received = [];
    behaviour = (req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: 'email_test_123' }));
    };
});

function json(res, status, payload) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));
}

function appWithRealSdk({ baseUrl = fakeUrl, timeoutMs } = {}) {
    const config = h.testConfig({ RESEND_API_KEY: 're_test_local_key', EMAIL_FROM: 'Flexy <login@flexy.test>' });
    const emailService = createEmailService(config.email, { resendOptions: { baseUrl }, timeoutMs, logger: { log() {} } });
    return h.buildApp({ env: { RESEND_API_KEY: 're_test_local_key', EMAIL_FROM: 'Flexy <login@flexy.test>' }, emailService });
}

const EMAIL = 'inbox@example.test';
const quietErrors = (t) => t.mock.method(console, 'error', () => {});

describe('OTP email through the real Resend SDK', () => {
    test('provider acceptance: the request is well-formed and the emailed code logs the user in', async () => {
        const { app } = appWithRealSdk();
        const res = await request(app).post('/api/auth/request-otp').send({ email: EMAIL });
        assert.equal(res.status, 200);
        assert.equal(res.body.expiresInSeconds, 300);
        assert.equal(res.body.resendAvailableInSeconds, 60);

        assert.equal(received.length, 1);
        const call = received[0];
        assert.equal(call.method, 'POST');
        assert.equal(call.url, '/emails');
        assert.equal(call.headers.authorization, 'Bearer re_test_local_key');
        assert.equal(call.body.from, 'Flexy <login@flexy.test>');
        assert.equal(call.body.to, EMAIL);
        assert.equal(call.body.subject, 'Your Flexy verification code');

        const code = call.body.text.match(/\b(\d{6})\b/)[1];
        assert.ok(call.body.html.includes(code));
        assert.match(call.body.html, /expires in <strong>5 minutes<\/strong>/);
        assert.match(call.body.html, /Do not share this code/);
        assert.match(call.body.text, /expires in 5 minutes/);
        assert.doesNotMatch(call.body.html + call.body.text, /eyJ|Bearer|re_test_local_key/);

        const verified = await request(app).post('/api/auth/verify-otp').send({ email: EMAIL, code });
        assert.equal(verified.status, 200);
        assert.ok(verified.body.token);
    });

    test('a 403 from Resend (e.g. unverified sender/recipient) is a failure, not success', async (t) => {
        quietErrors(t);
        behaviour = (req, res) => json(res, 403, {
            statusCode: 403,
            name: 'validation_error',
            message: 'You can only send testing emails to your own email address.'
        });
        const { app } = appWithRealSdk();
        const res = await request(app).post('/api/auth/request-otp').send({ email: EMAIL });
        assert.equal(res.status, 502);
        assert.match(res.body.error, /could not send/);
        const record = await OTPVerification.findOne({ email: EMAIL }).lean();
        assert.equal(record.codeHash, null, 'no usable code may remain after a failed send');
    });

    test('a Resend rate limit (429) returns 503 with Retry-After', async (t) => {
        quietErrors(t);
        behaviour = (req, res) => json(res, 429, { statusCode: 429, name: 'rate_limit_exceeded', message: 'Too many requests' });
        const { app } = appWithRealSdk();
        const res = await request(app).post('/api/auth/request-otp').send({ email: EMAIL });
        assert.equal(res.status, 503);
        assert.equal(res.headers['retry-after'], '60');
        assert.equal(res.body.retryAfter, 60);
    });

    test('a non-JSON 500 from the provider is handled as a failure', async (t) => {
        quietErrors(t);
        behaviour = (req, res) => { res.writeHead(500, { 'Content-Type': 'text/html' }); res.end('<html>oops</html>'); };
        const { app } = appWithRealSdk();
        const res = await request(app).post('/api/auth/request-otp').send({ email: EMAIL });
        assert.equal(res.status, 502);
    });

    test('a network failure (provider unreachable) returns 502 and invalidates the code', async (t) => {
        quietErrors(t);
        const closed = http.createServer();
        await new Promise(resolve => closed.listen(0, '127.0.0.1', resolve));
        const deadUrl = `http://127.0.0.1:${closed.address().port}`;
        await new Promise(resolve => closed.close(resolve));

        const { app } = appWithRealSdk({ baseUrl: deadUrl });
        const res = await request(app).post('/api/auth/request-otp').send({ email: EMAIL });
        assert.equal(res.status, 502);
        assert.equal((await OTPVerification.findOne({ email: EMAIL }).lean()).codeHash, null);
    });

    test('a hung provider is cancelled after the timeout', async (t) => {
        quietErrors(t);
        behaviour = (req, res) => { hangingResponses.push(res); };
        const { app } = appWithRealSdk({ timeoutMs: 300 });
        const started = Date.now();
        const res = await request(app).post('/api/auth/request-otp').send({ email: EMAIL });
        assert.equal(res.status, 502);
        assert.ok(Date.now() - started < 3000);
        assert.equal((await OTPVerification.findOne({ email: EMAIL }).lean()).codeHash, null);
    });

    test('after a failed send the user can retry immediately and the new code works', async (t) => {
        quietErrors(t);
        behaviour = (req, res) => json(res, 500, { statusCode: 500, name: 'application_error', message: 'boom' });
        const { app } = appWithRealSdk();
        assert.equal((await request(app).post('/api/auth/request-otp').send({ email: EMAIL })).status, 502);

        behaviour = (req, res) => json(res, 200, { id: 'email_retry' });
        assert.equal((await request(app).post('/api/auth/request-otp').send({ email: EMAIL })).status, 200);
        const code = received[received.length - 1].body.text.match(/\b(\d{6})\b/)[1];
        assert.equal((await request(app).post('/api/auth/verify-otp').send({ email: EMAIL, code })).status, 200);
    });
});
