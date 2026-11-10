const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const auth = require('../middleware/auth');
const { getDynamicAchievements } = require('../lib/achievements');
const {
    isObjectId,
    normalizeEmail,
    normalizeUsername,
    usernameProblem,
    normalizePhone,
    parseLoginIdentifier
} = require('../lib/validation');
const {
    hashPassword,
    verifyPassword,
    needsRehash,
    burnVerificationTime,
    passwordProblem
} = require('../lib/passwords');
const { isProfileComplete, findAccount, isUsernameTaken, isEmailTaken } = require('../lib/accounts');
const { findPasswordSetupToken, consumePasswordSetupToken } = require('../lib/password-setup');

const REFRESH_COOKIE = 'refreshToken';
const REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
// One message for an unknown account, an account without a password and a
// wrong password, so the login form cannot be used to discover accounts.
const INVALID_CREDENTIALS = 'Incorrect username, email or password.';
const INVALID_LINK = 'This password link is invalid, has expired or was already used. Ask for a new one.';
const FIX_FIELDS = 'Please fix the highlighted fields.';
// Anything longer cannot be a valid password, so it is rejected without hashing.
const MAX_LOGIN_PASSWORD_LENGTH = 1024;

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
        id: user._id,
        name: user.displayName || user.name || '',
        displayName: user.displayName || user.name || '',
        email: user.email,
        phone: user.phone || '',
        username: user.username,
        profilePhoto: user.profilePhoto || '',
        avatarUrl: user.avatarUrl || user.profilePhoto || '',
        avatarInitials: user.avatarInitials,
        bio: user.bio || '',
        interests: user.interests || [],
        profileCompleted: isProfileComplete(user)
    };
}

// `pc` (profile completed) lets the auth middleware skip a database lookup for
// finished profiles. It is signed, so a client cannot set it.
function signAccessToken(config, user) {
    return jwt.sign(
        { userId: user._id.toString(), pc: isProfileComplete(user) },
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

// These endpoints set or use the refresh cookie, which production sends
// cross-site (SameSite=None). Refusing browser requests from other origins
// stops cross-site request forgery (logging a victim into an attacker's
// account, or out of their own). Browsers always send Origin on cross-origin
// requests; clients that send none (curl, health checks) carry no victim cookies.
router.use((req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD') return next();
    const origin = req.get('origin');
    if (!origin) return next();
    const { corsOrigins, isProduction } = req.app.locals.config;
    if (corsOrigins.includes(origin) || origin === `${req.protocol}://${req.get('host')}`) return next();
    if (!isProduction && (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'))) return next();
    res.status(403).json({ error: 'This request did not come from Flexy.' });
});

function fieldErrors(res, status, fields, error = FIX_FIELDS) {
    return res.status(status).json({ error, fields });
}

function duplicateFields(keyPattern = {}) {
    if (keyPattern.username) return { username: 'This username is taken. Try another one.' };
    if (keyPattern.email) return { email: 'An account with this email already exists. Log in instead.' };
    // Production databases may still carry the old unique phone index until
    // scripts/migrate-password-auth.js removes it.
    if (keyPattern.phone) return { phone: 'This phone number is already linked to another account.' };
    return { username: 'This username or email is already in use.' };
}

function validateSignup(body) {
    const errors = {};
    const values = {};

    const rawFullName = body.fullName !== undefined ? body.fullName : body.name;
    const fullName = typeof rawFullName === 'string' ? rawFullName.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim() : '';
    if (!fullName) errors.fullName = 'Enter your full name';
    else if (fullName.length > 50) errors.fullName = 'Use at most 50 characters';
    else values.displayName = fullName;

    const username = normalizeUsername(body.username);
    const usernameError = usernameProblem(username);
    if (usernameError) errors.username = usernameError;
    else values.username = username;

    if (typeof body.phone !== 'string' || !body.phone.trim()) {
        errors.phone = 'Enter your phone number';
    } else {
        const phone = normalizePhone(body.phone);
        if (phone) values.phone = phone;
        else errors.phone = 'Enter a valid phone number with 7-15 digits, like +91 98765 43210';
    }

    if (typeof body.email !== 'string' || !body.email.trim()) {
        errors.email = 'Enter your email address';
    } else {
        const email = normalizeEmail(body.email);
        if (email) values.email = email;
        else errors.email = 'Enter a valid email address, like name@example.com';
    }

    const passwordError = passwordProblem(body.password, values);
    if (passwordError) errors.password = passwordError;

    if (typeof body.confirmPassword !== 'string' || body.confirmPassword.length === 0) {
        errors.confirmPassword = 'Re-enter your password';
    } else if (body.confirmPassword !== body.password) {
        errors.confirmPassword = 'Passwords do not match';
    }

    return { values, errors };
}

// Create an account. Nothing is verified here: the email and phone number are
// stored as given and never shown as verified.

// Register endpoint specifically for register.html (and general registration)
router.post('/register', async (req, res, next) => {
    try {
        const { config } = req.app.locals;
        const body = req.body || {};
        const errors = {};
        const values = {};

        // Name / Full Name
        const rawName = body.name !== undefined ? body.name : body.fullName;
        const cleanName = typeof rawName === 'string'
            ? rawName.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim()
            : '';
        if (!cleanName) {
            errors.name = 'Please enter your full name.';
        } else if (cleanName.length < 2) {
            errors.name = 'Please enter your full name (at least 2 characters).';
        } else if (cleanName.length > 50) {
            errors.name = 'Use at most 50 characters.';
        } else {
            values.displayName = cleanName;
        }

        // Email
        if (typeof body.email !== 'string' || !body.email.trim()) {
            errors.email = 'Please enter your email address.';
        } else {
            const email = normalizeEmail(body.email);
            if (email) values.email = email;
            else errors.email = 'Please enter a valid email address.';
        }

        // Password
        const password = typeof body.password === 'string' ? body.password : '';
        if (!password) {
            errors.password = 'Password is required.';
        } else if (password.length < 8) {
            errors.password = 'Password must contain at least 8 characters.';
        } else if (password.length > 128) {
            errors.password = 'Password must not exceed 128 characters.';
        } else {
            const pError = passwordProblem(password, values);
            if (pError) errors.password = pError;
        }

        // Confirm Password (validated if provided)
        const confirmPassword = body.confirmPassword !== undefined ? body.confirmPassword : body['confirm-password'];
        if (confirmPassword !== undefined && confirmPassword !== null) {
            if (typeof confirmPassword !== 'string' || confirmPassword.length === 0) {
                errors.confirmPassword = 'Re-enter your password.';
            } else if (confirmPassword !== password) {
                errors.confirmPassword = 'Passwords do not match.';
            }
        }

        // Optional Username
        if (body.username !== undefined && String(body.username).trim()) {
            const username = normalizeUsername(body.username);
            const usernameError = usernameProblem(username);
            if (usernameError) errors.username = usernameError;
            else values.username = username;
        }

        // Optional Phone
        if (body.phone !== undefined && String(body.phone).trim()) {
            const phone = normalizePhone(body.phone);
            if (phone) values.phone = phone;
            else errors.phone = 'Enter a valid phone number with 7-15 digits, like +91 98765 43210';
        }

        if (Object.keys(errors).length > 0) {
            return fieldErrors(res, 400, errors, errors.name || errors.email || errors.password || errors.confirmPassword || FIX_FIELDS);
        }

        // Duplicate Email check
        const emailTaken = await isEmailTaken(values.email);
        if (emailTaken) {
            return fieldErrors(res, 409, { email: 'An account with this email already exists. Log in instead.' }, 'An account with this email already exists. Log in instead.');
        }

        // Allocate unique username if not provided
        if (!values.username) {
            let baseSeed = (values.displayName || values.email.split('@')[0])
                .toLowerCase()
                .replace(/[^a-z0-9._]/g, '')
                .replace(/^\.+|\.+$/g, '')
                .replace(/\.{2,}/g, '.');
            if (baseSeed.length < 3) baseSeed = 'user_' + baseSeed;
            if (baseSeed.length > 20) baseSeed = baseSeed.slice(0, 20);

            let candidate = baseSeed;
            let attempt = 0;
            while (await isUsernameTaken(candidate)) {
                attempt++;
                candidate = `${baseSeed.slice(0, 22)}_${crypto.randomBytes(2).toString('hex')}`;
                if (attempt > 15) {
                    candidate = `user_${crypto.randomBytes(4).toString('hex')}`;
                    break;
                }
            }
            values.username = candidate;
        } else {
            const usernameTaken = await isUsernameTaken(values.username);
            if (usernameTaken) {
                return fieldErrors(res, 409, { username: 'This username is taken. Try another one.' }, 'This username is taken. Try another one.');
            }
        }

        const passwordHash = await hashPassword(password);
        const initials = values.displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U';

        let user;
        try {
            user = await User.create({
                name: values.displayName,
                displayName: values.displayName,
                username: values.username,
                email: values.email,
                phone: values.phone || '',
                passwordHash,
                profileCompleted: true,
                isVerified: true,
                isEmailVerified: true,
                avatarInitials: initials,
                interests: ['General']
            });
        } catch (err) {
            if (err.code === 11000) {
                return fieldErrors(res, 409, duplicateFields(err.keyPattern), 'Some of these details are already in use.');
            }
            throw err;
        }

        const accessToken = issueSession(res, config, user);
        res.status(201).json({
            message: 'Account created successfully',
            token: accessToken,
            accessToken: accessToken,
            user: sessionUser(user)
        });
    } catch (error) {
        next(error);
    }
});

router.post('/signup', async (req, res, next) => {
    try {
        const { config } = req.app.locals;
        const { values, errors } = validateSignup(req.body || {});
        if (Object.keys(errors).length) return fieldErrors(res, 400, errors);

        const [usernameTaken, emailTaken] = await Promise.all([
            isUsernameTaken(values.username),
            isEmailTaken(values.email)
        ]);
        if (usernameTaken || emailTaken) {
            return fieldErrors(res, 409, {
                ...(usernameTaken ? duplicateFields({ username: 1 }) : {}),
                ...(emailTaken ? duplicateFields({ email: 1 }) : {})
            }, 'Some of these details are already in use.');
        }

        const passwordHash = await hashPassword(req.body.password);
        let user;
        try {
            user = await User.create({
                name: values.displayName,
                ...values,
                passwordHash,
                passwordChangedAt: new Date(),
                profileCompleted: false,
                isVerified: false,
                isEmailVerified: false,
                avatarInitials: values.displayName.substring(0, 2).toUpperCase()
            });
        } catch (err) {
            // A concurrent signup won the race for the same username or email.
            if (err.code === 11000) return fieldErrors(res, 409, duplicateFields(err.keyPattern), 'Some of these details are already in use.');
            throw err;
        }

        const accessToken = issueSession(res, config, user);
        res.status(201).json({
            message: 'Account created',
            token: accessToken,
            accessToken: accessToken,
            user: sessionUser(user)
        });
    } catch (error) {
        next(error);
    }
});

// Log in with a username or email address and a password.
router.post('/login', async (req, res, next) => {
    try {
        const { config } = req.app.locals;
        const body = req.body || {};
        const loginId = body.identifier || body.email || body.username;
        const lookup = parseLoginIdentifier(loginId);
        const { password } = body;
        if (!lookup || typeof password !== 'string' || password.length === 0) {
            return res.status(400).json({ error: 'Enter your username or email and your password.' });
        }
        if (password.length > MAX_LOGIN_PASSWORD_LENGTH) {
            return res.status(401).json({ error: INVALID_CREDENTIALS });
        }

        const user = await findAccount(lookup, '+passwordHash');
        // Accounts from the retired email sign-in have no password; they get
        // the same answer as a wrong password (see README: account recovery).
        const valid = user && user.passwordHash
            ? await verifyPassword(user.passwordHash, password)
            : await burnVerificationTime(password);
        if (!valid) return res.status(401).json({ error: INVALID_CREDENTIALS });

        if (needsRehash(user.passwordHash)) {
            await User.updateOne({ _id: user._id }, { $set: { passwordHash: await hashPassword(password) } });
        }

        const accessToken = issueSession(res, config, user);
        res.json({
            message: 'Logged in',
            token: accessToken,
            accessToken: accessToken,
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

// Logout: revoke every refresh token issued to this account (so it signs out
// every device), then clear the cookie. Access tokens are stateless and remain
// valid until they expire (15 minutes).
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

// Set or change the password of the signed-in account. Accounts from the
// retired email sign-in have no password yet; while they still hold a valid
// session they can set one here without a current password. Every other
// session is signed out; this device gets a fresh one.
router.post('/change-password', auth.allowIncompleteProfile, async (req, res, next) => {
    try {
        const { config } = req.app.locals;
        if (!isObjectId(req.user.userId)) return res.status(401).json({ error: 'Token is not valid' });
        const user = await User.findById(req.user.userId).select('+passwordHash');
        if (!user) return res.status(401).json({ error: 'Token is not valid' });

        const { currentPassword, newPassword, confirmPassword } = req.body || {};
        const hadPassword = Boolean(user.passwordHash);
        const fields = {};

        if (hadPassword) {
            if (typeof currentPassword !== 'string' || currentPassword.length === 0) {
                fields.currentPassword = 'Enter your current password';
            } else if (currentPassword.length > MAX_LOGIN_PASSWORD_LENGTH || !(await verifyPassword(user.passwordHash, currentPassword))) {
                fields.currentPassword = 'Your current password is incorrect';
            }
        }
        const problem = passwordProblem(newPassword, { username: user.username, email: user.email });
        if (problem) fields.newPassword = problem;
        else if (hadPassword && newPassword === currentPassword) fields.newPassword = 'Choose a password different from your current one';
        if (typeof confirmPassword !== 'string' || confirmPassword !== newPassword) fields.confirmPassword = 'Passwords do not match';

        if (Object.keys(fields).length) return fieldErrors(res, 400, fields, fields.currentPassword || FIX_FIELDS);

        const passwordHash = await hashPassword(newPassword);
        const updated = await User.findOneAndUpdate(
            { _id: user._id },
            { $set: { passwordHash, passwordChangedAt: new Date() }, $inc: { tokenVersion: 1 } },
            { returnDocument: 'after' }
        );
        if (!updated) return res.status(401).json({ error: 'Token is not valid' });

        const accessToken = issueSession(res, config, updated);
        res.json({
            message: hadPassword ? 'Password changed. Your other devices have been signed out.' : 'Password set.',
            token: accessToken,
            user: sessionUser(updated)
        });
    } catch (error) {
        next(error);
    }
});

// Set a new password with a one-time link from scripts/issue-password-link.js.
// Signs out every existing session of the account.
router.post('/password-reset', async (req, res, next) => {
    try {
        const { token, password, confirmPassword } = req.body || {};
        const record = await findPasswordSetupToken(token);
        if (!record) return res.status(400).json({ error: INVALID_LINK, reason: 'invalid_link' });

        const user = await User.findById(record.user).select('_id username email');
        if (!user) return res.status(400).json({ error: INVALID_LINK, reason: 'invalid_link' });

        const fields = {};
        const problem = passwordProblem(password, { username: user.username, email: user.email });
        if (problem) fields.password = problem;
        if (typeof confirmPassword !== 'string' || confirmPassword !== password) fields.confirmPassword = 'Passwords do not match';
        if (Object.keys(fields).length) return fieldErrors(res, 400, fields);

        const passwordHash = await hashPassword(password);
        if (!(await consumePasswordSetupToken(record))) {
            return res.status(400).json({ error: INVALID_LINK, reason: 'invalid_link' });
        }
        await User.updateOne(
            { _id: user._id },
            { $set: { passwordHash, passwordChangedAt: new Date() }, $inc: { tokenVersion: 1 } }
        );

        res.json({ message: 'Your password is set. You can log in now.', username: user.username });
    } catch (error) {
        next(error);
    }
});

// Get current user. Reachable before profile setup is finished: the setup page
// needs it.
router.get('/me', auth.allowIncompleteProfile, async (req, res, next) => {
    try {
        if (!isObjectId(req.user.userId)) return res.status(401).json({ error: 'Token is not valid' });

        const user = await User.findById(req.user.userId)
            .select('+passwordHash')
            .populate('followers', 'username displayName avatarInitials')
            .populate('following', 'username displayName avatarInitials')
            .populate('showcaseCabinet')
            .populate('communities');

        if (!user) return res.status(404).json({ error: 'User not found' });

        const achievements = await getDynamicAchievements(user._id, user);

        res.json({
            ...sessionUser(user),
            reputation: user.reputation,
            hasPassword: Boolean(user.passwordHash),
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
