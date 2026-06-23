// js/notifications.js

class NotificationsApp {
    constructor() {
        this.currentUser = JSON.parse(localStorage.getItem('flexy_user') || 'null');
        this.notifications = [];
        this.currentTab = 'all';
        
        this.init();
    }

    async init() {
        if (!this.currentUser) {
            window.location.href = 'login.html';
            return;
        }
        window.notifApp = this;
        await this.loadNotifications();
        this.setupListeners();
    }

    setupListeners() {
        const markAllBtn = document.getElementById('mark-all-read-btn');
        if (markAllBtn) {
            markAllBtn.addEventListener('click', () => this.markAllAsRead());
        }
    }

    async loadNotifications() {
        try {
            this.notifications = await api.get('/notifications');
            this.updateBadges();
            this.renderFeed();
        } catch (err) {
            console.error(err);
            document.getElementById('notifications-feed').innerHTML = `<div style="color: var(--danger); text-align: center; padding: 2rem;">Failed to load notifications.</div>`;
        }
    }

    updateBadges() {
        const unreadCount = this.notifications.filter(n => !n.read).length;
        const allBadge = document.getElementById('badge-all');
        const unreadBadge = document.getElementById('badge-unread');
        
        if (this.notifications.length > 0) {
            allBadge.textContent = this.notifications.length;
            allBadge.classList.add('active');
        } else {
            allBadge.classList.remove('active');
        }

        if (unreadCount > 0) {
            unreadBadge.textContent = unreadCount;
            unreadBadge.classList.add('active');
        } else {
            unreadBadge.classList.remove('active');
        }
    }

    switchTab(tab) {
        this.currentTab = tab;
        
        // Update sidebar UI
        document.querySelectorAll('.tab-btn').forEach(btn => {
            if (btn.dataset.tab === tab) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        this.renderFeed();
    }

    getFilteredNotifications() {
        switch(this.currentTab) {
            case 'unread':
                return this.notifications.filter(n => !n.read);
            case 'auctions':
                return this.notifications.filter(n => ['bid', 'outbid', 'auction_won', 'auction_ended'].includes(n.type));
            case 'communities':
                return this.notifications.filter(n => ['community_request', 'community_approved', 'community_rejected', 'group_invite'].includes(n.type));
            case 'collections':
                return this.notifications.filter(n => ['comment', 'like', 'collection_update'].includes(n.type));
            case 'system':
                return this.notifications.filter(n => ['system', 'alert'].includes(n.type));
            case 'all':
            default:
                return this.notifications;
        }
    }

    getIconForType(type) {
        const icons = {
            bid: '💰',
            outbid: '⚠️',
            auction_won: '🎉',
            auction_ended: '⏳',
            community_request: '👥',
            community_approved: '✅',
            like: '🤍',
            comment: '💬',
            system: '⚙️'
        };
        return icons[type] || '🔔';
    }

    async markAsRead(id) {
        try {
            await api.put(`/notifications/${id}/read`);
            const notif = this.notifications.find(n => n._id === id);
            if (notif) notif.read = true;
            this.updateBadges();
            this.renderFeed();
        } catch (err) {
            console.error("Error marking read", err);
        }
    }

    async markAllAsRead() {
        try {
            await api.put('/notifications/read-all');
            this.notifications.forEach(n => n.read = true);
            this.updateBadges();
            this.renderFeed();
            notify('All notifications marked as read', 'success');
        } catch (err) {
            notify('Failed to mark all as read', 'error');
        }
    }

    renderCard(n) {
        const icon = this.getIconForType(n.type);
        const timeStr = new Date(n.createdAt).toLocaleString();
        
        let actionBtn = '';
        if (!n.read) {
            actionBtn = `<button class="btn btn-primary" style="padding: 0.3rem 0.8rem; font-size: 0.8rem; border-radius: var(--radius-sm);" onclick="notifApp.markAsRead('${n._id}')">Mark Read</button>`;
        }

        let linkUrl = '#';
        if (n.itemModel === 'Auction' && n.relatedItem) linkUrl = `item.html?id=${typeof n.relatedItem === 'object' ? n.relatedItem._id : n.relatedItem}`;
        if (n.itemModel === 'Community' && n.relatedItem) linkUrl = `community.html?id=${typeof n.relatedItem === 'object' ? n.relatedItem._id : n.relatedItem}`;

        return `
            <div class="notification-card ${!n.read ? 'unread' : ''}">
                <div class="sender-avatar">${icon}</div>
                <div class="notification-content">
                    <h4 class="notification-title">${n.title}</h4>
                    <p class="notification-msg">${n.message}</p>
                    <div class="notification-meta">
                        <span class="notification-time">${timeStr}</span>
                        <div style="display: flex; gap: 0.5rem;">
                            ${actionBtn}
                            ${linkUrl !== '#' ? `<button class="btn btn-outline" style="padding: 0.3rem 0.8rem; font-size: 0.8rem; border-radius: var(--radius-sm);" onclick="window.location.href='${linkUrl}'">View</button>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderFeed() {
        const feed = document.getElementById('notifications-feed');
        const filtered = this.getFilteredNotifications();

        if (filtered.length === 0) {
            let stateTitle = "All Caught Up";
            let stateMsg = "You have no notifications in this category.";
            if (this.currentTab === 'unread') {
                stateTitle = "No Unread Notifications";
                stateMsg = "You've read everything!";
            } else if (this.currentTab === 'all') {
                stateTitle = "It's Quiet Here";
                stateMsg = "Your notification center is completely empty.";
            }

            feed.innerHTML = `
                <div class="empty-state">
                    <div style="font-size: 4rem; opacity: 0.5; margin-bottom: 1rem;">📭</div>
                    <h3 style="font-family: var(--font-brand); color: var(--text-primary); margin: 0 0 0.5rem 0; font-size: 1.5rem;">${stateTitle}</h3>
                    <p style="color: var(--text-secondary); margin: 0;">${stateMsg}</p>
                </div>
            `;
            return;
        }

        feed.innerHTML = filtered.map(n => this.renderCard(n)).join('');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new NotificationsApp();
});
