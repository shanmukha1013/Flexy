// communities.js - Communities Main Logic

class CommunitiesPage {
    constructor() {
        this.currentUser = JSON.parse(localStorage.getItem('flexy_user') || 'null');
        this.allCommunities = [];
        this.init();
    }

    async init() {
        try {
            this.allCommunities = await api.get('/communities');
            this.renderSections();
            this.setupSearch();
            this.setupCreateForm();
        } catch (err) {
            console.error("Error loading communities", err);
            notify('Failed to load communities', 'error');
            this.renderFeed('featured-communities-feed', [], 'Failed to load');
        }

        window.createCommunity = () => {
            if (!this.currentUser) {
                notify('Please login to create a community', 'warning');
                return;
            }
            document.getElementById('create-community-modal').style.display = 'block';
        };
    }

    renderSections() {
        let myComms = [];
        let featuredComms = [];
        let suggestedComms = [];

        if (this.currentUser) {
            myComms = this.allCommunities.filter(c => c.members && c.members.includes(this.currentUser.id));
            if (myComms.length > 0) {
                document.getElementById('my-communities-section').style.display = 'block';
                this.renderFeed('my-communities-feed', myComms, 'No communities joined.');
            }
        }

        // Just an arbitrary split for demo purposes since backend doesn't flag "featured" natively yet
        // In real app, rely on backend flags.
        featuredComms = this.allCommunities.slice(0, 3);
        suggestedComms = this.allCommunities.slice(3, 8);

        this.renderFeed('featured-communities-feed', featuredComms, 'No featured communities yet.');
        this.renderFeed('suggested-communities-feed', suggestedComms, 'No suggestions right now.');
    }

    renderFeed(containerId, items, emptyMessage) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (!items || items.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1; padding: 4rem 2rem; text-align: center; border: 1px solid var(--border-glass); border-radius: var(--radius-lg); background: var(--dark-2);">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" style="margin-bottom: 1rem; opacity: 0.5;">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="var(--text-muted)" stroke-width="2"/>
                        <circle cx="9" cy="7" r="4" stroke="var(--text-muted)" stroke-width="2"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke="var(--text-muted)" stroke-width="2"/>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="var(--text-muted)" stroke-width="2"/>
                    </svg>
                    <h4 style="font-size: 1.1rem; color: var(--text-primary); margin-bottom: 0.25rem;">Empty</h4>
                    <p style="color: var(--text-secondary); font-size: 0.9rem;">${emptyMessage}</p>
                </div>
            `;
            return;
        }

        container.innerHTML = items.map(item => {
            const memberCount = item.members ? item.members.length : 0;
            const isMember = this.currentUser && item.members && item.members.includes(this.currentUser.id);
            const icon = item.icon || '🏛️';

            return `
                <div class="community-card" onclick="window.location.href='community.html?id=${item._id}'">
                    <div class="community-icon-box">${icon}</div>
                    <h4 style="font-size: 1.2rem; margin: 0 0 0.5rem 0; font-family: var(--font-brand);">${item.name}</h4>
                    <p style="color: var(--text-secondary); font-size: 0.85rem; line-height: 1.4; margin-bottom: 1.5rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${item.description || 'A community for collectors.'}</p>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-subtle); padding-top: 1rem;">
                        <div style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">
                            ${memberCount} Member${memberCount !== 1 ? 's' : ''}
                        </div>
                        ${isMember 
                            ? `<span style="font-size: 0.75rem; background: var(--primary-glow); color: var(--primary); padding: 0.2rem 0.6rem; border-radius: 10px; font-weight: bold;">Joined</span>`
                            : `<span style="font-size: 0.75rem; border: 1px solid var(--border-glass); padding: 0.2rem 0.6rem; border-radius: 10px; color: var(--text-secondary);">View</span>`
                        }
                    </div>
                </div>
            `;
        }).join('');
    }

    setupSearch() {
        const searchInput = document.getElementById('community-search');
        if (!searchInput) return;

        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            if (!query) {
                this.renderSections();
                return;
            }

            const results = this.allCommunities.filter(c => 
                (c.name && c.name.toLowerCase().includes(query)) || 
                (c.description && c.description.toLowerCase().includes(query))
            );

            document.getElementById('my-communities-section').style.display = 'none';
            document.getElementById('featured-communities-feed').parentElement.querySelector('h3').innerHTML = `🔍 Search Results (${results.length})`;
            this.renderFeed('featured-communities-feed', results, 'No communities found matching your search.');
            document.getElementById('suggested-communities-feed').parentElement.style.display = 'none';
        });
    }

    setupCreateForm() {
        const form = document.getElementById('create-community-form');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('new-comm-name').value;
            const desc = document.getElementById('new-comm-desc').value;
            const icon = document.getElementById('new-comm-icon').value || '🏛️';

            try {
                const newComm = await api.post('/communities', {
                    name,
                    description: desc,
                    icon
                });
                
                notify('Community created successfully!', 'success');
                document.getElementById('create-community-modal').style.display = 'none';
                
                // Refresh list
                this.allCommunities = await api.get('/communities');
                this.renderSections();
            } catch(err) {
                console.error(err);
                notify(err.message || 'Failed to create community', 'error');
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new CommunitiesPage();
});
