require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname)));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/communities', require('./routes/communities'));
app.use('/api/collections', require('./routes/collections'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/auctions', require('./routes/auctions'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/search', require('./routes/search'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/groups', require('./routes/groups'));

// Fallback for SPA routing (if using HTML5 history API, otherwise just serve index.html)
app.use((req, res) => {
    // If it's an API route that wasn't found, return 404 JSON
    if (req.originalUrl.startsWith('/api/')) {
        return res.status(404).json({ error: 'API route not found' });
    }
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Database Connection
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, { cors: { origin: '*' } });

// Socket.IO real-time engine
io.on('connection', (socket) => {
    console.log('User connected to Socket.IO:', socket.id);
    
    // Live Bidding Room
    socket.on('join_auction', (auctionId) => {
        socket.join(`auction_${auctionId}`);
    });
    
    socket.on('place_bid', (data) => {
        // Broadcast the bid to everyone looking at this auction
        io.to(`auction_${data.auctionId}`).emit('new_bid', data);
    });

    // Chat Room
    socket.on('join_chat', (chatId) => {
        socket.join(`chat_${chatId}`);
    });
    
    socket.on('send_message', (data) => {
        io.to(`chat_${data.chatId}`).emit('receive_message', data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Ended Auction Check Interval
const Auction = require('./models/Auction');
const User = require('./models/User');
const Notification = require('./models/Notification');

async function checkEndedAuctions() {
    // Guard: skip if MongoDB is not connected (readyState 1 = connected)
    if (mongoose.connection.readyState !== 1) return;

    try {
        const now = new Date();
        const endedAuctions = await Auction.find({
            status: 'active',
            endTime: { $lte: now }
        });

        for (const auction of endedAuctions) {
            auction.status = 'ended';
            await auction.save();

            // Notify seller
            if (auction.seller) {
                let sellerMsg = `Your auction for "${auction.title}" has ended.`;
                if (auction.highestBidder) {
                    const winner = await User.findById(auction.highestBidder);
                    sellerMsg = `Your auction for "${auction.title}" has ended. The winning bid was ₹${auction.currentBid} by @${winner ? winner.username : 'collector'}.`;
                } else {
                    sellerMsg = `Your auction for "${auction.title}" has ended with no bids.`;
                }

                await new Notification({
                    recipient: auction.seller,
                    type: 'auction_ended',
                    title: 'Auction Completed',
                    message: sellerMsg,
                    relatedItem: auction._id,
                    itemModel: 'Auction'
                }).save();
            }

            // Notify winner
            if (auction.highestBidder) {
                await new Notification({
                    recipient: auction.highestBidder,
                    type: 'auction_won',
                    title: 'Auction Won! 🏆',
                    message: `Congratulations! You won the auction for "${auction.title}" with a winning bid of ₹${auction.currentBid}.`,
                    relatedItem: auction._id,
                    itemModel: 'Auction'
                }).save();
            }
        }
    } catch(err) {
        console.error("Error in checkEndedAuctions interval:", err);
    }
}


const PORT = process.env.PORT || 3001;
const MONGODB_URI = (process.env.MONGODB_URI || '').replace('${MONGODB_PASSWORD}', process.env.MONGODB_PASSWORD || '');

if (!MONGODB_URI) {
    console.error('❌ FATAL: MONGODB_URI environment variable is not set! Set it in Render Dashboard → Environment.');
    process.exit(1);
}

console.log(`🔌 Connecting to MongoDB... (URI set: ${!!MONGODB_URI})`);
mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
})
.then(() => {
    console.log('✅ Connected to MongoDB');

    // Only start the auction check AFTER DB is connected
    setInterval(checkEndedAuctions, 15000);

    server.listen(PORT, () => {
        console.log(`🚀 Flexy Server & Socket.IO running on port ${PORT}`);
    });
})
.catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    console.error('❌ Full error name:', err.name);
    console.error('❌ Check: 1) MONGODB_URI is correct  2) Atlas Network Access allows 0.0.0.0/0');
    setTimeout(() => process.exit(1), 500); // Small delay so logs flush before exit
});
