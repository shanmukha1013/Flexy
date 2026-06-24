// community.js - Single Community Logic

class CommunityPage {
    constructor() {
        const u = localStorage.getItem('flexy_user');
        this.currentUser = u ? JSON.parse(u) : null;
        this.communityId = new URLSearchParams(window.location.search).get('id');
        this.community = null;
        this.groups = [];
        this.init();
    }

    async init() {
        if (!this.communityId) {
            notify('No community ID provided.', 'error');
            document.getElementById('loading-state').textContent = 'Community not found.';
            return;
        }

        try {
            // Fetch community and groups concurrently
            const [commRes, groupsRes] = await Promise.all([
                api.get(`/communities/${this.communityId}`),
                api.get(`/communities/${this.communityId}/groups`)
            ]);
            
            this.community = commRes;
            this.groups = groupsRes || [];
            
            document.getElementById('loading-state').style.display = 'none';
            document.getElementById('community-page-container').style.display = 'block';
            
            this.renderDetails();

            window.createGroup = () => {
                if (!this.checkAuth()) return;
                window.location.href = `create-group.html?communityId=${this.communityId}`;
            };

            window.linkExistingGroup = async () => {
                if (!this.checkAuth()) return;
                try {
                    const myGroups = await api.get(`/groups/user/${this.currentUser.id || this.currentUser._id}`);
                    const standaloneGroups = myGroups.filter(g => !g.community);
                    
                    const listContainer = document.getElementById('link-group-list');
                    if (standaloneGroups.length === 0) {
                        listContainer.innerHTML = '<p style="color: var(--text-muted);">You don\'t have any standalone groups to link.</p>';
                    } else {
                        listContainer.innerHTML = standaloneGroups.map(g => `
                            <div style="padding: 0.8rem; border: 1px solid var(--border-glass); border-radius: var(--radius-sm); margin-bottom: 0.5rem; display: flex; align-items: center; gap: 1rem;">
                                <input type="radio" name="link_group_id" value="${g._id}" id="link_group_${g._id}">
                                <label for="link_group_${g._id}" style="cursor: pointer; flex: 1;">
                                    <strong>${g.name}</strong><br>
                                    <span style="font-size: 0.8rem; color: var(--text-muted);">${g.memberCount} members</span>
                                </label>
                            </div>
                        `).join('');
                    }
                    document.getElementById('link-group-modal').style.display = 'block';
                } catch (err) {
                    notify('Failed to load your groups', 'error');
                }
            };

            window.submitLinkGroup = async () => {
                const selected = document.querySelector('input[name="link_group_id"]:checked');
                if (!selected) {
                    notify('Please select a group', 'warning');
                    return;
                }
                try {
                    await api.post(`/communities/${this.communityId}/add-group`, { groupId: selected.value });
                    notify('Group linked successfully!', 'success');
                    setTimeout(() => window.location.reload(), 1000);
                } catch (err) {
                    notify(err.message, 'error');
                }
            };

            window.submitPost = async () => {
                if (!this.checkAuth()) return;
                const content = document.getElementById('new-post-content').value.trim();
                if (!content) return notify('Post content cannot be empty', 'warning');
                try {
                    await api.post('/posts', {
                        content,
                        authorId: this.currentUser.id || this.currentUser._id,
                        communityId: this.communityId
                    });
                    document.getElementById('new-post-content').value = '';
                    notify('Posted to community successfully!', 'success');
                    this.renderFeed();
                } catch (err) {
                    notify(err.message, 'error');
                }
            };
            
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
        
        const creatorName = this.community.creator ? (this.community.creator.username || 'creator') : 'creator';
        document.getElementById('community-creator').textContent = `Created by @${creatorName}`;

        // Render Members avatars (max 10)
        const membersList = document.getElementById('community-members-list');
        const members = this.community.membersList || [];
        document.getElementById('member-count').textContent = this.community.memberCount || members.length;

        if (members.length === 0) {
            membersList.innerHTML = '<span style="color: var(--text-muted); font-size: 0.8rem;">No members yet.</span>';
        } else {
            membersList.innerHTML = members.slice(0, 10).map(m => {
                const initial = m.avatarInitials || (m.displayName ? m.displayName.charAt(0).toUpperCase() : 'U');
                const bg = m.avatarUrl ? `background-image: url('${m.avatarUrl}'); background-size: cover;` : 'background: var(--dark-3);';
                return `
                <div class="member-badge" title="${m.username || 'Member'}" style="${bg} color: ${m.avatarUrl ? 'transparent' : 'inherit'};">
                    ${initial}
                </div>
            `}).join('');
            
            if (members.length > 10) {
                membersList.innerHTML += `<div class="member-badge" style="background: var(--dark-3);">+${members.length - 10}</div>`;
            }
        }

        this.updateJoinBtn();
        this.renderGroups();
        this.renderFeed();
    }

    updateJoinBtn() {
        const btn = document.getElementById('community-join-btn');
        if (!btn) return;

        if (!this.currentUser) {
            btn.textContent = 'Sign in to Join';
            btn.onclick = () => window.location.href = 'login.html';
            return;
        }

        const isMember = this.community.membersList && this.community.membersList.some(m => m._id === this.currentUser._id || m._id === this.currentUser.id);
        
        if (isMember) {
            btn.textContent = 'Leave Community';
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-outline');
            btn.onclick = () => this.toggleJoin(true);
        } else {
            btn.textContent = 'Join Community';
            btn.classList.add('btn-primary');
            btn.classList.remove('btn-outline');
            btn.onclick = () => this.toggleJoin(false);
        }
    }

    async toggleJoin(isLeaving) {
        if (!this.checkAuth()) return;
        
        const endpoint = isLeaving ? 'leave' : 'join';
        
        try {
            await api.post(`/communities/${this.communityId}/${endpoint}`);
            notify(`Successfully ${isLeaving ? 'left' : 'joined'} community.`, 'success');
            // Refresh
            setTimeout(() => window.location.reload(), 1000);
        } catch (err) {
            notify(err.message || 'Action failed', 'error');
        }
    }

    renderGroups() {
        const list = document.getElementById('community-groups-list');

        if (this.groups.length === 0) {
            list.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--text-muted); font-size: 0.9rem; border: 1px dashed var(--border-glass); border-radius: var(--radius-sm);">
                    No sub-groups yet. Create one to organize discussions!
                </div>
            `;
            return;
        }

        list.innerHTML = this.groups.map(g => {
            return `
            <div class="group-card" style="background: var(--dark-2); border: 1px solid var(--border-glass); border-radius: var(--radius-md); padding: 1.2rem; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='var(--border-glass)'" onclick="window.location.href='group.html?id=${g._id}'">
                <div>
                    <h4 style="margin: 0 0 0.4rem 0; font-family: var(--font-brand); font-size: 1.1rem;">${g.name}</h4>
                    <p style="margin: 0 0 0.5rem 0; color: var(--text-secondary); font-size: 0.85rem; line-height: 1.4;">${g.description}</p>
                    <div style="font-size: 0.75rem; color: var(--text-muted); display: flex; gap: 1rem;">
                        <span>👥 ${g.memberCount || 0} Members</span>
                        <span>🔒 ${g.privacy === 'private' ? 'Private' : 'Public'}</span>
                    </div>
                </div>
                <button class="btn btn-primary" style="padding: 0.4rem 1.2rem; border-radius: 20px; font-size: 0.85rem;" onclick="event.stopPropagation(); window.location.href='group.html?id=${g._id}'">View Group</button>
            </div>
            `;
        }).join('');
    }

    async renderFeed() {
        const postsContainer = document.getElementById('community-feed');
        if (!postsContainer) return;

        postsContainer.innerHTML = '<div class="loading-spinner" style="margin: 3rem auto;"></div>';

        try {
            const posts = await api.get(`/posts?community=${this.communityId}`);

            if (posts.length === 0) {
                postsContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted); margin-top: 3rem; font-family: var(--font-app);">No activity yet. Posts made in sub-groups will appear here.</p>';
                return;
            }

            let html = '';
            posts.forEach(post => {
                const author = post.author || { displayName: 'Anonymous', username: 'anonymous', avatarInitials: '?' };
                const group = post.group || { name: 'Unknown Group', _id: '' };
                const timeStr = new Date(post.createdAt).toLocaleDateString();
                const isLiked = post.likes && this.currentUser && post.likes.some(id => (id._id || id) === this.currentUser._id);

                let commentsHtml = '';
                if (post.comments && post.comments.length > 0) {
                    commentsHtml = `
                    <div class="comments-list" style="margin-top: 1rem; border-top: 1px solid var(--border-glass); padding-top: 1rem; display: flex; flex-direction: column; gap: 0.75rem;">
                        ${post.comments.slice(0, 3).map(c => {
                            const cAuthor = c.author || { displayName: 'Anonymous', avatarInitials: '?' };
                            return `
                            <div style="display: flex; gap: 0.75rem; align-items: flex-start; text-align: left;">
                                <div class="avatar-circle" style="width: 30px; height: 30px; font-size: 0.75rem; background: var(--primary); ${cAuthor.avatarUrl ? `background-image: url('${cAuthor.avatarUrl}'); background-size: cover; background-position: center; color: transparent;` : ''}">${cAuthor.avatarInitials || 'U'}</div>
                                <div style="background: var(--dark-2); padding: 0.5rem 0.85rem; border-radius: 12px; flex: 1;">
                                    <div style="font-weight: 700; font-size: 0.8rem; color: var(--text-primary); margin-bottom: 0.15rem;">${cAuthor.displayName}</div>
                                    <div style="color: var(--text-secondary); font-size: 0.85rem; line-height: 1.4;">${c.content}</div>
                                </div>
                            </div>`;
                        }).join('')}
                    </div>`;
                }

                html += `
                <div class="glass-card animate-fade-up" style="padding: 1.5rem; margin-bottom: 1.5rem; cursor: pointer;" onclick="window.location.href='group.html?id=${group._id}'">
                    <div style="display: flex; gap: 1rem; margin-bottom: 1rem; justify-content: space-between;">
                        <div style="display: flex; gap: 1rem;">
                            <div class="avatar-circle" style="width: 45px; height: 45px; background: var(--primary); ${author.avatarUrl ? `background-image: url('${author.avatarUrl}'); background-size: cover; background-position: center; color: transparent;` : ''}">${author.avatarInitials || 'U'}</div>
                            <div style="text-align: left;">
                                <div style="font-weight: 700;">${author.displayName}</div>
                                <div style="font-size: 0.85rem; color: var(--text-muted);">via <span style="color: var(--primary); font-weight: 600;">${group.name}</span> • ${timeStr}</div>
                            </div>
                        </div>
                    </div>
                    <p style="color: var(--text-secondary); line-height: 1.6; margin-bottom: 1rem; font-size: 1.05rem; text-align: left;">${post.content}</p>
                    ${post.image ? `<div style="height: 350px; background-image: url('${post.image}'); background-size: cover; background-position: center; border-radius: var(--radius-md); margin-bottom: 1rem;"></div>` : ''}
                    
                    <div style="display: flex; gap: 1.5rem; color: var(--text-muted); font-size: 0.9rem; font-weight: 600;">
                        <span style="display: flex; align-items: center; gap: 0.4rem; color: ${isLiked ? 'var(--primary)' : 'inherit'};"><svg width="18" height="18" viewBox="0 0 24 24" fill="${isLiked ? 'var(--primary)' : 'none'}" stroke="${isLiked ? 'var(--primary)' : 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg> ${post.likes.length} Appreciations</span>
                        <span style="display: flex; align-items: center; gap: 0.4rem;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg> ${post.comments.length} Inquiries</span>
                    </div>
                    ${commentsHtml}
                </div>`;
            });
            postsContainer.innerHTML = html;
        } catch(err) {
            console.error(err);
            postsContainer.innerHTML = '<p style="text-align: center; color: var(--danger);">Failed to load community activity.</p>';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.communityPage = new CommunityPage();
});
