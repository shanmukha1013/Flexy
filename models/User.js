const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    email: {
        type: String,
        unique: true,
        sparse: true, // sparse allows null values but ensures uniqueness for non-nulls
        trim: true,
        lowercase: true
    },
    // Contact detail only: never verified and never used to sign in, so it is
    // deliberately not unique (a unique, unverified number would let anyone
    // block its real owner from signing up). See scripts/migrate-password-auth.js
    // for removing the old unique index.
    phone: {
        type: String,
        trim: true
    },
    username: {
        type: String,
        unique: true,
        required: true,
        trim: true
    },
    displayName: {
        type: String,
        required: true,
        trim: true
    },
    // Argon2id hash (lib/passwords.js). Never selected unless a query asks for
    // it with select('+passwordHash'), so it cannot leak through a response.
    // Accounts created by the retired email sign-in have none until the owner
    // sets one.
    passwordHash: {
        type: String,
        select: false
    },
    passwordChangedAt: {
        type: Date
    },
    // Set by the server once profile setup is done (lib/accounts.js). No
    // default on purpose: older accounts without the field fall back to
    // isVerified instead of being treated as incomplete.
    profileCompleted: {
        type: Boolean
    },
    // Legacy name for "profile setup complete" (it never meant identity
    // verification). Kept in step with profileCompleted so a rollback to the
    // previous release still works; not returned by the API.
    isVerified: {
        type: Boolean,
        default: false
    },
    bio: {
        type: String,
        maxLength: 500,
        default: ''
    },
    avatarInitials: {
        type: String,
        default: 'U'
    },
    avatarUrl: {
        type: String,
        default: ''
    },
    coverUrl: {
        type: String,
        default: ''
    },
    reputation: {
        type: String,
        enum: ['Newcomer', 'Collector', 'Trusted', 'Elite'],
        default: 'Newcomer'
    },
    achievements: [{
        type: String
    }],
    showcaseCabinet: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Item'
    }],
    followers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    following: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    communities: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Community' // Assuming Community model will exist
    }],
    interests: [{
        type: String
    }],
    profilePhoto: {
        type: String,
        default: ''
    },
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    isIdentityVerified: {
        type: Boolean,
        default: false
    },
    isTrustedSeller: {
        type: Boolean,
        default: false
    },
    salesCount: {
        type: Number,
        default: 0
    },
    auctionsCompleted: {
        type: Number,
        default: 0
    },
    savedAuctions: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Auction'
    }],
    // Left over from an earlier login prototype; some old documents still
    // carry them. Never selected.
    otpCode: {
        type: String,
        select: false
    },
    otpExpires: {
        type: Date,
        select: false
    },
    // Embedded in refresh tokens; incrementing it revokes every refresh token
    // issued to this account (logout, password change, password reset).
    tokenVersion: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

// Defence in depth for any handler that sends a whole user document.
const SECRET_FIELDS = ['passwordHash', 'otpCode', 'otpExpires', 'tokenVersion'];
UserSchema.set('toJSON', {
    transform(doc, ret) {
        for (const field of SECRET_FIELDS) delete ret[field];
        return ret;
    }
});

module.exports = mongoose.model('User', UserSchema);
