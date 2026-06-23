const express = require('express');
const router = express.Router();
const Group = require('../models/Group');
const auth = require('../middleware/auth');
// Create Group
router.post('/', auth, async (req, res) => {
    try {
        const { name, description } = req.body;
        const userId = req.user.userId;

        const group = new Group({
            name,
            description,
            creator: userId,
            members: [userId]
        });

        await group.save();
        res.status(201).json(group);
    } catch (error) {
        console.error('Error creating group:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Join Group
router.post('/:id/join', auth, async (req, res) => {
    try {
        const group = await Group.findById(req.params.id);
        if (!group) return res.status(404).json({ error: 'Group not found' });

        const userId = req.user.userId;
        if (!group.members.includes(userId)) {
            group.members.push(userId);
            await group.save();
            
            // Add to parent community (WhatsApp style)
            const Community = require('../models/Community');
            await Community.findByIdAndUpdate(group.community, {
                $addToSet: { members: userId }
            });
        }
        res.json({ message: 'Joined group successfully', group });
    } catch (error) {
        console.error('Error joining group:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Leave Group
router.post('/:id/leave', auth, async (req, res) => {
    try {
        const group = await Group.findById(req.params.id);
        if (!group) return res.status(404).json({ error: 'Group not found' });

        const userId = req.user.userId;
        group.members = group.members.filter(id => id.toString() !== userId.toString());
        await group.save();
        res.json({ message: 'Left group successfully', group });
    } catch (error) {
        console.error('Error leaving group:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get Group Details
router.get('/:id', auth, async (req, res) => {
    try {
        const group = await Group.findById(req.params.id)
            .populate('members', 'username displayName avatarInitials avatarUrl')
            .populate('creator', 'username displayName avatarInitials avatarUrl');
        if (!group) return res.status(404).json({ error: 'Group not found' });
        res.json(group);
    } catch (error) {
        console.error('Error fetching group details:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get Groups User is Member of
router.get('/user/:userId', auth, async (req, res) => {
    try {
        const userId = req.params.userId;
        const groups = await Group.find({ members: userId })
            .populate('community', 'name icon');
        res.json(groups);
    } catch (error) {
        console.error('Error fetching user groups:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;

