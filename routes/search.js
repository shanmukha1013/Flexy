const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Community = require('../models/Community');
const Group = require('../models/Group');
const Collection = require('../models/Collection');
const Auction = require('../models/Auction');
const Item = require('../models/Item');

router.get('/', async (req, res) => {
    try {
        const query = req.query.q || '';
        if (!query) {
            return res.json({ users: [], communities: [], groups: [], collections: [], auctions: [], items: [] });
        }

        const regex = new RegExp(query, 'i');

        const [users, communities, groups, collections, auctions, items] = await Promise.all([
            User.find({ $or: [{ username: regex }, { displayName: regex }, { bio: regex }] }).select('username displayName avatarInitials avatarUrl reputation').limit(5),
            Community.find({ $or: [{ name: regex }, { description: regex }] }).limit(5),
            Group.find({ $or: [{ name: regex }, { description: regex }] }).limit(5),
            Collection.find({ $or: [{ title: regex }, { description: regex }] }).limit(5),
            Auction.find({ $or: [{ title: regex }, { description: regex }] }).limit(5),
            Item.find({ $or: [{ title: regex }, { description: regex }, { category: regex }] }).limit(5)
        ]);

        res.json({ users, communities, groups, collections, auctions, items });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Server error during search' });
    }
});

module.exports = router;
