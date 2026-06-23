const mongoose = require('mongoose');
const User = require('./models/User'); // Adjust path if needed

async function removeFakeUsers() {
    try {
        await mongoose.connect('mongodb://localhost:27017/flexy');
        console.log('Connected to MongoDB. Finding fake users...');

        // Delete users with email ending in @example.com
        const result = await User.deleteMany({ email: { $regex: /@example\.com$/i } });
        
        console.log(`Successfully deleted ${result.deletedCount} fake users.`);
        process.exit(0);
    } catch (err) {
        console.error('Error removing fake users:', err);
        process.exit(1);
    }
}

removeFakeUsers();
