// The operator scripts for the password migration, run against an in-memory
// database shaped like production before the switch.
const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const User = require('../../models/User');
const PasswordSetupToken = require('../../models/PasswordSetupToken');
const { up, down } = require('../../scripts/migrate-password-auth');
const { issuePasswordLink } = require('../../scripts/issue-password-link');
const h = require('../helpers');

let mongod;
before(async () => { mongod = await h.startDatabase(); });
after(async () => { await h.stopDatabase(mongod); });
beforeEach(async () => { await h.clearDatabase(); });

const quiet = () => {};

// Production as it was: accounts without profileCompleted or passwords, and
// the old unique index on phone.
async function seedPreMigrationDatabase() {
    await User.collection.insertMany([
        { username: 'done_member', email: 'done@example.test', displayName: 'Done', isVerified: true, interests: ['Coins'], phone: '+911111111111', bio: 'kept' },
        { username: 'user_0a1b2c3d', email: 'halfway@example.test', displayName: 'halfway', isVerified: false, interests: [] }
    ]);
    await User.collection.createIndex({ phone: 1 }, { unique: true, sparse: true, name: 'phone_1' });
}

describe('scripts/migrate-password-auth.js', () => {
    test('a dry run reports and changes nothing', async () => {
        await seedPreMigrationDatabase();
        const before = await User.collection.find({}).sort({ username: 1 }).toArray();
        const report = await up({ apply: false, log: quiet });
        assert.equal(report.toComplete, 1);
        assert.equal(report.toIncomplete, 1);
        assert.deepEqual(await User.collection.find({}).sort({ username: 1 }).toArray(), before);
        assert.ok((await User.collection.indexes()).some(i => i.name === 'phone_1'));
    });

    test('applying records profile completion, drops the unique phone index and keeps all data', async () => {
        await seedPreMigrationDatabase();
        const result = await up({ apply: true, log: quiet });
        assert.deepEqual(result.droppedIndexes, ['phone_1']);

        const done = await User.collection.findOne({ username: 'done_member' });
        assert.equal(done.profileCompleted, true);
        assert.equal(done.bio, 'kept');
        assert.equal(done.phone, '+911111111111');
        assert.equal((await User.collection.findOne({ username: 'user_0a1b2c3d' })).profileCompleted, false);
        assert.ok(!(await User.collection.indexes()).some(i => i.name === 'phone_1'));
        assert.ok((await PasswordSetupToken.collection.indexes()).some(i => i.expireAfterSeconds === 0));

        // Two accounts may now share a phone number.
        await h.createUser({ phone: '+911111111111' });

        // Running it again is a no-op.
        const again = await up({ apply: true, log: quiet });
        assert.equal(again.toComplete + again.toIncomplete, 0);
        assert.deepEqual(again.droppedIndexes, []);
    });

    test('the app treats migrated and unmigrated accounts the same way', async () => {
        await seedPreMigrationDatabase();
        const { app, config } = h.buildApp();
        const statusFor = async (username) => {
            const user = await User.findOne({ username });
            return (await request(app).get('/api/notifications').set(h.authHeader(config, user))).status;
        };
        const unmigrated = [await statusFor('done_member'), await statusFor('user_0a1b2c3d')];
        await up({ apply: true, log: quiet });
        assert.deepEqual([await statusFor('done_member'), await statusFor('user_0a1b2c3d')], unmigrated);
        assert.deepEqual(unmigrated, [200, 403]);
    });

    test('reversing removes password data and restores the phone index', async () => {
        await seedPreMigrationDatabase();
        await up({ apply: true, log: quiet });
        const { app } = h.buildApp();
        await h.signup(app, { username: 'new_member' });
        await PasswordSetupToken.create({ user: (await User.findOne({ username: 'done_member' }))._id, tokenHash: 'x'.repeat(64), expiresAt: new Date(Date.now() + 60000) });

        const dry = await down({ apply: false, log: quiet });
        assert.equal(dry.withPassword, 1);
        assert.equal(await User.collection.countDocuments({ passwordHash: { $exists: true } }), 1);

        const result = await down({ apply: true, log: quiet });
        assert.equal(result.phoneIndexRecreated, true);
        assert.equal(await User.collection.countDocuments({ passwordHash: { $exists: true } }), 0);
        assert.equal(await User.collection.countDocuments({ profileCompleted: { $exists: true } }), 0);
        assert.equal(await PasswordSetupToken.countDocuments(), 0);
        assert.ok((await User.collection.indexes()).some(i => i.name === 'phone_1' && i.unique));
        // isVerified was kept in step, so the old code still knows who finished setup.
        assert.equal((await User.collection.findOne({ username: 'done_member' })).isVerified, true);
        assert.equal((await User.collection.findOne({ username: 'new_member' })).isVerified, false);
    });

    test('reversing reports, and does not fail on, phone numbers that are now shared', async () => {
        await up({ apply: true, log: quiet });
        await h.createUser({ phone: '+912222222222' });
        await h.createUser({ phone: '+912222222222' });
        const result = await down({ apply: true, log: quiet });
        assert.equal(result.duplicatePhones, 1);
        assert.equal(result.phoneIndexRecreated, false);
    });
});

describe('scripts/issue-password-link.js', () => {
    const BASE = 'https://flexy-peach.vercel.app';

    test('issues a working single-use link for an account without a password', async () => {
        const { app } = h.buildApp();
        await User.collection.insertOne({ username: 'user_9f8e7d6c', email: 'old@example.test', displayName: 'old', isVerified: true });

        const { link, user } = await issuePasswordLink({ identifier: 'old@example.test', baseUrl: BASE });
        assert.equal(user.username, 'user_9f8e7d6c');
        const url = new URL(link);
        assert.equal(url.origin + url.pathname, `${BASE}/reset-password.html`);
        assert.equal(url.search, '');
        const token = new URLSearchParams(url.hash.slice(1)).get('token');

        const password = 'Fresh start 2026';
        const res = await request(app).post('/api/auth/password-reset').send({ token, password, confirmPassword: password });
        assert.equal(res.status, 200);
        assert.equal((await request(app).post('/api/auth/login').send({ identifier: 'user_9f8e7d6c', password })).status, 200);
    });

    test('refuses unknown accounts, bad durations and insecure base URLs', async () => {
        await h.createUser({ username: 'known_member' });
        await assert.rejects(issuePasswordLink({ identifier: 'nobody', baseUrl: BASE }), /No account found/);
        await assert.rejects(issuePasswordLink({ identifier: 'known_member', baseUrl: BASE, minutes: '0' }), /--minutes/);
        await assert.rejects(issuePasswordLink({ identifier: 'known_member', baseUrl: BASE, minutes: '100000' }), /--minutes/);
        await assert.rejects(issuePasswordLink({ identifier: 'known_member', baseUrl: 'http://flexy.example' }), /https/);
        await assert.rejects(issuePasswordLink({ identifier: 'known_member', baseUrl: 'not a url' }), /valid URL/);
        assert.ok(await issuePasswordLink({ identifier: 'known_member', baseUrl: 'http://localhost:3001' }));
    });
});
