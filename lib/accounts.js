// lib/accounts.js
// Account rules shared by the auth routes, the auth middleware, the profile
// routes and the admin scripts, so they cannot drift apart.

const User = require('../models/User');

// Usernames are stored lowercase since password sign-in was introduced, but
// accounts from before then may still contain capitals. Lookups and
// uniqueness checks therefore ignore case.
const CASE_INSENSITIVE = Object.freeze({ locale: 'en', strength: 2 });

// Whether the account has finished profile setup. Only the server sets
// profileCompleted. Accounts created before the field existed have no value
// for it; for them the old setup-complete flag (isVerified) decides, so
// existing members are never sent back through setup.
function isProfileComplete(user) {
    if (!user) return false;
    if (typeof user.profileCompleted === 'boolean') return user.profileCompleted;
    return user.isVerified === true;
}

// What a profile must contain before it can be marked complete. The photo and
// bio are optional.
function meetsProfileRequirements(user) {
    return Boolean(
        user &&
        typeof user.displayName === 'string' && user.displayName.trim() &&
        typeof user.username === 'string' && user.username &&
        Array.isArray(user.interests) && user.interests.length > 0
    );
}

// `lookup` comes from parseLoginIdentifier: { email } or { username }.
async function findAccount(lookup, select) {
    const withSelect = (query) => (select ? query.select(select) : query);
    if (lookup.email) return withSelect(User.findOne({ email: lookup.email }));
    // Exact match first: it uses the index and covers every newer account.
    const exact = await withSelect(User.findOne({ username: lookup.username }));
    if (exact) return exact;
    return withSelect(User.findOne({ username: lookup.username }).collation(CASE_INSENSITIVE));
}

async function isUsernameTaken(username, exceptUserId) {
    const filter = exceptUserId ? { username, _id: { $ne: exceptUserId } } : { username };
    return Boolean(await User.exists(filter).collation(CASE_INSENSITIVE));
}

async function isEmailTaken(email) {
    return Boolean(await User.exists({ email }));
}

module.exports = {
    isProfileComplete,
    meetsProfileRequirements,
    findAccount,
    isUsernameTaken,
    isEmailTaken
};
