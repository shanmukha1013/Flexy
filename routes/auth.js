const express = require('express');
const router = express.Router();
const User = require('../models/User');
const OTPVerification = require('../models/OTPVerification');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const auth = require('../middleware/auth');
const { getDynamicAchievements } = require('../lib/achievements');
const { normalizeEmail, isObjectId } = require('../lib/validation');
const { EmailNotConfiguredError, maskEmail } = require('../lib/email');
const {
    OTP_TTL_MS,
    OTP_MAX_ATTEMPTS,
    OTP_RESEND_COOLDOWN_MS,
    OTP_SEND_WINDOW_MS,
    OTP_MAX_SENDS_PER_WINDOW,
    generateOtp,
    hashOtp,
    otpMatches,
    isWellFormedOtp
} = require('../lib/otp');

const REFRESH_COOKIE = 'refreshToken';
const REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const INVALID_CODE_ERROR = 'Invalid or expired verification code. Please request a new one.';

// Helper to parse cookie from headers
function getCookie(req, name) {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) return null;
    for (const cookie of cookieHeader.split(';')) {
        const separator = cookie.indexOf('=');
        if (separator === -1) continue;
        if (cookie.slice(0, separator).trim() === name) {
            try {
                return decodeURIComponent(cookie.slice(separator + 1).trim());
            } catch (err) {
                return null;
            }
        }
    }
    return null;
}

function cookieOptions(config) {
    return {
        httpOnly: true,
        secure: config.cookie.secure,
        sameSite: config.cookie.sameSite,
        path: '/'
    };
}

function sessionUser(user) {
    return {
        _id: user._id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        profilePhoto: user.profilePhoto || '',
        avatarUrl: user.avatarUrl || user.profilePhoto || '',
        avatarInitials: user.avatarInitials,
        bio: user.bio || '',
        interests: user.interests || [],
        isVerified: user.isVerified
    };
}

function signAccessToken(config, user) {
    return jwt.sign(
        { userId: user._id.toString(), email: user.email },
        config.jwt.accessSecret,
        { expiresIn: config.jwt.accessTtl, algorithm: 'HS256' }
    );
}

function issueSession(res, config, user) {
    const refreshToken = jwt.sign(
        { userId: user._id.toString(), tv: user.tokenVersion || 0 },
        config.jwt.refreshSecret,
        { expiresIn: config.jwt.refreshTtl, algorithm: 'HS256' }
    );

    // Store refresh token securely in HttpOnly Cookie
    res.cookie(REFRESH_COOKIE, refreshToken, { ...cookieOptions(config), maxAge: REFRESH_COOKIE_MAX_AGE_MS });
    return signAccessToken(config, user);
}

function verifyRefreshToken(config, token) {
    try {
        const decoded = jwt.verify(token, config.jwt.refreshSecret, { algorithms: ['HS256'] });
        return decoded && isObjectId(decoded.userId) ? decoded : null;
    } catch (err) {
        return null;
    }
}

function rateLimited(res, retryAfterMs, error) {
    const retryAfter = Math.max(1, Math.ceil(retryAfterMs / 1000));
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({ error, retryAfter });
}

async function createUserForEmail(email) {
    const tempDisplayName = email.split('@')[0].slice(0, 50);
    // Retry on the (very unlikely) collision of the random temporary username.
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            return await User.create({
                email,
                username: 'user_' + crypto.randomBytes(4).toString('hex'),
                displayName: tempDisplayName,
                isVerified: false,
                isEmailVerified: true,
                avatarInitials: tempDisplayName.substring(0, 2).toUpperCase()
            });
        } catch (err) {
            if (err.code !== 11000) throw err;
            // The email itself may have been registered concurrently.
            const existing = await User.findOne({ email });
            if (existing) return existing;
        }
    }
    throw new Error('Could not allocate a unique username');
}

// Request OTP
router.post('/request-otp', async (req, res, next) => {
    try {
        const { config, emailService } = req.app.locals;
        const rawEmail = req.body && req.body.email;
        if (!rawEmail) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const email = normalizeEmail(rawEmail);
        if (!email) {
            return res.status(400).json({ error: 'Please enter a valid email address' });
        }

        if (!emailService.isConfigured()) {
            return res.status(503).json({ error: 'Email sign-in is temporarily unavailable because no email provider is configured on the server.' });
        }

        // Per-address limits: a short cooldown between sends and a cap per hour.
        // The per-IP limiter in app.js bounds abuse across many addresses.
        const now = new Date();
        const existing = await OTPVerification.findOne({ email }).lean();

        if (existing && existing.lastSentAt && now - existing.lastSentAt < OTP_RESEND_COOLDOWN_MS) {
            return rateLimited(res, OTP_RESEND_COOLDOWN_MS - (now - existing.lastSentAt),
                'Please wait before requesting another code.');
        }

        const windowActive = existing && existing.windowStartedAt && now - existing.windowStartedAt < OTP_SEND_WINDOW_MS;
        const windowStartedAt = windowActive ? new Date(existing.windowStartedAt) : now;
        const sendCount = (windowActive ? existing.sendCount || 0 : 0) + 1;
        if (sendCount > OTP_MAX_SENDS_PER_WINDOW) {
            return rateLimited(res, OTP_SEND_WINDOW_MS - (now - windowStartedAt),
                'Too many codes have been requested for this email. Please try again later.');
        }

        // 1. Generate secure random 6-digit OTP and keep only its HMAC
        const code = generateOtp();
        const codeHash = hashOtp(config.jwt.accessSecret, email, code);
        const record = {
            email,
            codeHash,
            codeExpiresAt: new Date(now.getTime() + OTP_TTL_MS),
            attempts: 0,
            consumedAt: null,
            lastSentAt: now,
            sendCount,
            windowStartedAt,
            expiresAt: new Date(Math.max(windowStartedAt.getTime() + OTP_SEND_WINDOW_MS, now.getTime() + OTP_TTL_MS)),
            createdAt: now
        };

        // 2. Store it, replacing any previous code for this address. The
        //    lastSentAt guard makes concurrent requests lose instead of both sending.
        if (existing) {
            const result = await OTPVerification.replaceOne(
                { _id: existing._id, lastSentAt: existing.lastSentAt || null },
                record
            );
            if (result.matchedCount === 0) {
                return rateLimited(res, OTP_RESEND_COOLDOWN_MS, 'Please wait before requesting another code.');
            }
        } else {
            try {
                await OTPVerification.create(record);
            } catch (err) {
                if (err.code === 11000) {
                    return rateLimited(res, OTP_RESEND_COOLDOWN_MS, 'Please wait before requesting another code.');
                }
                throw err;
            }
        }

        // 3. Send it. Success is only reported once the provider accepts the message.
        try {
            const delivery = await emailService.sendOtp(email, code, OTP_TTL_MS / 60000);
            console.log(`[AUTH] Verification code for ${maskEmail(email)} accepted by ${delivery.provider} (message id ${delivery.id})`);
        } catch (err) {
            // Don't leave a usable code behind for an email that never went out,
            // and hand the cooldown back so the user can retry straight away.
            await OTPVerification.updateOne(
                { email, codeHash },
                { $set: { codeHash: null, lastSentAt: (existing && existing.lastSentAt) || null } }
            );

            if (err instanceof EmailNotConfiguredError) {
                return res.status(503).json({ error: 'Email sign-in is temporarily unavailable because no email provider is configured on the server.' });
            }
            const detail = err.providerError ? ` (${err.providerError.name || 'provider error'}${err.providerError.statusCode ? ' ' + err.providerError.statusCode : ''})` : '';
            console.error(`[AUTH] Failed to send verification code to ${maskEmail(email)}: ${err.message}${detail}`);
            if (err.rateLimited) {
                res.set('Retry-After', '60');
                return res.status(503).json({ error: 'Our email service is busy right now. Please try again in a minute.', retryAfter: 60 });
            }
            return res.status(502).json({ error: 'We could not send the verification email. Please try again in a few minutes.' });
        }

        res.json({
            message: 'Verification code sent. It can take a minute to arrive, so check your spam folder too.',
            expiresInSeconds: OTP_TTL_MS / 1000,
            resendAvailableInSeconds: OTP_RESEND_COOLDOWN_MS / 1000
        });

    } catch (error) {
        next(error);
    }
});

// Verify OTP
router.post('/verify-otp', async (req, res, next) => {
    try {
        const { config } = req.app.locals;
        const { email: rawEmail, code: rawCode } = req.body || {};
        if (!rawEmail || !rawCode) {
            return res.status(400).json({ error: 'Email and verification code are required' });
        }

        const email = normalizeEmail(rawEmail);
        const code = typeof rawCode === 'string' ? rawCode.trim() : '';
        if (!email || !isWellFormedOtp(code)) {
            return res.status(400).json({ error: 'Enter the 6-digit code from your email', reason: 'invalid_request' });
        }

        // 1. Count the attempt atomically *before* comparing, so parallel
        //    guesses cannot all slip in under the attempt limit.
        const now = new Date();
        const otpRecord = await OTPVerification.findOneAndUpdate(
            {
                email,
                codeHash: { $type: 'string' },
                consumedAt: null,
                codeExpiresAt: { $gt: now },
                attempts: { $lt: OTP_MAX_ATTEMPTS }
            },
            { $inc: { attempts: 1 } },
            { returnDocument: 'after' }
        );

        if (!otpRecord) {
            const current = await OTPVerification.findOne({ email }).lean();
            let error = INVALID_CODE_ERROR;
            let reason = 'invalid_code';
            if (current && current.codeHash && current.attempts >= OTP_MAX_ATTEMPTS) {
                error = 'Too many attempts. Please request a new code.';
                reason = 'too_many_attempts';
            } else if (current && current.codeHash && current.codeExpiresAt && current.codeExpiresAt <= now) {
                error = 'This code has expired. Please request a new one.';
                reason = 'expired';
            }
            return res.status(400).json({ error, reason });
        }

        // 2. Compare against the stored HMAC (constant time)
        if (!otpMatches(config.jwt.accessSecret, email, code, otpRecord.codeHash)) {
            const remaining = OTP_MAX_ATTEMPTS - otpRecord.attempts;
            return res.status(400).json(remaining > 0
                ? { error: `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`, reason: 'incorrect_code', attemptsRemaining: remaining }
                : { error: 'Too many attempts. Please request a new code.', reason: 'too_many_attempts', attemptsRemaining: 0 });
        }

        // 3. Consume it: only one request can ever win this update.
        const consumed = await OTPVerification.findOneAndUpdate(
            { _id: otpRecord._id, codeHash: otpRecord.codeHash, consumedAt: null },
            { $set: { consumedAt: now, codeHash: null } }
        );
        if (!consumed) {
            return res.status(400).json({ error: INVALID_CODE_ERROR, reason: 'invalid_code' });
        }

        // Check if user exists
        let user = await User.findOne({ email });
        let isNewUser = false;

        if (!user) {
            // Auto-create user account
            isNewUser = true;
            user = await createUserForEmail(email);
            console.log(`[AUTH] Created account for ${maskEmail(email)}`);
        } else {
            // User exists but may not have completed profile setup
            isNewUser = !user.isVerified;
            if (!user.isEmailVerified) {
                await User.updateOne({ _id: user._id }, { $set: { isEmailVerified: true } });
            }
        }

        const accessToken = issueSession(res, config, user);

        res.json({
            message: 'Login successful',
            token: accessToken,
            isNewUser,
            user: sessionUser(user)
        });

    } catch (error) {
        next(error);
    }
});

// Refresh Token
router.post('/refresh', async (req, res, next) => {
    try {
        const { config } = req.app.locals;
        const refreshToken = getCookie(req, REFRESH_COOKIE);
        if (!refreshToken) {
            return res.status(401).json({ error: 'Refresh token not found' });
        }

        const decoded = verifyRefreshToken(config, refreshToken);
        if (!decoded) {
            return res.status(401).json({ error: 'Invalid refresh token' });
        }

        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        if ((user.tokenVersion || 0) !== (decoded.tv || 0)) {
            res.clearCookie(REFRESH_COOKIE, cookieOptions(config));
            return res.status(401).json({ error: 'Session has been signed out' });
        }

        res.json({
            token: signAccessToken(config, user),
            user: sessionUser(user)
        });

    } catch (error) {
        next(error);
    }
});

// Logout: revoke every refresh token issued to this account, then clear the cookie.
// Access tokens are stateless and remain valid until they expire (15 minutes).
router.post('/logout', async (req, res, next) => {
    try {
        const { config } = req.app.locals;
        const refreshToken = getCookie(req, REFRESH_COOKIE);
        const decoded = refreshToken ? verifyRefreshToken(config, refreshToken) : null;

        if (decoded) {
            const tv = decoded.tv || 0;
            // Only a current (non-revoked) token may bump the version.
            await User.updateOne(
                { _id: decoded.userId, tokenVersion: tv === 0 ? { $in: [0, null] } : tv },
                { $inc: { tokenVersion: 1 } }
            );
        }

        res.clearCookie(REFRESH_COOKIE, cookieOptions(config));
        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        next(error);
    }
});

// Get current user
router.get('/me', auth, async (req, res, next) => {
    try {
        if (!isObjectId(req.user.userId)) return res.status(401).json({ error: 'Token is not valid' });

        const user = await User.findById(req.user.userId)
            .select('-otpCode -otpExpires -tokenVersion')
            .populate('followers', 'username displayName avatarInitials')
            .populate('following', 'username displayName avatarInitials')
            .populate('showcaseCabinet')
            .populate('communities');

        if (!user) return res.status(404).json({ error: 'User not found' });

        const achievements = await getDynamicAchievements(user._id, user);

        res.json({
            _id: user._id,
            email: user.email,
            username: user.username,
            displayName: user.displayName,
            profilePhoto: user.profilePhoto || '',
            avatarUrl: user.avatarUrl || user.profilePhoto || '',
            avatarInitials: user.avatarInitials,
            bio: user.bio || '',
            interests: user.interests || [],
            isVerified: user.isVerified,
            followers: user.followers,
            following: user.following,
            showcaseCabinet: user.showcaseCabinet,
            communities: user.communities,
            achievements
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
module.exports.getCookie = getCookie;
