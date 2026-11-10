// scripts/migrate-password-auth.js
// Database migration for the switch from email codes to passwords. Dry run by
// default: it reports what it would change and changes nothing.
//
//   npm run db:migrate-auth                     report only
//   npm run db:migrate-auth -- --apply          apply
//   npm run db:migrate-auth -- --down           report what the reversal would do
//   npm run db:migrate-auth -- --down --apply   reverse (only before rolling back the code)
//
// Forward. Safe to run more than once; no profile data is changed:
//   1. Records profileCompleted on accounts that lack it, copied from the old
//      setup-complete flag (isVerified). The app already reads a missing value
//      that way, so this only makes the data explicit.
//   2. Drops the unique index on users.phone. Phone numbers are not verified,
//      so a unique index let anyone block a number's real owner from signing up.
//   3. Creates indexes the models declare but the database lacks (for example
//      the password link collection). No other index is dropped.
//
// Reverse, needed only to roll the code back to the email-code release:
//   - removes passwordHash, passwordChangedAt and profileCompleted from every
//     user and deletes outstanding password links. Do not skip this before
//     running the old code: its GET /api/users/:id returns whole user
//     documents and would expose password hashes.
//   - recreates the unique phone index, unless duplicates now exist (reported).

require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const { loadConfig } = require('../config/env');
const User = require('../models/User');
const PasswordSetupToken = require('../models/PasswordSetupToken');

function isPhoneIndex(index) {
    const keys = Object.keys(index.key || {});
    return keys.length === 1 && keys[0] === 'phone';
}

async function listIndexes(collection) {
    try {
        return await collection.indexes();
    } catch (err) {
        if (err.codeName === 'NamespaceNotFound' || err.code === 26) return [];
        throw err;
    }
}

async function up({ apply = false, log = console.log } = {}) {
    const users = User.collection;
    const [total, withPassword, toComplete, toIncomplete] = await Promise.all([
        users.countDocuments({}),
        users.countDocuments({ passwordHash: { $type: 'string' } }),
        users.countDocuments({ profileCompleted: { $exists: false }, isVerified: true }),
        users.countDocuments({ profileCompleted: { $exists: false }, isVerified: { $ne: true } })
    ]);
    const uniquePhoneIndexes = (await listIndexes(users)).filter(i => isPhoneIndex(i) && i.unique);

    log(`Users: ${total}. With a password: ${withPassword}. Without: ${total - withPassword} (they need a password link, or can set a password while still signed in).`);
    log(`profileCompleted to record: ${toComplete} complete (finished setup), ${toIncomplete} incomplete.`);
    log(uniquePhoneIndexes.length
        ? `Unique phone index to drop: ${uniquePhoneIndexes.map(i => i.name).join(', ')}.`
        : 'No unique phone index (nothing to drop).');

    if (!apply) {
        log('Dry run: nothing was changed. Re-run with --apply to apply.');
        return { total, withPassword, toComplete, toIncomplete, droppedIndexes: [] };
    }

    // The raw collection is used so timestamps (updatedAt) are left alone.
    await users.updateMany({ profileCompleted: { $exists: false }, isVerified: true }, { $set: { profileCompleted: true } });
    await users.updateMany({ profileCompleted: { $exists: false }, isVerified: { $ne: true } }, { $set: { profileCompleted: false } });
    for (const index of uniquePhoneIndexes) await users.dropIndex(index.name);
    await User.createIndexes();
    await PasswordSetupToken.createIndexes();
    log('Applied.');
    return { total, withPassword, toComplete, toIncomplete, droppedIndexes: uniquePhoneIndexes.map(i => i.name) };
}

async function down({ apply = false, log = console.log } = {}) {
    const users = User.collection;
    const [withPassword, withFlag, links, duplicatePhones] = await Promise.all([
        users.countDocuments({ passwordHash: { $exists: true } }),
        users.countDocuments({ profileCompleted: { $exists: true } }),
        PasswordSetupToken.collection.countDocuments({}),
        users.aggregate([
            { $match: { phone: { $type: 'string' } } },
            { $group: { _id: '$phone', count: { $sum: 1 } } },
            { $match: { count: { $gt: 1 } } },
            { $count: 'phones' }
        ]).toArray().then(rows => (rows[0] ? rows[0].phones : 0))
    ]);

    log(`Would remove passwords from ${withPassword} accounts and profileCompleted from ${withFlag}, and delete ${links} password links.`);
    log('Members could then only sign in with the old email codes again.');
    log(duplicatePhones
        ? `The unique phone index cannot be recreated: ${duplicatePhones} phone numbers are shared by several accounts.`
        : 'The unique phone index would be recreated.');

    if (!apply) {
        log('Dry run: nothing was changed. Re-run with --down --apply to reverse.');
        return { withPassword, withFlag, links, duplicatePhones, phoneIndexRecreated: false };
    }

    await users.updateMany({}, { $unset: { passwordHash: '', passwordChangedAt: '', profileCompleted: '' } });
    await PasswordSetupToken.collection.deleteMany({});
    let phoneIndexRecreated = false;
    if (!duplicatePhones) {
        await users.createIndex({ phone: 1 }, { unique: true, sparse: true, name: 'phone_1' });
        phoneIndexRecreated = true;
    }
    log('Reversed.');
    return { withPassword, withFlag, links, duplicatePhones, phoneIndexRecreated };
}

// Host and database name only: the URI's credentials are never printed.
function describeDatabase(uri) {
    try {
        const url = new URL(uri);
        return `${url.host}${url.pathname}`;
    } catch (err) {
        return '(the configured database)';
    }
}

async function main(argv) {
    const apply = argv.includes('--apply');
    const reverse = argv.includes('--down');
    const config = loadConfig();
    if (!config.mongoUri) {
        console.error('MONGODB_URI is not set.');
        return 2;
    }
    console.log(`Database: ${describeDatabase(config.mongoUri)}`);
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 15000, autoIndex: false });
    try {
        if (reverse) await down({ apply });
        else await up({ apply });
        return 0;
    } finally {
        await mongoose.disconnect();
    }
}

if (require.main === module) {
    main(process.argv.slice(2))
        .then(code => process.exit(code))
        .catch(err => {
            console.error(`Migration failed: ${err.message}`);
            process.exit(1);
        });
}

module.exports = { up, down };
