// lib/achievements.js
// Achievements are derived from live data rather than stored on the user.

const User = require('../models/User');
const Post = require('../models/Post');
const Community = require('../models/Community');
const Group = require('../models/Group');
const Auction = require('../models/Auction');

// Pass `user` when it is already loaded to skip an extra lookup.
async function getDynamicAchievements(userId, user = null) {
    const achievements = [];
    try {
        const [postCount, communityCount, groupCount, auctionCount, loadedUser] = await Promise.all([
            Post.countDocuments({ author: userId }),
            Community.countDocuments({ creator: userId }),
            Group.countDocuments({ creator: userId }),
            Auction.countDocuments({ seller: userId }),
            user ? user : User.findById(userId).select('showcaseCabinet followers').lean()
        ]);

        if (postCount >= 1) achievements.push("First Flex");
        if (communityCount >= 1) achievements.push("First Community");
        if (groupCount >= 1) achievements.push("First Group");
        if (auctionCount >= 1) achievements.push("First Auction");

        const cabinetCount = loadedUser && loadedUser.showcaseCabinet ? loadedUser.showcaseCabinet.length : 0;
        if (cabinetCount >= 5) achievements.push("Elite Collector");

        const followersCount = loadedUser && loadedUser.followers ? loadedUser.followers.length : 0;
        if (followersCount >= 5) achievements.push("Legacy Builder");
    } catch (err) {
        console.error("Error calculating achievements dynamically:", err);
    }
    return achievements;
}

module.exports = { getDynamicAchievements };
