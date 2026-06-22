const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Get active conversations list
router.get('/', auth, async (req, res) => {
    try {
        const currentUserId = req.user.userId;
        
        // Find all messages involving this user
        const messages = await Message.find({
            $or: [{ sender: currentUserId }, { recipient: currentUserId }]
        }).sort('-createdAt');

        const peers = new Set();
        const conversations = [];

        for (let msg of messages) {
            const peerId = msg.sender.toString() === currentUserId ? msg.recipient.toString() : msg.sender.toString();
            if (!peers.has(peerId)) {
                peers.add(peerId);
                const peer = await User.findById(peerId).select('username displayName avatarUrl profilePhoto avatarInitials');
                if (peer) {
                    conversations.push({
                        peerId: peer._id,
                        peerName: peer.displayName || peer.username,
                        peerAvatar: peer.avatarUrl || peer.profilePhoto || '',
                        avatarInitials: peer.avatarInitials || peer.displayName?.[0]?.toUpperCase() || 'U',
                        lastMessage: msg.content,
                        lastTime: new Date(msg.createdAt).getTime(),
                        unread: msg.recipient.toString() === currentUserId && !msg.read ? 1 : 0
                    });
                }
            }
        }
        res.json(conversations);
    } catch (error) {
        console.error('Error fetching conversations:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get chat history with a specific user
router.get('/:userId', auth, async (req, res) => {
    try {
        const currentUserId = req.user.userId;
        const otherUserId = req.params.userId;
        
        const messages = await Message.find({
            $or: [
                { sender: currentUserId, recipient: otherUserId },
                { sender: otherUserId, recipient: currentUserId }
            ]
        }).sort('createdAt');
        
        // Mark these messages as read
        await Message.updateMany(
            { sender: otherUserId, recipient: currentUserId, read: false },
            { $set: { read: true } }
        );
        
        res.json(messages);
    } catch (error) {
        console.error('Error loading chat history:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Save a new message
router.post('/', auth, async (req, res) => {
    try {
        const senderId = req.user.userId;
        const { recipientId, content } = req.body;
        
        if (!recipientId || !content) {
            return res.status(400).json({ error: 'Recipient and content are required' });
        }

        const msg = new Message({ sender: senderId, recipient: recipientId, content });
        await msg.save();
        res.json(msg);
    } catch (error) {
        console.error('Error saving message:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
