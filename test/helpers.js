// test/helpers.js
// Shared fixtures. Integration tests run against a throwaway in-memory MongoDB
// (mongodb-memory-server) and a fake email service: no real database, inbox or
// email provider is ever touched.

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { loadConfig } = require('../config/env');
const { createApp } = require('../app');
const User = require('../models/User');

const TEST_ENV = Object.freeze({
    NODE_ENV: 'test',
    JWT_SECRET: 'test-access-secret-0123456789abcdefghijklmnop',
    JWT_REFRESH_SECRET: 'test-refresh-secret-0123456789abcdefghijklmn',
    EMAIL_TRANSPORT: 'resend',
    RESEND_API_KEY: 're_test_key'
});

function testConfig(envOverrides = {}) {
    return loadConfig({ ...TEST_ENV, ...envOverrides });
}

function createFakeEmailService({ configured = true } = {}) {
    return {
        sent: [],
        failures: [],
        isConfigured() {
            return configured;
        },
        describe() {
            return 'fake';
        },
        async sendOtp(to, code, ttlMinutes) {
            if (this.failures.length) throw this.failures.shift();
            this.sent.push({ to, code, ttlMinutes });
            return { id: `fake-${this.sent.length}`, provider: 'fake' };
        },
        lastCodeFor(email) {
            const match = [...this.sent].reverse().find(m => m.to === email);
            return match && match.code;
        }
    };
}

// Rate limits are effectively disabled unless a test opts in.
function buildApp({ env, emailService, rateLimits } = {}) {
    const config = testConfig(env);
    const email = emailService || createFakeEmailService();
    const { app, server, io } = createApp({
        config,
        emailService: email,
        rateLimits: rateLimits || { otpRequest: { limit: 10000 }, otpVerify: { limit: 10000 } }
    });
    return { app, server, io, config, emailService: email };
}

async function startDatabase() {
    const mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri('flexy_test'));
    // Build unique/TTL indexes up front so tests see production constraints.
    await Promise.all(mongoose.modelNames().map(name => mongoose.model(name).init()));
    return mongod;
}

async function stopDatabase(mongod) {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
}

async function clearDatabase() {
    const { collections } = mongoose.connection;
    await Promise.all(Object.values(collections).map(c => c.deleteMany({})));
}

let userCounter = 0;
async function createUser(fields = {}) {
    userCounter += 1;
    return User.create({
        email: `user${userCounter}@example.test`,
        username: `user${userCounter}_${Date.now().toString(36)}`,
        displayName: `User ${userCounter}`,
        isVerified: true,
        ...fields
    });
}

function tokenFor(config, user, options = {}) {
    return jwt.sign(
        { userId: user._id.toString(), email: user.email },
        options.secret || config.jwt.accessSecret,
        { expiresIn: options.expiresIn || '15m', algorithm: 'HS256' }
    );
}

function authHeader(config, user) {
    return { Authorization: `Bearer ${tokenFor(config, user)}` };
}

// Runs the real request -> email -> verify flow and returns the session.
async function loginViaOtp(app, emailService, email) {
    const requested = await request(app).post('/api/auth/request-otp').send({ email });
    if (requested.status !== 200) throw new Error(`request-otp failed: ${requested.status} ${JSON.stringify(requested.body)}`);
    const code = emailService.lastCodeFor(email);
    const verified = await request(app).post('/api/auth/verify-otp').send({ email, code });
    if (verified.status !== 200) throw new Error(`verify-otp failed: ${verified.status} ${JSON.stringify(verified.body)}`);
    const setCookie = verified.headers['set-cookie'] || [];
    const cookie = setCookie.map(c => c.split(';')[0]).join('; ');
    return { token: verified.body.token, user: verified.body.user, isNewUser: verified.body.isNewUser, cookie, setCookie };
}

module.exports = {
    TEST_ENV,
    testConfig,
    createFakeEmailService,
    buildApp,
    startDatabase,
    stopDatabase,
    clearDatabase,
    createUser,
    tokenFor,
    authHeader,
    loginViaOtp
};
