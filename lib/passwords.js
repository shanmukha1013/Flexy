// lib/passwords.js
// Password hashing and the password policy.
//
// Hashes are Argon2id with OWASP's recommended minimum cost (19 MiB of memory,
// two passes, one lane): memory-hard, so a leaked hash is expensive to crack on
// GPUs. The parameters are stored inside each hash, so they can be raised later;
// needsRehash() then upgrades a user's hash the next time they sign in.

const crypto = require('crypto');
const argon2 = require('argon2');

const HASH_OPTIONS = Object.freeze({
    type: argon2.argon2id,
    memoryCost: 19456, // KiB
    timeCost: 2,
    parallelism: 1
});

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

// Passwords that satisfy the length and letter+number rules but appear near the
// top of every breached-password list. Compared case-insensitively.
const COMMON_PASSWORDS = new Set([
    'password1', 'password12', 'password123', 'password1234', 'password01', 'passw0rd',
    'p@ssw0rd', 'p@ssword1', 'pass1234', 'abc12345', 'abcd1234', 'abc123456', 'abcdef123',
    'a1b2c3d4', 'a12345678', '12345678a', '123456789a', '1234abcd', '1234qwer', 'qwer1234',
    'qwerty123', 'qwerty12', 'qwerty1234', 'qwertyuiop1', 'asdf1234', 'zxcv1234', 'qazwsx123',
    '1q2w3e4r', '1q2w3e4r5t', 'q1w2e3r4', 'q1w2e3r4t5', 'zaq12wsx', '1qaz2wsx', 'aa123456',
    '11111111a', 'iloveyou1', 'iloveyou123', 'letmein1', 'letmein123', 'welcome1',
    'welcome123', 'admin123', 'admin1234', 'administrator1', 'test1234', 'test12345',
    'changeme1', 'changeme123', 'trustno1', 'sunshine1', 'princess1', 'football1',
    'baseball1', 'monkey123', 'dragon123', 'master123', 'shadow123', 'superman1', 'batman123',
    'michael1', 'jordan23', 'hello123', 'hello1234', 'computer1', 'internet1', 'starwars1',
    'whatever1', 'freedom1', 'charlie1', 'killer123', '123abc123', 'india123', 'india@123',
    'flexy123', 'flexy1234', 'flexy2026', 'collector1', 'collector123'
]);

function normalize(password) {
    // Different keyboards can produce different code points for the same
    // visible character; NFKC makes them hash identically.
    return password.normalize('NFKC');
}

async function hashPassword(password) {
    if (typeof password !== 'string' || password.length === 0) {
        throw new TypeError('password must be a non-empty string');
    }
    return argon2.hash(normalize(password), HASH_OPTIONS);
}

// Never throws: a missing or malformed hash simply does not match.
async function verifyPassword(hash, password) {
    if (typeof hash !== 'string' || !hash.startsWith('$argon2') || typeof password !== 'string') return false;
    try {
        return await argon2.verify(hash, normalize(password));
    } catch (err) {
        return false;
    }
}

function needsRehash(hash) {
    try {
        return argon2.needsRehash(hash, HASH_OPTIONS);
    } catch (err) {
        return true;
    }
}

// When there is no account (or the account has no password) there is nothing
// to verify, which would make those responses measurably faster. Verifying
// against a throwaway hash keeps the timing the same as a wrong password.
let dummyHashPromise = null;
async function burnVerificationTime(password) {
    if (!dummyHashPromise) dummyHashPromise = hashPassword(crypto.randomBytes(16).toString('hex'));
    await verifyPassword(await dummyHashPromise, typeof password === 'string' ? password : '');
    return false;
}

// Returns a message for the first rule the password breaks, or null if it is
// acceptable. `account` holds the username and email so a password cannot
// simply repeat them. (A phone number cannot match: passwords need a letter.)
function passwordProblem(password, account = {}) {
    if (typeof password !== 'string' || password.length === 0) return 'Enter a password';
    if (password.length < PASSWORD_MIN_LENGTH) return `Use at least ${PASSWORD_MIN_LENGTH} characters`;
    if (password.length > PASSWORD_MAX_LENGTH) return `Use at most ${PASSWORD_MAX_LENGTH} characters`;
    if (!/\p{L}/u.test(password) || !/\p{N}/u.test(password)) return 'Include at least one letter and one number';

    const lower = password.toLowerCase();
    if (COMMON_PASSWORDS.has(lower)) return 'This password is too common. Choose one that is harder to guess';

    const { username, email } = account;
    const personal = [username, email, typeof email === 'string' ? email.split('@')[0] : null]
        .filter(v => typeof v === 'string' && v.length >= 3)
        .map(v => v.toLowerCase());
    if (personal.includes(lower)) return 'Your password must not be your username or email';
    return null;
}

module.exports = {
    HASH_OPTIONS,
    PASSWORD_MIN_LENGTH,
    PASSWORD_MAX_LENGTH,
    hashPassword,
    verifyPassword,
    needsRehash,
    burnVerificationTime,
    passwordProblem
};
