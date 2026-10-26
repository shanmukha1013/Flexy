const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { io: ioClient } = require('socket.io-client');
const Auction = require('../../models/Auction');
const Message = require('../../models/Message');
const Notification = require('../../models/Notification');
const h = require('../helpers');

let mongod;
before(async () => { mongod = await h.startDatabase(); });
after(async () => { await h.stopDatabase(mongod); });
beforeEach(async () => { await h.clearDatabase(); });

describe('messages', () => {
    test('send, list conversations with unread counts, and read history', async () => {
        const { app, config } = h.buildApp();
        const alice = await h.createUser({ displayName: 'Alice' });
        const bob = await h.createUser({ displayName: 'Bob' });
        const carol = await h.createUser({ displayName: 'Carol' });

        const send = (from, to, content) => request(app).post('/api/messages').set(h.authHeader(config, from)).send({ recipientId: String(to._id), content });
        assert.equal((await send(alice, bob, 'hi bob')).status, 200);
        await send(alice, bob, 'second');
        await send(carol, bob, 'hello from carol');
        await send(bob, alice, 'hey alice');

        const convs = await request(app).get('/api/messages').set(h.authHeader(config, bob));
        assert.equal(convs.status, 200);
        assert.deepEqual(convs.body.map(c => c.peerName), ['Alice', 'Carol']);
        assert.equal(convs.body[0].lastMessage, 'hey alice');
        assert.equal(convs.body[0].unread, 2);
        assert.equal(convs.body[1].unread, 1);

        const history = await request(app).get(`/api/messages/${alice._id}`).set(h.authHeader(config, bob));
        assert.deepEqual(history.body.map(m => m.content), ['hi bob', 'second', 'hey alice']);

        const after = await request(app).get('/api/messages').set(h.authHeader(config, bob));
        assert.equal(after.body[0].unread, 0);
    });

    test('rejects invalid recipients and content', async () => {
        const { app, config } = h.buildApp();
        const alice = await h.createUser();
        const send = (body) => request(app).post('/api/messages').set(h.authHeader(config, alice)).send(body);
        assert.equal((await send({ recipientId: 'nope', content: 'x' })).status, 400);
        assert.equal((await send({ recipientId: String(alice._id), content: 'x' })).status, 400);
        assert.equal((await send({ recipientId: '507f1f77bcf86cd799439011', content: 'x' })).status, 404);
        assert.equal((await send({ recipientId: '507f1f77bcf86cd799439011', content: 'x'.repeat(2001) })).status, 400);
        assert.equal((await request(app).post('/api/messages').send({ recipientId: String(alice._id), content: 'x' })).status, 401);
        assert.equal((await request(app).get('/api/messages/not-an-id').set(h.authHeader(config, alice))).status, 400);
        assert.equal(await Message.countDocuments(), 0);
    });
});

describe('search and notifications', () => {
    test('search treats regex metacharacters literally', async () => {
        const { app } = h.buildApp();
        await h.createUser({ displayName: 'Coin (1947) collector' });
        await h.createUser({ displayName: 'Stamp collector' });

        const res = await request(app).get('/api/search').query({ q: '(1947)' });
        assert.equal(res.status, 200);
        assert.equal(res.body.users.length, 1);

        for (const q of ['(', '[', '*', '(a+)+$', '\\']) {
            const r = await request(app).get('/api/search').query({ q });
            assert.equal(r.status, 200, `query ${q}`);
        }
        const empty = await request(app).get('/api/search');
        assert.deepEqual(empty.body.users, []);
    });

    test('search does not leak private fields', async () => {
        const { app } = h.buildApp();
        await h.createUser({ displayName: 'Findable', phone: '+91 99999 00000' });
        const res = await request(app).get('/api/search').query({ q: 'Findable' });
        assert.equal(res.body.users[0].email, undefined);
        assert.equal(res.body.users[0].phone, undefined);
    });

    test('notifications are scoped to the recipient and mark-all-read works', async () => {
        const { app, config } = h.buildApp();
        const alice = await h.createUser();
        const bob = await h.createUser();
        const mine = await Notification.create({ recipient: alice._id, type: 'follow', title: 't', message: 'm' });
        const theirs = await Notification.create({ recipient: bob._id, type: 'follow', title: 't', message: 'm' });

        const list = await request(app).get('/api/notifications').set(h.authHeader(config, alice));
        assert.deepEqual(list.body.map(n => String(n._id)), [String(mine._id)]);

        assert.equal((await request(app).put(`/api/notifications/${theirs._id}/read`).set(h.authHeader(config, alice))).status, 404);
        assert.equal((await request(app).put('/api/notifications/bad-id/read').set(h.authHeader(config, alice))).status, 400);

        assert.equal((await request(app).post('/api/notifications/mark-all-read').set(h.authHeader(config, alice))).status, 200);
        assert.equal((await Notification.findById(mine._id)).read, true);
        assert.equal((await Notification.findById(theirs._id)).read, false);
    });
});

describe('Socket.IO', () => {
    let ctx;
    let baseUrl;
    const clients = [];

    before(async () => {
        ctx = h.buildApp();
        await new Promise(resolve => ctx.server.listen(0, '127.0.0.1', resolve));
        baseUrl = `http://127.0.0.1:${ctx.server.address().port}`;
    });

    after(async () => {
        for (const c of clients) c.close();
        await new Promise(resolve => ctx.io.close(() => resolve()));
    });

    function connect(token) {
        const socket = ioClient(baseUrl, { transports: ['websocket'], forceNew: true, auth: token ? { token } : {} });
        clients.push(socket);
        return new Promise((resolve, reject) => {
            socket.once('connect', () => resolve(socket));
            socket.once('connect_error', reject);
        });
    }

    const nextEvent = (socket, event, ms = 2000) => new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`timed out waiting for ${event}`)), ms);
        socket.once(event, (data) => { clearTimeout(timer); resolve(data); });
    });

    const noEvent = (socket, event, ms = 300) => new Promise((resolve, reject) => {
        const handler = () => reject(new Error(`unexpected ${event}`));
        socket.once(event, handler);
        setTimeout(() => { socket.off(event, handler); resolve(); }, ms);
    });

    test('anonymous viewers receive new_bid after a bid is accepted over REST', async () => {
        const seller = await h.createUser();
        const bidder = await h.createUser();
        const auction = await Auction.create({
            title: 'Live', description: 'd', seller: seller._id, startingBid: 100, currentBid: 100,
            endTime: new Date(Date.now() + 3600 * 1000)
        });

        const viewer = await connect();
        viewer.emit('join_auction', String(auction._id));
        await new Promise(r => setTimeout(r, 100));

        const received = nextEvent(viewer, 'new_bid');
        const res = await request(ctx.app).post(`/api/auctions/${auction._id}/bid`).set(h.authHeader(ctx.config, bidder)).send({ amount: 250 });
        assert.equal(res.status, 200);
        const data = await received;
        assert.equal(data.auctionId, String(auction._id));
        assert.equal(data.amount, 250);
        assert.equal(data.bidder.username, bidder.username);
    });

    test('clients can no longer spoof bids or chat messages through the socket', async () => {
        const auctionId = '507f1f77bcf86cd799439011';
        const attacker = await connect();
        const watcher = await connect();
        watcher.emit('join_auction', auctionId);
        watcher.emit('join_chat', 'a_b');
        await new Promise(r => setTimeout(r, 100));

        attacker.emit('place_bid', { auctionId, amount: 1 });
        attacker.emit('send_message', { chatId: 'a_b', text: 'spoofed' });
        await Promise.all([noEvent(watcher, 'new_bid'), noEvent(watcher, 'receive_message')]);
    });

    test('direct messages are pushed only to the authenticated recipient', async () => {
        const alice = await h.createUser();
        const bob = await h.createUser();
        const eve = await h.createUser();

        const bobSocket = await connect(h.tokenFor(ctx.config, bob));
        const eveSocket = await connect(h.tokenFor(ctx.config, eve));
        const anonSocket = await connect();
        await new Promise(r => setTimeout(r, 100));

        const forBob = nextEvent(bobSocket, 'receive_message');
        const res = await request(ctx.app).post('/api/messages').set(h.authHeader(ctx.config, alice))
            .send({ recipientId: String(bob._id), content: 'secret' });
        assert.equal(res.status, 200);

        const data = await forBob;
        assert.equal(data.text, 'secret');
        assert.equal(data.senderId, String(alice._id));
        await Promise.all([noEvent(eveSocket, 'receive_message'), noEvent(anonSocket, 'receive_message')]);
    });

    test('an invalid socket token connects as an anonymous viewer without DM access', async () => {
        const alice = await h.createUser();
        const bob = await h.createUser();
        const forged = h.tokenFor(ctx.config, bob, { secret: 'flexy_secure_jwt_key_2026' });
        const socket = await connect(forged);
        const pending = noEvent(socket, 'receive_message');
        await request(ctx.app).post('/api/messages').set(h.authHeader(ctx.config, alice)).send({ recipientId: String(bob._id), content: 'x' });
        await pending;
    });
});
