const mongoose = require('mongoose');

// A one-time link that lets an account owner set a new password. Links are
// issued by an operator (scripts/issue-password-link.js): there is no
// self-service reset because Flexy does not send email. Only a SHA-256 hash of
// the token is stored, so a database leak does not expose usable links.
const PasswordSetupTokenSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    tokenHash: {
        type: String,
        required: true,
        unique: true
    },
    expiresAt: {
        type: Date,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// MongoDB deletes expired links on its own (TTL index).
PasswordSetupTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('PasswordSetupToken', PasswordSetupTokenSchema);
