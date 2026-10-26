const mongoose = require('mongoose');

// One record per email address. It carries the current code (as an HMAC, never
// plaintext) plus the counters used to rate-limit sends to that address.
const OTPVerificationSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    // HMAC of the active code; null once the code is used, locked or invalidated.
    codeHash: {
        type: String,
        default: null
    },
    codeExpiresAt: {
        type: Date
    },
    attempts: {
        type: Number,
        default: 0
    },
    consumedAt: {
        type: Date,
        default: null
    },
    lastSentAt: {
        type: Date
    },
    sendCount: {
        type: Number,
        default: 0
    },
    windowStartedAt: {
        type: Date
    },
    // When the whole record (including rate-limit counters) may be purged.
    expiresAt: {
        type: Date,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

OTPVerificationSchema.index({ email: 1 }, { unique: true });
// Auto-delete records once they are no longer needed (TTL index on expiresAt).
// Records written before codes were hashed only have a plaintext `otp` field;
// they expire through this same index within five minutes.
OTPVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('OTPVerification', OTPVerificationSchema);
