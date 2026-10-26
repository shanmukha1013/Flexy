const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const User = require('../../models/User');
const Auction = require('../../models/Auction');
const Notification = require('../../models/Notification');
const Collection = require('../../models/Collection');
const { closeEndedAuctions } = require('../../lib/auctions');
const h = require('../helpers');

let mongod;
before(async () => { mongod = await h.startDatabase(); });
after(async () => { await h.stopDatabase(mongod); });
beforeEach(async () => { await h.clearDatabase(); });

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function auctionBody(overrides = {}) {
    return {
        title: 'Vintage Omega',
        description: '1960s Seamaster',
        category: 'Watches',
        images: [PNG, PNG],
        startingBid: '500',
        reservePrice: '',
        estimatedValue: '',
        durationHours: 120,
        auctionType: 'Standard',
        ...overrides
    };
}

describe('users', () => {
    test('the unauthenticated fake-user cleanup and demo routes are gone', async () => {
        const { app } = h.buildApp();
        await h.createUser({ username: 'user_deadbeef' });
        const del = await request(app).delete('/api/users/cleanup-fake');
        assert.equal(del.status, 404);
        assert.equal(await User.countDocuments({ username: 'user_deadbeef' }), 1);
        assert.equal((await request(app).get('/api/users/all_for_demo')).status, 400);
    });

    test('a public profile hides contact details from other users but not the owner', async () => {
        const { app, config } = h.buildApp();
        const owner = await h.createUser({ phone: '+91 98765 43210' });
        const other = await h.createUser();

        const anon = await request(app).get(`/api/users/${owner._id}`);
        assert.equal(anon.status, 200);
        assert.equal(anon.body.email, undefined);
        assert.equal(anon.body.phone, undefined);
        assert.equal(anon.body.tokenVersion, undefined);
        assert.ok(Array.isArray(anon.body.achievements));

        const byOther = await request(app).get(`/api/users/${owner._id}`).set(h.authHeader(config, other));
        assert.equal(byOther.body.email, undefined);

        const self = await request(app).get(`/api/users/${owner._id}`).set(h.authHeader(config, owner));
        assert.equal(self.body.email, owner.email);
    });

    test('malformed ids return 400 instead of a server error', async () => {
        const { app } = h.buildApp();
        assert.equal((await request(app).get('/api/users/undefined')).status, 400);
    });

    test('users can only update their own profile', async () => {
        const { app, config } = h.buildApp();
        const a = await h.createUser();
        const b = await h.createUser();
        const res = await request(app).put(`/api/users/${a._id}`).set(h.authHeader(config, b)).send({ displayName: 'Hacked' });
        assert.equal(res.status, 403);
        assert.equal((await User.findById(a._id)).displayName, a.displayName);
    });

    test('completing profile setup without a bio marks the profile verified', async () => {
        const { app, config } = h.buildApp();
        const user = await h.createUser({ isVerified: false, username: 'user_abcdef12' });
        const res = await request(app).put(`/api/users/${user._id}`).set(h.authHeader(config, user)).send({
            displayName: 'Shan', username: 'shan_collects', bio: '', interests: ['Coins'], avatarUrl: PNG
        });
        assert.equal(res.status, 200);
        assert.equal(res.body.isVerified, true);
        assert.equal(res.body.username, 'shan_collects');
        assert.equal(res.body.avatarUrl, PNG);
    });

    test('profile updates validate username, email, text and images', async () => {
        const { app, config } = h.buildApp();
        const user = await h.createUser();
        const taken = await h.createUser({ username: 'taken_name' });
        const put = (body) => request(app).put(`/api/users/${user._id}`).set(h.authHeader(config, user)).send(body);

        assert.equal((await put({ username: 'a b' })).status, 400);
        assert.equal((await put({ username: taken.username })).status, 400);
        assert.equal((await put({ email: 'someone-else@example.test' })).status, 400);
        assert.equal((await put({ email: user.email })).status, 200);
        assert.equal((await put({ bio: 'x'.repeat(501) })).status, 400);
        assert.equal((await put({ avatarUrl: "https://x.test/a.png') ; x:url('" })).status, 400);

        const res = await put({ displayName: '<img src=x onerror=alert(1)>Shan' });
        assert.equal(res.status, 200);
        assert.equal(res.body.displayName, 'img src=x onerror=alert(1)Shan');
    });

    test('follow is idempotent and notifies once; unfollow removes both sides', async () => {
        const { app, config } = h.buildApp();
        const a = await h.createUser();
        const b = await h.createUser();
        await request(app).post(`/api/users/${b._id}/follow`).set(h.authHeader(config, a));
        await request(app).post(`/api/users/${b._id}/follow`).set(h.authHeader(config, a));
        assert.equal((await User.findById(b._id)).followers.length, 1);
        assert.equal(await Notification.countDocuments({ recipient: b._id, type: 'follow' }), 1);
        assert.equal((await request(app).post(`/api/users/${a._id}/follow`).set(h.authHeader(config, a))).status, 400);

        await request(app).post(`/api/users/${b._id}/unfollow`).set(h.authHeader(config, a));
        assert.equal((await User.findById(b._id)).followers.length, 0);
        assert.equal((await User.findById(a._id)).following.length, 0);
    });
});

describe('auctions', () => {
    test('creating an auction requires authentication', async () => {
        const { app } = h.buildApp();
        const res = await request(app).post('/api/auctions').send(auctionBody());
        assert.equal(res.status, 401);
        assert.equal(await Auction.countDocuments(), 0);
    });

    test('the seller is taken from the token, not the request body', async () => {
        const { app, config } = h.buildApp();
        const seller = await h.createUser();
        const victim = await h.createUser();
        const res = await request(app).post('/api/auctions').set(h.authHeader(config, seller))
            .send(auctionBody({ sellerId: String(victim._id) }));
        assert.equal(res.status, 201);
        assert.equal(String(res.body.seller), String(seller._id));
        assert.equal(res.body.currentBid, 500);
        assert.ok(new Date(res.body.endTime) > new Date());
    });

    test('invalid auction input is rejected with 400', async () => {
        const { app, config } = h.buildApp();
        const seller = await h.createUser();
        const post = (body) => request(app).post('/api/auctions').set(h.authHeader(config, seller)).send(auctionBody(body));
        assert.equal((await post({ durationHours: undefined })).status, 400);
        assert.equal((await post({ durationHours: 100000 })).status, 400);
        assert.equal((await post({ startingBid: 'free' })).status, 400);
        assert.equal((await post({ title: '' })).status, 400);
        assert.equal((await post({ images: ['javascript:alert(1)'] })).status, 400);
        assert.equal((await post({ auctionType: 'Bogus' })).status, 400);
        assert.equal(await Auction.countDocuments(), 0);
    });

    async function makeAuction(seller, fields = {}) {
        return Auction.create({
            title: 'Coin', description: 'Rare', seller: seller._id, startingBid: 100, currentBid: 100,
            images: [PNG, PNG, PNG], bids: [], endTime: new Date(Date.now() + 3600 * 1000), ...fields
        });
    }

    test('bids use the token identity and must exceed the current bid', async () => {
        const { app, config } = h.buildApp();
        const seller = await h.createUser();
        const bidder = await h.createUser();
        const other = await h.createUser();
        const auction = await makeAuction(seller);

        assert.equal((await request(app).post(`/api/auctions/${auction._id}/bid`).send({ amount: 200 })).status, 401);
        assert.equal((await request(app).post(`/api/auctions/${auction._id}/bid`).set(h.authHeader(config, seller)).send({ amount: 200 })).status, 400);
        assert.equal((await request(app).post(`/api/auctions/${auction._id}/bid`).set(h.authHeader(config, bidder)).send({ amount: 100 })).status, 400);
        assert.equal((await request(app).post(`/api/auctions/${auction._id}/bid`).set(h.authHeader(config, bidder)).send({ amount: 'lots' })).status, 400);

        const ok = await request(app).post(`/api/auctions/${auction._id}/bid`).set(h.authHeader(config, bidder))
            .send({ amount: 150, bidderId: String(other._id) });
        assert.equal(ok.status, 200);
        const saved = await Auction.findById(auction._id);
        assert.equal(saved.currentBid, 150);
        assert.equal(String(saved.highestBidder), String(bidder._id));
        assert.equal(await Notification.countDocuments({ recipient: seller._id, type: 'bid' }), 1);

        await request(app).post(`/api/auctions/${auction._id}/bid`).set(h.authHeader(config, other)).send({ amount: 175 });
        assert.equal(await Notification.countDocuments({ recipient: bidder._id, type: 'outbid' }), 1);
    });

    test('concurrent bids never let a lower bid overwrite a higher one', async () => {
        const { app, config } = h.buildApp();
        const seller = await h.createUser();
        const bidders = await Promise.all(Array.from({ length: 6 }, () => h.createUser()));
        const auction = await makeAuction(seller);

        const amounts = [110, 160, 120, 150, 130, 140];
        await Promise.all(bidders.map((b, i) =>
            request(app).post(`/api/auctions/${auction._id}/bid`).set(h.authHeader(config, b)).send({ amount: amounts[i] })));

        const saved = await Auction.findById(auction._id);
        const maxBid = Math.max(...saved.bids.map(b => b.amount));
        assert.equal(saved.currentBid, maxBid);
        assert.equal(String(saved.highestBidder), String(saved.bids.find(b => b.amount === maxBid).bidder));
        // Accepted bids are strictly increasing in the order they were applied.
        for (let i = 1; i < saved.bids.length; i++) assert.ok(saved.bids[i].amount > saved.bids[i - 1].amount);
    });

    test('bids on ended auctions are rejected', async () => {
        const { app, config } = h.buildApp();
        const seller = await h.createUser();
        const bidder = await h.createUser();
        const auction = await makeAuction(seller, { endTime: new Date(Date.now() - 1000) });
        const res = await request(app).post(`/api/auctions/${auction._id}/bid`).set(h.authHeader(config, bidder)).send({ amount: 500 });
        assert.equal(res.status, 400);
    });

    test('list responses are bounded and omit heavy fields; filters work', async () => {
        const { app } = h.buildApp();
        const a = await h.createUser();
        const b = await h.createUser();
        await makeAuction(a, { title: 'Later', endTime: new Date(Date.now() + 7200 * 1000), ownershipProof: 'x'.repeat(1000) });
        await makeAuction(b, { title: 'Sooner', endTime: new Date(Date.now() + 600 * 1000) });
        await makeAuction(b, { title: 'Done', status: 'ended' });

        const list = await request(app).get('/api/auctions?status=active&sort=ending_soon');
        assert.equal(list.status, 200);
        assert.deepEqual(list.body.map(x => x.title), ['Sooner', 'Later']);
        assert.equal(list.body[0].images.length, 1);
        assert.equal(list.body[1].ownershipProof, undefined);
        assert.equal(list.body[0].bids, undefined);
        assert.equal(list.body[0].seller.email, undefined);

        const bySeller = await request(app).get(`/api/auctions?seller=${a._id}`);
        assert.deepEqual(bySeller.body.map(x => x.title), ['Later']);
        assert.equal((await request(app).get('/api/auctions?seller=nope')).status, 400);
        assert.equal((await request(app).get('/api/auctions?status=ended')).body.length, 1);

        const detail = await request(app).get(`/api/auctions/${list.body[0]._id}`);
        assert.equal(detail.body.images.length, 3);
    });

    test('watching an auction is authenticated and idempotent', async () => {
        const { app, config } = h.buildApp();
        const seller = await h.createUser();
        const watcher = await h.createUser();
        const auction = await makeAuction(seller);
        assert.equal((await request(app).post(`/api/auctions/${auction._id}/watch`)).status, 401);
        await request(app).post(`/api/auctions/${auction._id}/watch`).set(h.authHeader(config, watcher));
        await request(app).post(`/api/auctions/${auction._id}/watch`).set(h.authHeader(config, watcher));
        assert.equal((await Auction.findById(auction._id)).watchers.length, 1);
        assert.equal((await User.findById(watcher._id)).savedAuctions.length, 1);
    });

    test('the auction closer ends auctions and notifies exactly once, even when runs overlap', async () => {
        const seller = await h.createUser();
        const winner = await h.createUser();
        await makeAuction(seller, { endTime: new Date(Date.now() - 1000), highestBidder: winner._id, currentBid: 900 });
        await makeAuction(seller, { title: 'No bids', endTime: new Date(Date.now() - 1000) });

        const results = await Promise.all([closeEndedAuctions(), closeEndedAuctions(), closeEndedAuctions()]);
        assert.equal(results.reduce((a, b) => a + b, 0), 2);
        assert.equal(await Auction.countDocuments({ status: 'ended' }), 2);
        assert.equal(await Notification.countDocuments({ type: 'auction_won', recipient: winner._id }), 1);
        assert.equal(await Notification.countDocuments({ type: 'auction_ended', recipient: seller._id }), 2);
    });
});

describe('collections', () => {
    test('create requires auth and uses the token owner', async () => {
        const { app, config } = h.buildApp();
        const owner = await h.createUser();
        const victim = await h.createUser();
        assert.equal((await request(app).post('/api/collections').send({ title: 'T', description: 'D' })).status, 401);
        const res = await request(app).post('/api/collections').set(h.authHeader(config, owner))
            .send({ title: 'Coins', description: 'Indian coins', ownerId: String(victim._id) });
        assert.equal(res.status, 201);
        assert.equal(String(res.body.owner), String(owner._id));
    });

    test('only the owner can add items', async () => {
        const { app, config } = h.buildApp();
        const owner = await h.createUser();
        const other = await h.createUser();
        const col = await Collection.create({ title: 'C', description: 'D', owner: owner._id });
        assert.equal((await request(app).post(`/api/collections/${col._id}/items`).set(h.authHeader(config, other)).send({ name: 'X' })).status, 403);
        assert.equal((await request(app).post(`/api/collections/${col._id}/items`).set(h.authHeader(config, owner)).send({ name: 'X', image: PNG })).status, 200);
    });

    test('like toggles per user and returns a message for the UI', async () => {
        const { app, config } = h.buildApp();
        const owner = await h.createUser();
        const fan = await h.createUser();
        const col = await Collection.create({ title: 'C', description: 'D', owner: owner._id });

        const liked = await request(app).post(`/api/collections/${col._id}/like`).set(h.authHeader(config, fan));
        assert.equal(liked.body.liked, true);
        assert.equal(liked.body.likesCount, 1);
        assert.ok(liked.body.message);
        const unliked = await request(app).post(`/api/collections/${col._id}/like`).set(h.authHeader(config, fan));
        assert.equal(unliked.body.liked, false);
        assert.equal(unliked.body.likesCount, 0);
    });

    test('trending sorts by like count', async () => {
        const { app } = h.buildApp();
        const owner = await h.createUser();
        const fans = await Promise.all([h.createUser(), h.createUser()]);
        await Collection.create({ title: 'Quiet', description: 'D', owner: owner._id });
        await Collection.create({ title: 'Popular', description: 'D', owner: owner._id, likes: fans.map(f => f._id) });
        const res = await request(app).get('/api/collections?sort=trending');
        assert.deepEqual(res.body.map(c => c.title), ['Popular', 'Quiet']);
        assert.equal(res.body[0].owner.username, owner.username);
    });
});

describe('communities, groups and posts', () => {
    async function createCommunity(app, config, user, body = {}) {
        return request(app).post('/api/communities').set(h.authHeader(config, user))
            .send({ name: 'Numismatists', description: 'Coins', ...body });
    }

    test('duplicate community names return 409 and missing fields return 400', async () => {
        const { app, config } = h.buildApp();
        const user = await h.createUser();
        assert.equal((await createCommunity(app, config, user)).status, 200);
        assert.equal((await createCommunity(app, config, user)).status, 409);
        assert.equal((await createCommunity(app, config, user, { name: '' })).status, 400);
    });

    test('posting requires membership and uses the token author', async () => {
        const { app, config } = h.buildApp();
        const creator = await h.createUser();
        const outsider = await h.createUser();
        const community = (await createCommunity(app, config, creator)).body;

        const denied = await request(app).post('/api/posts').set(h.authHeader(config, outsider))
            .send({ content: 'hello', communityId: community._id });
        assert.equal(denied.status, 403);

        await request(app).post(`/api/communities/${community._id}/join`).set(h.authHeader(config, outsider));
        const ok = await request(app).post('/api/posts').set(h.authHeader(config, outsider))
            .send({ content: 'hello', communityId: community._id, authorId: String(creator._id) });
        assert.equal(ok.status, 201);
        assert.equal(String(ok.body.author), String(outsider._id));

        assert.equal((await request(app).post('/api/posts').send({ content: 'x', communityId: community._id })).status, 401);
        assert.equal((await request(app).get('/api/posts?community=bad')).status, 400);
        const feed = await request(app).get(`/api/posts?community=${community._id}`);
        assert.equal(feed.body.length, 1);
    });

    test('likes and comments use the token identity', async () => {
        const { app, config } = h.buildApp();
        const creator = await h.createUser();
        const fan = await h.createUser();
        const community = (await createCommunity(app, config, creator)).body;
        const post = (await request(app).post('/api/posts').set(h.authHeader(config, creator))
            .send({ content: 'My coin', communityId: community._id })).body;

        const like = await request(app).post(`/api/posts/${post._id}/like`).set(h.authHeader(config, fan)).send({ userId: String(creator._id) });
        assert.deepEqual(like.body.likes.map(String), [String(fan._id)]);
        const unlike = await request(app).post(`/api/posts/${post._id}/like`).set(h.authHeader(config, fan));
        assert.equal(unlike.body.likes.length, 0);

        const comment = await request(app).post(`/api/posts/${post._id}/comments`).set(h.authHeader(config, fan)).send({ content: 'Nice' });
        assert.equal(String(comment.body.comments[0].author), String(fan._id));
        assert.equal((await request(app).post(`/api/posts/${post._id}/comments`).set(h.authHeader(config, fan)).send({ content: '' })).status, 400);
        assert.equal(await Notification.countDocuments({ recipient: creator._id }), 2);
    });

    test('private communities cannot be entered by creating or joining one of their groups', async () => {
        const { app, config } = h.buildApp();
        const creator = await h.createUser();
        const outsider = await h.createUser();
        const community = (await createCommunity(app, config, creator, { privacy: 'private' })).body;
        const group = (await request(app).post('/api/groups').set(h.authHeader(config, creator))
            .send({ name: 'Ancient', description: 'Old coins', communityId: community._id })).body;

        const create = await request(app).post('/api/groups').set(h.authHeader(config, outsider))
            .send({ name: 'Sneaky', description: 'x', communityId: community._id });
        assert.equal(create.status, 403);
        const join = await request(app).post(`/api/groups/${group._id}/join`).set(h.authHeader(config, outsider));
        assert.equal(join.status, 403);

        const joinReq = await request(app).post(`/api/communities/${community._id}/join`).set(h.authHeader(config, outsider));
        assert.equal(joinReq.body.pending, true);
    });

    test('only the group creator can attach a group to a community they belong to', async () => {
        const { app, config } = h.buildApp();
        const creator = await h.createUser();
        const stranger = await h.createUser();
        const community = (await createCommunity(app, config, creator)).body;
        const group = (await request(app).post('/api/groups').set(h.authHeader(config, creator))
            .send({ name: 'Standalone', description: 'x' })).body;

        const hijack = await request(app).post(`/api/communities/${community._id}/add-group`).set(h.authHeader(config, stranger)).send({ groupId: group._id });
        assert.equal(hijack.status, 403);
        const ok = await request(app).post(`/api/communities/${community._id}/add-group`).set(h.authHeader(config, creator)).send({ groupId: group._id });
        assert.equal(ok.status, 200);
    });

    test('community and group pages survive members whose accounts were deleted', async () => {
        const { app, config } = h.buildApp();
        const creator = await h.createUser();
        const doomed = await h.createUser();
        const community = (await createCommunity(app, config, creator)).body;
        const group = (await request(app).post('/api/groups').set(h.authHeader(config, creator))
            .send({ name: 'G', description: 'x', communityId: community._id })).body;
        await request(app).post(`/api/communities/${community._id}/join`).set(h.authHeader(config, doomed));
        await request(app).post(`/api/groups/${group._id}/join`).set(h.authHeader(config, doomed));
        await User.deleteOne({ _id: doomed._id });

        const c = await request(app).get(`/api/communities/${community._id}`);
        assert.equal(c.status, 200);
        assert.equal(c.body.membersList.length, 1);
        const g = await request(app).get(`/api/groups/${group._id}`).set(h.authHeader(config, creator));
        assert.equal(g.status, 200);
        assert.equal(g.body.membersList.length, 1);
    });

    test('pending join requests are only visible to the community creator', async () => {
        const { app, config } = h.buildApp();
        const creator = await h.createUser();
        const requester = await h.createUser();
        const snoop = await h.createUser();
        const community = (await createCommunity(app, config, creator, { privacy: 'private' })).body;
        await request(app).post(`/api/communities/${community._id}/join`).set(h.authHeader(config, requester));

        const asCreator = await request(app).get(`/api/communities/${community._id}`).set(h.authHeader(config, creator));
        assert.equal(asCreator.body.pendingRequests.length, 1);
        const asRequester = await request(app).get(`/api/communities/${community._id}`).set(h.authHeader(config, requester));
        assert.equal(asRequester.body.pendingRequests.length, 1);
        const asSnoop = await request(app).get(`/api/communities/${community._id}`).set(h.authHeader(config, snoop));
        assert.equal(asSnoop.body.pendingRequests.length, 0);
    });

    test("leaving a group never removes the community owner's membership", async () => {
        const { app, config } = h.buildApp();
        const creator = await h.createUser();
        const community = (await createCommunity(app, config, creator)).body;
        const group = (await request(app).post('/api/groups').set(h.authHeader(config, creator))
            .send({ name: 'G', description: 'x', communityId: community._id })).body;
        await request(app).post(`/api/groups/${group._id}/leave`).set(h.authHeader(config, creator));
        const c = await request(app).get(`/api/communities/${community._id}`);
        assert.ok(c.body.membersList.some(m => String(m._id) === String(creator._id) && m.role === 'owner'));
    });
});
