const mongoose = require('mongoose');

const CollectionSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    category: {
        type: String,
        default: 'General'
    },
    coverImage: {
        type: String,
        default: 'assets/rolex.png'
    },
    items: [{
        name: String,
        description: String,
        image: String,
        itemType: {
            type: String,
            enum: ['Showcase Only', 'Auction Only', 'Showcase + Auction'],
            default: 'Showcase Only'
        },
        auctionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Auction'
        },
        addedAt: {
            type: Date,
            default: Date.now
        }
    }],
    likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    followers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    comments: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        text: String,
        createdAt: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

module.exports = mongoose.model('Collection', CollectionSchema);
