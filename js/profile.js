// profile.js - Universal Profile Page

class ProfileApp {
    constructor() {
        this.currentUser = JSON.parse(localStorage.getItem('flexy_user') || 'null');
        this.targetUserId = new URLSearchParams(window.location.search).get('id');
        this.isMyProfile = !this.targetUserId || (this.currentUser && this.targetUserId === this.currentUser.id);
        this.profileData = null;
        
        this.init();
    }

    async init() {
        try {
            if (this.isMyProfile && !this.currentUser) {
                window.location.href = 'login.html';
                return;
            }

            const idToFetch = this.isMyProfile ? (this.currentUser.id || this.currentUser._id) : this.targetUserId;
            this.profileData = await api.get(`/users/${idToFetch}`);

            document.getElementById('loading-state').style.display = 'none';
            document.getElementById('profile-container').style.display = 'block';

            this.renderHeader();
            this.setupEditForm();
            this.loadTabs();

        } catch (err) {
            console.error(err);
            document.getElementById('loading-state').innerHTML = `<div style="color: var(--danger);">Failed to load profile.</div>`;
            notify('Failed to load profile', 'error');
        }

        // Global scope
        window.profileApp = this;
    }

    renderHeader() {
        document.title = `${this.profileData.displayName || this.profileData.username} | FLEXY`;
        
        document.getElementById('profile-name').textContent = this.profileData.displayName || this.profileData.username;
        document.getElementById('profile-username').textContent = `@${this.profileData.username}`;
        document.getElementById('profile-bio').textContent = this.profileData.bio || 'No bio provided.';
        
        const avatarEl = document.getElementById('profile-avatar');
        if (this.profileData.avatarUrl || this.profileData.profilePhoto) {
            avatarEl.style.backgroundImage = `url('${this.profileData.avatarUrl || this.profileData.profilePhoto}')`;
            avatarEl.textContent = '';
        } else {
            avatarEl.textContent = this.profileData.avatarInitials || (this.profileData.displayName || this.profileData.username)[0].toUpperCase();
            avatarEl.style.backgroundImage = 'none';
        }

        const followers = this.profileData.followers || [];
        const following = this.profileData.following || [];
        document.getElementById('stat-followers').textContent = followers.length;
        document.getElementById('stat-following').textContent = following.length;

        const actionsContainer = document.getElementById('profile-actions-container');
        if (this.isMyProfile) {
            actionsContainer.innerHTML = `
                <button class="btn btn-outline" style="border-radius: var(--radius-full); padding: 0.4rem 1.5rem;" onclick="document.getElementById('edit-profile-modal').style.display='block'">Edit Profile</button>
                <button class="btn btn-outline" style="border-radius: var(--radius-full); padding: 0.4rem 1.5rem; border-color: var(--danger); color: var(--danger);" onclick="auth.logout()">Logout</button>
            `;
        } else {
            const isFollowing = this.currentUser && followers.some(f => 
                (typeof f === 'string' ? f : f._id) === this.currentUser.id
            );

            actionsContainer.innerHTML = `
                <button class="btn ${isFollowing ? 'btn-outline' : 'btn-primary'}" id="follow-btn" style="border-radius: var(--radius-full); padding: 0.4rem 1.5rem;" onclick="profileApp.toggleFollow()">
                    ${isFollowing ? 'Following' : 'Follow'}
                </button>
                <button class="btn btn-outline" style="border-radius: var(--radius-full); padding: 0.4rem 1.5rem;" onclick="window.location.href='messages.html?user=${this.profileData._id}'">Message</button>
            `;
        }
    }

    async toggleFollow() {
        if (!this.currentUser) {
            notify('Login required', 'warning');
            return;
        }
        try {
            const followers = this.profileData.followers || [];
            const isFollowing = followers.some(f => (typeof f === 'string' ? f : f._id) === this.currentUser.id);
            const endpoint = isFollowing ? 'unfollow' : 'follow';
            
            await api.post(`/users/${this.profileData._id}/${endpoint}`);
            notify(isFollowing ? 'Unfollowed' : 'Following', 'success');
            
            // Reload profile data to update counts
            this.profileData = await api.get(`/users/${this.profileData._id}`);
            this.renderHeader();
            
        } catch (err) {
            notify(err.message, 'error');
        }
    }

    setupEditForm() {
        if (!this.isMyProfile) return;

        const form = document.getElementById('edit-profile-form');
        document.getElementById('edit-display-name').value = this.profileData.displayName || '';
        document.getElementById('edit-username').value = this.profileData.username || '';
        document.getElementById('edit-bio').value = this.profileData.bio || '';

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                displayName: document.getElementById('edit-display-name').value,
                username: document.getElementById('edit-username').value,
                bio: document.getElementById('edit-bio').value,
            };
            
            try {
                const res = await api.put(`/users/${this.currentUser.id}`, data);
                notify('Profile updated!', 'success');
                
                // Update local storage user just in case
                this.currentUser.displayName = res.user.displayName;
                this.currentUser.username = res.user.username;
                localStorage.setItem('flexy_user', JSON.stringify(this.currentUser));
                
                document.getElementById('edit-profile-modal').style.display = 'none';
                this.profileData = await api.get(`/users/${this.currentUser.id}`);
                this.renderHeader();
            } catch (err) {
                notify(err.message, 'error');
            }
        });
    }

    switchTab(tab) {
        ['museum', 'auctions', 'communities', 'groups'].forEach(t => {
            document.getElementById(`tab-${t}`).classList.remove('active');
            document.getElementById(`content-${t}`).style.display = 'none';
        });

        document.getElementById(`tab-${tab}`).classList.add('active');
        
        const contentGrid = document.getElementById(`content-${tab}`);
        contentGrid.style.display = 'grid';
        contentGrid.style.opacity = '0';
        setTimeout(() => contentGrid.style.opacity = '1', 50);
    }

    async loadTabs() {
        // Load Museum
        const museumGrid = document.getElementById('content-museum');
        try {
            const collections = await api.get('/collections');
            const myCollections = collections.filter(c => c.owner && c.owner._id === this.profileData._id);
            
            if (myCollections.length === 0) {
                museumGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 3rem;">No collections in museum yet.</div>`;
            } else {
                museumGrid.innerHTML = myCollections.map(item => {
                    const coverImage = (item.items && item.items.length > 0 && item.items[0].image) ? item.items[0].image : 'assets/placeholder.svg';
                    return `
                        <div class="glass-card item-card" style="padding: 0; overflow: hidden; border: 1px solid var(--border-glass);">
                            <div style="height: 180px; background-image: url('${coverImage}'); background-size: cover; background-position: center;"></div>
                            <div style="padding: 1rem;">
                                <h3 style="font-size: 1.1rem; margin: 0 0 0.5rem 0; font-family: var(--font-brand);">${item.title}</h3>
                                <div style="font-size: 0.8rem; color: var(--text-muted);">${item.items ? item.items.length : 0} Items</div>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        } catch (e) {
            museumGrid.innerHTML = `<div style="grid-column: 1/-1; color: var(--danger);">Failed to load museum.</div>`;
        }

        // Load Auctions
        const auctionsGrid = document.getElementById('content-auctions');
        try {
            const auctions = await api.get('/auctions'); // Or a specific user auctions endpoint if available
            const myAuctions = auctions.filter(a => a.seller && a.seller._id === this.profileData._id);
            
            if (myAuctions.length === 0) {
                auctionsGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 3rem;">No active auctions.</div>`;
            } else {
                auctionsGrid.innerHTML = myAuctions.map(item => {
                    const currentBid = item.currentBid || item.startingBid || 0;
                    return `
                        <div class="glass-card item-card" onclick="window.location.href='item.html?id=${item._id}'" style="cursor: pointer; padding: 0; overflow: hidden; border: 1px solid var(--border-glass);">
                            <div style="height: 180px; background-image: url('${item.images && item.images.length ? item.images[0] : 'assets/placeholder.svg'}'); background-size: cover; background-position: center;"></div>
                            <div style="padding: 1rem;">
                                <h3 style="font-size: 1.1rem; margin: 0 0 0.5rem 0; font-family: var(--font-brand);">${item.title}</h3>
                                <div style="font-size: 1.2rem; font-weight: 700; color: var(--primary);">₹${currentBid.toLocaleString()}</div>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        } catch (e) {
            auctionsGrid.innerHTML = `<div style="grid-column: 1/-1; color: var(--danger);">Failed to load auctions.</div>`;
        }

        // Load Communities
        const communitiesGrid = document.getElementById('content-communities');
        try {
            const communities = await api.get('/communities');
            const myCommunities = communities.filter(c => c.members && c.members.some(m => (typeof m === 'string' ? m : m._id) === this.profileData._id));
            
            if (myCommunities.length === 0) {
                communitiesGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 3rem;">Not joined any communities.</div>`;
            } else {
                communitiesGrid.innerHTML = myCommunities.map(c => `
                    <div class="glass-card item-card" onclick="window.location.href='community.html?id=${c._id}'" style="cursor: pointer; display: flex; align-items: center; gap: 1rem;">
                        <div style="font-size: 2.5rem; background: var(--dark-1); border-radius: 50%; width: 60px; height: 60px; display: flex; align-items: center; justify-content: center;">${c.icon || '🏛️'}</div>
                        <div>
                            <h3 style="margin: 0 0 0.2rem 0; font-family: var(--font-brand);">${c.name}</h3>
                            <div style="font-size: 0.8rem; color: var(--text-muted);">${(c.members || []).length} Members</div>
                        </div>
                    </div>
                `).join('');
            }
        } catch (e) {
            communitiesGrid.innerHTML = `<div style="grid-column: 1/-1; color: var(--danger);">Failed to load communities.</div>`;
        }

        // Load Groups
        const groupsGrid = document.getElementById('content-groups');
        try {
            const groups = await api.get(`/groups/user/${this.profileData._id}`);
            
            if (!groups || groups.length === 0) {
                groupsGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 3rem;">Not joined any groups.</div>`;
            } else {
                groupsGrid.innerHTML = groups.map(g => `
                    <div class="glass-card item-card" style="padding: 1.5rem; border-left: 3px solid var(--primary);">
                        <h3 style="margin: 0 0 0.5rem 0; font-family: var(--font-brand);">${g.name}</h3>
                        <p style="margin: 0 0 1rem 0; font-size: 0.85rem; color: var(--text-secondary);">${g.description}</p>
                        <div style="font-size: 0.8rem; color: var(--text-muted); display: flex; justify-content: space-between;">
                            <span>${(g.members || []).length} Members</span>
                            ${g.community && g.community.name ? `<span>in ${g.community.name}</span>` : ''}
                        </div>
                    </div>
                `).join('');
            }
        } catch (e) {
            groupsGrid.innerHTML = `<div style="grid-column: 1/-1; color: var(--danger);">Failed to load groups.</div>`;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ProfileApp();
});