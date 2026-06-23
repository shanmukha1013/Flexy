const express = require('express');
const router = express.Router();
const Collection = require('../models/Collection');

// Get Collections
router.get('/', async (req, res) => {
    try {
        const collections = await Collection.find().populate('owner', 'username avatarInitials');
        res.json(collections);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Create Collection
router.post('/', async (req, res) => {
    try {
        const { title, description, category, ownerId } = req.body;
        const collection = new Collection({
            title, description, category, owner: ownerId
        });
        await collection.save();
        res.json(collection);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Add Item to Collection
router.post('/:id/items', async (req, res) => {
    try {
        const collection = await Collection.findById(req.params.id);
        if (!collection) return res.status(404).json({ error: 'Not found' });

        const { name, description, image } = req.body;
        collection.items.push({ name, description, image });
        await collection.save();
        res.json(collection);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Like Collection
router.post('/:id/like', async (req, res) => {
    try {
        const collection = await Collection.findById(req.params.id);
        if (!collection) return res.status(404).json({ error: 'Not found' });
        
        const { userId } = req.body; // In real app, from auth token
        if (!collection.likes.includes(userId)) {
            collection.likes.push(userId);
            await collection.save();
        }
        res.json(collection);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Follow Collection
router.post('/:id/follow', async (req, res) => {
    try {
        const collection = await Collection.findById(req.params.id);
        if (!collection) return res.status(404).json({ error: 'Not found' });
        
        const { userId } = req.body;
        if (!collection.followers.includes(userId)) {
            collection.followers.push(userId);
            await collection.save();
        }
        res.json(collection);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Comment on Collection
router.post('/:id/comment', async (req, res) => {
    try {
        const collection = await Collection.findById(req.params.id);
        if (!collection) return res.status(404).json({ error: 'Not found' });
        
        const { userId, text } = req.body;
        collection.comments.push({ user: userId, text });
        await collection.save();
        res.json(collection);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
