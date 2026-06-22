const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');

// Middleware to protect routes would go here (verify JWT)

// Get registered users for suggestions (excluding current user)
router.get('/', auth, async (req, res) => {
    try {
        const users = await User.find({ _id: { $ne: req.user.userId } })
            .select('displayName username avatarUrl profilePhoto avatarInitials reputation');
        res.json(users);
    } catch (error) {
        console.error('MONGOOSE ERROR:', error);
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

// Get Demo User (Temporary to simulate auth)
router.get('/all_for_demo', async (req, res) => {
    try {
        const users = await User.find().limit(1);
        res.json(users);
    } catch (error) {
        console.error('MONGOOSE ERROR:', error);
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

// Get Profile
router.get('/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .populate('followers', 'username displayName avatarInitials')
            .populate('following', 'username displayName avatarInitials')
            .populate('showcaseCabinet')
            .populate('communities');
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (error) {
        console.error('MONGOOSE ERROR:', error);
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

// Update Profile
router.put('/:id', auth, async (req, res) => {
    if (req.user.userId !== req.params.id) return res.status(403).json({ error: 'Unauthorized' });
    try {
        const { displayName, username, email, phone, bio, interests, avatarUrl } = req.body;
        
        const updateData = {};
        if (displayName !== undefined) updateData.displayName = displayName;
        if (username !== undefined) {
            let cleanUsername = username.trim();
            if (cleanUsername.startsWith('@')) {
                cleanUsername = cleanUsername.substring(1);
            }
            const existing = await User.findOne({ username: cleanUsername, _id: { $ne: req.params.id } });
            if (existing) return res.status(400).json({ error: 'Username is already taken' });
            updateData.username = cleanUsername;
        }
        if (email !== undefined) updateData.email = email;
        if (phone !== undefined) updateData.phone = phone;
        if (bio !== undefined) updateData.bio = bio;
        if (interests !== undefined) updateData.interests = interests;
        if (avatarUrl !== undefined) {
            updateData.avatarUrl = avatarUrl;
            updateData.profilePhoto = avatarUrl;
        }
        // Also support profilePhoto directly if provided
        const { profilePhoto } = req.body;
        if (profilePhoto !== undefined) {
            updateData.profilePhoto = profilePhoto;
            updateData.avatarUrl = profilePhoto;
        }
        
        // Update avatarInitials if displayName changed
        if (displayName) {
            updateData.avatarInitials = displayName.substring(0, 2).toUpperCase();
        }

        // Auto verify if completing profile setup
        const currentUser = await User.findById(req.params.id);
        if (currentUser && !currentUser.isVerified) {
             if (displayName && username && bio && interests) {
                  updateData.isVerified = true;
             }
        }

        const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        res.json(user);
    } catch (error) {
        console.error('MONGOOSE ERROR:', error);
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

// Follow User
router.post('/:id/follow', auth, async (req, res) => {
    try {
        const targetUser = await User.findById(req.params.id);
        const currentUser = await User.findById(req.user.userId);
        
        if (!targetUser || !currentUser) return res.status(404).json({ error: 'User not found' });
        if (targetUser._id.toString() === currentUser._id.toString()) return res.status(400).json({ error: 'Cannot follow yourself' });

        if (!targetUser.followers.includes(currentUser._id)) {
            targetUser.followers.push(currentUser._id);
            currentUser.following.push(targetUser._id);
            await targetUser.save();
            await currentUser.save();

            // Create follow notification
            const Notification = require('../models/Notification');
            await new Notification({
                recipient: targetUser._id,
                sender: currentUser._id,
                type: 'follow',
                title: 'New Follower',
                message: `${currentUser.displayName || currentUser.username} started following you.`,
                relatedItem: currentUser._id,
                itemModel: 'User'
            }).save();
        }
        res.json({ message: 'Successfully followed' });
    } catch (error) {
        console.error('MONGOOSE ERROR:', error);
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

// Unfollow User
router.post('/:id/unfollow', auth, async (req, res) => {
    try {
        const targetUser = await User.findById(req.params.id);
        const currentUser = await User.findById(req.user.userId);
        
        if (!targetUser || !currentUser) return res.status(404).json({ error: 'User not found' });

        targetUser.followers = targetUser.followers.filter(id => id.toString() !== currentUser._id.toString());
        currentUser.following = currentUser.following.filter(id => id.toString() !== targetUser._id.toString());
        
        await targetUser.save();
        await currentUser.save();
        res.json({ message: 'Successfully unfollowed' });
    } catch (error) {
        console.error('MONGOOSE ERROR:', error);
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

module.exports = router;
