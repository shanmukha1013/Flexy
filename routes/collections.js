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

module.exports = router;
