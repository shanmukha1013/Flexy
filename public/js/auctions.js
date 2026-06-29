// auctions.js - Auctions Page Logic

class AuctionsFeed {
    constructor() {
        this.currentUser = JSON.parse(localStorage.getItem('flexy_user') || 'null');
        this.init();
    }

    async init() {
        try {
            const auctions = await api.get('/auctions?status=active');
            
            // Watchlist
            if (this.currentUser && this.currentUser.savedAuctions && this.currentUser.savedAuctions.length > 0) {
                document.getElementById('watchlist-section').style.display = 'block';
                const watched = auctions.filter(a => this.currentUser.savedAuctions.includes(a._id));
                this.renderFeed('watchlist-feed', watched, 'No watched auctions active.');
            }

            // Ending Soon
            const endingSoon = [...auctions].sort((a, b) => new Date(a.endTime) - new Date(b.endTime)).slice(0, 4);
            this.renderFeed('ending-soon-feed', endingSoon, 'No auctions ending soon.');

            // All Active
            this.renderFeed('all-auctions-feed', auctions, 'No active auctions available right now.');

        } catch (err) {
            console.error("Error loading auctions", err);
            notify('Failed to load auctions', 'error');
            this.renderFeed('ending-soon-feed', [], 'Failed to load');
            this.renderFeed('all-auctions-feed', [], 'Failed to load');
        }
    }

    renderFeed(containerId, items, emptyMessage) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (!items || items.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1; padding: 4rem 2rem; text-align: center; border: 1px solid var(--border-glass); border-radius: var(--radius-lg); background: var(--dark-2);">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" style="margin-bottom: 1rem; opacity: 0.5;">
                        <circle cx="12" cy="12" r="10" stroke="var(--text-muted)" stroke-width="2"/>
                        <path d="M12 6v6l4 2" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    <h4 style="font-size: 1.1rem; color: var(--text-primary); margin-bottom: 0.25rem;">Empty</h4>
                    <p style="color: var(--text-secondary); font-size: 0.9rem;">${emptyMessage}</p>
                </div>
            `;
            return;
        }

        container.innerHTML = items.map(item => {
            const currentBid = item.currentBid || item.startingBid || 0;
            const endDate = new Date(item.endTime);
            const remaining = endDate - new Date();
            let timeStr = 'Ended';
            
            if (remaining > 0) {
                const hours = Math.floor(remaining / (1000 * 60 * 60));
                if (hours > 24) {
                    timeStr = `${Math.floor(hours / 24)}d left`;
                } else {
                    timeStr = `${hours}h left`;
                }
            }
            
            return `
                <div class="item-card glass-card" onclick="window.location.href='item.html?id=${item._id}'" style="cursor: pointer;">
                    <div class="item-image" style="height: 200px; background-image: url('${item.images && item.images.length ? item.images[0] : 'assets/placeholder.svg'}'); background-size: cover; background-position: center; border-radius: var(--radius-sm) var(--radius-sm) 0 0; position: relative;">
                        <div class="live-badge" style="position: absolute; top: 10px; left: 10px; background: #EF4444; color: white; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.7rem; font-weight: bold; animation: pulse 2s infinite;">● LIVE</div>
                    </div>
                    <div class="item-info" style="padding: 1rem;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                            <h3 class="item-title" style="font-size: 1.1rem; margin: 0; line-height: 1.3;">${item.title}</h3>
                        </div>
                        <div class="item-meta" style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem;">
                            <div class="item-price" style="font-size: 1.2rem; font-weight: 700; color: var(--primary);">₹${currentBid.toLocaleString()}</div>
                            <div class="item-time" style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">${timeStr}</div>
                        </div>
                        <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-subtle); display: flex; align-items: center; gap: 0.5rem;">
                            <div style="width: 24px; height: 24px; border-radius: 50%; background: var(--dark-1); display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: bold;">
                                ${(item.seller?.displayName || item.seller?.username || 'U')[0].toUpperCase()}
                            </div>
                            <div style="font-size: 0.8rem; color: var(--text-secondary);">@${item.seller?.username || 'unknown'}</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new AuctionsFeed();
});
