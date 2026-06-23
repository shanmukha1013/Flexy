const mongoose = require('mongoose');

// Models
const Auction = require('./models/Auction');
const Collection = require('./models/Collection');
const Community = require('./models/Community');
const Group = require('./models/Group');
const Message = require('./models/Message');
const Notification = require('./models/Notification');
const Post = require('./models/Post');

async function clearDB() {
    try {
        await mongoose.connect('mongodb://localhost:27017/flexy');
        console.log('Connected to MongoDB. Wiping non-user collections...');

        await Auction.deleteMany({});
        await Collection.deleteMany({});
        await Community.deleteMany({});
        await Group.deleteMany({});
        await Message.deleteMany({});
        await Notification.deleteMany({});
        await Post.deleteMany({});

        console.log('Successfully wiped all fake data from the database. Users were kept intact.');
        process.exit(0);
    } catch (err) {
        console.error('Error wiping db:', err);
        process.exit(1);
    }
}

clearDB();
