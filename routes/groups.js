const express = require('express');
const router = express.Router();
const Group = require('../models/Group');
const Community = require('../models/Community');
const GroupMember = require('../models/GroupMember');
const CommunityMember = require('../models/CommunityMember');
const auth = require('../middleware/auth');

// Create Group
router.post('/', auth, async (req, res) => {
    try {
        const { name, description, communityId, privacy } = req.body;
        const userId = req.user.userId;

        let community = null;
        if (communityId) {
            community = await Community.findById(communityId);
            if (!community) {
                return res.status(404).json({ error: 'Community not found' });
            }
        }

        const group = new Group({
            name,
            description,
            community: communityId || undefined,
            creator: userId,
            memberCount: 1,
            privacy: privacy || 'public'
        });
        await group.save();

        // Create GroupMember for creator
        await new GroupMember({
            group: group._id,
            user: userId,
            role: 'owner'
        }).save();

        if (community) {
            // Update Community group count
            community.groupCount += 1;
            await community.save();

            // Ensure user is in CommunityMember
            const existingCommMember = await CommunityMember.findOne({ community: communityId, user: userId });
            if (!existingCommMember) {
                await new CommunityMember({
                    community: communityId,
                    user: userId,
                    role: 'member'
                }).save();
                community.memberCount += 1;
                await community.save();
            }
        }

        res.status(201).json(group);
    } catch (error) {
        console.error('Error creating group:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get All Groups (public)
router.get('/', async (req, res) => {
    try {
        const filter = {};
        if (req.query.communityId) filter.community = req.query.communityId;
        if (req.query.standalone === 'true') filter.community = { $exists: false };
        
        const groups = await Group.find(filter)
            .populate('creator', 'username displayName avatarInitials')
            .populate('community', 'name icon')
            .sort({ memberCount: -1 });
        res.json(groups);
    } catch (error) {
        console.error('Error fetching groups:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Join Group
router.post('/:id/join', auth, async (req, res) => {
    try {
        const group = await Group.findById(req.params.id);
        if (!group) return res.status(404).json({ error: 'Group not found' });

        const userId = req.user.userId;
        
        const existingMember = await GroupMember.findOne({ group: group._id, user: userId });
        if (!existingMember) {
            await new GroupMember({
                group: group._id,
                user: userId,
                role: 'member'
            }).save();
            
            group.memberCount += 1;
            await group.save();

            // Ensure they are also in the parent community if it exists
            if (group.community) {
                const existingCommMember = await CommunityMember.findOne({ community: group.community, user: userId });
                if (!existingCommMember) {
                    await new CommunityMember({
                        community: group.community,
                        user: userId,
                        role: 'member'
                    }).save();
                    
                    await Community.findByIdAndUpdate(group.community, {
                        $inc: { memberCount: 1 }
                    });
                }
            }
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
        
        const deleted = await GroupMember.findOneAndDelete({ group: group._id, user: userId });
        if (deleted) {
            group.memberCount = Math.max(0, group.memberCount - 1);
            await group.save();
        }

        if (group.community) {
            // Check if user is in any other groups in this community
            const otherGroups = await Group.find({ community: group.community, _id: { $ne: group._id } });
            const otherGroupIds = otherGroups.map(g => g._id);
            
            const stillInCommunity = await GroupMember.findOne({ group: { $in: otherGroupIds }, user: userId });
            
            // If not in any other group, they leave the community
            if (!stillInCommunity) {
                const delComm = await CommunityMember.findOneAndDelete({ community: group.community, user: userId });
                if (delComm) {
                    await Community.findByIdAndUpdate(group.community, {
                        $inc: { memberCount: -1 }
                    });
                }
            }
        }

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
            .populate('creator', 'username displayName avatarInitials avatarUrl')
            .populate('community', 'name icon');
            
        if (!group) return res.status(404).json({ error: 'Group not found' });
        
        // Fetch members
        const members = await GroupMember.find({ group: group._id })
            .populate('user', 'username displayName avatarInitials avatarUrl reputation');
            
        const groupObj = group.toObject();
        groupObj.membersList = members.map(m => ({
            ...m.user.toObject(),
            role: m.role,
            joinedAt: m.joinedAt
        }));

        res.json(groupObj);
    } catch (error) {
        console.error('Error fetching group details:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get Groups User is Member of
router.get('/user/:userId', auth, async (req, res) => {
    try {
        const userId = req.params.userId;
        const memberships = await GroupMember.find({ user: userId })
            .populate({
                path: 'group',
                select: 'name description memberCount community privacy',
                populate: { path: 'community', select: 'name icon' }
            });
            
        const groups = memberships.map(m => m.group).filter(g => g != null);
        res.json(groups);
    } catch (error) {
        console.error('Error fetching user groups:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
