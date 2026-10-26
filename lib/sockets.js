// lib/sockets.js
// Socket.IO is used only to *push* events that the REST API has already
// validated and persisted. Clients can join public auction rooms and, when
// authenticated, receive their own direct messages. The old handlers that
// rebroadcast whatever a client sent ("place_bid", "send_message") let anyone
// spoof bids or read any chat room, so they no longer exist.

const jwt = require('jsonwebtoken');
const { isObjectId } = require('./validation');

const auctionRoom = (auctionId) => `auction_${auctionId}`;
const userRoom = (userId) => `user_${userId}`;

function setupSockets(io, config) {
    io.use((socket, next) => {
        const token = socket.handshake.auth && socket.handshake.auth.token;
        if (typeof token === 'string' && token) {
            try {
                const decoded = jwt.verify(token, config.jwt.accessSecret, { algorithms: ['HS256'] });
                if (typeof decoded.userId === 'string') socket.data.userId = decoded.userId;
            } catch (err) {
                // Invalid or expired token: continue as an anonymous viewer.
            }
        }
        next();
    });

    io.on('connection', (socket) => {
        if (socket.data.userId) socket.join(userRoom(socket.data.userId));

        socket.on('join_auction', (auctionId) => {
            if (isObjectId(auctionId)) socket.join(auctionRoom(auctionId));
        });

        socket.on('leave_auction', (auctionId) => {
            if (isObjectId(auctionId)) socket.leave(auctionRoom(auctionId));
        });
    });
}

// Route handlers call these through req.app.get('io'); both are no-ops when
// sockets are not attached (e.g. in unit tests).
function emitNewBid(io, auctionId, payload) {
    if (io) io.to(auctionRoom(String(auctionId))).emit('new_bid', payload);
}

function emitDirectMessage(io, recipientId, payload) {
    if (io) io.to(userRoom(String(recipientId))).emit('receive_message', payload);
}

module.exports = { setupSockets, emitNewBid, emitDirectMessage, auctionRoom, userRoom };
