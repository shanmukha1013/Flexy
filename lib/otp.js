// lib/otp.js
// One-time passcode helpers. Codes are never stored in plaintext: the database
// holds an HMAC keyed with a server secret and bound to the email address, so a
// leaked OTP collection cannot be brute-forced offline or replayed for another
// address.

const crypto = require('crypto');

const OTP_LENGTH = 6;
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_SEND_WINDOW_MS = 60 * 60 * 1000;
const OTP_MAX_SENDS_PER_WINDOW = 10;

function generateOtp() {
    return crypto.randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, '0');
}

function hashOtp(secret, email, code) {
    return crypto.createHmac('sha256', secret).update(`otp:${email}:${code}`).digest('hex');
}

function otpMatches(secret, email, code, expectedHash) {
    if (typeof expectedHash !== 'string' || expectedHash.length === 0) return false;
    const actual = Buffer.from(hashOtp(secret, email, code), 'hex');
    const expected = Buffer.from(expectedHash, 'hex');
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function isWellFormedOtp(code) {
    return typeof code === 'string' && new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code);
}

module.exports = {
    OTP_LENGTH,
    OTP_TTL_MS,
    OTP_MAX_ATTEMPTS,
    OTP_RESEND_COOLDOWN_MS,
    OTP_SEND_WINDOW_MS,
    OTP_MAX_SENDS_PER_WINDOW,
    generateOtp,
    hashOtp,
    otpMatches,
    isWellFormedOtp
};
