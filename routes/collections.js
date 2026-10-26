const express = require('express');
const router = express.Router();
const Collection = require('../models/Collection');
const auth = require('../middleware/auth');
const { validateIdParam, cleanText, cleanImageUrl } = require('../lib/validation');

router.param('id', validateIdParam);

const OWNER_FIELDS = 'username displayName avatarInitials avatarUrl';
const ITEM_TYPES = ['Showcase Only', 'Auction Only', 'Showcase + Auction'];

// Get Collections. Supports ?sort=newest (default) | trending and ?limit (max 100).
router.get('/', async (req, res, next) => {
    try {
        const limit = Math.min(Number.parseInt(req.query.limit, 10) || 60, 100);

        if (req.query.sort === 'trending') {
            const collections = await Collection.aggregate([
                { $addFields: { likeCount: { $size: { $ifNull: ['$likes', []] } } } },
                { $sort: { likeCount: -1, createdAt: -1 } },
                { $limit: limit },
                { $project: { likeCount: 0 } }
            ]);
            await Collection.populate(collections, { path: 'owner', select: OWNER_FIELDS });
            return res.json(collections);
        }

        const collections = await Collection.find()
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate('owner', OWNER_FIELDS);
        res.json(collections);
    } catch (error) {
        next(error);
    }
});

// Create Collection (owned by the authenticated user)
router.post('/', auth, async (req, res, next) => {
    try {
        const b = req.body || {};
        const collection = new Collection({
            title: cleanText(b.title, 'Title', { max: 120, required: true }),
            description: cleanText(b.description, 'Description', { max: 2000, required: true }),
            category: cleanText(b.category, 'Category', { max: 60 }) || undefined,
            coverImage: cleanImageUrl(b.coverImage, 'Cover image') || undefined,
            owner: req.user.userId
        });
        await collection.save();
        res.status(201).json(collection);
    } catch (error) {
        next(error);
    }
});

// Add Item to Collection (owner only)
router.post('/:id/items', auth, async (req, res, next) => {
    try {
        const collection = await Collection.findById(req.params.id);
        if (!collection) return res.status(404).json({ error: 'Not found' });
        if (collection.owner.toString() !== req.user.userId) {
            return res.status(403).json({ error: 'Only the owner can add items to this collection' });
        }

        const b = req.body || {};
        const itemType = b.itemType === undefined ? undefined : b.itemType;
        if (itemType !== undefined && !ITEM_TYPES.includes(itemType)) {
            return res.status(400).json({ error: 'Invalid item type' });
        }
        collection.items.push({
            name: cleanText(b.name, 'Name', { max: 120, required: true }),
            description: cleanText(b.description, 'Description', { max: 2000 }),
            image: cleanImageUrl(b.image, 'Image'),
            itemType
        });
        await collection.save();
        res.json(collection);
    } catch (error) {
        next(error);
    }
});

// Like / unlike Collection (toggle)
router.post('/:id/like', auth, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const collection = await Collection.findById(req.params.id).select('likes');
        if (!collection) return res.status(404).json({ error: 'Not found' });

        const liked = !collection.likes.some(id => id.toString() === userId);
        const updated = await Collection.findByIdAndUpdate(
            req.params.id,
            liked ? { $addToSet: { likes: userId } } : { $pull: { likes: userId } },
            { returnDocument: 'after' }
        ).select('likes');
        res.json({
            message: liked ? 'Collection liked' : 'Like removed',
            liked,
            likesCount: updated ? updated.likes.length : 0
        });
    } catch (error) {
        next(error);
    }
});

// Follow Collection
router.post('/:id/follow', auth, async (req, res, next) => {
    try {
        const result = await Collection.updateOne({ _id: req.params.id }, { $addToSet: { followers: req.user.userId } });
        if (result.matchedCount === 0) return res.status(404).json({ error: 'Not found' });
        res.json({ message: 'Following collection', following: true });
    } catch (error) {
        next(error);
    }
});

// Comment on Collection
router.post('/:id/comment', auth, async (req, res, next) => {
    try {
        const text = cleanText(req.body && req.body.text, 'Comment', { max: 1000, required: true });
        const collection = await Collection.findByIdAndUpdate(
            req.params.id,
            { $push: { comments: { user: req.user.userId, text } } },
            { returnDocument: 'after' }
        );
        if (!collection) return res.status(404).json({ error: 'Not found' });
        res.json(collection);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
