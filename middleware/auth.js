const jwt = require('jsonwebtoken');

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

function auth(req, res, next) {
    const { user, error } = verifyAccessToken(req);
    if (error) return res.status(401).json({ error });
    req.user = user;
    next();
}

// Attaches req.user when a valid token is present but never rejects the request.
auth.optional = function optionalAuth(req, res, next) {
    const { user } = verifyAccessToken(req);
    if (user) req.user = user;
    next();
};

module.exports = auth;
