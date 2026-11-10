const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const argon2 = require('argon2');
const User = require('../../models/User');
const PasswordSetupToken = require('../../models/PasswordSetupToken');
const { hashPassword } = require('../../lib/passwords');
const { createPasswordSetupToken } = require('../../lib/password-setup');
const h = require('../helpers');

let mongod;
before(async () => { mongod = await h.startDatabase(); });
after(async () => { await h.stopDatabase(mongod); });
beforeEach(async () => { await h.clearDatabase(); });

const INVALID_CREDENTIALS = { error: 'Incorrect username, email or password.' };
const NEW_PASSWORD = 'Brass compass 1888';

const signupReq = (app, fields) => request(app).post('/api/auth/signup').send(fields);
const loginReq = (app, identifier, password) => request(app).post('/api/auth/login').send({ identifier, password });

// An account as the retired email sign-in left it: no password and, for older
// documents, no profileCompleted field at all.
async function insertLegacyUser(fields = {}) {
    const { insertedId } = await User.collection.insertOne({
        email: 'legacy@example.test',
        username: 'user_1a2b3c4d',
        displayName: 'legacy',
        isVerified: true,
        isEmailVerified: true,
        interests: ['Stamps'],
        tokenVersion: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...fields
    });
    return User.findById(insertedId);
}


const registerReq = (app, fields) => request(app).post('/api/auth/register').send(fields);

describe('POST /api/auth/register', () => {
    test('creates an account with name, email, password, confirmPassword and returns complete profile session', async () => {
        const { app } = h.buildApp();
        const res = await registerReq(app, {
            name: 'Shan Reddy',
            email: 'shanmukha@example.com',
            password: 'SecurePassword123',
            confirmPassword: 'SecurePassword123'
        });
        assert.equal(res.status, 201);
        assert.ok(res.body.token);
        assert.ok(res.body.accessToken);
        assert.equal(res.body.user.displayName, 'Shan Reddy');
        assert.equal(res.body.user.email, 'shanmukha@example.com');
        assert.equal(res.body.user.profileCompleted, true);
        assert.ok(res.body.user.username);

        // Verify account in database
        const dbUser = await User.findOne({ email: 'shanmukha@example.com' }).select('+passwordHash');
        assert.ok(dbUser);
        assert.equal(dbUser.displayName, 'Shan Reddy');
        assert.ok(dbUser.passwordHash);
        assert.notEqual(dbUser.passwordHash, 'SecurePassword123');
        const valid = await argon2.verify(dbUser.passwordHash, 'SecurePassword123');
        assert.equal(valid, true);
    });

    test('rejects duplicate email registration with 409', async () => {
        const { app } = h.buildApp();
        const res1 = await registerReq(app, {
            name: 'First User',
            email: 'duplicate@example.com',
            password: 'StrongWatch1962',
            confirmPassword: 'StrongWatch1962'
        });
        assert.equal(res1.status, 201);

        const res2 = await registerReq(app, {
            name: 'Second User',
            email: 'duplicate@example.com',
            password: 'AnotherWatch1962',
            confirmPassword: 'AnotherWatch1962'
        });
        assert.equal(res2.status, 409);
        assert.match(res2.body.error, /already exists/i);
    });

    test('validates invalid email, password mismatch and short password', async () => {
        const { app } = h.buildApp();

        // Invalid email
        const resEmail = await registerReq(app, {
            name: 'Test User',
            email: 'not-an-email',
            password: 'StrongWatch1962',
            confirmPassword: 'StrongWatch1962'
        });
        assert.equal(resEmail.status, 400);

        // Password mismatch
        const resMismatch = await registerReq(app, {
            name: 'Test User',
            email: 'valid@example.com',
            password: 'StrongWatch1962',
            confirmPassword: 'DifferentWatch1962'
        });
        assert.equal(resMismatch.status, 400);
        assert.match(resMismatch.body.error, /match/i);

        // Short password
        const resShort = await registerReq(app, {
            name: 'Test User',
            email: 'valid@example.com',
            password: 'short',
            confirmPassword: 'short'
        });
        assert.equal(resShort.status, 400);
    });

    test('logs in with email and password, and fails with invalid credentials', async () => {
        const { app } = h.buildApp();
        await registerReq(app, {
            name: 'Login Test',
            email: 'logintest@example.com',
            password: 'ValidPassword123',
            confirmPassword: 'ValidPassword123'
        });

        // Valid login with email
        const loginRes = await request(app).post('/api/auth/login').send({
            email: 'logintest@example.com',
            password: 'ValidPassword123'
        });
        assert.equal(loginRes.status, 200);
        assert.ok(loginRes.body.token);
        assert.ok(loginRes.body.accessToken);
        assert.equal(loginRes.body.user.email, 'logintest@example.com');

        // Invalid password
        const wrongPwRes = await request(app).post('/api/auth/login').send({
            email: 'logintest@example.com',
            password: 'WrongPassword999'
        });
        assert.equal(wrongPwRes.status, 401);

        // Unknown email
        const unknownRes = await request(app).post('/api/auth/login').send({
            email: 'nobody@example.com',
            password: 'ValidPassword123'
        });
        assert.equal(unknownRes.status, 401);
    });
});

describe('POST /api/auth/signup', () => {
    test('creates an account with an Argon2id hash and returns a session', async () => {
        const { app, config } = h.buildApp();
        const res = await signupReq(app, h.signupFields({ username: '  @Shan_Collects ', email: '  Shan@Example.TEST ' }));
        assert.equal(res.status, 201);

        const { user } = res.body;
        assert.equal(user.username, 'shan_collects');
        assert.equal(user.email, 'shan@example.test');
        assert.equal(user.displayName, 'Shan Reddy');
        assert.equal(user.phone, '+919876543210');
        assert.equal(user.profileCompleted, false);

        const claims = jwt.verify(res.body.token, config.jwt.accessSecret);
        assert.equal(claims.userId, String(user._id));
        assert.equal(claims.pc, false);
        const cookie = res.headers['set-cookie'].find(c => c.startsWith('refreshToken='));
        assert.match(cookie, /HttpOnly/);
        assert.match(cookie, /SameSite=Lax/);

        const stored = await User.findById(user._id).select('+passwordHash').lean();
        assert.match(stored.passwordHash, /^\$argon2id\$/);
        assert.ok(await argon2.verify(stored.passwordHash, h.PASSWORD));
        assert.ok(!JSON.stringify(stored).includes(h.PASSWORD));
        assert.equal(stored.profileCompleted, false);
        assert.equal(stored.isEmailVerified, false);
    });

    test('responses never contain the password or its hash, and claim nothing is verified', async () => {
        const { app } = h.buildApp();
        const res = await signupReq(app, h.signupFields());
        const body = JSON.stringify(res.body);
        assert.doesNotMatch(body, /argon2|passwordHash|Vintage watch/);
        assert.equal(res.body.user.isVerified, undefined);
        assert.equal(res.body.user.isEmailVerified, undefined);
    });

    test('rejects a duplicate username in any letter case and a duplicate email in any case', async () => {
        const { app } = h.buildApp();
        await h.signup(app, { username: 'shan', email: 'first@example.test' });

        const dupUser = await signupReq(app, h.signupFields({ username: 'SHAN', email: 'second@example.test' }));
        assert.equal(dupUser.status, 409);
        assert.match(dupUser.body.fields.username, /taken/);
        assert.equal(dupUser.body.fields.email, undefined);

        const dupEmail = await signupReq(app, h.signupFields({ username: 'someone_else', email: ' FIRST@Example.test ' }));
        assert.equal(dupEmail.status, 409);
        assert.match(dupEmail.body.fields.email, /already exists/);
        assert.equal(dupEmail.headers['set-cookie'], undefined);

        assert.equal(await User.countDocuments(), 1);
    });

    test('an older mixed-case username blocks the same name in lowercase', async () => {
        const { app } = h.buildApp();
        await h.createUser({ username: 'ShanR' });
        const res = await signupReq(app, h.signupFields({ username: 'shanr' }));
        assert.equal(res.status, 409);
    });

    test('concurrent signups for one username create exactly one account', async () => {
        const { app } = h.buildApp();
        const results = await Promise.all(Array.from({ length: 5 }, (_, i) =>
            signupReq(app, h.signupFields({ username: 'race_winner', email: `racer${i}@example.test` }))));
        assert.equal(results.filter(r => r.status === 201).length, 1);
        assert.ok(results.filter(r => r.status !== 201).every(r => r.status === 409));
        assert.equal(await User.countDocuments({ username: 'race_winner' }), 1);
    });

    test('the database itself enforces unique usernames and emails', async () => {
        await User.create({ username: 'unique_one', email: 'u1@example.test', displayName: 'A' });
        await assert.rejects(User.create({ username: 'unique_one', email: 'u2@example.test', displayName: 'B' }), { code: 11000 });
        await assert.rejects(User.create({ username: 'unique_two', email: 'U1@example.test', displayName: 'C' }), { code: 11000 });
    });

    test('reports a message for every invalid field and creates nothing', async () => {
        const { app } = h.buildApp();
        const res = await signupReq(app, {
            fullName: '   ', username: 'a', phone: 'call me', email: 'nope', password: 'short', confirmPassword: 'different'
        });
        assert.equal(res.status, 400);
        assert.deepEqual(Object.keys(res.body.fields).sort(),
            ['confirmPassword', 'email', 'fullName', 'password', 'phone', 'username']);
        assert.equal(await User.countDocuments(), 0);
    });

    test('enforces the password policy and the confirmation', async () => {
        const { app } = h.buildApp();
        const common = await signupReq(app, h.signupFields({ password: 'password123', confirmPassword: 'password123' }));
        assert.match(common.body.fields.password, /too common/);

        const noDigit = await signupReq(app, h.signupFields({ password: 'only letters here', confirmPassword: 'only letters here' }));
        assert.match(noDigit.body.fields.password, /letter and one number/);

        const sameAsUsername = await signupReq(app, h.signupFields({ username: 'coins4ever', password: 'Coins4Ever', confirmPassword: 'Coins4Ever' }));
        assert.match(sameAsUsername.body.fields.password, /username or email/);

        const mismatch = await signupReq(app, h.signupFields({ confirmPassword: 'Something else 1' }));
        assert.equal(mismatch.status, 400);
        assert.match(mismatch.body.fields.confirmPassword, /do not match/);
        assert.equal(await User.countDocuments(), 0);
    });

    test('rejects missing bodies, non-strings and operator injection without a server error', async () => {
        const { app } = h.buildApp();
        assert.equal((await request(app).post('/api/auth/signup')).status, 400);
        const res = await signupReq(app, {
            fullName: { $ne: '' }, username: { $gt: '' }, phone: ['98765'], email: { $ne: null }, password: { $ne: '' }, confirmPassword: 1
        });
        assert.equal(res.status, 400);
        assert.equal(Object.keys(res.body.fields).length, 6);
    });

    test('reserved usernames are refused', async () => {
        const { app } = h.buildApp();
        const res = await signupReq(app, h.signupFields({ username: 'Admin' }));
        assert.equal(res.status, 400);
        assert.match(res.body.fields.username, /reserved/);
    });

    test('phone numbers are contact details: not unique and not verified', async () => {
        const { app } = h.buildApp();
        const a = await h.signup(app, { phone: '+91 90000 00001' });
        const b = await h.signup(app, { phone: '+91-90000-00001' });
        assert.equal(a.user.phone, b.user.phone);
        assert.equal(await User.countDocuments({ phone: '+919000000001' }), 2);
    });

    test('signup is rate limited per network', async () => {
        const { app } = h.buildApp({ rateLimits: { signup: { limit: 2 } } });
        await h.signup(app);
        await h.signup(app);
        const third = await signupReq(app, h.signupFields());
        assert.equal(third.status, 429);
        assert.match(third.body.error, /Too many accounts/);
    });
});

describe('POST /api/auth/login', () => {
    test('logs in with the username or the email, in any letter case', async () => {
        const { app, config } = h.buildApp();
        const account = await h.signup(app, { username: 'shan_collects', email: 'shan@example.test' });

        for (const identifier of ['shan_collects', '@SHAN_Collects', ' Shan@Example.TEST ']) {
            const session = await h.login(app, identifier);
            assert.equal(String(session.user._id), String(account.user._id), identifier);
            assert.equal(jwt.verify(session.token, config.jwt.accessSecret).userId, String(account.user._id));
            assert.ok(session.setCookie.some(c => c.startsWith('refreshToken=') && /HttpOnly/.test(c)));
            assert.doesNotMatch(JSON.stringify(session.user), /argon2|passwordHash/);
        }
    });

    test('an older account with a mixed-case username can log in once it has a password', async () => {
        const { app } = h.buildApp();
        await h.createUser({ username: 'ShanR', passwordHash: await hashPassword(h.PASSWORD) });
        assert.equal((await loginReq(app, 'shanr', h.PASSWORD)).status, 200);
    });

    test('a wrong password, an unknown account and an account without a password get the same answer', async () => {
        const { app } = h.buildApp();
        await h.signup(app, { username: 'shan', email: 'shan@example.test' });
        await insertLegacyUser();

        const answers = [
            await loginReq(app, 'shan', 'Wrong password 1'),
            await loginReq(app, 'shan@example.test', 'Wrong password 1'),
            await loginReq(app, 'nobody_here', h.PASSWORD),
            await loginReq(app, 'nobody@example.test', h.PASSWORD),
            await loginReq(app, 'legacy@example.test', h.PASSWORD),
            await loginReq(app, 'shan', 'x'.repeat(5000))
        ];
        for (const res of answers) {
            assert.equal(res.status, 401);
            assert.deepEqual(res.body, INVALID_CREDENTIALS);
            assert.equal(res.headers['set-cookie'], undefined);
        }
    });

    test('the old universal codes do not log anyone in, and the OTP endpoints are gone', async () => {
        const { app } = h.buildApp();
        await insertLegacyUser();
        await h.signup(app, { email: 'member@example.test' });
        for (const code of ['000000', '123456']) {
            assert.equal((await loginReq(app, 'legacy@example.test', code)).status, 401);
            assert.equal((await loginReq(app, 'member@example.test', code)).status, 401);
        }
        for (const path of ['/api/auth/request-otp', '/api/auth/verify-otp']) {
            const res = await request(app).post(path).send({ email: 'legacy@example.test', code: '000000' });
            assert.equal(res.status, 404);
            assert.equal(res.body.token, undefined);
        }
    });

    test('rejects missing and malformed input with 400', async () => {
        const { app } = h.buildApp();
        assert.equal((await request(app).post('/api/auth/login')).status, 400);
        assert.equal((await loginReq(app, 'shan', '')).status, 400);
        assert.equal((await loginReq(app, '', h.PASSWORD)).status, 400);
        assert.equal((await loginReq(app, { $ne: null }, h.PASSWORD)).status, 400);
        assert.equal((await loginReq(app, 'shan', { $ne: '' })).status, 400);
    });

    test('repeated failures lock an identifier, whether or not the account exists', async () => {
        const { app } = h.buildApp({ rateLimits: { loginAccount: { limit: 3 } } });
        await h.signup(app, { username: 'target' });
        await h.signup(app, { username: 'bystander' });

        for (let i = 0; i < 3; i++) assert.equal((await loginReq(app, 'target', `Guess number ${i}`)).status, 401);
        const locked = await loginReq(app, 'target', h.PASSWORD);
        assert.equal(locked.status, 429);
        assert.match(locked.body.error, /this account/);
        // Other accounts are unaffected.
        assert.equal((await loginReq(app, 'bystander', h.PASSWORD)).status, 200);

        for (let i = 0; i < 3; i++) await loginReq(app, 'ghost_account', `Guess number ${i}`);
        const ghost = await loginReq(app, 'ghost_account', h.PASSWORD);
        assert.equal(ghost.status, 429);
        assert.equal(ghost.body.error, locked.body.error);
    });

    test('the per-network limit counts failed logins only', async () => {
        const { app } = h.buildApp({ rateLimits: { login: { limit: 3 } } });
        await h.signup(app, { username: 'regular' });
        for (let i = 0; i < 5; i++) assert.equal((await loginReq(app, 'regular', h.PASSWORD)).status, 200);

        for (let i = 0; i < 3; i++) await loginReq(app, `stranger_${i}`, 'Guess number 1');
        const blocked = await loginReq(app, 'regular', h.PASSWORD);
        assert.equal(blocked.status, 429);
        assert.match(blocked.body.error, /from this network/);
    });

    test('a hash with outdated parameters is upgraded on the next login', async () => {
        const { app } = h.buildApp();
        const weak = await argon2.hash(h.PASSWORD, { type: argon2.argon2id, memoryCost: 4096, timeCost: 1, parallelism: 1 });
        const user = await h.createUser({ username: 'old_hash', passwordHash: weak });
        assert.equal((await loginReq(app, 'old_hash', h.PASSWORD)).status, 200);
        const stored = await User.findById(user._id).select('+passwordHash').lean();
        assert.match(stored.passwordHash, /m=19456/);
        assert.equal((await loginReq(app, 'old_hash', h.PASSWORD)).status, 200);
    });
});

describe('sessions: refresh, logout and cross-site protection', () => {
    test('refresh needs the cookie and returns a new token with the profile claim', async () => {
        const { app, config } = h.buildApp();
        assert.equal((await request(app).post('/api/auth/refresh')).status, 401);

        const session = await h.signup(app);
        const res = await request(app).post('/api/auth/refresh').set('Cookie', session.cookie);
        assert.equal(res.status, 200);
        const claims = jwt.verify(res.body.token, config.jwt.accessSecret);
        assert.equal(claims.userId, String(session.user._id));
        assert.equal(claims.pc, false);
        assert.equal(res.body.user.profileCompleted, false);
    });

    test('logout revokes the refresh tokens of every device', async () => {
        const { app } = h.buildApp();
        const phone = await h.signup(app, { username: 'two_devices' });
        const laptop = await h.login(app, 'two_devices');

        const out = await request(app).post('/api/auth/logout').set('Cookie', phone.cookie);
        assert.equal(out.status, 200);
        assert.match(out.headers['set-cookie'].join(';'), /refreshToken=;/);

        assert.equal((await request(app).post('/api/auth/refresh').set('Cookie', phone.cookie)).status, 401);
        assert.equal((await request(app).post('/api/auth/refresh').set('Cookie', laptop.cookie)).status, 401);
        // Logging in again works and starts a fresh session.
        const again = await h.login(app, 'two_devices');
        assert.equal((await request(app).post('/api/auth/refresh').set('Cookie', again.cookie)).status, 200);
    });

    test('cookie endpoints refuse requests from other sites but accept the app\'s own origins', async () => {
        const { app } = h.buildApp();
        const session = await h.signup(app, { username: 'origin_test' });
        const evil = 'https://evil.example';

        assert.equal((await signupReq(app, h.signupFields()).set('Origin', evil)).status, 403);
        assert.equal((await loginReq(app, 'origin_test', h.PASSWORD).set('Origin', evil)).status, 403);
        assert.equal((await request(app).post('/api/auth/refresh').set('Origin', evil).set('Cookie', session.cookie)).status, 403);
        assert.equal((await request(app).post('/api/auth/logout').set('Origin', evil).set('Cookie', session.cookie)).status, 403);
        assert.equal((await request(app).post('/api/auth/refresh').set('Cookie', session.cookie)).status, 200);

        assert.equal((await loginReq(app, 'origin_test', h.PASSWORD).set('Origin', 'https://flexy-peach.vercel.app')).status, 200);
        assert.equal((await loginReq(app, 'origin_test', h.PASSWORD).set('Origin', 'http://localhost:3001')).status, 200);
        // Same origin as the API itself (pages served by Express).
        const same = await loginReq(app, 'origin_test', h.PASSWORD).set('Host', 'api.flexy.test').set('Origin', 'http://api.flexy.test');
        assert.equal(same.status, 200);
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
        assert.equal((await request(app).post('/api/auctions').send({ title: 'x' })).status, 401);
        for (const secret of ['flexy_secure_jwt_key_2026', 'super-secret-flexy-key-2026']) {
            const forged = jwt.sign({ userId: id, pc: true }, secret);
            assert.equal((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${forged}`)).status, 401);
            assert.equal((await request(app).get('/api/notifications').set('Authorization', `Bearer ${forged}`)).status, 401);
        }
        const expired = jwt.sign({ userId: id, pc: true, exp: Math.floor(Date.now() / 1000) - 10 }, config.jwt.accessSecret);
        assert.equal((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${expired}`)).status, 401);

        const none = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url') + '.' +
            Buffer.from(JSON.stringify({ userId: id, pc: true })).toString('base64url') + '.';
        assert.equal((await request(app).get('/api/notifications').set('Authorization', `Bearer ${none}`)).status, 401);

        const ok = await request(app).get('/api/auth/me').set(h.authHeader(config, user));
        assert.equal(ok.status, 200);
        assert.equal(ok.body.email, user.email);
        assert.equal(ok.body.tokenVersion, undefined);
        assert.equal(ok.body.passwordHash, undefined);
    });
});

describe('passwords: change and one-time setup links', () => {
    test('changing the password needs the current one and signs out other devices', async () => {
        const { app } = h.buildApp();
        const here = await h.signup(app, { username: 'changer' });
        const elsewhere = await h.login(app, 'changer');
        const change = (body) => request(app).post('/api/auth/change-password').set(here.auth).send(body);

        const wrong = await change({ currentPassword: 'Not my password 1', newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
        assert.equal(wrong.status, 400);
        assert.match(wrong.body.fields.currentPassword, /incorrect/);

        const same = await change({ currentPassword: h.PASSWORD, newPassword: h.PASSWORD, confirmPassword: h.PASSWORD });
        assert.match(same.body.fields.newPassword, /different/);

        const weak = await change({ currentPassword: h.PASSWORD, newPassword: 'password1', confirmPassword: 'password1' });
        assert.match(weak.body.fields.newPassword, /too common/);

        const ok = await change({ currentPassword: h.PASSWORD, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
        assert.equal(ok.status, 200);
        assert.ok(ok.body.token);

        assert.equal((await request(app).post('/api/auth/refresh').set('Cookie', elsewhere.cookie)).status, 401);
        assert.equal((await request(app).post('/api/auth/refresh').set('Cookie', here.cookie)).status, 401);
        assert.equal((await request(app).post('/api/auth/refresh').set('Cookie', h.cookieFrom(ok))).status, 200);

        assert.equal((await loginReq(app, 'changer', h.PASSWORD)).status, 401);
        assert.equal((await loginReq(app, 'changer', NEW_PASSWORD)).status, 200);
    });

    test('an account from the old email sign-in can set a first password while still signed in', async () => {
        const { app, config } = h.buildApp();
        const legacy = await insertLegacyUser();
        const me = await request(app).get('/api/auth/me').set(h.authHeader(config, legacy));
        assert.equal(me.body.hasPassword, false);

        const res = await request(app).post('/api/auth/change-password').set(h.authHeader(config, legacy))
            .send({ newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
        assert.equal(res.status, 200);
        assert.equal((await loginReq(app, 'legacy@example.test', NEW_PASSWORD)).status, 200);

        // From now on the current password is required.
        const again = await request(app).post('/api/auth/change-password').set(h.authHeader(config, legacy))
            .send({ newPassword: 'Another one 2026', confirmPassword: 'Another one 2026' });
        assert.equal(again.status, 400);
        assert.ok(again.body.fields.currentPassword);
    });

    test('a setup link sets the password exactly once and signs out existing sessions', async () => {
        const { app } = h.buildApp();
        const member = await h.signup(app, { username: 'forgetful', email: 'forgetful@example.test' });
        const { token } = await createPasswordSetupToken(member.user._id);
        assert.equal(await PasswordSetupToken.countDocuments({ tokenHash: token }), 0); // only the hash is stored

        const reset = (body) => request(app).post('/api/auth/password-reset').send(body);
        const weak = await reset({ token, password: 'abc', confirmPassword: 'abc' });
        assert.equal(weak.status, 400);
        assert.ok(weak.body.fields.password);

        const ok = await reset({ token, password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
        assert.equal(ok.status, 200);
        assert.equal(ok.body.username, 'forgetful');
        assert.equal(ok.body.token, undefined);

        const reuse = await reset({ token, password: 'Third password 3', confirmPassword: 'Third password 3' });
        assert.equal(reuse.status, 400);
        assert.equal(reuse.body.reason, 'invalid_link');

        assert.equal((await request(app).post('/api/auth/refresh').set('Cookie', member.cookie)).status, 401);
        assert.equal((await loginReq(app, 'forgetful', h.PASSWORD)).status, 401);
        assert.equal((await loginReq(app, 'forgetful@example.test', NEW_PASSWORD)).status, 200);
    });

    test('a setup link gives an account from the old email sign-in its first password', async () => {
        const { app } = h.buildApp();
        const legacy = await insertLegacyUser();
        const { token } = await createPasswordSetupToken(legacy._id);
        const res = await request(app).post('/api/auth/password-reset').send({ token, password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
        assert.equal(res.status, 200);
        assert.equal((await loginReq(app, 'legacy@example.test', NEW_PASSWORD)).status, 200);
    });

    test('expired, replaced, malformed and unknown links are refused', async () => {
        const { app } = h.buildApp();
        const user = await h.createUser();
        const reset = (token) => request(app).post('/api/auth/password-reset')
            .send({ token, password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });

        const first = await createPasswordSetupToken(user._id);
        const second = await createPasswordSetupToken(user._id);
        assert.equal((await reset(first.token)).status, 400);

        await PasswordSetupToken.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
        assert.equal((await reset(second.token)).status, 400);

        for (const bad of ['', 'abc', 'A'.repeat(43), { $ne: null }, undefined]) {
            const res = await reset(bad);
            assert.equal(res.status, 400);
            assert.equal(res.body.reason, 'invalid_link');
        }
        const stored = await User.findById(user._id).select('+passwordHash').lean();
        assert.equal(stored.passwordHash, undefined);
    });

    test('concurrent use of one link sets the password once', async () => {
        const { app } = h.buildApp();
        const user = await h.createUser();
        const { token } = await createPasswordSetupToken(user._id);
        const results = await Promise.all(Array.from({ length: 4 }, () =>
            request(app).post('/api/auth/password-reset').send({ token, password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD })));
        assert.equal(results.filter(r => r.status === 200).length, 1);
    });

    test('failed password changes are rate limited', async () => {
        const { app } = h.buildApp({ rateLimits: { password: { limit: 2 } } });
        const session = await h.signup(app);
        const attempt = () => request(app).post('/api/auth/change-password').set(session.auth)
            .send({ currentPassword: 'Wrong guess 1', newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
        await attempt();
        await attempt();
        assert.equal((await attempt()).status, 429);
    });
});

describe('profile completion', () => {
    test('a new account reaches only its session and profile setup until the profile is complete', async () => {
        const { app } = h.buildApp();
        const other = await h.createUser();
        const session = await h.signup(app);

        const me = await request(app).get('/api/auth/me').set(session.auth);
        assert.equal(me.status, 200);
        assert.equal(me.body.profileCompleted, false);
        assert.equal(me.body.hasPassword, true);

        const blocked = [
            request(app).post('/api/auctions').set(session.auth).send({ title: 'Coin', description: 'Rare', startingBid: 10, durationHours: 24 }),
            request(app).get('/api/notifications').set(session.auth),
            request(app).get('/api/messages').set(session.auth),
            request(app).post('/api/messages').set(session.auth).send({ recipientId: String(other._id), content: 'hi' }),
            request(app).post('/api/posts').set(session.auth).send({ content: 'hello' }),
            request(app).post('/api/collections').set(session.auth).send({ title: 'T', description: 'D' }),
            request(app).post('/api/communities').set(session.auth).send({ name: 'N', description: 'D' }),
            request(app).post(`/api/users/${other._id}/follow`).set(session.auth),
            request(app).get('/api/users').set(session.auth)
        ];
        for (const res of await Promise.all(blocked)) {
            assert.equal(res.status, 403, `${res.req.method} ${res.req.path}`);
            assert.equal(res.body.reason, 'profile_incomplete');
        }
    });

    test('completing the required fields unlocks the marketplace; photo and bio stay optional', async () => {
        const { app, config } = h.buildApp();
        const session = await h.signup(app);
        const put = (body) => request(app).put(`/api/users/${session.user._id}`).set(session.auth).send(body);
        const createAuction = (auth) => request(app).post('/api/auctions').set(auth)
            .send({ title: 'Coin', description: 'Rare', startingBid: 10, durationHours: 24 });

        const bioOnly = await put({ bio: 'Coins and stamps' });
        assert.equal(bioOnly.status, 200);
        assert.equal(bioOnly.body.profileCompleted, false);
        assert.equal((await createAuction(session.auth)).status, 403);

        const done = await put({ interests: ['Coins'] });
        assert.equal(done.status, 200);
        assert.equal(done.body.profileCompleted, true);

        // The token issued before completion is re-checked against the database.
        assert.equal((await createAuction(session.auth)).status, 201);
        const refreshed = await request(app).post('/api/auth/refresh').set('Cookie', session.cookie);
        assert.equal(jwt.verify(refreshed.body.token, config.jwt.accessSecret).pc, true);
        assert.equal(refreshed.body.user.profileCompleted, true);

        const login = await h.login(app, session.fields.username);
        assert.equal(login.user.profileCompleted, true);
    });

    test('clients cannot mark their own profile complete', async () => {
        const { app, config } = h.buildApp();
        const session = await h.signup(app);
        const res = await request(app).put(`/api/users/${session.user._id}`).set(session.auth)
            .send({ profileCompleted: true, isVerified: true, bio: 'trying' });
        assert.equal(res.status, 200);
        assert.equal(res.body.profileCompleted, false);
        assert.equal((await request(app).get('/api/notifications').set(session.auth)).status, 403);

        const forged = h.tokenFor(config, session.user, { pc: true, secret: 'not-the-server-secret-but-long-enough' });
        assert.equal((await request(app).get('/api/notifications').set('Authorization', `Bearer ${forged}`)).status, 401);
        const stored = await User.findById(session.user._id).lean();
        assert.equal(stored.profileCompleted, false);
    });

    test('members who finished setup before this change keep full access', async () => {
        const { app, config } = h.buildApp();
        const legacy = await insertLegacyUser({ isVerified: true });
        assert.equal((await User.collection.findOne({ _id: legacy._id })).profileCompleted, undefined);

        const auth = h.authHeader(config, legacy); // old-style token without the pc claim
        assert.equal((await request(app).get('/api/notifications').set(auth)).status, 200);
        const me = await request(app).get('/api/auth/me').set(auth);
        assert.equal(me.body.profileCompleted, true);
        assert.equal(me.body.username, 'user_1a2b3c4d');
    });

    test('members who never finished setup are held at setup, and their data is kept', async () => {
        const { app, config } = h.buildApp();
        const legacy = await insertLegacyUser({ isVerified: false, interests: [], bio: 'kept' });
        const auth = h.authHeader(config, legacy);
        const blocked = await request(app).get('/api/notifications').set(auth);
        assert.equal(blocked.status, 403);
        assert.equal(blocked.body.reason, 'profile_incomplete');

        const done = await request(app).put(`/api/users/${legacy._id}`).set(auth)
            .send({ username: 'Chosen_Name', displayName: 'Legacy Member', interests: ['Stamps'] });
        assert.equal(done.status, 200);
        assert.equal(done.body.username, 'chosen_name');
        assert.equal(done.body.bio, 'kept');
        assert.equal(done.body.profileCompleted, true);
        assert.equal((await request(app).get('/api/notifications').set(auth)).status, 200);
    });

    test('public profiles never expose secrets, contact details or account flags', async () => {
        const { app } = h.buildApp();
        const session = await h.signup(app);
        const id = session.user._id;

        const anon = await request(app).get(`/api/users/${id}`);
        assert.equal(anon.status, 200);
        for (const field of ['passwordHash', 'tokenVersion', 'email', 'phone', 'isVerified', 'isEmailVerified', 'profileCompleted', 'passwordChangedAt']) {
            assert.equal(anon.body[field], undefined, field);
        }

        const own = await request(app).get(`/api/users/${id}`).set(session.auth);
        assert.equal(own.body.phone, '+919876543210');
        assert.equal(own.body.profileCompleted, false);
        assert.equal(own.body.passwordHash, undefined);
        assert.equal(own.body.isVerified, undefined);
    });

    test('a full journey: sign up, finish the profile, list an auction, receive a bid and a message', async () => {
        const { app } = h.buildApp();
        const seller = await h.completeProfile(app, await h.signup(app, { username: 'seller_one' }));
        const bidder = await h.completeProfile(app, await h.signup(app, { username: 'bidder_one' }));

        const auction = await request(app).post('/api/auctions').set(seller.auth)
            .send({ title: 'Mint 1950 coin', description: 'Rare', startingBid: 100, durationHours: 24 });
        assert.equal(auction.status, 201);
        assert.equal(String(auction.body.seller), String(seller.user._id));

        const bid = await request(app).post(`/api/auctions/${auction.body._id}/bid`).set(bidder.auth).send({ amount: 150 });
        assert.equal(bid.status, 200);

        const msg = await request(app).post('/api/messages').set(bidder.auth)
            .send({ recipientId: String(seller.user._id), content: 'Is it still available?' });
        assert.equal(msg.status, 200);
        const inbox = await request(app).get('/api/messages').set(seller.auth);
        assert.equal(inbox.status, 200);
        assert.equal(inbox.body.length, 1);
    });
});
