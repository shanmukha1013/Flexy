const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const v = require('../../lib/validation');

describe('validation helpers', () => {
    test('normalizeEmail lowercases, trims and rejects junk', () => {
        assert.equal(v.normalizeEmail('  Foo@Example.COM '), 'foo@example.com');
        assert.equal(v.normalizeEmail('not-an-email'), null);
        assert.equal(v.normalizeEmail({ $ne: null }), null);
        assert.equal(v.normalizeEmail('a"<b>@x.test'), null);
    });

    test('cleanText strips angle brackets and enforces limits', () => {
        assert.equal(v.cleanText('  <script>alert(1)</script> hi ', 'Field'), 'scriptalert(1)/script hi');
        assert.equal(v.cleanText(undefined, 'Field'), undefined);
        assert.throws(() => v.cleanText('', 'Field', { required: true }), v.HttpError);
        assert.throws(() => v.cleanText('x'.repeat(11), 'Field', { max: 10 }), /at most 10/);
        assert.throws(() => v.cleanText({ $gt: '' }, 'Field'), /must be text/);
    });

    test('cleanImageUrl allows safe URLs and blocks attribute/CSS breakouts', () => {
        assert.equal(v.cleanImageUrl('https://cdn.example/x.png', 'Image'), 'https://cdn.example/x.png');
        assert.equal(v.cleanImageUrl('data:image/png;base64,iVBORw0KGgo=', 'Image'), 'data:image/png;base64,iVBORw0KGgo=');
        assert.equal(v.cleanImageUrl('assets/rolex.png', 'Image'), 'assets/rolex.png');
        assert.equal(v.cleanImageUrl('', 'Image'), '');
        for (const bad of [
            "https://x.example/a.png'); background:url(javascript:alert(1))",
            'https://x.example/a.png" onmouseover="alert(1)',
            'javascript:alert(1)',
            'data:text/html;base64,PHNjcmlwdD4=',
            'data:image/png;base64,abc"def'
        ]) {
            assert.throws(() => v.cleanImageUrl(bad, 'Image'), v.HttpError, bad);
        }
    });

    test('cleanNumber parses numeric strings and enforces bounds', () => {
        assert.equal(v.cleanNumber('500', 'Bid', { min: 1 }), 500);
        assert.equal(v.cleanNumber('', 'Bid'), undefined);
        assert.throws(() => v.cleanNumber('abc', 'Bid'), v.HttpError);
        assert.throws(() => v.cleanNumber(-1, 'Bid', { min: 0 }), v.HttpError);
        assert.throws(() => v.cleanNumber(Infinity, 'Bid'), v.HttpError);
        assert.throws(() => v.cleanNumber(undefined, 'Bid', { required: true }), /required/);
    });

    test('isObjectId only accepts 24-character hex strings', () => {
        assert.equal(v.isObjectId('507f1f77bcf86cd799439011'), true);
        assert.equal(v.isObjectId('undefined'), false);
        assert.equal(v.isObjectId('507f1f77bcf86cd79943901'), false);
        assert.equal(v.isObjectId({}), false);
    });

    test('escapeRegex neutralises special characters', () => {
        const re = new RegExp(v.escapeRegex('a.b*(c)'));
        assert.equal(re.test('a.b*(c)'), true);
        assert.equal(re.test('axbbbc'), false);
    });
});

describe('username rules', () => {
    test('normalizeUsername trims, drops a leading @ and lowercases', () => {
        assert.equal(v.normalizeUsername('  @Shan_Collects '), 'shan_collects');
        assert.equal(v.normalizeUsername({ $ne: '' }), '');
        assert.equal(v.normalizeUsername(undefined), '');
    });

    test('accepts letters, numbers, underscores and inner periods', () => {
        for (const ok of ['abc', 'shan_collects', 'shan.reddy', 'a1_b2.c3', 'x'.repeat(30)]) {
            assert.equal(v.usernameProblem(ok), null, ok);
        }
    });

    test('rejects bad lengths, characters and period placement', () => {
        for (const bad of ['', 'ab', 'x'.repeat(31), 'a b', 'a-b', 'emoji😀', '.abc', 'abc.', 'a..b', 'a@b', '<script>']) {
            assert.ok(v.usernameProblem(bad), bad);
        }
    });

    test('rejects handles that could impersonate the platform', () => {
        assert.match(v.usernameProblem('admin'), /reserved/);
        assert.match(v.usernameProblem('flexy'), /reserved/);
        assert.match(v.usernameProblem('support'), /reserved/);
    });
});

describe('phone numbers', () => {
    test('normalizePhone keeps a leading + and the digits', () => {
        assert.equal(v.normalizePhone('+91 98765 43210'), '+919876543210');
        assert.equal(v.normalizePhone('(987) 654-3210'), '9876543210');
        assert.equal(v.normalizePhone('98765.43210'), '9876543210');
    });

    test('normalizePhone rejects letters, too few or too many digits and non-strings', () => {
        for (const bad of ['', 'call me', '12345', '+1234567890123456', '98765abc10', '++919876543210', 9876543210, null]) {
            assert.equal(v.normalizePhone(bad), null, String(bad));
        }
    });
});

describe('login identifiers', () => {
    test('an identifier with @ inside is an email; otherwise a username', () => {
        assert.deepEqual(v.parseLoginIdentifier(' Shan@Example.COM '), { email: 'shan@example.com' });
        assert.deepEqual(v.parseLoginIdentifier(' @Shan_Collects '), { username: 'shan_collects' });
        assert.deepEqual(v.parseLoginIdentifier('shan'), { username: 'shan' });
    });

    test('empty, malformed and non-string identifiers are rejected', () => {
        assert.equal(v.parseLoginIdentifier(''), null);
        assert.equal(v.parseLoginIdentifier('   '), null);
        assert.equal(v.parseLoginIdentifier('broken@'), null);
        assert.equal(v.parseLoginIdentifier({ $ne: null }), null);
        assert.equal(v.parseLoginIdentifier('x'.repeat(300)), null);
    });
});
