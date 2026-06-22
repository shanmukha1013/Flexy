const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    email: {
        type: String,
        unique: true,
        sparse: true, // sparse allows null values but ensures uniqueness for non-nulls
        trim: true,
        lowercase: true
    },
    phone: {
        type: String,
        unique: true,
        sparse: true,
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
    isVerified: {
        type: Boolean,
        default: false
    },
    otpCode: {
        type: String
    },
    otpExpires: {
        type: Date
    }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
