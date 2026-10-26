const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const p = require('../../lib/passwords');

describe('password hashing', () => {
    test('hashes with Argon2id at the configured cost and never contains the password', async () => {
        const hash = await p.hashPassword('Correct horse 42');
        assert.match(hash, /^\$argon2id\$v=19\$m=19456,p=1,t=2\$/);
        assert.ok(!hash.includes('Correct horse 42'));
    });

    test('the same password hashes differently every time (random salt)', async () => {
        const [a, b] = await Promise.all([p.hashPassword('Same pass 123'), p.hashPassword('Same pass 123')]);
        assert.notEqual(a, b);
    });

    test('verifies the right password and rejects others', async () => {
        const hash = await p.hashPassword('Correct horse 42');
        assert.equal(await p.verifyPassword(hash, 'Correct horse 42'), true);
        assert.equal(await p.verifyPassword(hash, 'correct horse 42'), false);
        assert.equal(await p.verifyPassword(hash, 'Correct horse 4'), false);
        assert.equal(await p.verifyPassword(hash, ''), false);
    });

    test('equivalent Unicode spellings verify (NFKC normalization)', async () => {
        const composed = 'Café latte 9';
        const decomposed = 'Café latte 9';
        const hash = await p.hashPassword(composed);
        assert.equal(await p.verifyPassword(hash, decomposed), true);
    });

    test('missing, malformed and plaintext "hashes" never match and never throw', async () => {
        for (const bad of [undefined, null, '', 'Correct horse 42', '$argon2id$garbage', 42]) {
            assert.equal(await p.verifyPassword(bad, 'Correct horse 42'), false);
        }
        assert.equal(await p.verifyPassword(await p.hashPassword('abc12345x'), { $ne: null }), false);
    });

    test('refuses to hash an empty or non-string password', async () => {
        await assert.rejects(p.hashPassword(''), TypeError);
        await assert.rejects(p.hashPassword(undefined), TypeError);
    });

    test('needsRehash is false for current parameters and true for weaker ones', async () => {
        const argon2 = require('argon2');
        assert.equal(p.needsRehash(await p.hashPassword('Rehash me 1')), false);
        const weak = await argon2.hash('Rehash me 1', { type: argon2.argon2id, memoryCost: 4096, timeCost: 1, parallelism: 1 });
        assert.equal(p.needsRehash(weak), true);
        assert.equal(p.needsRehash('not a hash'), true);
    });

    test('burnVerificationTime always reports no match', async () => {
        assert.equal(await p.burnVerificationTime('anything 123'), false);
        assert.equal(await p.burnVerificationTime(undefined), false);
    });
});

describe('password policy', () => {
    test('accepts a reasonable password', () => {
        assert.equal(p.passwordProblem('Collector 2026!'), null);
        assert.equal(p.passwordProblem('vintage-watch-9'), null);
    });

    test('enforces the length limits', () => {
        assert.match(p.passwordProblem('abc1234'), /at least 8/);
        assert.match(p.passwordProblem('a1' + 'x'.repeat(127)), /at most 128/);
        assert.equal(p.passwordProblem('a1' + 'x'.repeat(126)), null);
    });

    test('requires a letter and a number', () => {
        assert.match(p.passwordProblem('onlyletters'), /letter and one number/);
        assert.match(p.passwordProblem('1234567890'), /letter and one number/);
    });

    test('rejects common passwords regardless of case', () => {
        assert.match(p.passwordProblem('Password123'), /too common/);
        assert.match(p.passwordProblem('QWERTY123'), /too common/);
    });

    test('rejects a password equal to the username, email or email name', () => {
        const account = { username: 'shan_9999', email: 'shan.reddy1@example.test' };
        assert.equal(p.passwordProblem('shan_9999x', account), null); // merely contains it: allowed
        assert.match(p.passwordProblem('SHAN_9999', account), /username or email/);
        assert.match(p.passwordProblem('shan.reddy1', account), /username or email/);
        assert.match(p.passwordProblem('shan.reddy1@example.test', account), /username or email/);
        assert.match(p.passwordProblem('collector007', { username: 'collector007' }), /username or email/);
    });

    test('rejects missing and non-string input', () => {
        assert.match(p.passwordProblem(''), /Enter a password/);
        assert.match(p.passwordProblem(undefined), /Enter a password/);
        assert.match(p.passwordProblem({ $gt: '' }), /Enter a password/);
    });
});
