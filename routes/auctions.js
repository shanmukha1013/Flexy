const express = require('express');
const router = express.Router();
const Auction = require('../models/Auction');
const User = require('../models/User');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');
const { emitNewBid } = require('../lib/sockets');
const {
    validateIdParam,
    isObjectId,
    badRequest,
    cleanText,
    cleanImageList,
    cleanNumber
} = require('../lib/validation');

router.param('id', validateIdParam);

const SELLER_FIELDS = 'username displayName avatarInitials avatarUrl reputation';
// List views only need the cover image. Full media, documents and bid history
// can be several MB per auction, so they are only sent by the detail endpoint.
// (Object form on purpose: Mongoose drops .slice() combined with '-field' strings.)
const LIST_PROJECTION = Object.freeze({
    images: { $slice: 1 },
    videos: 0,
    ownershipProof: 0,
    authenticityDocs: 0,
    bids: 0,
    watchers: 0
});
const MAX_DURATION_HOURS = 24 * 30;
const MAX_AMOUNT = 1e12;
const HTTP_URL_RE = /^https?:\/\/[^\s"'()<>\\`]+$/i;

// Get auctions (active by default). Supports ?status=active|ended,
// ?sort=ending_soon|newest, ?seller=<userId> and ?limit=<n> (max 100).
router.get('/', async (req, res, next) => {
    try {
        const status = req.query.status || 'active';
        if (!['active', 'ended'].includes(status)) throw badRequest('Invalid status');
        const filter = { status };

        if (req.query.seller !== undefined) {
            if (!isObjectId(req.query.seller)) throw badRequest('Invalid seller');
            filter.seller = req.query.seller;
        }

        const sort = req.query.sort === 'ending_soon' ? { endTime: 1 } : { createdAt: -1 };
        const limit = Math.min(Number.parseInt(req.query.limit, 10) || 60, 100);

        const auctions = await Auction.find(filter)
            .select({ ...LIST_PROJECTION })
            .sort(sort)
            .limit(limit)
            .populate('seller', SELLER_FIELDS);
        res.json(auctions);
    } catch (error) {
        next(error);
    }
});

// Get single auction
router.get('/:id', async (req, res, next) => {
    try {
        const auction = await Auction.findById(req.params.id)
            .populate('seller', SELLER_FIELDS)
            .populate('highestBidder', 'username')
            .populate('bids.bidder', 'username displayName avatarInitials avatarUrl');
        if (!auction) return res.status(404).json({ error: 'Not found' });
        res.json(auction);
    } catch (error) {
        next(error);
    }
});

// Create auction (the seller is always the authenticated user)
router.post('/', auth, async (req, res, next) => {
    try {
        const b = req.body || {};
        const startingBid = cleanNumber(b.startingBid, 'Starting bid', { min: 1, max: MAX_AMOUNT, required: true });
        const durationHours = cleanNumber(b.durationHours, 'Duration (hours)', { min: 1, max: MAX_DURATION_HOURS, required: true });
        const images = cleanImageList(b.images, 'Images') || [];
        if (b.videos !== undefined && !Array.isArray(b.videos)) throw badRequest('Videos must be a list');
        const videos = (b.videos || []).slice(0, 5).map((v, i) => {
            if (typeof v !== 'string' || !HTTP_URL_RE.test(v)) throw badRequest(`Videos[${i}] must be an http(s) URL`);
            return v;
        });

        const auction = new Auction({
            title: cleanText(b.title, 'Title', { max: 120, required: true }),
            description: cleanText(b.description, 'Description', { max: 5000, required: true }),
            category: cleanText(b.category, 'Category', { max: 60 }),
            image: images.length > 0 ? images[0] : null,
            images,
            videos,
            origin: cleanText(b.origin, 'Origin', { max: 100 }),
            year: cleanText(b.year, 'Year', { max: 20 }),
            condition: cleanText(b.condition, 'Condition', { max: 60 }),
            rarity: cleanText(b.rarity, 'Rarity', { max: 60 }),
            estimatedValue: cleanNumber(b.estimatedValue, 'Estimated value', { max: MAX_AMOUNT }),
            auctionType: b.auctionType || undefined,
            reservePrice: cleanNumber(b.reservePrice, 'Reserve price', { max: MAX_AMOUNT }),
            ownershipProof: cleanText(b.ownershipProof, 'Ownership proof', { max: 2000 }),
            authenticityDocs: cleanText(b.authenticityDocs, 'Authenticity documents', { max: 2000 }),
            seller: req.user.userId,
            startingBid,
            currentBid: startingBid,
            endTime: new Date(Date.now() + durationHours * 60 * 60 * 1000)
        });
        await auction.save();
        res.status(201).json(auction);
    } catch (error) {
        next(error);
    }
});

// Place bid (the bidder is always the authenticated user)
router.post('/:id/bid', auth, async (req, res, next) => {
    try {
        const bidderId = req.user.userId;
        const amount = cleanNumber(req.body && req.body.amount, 'Bid amount', { min: 1, max: MAX_AMOUNT, required: true });
        const now = new Date();

        const auction = await Auction.findById(req.params.id).select('seller status endTime currentBid title');
        if (!auction) return res.status(404).json({ error: 'Not found' });
        if (auction.seller && auction.seller.toString() === bidderId) {
            return res.status(400).json({ error: 'You cannot bid on your own auction' });
        }
        if (auction.status !== 'active') return res.status(400).json({ error: 'Auction is not active' });
        // The background closer marks it ended and sends the notifications.
        if (now > auction.endTime) return res.status(400).json({ error: 'Auction has ended' });
        if (amount <= auction.currentBid) {
            return res.status(400).json({ error: 'Bid must be higher than current bid' });
        }

        const bidderUser = await User.findById(bidderId).select('username displayName').lean();
        if (!bidderUser) return res.status(401).json({ error: 'User not found' });

        // Atomic compare-and-set: two simultaneous bids can't both "win" and a
        // lower bid can never overwrite a higher one that landed first.
        const before = await Auction.findOneAndUpdate(
            { _id: auction._id, status: 'active', endTime: { $gt: now }, currentBid: { $lt: amount } },
            {
                $set: { currentBid: amount, highestBidder: bidderId },
                $push: { bids: { amount, bidder: bidderId, time: now } }
            },
            { returnDocument: 'before' }
        ).select('highestBidder');
        if (!before) {
            return res.status(409).json({ error: 'A higher bid was placed first. Refresh and try again.' });
        }
        const prevHighestBidder = before.highestBidder;

        // 1. Notify Seller
        if (auction.seller) {
            await new Notification({
                recipient: auction.seller,
                sender: bidderId,
                type: 'bid',
                title: 'New Bid Placed',
                message: `@${bidderUser.username} placed a bid of ₹${amount} on your auction: "${auction.title}".`,
                relatedItem: auction._id,
                itemModel: 'Auction'
            }).save();
        }

        // 2. Notify Previous Highest Bidder (if outbid)
        if (prevHighestBidder && prevHighestBidder.toString() !== bidderId) {
            await new Notification({
                recipient: prevHighestBidder,
                sender: bidderId,
                type: 'outbid',
                title: 'You have been Outbid! ⚠️',
                message: `You have been outbid on "${auction.title}". The new highest bid is ₹${amount}.`,
                relatedItem: auction._id,
                itemModel: 'Auction'
            }).save();
        }

        // 3. Broadcast to everyone watching this auction
        emitNewBid(req.app.get('io'), auction._id, {
            auctionId: auction._id.toString(),
            amount,
            bidder: { _id: bidderId, username: bidderUser.username, displayName: bidderUser.displayName },
            time: now.toISOString()
        });

        res.json({ message: 'Bid placed successfully', currentBid: amount });
    } catch (error) {
        next(error);
    }
});

// Watch Auction
router.post('/:id/watch', auth, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const result = await Auction.updateOne({ _id: req.params.id }, { $addToSet: { watchers: userId } });
        if (result.matchedCount === 0) return res.status(404).json({ error: 'Not found' });

        await User.updateOne({ _id: userId }, { $addToSet: { savedAuctions: req.params.id } });
        res.json({ message: 'Auction added to watchlist' });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
module.exports.LIST_PROJECTION = LIST_PROJECTION;
