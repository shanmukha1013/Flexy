// scripts/issue-password-link.js
// Creates a one-time link that lets an account owner set a new password.
//
//   npm run account:password-link -- <username or email> [--minutes=60] [--base-url=https://flexy-peach.vercel.app]
//
// Use it for accounts created by the retired email sign-in (they have no
// password yet) and for members who forgot their password. Flexy does not send
// email, so you deliver the link yourself. Anyone holding it can take over the
// account until it is used or expires, so send it only once you are sure the
// request comes from the owner: the safest way is to send it to the email
// address on the account (shown below), or in reply to a message from it.
//
// Issuing a new link cancels the previous one. Using a link signs the account
// out everywhere.

require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const { loadConfig } = require('../config/env');
const { parseLoginIdentifier } = require('../lib/validation');
const { findAccount } = require('../lib/accounts');
const { createPasswordSetupToken, DEFAULT_TTL_MS, MAX_TTL_MS } = require('../lib/password-setup');

function option(argv, name) {
    const prefix = `--${name}=`;
    const arg = argv.find(a => a.startsWith(prefix));
    return arg ? arg.slice(prefix.length) : undefined;
}

// Returns { link, expiresAt, user } or throws an Error whose message is meant for the operator.
async function issuePasswordLink({ identifier, baseUrl, minutes }) {
    const lookup = parseLoginIdentifier(identifier);
    if (!lookup) throw new Error('Give a username or an email address.');
    const ttlMs = minutes === undefined ? DEFAULT_TTL_MS : Number(minutes) * 60 * 1000;
    if (!Number.isFinite(ttlMs) || ttlMs <= 0 || ttlMs > MAX_TTL_MS) {
        throw new Error(`--minutes must be between 1 and ${MAX_TTL_MS / 60000}.`);
    }
    let base;
    try {
        base = new URL(baseUrl);
    } catch (err) {
        throw new Error(`--base-url is not a valid URL: ${baseUrl}`);
    }
    if (base.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(base.hostname)) {
        throw new Error('--base-url must use https (http is only allowed for localhost).');
    }

    const user = await findAccount(lookup, '+passwordHash');
    if (!user) throw new Error(`No account found for "${identifier}".`);

    const { token, expiresAt } = await createPasswordSetupToken(user._id, { ttlMs });
    // The token travels in the URL fragment, which browsers never send to a
    // server, so it stays out of hosting and proxy logs.
    const link = new URL('reset-password.html', base.href.endsWith('/') ? base.href : `${base.href}/`);
    link.hash = `token=${token}`;
    return { link: link.href, expiresAt, user };
}

async function main(argv) {
    const identifier = argv.find(a => !a.startsWith('--'));
    if (!identifier) {
        console.error('Usage: npm run account:password-link -- <username or email> [--minutes=60] [--base-url=https://flexy-peach.vercel.app]');
        return 2;
    }
    const config = loadConfig();
    if (!config.mongoUri) {
        console.error('MONGODB_URI is not set.');
        return 2;
    }
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 15000, autoIndex: false });
    try {
        const { link, expiresAt, user } = await issuePasswordLink({
            identifier,
            minutes: option(argv, 'minutes'),
            baseUrl: option(argv, 'base-url') || config.corsOrigins[0] || 'https://flexy-peach.vercel.app'
        });
        console.log(`Account:  @${user.username} <${user.email || 'no email on file'}>`);
        console.log(`Password: ${user.passwordHash ? 'has one (the link replaces it)' : 'none yet (created with email sign-in)'}`);
        console.log(`Expires:  ${expiresAt.toISOString()} (single use; any earlier link is now cancelled)`);
        console.log('');
        console.log(link);
        console.log('');
        console.log('Send this link only to the account owner, ideally to the email address above.');
        return 0;
    } catch (err) {
        console.error(err.message);
        return 1;
    } finally {
        await mongoose.disconnect();
    }
}

if (require.main === module) {
    main(process.argv.slice(2))
        .then(code => process.exit(code))
        .catch(err => {
            console.error(`Could not issue a link: ${err.message}`);
            process.exit(1);
        });
}

module.exports = { issuePasswordLink };
