const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Message = require('../models/Message');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { emitDirectMessage } = require('../lib/sockets');
const { validateIdParam, isObjectId, requireObjectId, cleanText } = require('../lib/validation');

router.param('userId', validateIdParam);

const HISTORY_LIMIT = 500;

// Get active conversations list
router.get('/', auth, async (req, res, next) => {
    try {
        if (!isObjectId(req.user.userId)) return res.status(401).json({ error: 'Token is not valid' });
        const me = new mongoose.Types.ObjectId(req.user.userId);

        // One aggregation instead of loading every message and then looking up
        // each peer individually.
        const rows = await Message.aggregate([
            { $match: { $or: [{ sender: me }, { recipient: me }] } },
            { $sort: { createdAt: -1 } },
            {
                $group: {
                    _id: { $cond: [{ $eq: ['$sender', me] }, '$recipient', '$sender'] },
                    lastMessage: { $first: '$content' },
                    lastTime: { $first: '$createdAt' },
                    unread: {
                        $sum: { $cond: [{ $and: [{ $eq: ['$recipient', me] }, { $eq: ['$read', false] }] }, 1, 0] }
                    }
                }
            },
            { $sort: { lastTime: -1 } },
            { $limit: 100 }
        ]);

        const peers = await User.find({ _id: { $in: rows.map(r => r._id) } })
            .select('username displayName avatarUrl profilePhoto avatarInitials')
            .lean();
        const peersById = new Map(peers.map(p => [p._id.toString(), p]));

        const conversations = rows
            .filter(row => peersById.has(row._id.toString()))
            .map(row => {
                const peer = peersById.get(row._id.toString());
                return {
                    peerId: peer._id,
                    peerName: peer.displayName || peer.username,
                    peerAvatar: peer.avatarUrl || peer.profilePhoto || '',
                    avatarInitials: peer.avatarInitials || peer.displayName?.[0]?.toUpperCase() || 'U',
                    lastMessage: row.lastMessage,
                    lastTime: new Date(row.lastTime).getTime(),
                    unread: row.unread
                };
            });
        res.json(conversations);
    } catch (error) {
        next(error);
    }
});

// Get chat history with a specific user (most recent 500 messages, oldest first)
router.get('/:userId', auth, async (req, res, next) => {
    try {
        const currentUserId = req.user.userId;
        const otherUserId = req.params.userId;

        const messages = await Message.find({
            $or: [
                { sender: currentUserId, recipient: otherUserId },
                { sender: otherUserId, recipient: currentUserId }
            ]
        }).sort({ createdAt: -1 }).limit(HISTORY_LIMIT);

        // Mark these messages as read
        await Message.updateMany(
            { sender: otherUserId, recipient: currentUserId, read: false },
            { $set: { read: true } }
        );

        res.json(messages.reverse());
    } catch (error) {
        next(error);
    }
});

// Save a new message and push it to the recipient in real time
router.post('/', auth, async (req, res, next) => {
    try {
        const senderId = req.user.userId;
        const { recipientId } = req.body || {};

        if (!recipientId || !req.body.content) {
            return res.status(400).json({ error: 'Recipient and content are required' });
        }
        requireObjectId(recipientId, 'recipientId');
        if (recipientId === senderId) {
            return res.status(400).json({ error: 'You cannot message yourself' });
        }
        const content = cleanText(req.body.content, 'Message', { max: 2000, required: true });

        if (!(await User.exists({ _id: recipientId }))) {
            return res.status(404).json({ error: 'Recipient not found' });
        }

        const msg = new Message({ sender: senderId, recipient: recipientId, content });
        await msg.save();

        emitDirectMessage(req.app.get('io'), recipientId, {
            messageId: msg._id.toString(),
            senderId,
            recipientId,
            text: msg.content,
            timestamp: msg.createdAt.getTime()
        });

        res.json(msg);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
