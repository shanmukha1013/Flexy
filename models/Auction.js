const mongoose = require('mongoose');

const AuctionSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    image: { type: String },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    startingBid: { type: Number, required: true },
    currentBid: { type: Number, default: 0 },
    highestBidder: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    endTime: { type: Date, required: true },
    status: { type: String, enum: ['active', 'ended', 'canceled'], default: 'active' },
    bids: [{
        amount: Number,
        bidder: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        time: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

module.exports = mongoose.model('Auction', AuctionSchema);
