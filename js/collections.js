// collections.js - Museum & Collections Hub

class CollectionsApp {
    constructor() {
        this.currentUser = JSON.parse(localStorage.getItem('flexy_user') || 'null');
        this.collections = [];
        this.activeCollection = null;
        this.init();
    }

    async init() {
        window.collectionsApp = this;
        await this.loadData();
    }

    async loadData() {
        try {
            this.collections = await api.get('/collections');
            this.renderDiscover();
            this.renderMuseum();
        } catch (err) {
            console.error(err);
            notify('Failed to load collections', 'error');
            const errHtml = `<div style="grid-column: 1/-1; text-align: center; color: var(--danger); padding: 4rem;">Failed to connect to Museum database.</div>`;
            document.getElementById('discover-grid').innerHTML = errHtml;
        }
    }

    switchTab(tab) {
        document.getElementById('tab-discover').classList.remove('active');
        document.getElementById('tab-museum').classList.remove('active');
        document.getElementById('content-discover').style.display = 'none';
        document.getElementById('content-museum').style.display = 'none';

        document.getElementById(`tab-${tab}`).classList.add('active');
        
        const content = document.getElementById(`content-${tab}`);
        content.style.display = 'block';
        content.style.opacity = '0';
        setTimeout(() => content.style.opacity = '1', 50);
    }

    createEmptyState(title, message) {
        return `
            <div class="empty-state" style="grid-column: 1 / -1; padding: 4rem 1rem; text-align: center; border-radius: var(--radius-lg); border: 1px dashed var(--border-glass); background: rgba(0,0,0,0.2);">
                <div style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;">🏛️</div>
                <h4 style="font-size: 1.2rem; color: var(--text-primary); margin-bottom: 0.5rem; font-family: var(--font-brand);">${title}</h4>
                <p style="color: var(--text-secondary); font-size: 0.95rem;">${message}</p>
            </div>
        `;
    }

    renderCard(col) {
        const cover = (col.items && col.items.length > 0 && col.items[0].image) ? col.items[0].image : 'assets/placeholder.svg';
        return `
            <div class="glass-card item-card" style="padding: 0; overflow: hidden; cursor: pointer; border: 1px solid var(--border-glass);" onclick="collectionsApp.openModal('${col._id}')">
                <div style="height: 200px; background-image: url('${cover}'); background-size: cover; background-position: center;"></div>
                <div style="padding: 1.5rem;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                        <h3 style="font-family: var(--font-brand); margin: 0; font-size: 1.2rem;">${col.title}</h3>
                        <span style="color: var(--primary); font-size: 0.85rem;">🤍 ${col.likes ? col.likes.length : 0}</span>
                    </div>
                    <div style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 1rem;">
                        By @${col.owner ? col.owner.username : 'collector'}
                    </div>
                    <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                        ${col.description}
                    </p>
                </div>
            </div>
        `;
    }

    renderDiscover() {
        const grid = document.getElementById('discover-grid');
        const others = this.currentUser ? this.collections.filter(c => !c.owner || c.owner._id !== this.currentUser.id) : this.collections;
        
        if (others.length === 0) {
            grid.innerHTML = this.createEmptyState("Museum is Empty", "There are no public collections to discover right now.");
            return;
        }

        grid.innerHTML = others.map(col => this.renderCard(col)).join('');
    }

    renderMuseum() {
        const grid = document.getElementById('museum-grid');
        
        // Preserve the create button
        const createBtnHtml = `
            <div class="add-collection-btn" onclick="notify('Create Collection wizard coming soon!', 'info')">
                <span style="font-size: 2rem;">+</span>
                <span>Create Collection</span>
            </div>
        `;

        if (!this.currentUser) {
            grid.innerHTML = createBtnHtml + this.createEmptyState("Sign in to build your Museum", "Log in to document and showcase your personal collection.");
            return;
        }

        const mine = this.collections.filter(c => c.owner && c.owner._id === this.currentUser.id);
        
        if (mine.length === 0) {
            grid.innerHTML = createBtnHtml + this.createEmptyState("Your Museum is Empty", "Start building your personal showcase by creating your first collection.");
            return;
        }

        grid.innerHTML = createBtnHtml + mine.map(col => this.renderCard(col)).join('');
    }

    openModal(id) {
        this.activeCollection = this.collections.find(c => c._id === id);
        if (!this.activeCollection) return;

        const col = this.activeCollection;
        document.getElementById('modal-title').textContent = col.title;
        document.getElementById('modal-author').innerHTML = `Curated by <a href="profile.html?id=${col.owner._id}" style="color: var(--primary); text-decoration: none;">@${col.owner.username}</a>`;
        document.getElementById('modal-desc').textContent = col.description;
        document.getElementById('modal-likes-count').textContent = col.likes ? col.likes.length : 0;
        
        const coverEl = document.getElementById('modal-cover');
        const coverImg = (col.items && col.items.length > 0 && col.items[0].image) ? col.items[0].image : 'assets/placeholder.svg';
        coverEl.style.backgroundImage = `url('${coverImg}')`;

        const isLiked = this.currentUser && col.likes && col.likes.includes(this.currentUser.id);
        const likeBtn = document.getElementById('modal-like-btn');
        likeBtn.className = `btn ${isLiked ? 'btn-primary' : 'btn-outline'}`;
        likeBtn.onclick = () => this.toggleLike(col._id);

        const itemsGrid = document.getElementById('modal-items-grid');
        if (!col.items || col.items.length === 0) {
            itemsGrid.innerHTML = `<div style="grid-column: 1/-1; color: var(--text-muted);">No specific items exhibited in this collection yet.</div>`;
        } else {
            itemsGrid.innerHTML = col.items.map(item => `
                <div style="background: var(--dark-1); border: 1px solid var(--border-glass); border-radius: var(--radius-sm); overflow: hidden; cursor: pointer;" onclick="window.location.href='item.html?id=${item.item}'">
                    <div style="height: 120px; background-image: url('${item.image || 'assets/placeholder.svg'}'); background-size: cover; background-position: center;"></div>
                    <div style="padding: 0.75rem; text-align: center; font-size: 0.85rem; color: var(--text-primary); font-weight: 500;">
                        ${item.title || 'Item'}
                    </div>
                </div>
            `).join('');
        }

        document.getElementById('collection-modal').style.display = 'flex';
    }

    closeModal() {
        document.getElementById('collection-modal').style.display = 'none';
        this.activeCollection = null;
    }

    async toggleLike(id) {
        if (!this.currentUser) {
            notify('Please login to like collections', 'warning');
            return;
        }
        try {
            const res = await api.post(`/collections/${id}/like`);
            notify(res.message, 'success');
            await this.loadData(); // reload
            if (this.activeCollection && this.activeCollection._id === id) {
                this.openModal(id); // refresh modal
            }
        } catch (err) {
            notify(err.message, 'error');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new CollectionsApp();
});
