const express = require('express');
const router = express.Router();
const Community = require('../models/Community');
const Group = require('../models/Group');
const User = require('../models/User');
const CommunityMember = require('../models/CommunityMember');
const GroupMember = require('../models/GroupMember');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');

// Get all communities
router.get('/', async (req, res) => {
    try {
        const communities = await Community.find()
            .populate('creator', 'username displayName avatarInitials avatarUrl');
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
            memberCount: 1,
            groupCount: 0
        });
        await community.save();

        // Create owner membership
        await new CommunityMember({
            community: community._id,
            user: creatorId,
            role: 'owner'
        }).save();

        res.json(community);
    } catch (error) {
        console.error('Error creating community:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Join community
router.post('/:id/join', auth, async (req, res) => {
    try {
        const community = await Community.findById(req.params.id);
        if (!community) return res.status(404).json({ error: 'Community not found' });
        
        const userId = req.user.userId;
        const currentUser = await User.findById(userId);

        const existingMember = await CommunityMember.findOne({ community: community._id, user: userId });

        if (community.privacy === 'private') {
            if (existingMember) {
                return res.status(400).json({ error: 'Already a member' });
            }

            if (!community.pendingRequests.includes(userId)) {
                community.pendingRequests.push(userId);
                await community.save();

                await new Notification({
                    recipient: community.creator,
                    sender: userId,
                    type: 'community_request',
                    title: 'Join Request 👥',
                    message: `${currentUser.displayName || currentUser.username} requested to join community "${community.name}".`,
                    relatedItem: community._id,
                    itemModel: 'Community'
                }).save();
            }
            return res.json({ message: 'Join request sent to creator', pending: true });
        } else {
            if (!existingMember) {
                await new CommunityMember({
                    community: community._id,
                    user: userId,
                    role: 'member'
                }).save();
                community.memberCount += 1;
                await community.save();
            }
            return res.json({ message: 'Joined successfully', pending: false });
        }
    } catch (error) {
        console.error('Error joining community:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Leave community
router.post('/:id/leave', auth, async (req, res) => {
    try {
        const community = await Community.findById(req.params.id);
        if (!community) return res.status(404).json({ error: 'Community not found' });

        const userId = req.user.userId;
        
        // Remove from CommunityMember
        const deleted = await CommunityMember.findOneAndDelete({ community: community._id, user: userId });
        if (deleted) {
            community.memberCount = Math.max(0, community.memberCount - 1);
            await community.save();
        }

        // Also leave all groups in this community
        const groupsInCommunity = await Group.find({ community: community._id });
        const groupIds = groupsInCommunity.map(g => g._id);
        
        await GroupMember.deleteMany({ group: { $in: groupIds }, user: userId });
        
        // Update member counts for those groups
        for (const group of groupsInCommunity) {
            const count = await GroupMember.countDocuments({ group: group._id });
            group.memberCount = count;
            await group.save();
        }

        res.json({ message: 'Left community successfully' });
    } catch (error) {
        console.error('Error leaving community:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Approve community join request
router.post('/:id/requests/:userId/approve', auth, async (req, res) => {
    try {
        const community = await Community.findById(req.params.id);
        if (!community) return res.status(404).json({ error: 'Community not found' });

        if (community.creator.toString() !== req.user.userId) {
            return res.status(403).json({ error: 'Only the creator can approve requests' });
        }

        const targetUserId = req.params.userId;
        
        // Remove from pending
        community.pendingRequests = community.pendingRequests.filter(id => id.toString() !== targetUserId);
        
        const existingMember = await CommunityMember.findOne({ community: community._id, user: targetUserId });
        if (!existingMember) {
            await new CommunityMember({
                community: community._id,
                user: targetUserId,
                role: 'member'
            }).save();
            community.memberCount += 1;
        }
        await community.save();

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
        community.pendingRequests = community.pendingRequests.filter(id => id.toString() !== targetUserId);
        await community.save();

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

// Get Groups within Community
router.get('/:id/groups', auth, async (req, res) => {
    try {
        const groups = await Group.find({ community: req.params.id })
            .populate('creator', 'username displayName');
        res.json(groups);
    } catch (error) {
        console.error('Error fetching groups:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get single community details (includes members via aggregation/lookup)
router.get('/:id', async (req, res) => {
    try {
        const community = await Community.findById(req.params.id)
            .populate('creator', 'username displayName avatarInitials avatarUrl')
            .populate('pendingRequests', 'username displayName avatarInitials avatarUrl');
            
        if (!community) return res.status(404).json({ error: 'Community not found' });
        
        // Fetch members
        const members = await CommunityMember.find({ community: community._id })
            .populate('user', 'username displayName avatarInitials avatarUrl reputation');
            
        // Construct composite object
        const communityObj = community.toObject();
        communityObj.membersList = members.map(m => ({
            ...m.user.toObject(),
            role: m.role,
            joinedAt: m.joinedAt
        }));

        res.json(communityObj);
    } catch (error) {
        console.error('Error fetching community details:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get Communities User is Member of
router.get('/user/:userId', auth, async (req, res) => {
    try {
        const userId = req.params.userId;
        const memberships = await CommunityMember.find({ user: userId })
            .populate({
                path: 'community',
                select: 'name icon memberCount groupCount privacy creator'
            });
            
        const communities = memberships.map(m => m.community).filter(c => c != null);
        res.json(communities);
    } catch (error) {
        console.error('Error fetching user communities:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Add existing group to community
router.post('/:id/add-group', auth, async (req, res) => {
    try {
        const community = await Community.findById(req.params.id);
        if (!community) return res.status(404).json({ error: 'Community not found' });
        
        const { groupId } = req.body;
        if (!groupId) return res.status(400).json({ error: 'Group ID is required' });

        const group = await Group.findById(groupId);
        if (!group) return res.status(404).json({ error: 'Group not found' });
        
        if (group.community) {
            return res.status(400).json({ error: 'Group already belongs to a community' });
        }

        group.community = community._id;
        await group.save();

        community.groupCount += 1;
        await community.save();

        res.json({ message: 'Group added to community successfully', group });
    } catch (error) {
        console.error('Error adding group to community:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
