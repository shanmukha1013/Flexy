const express = require('express');
const router = express.Router();
const Post = require('../models/Post');

// Get Feed
router.get('/', async (req, res) => {
    try {
        const query = {};
        if (req.query.community) {
            query.community = req.query.community;
        }
        const posts = await Post.find(query)
            .populate('author', 'username displayName avatarInitials avatarUrl')
            .populate('community', 'name')
            .populate('linkedCollection', 'title')
            .populate('comments.author', 'username displayName avatarInitials avatarUrl')
            .sort({ createdAt: -1 });
        res.json(posts);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Create Post
router.post('/', async (req, res) => {
    try {
        const { content, authorId, communityId, groupId, image, collectionId } = req.body;
        const post = new Post({
            content,
            author: authorId,
            community: communityId,
            group: groupId,
            image,
            linkedCollection: collectionId
        });
        await post.save();
        res.json(post);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Like Post
router.post('/:id/like', async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ error: 'Not found' });
        
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ error: 'UserId is required' });

        const exists = post.likes.some(id => id.toString() === userId.toString());
        if (exists) {
            post.likes = post.likes.filter(id => id.toString() !== userId.toString());
        } else {
            post.likes.push(userId);
            
            // Create notification if liked by someone else
            if (post.author.toString() !== userId.toString()) {
                const User = require('../models/User');
                const Notification = require('../models/Notification');
                const senderUser = await User.findById(userId);
                if (senderUser) {
                    await new Notification({
                        recipient: post.author,
                        sender: userId,
                        type: 'like',
                        title: 'New Appreciation',
                        message: `${senderUser.displayName || senderUser.username} appreciated your flex post.`,
                        relatedItem: post._id,
                        itemModel: 'Post'
                    }).save();
                }
            }
        }
        await post.save();
        res.json(post);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Comment on Post
router.post('/:id/comments', async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ error: 'Not found' });
        
        const { content, authorId } = req.body;
        post.comments.push({ content, author: authorId });
        
        // Create notification if commented by someone else
        if (post.author.toString() !== authorId.toString()) {
            const User = require('../models/User');
            const Notification = require('../models/Notification');
            const senderUser = await User.findById(authorId);
            if (senderUser) {
                await new Notification({
                    recipient: post.author,
                    sender: authorId,
                    type: 'comment',
                    title: 'New Inquiry',
                    message: `${senderUser.displayName || senderUser.username} inquired on your flex post: "${content.substring(0, 30)}..."`,
                    relatedItem: post._id,
                    itemModel: 'Post'
                }).save();
            }
        }

        await post.save();
        res.json(post);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
