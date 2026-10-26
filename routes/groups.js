const express = require('express');
const router = express.Router();
const Group = require('../models/Group');
const Community = require('../models/Community');
const GroupMember = require('../models/GroupMember');
const CommunityMember = require('../models/CommunityMember');
const auth = require('../middleware/auth');
const { HttpError, validateIdParam, requireObjectId, cleanText } = require('../lib/validation');

router.param('id', validateIdParam);
router.param('userId', validateIdParam);

// Joining a group inside a private community would otherwise grant community
// membership without the creator's approval.
async function assertCommunityAccess(community, userId) {
    if (!community || community.privacy !== 'private') return;
    if (community.creator.toString() === userId) return;
    if (await CommunityMember.exists({ community: community._id, user: userId })) return;
    throw new HttpError(403, 'This community is private. Request to join it first.');
}

// Create Group
router.post('/', auth, async (req, res, next) => {
    try {
        const body = req.body || {};
        const { communityId, privacy } = body;
        const userId = req.user.userId;
        const name = cleanText(body.name, 'Name', { max: 60, required: true });
        const description = cleanText(body.description, 'Description', { max: 1000, required: true });

        let community = null;
        if (communityId) {
            requireObjectId(communityId, 'communityId');
            community = await Community.findById(communityId);
            if (!community) {
                return res.status(404).json({ error: 'Community not found' });
            }
            await assertCommunityAccess(community, userId);
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
        next(error);
    }
});

// Get All Groups (public)
router.get('/', async (req, res, next) => {
    try {
        const filter = {};
        if (req.query.communityId) filter.community = requireObjectId(req.query.communityId, 'communityId');
        if (req.query.standalone === 'true') filter.community = { $exists: false };
        
        const groups = await Group.find(filter)
            .populate('creator', 'username displayName avatarInitials')
            .populate('community', 'name icon')
            .sort({ memberCount: -1 });
        res.json(groups);
    } catch (error) {
        next(error);
    }
});

// Join Group
router.post('/:id/join', auth, async (req, res, next) => {
    try {
        const group = await Group.findById(req.params.id);
        if (!group) return res.status(404).json({ error: 'Group not found' });

        const userId = req.user.userId;
        if (group.community) {
            await assertCommunityAccess(await Community.findById(group.community).select('privacy creator'), userId);
        }
        
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
        next(error);
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
            
            // If not in any other group, they leave the community (the owner's
            // membership is never removed this way)
            if (!stillInCommunity) {
                const delComm = await CommunityMember.findOneAndDelete({ community: group.community, user: userId, role: { $ne: 'owner' } });
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
        // Skip memberships whose user account no longer exists.
        groupObj.membersList = members
            .filter(m => m.user)
            .map(m => ({
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
