// app.js
// Builds the Express app and Socket.IO server without connecting to MongoDB or
// listening on a port. server.js does that; tests construct the app directly
// with their own config and a fake email service.

const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const { rateLimit } = require('express-rate-limit');
const { setupSockets } = require('./lib/sockets');
const { HttpError } = require('./lib/validation');

const PUBLIC_DIR = path.join(__dirname, 'public');
// Images are sent as base64 inside JSON. MongoDB rejects documents over 16MB,
// so accepting larger bodies (the old limit was 50MB) only wastes memory.
const BODY_LIMIT = '16mb';

const DEFAULT_RATE_LIMITS = {
    otpRequest: { windowMs: 15 * 60 * 1000, limit: 20 },
    otpVerify: { windowMs: 15 * 60 * 1000, limit: 30 }
};

const DB_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

function requireDatabase(req, res, next) {
    // 1 = connected; 2 = connecting (Mongoose buffers queries until it is ready).
    const state = mongoose.connection.readyState;
    if (state === 1 || state === 2) return next();
    res.status(503).json({ error: 'The database is unavailable. Please try again shortly.' });
}

function createApp({ config, emailService, rateLimits = {} }) {
    const app = express();
    app.locals.config = config;
    app.locals.emailService = emailService;

    app.disable('x-powered-by');
    // Behind Render's proxy the client IP is in X-Forwarded-For; without this
    // every request would share one rate-limit bucket.
    if (config.trustProxy) app.set('trust proxy', config.trustProxy);

    app.use((req, res, next) => {
        res.set('X-Content-Type-Options', 'nosniff');
        res.set('X-Frame-Options', 'SAMEORIGIN');
        res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
        if (config.isProduction) res.set('Strict-Transport-Security', 'max-age=15552000');
        next();
    });

    // CORS: only the configured frontends may call the API with credentials
    // (the refresh-token cookie). Requests without an Origin header (same-origin
    // pages, curl, health checks) are unaffected.
    app.use(cors({
        origin(origin, callback) {
            callback(null, !origin || config.corsOrigins.includes(origin));
        },
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token'],
        credentials: true
    }));
    app.use(express.json({ limit: BODY_LIMIT }));
    app.use(express.urlencoded({ limit: BODY_LIMIT, extended: true }));

    // Serve static frontend files
    app.use(express.static(PUBLIC_DIR));

    app.get('/api/health', (req, res) => {
        const database = DB_STATES[mongoose.connection.readyState] || 'unknown';
        const healthy = database === 'connected';
        res.status(healthy ? 200 : 503).json({
            status: healthy ? 'ok' : 'degraded',
            database,
            email: emailService.isConfigured() ? 'configured' : 'not_configured',
            uptimeSeconds: Math.round(process.uptime())
        });
    });

    app.use('/api', requireDatabase);

    const limiter = (name, error) => rateLimit({
        ...DEFAULT_RATE_LIMITS[name],
        ...rateLimits[name],
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        message: { error }
    });
    app.use('/api/auth/request-otp', limiter('otpRequest', 'Too many code requests from this network. Please try again later.'));
    app.use('/api/auth/verify-otp', limiter('otpVerify', 'Too many verification attempts from this network. Please try again later.'));

    // API Routes
    app.use('/api/auth', require('./routes/auth'));
    app.use('/api/users', require('./routes/users'));
    app.use('/api/communities', require('./routes/communities'));
    app.use('/api/collections', require('./routes/collections'));
    app.use('/api/posts', require('./routes/posts'));
    app.use('/api/auctions', require('./routes/auctions'));
    app.use('/api/messages', require('./routes/messages'));
    app.use('/api/search', require('./routes/search'));
    app.use('/api/notifications', require('./routes/notifications'));
    app.use('/api/groups', require('./routes/groups'));

    // Unknown API routes return JSON; other GETs fall back to the frontend entry page.
    app.use('/api', (req, res) => {
        res.status(404).json({ error: 'API route not found' });
    });
    app.use((req, res) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            return res.status(404).json({ error: 'Not found' });
        }
        res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
    });

    // Central error handler: map client errors to 4xx and never leak internals.
    // eslint-disable-next-line no-unused-vars
    app.use((err, req, res, next) => {
        if (res.headersSent) return next(err);
        if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body is not valid JSON' });
        if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large' });
        if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
        if (err.name === 'CastError') return res.status(400).json({ error: `Invalid ${err.path}` });
        if (err.name === 'ValidationError') {
            return res.status(400).json({ error: Object.values(err.errors).map(e => e.message).join(', ') });
        }
        if (err.code === 11000) return res.status(409).json({ error: 'That value is already in use' });
        if (err.status >= 400 && err.status < 500 && err.expose) return res.status(err.status).json({ error: err.message });

        console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, err);
        res.status(500).json({ error: 'Server error' });
    });

    const server = http.createServer(app);
    const io = new Server(server, {
        cors: {
            origin: config.corsOrigins,
            methods: ['GET', 'POST'],
            credentials: true
        }
    });
    setupSockets(io, config);
    app.set('io', io);

    return { app, server, io };
}

module.exports = { createApp, DEFAULT_RATE_LIMITS };
