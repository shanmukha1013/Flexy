const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const Group = require('../models/Group');
const Community = require('../models/Community');
const GroupMember = require('../models/GroupMember');
const CommunityMember = require('../models/CommunityMember');
const User = require('../models/User');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');
const {
    HttpError,
    validateIdParam,
    requireObjectId,
    cleanText,
    cleanImageUrl
} = require('../lib/validation');

router.param('id', validateIdParam);

const AUTHOR_FIELDS = 'username displayName avatarInitials avatarUrl';

// Group posts require group membership; community posts require community
// membership. Creators always qualify.
async function assertCanPost(userId, { groupId, communityId }) {
    if (groupId) {
        const group = await Group.findById(groupId).select('creator').lean();
        if (!group) throw new HttpError(404, 'Group not found');
        if (group.creator.toString() === userId) return;
        if (await GroupMember.exists({ group: groupId, user: userId })) return;
        throw new HttpError(403, 'Join this group to post in it');
    }
    const community = await Community.findById(communityId).select('creator').lean();
    if (!community) throw new HttpError(404, 'Community not found');
    if (community.creator.toString() === userId) return;
    if (await CommunityMember.exists({ community: communityId, user: userId })) return;
    throw new HttpError(403, 'Join this community to post in it');
}

// Get Feed (?group=<id> or ?community=<id>, newest first, max 100)
router.get('/', async (req, res, next) => {
    try {
        const query = {};
        if (req.query.group) {
            query.group = requireObjectId(req.query.group, 'group');
        } else if (req.query.community) {
            const communityId = requireObjectId(req.query.community, 'community');
            const groups = await Group.find({ community: communityId }).select('_id').lean();
            const groupIds = groups.map(g => g._id);
            // Fetch posts belonging to the community directly OR its groups
            query.$or = [
                { community: communityId },
                { group: { $in: groupIds } }
            ];
        }

        const posts = await Post.find(query)
            .populate('author', AUTHOR_FIELDS)
            .populate('group', 'name')
            .populate('community', 'name')
            .populate('linkedCollection', 'title')
            .populate('comments.author', AUTHOR_FIELDS)
            .sort({ createdAt: -1 })
            .limit(100);
        res.json(posts);
    } catch (error) {
        next(error);
    }
});

// Create Post (authored by the authenticated user)
router.post('/', auth, async (req, res, next) => {
    try {
        const { groupId, communityId, image, collectionId } = req.body || {};

        if (!groupId && !communityId) {
            return res.status(400).json({ error: 'Posts must belong to a group or community' });
        }
        if (groupId) requireObjectId(groupId, 'groupId');
        if (communityId) requireObjectId(communityId, 'communityId');
        if (collectionId) requireObjectId(collectionId, 'collectionId');

        const content = cleanText(req.body.content, 'Post content', { max: 5000, required: true });
        await assertCanPost(req.user.userId, { groupId, communityId });

        const post = new Post({
            content,
            author: req.user.userId,
            group: groupId || undefined,
            community: communityId || undefined,
            image: cleanImageUrl(image, 'Image') || undefined,
            linkedCollection: collectionId || undefined
        });
        await post.save();
        res.status(201).json(post);
    } catch (error) {
        next(error);
    }
});

// Like / unlike Post (toggle)
router.post('/:id/like', auth, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const post = await Post.findById(req.params.id).select('likes author');
        if (!post) return res.status(404).json({ error: 'Not found' });

        const exists = post.likes.some(id => id.toString() === userId);
        const updated = await Post.findByIdAndUpdate(
            req.params.id,
            exists ? { $pull: { likes: userId } } : { $addToSet: { likes: userId } },
            { returnDocument: 'after' }
        );

        // Create notification if liked by someone else
        if (!exists && post.author.toString() !== userId) {
            const senderUser = await User.findById(userId).select('displayName username').lean();
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
        res.json(updated);
    } catch (error) {
        next(error);
    }
});

// Comment on Post
router.post('/:id/comments', auth, async (req, res, next) => {
    try {
        const authorId = req.user.userId;
        const content = cleanText(req.body && req.body.content, 'Comment', { max: 1000, required: true });

        const post = await Post.findByIdAndUpdate(
            req.params.id,
            { $push: { comments: { content, author: authorId } } },
            { returnDocument: 'after' }
        );
        if (!post) return res.status(404).json({ error: 'Not found' });

        // Create notification if commented by someone else
        if (post.author.toString() !== authorId) {
            const senderUser = await User.findById(authorId).select('displayName username').lean();
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

        res.json(post);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
