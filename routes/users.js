const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Item = require('../models/Item');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');
const { getDynamicAchievements } = require('../lib/achievements');
const { isProfileComplete, meetsProfileRequirements, isUsernameTaken } = require('../lib/accounts');
const {
    validateIdParam,
    badRequest,
    cleanText,
    cleanImageUrl,
    cleanNumber,
    normalizeUsername,
    usernameProblem,
    normalizePhone
} = require('../lib/validation');

router.param('id', validateIdParam);

// Fields that are never returned by the API. (passwordHash and the legacy OTP
// fields are excluded by the schema itself.)
const HIDDEN_FIELDS = '-tokenVersion';
// Contact details and account state are only shown to the account owner.
const PRIVATE_FIELDS = ['email', 'phone', 'savedAuctions', 'isEmailVerified', 'passwordChangedAt', 'profileCompleted'];

function profileFor(userDoc, viewerId) {
    const userObj = userDoc.toObject();
    userObj.profileCompleted = isProfileComplete(userObj);
    // isVerified is the legacy setup flag, not a verification badge.
    delete userObj.isVerified;
    if (viewerId !== String(userDoc._id)) {
        for (const field of PRIVATE_FIELDS) delete userObj[field];
    }
    return userObj;
}

// Get registered users for suggestions (excluding current user and fake seed users)
router.get('/', auth, async (req, res, next) => {
    try {
        const fakeEmails = ['arthur@example.com', 'isabella@example.com', 'vincent@example.com'];
        let query = User.find({
            _id: { $ne: req.user.userId },
            email: { $nin: fakeEmails }
        }).select('displayName username avatarUrl profilePhoto avatarInitials reputation followers createdAt');

        if (req.query.featured === 'true') {
            // Featured collectors based on reputation and followers
            query = query.sort({ reputation: -1, followers: -1 });
        } else if (req.query.sort === 'newest') {
            // New collectors based on creation date
            query = query.sort({ createdAt: -1 });
        } else {
            // Default randomish sort (or by reputation)
            query = query.sort({ reputation: -1 });
        }

        const users = await query.limit(10).exec();
        res.json(users);
    } catch (error) {
        next(error);
    }
});

// Get Profile (public; email and phone are only included for the owner)
router.get('/:id', auth.optional, async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id)
            .select(HIDDEN_FIELDS)
            .populate('followers', 'username displayName avatarInitials')
            .populate('following', 'username displayName avatarInitials')
            .populate('showcaseCabinet')
            .populate('communities');
        if (!user) return res.status(404).json({ error: 'User not found' });

        const userObj = profileFor(user, req.user && req.user.userId);
        userObj.achievements = await getDynamicAchievements(user._id, user);

        res.json(userObj);
    } catch (error) {
        next(error);
    }
});

// Update Profile. Open to accounts that have not finished setup yet, because
// this is how setup is finished.
router.put('/:id', auth.allowIncompleteProfile, async (req, res, next) => {
    if (req.user.userId !== req.params.id) return res.status(403).json({ error: 'Unauthorized' });
    try {
        const currentUser = await User.findById(req.params.id);
        if (!currentUser) return res.status(404).json({ error: 'User not found' });

        const body = req.body || {};
        const set = {};
        const unset = {};

        const displayName = cleanText(body.displayName, 'Display name', { max: 50 });
        if (displayName !== undefined) {
            if (!displayName) throw badRequest('Display name cannot be empty');
            set.displayName = displayName;
            set.avatarInitials = displayName.substring(0, 2).toUpperCase();
        }

        if (body.username !== undefined) {
            if (typeof body.username !== 'string') throw badRequest('Username must be text');
            const username = normalizeUsername(body.username);
            // Unchanged apart from letter case: keep the stored spelling (older
            // accounts may contain capitals; new ones are always lowercase).
            if (username !== (currentUser.username || '').toLowerCase()) {
                const problem = usernameProblem(username);
                if (problem) throw badRequest(problem);
                if (await isUsernameTaken(username, req.params.id)) {
                    return res.status(400).json({ error: 'Username is already taken' });
                }
                set.username = username;
            }
        }

        // The email address is the login identity. Changing it without verifying
        // the new address would let an account be pointed at someone else's inbox.
        if (body.email !== undefined && body.email !== null) {
            const requested = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
            if (requested && requested !== (currentUser.email || '')) {
                throw badRequest('Changing your email address is not supported yet');
            }
        }

        if (body.phone !== undefined) {
            if (body.phone === null || (typeof body.phone === 'string' && body.phone.trim() === '')) {
                unset.phone = 1;
            } else {
                const phone = normalizePhone(body.phone);
                if (!phone) throw badRequest('Phone number is not valid');
                set.phone = phone;
            }
        }

        const bio = cleanText(body.bio, 'Bio', { max: 500 });
        if (bio !== undefined) set.bio = bio;

        if (body.interests !== undefined) {
            if (!Array.isArray(body.interests) || body.interests.length > 20) {
                throw badRequest('Interests must be a list of at most 20 entries');
            }
            set.interests = body.interests.map((v, i) => cleanText(v, `Interest ${i + 1}`, { max: 40, required: true }));
        }

        // Also support profilePhoto directly if provided
        const photo = body.profilePhoto !== undefined
            ? cleanImageUrl(body.profilePhoto, 'Profile photo')
            : cleanImageUrl(body.avatarUrl, 'Avatar');
        if (photo !== undefined) {
            set.avatarUrl = photo;
            set.profilePhoto = photo;
        }

        // Profile setup is complete once the required fields are present
        // (lib/accounts.js). Only the server sets this flag; clients cannot
        // send it. isVerified is the legacy name for the same thing.
        if (!isProfileComplete(currentUser) && meetsProfileRequirements({ ...currentUser.toObject(), ...set })) {
            set.profileCompleted = true;
            set.isVerified = true;
        }

        const update = { $set: set };
        if (Object.keys(unset).length) update.$unset = unset;

        const user = await User.findByIdAndUpdate(req.params.id, update, { returnDocument: 'after', runValidators: true })
            .select(HIDDEN_FIELDS);
        if (!user) return res.status(404).json({ error: 'User not found' });

        res.json(profileFor(user, req.user.userId));
    } catch (error) {
        if (error.code === 11000) {
            // Production keeps the old unique phone index until the migration removes it.
            const phone = error.keyPattern && error.keyPattern.phone;
            return res.status(400).json({ error: phone ? 'This phone number is already linked to another account' : 'Username is already taken' });
        }
        next(error);
    }
});

// Follow User
router.post('/:id/follow', auth, async (req, res, next) => {
    try {
        const targetId = req.params.id;
        const currentId = req.user.userId;
        if (targetId === currentId) return res.status(400).json({ error: 'Cannot follow yourself' });

        const [targetUser, currentUser] = await Promise.all([
            User.findById(targetId).select('_id').lean(),
            User.findById(currentId).select('displayName username').lean()
        ]);
        if (!targetUser || !currentUser) return res.status(404).json({ error: 'User not found' });

        // The filter makes repeated or concurrent follows idempotent. (modifiedCount
        // can't be used for this: timestamps bump updatedAt on every update.)
        const result = await User.updateOne(
            { _id: targetId, followers: { $ne: currentId } },
            { $push: { followers: currentId } }
        );
        await User.updateOne({ _id: currentId }, { $addToSet: { following: targetId } });

        if (result.matchedCount > 0) {
            // Create follow notification
            await new Notification({
                recipient: targetId,
                sender: currentId,
                type: 'follow',
                title: 'New Follower',
                message: `${currentUser.displayName || currentUser.username} started following you.`,
                relatedItem: currentId,
                itemModel: 'User'
            }).save();
        }
        res.json({ message: 'Successfully followed' });
    } catch (error) {
        next(error);
    }
});

// Unfollow User
router.post('/:id/unfollow', auth, async (req, res, next) => {
    try {
        const targetId = req.params.id;
        const currentId = req.user.userId;

        const targetUser = await User.findById(targetId).select('_id').lean();
        if (!targetUser) return res.status(404).json({ error: 'User not found' });

        await User.updateOne({ _id: targetId }, { $pull: { followers: currentId } });
        await User.updateOne({ _id: currentId }, { $pull: { following: targetId } });
        res.json({ message: 'Successfully unfollowed' });
    } catch (error) {
        next(error);
    }
});

// Add Item to Showcase Cabinet
router.post('/:id/cabinet', auth, async (req, res, next) => {
    if (req.user.userId !== req.params.id) return res.status(403).json({ error: 'Unauthorized' });
    try {
        const body = req.body || {};
        const user = await User.findById(req.params.id).select('_id').lean();
        if (!user) return res.status(404).json({ error: 'User not found' });

        const item = await Item.create({
            title: cleanText(body.title, 'Title', { max: 120, required: true }),
            description: cleanText(body.description, 'Description', { max: 2000 }),
            image: cleanImageUrl(body.image, 'Image'),
            owner: req.params.id,
            category: cleanText(body.category, 'Category', { max: 60 }),
            year: cleanText(body.year, 'Year', { max: 20 }),
            condition: cleanText(body.condition, 'Condition', { max: 60 }),
            isForSale: body.isForSale === true,
            price: cleanNumber(body.price, 'Price') || 0
        });

        await User.updateOne({ _id: req.params.id }, { $push: { showcaseCabinet: item._id } });

        res.json({ message: 'Item added to showcase cabinet successfully', item });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
