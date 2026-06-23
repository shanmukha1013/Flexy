const mongoose = require('mongoose');

const AuctionSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String },
    image: { type: String },
    images: [{ type: String }],
    videos: [{ type: String }],
    origin: { type: String },
    year: { type: String },
    condition: { type: String },
    rarity: { type: String },
    estimatedValue: { type: Number },
    auctionType: { 
        type: String, 
        enum: ['Standard', 'Reserve', 'Flash', 'Community', 'Invite Only'], 
        default: 'Standard' 
    },
    reservePrice: { type: Number },
    ownershipProof: { type: String },
    authenticityDocs: { type: String },
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
    }],
    watchers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

module.exports = mongoose.model('Auction', AuctionSchema);
