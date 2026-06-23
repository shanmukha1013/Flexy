// community.js - Single Community Logic

class CommunityPage {
    constructor() {
        this.currentUser = JSON.parse(localStorage.getItem('flexy_user') || 'null');
        this.communityId = new URLSearchParams(window.location.search).get('id');
        this.community = null;
        this.init();
    }

    async init() {
        if (!this.communityId) {
            notify('No community ID provided.', 'error');
            document.getElementById('loading-state').textContent = 'Community not found.';
            return;
        }

        try {
            this.community = await api.get(`/communities/${this.communityId}`);
            
            document.getElementById('loading-state').style.display = 'none';
            document.getElementById('community-page-container').style.display = 'block';
            
            this.renderDetails();
            this.setupActions();

            // Set up global helpers
            window.createGroup = () => {
                if (!this.checkAuth()) return;
                document.getElementById('create-group-modal').style.display = 'block';
            };
            
            window.submitPost = this.submitPost.bind(this);
            
            this.setupCreateGroupForm();

        } catch (err) {
            console.error(err);
            notify('Failed to load community details', 'error');
            document.getElementById('loading-state').textContent = 'Error loading community.';
        }
    }

    checkAuth() {
        if (!this.currentUser) {
            notify('Please login first', 'warning');
            window.location.href = 'login.html';
            return false;
        }
        return true;
    }

    renderDetails() {
        if (!this.community) return;

        document.title = `${this.community.name} | FLEXY Collectors`;
        document.getElementById('community-icon').textContent = this.community.icon || '🏛️';
        document.getElementById('community-title').textContent = this.community.name;
        document.getElementById('community-desc').textContent = this.community.description || 'No description provided.';
        
        // Count members
        const members = this.community.members || [];
        document.getElementById('member-count').textContent = members.length;

        // Render Members avatars (max 10)
        const membersList = document.getElementById('community-members-list');
        if (members.length === 0) {
            membersList.innerHTML = '<span style="color: var(--text-muted); font-size: 0.8rem;">No members yet.</span>';
        } else {
            // For now, if members is just array of strings (IDs), we show generic avatars.
            // A real app would populate members from the DB.
            membersList.innerHTML = members.slice(0, 10).map((m, i) => `
                <div class="member-badge" title="Member">
                    ${String.fromCharCode(65 + (i % 26))}
                </div>
            `).join('');
            if (members.length > 10) {
                membersList.innerHTML += `<div class="member-badge" style="background: var(--dark-3);">+${members.length - 10}</div>`;
            }
        }

        // Setup Join Btn
        this.updateJoinBtn();

        // Render Groups
        this.renderGroups();

        // Render Feed
        this.renderFeed();
    }

    updateJoinBtn() {
        const btn = document.getElementById('community-join-btn');
        const postArea = document.getElementById('post-input-area');
        
        if (!this.currentUser) {
            btn.textContent = 'Sign in to Join';
            btn.onclick = () => window.location.href = 'login.html';
            return;
        }

        const isMember = this.community.members && this.community.members.includes(this.currentUser.id);
        if (isMember) {
            btn.textContent = 'Leave Community';
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-outline');
            btn.onclick = () => this.toggleJoin();
            postArea.style.display = 'block'; // Can post if member
        } else {
            btn.textContent = 'Join Community';
            btn.classList.add('btn-primary');
            btn.classList.remove('btn-outline');
            btn.onclick = () => this.toggleJoin();
            postArea.style.display = 'none'; // Cannot post if not member
        }
    }

    async toggleJoin() {
        if (!this.checkAuth()) return;
        
        const isMember = this.community.members && this.community.members.includes(this.currentUser.id);
        const endpoint = isMember ? 'leave' : 'join';
        
        try {
            const res = await api.post(`/communities/${this.communityId}/${endpoint}`);
            this.community = res.community; // Assume backend returns updated doc
            this.renderDetails();
            notify(`Successfully ${isMember ? 'left' : 'joined'} community.`, 'success');
        } catch (err) {
            notify(err.message || 'Action failed', 'error');
        }
    }

    renderGroups() {
        const list = document.getElementById('community-groups-list');
        const groups = this.community.groups || [];

        if (groups.length === 0) {
            list.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--text-muted); font-size: 0.9rem; border: 1px dashed var(--border-glass); border-radius: var(--radius-sm);">
                    No sub-groups yet. Create one to organize discussions!
                </div>
            `;
            return;
        }

        list.innerHTML = groups.map(g => {
            const isMember = g.members && this.currentUser && g.members.some(m => 
                (typeof m === 'string' ? m : m._id) === this.currentUser.id
            );
            
            return `
            <div class="group-card" style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h4 style="margin: 0 0 0.25rem 0; font-family: var(--font-brand); color: var(--text-primary);">${g.name}</h4>
                    <p style="margin: 0 0 0.5rem 0; font-size: 0.85rem; color: var(--text-secondary);">${g.description}</p>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">
                        ${(g.members || []).length} Members
                    </div>
                </div>
                <div>
                    <button class="btn ${isMember ? 'btn-outline' : 'btn-primary'}" style="padding: 0.3rem 0.8rem; font-size: 0.8rem; border-radius: var(--radius-sm);" onclick="window.communityApp.toggleGroupJoin('${g._id}', ${isMember})">
                        ${isMember ? 'Joined ✓' : 'Join Group'}
                    </button>
                </div>
            </div>
        `}).join('');
    }

    async toggleGroupJoin(groupId, isMember) {
        if (!this.checkAuth()) return;
        const endpoint = isMember ? 'leave' : 'join';
        try {
            await api.post(`/groups/${groupId}/${endpoint}`);
            notify(`Successfully ${isMember ? 'left' : 'joined'} group.`, 'success');
            // Refresh community to update members
            this.community = await api.get(`/communities/${this.communityId}`);
            this.renderSidebar();
            this.renderGroups();
        } catch (err) {
            notify(err.message || 'Action failed', 'error');
        }
    }

    setupCreateGroupForm() {
        const form = document.getElementById('create-group-form');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!this.checkAuth()) return;

            const name = document.getElementById('new-group-name').value;
            const desc = document.getElementById('new-group-desc').value;

            try {
                // Assuming backend route /communities/:id/groups exists
                const res = await api.post(`/communities/${this.communityId}/groups`, {
                    name,
                    description: desc
                });
                
                notify('Group created successfully!', 'success');
                document.getElementById('create-group-modal').style.display = 'none';
                
                // Refresh community
                this.community = await api.get(`/communities/${this.communityId}`);
                this.renderDetails();
            } catch(err) {
                console.error(err);
                notify(err.message || 'Failed to create group', 'error');
            }
        });
    }

    renderFeed() {
        const feed = document.getElementById('community-feed');
        const posts = this.community.posts || [];

        if (posts.length === 0) {
            feed.innerHTML = `
                <div style="text-align: center; padding: 3rem; color: var(--text-muted); border: 1px dashed var(--border-glass); border-radius: var(--radius-lg);">
                    <div style="font-size: 2rem; margin-bottom: 0.5rem;">📝</div>
                    <div>No activity yet.</div>
                </div>
            `;
            return;
        }

        // Sort posts newest first
        const sorted = [...posts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        feed.innerHTML = sorted.map(post => {
            const author = post.author || {};
            const initial = author.avatarInitials || (author.displayName ? author.displayName.charAt(0).toUpperCase() : 'U');
            const authorName = author.displayName || author.username || 'Unknown';
            
            return `
                <div style="padding: 1.5rem; border-bottom: 1px solid var(--border-subtle);">
                    <div style="display: flex; align-items: flex-start; gap: 1rem;">
                        <div style="width: 40px; height: 40px; border-radius: 50%; background: var(--dark-1); display: flex; align-items: center; justify-content: center; font-weight: bold; border: 1px solid var(--border-glass);">
                            ${initial}
                        </div>
                        <div style="flex: 1;">
                            <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.5rem;">
                                <div style="font-weight: 600;">${authorName}</div>
                                <div style="font-size: 0.75rem; color: var(--text-muted);">${new Date(post.createdAt || Date.now()).toLocaleDateString()}</div>
                            </div>
                            <p style="color: var(--text-secondary); line-height: 1.5; margin: 0; white-space: pre-wrap;">${this.escapeHtml(post.content || '')}</p>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    async submitPost() {
        if (!this.checkAuth()) return;
        
        const input = document.getElementById('new-post-content');
        const content = input.value.trim();
        
        if (!content) return;

        try {
            // Post to community feed
            await api.post(`/communities/${this.communityId}/posts`, { content });
            input.value = '';
            notify('Posted successfully', 'success');
            
            // Refresh
            this.community = await api.get(`/communities/${this.communityId}`);
            this.renderDetails();
        } catch (err) {
            notify(err.message || 'Failed to post', 'error');
        }
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
    new CommunityPage();
});
