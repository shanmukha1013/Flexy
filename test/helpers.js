// test/helpers.js
// Shared fixtures. Integration tests run against a throwaway in-memory MongoDB
// (mongodb-memory-server): no real database is ever touched.

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
    JWT_REFRESH_SECRET: 'test-refresh-secret-0123456789abcdefghijklmn'
});

// A password that satisfies the policy; tests that need another say so.
const PASSWORD = 'Vintage watch 1962';

const NO_RATE_LIMITS = Object.freeze({
    signup: { limit: 10000 },
    login: { limit: 10000 },
    loginAccount: { limit: 10000 },
    password: { limit: 10000 }
});

function testConfig(envOverrides = {}) {
    return loadConfig({ ...TEST_ENV, ...envOverrides });
}

// Rate limits are effectively disabled unless a test opts in.
function buildApp({ env, rateLimits } = {}) {
    const config = testConfig(env);
    const { app, server, io } = createApp({
        config,
        rateLimits: { ...NO_RATE_LIMITS, ...rateLimits }
    });
    return { app, server, io, config };
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

// Inserts a user directly. By default it looks like an existing member who
// finished profile setup (and has no password, like accounts from the old
// email sign-in) so marketplace tests can use it straight away.
let userCounter = 0;
async function createUser(fields = {}) {
    userCounter += 1;
    return User.create({
        email: `user${userCounter}@example.test`,
        username: `user${userCounter}_${Date.now().toString(36)}`,
        displayName: `User ${userCounter}`,
        isVerified: true,
        profileCompleted: true,
        interests: ['Coins'],
        ...fields
    });
}

// Access token as the server would issue it. `pc` mirrors the real claim; omit
// it (pc: undefined) to imitate a token issued before the claim existed.
function tokenFor(config, user, options = {}) {
    const claims = { userId: user._id.toString() };
    if (options.pc !== undefined) claims.pc = options.pc;
    return jwt.sign(
        claims,
        options.secret || config.jwt.accessSecret,
        { expiresIn: options.expiresIn || '15m', algorithm: 'HS256' }
    );
}

function authHeader(config, user, options) {
    return { Authorization: `Bearer ${tokenFor(config, user, options)}` };
}

let signupCounter = 0;
function signupFields(overrides = {}) {
    signupCounter += 1;
    return {
        fullName: 'Shan Reddy',
        username: `collector_${signupCounter}`,
        phone: '+91 98765 43210',
        email: `collector${signupCounter}@example.test`,
        password: PASSWORD,
        confirmPassword: PASSWORD,
        ...overrides
    };
}

function cookieFrom(res) {
    return (res.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
}

function sessionFrom(res) {
    return {
        status: res.status,
        token: res.body.token,
        user: res.body.user,
        cookie: cookieFrom(res),
        setCookie: res.headers['set-cookie'] || [],
        auth: { Authorization: `Bearer ${res.body.token}` }
    };
}

// Registers through the real endpoint and returns the session.
async function signup(app, overrides = {}) {
    const fields = signupFields(overrides);
    const res = await request(app).post('/api/auth/signup').send(fields);
    if (res.status !== 201) throw new Error(`signup failed: ${res.status} ${JSON.stringify(res.body)}`);
    return { ...sessionFrom(res), fields };
}

async function login(app, identifier, password = PASSWORD) {
    const res = await request(app).post('/api/auth/login').send({ identifier, password });
    if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
    return sessionFrom(res);
}

// Finishes profile setup through the real endpoint, then refreshes so the
// returned access token carries the completed-profile claim.
async function completeProfile(app, session, fields = { interests: ['Coins'] }) {
    const put = await request(app).put(`/api/users/${session.user._id}`).set(session.auth).send(fields);
    if (put.status !== 200) throw new Error(`profile update failed: ${put.status} ${JSON.stringify(put.body)}`);
    const refreshed = await request(app).post('/api/auth/refresh').set('Cookie', session.cookie);
    if (refreshed.status !== 200) throw new Error(`refresh failed: ${refreshed.status}`);
    return { ...session, token: refreshed.body.token, user: refreshed.body.user, auth: { Authorization: `Bearer ${refreshed.body.token}` } };
}

module.exports = {
    TEST_ENV,
    PASSWORD,
    testConfig,
    buildApp,
    startDatabase,
    stopDatabase,
    clearDatabase,
    createUser,
    tokenFor,
    authHeader,
    signupFields,
    cookieFrom,
    signup,
    login,
    completeProfile
};
