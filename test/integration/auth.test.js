const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const OTPVerification = require('../../models/OTPVerification');
const User = require('../../models/User');
const { EmailDeliveryError } = require('../../lib/email');
const { OTP_MAX_ATTEMPTS } = require('../../lib/otp');
const h = require('../helpers');

let mongod;
before(async () => { mongod = await h.startDatabase(); });
after(async () => { await h.stopDatabase(mongod); });
beforeEach(async () => { await h.clearDatabase(); });

const EMAIL = 'collector@example.test';

function wrongCode(code) {
    return code === '999999' ? '000001' : '999999';
}

describe('POST /api/auth/request-otp', () => {
    test('rejects missing, malformed and non-string emails', async () => {
        const { app } = h.buildApp();
        assert.equal((await request(app).post('/api/auth/request-otp').send({})).status, 400);
        assert.equal((await request(app).post('/api/auth/request-otp').send({ email: 'nope' })).status, 400);
        assert.equal((await request(app).post('/api/auth/request-otp').send({ email: { $ne: null } })).status, 400);
        assert.equal(await OTPVerification.countDocuments(), 0);
    });

    test('returns 503 and stores nothing when no email provider is configured', async () => {
        const { app } = h.buildApp({ emailService: h.createFakeEmailService({ configured: false }) });
        const res = await request(app).post('/api/auth/request-otp').send({ email: EMAIL });
        assert.equal(res.status, 503);
        assert.match(res.body.error, /no email provider is configured/);
        assert.equal(await OTPVerification.countDocuments(), 0);
    });

    test('works end-to-end with the real email service when RESEND_API_KEY is missing (no crash)', async () => {
        const { createEmailService } = require('../../lib/email');
        const config = h.testConfig({ RESEND_API_KEY: '' });
        const { app } = h.buildApp({ env: { RESEND_API_KEY: '' }, emailService: createEmailService(config.email) });
        const res = await request(app).post('/api/auth/request-otp').send({ email: EMAIL });
        assert.equal(res.status, 503);
    });

    test('stores only an HMAC of the code, normalised to the lowercase email', async () => {
        const { app, emailService } = h.buildApp();
        const res = await request(app).post('/api/auth/request-otp').send({ email: '  Collector@Example.TEST ' });
        assert.equal(res.status, 200);
        assert.equal(emailService.sent.length, 1);
        assert.equal(emailService.sent[0].to, EMAIL);

        const record = await OTPVerification.findOne({ email: EMAIL }).lean();
        assert.ok(record.codeHash);
        assert.equal(record.otp, undefined);
        assert.ok(!JSON.stringify(record).includes(emailService.sent[0].code));
        const ttlMs = record.codeExpiresAt - record.lastSentAt;
        assert.equal(ttlMs, 5 * 60 * 1000);
    });

    test('a provider failure returns 502 and leaves no usable code behind', async () => {
        const { app, emailService } = h.buildApp();
        emailService.failures.push(new EmailDeliveryError('Provider rejected the message'));
        const res = await request(app).post('/api/auth/request-otp').send({ email: EMAIL });
        assert.equal(res.status, 502);
        assert.doesNotMatch(JSON.stringify(res.body), /sent/i);

        const record = await OTPVerification.findOne({ email: EMAIL }).lean();
        assert.equal(record.codeHash, null);

        // The cooldown is handed back, so an immediate retry is allowed.
        const retry = await request(app).post('/api/auth/request-otp').send({ email: EMAIL });
        assert.equal(retry.status, 200);
    });

    test('enforces a per-email cooldown between sends', async () => {
        const { app, emailService } = h.buildApp();
        assert.equal((await request(app).post('/api/auth/request-otp').send({ email: EMAIL })).status, 200);
        const second = await request(app).post('/api/auth/request-otp').send({ email: EMAIL });
        assert.equal(second.status, 429);
        assert.ok(Number(second.headers['retry-after']) > 0);
        assert.equal(emailService.sent.length, 1);
    });

    test('caps the number of sends per email per hour', async () => {
        const { app } = h.buildApp();
        await OTPVerification.create({
            email: EMAIL,
            codeHash: null,
            lastSentAt: new Date(Date.now() - 2 * 60 * 1000),
            sendCount: 10,
            windowStartedAt: new Date(Date.now() - 10 * 60 * 1000),
            expiresAt: new Date(Date.now() + 50 * 60 * 1000)
        });
        const res = await request(app).post('/api/auth/request-otp').send({ email: EMAIL });
        assert.equal(res.status, 429);
        assert.match(res.body.error, /Too many codes/);
    });

    test('concurrent requests for one email send at most one code', async () => {
        const { app, emailService } = h.buildApp();
        const results = await Promise.all(Array.from({ length: 5 }, () =>
            request(app).post('/api/auth/request-otp').send({ email: EMAIL })));
        assert.equal(results.filter(r => r.status === 200).length, 1);
        assert.equal(emailService.sent.length, 1);
        assert.equal(await OTPVerification.countDocuments({ email: EMAIL }), 1);
    });

    test('responds identically for registered and unregistered emails', async () => {
        const { app } = h.buildApp();
        await h.createUser({ email: 'known@example.test' });
        const known = await request(app).post('/api/auth/request-otp').send({ email: 'known@example.test' });
        const unknown = await request(app).post('/api/auth/request-otp').send({ email: 'unknown@example.test' });
        assert.equal(known.status, unknown.status);
        assert.deepEqual(known.body, unknown.body);
    });

    test('the per-IP limiter returns 429 once exceeded', async () => {
        const { app } = h.buildApp({ rateLimits: { otpRequest: { limit: 2 }, otpVerify: { limit: 100 } } });
        await request(app).post('/api/auth/request-otp').send({ email: 'a@example.test' });
        await request(app).post('/api/auth/request-otp').send({ email: 'b@example.test' });
        const third = await request(app).post('/api/auth/request-otp').send({ email: 'c@example.test' });
        assert.equal(third.status, 429);
        assert.match(third.body.error, /Too many code requests/);
    });
});

describe('POST /api/auth/verify-otp', () => {
    async function requestCode(app, emailService, email = EMAIL) {
        await request(app).post('/api/auth/request-otp').send({ email });
        return emailService.lastCodeFor(email);
    }

    test('the universal 000000 bypass no longer works', async () => {
        const { app, emailService } = h.buildApp();
        const code = await requestCode(app, emailService);
        if (code === '000000') return; // one-in-a-million: the real code
        const res = await request(app).post('/api/auth/verify-otp').send({ email: EMAIL, code: '000000' });
        assert.equal(res.status, 400);
        assert.equal(res.body.token, undefined);
    });

    test('000000 does not work without any code requested either', async () => {
        const { app } = h.buildApp();
        const res = await request(app).post('/api/auth/verify-otp').send({ email: EMAIL, code: '000000' });
        assert.equal(res.status, 400);
        assert.equal(await User.countDocuments(), 0);
    });

    test('rejects malformed input', async () => {
        const { app } = h.buildApp();
        assert.equal((await request(app).post('/api/auth/verify-otp').send({ email: EMAIL })).status, 400);
        assert.equal((await request(app).post('/api/auth/verify-otp').send({ email: EMAIL, code: '12' })).status, 400);
        assert.equal((await request(app).post('/api/auth/verify-otp').send({ email: EMAIL, code: { $gt: '' } })).status, 400);
    });

    test('a correct code logs in, creates the account and sets a secure refresh cookie', async () => {
        const { app, emailService, config } = h.buildApp();
        const session = await h.loginViaOtp(app, emailService, EMAIL);

        assert.equal(session.isNewUser, true);
        assert.equal(session.user.email, EMAIL);
        const decoded = jwt.verify(session.token, config.jwt.accessSecret);
        assert.equal(decoded.userId, String(session.user._id));

        const cookie = session.setCookie.find(c => c.startsWith('refreshToken='));
        assert.match(cookie, /HttpOnly/);
        assert.match(cookie, /SameSite=Lax/);

        const user = await User.findOne({ email: EMAIL });
        assert.equal(user.isEmailVerified, true);
        assert.match(user.username, /^user_[0-9a-f]{8}$/);
    });

    test('a code can only be used once', async () => {
        const { app, emailService } = h.buildApp();
        const code = await requestCode(app, emailService);
        assert.equal((await request(app).post('/api/auth/verify-otp').send({ email: EMAIL, code })).status, 200);
        const reuse = await request(app).post('/api/auth/verify-otp').send({ email: EMAIL, code });
        assert.equal(reuse.status, 400);
    });

    test('concurrent submissions of the correct code produce exactly one session', async () => {
        const { app, emailService } = h.buildApp();
        const code = await requestCode(app, emailService);
        const results = await Promise.all(Array.from({ length: 6 }, () =>
            request(app).post('/api/auth/verify-otp').send({ email: EMAIL, code })));
        assert.equal(results.filter(r => r.status === 200).length, 1);
        assert.equal(await User.countDocuments({ email: EMAIL }), 1);
    });

    test('a code is bound to the email it was sent to', async () => {
        const { app, emailService } = h.buildApp();
        const code = await requestCode(app, emailService, 'first@example.test');
        await requestCode(app, emailService, 'second@example.test');
        const res = await request(app).post('/api/auth/verify-otp').send({ email: 'second@example.test', code });
        if (code === emailService.lastCodeFor('second@example.test')) return; // identical random codes
        assert.equal(res.status, 400);
    });

    test('wrong codes count attempts and lock the code after the limit', async () => {
        const { app, emailService } = h.buildApp();
        const code = await requestCode(app, emailService);
        for (let i = 1; i <= OTP_MAX_ATTEMPTS; i++) {
            const res = await request(app).post('/api/auth/verify-otp').send({ email: EMAIL, code: wrongCode(code) });
            assert.equal(res.status, 400);
        }
        const locked = await request(app).post('/api/auth/verify-otp').send({ email: EMAIL, code });
        assert.equal(locked.status, 400);
        assert.match(locked.body.error, /Too many attempts/);
    });

    test('parallel guessing cannot exceed the attempt limit', async () => {
        const { app, emailService } = h.buildApp();
        const code = await requestCode(app, emailService);
        await Promise.all(Array.from({ length: 20 }, () =>
            request(app).post('/api/auth/verify-otp').send({ email: EMAIL, code: wrongCode(code) })));
        const record = await OTPVerification.findOne({ email: EMAIL }).lean();
        assert.equal(record.attempts, OTP_MAX_ATTEMPTS);
    });

    test('expired codes are rejected', async () => {
        const { app, emailService } = h.buildApp();
        const code = await requestCode(app, emailService);
        await OTPVerification.updateOne({ email: EMAIL }, { $set: { codeExpiresAt: new Date(Date.now() - 1000) } });
        const res = await request(app).post('/api/auth/verify-otp').send({ email: EMAIL, code });
        assert.equal(res.status, 400);
        assert.match(res.body.error, /expired/);
    });

    test('legacy plaintext OTP records cannot be used', async () => {
        const { app } = h.buildApp();
        await OTPVerification.collection.insertOne({
            email: EMAIL, otp: '424242', attempts: 0, expiresAt: new Date(Date.now() + 60000)
        });
        const res = await request(app).post('/api/auth/verify-otp').send({ email: EMAIL, code: '424242' });
        assert.equal(res.status, 400);
    });

    test('requesting a new code invalidates the previous one', async () => {
        const { app, emailService } = h.buildApp();
        const first = await requestCode(app, emailService);
        // Skip the 60s resend cooldown instead of waiting for it.
        await OTPVerification.updateOne({ email: EMAIL }, { $set: { lastSentAt: new Date(Date.now() - 61 * 1000) } });
        const second = await requestCode(app, emailService);
        assert.equal(emailService.sent.length, 2);
        if (first === second) return; // identical random codes (1 in a million)

        const old = await request(app).post('/api/auth/verify-otp').send({ email: EMAIL, code: first });
        assert.equal(old.status, 400);
        const fresh = await request(app).post('/api/auth/verify-otp').send({ email: EMAIL, code: second });
        assert.equal(fresh.status, 200);
    });

    test('a wrong guess does not lock the user out: attempts are per code', async () => {
        const { app, emailService } = h.buildApp();
        const code = await requestCode(app, emailService);
        const wrong = await request(app).post('/api/auth/verify-otp').send({ email: EMAIL, code: wrongCode(code) });
        assert.equal(wrong.body.reason, 'incorrect_code');
        assert.equal(wrong.body.attemptsRemaining, 4);
        assert.equal((await request(app).post('/api/auth/verify-otp').send({ email: EMAIL, code })).status, 200);
    });

    test('error responses carry a machine-readable reason', async () => {
        const { app, emailService } = h.buildApp();
        assert.equal((await request(app).post('/api/auth/verify-otp').send({ email: EMAIL, code: '12' })).body.reason, 'invalid_request');
        assert.equal((await request(app).post('/api/auth/verify-otp').send({ email: EMAIL, code: '123456' })).body.reason, 'invalid_code');

        const code = await requestCode(app, emailService);
        await OTPVerification.updateOne({ email: EMAIL }, { $set: { codeExpiresAt: new Date(Date.now() - 1000) } });
        assert.equal((await request(app).post('/api/auth/verify-otp').send({ email: EMAIL, code })).body.reason, 'expired');
    });

    test('the per-IP verification limiter returns 429 once exceeded', async () => {
        const { app } = h.buildApp({ rateLimits: { otpRequest: { limit: 100 }, otpVerify: { limit: 3 } } });
        for (let i = 0; i < 3; i++) {
            await request(app).post('/api/auth/verify-otp').send({ email: `x${i}@example.test`, code: '123456' });
        }
        const blocked = await request(app).post('/api/auth/verify-otp').send({ email: EMAIL, code: '123456' });
        assert.equal(blocked.status, 429);
        assert.match(blocked.body.error, /Too many verification attempts/);
    });

    test('an existing verified user logs in with isNewUser=false', async () => {
        const { app, emailService } = h.buildApp();
        await h.createUser({ email: EMAIL, isVerified: true });
        const session = await h.loginViaOtp(app, emailService, EMAIL);
        assert.equal(session.isNewUser, false);
        assert.equal(await User.countDocuments({ email: EMAIL }), 1);
    });
});

describe('database failures', () => {
    const quiet = (t) => t.mock.method(console, 'error', () => {});

    test('a database error while requesting a code returns 500 and sends nothing', async (t) => {
        quiet(t);
        const { app, emailService } = h.buildApp();
        t.mock.method(OTPVerification, 'findOne', () => ({ lean: () => Promise.reject(new Error('connection reset')) }));
        const res = await request(app).post('/api/auth/request-otp').send({ email: EMAIL });
        assert.equal(res.status, 500);
        assert.deepEqual(res.body, { error: 'Server error' });
        assert.equal(emailService.sent.length, 0);
    });

    test('a database error while saving the code returns 500 and sends nothing', async (t) => {
        quiet(t);
        const { app, emailService } = h.buildApp();
        t.mock.method(OTPVerification, 'create', () => Promise.reject(new Error('write concern failed')));
        const res = await request(app).post('/api/auth/request-otp').send({ email: EMAIL });
        assert.equal(res.status, 500);
        assert.equal(emailService.sent.length, 0);
    });

    test('a database error during verification never issues a session', async (t) => {
        quiet(t);
        const { app, emailService } = h.buildApp();
        await request(app).post('/api/auth/request-otp').send({ email: EMAIL });
        const code = emailService.lastCodeFor(EMAIL);
        t.mock.method(OTPVerification, 'findOneAndUpdate', () => Promise.reject(new Error('primary stepped down')));

        const res = await request(app).post('/api/auth/verify-otp').send({ email: EMAIL, code });
        assert.equal(res.status, 500);
        assert.equal(res.body.token, undefined);
        assert.equal(res.headers['set-cookie'], undefined);
        assert.doesNotMatch(JSON.stringify(res.body), /primary stepped down/);
    });

    test('an unexpected exception from the email service is reported as a failed send', async (t) => {
        quiet(t);
        const { app, emailService } = h.buildApp();
        emailService.failures.push(new TypeError('fetch failed'));
        const res = await request(app).post('/api/auth/request-otp').send({ email: EMAIL });
        assert.equal(res.status, 502);
        assert.equal((await OTPVerification.findOne({ email: EMAIL }).lean()).codeHash, null);
    });
});

describe('sessions: refresh, logout and token checks', () => {
    test('the token issued by OTP login authorizes protected marketplace routes', async () => {
        const { app, emailService } = h.buildApp();
        const session = await h.loginViaOtp(app, emailService, EMAIL);
        const auth = { Authorization: `Bearer ${session.token}` };

        assert.equal((await request(app).get('/api/notifications').set(auth)).status, 200);
        const created = await request(app).post('/api/auctions').set(auth)
            .send({ title: 'Coin', description: 'Rare', startingBid: 10, durationHours: 24 });
        assert.equal(created.status, 201);
        assert.equal(String(created.body.seller), String(session.user._id));

        assert.equal((await request(app).get('/api/notifications')).status, 401);
        assert.equal((await request(app).post('/api/auctions').send({ title: 'x', description: 'y', startingBid: 10, durationHours: 24 })).status, 401);
    });

    test('refresh requires the cookie and issues a new access token', async () => {
        const { app, emailService, config } = h.buildApp();
        assert.equal((await request(app).post('/api/auth/refresh')).status, 401);

        const session = await h.loginViaOtp(app, emailService, EMAIL);
        const res = await request(app).post('/api/auth/refresh').set('Cookie', session.cookie);
        assert.equal(res.status, 200);
        assert.equal(jwt.verify(res.body.token, config.jwt.accessSecret).userId, String(session.user._id));
    });

    test('logout revokes the refresh token server-side', async () => {
        const { app, emailService } = h.buildApp();
        const session = await h.loginViaOtp(app, emailService, EMAIL);

        const out = await request(app).post('/api/auth/logout').set('Cookie', session.cookie);
        assert.equal(out.status, 200);
        assert.match(out.headers['set-cookie'].join(';'), /refreshToken=;/);

        // Replaying the old cookie after logout must fail.
        const replay = await request(app).post('/api/auth/refresh').set('Cookie', session.cookie);
        assert.equal(replay.status, 401);
    });

    test('a refresh token signed with the old hardcoded fallback secret is rejected', async () => {
        const { app } = h.buildApp();
        const user = await h.createUser();
        const forged = jwt.sign({ userId: String(user._id) }, 'flexy_secure_refresh_key_2026', { expiresIn: '30d' });
        const res = await request(app).post('/api/auth/refresh').set('Cookie', `refreshToken=${forged}`);
        assert.equal(res.status, 401);
    });

    test('protected routes reject missing, forged, expired and alg=none tokens', async () => {
        const { app, config } = h.buildApp();
        const user = await h.createUser();
        const id = String(user._id);

        assert.equal((await request(app).get('/api/auth/me')).status, 401);
        for (const secret of ['flexy_secure_jwt_key_2026', 'super-secret-flexy-key-2026']) {
            const forged = jwt.sign({ userId: id }, secret);
            assert.equal((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${forged}`)).status, 401);
        }
        const expired = jwt.sign({ userId: id, exp: Math.floor(Date.now() / 1000) - 10 }, config.jwt.accessSecret);
        assert.equal((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${expired}`)).status, 401);

        const none = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url') + '.' +
            Buffer.from(JSON.stringify({ userId: id })).toString('base64url') + '.';
        assert.equal((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${none}`)).status, 401);

        const ok = await request(app).get('/api/auth/me').set(h.authHeader(config, user));
        assert.equal(ok.status, 200);
        assert.equal(ok.body.email, user.email);
        assert.equal(ok.body.tokenVersion, undefined);
    });
});
