const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        required: true
    },
    community: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Community' // optional, can be a general post or community post
    },
    group: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group' // optional, can be tied to a specific group
    },
    image: {
        type: String // optional attached image/item
    },
    linkedCollection: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Collection'
    },
    likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    comments: [{
        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        content: String,
        createdAt: {
            type: Date,
            default: Date.now
        }
    }]
}, { timestamps: true });

module.exports = mongoose.model('Post', PostSchema);
