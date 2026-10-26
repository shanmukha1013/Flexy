const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { isProfileComplete } = require('../lib/accounts');
const { isObjectId } = require('../lib/validation');

const PROFILE_INCOMPLETE = {
    error: 'Finish setting up your profile to continue.',
    reason: 'profile_incomplete'
};

// Signing and verification read the same secret from app config. Previously the
// two sides fell back to *different* hardcoded strings, so tokens issued without
// JWT_SECRET set could never be verified.
function verifyAccessToken(req) {
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return { error: 'No token, authorization denied' };

    const token = authHeader.slice('Bearer '.length).trim();
    try {
        const decoded = jwt.verify(token, req.app.locals.config.jwt.accessSecret, { algorithms: ['HS256'] });
        if (!decoded || typeof decoded.userId !== 'string') return { error: 'Token is not valid' };
        return { user: decoded };
    } catch (err) {
        return { error: 'Token is not valid' };
    }
}

// The default guard for protected routes: a valid access token AND a finished
// profile. Completion is checked here on the server, so editing browser
// storage or skipping the setup page does not unlock anything.
//
// Access tokens carry a signed `pc` claim once the profile is complete. The
// flag never goes back to false, so `pc: true` is safe to trust; any other
// token (issued before setup finished, or before the claim existed) is
// checked against the database.
async function auth(req, res, next) {
    const { user, error } = verifyAccessToken(req);
    if (error) return res.status(401).json({ error });
    req.user = user;
    if (user.pc === true) return next();

    if (!isObjectId(user.userId)) return res.status(401).json({ error: 'Token is not valid' });
    const account = await User.findById(user.userId).select('profileCompleted isVerified').lean();
    if (!account) return res.status(401).json({ error: 'Token is not valid' });
    if (!isProfileComplete(account)) return res.status(403).json(PROFILE_INCOMPLETE);
    next();
}

// For the few routes an account must reach *before* setup is finished: reading
// its own session, completing the profile, and managing its password.
auth.allowIncompleteProfile = function allowIncompleteProfile(req, res, next) {
    const { user, error } = verifyAccessToken(req);
    if (error) return res.status(401).json({ error });
    req.user = user;
    next();
};

// Attaches req.user when a valid token is present but never rejects the request.
auth.optional = function optionalAuth(req, res, next) {
    const { user } = verifyAccessToken(req);
    if (user) req.user = user;
    next();
};

auth.PROFILE_INCOMPLETE = PROFILE_INCOMPLETE;

module.exports = auth;
