const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    type: {
        type: String,
        enum: ['like', 'comment', 'bid', 'outbid', 'auction_won', 'auction_ended', 'follow', 'community_request', 'community_approved', 'community_rejected'],
        required: true
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    read: {
        type: Boolean,
        default: false
    },
    relatedItem: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'itemModel'
    },
    itemModel: {
        type: String,
        enum: ['Post', 'Auction', 'User', 'Community']
    }
}, { timestamps: true });

module.exports = mongoose.model('Notification', NotificationSchema);
