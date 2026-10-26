// lib/auctions.js
// Background job that closes auctions whose end time has passed and notifies
// the seller and winner exactly once.

const mongoose = require('mongoose');
const Auction = require('../models/Auction');
const User = require('../models/User');
const Notification = require('../models/Notification');

async function closeEndedAuctions(now = new Date()) {
    // Guard: skip if MongoDB is not connected (readyState 1 = connected)
    if (mongoose.connection.readyState !== 1) return 0;

    const candidates = await Auction.find({ status: 'active', endTime: { $lte: now } }).select('_id').lean();
    let closed = 0;

    for (const { _id } of candidates) {
        // Atomic transition: only the run that flips active -> ended notifies,
        // so overlapping runs or a concurrent bid-time close can't double-notify.
        const auction = await Auction.findOneAndUpdate(
            { _id, status: 'active' },
            { $set: { status: 'ended' } },
            { returnDocument: 'after' }
        );
        if (!auction) continue;
        closed += 1;

        // Notify seller
        if (auction.seller) {
            let sellerMsg = `Your auction for "${auction.title}" has ended with no bids.`;
            if (auction.highestBidder) {
                const winner = await User.findById(auction.highestBidder).select('username').lean();
                sellerMsg = `Your auction for "${auction.title}" has ended. The winning bid was ₹${auction.currentBid} by @${winner ? winner.username : 'collector'}.`;
            }

            await new Notification({
                recipient: auction.seller,
                type: 'auction_ended',
                title: 'Auction Completed',
                message: sellerMsg,
                relatedItem: auction._id,
                itemModel: 'Auction'
            }).save();
        }

        // Notify winner
        if (auction.highestBidder) {
            await new Notification({
                recipient: auction.highestBidder,
                type: 'auction_won',
                title: 'Auction Won! 🏆',
                message: `Congratulations! You won the auction for "${auction.title}" with a winning bid of ₹${auction.currentBid}.`,
                relatedItem: auction._id,
                itemModel: 'Auction'
            }).save();
        }
    }
    return closed;
}

function startAuctionCloser(intervalMs = 15000) {
    let running = false;
    const timer = setInterval(async () => {
        if (running) return;
        running = true;
        try {
            await closeEndedAuctions();
        } catch (err) {
            console.error('Error in closeEndedAuctions interval:', err);
        } finally {
            running = false;
        }
    }, intervalMs);
    return () => clearInterval(timer);
}

module.exports = { closeEndedAuctions, startAuctionCloser };
