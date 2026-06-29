// home.js - Discovery Hub Logic

class HomeHub {
    constructor() {
        this.currentUser = JSON.parse(localStorage.getItem('flexy_user') || '{}');
        this.init();
    }

    async init() {
        this.renderSidebarUserInfo();
        
        try {
            await Promise.all([
                this.loadSidebarCommunities(),
                this.loadLiveAuctions(),
                this.loadEndingSoon(),
                this.loadRecentCollections(),
                this.loadCommunityActivity(),
                this.loadTrendingCollections(),
                this.loadFeaturedCollectors(),
                this.loadNewCollectors()
            ]);
        } catch (err) {
            console.error("Error loading home feed:", err);
            notify("Some sections failed to load. Please refresh.", "error");
        }
    }

    renderSidebarUserInfo() {
        const container = document.getElementById('sidebar-user-info');
        if (!container) return;

        if (!this.currentUser || !this.currentUser.id && !this.currentUser._id) {
            container.innerHTML = `
                <div class="avatar-circle" style="width: 50px; height: 50px; background: var(--dark-3);">?</div>
                <div>
                    <div style="font-weight: 700; font-family: var(--font-brand);">Guest</div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.2rem;"><a href="login.html" style="color: var(--primary);">Login</a></div>
                </div>
            `;
            return;
        }

        const initial = this.currentUser.avatarInitials || (this.currentUser.displayName ? this.currentUser.displayName.charAt(0).toUpperCase() : 'U');
        
        const avatarStyle = this.currentUser.avatarUrl 
            ? `background-image: url('${this.currentUser.avatarUrl}'); background-size: cover; background-position: center; color: transparent;` 
            : '';
        
        container.innerHTML = `
            <div class="avatar-circle" style="width: 50px; height: 50px; background: var(--primary); ${avatarStyle}">${this.currentUser.avatarUrl ? '' : initial}</div>
            <div>
                <div style="font-weight: 700; font-family: var(--font-brand);">${this.currentUser.displayName || 'Collector'}</div>
                <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.2rem;">@${this.currentUser.username || 'user'}</div>
                <div style="font-size: 0.8rem; color: var(--text-muted);">Reputation: ${this.currentUser.reputation || 'New'}</div>
            </div>
        `;
    }

    createEmptyState(title, message) {
        return `
            <div class="empty-state" style="grid-column: 1 / -1; padding: 3rem 1rem; text-align: center; border-radius: var(--radius-lg); border: 1px solid var(--border-glass); background: var(--dark-2);">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" style="margin-bottom: 1rem; opacity: 0.5;">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke="var(--text-muted)" stroke-width="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5" fill="var(--text-muted)"/>
                    <polyline points="21 15 16 10 5 21" stroke="var(--text-muted)" stroke-width="2"/>
                </svg>
                <h4 style="font-size: 1.1rem; color: var(--text-primary); margin-bottom: 0.25rem;">${title}</h4>
                <p style="color: var(--text-secondary); font-size: 0.9rem;">${message}</p>
            </div>
        `;
    }

    async loadSidebarCommunities() {
        const container = document.getElementById('sidebar-communities');
        if (!container) return;
        
        // Use communities endpoint, filter by joined if logged in, otherwise show featured
        try {
            const data = await api.get('/communities');
            if (!data || data.length === 0) {
                container.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85rem;">No communities joined yet.</div>`;
                return;
            }

            container.innerHTML = data.slice(0, 4).map(c => `
                <a href="community.html?id=${c._id}" style="text-decoration: none; color: var(--text-primary); display: flex; align-items: center; gap: 0.8rem;">
                    <span style="font-size: 1.2rem; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 8px; background: var(--dark-1); color: var(--primary);">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                    </span>
                    <span style="font-weight: 600; font-size: 0.9rem;">${c.name}</span>
                </a>
            `).join('');
        } catch (e) {
            container.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85rem;">Failed to load communities</div>`;
        }
    }

    async loadLiveAuctions() {
        const container = document.getElementById('feed-live-auctions');
        if (!container) return;

        try {
            const auctions = await api.get('/auctions?status=active');
            if (!auctions || auctions.length === 0) {
                container.innerHTML = this.createEmptyState("No Live Auctions", "There are currently no active auctions taking place.");
                return;
            }

            container.innerHTML = auctions.map(item => this.renderAuctionCard(item)).join('');
        } catch (e) {
            container.innerHTML = this.createEmptyState("Error", "Could not fetch live auctions.");
        }
    }

    async loadEndingSoon() {
        const container = document.getElementById('feed-ending-auctions');
        if (!container) return;

        try {
            const auctions = await api.get('/auctions?status=active&sort=ending_soon');
            if (!auctions || auctions.length === 0) {
                container.innerHTML = this.createEmptyState("No Auctions Ending Soon", "Check back later for last-minute deals.");
                return;
            }

            container.innerHTML = auctions.slice(0, 4).map(item => this.renderAuctionCard(item)).join('');
        } catch (e) {
            container.innerHTML = this.createEmptyState("Error", "Could not fetch ending soon auctions.");
        }
    }

    async loadRecentCollections() {
        const container = document.getElementById('feed-recent-collections');
        if (!container) return;

        try {
            const collections = await api.get('/collections?sort=newest');
            if (!collections || collections.length === 0) {
                container.innerHTML = this.createEmptyState("No Recent Collections", "Our collectors are working on organizing their artifacts.");
                return;
            }

            container.innerHTML = collections.slice(0, 3).map(c => `
                <div class="glass-card" style="padding: 1rem; cursor: pointer;" onclick="window.location.href='collections.html'">
                    <h3 style="font-family: var(--font-brand); font-size: 1.1rem; margin-bottom: 0.5rem;">${c.title}</h3>
                    <p style="color: var(--text-secondary); font-size: 0.85rem; line-height: 1.4; margin-bottom: 1rem;">${c.description}</p>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">${c.items ? c.items.length : 0} items</div>
                </div>
            `).join('');
        } catch (e) {
            container.innerHTML = this.createEmptyState("Error", "Could not fetch collections.");
        }
    }

    async loadCommunityActivity() {
        const container = document.getElementById('feed-community-activity');
        if (!container) return;

        try {
            // For now, if no activity endpoint, show empty state
            container.innerHTML = this.createEmptyState("Quiet Feed", "Join communities to see activity from other collectors here.");
        } catch (e) {
            container.innerHTML = this.createEmptyState("Error", "Could not fetch community activity.");
        }
    }

    async loadTrendingCollections() {
        const container = document.getElementById('sidebar-trending-collections');
        if (!container) return;

        try {
            const collections = await api.get('/collections?sort=trending');
            if (!collections || collections.length === 0) {
                container.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 1rem 0;">No trending collections today.</div>`;
                return;
            }

            container.innerHTML = collections.slice(0, 3).map(c => `
                <div style="display: flex; gap: 1rem; align-items: center; cursor: pointer;" onclick="window.location.href='collections.html'">
                    <div style="width: 50px; height: 50px; background: var(--dark-1); border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center;">
                        <svg width="24" height="24" fill="none" stroke="var(--primary)"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
                    </div>
                    <div>
                        <div style="font-weight: 600; font-size: 0.9rem;">${c.title}</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted);">${c.items ? c.items.length : 0} items</div>
                    </div>
                </div>
            `).join('');
        } catch(e) {
            container.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85rem; text-align: center;">Could not load trending collections.</div>`;
        }
    }

    async loadFeaturedCollectors() {
        const container = document.getElementById('sidebar-featured-collectors');
        if (!container) return;

        try {
            const users = await api.get('/users?featured=true');
            if (!users || users.length === 0) {
                container.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 1rem 0;">No featured collectors to display.</div>`;
                return;
            }

            container.innerHTML = users.slice(0, 3).map(u => this.renderUserSidebarRow(u)).join('');
        } catch(e) {
            container.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85rem; text-align: center;">Could not load collectors.</div>`;
        }
    }

    async loadNewCollectors() {
        const container = document.getElementById('sidebar-new-collectors');
        if (!container) return;

        try {
            const users = await api.get('/users?sort=newest');
            if (!users || users.length === 0) {
                container.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 1rem 0;">No new collectors recently.</div>`;
                return;
            }

            // Filter out current user
            const filteredUsers = users.filter(u => u._id !== this.currentUser._id).slice(0, 3);
            container.innerHTML = filteredUsers.map(u => this.renderUserSidebarRow(u)).join('');
        } catch(e) {
            container.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85rem; text-align: center;">Could not load new collectors.</div>`;
        }
    }

    renderUserSidebarRow(user) {
        const initial = user.avatarInitials || (user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U');
        return `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 0.8rem; cursor: pointer;" onclick="window.location.href='profile.html?id=${user._id}'">
                    <div class="avatar-circle" style="width: 35px; height: 35px; font-size: 1rem; background: var(--dark-1); color: var(--primary);">${initial}</div>
                    <div style="font-weight: 600; font-size: 0.9rem;">@${user.username || 'user'}</div>
                </div>
                <button class="btn btn-outline" style="padding: 0.2rem 0.6rem; font-size: 0.75rem;" onclick="window.followUser('${user._id}')">Follow</button>
            </div>
        `;
    }

    renderAuctionCard(item) {
        const currentBid = item.currentBid || item.startingPrice || 0;
        const timeRemaining = "Ending Soon"; // Need actual calculation
        const isLive = item.auctionType === 'live' || item.status === 'active';
        
        return `
            <div class="item-card glass-card" onclick="window.location.href='item.html?id=${item._id}'" style="cursor: pointer;">
                <div class="item-image" style="height: 160px; background-image: url('${item.images && item.images.length ? item.images[0] : 'assets/placeholder.svg'}'); background-size: cover; background-position: center; border-radius: var(--radius-sm) var(--radius-sm) 0 0; position: relative;">
                    ${isLive ? '<div class="live-badge" style="position: absolute; top: 10px; left: 10px; background: #EF4444; color: white; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.7rem; font-weight: bold; animation: pulse 2s infinite;">● LIVE</div>' : ''}
                </div>
                <div class="item-info" style="padding: 1rem;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                        <h3 class="item-title" style="font-size: 1.1rem; margin: 0; line-height: 1.3;">${item.title}</h3>
                    </div>
                    <div class="item-meta" style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem;">
                        <div class="item-price" style="font-size: 1.2rem; font-weight: 700; color: var(--primary);">₹${currentBid.toLocaleString()}</div>
                        <div class="item-time" style="font-size: 0.8rem; color: var(--text-muted);">${timeRemaining}</div>
                    </div>
                </div>
            </div>
        `;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new HomeHub();
});