// messages.js - Direct Messaging Logic

class MessagingSystem {
    constructor() {
        this.currentUser = JSON.parse(localStorage.getItem('flexy_user') || 'null');
        this.conversations = [];
        this.activePeerId = null;
        this.chatHistory = [];
        
        this.init();
    }

    async init() {
        if (!this.currentUser) {
            window.location.href = 'login.html';
            return;
        }

        // Global handlers
        window.closeChat = this.closeChat.bind(this);
        window.sendMessage = this.sendMessage.bind(this);
        
        this.setupSearch();
        this.setupTextarea();
        
        await this.loadConversations();
        
        // Auto-open if query param exists
        const peerId = new URLSearchParams(window.location.search).get('user');
        if (peerId) {
            this.openChat(peerId);
        }
    }

    async loadConversations() {
        try {
            this.conversations = await api.get('/messages');
            this.renderConversations(this.conversations);
        } catch (err) {
            console.error(err);
            notify('Failed to load conversations', 'error');
            document.getElementById('conversations-list').innerHTML = `
                <div style="padding: 2rem; text-align: center; color: var(--danger);">Error loading chats</div>
            `;
        }
    }

    renderConversations(list) {
        const container = document.getElementById('conversations-list');
        
        if (!list || list.length === 0) {
            container.innerHTML = `
                <div style="padding: 2rem; text-align: center; color: var(--text-muted);">
                    No active conversations. Visit a collector's profile to start chatting!
                </div>
            `;
            return;
        }

        container.innerHTML = list.map(conv => `
            <div class="chat-item ${this.activePeerId === conv.peerId ? 'active' : ''} ${conv.unread ? 'unread' : ''}" 
                 onclick="window.messagingSystem.openChat('${conv.peerId}', '${conv.peerName}', '${conv.peerAvatar}', '${conv.avatarInitials}')">
                <div class="chat-avatar" style="${conv.peerAvatar ? `background-image: url('${conv.peerAvatar}');` : ''}">
                    ${!conv.peerAvatar ? conv.avatarInitials : ''}
                </div>
                <div style="flex: 1; overflow: hidden;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.2rem;">
                        <span style="font-weight: 600; color: var(--text-primary); font-size: 0.95rem;">${conv.peerName}</span>
                        <span style="font-size: 0.75rem; color: var(--text-muted);">${this.formatTime(conv.lastTime)}</span>
                    </div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${conv.lastMessage || '...'}
                    </div>
                </div>
            </div>
        `).join('');
    }

    setupSearch() {
        const input = document.getElementById('conversation-search');
        if (input) {
            input.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase();
                const filtered = this.conversations.filter(c => 
                    c.peerName.toLowerCase().includes(query)
                );
                this.renderConversations(filtered);
            });
        }
    }

    setupTextarea() {
        const input = document.getElementById('message-input');
        if (input) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }
    }

    async openChat(peerId, peerName = 'Collector', peerAvatar = '', avatarInitials = 'U') {
        this.activePeerId = peerId;
        
        // Mobile view toggle
        document.getElementById('inbox-layout').classList.add('chat-open');
        
        // Update UI
        document.getElementById('empty-chat-state').style.display = 'none';
        const activeState = document.getElementById('active-chat-state');
        activeState.style.display = 'flex';
        
        document.getElementById('active-chat-name').textContent = peerName;
        const avatarEl = document.getElementById('active-chat-avatar');
        if (peerAvatar) {
            avatarEl.style.backgroundImage = `url('${peerAvatar}')`;
            avatarEl.textContent = '';
        } else {
            avatarEl.style.backgroundImage = 'none';
            avatarEl.textContent = avatarInitials;
        }

        // Highlight in list
        this.renderConversations(this.conversations);

        // Fetch History
        const messagesContainer = document.getElementById('chat-messages');
        messagesContainer.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-muted);">Loading history...</div>';
        
        try {
            this.chatHistory = await api.get(`/messages/${peerId}`);
            this.renderHistory();
            
            // Re-fetch conversations to clear unread flag globally
            this.conversations = await api.get('/messages');
            this.renderConversations(this.conversations);

        } catch (err) {
            console.error(err);
            notify('Failed to load chat history', 'error');
            messagesContainer.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--danger);">Error loading history</div>';
        }
    }

    closeChat() {
        document.getElementById('inbox-layout').classList.remove('chat-open');
        this.activePeerId = null;
        this.renderConversations(this.conversations);
    }

    renderHistory() {
        const container = document.getElementById('chat-messages');
        if (this.chatHistory.length === 0) {
            container.innerHTML = `
                <div style="flex: 1; display: flex; align-items: center; justify-content: center; color: var(--text-muted); text-align: center;">
                    Say hello to start the conversation!
                </div>
            `;
            return;
        }

        container.innerHTML = this.chatHistory.map(msg => {
            const isMe = msg.sender === this.currentUser.id;
            const timeStr = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            return `
                <div class="message-bubble ${isMe ? 'msg-sent' : 'msg-received'}">
                    ${this.escapeHtml(msg.content)}
                    <span class="msg-time">${timeStr}</span>
                </div>
            `;
        }).join('');

        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
    }

    async sendMessage() {
        if (!this.activePeerId) return;
        
        const input = document.getElementById('message-input');
        const content = input.value.trim();
        if (!content) return;

        input.value = '';

        try {
            const newMsg = await api.post('/messages', {
                recipientId: this.activePeerId,
                content: content
            });
            
            this.chatHistory.push(newMsg);
            this.renderHistory();

            // Refresh conversations list to bump it to top
            this.conversations = await api.get('/messages');
            this.renderConversations(this.conversations);

        } catch (err) {
            console.error(err);
            notify('Failed to send message', 'error');
        }
    }

    formatTime(timestamp) {
        if (!timestamp) return '';
        const d = new Date(timestamp);
        const today = new Date();
        if (d.toDateString() === today.toDateString()) {
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }

    escapeHtml(unsafe) {
        return unsafe
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.messagingSystem = new MessagingSystem();
});
