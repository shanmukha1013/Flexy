// inbox.js - Flexy Messaging & Live Alerts Hub

class Inbox {
    constructor() {
        this.currentUser = null;
        this.currentTab = 'dms';
        this.activeChat = null;
        this.chats = {};
        this.notifications = [];
        this.notifFilter = 'all';
        this.socket = null;
        this.init();
    }

    async init() {
        this.currentUser = JSON.parse(localStorage.getItem('flexy_user') || 'null');

        if (!this.currentUser) {
            window.location.href = 'login.html';
            return;
        }

        // Initialize Socket.IO Client
        this.initSocket();

        this.setupHeader();
        this.setupEventListeners();
        
        await this.loadChats();
        await this.loadNotifications();
        
        this.updateUnreadBadges();
        this.setupScrollHeader();

        // Check if we should open a specific chat from query parameters
        const urlParams = new URLSearchParams(window.location.search);
        const peerId = urlParams.get('id');
        const peerName = urlParams.get('name');
        if (peerId && peerName) {
            this.startOrOpenChat(peerId, peerName);
        }
    }

    initSocket() {
        try {
            const PRODUCTION_BACKEND_URL = 'https://flexy-backend-pgw7.onrender.com';
            const socketUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                ? `http://${window.location.hostname}:3001`
                : PRODUCTION_BACKEND_URL;
                
            this.socket = io(socketUrl);
            
            this.socket.on('connect', () => {
                console.log('Connected to socket server');
            });

            this.socket.on('receive_message', (data) => {
                // If it is for our currently active chat, append immediately
                if (this.activeChat === data.senderId) {
                    this.appendIncomingMessage(data.text, data.timestamp);
                    // Mark as read in DB
                    api.get(`/messages/${this.activeChat}`).catch(err => console.error(err));
                } else {
                    // Update unread count for sidebar
                    const peerChat = this.chats[data.senderId];
                    if (peerChat) {
                        peerChat.unread = (peerChat.unread || 0) + 1;
                        peerChat.lastMessage = data.text;
                        peerChat.lastTime = data.timestamp;
                    } else {
                        // If chat not in list, reload chats list
                        this.loadChats();
                    }
                    this.renderChats();
                    this.updateUnreadBadges();
                }
            });
        } catch (e) {
            console.error('Socket.IO connection failed:', e);
        }
    }

    setupEventListeners() {
        const searchInput = document.getElementById('search-inbox');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchChats(e.target.value);
            });
        }
    }

    startOrOpenChat(peerId, peerName) {
        if (!this.chats[peerId]) {
            this.chats[peerId] = {
                peerId: peerId,
                peerName: peerName,
                peerAvatar: null,
                online: true,
                messages: [],
                lastMessage: '',
                lastTime: Date.now(),
                unread: 0
            };
            this.renderChats();
        }
        this.openChat(peerId);
    }

    setupHeader() {
        const av = document.getElementById('header-avatar');
        if (av && this.currentUser) {
            if (this.currentUser.avatarUrl || this.currentUser.profilePhoto) {
                av.style.backgroundImage = `url(${this.currentUser.avatarUrl || this.currentUser.profilePhoto})`;
                av.style.backgroundSize = 'cover';
                av.style.backgroundPosition = 'center';
                av.textContent = '';
            } else {
                av.textContent = this.currentUser.avatarInitials || this.currentUser.displayName?.[0]?.toUpperCase() || 'U';
            }
        }
    }

    setupScrollHeader() {
        window.addEventListener('scroll', () => {
            const header = document.getElementById('main-header');
            if (header) {
                header.classList.toggle('scrolled', window.scrollY > 20);
            }
        });
    }

    async loadChats() {
        try {
            const response = await api.get('/messages');
            this.chats = {};
            response.forEach(c => {
                this.chats[c.peerId] = c;
            });
            this.renderChats();
            this.updateUnreadBadges();
        } catch (err) {
            console.error("Failed to load active conversations list from DB", err);
        }
    }

    async loadNotifications() {
        try {
            const dbNotifs = await api.get('/notifications');
            this.notifications = dbNotifs.map(n => ({
                id: n._id,
                title: n.title,
                message: n.message,
                type: n.type,
                read: n.read,
                timestamp: new Date(n.createdAt).getTime(),
                itemId: n.relatedItem,
                sender: n.sender
            }));
            this.renderNotifications();
            this.updateUnreadBadges();
        } catch(err) {
            console.error("Failed to load notifications from DB", err);
        }
    }

    switchTab(tab) {
        this.currentTab = tab;
        document.getElementById('tab-dms').classList.toggle('active', tab === 'dms');
        document.getElementById('tab-notifs').classList.toggle('active', tab === 'notifs');
        document.getElementById('dms-content').style.display = tab === 'dms' ? 'block' : 'none';
        document.getElementById('notifs-content').style.display = tab === 'notifs' ? 'block' : 'none';

        if (tab !== 'dms') {
            document.getElementById('active-chat').style.display = 'none';
            document.getElementById('empty-state').style.display = 'flex';
        }
    }

    renderChats() {
        const el = document.getElementById('chats-list');
        const chatList = Object.values(this.chats).sort((a, b) => b.lastTime - a.lastTime);

        if (chatList.length === 0) {
            el.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-muted);">
                <div style="font-size: 2rem; margin-bottom: 0.5rem;">💬</div>
                <p>No conversations yet.<br>Browse collectors and start chatting!</p>
            </div>`;
            return;
        }

        el.innerHTML = chatList.map(chat => `
            <div class="chat-item ${chat.unread > 0 ? 'unread' : ''} ${this.activeChat === chat.peerId ? 'active' : ''}" 
                 id="chat-item-${chat.peerId}"
                 onclick="inbox.openChat('${chat.peerId}')">
                <div class="chat-avatar" style="background: ${this.getAvatarColor(chat.peerName)}; ${chat.peerAvatar ? `background-image: url('${chat.peerAvatar}'); background-size: cover; background-position: center; color: transparent;` : ''}">
                    ${chat.peerAvatar ? '' : (chat.peerName || 'C')[0].toUpperCase()}
                    <div class="online-dot"></div>
                </div>
                <div class="chat-info">
                    <div class="chat-name">${this.escapeHtml(chat.peerName)}</div>
                    <div class="chat-preview">${this.escapeHtml(chat.lastMessage || '')}</div>
                </div>
                <div class="chat-meta">
                    <div>${this.timeAgo(chat.lastTime)}</div>
                    ${chat.unread > 0 ? `<div class="unread-badge" style="margin-top: 0.25rem;">${chat.unread}</div>` : ''}
                </div>
            </div>
        `).join('');
    }

    async openChat(peerId) {
        this.activeChat = peerId;
        const chat = this.chats[peerId];
        if (!chat) return;

        // Reset sidebar unread locally
        chat.unread = 0;
        this.updateUnreadBadges();
        this.renderChats();

        // Show chat panel
        document.getElementById('empty-state').style.display = 'none';
        const chatView = document.getElementById('active-chat');
        chatView.style.display = 'flex';

        // Set header details
        document.getElementById('chat-peer-name').textContent = chat.peerName;
        const peerAv = document.getElementById('chat-peer-avatar');
        peerAv.textContent = chat.peerAvatar ? '' : (chat.peerName || 'C')[0].toUpperCase();
        peerAv.style.background = this.getAvatarColor(chat.peerName);
        if (chat.peerAvatar) {
            peerAv.style.backgroundImage = `url('${chat.peerAvatar}')`;
            peerAv.style.backgroundSize = 'cover';
            peerAv.style.backgroundPosition = 'center';
            peerAv.style.color = 'transparent';
        } else {
            peerAv.style.backgroundImage = '';
        }

        document.getElementById('chat-peer-status').textContent = '🟢 Online';
        document.getElementById('chat-peer-status').style.color = 'var(--success)';

        // Join Socket.IO Chat Room
        if (this.socket) {
            const chatId = [this.currentUser._id || this.currentUser.id, peerId].sort().join('_');
            this.socket.emit('join_chat', chatId);
        }

        // Fetch actual message history from Server
        try {
            const messages = await api.get(`/messages/${peerId}`);
            chat.messages = messages.map(m => ({
                id: m._id,
                senderId: m.sender,
                text: m.content,
                timestamp: new Date(m.createdAt).getTime(),
                read: m.read
            }));
            this.renderMessages(chat);
        } catch (err) {
            console.error("Failed to load chat history from server", err);
            this.renderMessages(chat);
        }

        // Focus input
        document.getElementById('chat-input').focus();
    }

    renderMessages(chat) {
        const el = document.getElementById('chat-messages');
        const msgs = chat.messages || [];

        if (msgs.length === 0) {
            el.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; margin: auto;">Say hello to start the conversation!</div>`;
            return;
        }

        const myId = this.currentUser._id || this.currentUser.id;

        el.innerHTML = msgs.map(msg => {
            const isSent = msg.senderId === myId;
            return `
                <div class="message-row ${isSent ? 'sent' : 'received'}">
                    <div class="message-bubble ${isSent ? 'sent' : 'received'}">
                        ${this.escapeHtml(msg.text)}
                    </div>
                    <div class="message-time">${this.timeAgo(msg.timestamp)}${isSent ? (msg.read ? ' · Read' : ' · Sent') : ''}</div>
                </div>
            `;
        }).join('');

        el.scrollTop = el.scrollHeight;
    }

    appendIncomingMessage(text, timestamp) {
        const el = document.getElementById('chat-messages');
        if (!el) return;

        // If 'Say hello' text is active, remove it
        if (el.innerHTML.includes('Say hello')) {
            el.innerHTML = '';
        }

        const bubble = document.createElement('div');
        bubble.className = 'message-row received';
        bubble.innerHTML = `
            <div class="message-bubble received">
                ${this.escapeHtml(text)}
            </div>
            <div class="message-time">${this.timeAgo(timestamp)}</div>
        `;
        el.appendChild(bubble);
        el.scrollTop = el.scrollHeight;
    }

    async sendMessage() {
        if (!this.activeChat) return;
        const input = document.getElementById('chat-input');
        const text = input.value.trim();
        if (!text) return;

        const chat = this.chats[this.activeChat];
        if (!chat) return;

        const myId = this.currentUser._id || this.currentUser.id;

        // 1. Save to Database via REST API
        try {
            const newMsg = await api.post('/messages', {
                recipientId: this.activeChat,
                content: text
            });

            // 2. Emit via socket for real-time delivery
            if (this.socket) {
                const chatId = [myId, this.activeChat].sort().join('_');
                this.socket.emit('send_message', {
                    chatId,
                    senderId: myId,
                    text: text,
                    timestamp: Date.now()
                });
            }

            // 3. Update UI locally
            const localMsg = {
                id: newMsg._id,
                senderId: myId,
                text: text,
                timestamp: Date.now(),
                read: false
            };

            chat.messages.push(localMsg);
            chat.lastMessage = text;
            chat.lastTime = Date.now();
            input.value = '';

            this.renderMessages(chat);
            this.renderChats();

        } catch (err) {
            console.error('Failed to send message:', err);
            notify('Failed to send message', 'error');
        }
    }

    renderNotifications() {
        const el = document.getElementById('notifs-list');
        let filtered = this.notifications;

        if (this.notifFilter !== 'all') {
            filtered = this.notifications.filter(n => n.type === this.notifFilter || n.type.includes(this.notifFilter));
        }

        if (filtered.length === 0) {
            el.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-muted);">
                <div style="font-size: 2rem; margin-bottom: 0.5rem;">🔔</div>
                <p>No notifications here yet.</p>
            </div>`;
            return;
        }

        const iconMap = {
            bid: '🔨', bid_placed: '🔨', outbid: '📣', bid_outbid: '📣', auction_won: '🏆', auction_ended: '⏰',
            follow: '👥', like: '❤️', comment: '💬', system: '⚙️', tip: '💡',
            community_request: '👥', community_approved: '🎉', community_rejected: '❌'
        };

        el.innerHTML = filtered.map(notif => {
            const isRequest = notif.type === 'community_request';
            
            return `
                <div class="notif-item ${notif.read ? '' : 'unread'}">
                    <div class="notif-icon" style="background: ${notif.read ? 'var(--dark-2)' : 'rgba(249,115,22,0.1)'};">
                        ${iconMap[notif.type] || '🔔'}
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div class="notif-title">${this.escapeHtml(notif.title)}</div>
                        <div class="notif-body">${this.escapeHtml(notif.message)}</div>
                        <div class="notif-time">${this.timeAgo(notif.timestamp)}</div>
                        
                        ${isRequest && !notif.read ? `
                            <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem;">
                                <button class="btn btn-primary btn-sm" style="padding: 0.25rem 0.75rem; font-size: 0.75rem;" onclick="inbox.approveRequest('${notif.itemId}', '${notif.sender._id || notif.sender}', '${notif.id}')">Approve</button>
                                <button class="btn btn-outline btn-sm" style="padding: 0.25rem 0.75rem; font-size: 0.75rem;" onclick="inbox.rejectRequest('${notif.itemId}', '${notif.sender._id || notif.sender}', '${notif.id}')">Decline</button>
                            </div>
                        ` : ''}
                    </div>
                    ${!notif.read && !isRequest ? `
                        <div style="width: 8px; height: 8px; border-radius: 50%; background: var(--primary); flex-shrink: 0; margin-top: 0.5rem;" onclick="inbox.readNotif('${notif.id}', '${notif.itemId || ''}')"></div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    async approveRequest(communityId, userId, notifId) {
        try {
            await api.post(`/communities/${communityId}/requests/${userId}/approve`, {});
            notify('Admission request approved!', 'success');
            await api.put(`/notifications/${notifId}/read`, {});
            await this.loadNotifications();
        } catch (err) {
            console.error('Approve error:', err);
            notify('Error approving request', 'error');
        }
    }

    async rejectRequest(communityId, userId, notifId) {
        try {
            await api.post(`/communities/${communityId}/requests/${userId}/reject`, {});
            notify('Admission request declined', 'info');
            await api.put(`/notifications/${notifId}/read`, {});
            await this.loadNotifications();
        } catch (err) {
            console.error('Reject error:', err);
            notify('Error rejecting request', 'error');
        }
    }

    async readNotif(id, itemId) {
        const notif = this.notifications.find(n => n.id === id);
        if (notif) {
            notif.read = true;
            try {
                await api.put(`/notifications/${id}/read`, {});
            } catch(err) {
                console.error("Failed to mark notification as read in DB", err);
            }
            this.renderNotifications();
            this.updateUnreadBadges();
        }
        if (itemId && itemId !== 'undefined') {
            if (notif && (notif.type === 'like' || notif.type === 'comment')) {
                window.location.href = `home.html`;
            } else {
                window.location.href = `item.html?id=${itemId}`;
            }
        }
    }

    filterNotifs(filter, el) {
        this.notifFilter = filter;
        document.querySelectorAll('.filter-chip').forEach(chip => chip.classList.remove('active'));
        el.classList.add('active');
        this.renderNotifications();
    }

    updateUnreadBadges() {
        const dmUnread = Object.values(this.chats).reduce((sum, c) => sum + (c.unread || 0), 0);
        const dmBadge = document.getElementById('dm-unread-badge');
        if (dmBadge) {
            dmBadge.textContent = dmUnread;
            dmBadge.style.display = dmUnread > 0 ? 'inline' : 'none';
        }

        const notifUnread = this.notifications.filter(n => !n.read).length;
        const notifBadge = document.getElementById('notif-unread-badge');
        if (notifBadge) {
            notifBadge.textContent = notifUnread;
            notifBadge.style.display = notifUnread > 0 ? 'inline' : 'none';
        }
    }

    async markAllRead() {
        this.notifications.forEach(n => n.read = true);
        Object.values(this.chats).forEach(c => {
            c.unread = 0;
        });
        
        try {
            await api.post('/notifications/mark-all-read', {});
            // Fetch fresh
            await this.loadChats();
            await this.loadNotifications();
        } catch(err) {
            console.error("Failed to mark all as read in DB", err);
        }
        notify('All notifications marked as read', 'success');
    }

    searchChats(query) {
        const filtered = Object.values(this.chats).filter(c =>
            c.peerName.toLowerCase().includes(query.toLowerCase()) ||
            (c.lastMessage && c.lastMessage.toLowerCase().includes(query.toLowerCase()))
        );
        const el = document.getElementById('chats-list');
        if (!query) { this.renderChats(); return; }

        el.innerHTML = filtered.map(chat => `
            <div class="chat-item" onclick="inbox.openChat('${chat.peerId}')">
                <div class="chat-avatar" style="background: ${this.getAvatarColor(chat.peerName)}; ${chat.peerAvatar ? `background-image: url('${chat.peerAvatar}'); background-size: cover; background-position: center; color: transparent;` : ''}">
                    ${chat.peerAvatar ? '' : (chat.peerName || 'C')[0].toUpperCase()}
                </div>
                <div class="chat-info">
                    <div class="chat-name">${this.escapeHtml(chat.peerName)}</div>
                    <div class="chat-preview">${this.escapeHtml(chat.lastMessage || '')}</div>
                </div>
            </div>
        `).join('') || `<div style="padding: 1.5rem; text-align: center; color: var(--text-muted);">No results found</div>`;
    }

    async clearChat() {
        if (!this.activeChat) return;
        if (!confirm('Clear all messages in this conversation locally?')) return;
        const chat = this.chats[this.activeChat];
        if (chat) {
            chat.messages = [];
            chat.lastMessage = '';
            this.renderMessages(chat);
            this.renderChats();
        }
        notify('Chat view cleared', 'info');
    }

    viewProfile() {
        if (this.activeChat) {
            window.location.href = `profile.html?id=${this.activeChat}`;
        }
    }

    composeNew() {
        notify('Select a collector from the Home or Explore page to start messaging.', 'info');
    }

    getAvatarColor(name) {
        const colors = ['linear-gradient(135deg, #10B981, #059669)', 'linear-gradient(135deg, #3B82F6, #1d4ed8)', 'linear-gradient(135deg, #A855F7, #7e22ce)', 'linear-gradient(135deg, #EC4899, #be185d)'];
        const idx = (name || 'A').charCodeAt(0) % colors.length;
        return colors[idx];
    }

    timeAgo(ts) {
        if (!ts) return 'Just now';
        const diff = Date.now() - ts;
        const m = Math.floor(diff / 60000);
        const h = Math.floor(m / 60);
        const d = Math.floor(h / 24);
        if (d > 0) return `${d}d`;
        if (h > 0) return `${h}h`;
        if (m > 0) return `${m}m`;
        return 'now';
    }

    escapeHtml(text) {
        return String(text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}

// Initialize
const inbox = new Inbox();