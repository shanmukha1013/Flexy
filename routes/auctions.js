const express = require('express');
const router = express.Router();
const Auction = require('../models/Auction');

// Get all active auctions
router.get('/', async (req, res) => {
    try {
        const auctions = await Auction.find({ status: 'active' }).populate('seller', 'username displayName avatarInitials avatarUrl reputation');
        res.json(auctions);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Get single auction
router.get('/:id', async (req, res) => {
    try {
        const auction = await Auction.findById(req.params.id)
            .populate('seller', 'username displayName avatarInitials avatarUrl reputation')
            .populate('highestBidder', 'username')
            .populate('bids.bidder', 'username displayName avatarInitials avatarUrl');
        if (!auction) return res.status(404).json({ error: 'Not found' });
        res.json(auction);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Create auction
router.post('/', async (req, res) => {
    try {
        const { 
            title, description, category, images, videos, 
            origin, year, condition, rarity, estimatedValue, 
            auctionType, reservePrice, ownershipProof, authenticityDocs,
            sellerId, startingBid, durationHours 
        } = req.body;
        const endTime = new Date(Date.now() + durationHours * 60 * 60 * 1000);
        
        const auction = new Auction({
            title, description, category, 
            image: images && images.length > 0 ? images[0] : null,
            images, videos, origin, year, condition, rarity, estimatedValue,
            auctionType, reservePrice, ownershipProof, authenticityDocs,
            seller: sellerId, startingBid, currentBid: startingBid, endTime
        });
        await auction.save();
        res.json(auction);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Place bid
router.post('/:id/bid', async (req, res) => {
    try {
        const { bidderId, amount } = req.body;
        const auction = await Auction.findById(req.params.id);
        
        if (!auction) return res.status(404).json({ error: 'Not found' });
        if (auction.status !== 'active') return res.status(400).json({ error: 'Auction is not active' });
        if (new Date() > auction.endTime) {
            auction.status = 'ended';
            await auction.save();
            return res.status(400).json({ error: 'Auction has ended' });
        }
        
        if (amount <= auction.currentBid) {
            return res.status(400).json({ error: 'Bid must be higher than current bid' });
        }

        const prevHighestBidder = auction.highestBidder;
        
        auction.currentBid = amount;
        auction.highestBidder = bidderId;
        auction.bids.push({ amount, bidder: bidderId });
        await auction.save();

        const User = require('../models/User');
        const Notification = require('../models/Notification');
        const bidderUser = await User.findById(bidderId);
        
        if (bidderUser) {
            // 1. Notify Seller
            if (auction.seller && auction.seller.toString() !== bidderId.toString()) {
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
            if (prevHighestBidder && prevHighestBidder.toString() !== bidderId.toString()) {
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
        }
        
        res.json({ message: 'Bid placed successfully', currentBid: amount });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;

// Watch Auction
router.post('/:id/watch', async (req, res) => {
    try {
        const { userId } = req.body;
        const auction = await Auction.findById(req.params.id);
        if (!auction) return res.status(404).json({ error: 'Not found' });
        
        if (!auction.watchers.includes(userId)) {
            auction.watchers.push(userId);
            await auction.save();
            
            const User = require('../models/User');
            await User.findByIdAndUpdate(userId, { $addToSet: { savedAuctions: auction._id } });
        }
        res.json({ message: 'Auction added to watchlist' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});
