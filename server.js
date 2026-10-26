require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const { loadConfig, assertValidConfig } = require('./config/env');
const { createEmailService } = require('./lib/email');
const { startAuctionCloser } = require('./lib/auctions');
const { createApp } = require('./app');

async function main() {
    const config = loadConfig();
    for (const warning of config.warnings) console.warn(`⚠️  ${warning}`);
    try {
        assertValidConfig(config);
    } catch (err) {
        console.error(`❌ FATAL: ${err.message}`);
        process.exit(1);
    }

    const emailService = createEmailService(config.email);
    const { server, io } = createApp({ config, emailService });

    console.log(`📧 Email delivery: ${emailService.describe()}`);
    console.log(`🌐 Allowed CORS origins: ${config.corsOrigins.join(', ') || '(none)'}`);

    let stopAuctionCloser = null;

    mongoose.connection.on('disconnected', () => console.warn('⚠️  MongoDB disconnected'));
    mongoose.connection.on('reconnected', () => console.log('✅ MongoDB reconnected'));

    // Listen first so the frontend and /api/health respond while the database
    // connects; API routes report 503 until MongoDB is reachable.
    server.listen(config.port, () => {
        console.log(`🚀 Flexy Server & Socket.IO running on port ${server.address().port} (${config.nodeEnv})`);
    });

    async function shutdown(signal) {
        console.log(`${signal} received, shutting down...`);
        setTimeout(() => process.exit(1), 10000).unref();
        if (stopAuctionCloser) stopAuctionCloser();
        await new Promise(resolve => io.close(() => resolve()));
        await mongoose.disconnect().catch(() => {});
        process.exit(0);
    }
    process.once('SIGTERM', () => shutdown('SIGTERM'));
    process.once('SIGINT', () => shutdown('SIGINT'));

    if (!config.mongoUri) {
        console.warn('⚠️  No database configured: API routes will return 503.');
        return;
    }

    console.log('🔌 Connecting to MongoDB...');
    try {
        await mongoose.connect(config.mongoUri, {
            serverSelectionTimeoutMS: config.isProduction ? 30000 : 5000,
            socketTimeoutMS: 45000
        });
        console.log('✅ Connected to MongoDB');

        // Only start the auction check AFTER DB is connected
        stopAuctionCloser = startAuctionCloser();
    } catch (err) {
        console.error('❌ MongoDB connection error:', err.message);
        if (config.isProduction) {
            console.error('❌ Check: 1) MONGODB_URI is correct  2) Atlas Network Access allows this server');
            setTimeout(() => process.exit(1), 500); // Small delay so logs flush before exit
        } else {
            console.error('❌ Continuing without a database: API routes return 503. Start MongoDB or set MONGODB_URI, then restart.');
        }
    }
}

if (require.main === module) {
    main();
}

module.exports = { main };
