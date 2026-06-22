const express = require('express');
const router = express.Router();
const Community = require('../models/Community');
const Group = require('../models/Group');
const User = require('../models/User');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');

// Get all communities
router.get('/', async (req, res) => {
    try {
        const communities = await Community.find()
            .populate('creator', 'username displayName')
            .populate('members', 'username displayName');
        res.json(communities);
    } catch (error) {
        console.error('Error fetching communities:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Create community
router.post('/', auth, async (req, res) => {
    try {
        const { name, description, icon, privacy } = req.body;
        const creatorId = req.user.userId;
        
        const community = new Community({
            name,
            description,
            icon: icon || '🏛️',
            privacy: privacy || 'public',
            creator: creatorId,
            members: [creatorId]
        });
        await community.save();
        res.json(community);
    } catch (error) {
        console.error('Error creating community:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Join community (handles public auto-join vs private permission request)
router.post('/:id/join', auth, async (req, res) => {
    try {
        const community = await Community.findById(req.params.id);
        if (!community) return res.status(404).json({ error: 'Community not found' });
        
        const userId = req.user.userId;
        const currentUser = await User.findById(userId);

        if (community.privacy === 'private') {
            // Private community join request
            if (community.members.includes(userId)) {
                return res.status(400).json({ error: 'Already a member' });
            }

            if (!community.pendingRequests.includes(userId)) {
                community.pendingRequests.push(userId);
                await community.save();

                // Create join request notification for the admin/creator
                await new Notification({
                    recipient: community.creator,
                    sender: userId,
                    type: 'community_request',
                    title: 'Join Request 👥',
                    message: `${currentUser.displayName || currentUser.username} has requested to join your private community "${community.name}".`,
                    relatedItem: community._id,
                    itemModel: 'Community'
                }).save();
            }

            return res.json({ message: 'Join request sent to creator', pending: true });
        } else {
            // Public community auto-join
            if (!community.members.includes(userId)) {
                community.members.push(userId);
                await community.save();
            }
            return res.json({ message: 'Joined successfully', pending: false });
        }
    } catch (error) {
        console.error('Error joining community:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Approve community join request
router.post('/:id/requests/:userId/approve', auth, async (req, res) => {
    try {
        const community = await Community.findById(req.params.id);
        if (!community) return res.status(404).json({ error: 'Community not found' });

        // Verify requesting user is the creator
        if (community.creator.toString() !== req.user.userId) {
            return res.status(403).json({ error: 'Only the creator can approve requests' });
        }

        const targetUserId = req.params.userId;
        
        // Remove from pending
        community.pendingRequests = community.pendingRequests.filter(id => id.toString() !== targetUserId);
        
        // Add to members
        if (!community.members.includes(targetUserId)) {
            community.members.push(targetUserId);
        }
        await community.save();

        // Create approval notification for the target user
        await new Notification({
            recipient: targetUserId,
            sender: req.user.userId,
            type: 'community_approved',
            title: 'Request Approved! 🎉',
            message: `Your request to join "${community.name}" has been approved.`,
            relatedItem: community._id,
            itemModel: 'Community'
        }).save();

        res.json({ message: 'Request approved successfully' });
    } catch (error) {
        console.error('Error approving request:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Reject community join request
router.post('/:id/requests/:userId/reject', auth, async (req, res) => {
    try {
        const community = await Community.findById(req.params.id);
        if (!community) return res.status(404).json({ error: 'Community not found' });

        if (community.creator.toString() !== req.user.userId) {
            return res.status(403).json({ error: 'Only the creator can reject requests' });
        }

        const targetUserId = req.params.userId;
        
        // Remove from pending
        community.pendingRequests = community.pendingRequests.filter(id => id.toString() !== targetUserId);
        await community.save();

        // Create rejection notification for the target user
        await new Notification({
            recipient: targetUserId,
            sender: req.user.userId,
            type: 'community_rejected',
            title: 'Request Declined',
            message: `Your request to join "${community.name}" was declined.`,
            relatedItem: community._id,
            itemModel: 'Community'
        }).save();

        res.json({ message: 'Request rejected successfully' });
    } catch (error) {
        console.error('Error rejecting request:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Create Groups within Community
router.post('/:id/groups', auth, async (req, res) => {
    try {
        const { name, description } = req.body;
        const creatorId = req.user.userId;
        
        const group = new Group({
            name, description, community: req.params.id, creator: creatorId, members: [creatorId]
        });
        await group.save();
        res.json(group);
    } catch (error) {
        console.error('Error creating group:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get Groups within Community
router.get('/:id/groups', auth, async (req, res) => {
    try {
        const groups = await Group.find({ community: req.params.id });
        res.json(groups);
    } catch (error) {
        console.error('Error fetching groups:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get single community details
router.get('/:id', async (req, res) => {
    try {
        const community = await Community.findById(req.params.id)
            .populate('creator', 'username displayName avatarInitials avatarUrl')
            .populate('members', 'username displayName avatarInitials avatarUrl')
            .populate('pendingRequests', 'username displayName avatarInitials avatarUrl');
        if (!community) return res.status(404).json({ error: 'Community not found' });
        res.json(community);
    } catch (error) {
        console.error('Error fetching community details:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
