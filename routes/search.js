const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Community = require('../models/Community');
const Group = require('../models/Group');
const Collection = require('../models/Collection');
const Auction = require('../models/Auction');
const Item = require('../models/Item');
const { escapeRegex } = require('../lib/validation');
const { LIST_PROJECTION: AUCTION_LIST_PROJECTION } = require('./auctions');

const MAX_QUERY_LENGTH = 64;

router.get('/', async (req, res, next) => {
    try {
        const query = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, MAX_QUERY_LENGTH) : '';
        if (!query) {
            return res.json({ users: [], communities: [], groups: [], collections: [], auctions: [], items: [] });
        }

        // Escape user input: it is matched literally, never compiled as a pattern
        // (unescaped input allowed regex injection and catastrophic backtracking).
        const regex = new RegExp(escapeRegex(query), 'i');

        const [users, communities, groups, collections, auctions, items] = await Promise.all([
            User.find({ $or: [{ username: regex }, { displayName: regex }, { bio: regex }] }).select('username displayName avatarInitials avatarUrl reputation').limit(5),
            Community.find({ $or: [{ name: regex }, { description: regex }] }).select('-pendingRequests').limit(5),
            Group.find({ $or: [{ name: regex }, { description: regex }] }).limit(5),
            Collection.find({ $or: [{ title: regex }, { description: regex }] }).select('-comments').limit(5),
            Auction.find({ $or: [{ title: regex }, { description: regex }] }).select({ ...AUCTION_LIST_PROJECTION }).limit(5),
            Item.find({ $or: [{ title: regex }, { description: regex }, { category: regex }] }).limit(5)
        ]);

        res.json({ users, communities, groups, collections, auctions, items });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
