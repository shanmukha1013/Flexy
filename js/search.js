// search.js - Global Search Implementation

class GlobalSearch {
    constructor() {
        this.currentScope = 'auctions';
        this.init();
    }

    init() {
        this.setupEventListeners();
        
        // Auto-search if coming from another page
        const queryParam = new URLSearchParams(window.location.search).get('q');
        if (queryParam) {
            document.getElementById('global-search-input').value = queryParam;
            this.performSearch();
        } else {
            this.performSearch(); // Initial load
        }
    }

    setupEventListeners() {
        const input = document.getElementById('global-search-input');
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.performSearch();
            });
        }

        document.querySelectorAll('input[name="scope"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.currentScope = e.target.value;
                this.performSearch();
            });
        });

        document.getElementById('filter-category').addEventListener('change', () => {
            this.performSearch();
        });
    }

    clearFilters() {
        document.getElementById('global-search-input').value = '';
        document.getElementById('filter-category').value = 'all';
        document.querySelector('input[name="scope"][value="auctions"]').checked = true;
        this.currentScope = 'auctions';
        this.performSearch();
    }

    async performSearch() {
        const grid = document.getElementById('results-grid');
        const count = document.getElementById('results-count');
        const loader = document.getElementById('loading-state');
        
        const query = (document.getElementById('global-search-input').value || '').toLowerCase().trim();
        const category = document.getElementById('filter-category').value;

        grid.innerHTML = '';
        count.textContent = '(...)';
        loader.style.display = 'block';

        try {
            let endpoint = '';
            if (this.currentScope === 'auctions') endpoint = '/auctions?status=active';
            else if (this.currentScope === 'collections') endpoint = '/collections';
            else if (this.currentScope === 'communities') endpoint = '/communities';

            let data = await api.get(endpoint);

            // Client-side filtering (Backend can also handle this, but keeping it robust here)
            if (query) {
                data = data.filter(item => {
                    const titleMatch = (item.title || item.name || '').toLowerCase().includes(query);
                    const descMatch = (item.description || '').toLowerCase().includes(query);
                    return titleMatch || descMatch;
                });
            }

            if (category !== 'all' && this.currentScope !== 'communities') {
                data = data.filter(item => item.category === category);
            }

            loader.style.display = 'none';
            count.textContent = `(${data.length})`;

            this.renderResults(data);

        } catch (err) {
            console.error(err);
            loader.style.display = 'none';
            count.textContent = '(0)';
            grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--danger);">Failed to search: ${err.message}</div>`;
        }
    }

    renderResults(items) {
        const grid = document.getElementById('results-grid');
        
        if (!items || items.length === 0) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1; padding: 4rem 2rem; text-align: center; border: 1px solid var(--border-glass); border-radius: var(--radius-lg); background: var(--dark-2);">
                    <div style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;">🔍</div>
                    <h4 style="font-size: 1.1rem; color: var(--text-primary); margin-bottom: 0.25rem;">No Results Found</h4>
                    <p style="color: var(--text-secondary); font-size: 0.9rem;">Try adjusting your search terms or filters.</p>
                </div>
            `;
            return;
        }

        if (this.currentScope === 'auctions') {
            grid.innerHTML = items.map(item => this.renderAuctionCard(item)).join('');
        } else if (this.currentScope === 'collections') {
            grid.innerHTML = items.map(item => this.renderCollectionCard(item)).join('');
        } else if (this.currentScope === 'communities') {
            grid.innerHTML = items.map(item => this.renderCommunityCard(item)).join('');
        }
    }

    renderAuctionCard(item) {
        const currentBid = item.currentBid || item.startingBid || 0;
        return `
            <div class="glass-card item-card" onclick="window.location.href='item.html?id=${item._id}'" style="cursor: pointer; padding: 0; overflow: hidden; border: 1px solid var(--border-glass);">
                <div style="height: 180px; background-image: url('${item.images && item.images.length ? item.images[0] : 'assets/placeholder.svg'}'); background-size: cover; background-position: center; position: relative;">
                    <div class="live-badge" style="position: absolute; top: 10px; left: 10px; background: #EF4444; color: white; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.7rem; font-weight: bold; animation: pulse 2s infinite;">● LIVE</div>
                </div>
                <div style="padding: 1rem;">
                    <h3 style="font-size: 1.1rem; margin: 0 0 0.5rem 0; font-family: var(--font-brand);">${item.title}</h3>
                    <div style="font-size: 1.2rem; font-weight: 700; color: var(--primary);">₹${currentBid.toLocaleString()}</div>
                </div>
            </div>
        `;
    }

    renderCollectionCard(item) {
        const coverImage = (item.items && item.items.length > 0 && item.items[0].image) 
                ? item.items[0].image 
                : 'assets/placeholder.svg';
        return `
            <div class="glass-card item-card" onclick="window.location.href='collections.html'" style="cursor: pointer; padding: 0; overflow: hidden; border: 1px solid var(--border-glass);">
                <div style="height: 180px; background-image: url('${coverImage}'); background-size: cover; background-position: center;"></div>
                <div style="padding: 1rem;">
                    <h3 style="font-size: 1.1rem; margin: 0 0 0.5rem 0; font-family: var(--font-brand);">${item.title}</h3>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">${item.items ? item.items.length : 0} Items</div>
                </div>
            </div>
        `;
    }

    renderCommunityCard(item) {
        return `
            <div class="glass-card item-card" onclick="window.location.href='community.html?id=${item._id}'" style="cursor: pointer; padding: 1.5rem; border: 1px solid var(--border-glass);">
                <div style="font-size: 2rem; margin-bottom: 0.5rem;">${item.icon || '🏛️'}</div>
                <h3 style="font-size: 1.1rem; margin: 0 0 0.5rem 0; font-family: var(--font-brand);">${item.name}</h3>
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">${item.description}</p>
                <div style="font-size: 0.8rem; color: var(--text-muted);">${item.members ? item.members.length : 0} Members</div>
            </div>
        `;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new GlobalSearch();
});