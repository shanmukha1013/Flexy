const mongoose = require('mongoose');
const User = require('./models/User');

async function fixVerification() {
    try {
        await mongoose.connect('mongodb://localhost:27017/flexy');
        console.log('Connected to MongoDB.');

        // Update shanmukhareddy10
        const result = await User.updateMany({}, { $set: { isVerified: true } });
        console.log(`Successfully verified ${result.modifiedCount} users.`);
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

fixVerification();
