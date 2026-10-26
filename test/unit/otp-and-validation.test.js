const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const otp = require('../../lib/otp');
const v = require('../../lib/validation');

const SECRET = 'unit-test-secret-unit-test-secret-1234';

describe('OTP helpers', () => {
    test('codes are always six digits, including leading zeros', () => {
        for (let i = 0; i < 2000; i++) {
            const code = otp.generateOtp();
            assert.match(code, /^\d{6}$/);
        }
    });

    test('codes are not constant', () => {
        const codes = new Set(Array.from({ length: 50 }, () => otp.generateOtp()));
        assert.ok(codes.size > 40);
    });

    test('the stored hash never contains the code and is bound to the email', () => {
        const hash = otp.hashOtp(SECRET, 'a@x.test', '123456');
        assert.ok(!hash.includes('123456'));
        assert.equal(otp.otpMatches(SECRET, 'a@x.test', '123456', hash), true);
        assert.equal(otp.otpMatches(SECRET, 'b@x.test', '123456', hash), false);
        assert.equal(otp.otpMatches(SECRET, 'a@x.test', '123457', hash), false);
        assert.equal(otp.otpMatches('another-secret-another-secret-123', 'a@x.test', '123456', hash), false);
    });

    test('missing or malformed hashes never match', () => {
        assert.equal(otp.otpMatches(SECRET, 'a@x.test', '123456', null), false);
        assert.equal(otp.otpMatches(SECRET, 'a@x.test', '123456', ''), false);
        assert.equal(otp.otpMatches(SECRET, 'a@x.test', '123456', 'abcd'), false);
    });

    test('isWellFormedOtp accepts only six-digit strings', () => {
        assert.equal(otp.isWellFormedOtp('000123'), true);
        assert.equal(otp.isWellFormedOtp('12345'), false);
        assert.equal(otp.isWellFormedOtp('1234567'), false);
        assert.equal(otp.isWellFormedOtp(123456), false);
        assert.equal(otp.isWellFormedOtp('12a456'), false);
    });
});

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
