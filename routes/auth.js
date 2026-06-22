const express = require('express');
const router = express.Router();
const User = require('../models/User');
const OTPVerification = require('../models/OTPVerification');
const { Resend } = require('resend');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const auth = require('../middleware/auth');
const Post = require('../models/Post');
const Community = require('../models/Community');
const Group = require('../models/Group');
const Auction = require('../models/Auction');

async function getDynamicAchievements(userId) {
    const achievements = [];
    try {
        const postCount = await Post.countDocuments({ author: userId });
        if (postCount >= 1) achievements.push("First Flex");

        const communityCount = await Community.countDocuments({ creator: userId });
        if (communityCount >= 1) achievements.push("First Community");

        const groupCount = await Group.countDocuments({ creator: userId });
        if (groupCount >= 1) achievements.push("First Group");

        const auctionCount = await Auction.countDocuments({ seller: userId });
        if (auctionCount >= 1) achievements.push("First Auction");

        const user = await User.findById(userId);
        const cabinetCount = user && user.showcaseCabinet ? user.showcaseCabinet.length : 0;
        if (cabinetCount >= 5) achievements.push("Elite Collector");

        const followersCount = user && user.followers ? user.followers.length : 0;
        if (followersCount >= 5) achievements.push("Legacy Builder");
    } catch (err) {
        console.error("Error calculating achievements dynamically:", err);
    }
    return achievements;
}

const resend = new Resend(process.env.RESEND_API_KEY);
const JWT_SECRET = process.env.JWT_SECRET || 'flexy_secure_jwt_key_2026';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'flexy_secure_refresh_key_2026';

// Helper to parse cookie from headers
function getCookie(req, name) {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) return null;
    const cookies = cookieHeader.split(';');
    for (let cookie of cookies) {
        const [key, val] = cookie.trim().split('=');
        if (key === name) return decodeURIComponent(val);
    }
    return null;
}

// Request OTP
router.post('/request-otp', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const cleanEmail = email.toLowerCase().trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            return res.status(400).json({ error: 'Please enter a valid email address' });
        }

        // 1. Generate secure random 6-digit OTP
        const otpCode = crypto.randomInt(100000, 999999).toString();

        // 2. Set expiry to 5 minutes
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        // 3. Save OTP in MongoDB (delete any existing OTP for this email first)
        await OTPVerification.deleteMany({ email: cleanEmail });

        const verificationRecord = new OTPVerification({
            email: cleanEmail,
            otp: otpCode,
            expiresAt,
            attempts: 0
        });
        await verificationRecord.save();

        // 4. Send OTP email using Resend
        const emailHtml = `Welcome to Flexy.<br><br>Your verification code is:<br><br><strong>${otpCode}</strong><br><br>This code expires in 5 minutes.<br><br>If you did not request this code, ignore this email.`;

        const { data, error } = await resend.emails.send({
            from: 'Flexy <onboarding@resend.dev>',
            to: cleanEmail,
            subject: 'Your Flexy Verification Code',
            html: emailHtml
        });

        if (error) {
            console.error('[AUTH] Resend error details:', error);
            return res.status(400).json({ error: error.message || 'Failed to send verification email' });
        }

        console.log(`[AUTH] Sent OTP ${otpCode} to ${cleanEmail} | Message ID: ${data ? data.id : 'unknown'}`);
        res.json({ message: 'OTP sent successfully to email' });

    } catch (error) {
        console.error('OTP Request Error:', error);
        res.status(500).json({ error: 'Failed to send OTP' });
    }
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
    try {
        const { email, code } = req.body;
        if (!email || !code) {
            return res.status(400).json({ error: 'Email and verification code are required' });
        }

        const cleanEmail = email.toLowerCase().trim();

        // 1. Find OTP record
        const otpRecord = await OTPVerification.findOne({ email: cleanEmail });
        if (!otpRecord) {
            return res.status(400).json({ error: 'Invalid OTP' });
        }

        // 2. Verify attempt limit not exceeded (Max 5 attempts)
        if (otpRecord.attempts >= 5) {
            await OTPVerification.deleteOne({ _id: otpRecord._id });
            return res.status(400).json({ error: 'Too Many Attempts' });
        }

        // 3. Verify not expired
        if (new Date() > otpRecord.expiresAt) {
            await OTPVerification.deleteOne({ _id: otpRecord._id });
            return res.status(400).json({ error: 'OTP Expired' });
        }

        // 4. Verify OTP matches
        if (otpRecord.otp !== code.trim()) {
            otpRecord.attempts += 1;
            await otpRecord.save();

            if (otpRecord.attempts >= 5) {
                await OTPVerification.deleteOne({ _id: otpRecord._id });
                return res.status(400).json({ error: 'Too Many Attempts' });
            }

            return res.status(400).json({ error: 'Invalid OTP' });
        }

        // 5. Delete OTP after success
        await OTPVerification.deleteOne({ _id: otpRecord._id });

        // Check if user exists
        let user = await User.findOne({ email: cleanEmail });
        let isNewUser = false;

        if (!user) {
            // Auto-create user account
            isNewUser = true;
            const tempUsername = 'user_' + crypto.randomBytes(4).toString('hex');
            const tempDisplayName = cleanEmail.split('@')[0];
            
            user = new User({
                email: cleanEmail,
                username: tempUsername,
                displayName: tempDisplayName,
                isVerified: false,
                avatarInitials: tempDisplayName.substring(0, 2).toUpperCase()
            });
            await user.save();
            console.log(`[AUTH] Auto-created user ${cleanEmail}`);
        } else if (!user.isVerified) {
            // User exists but has not completed profile setup
            isNewUser = true;
        }

        // Generate tokens
        const accessToken = jwt.sign(
            { userId: user._id, email: user.email },
            JWT_SECRET,
            { expiresIn: '15m' }
        );

        const refreshToken = jwt.sign(
            { userId: user._id },
            JWT_REFRESH_SECRET,
            { expiresIn: '30d' }
        );

        // Store refresh token securely in HttpOnly Cookie
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
        });

        res.json({
            message: 'Login successful',
            token: accessToken,
            isNewUser,
            user: {
                _id: user._id,
                email: user.email,
                username: user.username,
                displayName: user.displayName,
                profilePhoto: user.profilePhoto || '',
                avatarUrl: user.avatarUrl || user.profilePhoto || '',
                avatarInitials: user.avatarInitials,
                bio: user.bio || '',
                interests: user.interests || [],
                isVerified: user.isVerified
            }
        });

    } catch (error) {
        console.error('OTP Verification Error:', error);
        res.status(500).json({ error: 'Failed to verify OTP' });
    }
});

// Refresh Token
router.post('/refresh', async (req, res) => {
    try {
        const refreshToken = getCookie(req, 'refreshToken');
        if (!refreshToken) {
            return res.status(401).json({ error: 'Refresh token not found' });
        }

        let decoded;
        try {
            decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
        } catch (err) {
            return res.status(401).json({ error: 'Invalid refresh token' });
        }

        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        const accessToken = jwt.sign(
            { userId: user._id, email: user.email },
            JWT_SECRET,
            { expiresIn: '15m' }
        );

        res.json({
            token: accessToken,
            user: {
                _id: user._id,
                email: user.email,
                username: user.username,
                displayName: user.displayName,
                profilePhoto: user.profilePhoto || '',
                avatarUrl: user.avatarUrl || user.profilePhoto || '',
                avatarInitials: user.avatarInitials,
                bio: user.bio || '',
                interests: user.interests || [],
                isVerified: user.isVerified
            }
        });

    } catch (error) {
        console.error('Refresh Token Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Logout
router.post('/logout', (req, res) => {
    res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
    });
    res.json({ message: 'Logged out successfully' });
});

// Get current user
router.get('/me', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId)
            .select('-otpCode -otpExpires')
            .populate('followers', 'username displayName avatarInitials')
            .populate('following', 'username displayName avatarInitials')
            .populate('showcaseCabinet')
            .populate('communities');
            
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        const achievements = await getDynamicAchievements(user._id);
        
        res.json({
            _id: user._id,
            email: user.email,
            username: user.username,
            displayName: user.displayName,
            profilePhoto: user.profilePhoto || '',
            avatarUrl: user.avatarUrl || user.profilePhoto || '',
            avatarInitials: user.avatarInitials,
            bio: user.bio || '',
            interests: user.interests || [],
            isVerified: user.isVerified,
            followers: user.followers,
            following: user.following,
            showcaseCabinet: user.showcaseCabinet,
            communities: user.communities,
            achievements
        });
    } catch (err) {
        console.error('GET me error:', err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
