// lib/password-setup.js
// One-time password setup links. Used for accounts created by the retired
// email sign-in (which have no password) and for operator-assisted resets.

const crypto = require('crypto');
const PasswordSetupToken = require('../models/PasswordSetupToken');

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_TTL_MS = 24 * 60 * 60 * 1000; // 1 day
// 32 random bytes, base64url without padding.
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

function hashSetupToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

// Replaces any earlier link for the user and returns the new raw token, which
// is never stored.
async function createPasswordSetupToken(userId, { ttlMs = DEFAULT_TTL_MS } = {}) {
    if (!Number.isFinite(ttlMs) || ttlMs <= 0 || ttlMs > MAX_TTL_MS) {
        throw new RangeError(`ttlMs must be between 1 and ${MAX_TTL_MS}`);
    }
    const token = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + ttlMs);
    await PasswordSetupToken.deleteMany({ user: userId });
    await PasswordSetupToken.create({ user: userId, tokenHash: hashSetupToken(token), expiresAt });
    return { token, expiresAt };
}

// Looks a token up without using it, so the new password can be checked
// against the account before the link is spent.
async function findPasswordSetupToken(token) {
    if (typeof token !== 'string' || !TOKEN_RE.test(token)) return null;
    return PasswordSetupToken.findOne({ tokenHash: hashSetupToken(token), expiresAt: { $gt: new Date() } }).lean();
}

// Atomically spends the token: of several concurrent requests, one wins.
async function consumePasswordSetupToken(record) {
    const consumed = await PasswordSetupToken.findOneAndDelete({ _id: record._id, expiresAt: { $gt: new Date() } });
    if (consumed) await PasswordSetupToken.deleteMany({ user: record.user });
    return Boolean(consumed);
}

module.exports = {
    DEFAULT_TTL_MS,
    MAX_TTL_MS,
    hashSetupToken,
    createPasswordSetupToken,
    findPasswordSetupToken,
    consumePasswordSetupToken
};
