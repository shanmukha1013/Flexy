const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const User = require('./models/User');
const Community = require('./models/Community');
const Group = require('./models/Group');
const Collection = require('./models/Collection');
const Post = require('./models/Post');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/flexy')
    .then(() => console.log('Connected to MongoDB for Seeding'))
    .catch(err => console.error(err));

async function seedDatabase() {
    try {
        // Clear existing
        await User.deleteMany({});
        await Community.deleteMany({});
        await Group.deleteMany({});
        await Collection.deleteMany({});
        await Post.deleteMany({});

        // 1. Create Elite Users
        const user1 = await User.create({
            email: 'arthur@example.com',
            username: 'ArthurPendleton',
            displayName: 'Arthur Pendleton',
            bio: 'Distinguished horologist and archivist of mid-century Swiss timepieces. Valuing provenance above all.',
            avatarInitials: 'A',
            reputation: 'Elite'
        });

        const user2 = await User.create({
            email: 'isabella@example.com',
            username: 'IsabellaAntiquities',
            displayName: 'Isabella Antiquities',
            bio: 'Specializing in the procurement and curation of Greco-Roman numismatics and Hellenistic artifacts.',
            avatarInitials: 'I',
            reputation: 'Elite'
        });

        const user3 = await User.create({
            email: 'vincent@example.com',
            username: 'VincentLeica',
            displayName: 'Vincent Photography',
            bio: 'Archiving pristine examples of German optical engineering. Leica M-Series historian.',
            avatarInitials: 'V',
            reputation: 'Trusted'
        });

        // 2. Create Communities
        const commHorology = await Community.create({
            name: 'Haute Horlogerie',
            description: 'The premier sanctuary for purveyors and scholars of exceptional mechanical timepieces.',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="7"></circle><polyline points="12 9 12 12 13.5 13.5"></polyline><path d="M16.51 17.35l-.35 3.83a2 2 0 0 1-2 1.82H9.83a2 2 0 0 1-2-1.82l-.35-3.83m.01-10.7l.35-3.83A2 2 0 0 1 9.83 1h4.35a2 2 0 0 1 2 1.82l.35 3.83"></path></svg>',
            creator: user1._id,
            members: [user1._id, user2._id, user3._id],
            privacy: 'public'
        });

        const commNumis = await Community.create({
            name: 'Classical Numismatics',
            description: 'A disciplined assembly dedicated to the study and preservation of ancient coinage.',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v8"></path><path d="M10 10h4"></path><path d="M10 14h4"></path></svg>',
            creator: user2._id,
            members: [user1._id, user2._id],
            privacy: 'private'
        });

        // 3. Create Groups
        const groupRolex = await Group.create({
            name: 'Vintage Submariner Registry',
            description: 'Exclusive discourse surrounding the evolution of the iconic Rolex Submariner dials.',
            community: commHorology._id,
            creator: user1._id,
            members: [user1._id]
        });

        // 4. Create Collections
        const collRolex = await Collection.create({
            title: 'The Geneva Vault',
            description: 'A meticulously assembled compendium of pristine, unpolished sports watches from the 1970s.',
            owner: user1._id,
            category: 'Horology',
            coverImage: 'assets/rolex.png',
            items: [
                { name: 'Rolex Submariner Ref. 5513', description: 'Flawless Maxi Dial with immaculate tritium patina.', image: 'assets/rolex.png' }
            ]
        });

        const collCoins = await Collection.create({
            title: 'The Imperial Treasury',
            description: 'Documenting the numismatic legacy of the Roman Empire through exceptionally struck silver denarii.',
            owner: user2._id,
            category: 'Numismatics',
            coverImage: 'assets/coin.png',
            items: [
                { name: 'Silver Denarius of Augustus', description: 'Extraordinary strike clarity preserving the Emperor’s profile.', image: 'assets/coin.png' }
            ]
        });

        // 5. Create Posts
        await Post.create({
            author: user1._id,
            community: commHorology._id,
            content: 'After a rigorous three-year pursuit, I have finally secured this immaculate horological artifact. The tritium luminescence has aged to a flawless, uniform vanilla hue. A testament to mid-century Swiss craftsmanship.',
            image: 'assets/rolex.png',
            linkedCollection: collRolex._id
        });

        await Post.create({
            author: user2._id,
            community: commNumis._id,
            content: 'I am presently curating my collection to accommodate new Hellenistic acquisitions. As such, I will be relinquishing this magnificent Silver Denarius. Its provenance is impeccable, previously residing in the eminent Smithson catalog.',
            image: 'assets/coin.png',
            linkedCollection: collCoins._id
        });

        console.log('✅ Database seeded with top-tier premium data.');
        process.exit();

    } catch (err) {
        console.error('Seeding Error:', err);
        process.exit(1);
    }
}

seedDatabase();
