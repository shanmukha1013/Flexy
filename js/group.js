// group.js - Single Group Logic

class GroupPage {
    constructor() {
        const u = localStorage.getItem('flexy_user');
        this.currentUser = u ? JSON.parse(u) : null;
        this.groupId = new URLSearchParams(window.location.search).get('id');
        this.group = null;
        this.init();
    }

    async init() {
        if (!this.groupId) {
            notify('No group ID provided.', 'error');
            document.getElementById('loading-state').textContent = 'Group not found.';
            return;
        }

        try {
            this.group = await api.get(`/groups/${this.groupId}`);
            
            document.getElementById('loading-state').style.display = 'none';
            document.getElementById('group-page-container').style.display = 'block';
            
            this.renderDetails();

            window.submitPost = this.submitPost.bind(this);
            window.likePost = this.likePost.bind(this);
            window.commentOnPost = this.commentOnPost.bind(this);
            window.submitComment = this.submitComment.bind(this);
            
        } catch (err) {
            console.error(err);
            notify('Failed to load group details', 'error');
            document.getElementById('loading-state').textContent = 'Error loading group.';
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
        if (!this.group) return;

        document.title = `${this.group.name} | FLEXY Collectors`;
        document.getElementById('group-title').textContent = this.group.name;
        document.getElementById('group-desc').textContent = this.group.description || 'No description provided.';
        
        if (this.group.community) {
            window.parentCommunityId = this.group.community._id;
            document.getElementById('group-community').innerHTML = `Belongs to <span style="color: var(--primary);">${this.group.community.name}</span>`;
        }

        // Render Members avatars (max 10)
        const membersList = document.getElementById('group-members-list');
        const members = this.group.membersList || [];
        document.getElementById('member-count').textContent = this.group.memberCount || members.length;

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
        this.renderFeed();
    }

    updateJoinBtn() {
        const btn = document.getElementById('group-join-btn');
        const postArea = document.getElementById('post-input-area');
        
        if (!btn) return;

        if (!this.currentUser) {
            btn.textContent = 'Sign in to Join';
            btn.onclick = () => window.location.href = 'login.html';
            return;
        }

        const isMember = this.group.membersList && this.group.membersList.some(m => m._id === this.currentUser._id || m._id === this.currentUser.id);
        
        if (isMember) {
            btn.textContent = 'Leave Group';
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-outline');
            btn.onclick = () => this.toggleJoin(true);
            
            // Allow posting
            postArea.style.display = 'block';
            const avatarDiv = document.getElementById('new-post-avatar');
            if (avatarDiv) {
                if (this.currentUser.avatarUrl) {
                    avatarDiv.style.backgroundImage = `url('${this.currentUser.avatarUrl}')`;
                    avatarDiv.style.backgroundSize = 'cover';
                    avatarDiv.innerHTML = '';
                } else {
                    avatarDiv.innerHTML = this.currentUser.avatarInitials || 'U';
                    avatarDiv.style.display = 'flex';
                    avatarDiv.style.alignItems = 'center';
                    avatarDiv.style.justifyContent = 'center';
                }
            }
        } else {
            btn.textContent = 'Join Group';
            btn.classList.add('btn-primary');
            btn.classList.remove('btn-outline');
            btn.onclick = () => this.toggleJoin(false);
            postArea.style.display = 'none';
        }
    }

    async toggleJoin(isLeaving) {
        if (!this.checkAuth()) return;
        
        const endpoint = isLeaving ? 'leave' : 'join';
        
        try {
            await api.post(`/groups/${this.groupId}/${endpoint}`);
            notify(`Successfully ${isLeaving ? 'left' : 'joined'} group.`, 'success');
            setTimeout(() => window.location.reload(), 1000);
        } catch (err) {
            notify(err.message || 'Action failed', 'error');
        }
    }

    async submitPost() {
        if (!this.checkAuth()) return;

        const content = document.getElementById('new-post-content').value.trim();
        if (!content) {
            notify("Please enter some content for your post.", "warning");
            return;
        }

        const btn = document.getElementById('btn-submit-post');
        btn.disabled = true;
        btn.textContent = 'Posting...';

        try {
            await api.post('/posts', {
                content,
                authorId: this.currentUser._id || this.currentUser.id,
                groupId: this.groupId,
                image: window.postImageDataUrl || null
            });
            notify("Posted successfully!", "success");
            document.getElementById('new-post-content').value = '';
            if (window.clearPostImage) window.clearPostImage();
            this.renderFeed(); // reload feed
        } catch(err) {
            notify(err.message, "error");
        } finally {
            btn.disabled = false;
            btn.textContent = 'Post';
        }
    }

    async likePost(postId) {
        if (!this.checkAuth()) return;
        try {
            await api.post(`/posts/${postId}/like`, { userId: this.currentUser.id || this.currentUser._id });
            this.renderFeed(); // reload feed to show new like count
        } catch(err) {
            notify(err.message, 'error');
        }
    }

    commentOnPost(postId) {
        if (!this.checkAuth()) return;
        const input = document.getElementById(`comment-input-${postId}`);
        if (input) {
            input.focus();
        }
    }

    async submitComment(postId) {
        if (!this.checkAuth()) return;
        const input = document.getElementById(`comment-input-${postId}`);
        if (!input || !input.value.trim()) return;

        try {
            await api.post(`/posts/${postId}/comments`, {
                content: input.value.trim(),
                authorId: this.currentUser.id || this.currentUser._id
            });
            input.value = '';
            this.renderFeed(); // reload feed to show comment
        } catch(err) {
            notify(err.message, 'error');
        }
    }

    async renderFeed() {
        const postsContainer = document.getElementById('group-feed');
        if (!postsContainer) return;

        postsContainer.innerHTML = '<div class="loading-spinner" style="margin: 3rem auto;"></div>';

        try {
            const posts = await api.get(`/posts?group=${this.groupId}`);

            if (posts.length === 0) {
                postsContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted); margin-top: 3rem; font-family: var(--font-app);">No discussions yet. Be the first to start one!</p>';
                return;
            }

            let html = '';
            posts.forEach(post => {
                const author = post.author || { displayName: 'Anonymous', username: 'anonymous', avatarInitials: '?' };
                const timeStr = new Date(post.createdAt).toLocaleDateString();
                const isLiked = post.likes && this.currentUser && post.likes.some(id => (id._id || id) === this.currentUser._id || (id._id || id) === this.currentUser.id);

                let commentsHtml = '';
                if (post.comments && post.comments.length > 0) {
                    commentsHtml = `
                    <div class="comments-list" style="margin-top: 1rem; border-top: 1px solid var(--border-glass); padding-top: 1rem; display: flex; flex-direction: column; gap: 0.75rem;">
                        ${post.comments.map(c => {
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

                const currentUserObj = this.currentUser || {};
                const commentInputHtml = this.currentUser ? `
                <div style="display: flex; gap: 0.75rem; margin-top: 1rem; align-items: center;">
                    <div class="avatar-circle" style="width: 30px; height: 30px; font-size: 0.75rem; background: var(--primary); ${currentUserObj.avatarUrl ? `background-image: url('${currentUserObj.avatarUrl}'); background-size: cover; background-position: center; color: transparent;` : ''}">${currentUserObj.avatarInitials || 'U'}</div>
                    <input type="text" placeholder="Add a reply..." id="comment-input-${post._id}" style="flex: 1; padding: 0.5rem 1rem; border-radius: 20px; border: 1px solid var(--border-glass); background: var(--dark-1); color: var(--text-primary); font-size: 0.85rem; outline: none; font-family: var(--font-app);" onkeydown="if(event.key === 'Enter') window.submitComment('${post._id}')">
                    <button class="btn btn-primary" style="padding: 0.4rem 1rem; font-size: 0.8rem; border-radius: 20px;" onclick="window.submitComment('${post._id}')">Reply</button>
                </div>` : '';

                html += `
                <div class="glass-card animate-fade-up" style="padding: 1.5rem; margin-bottom: 1.5rem;">
                    <div style="display: flex; gap: 1rem; margin-bottom: 1rem; justify-content: space-between;">
                        <div style="display: flex; gap: 1rem;">
                            <div class="avatar-circle" style="width: 45px; height: 45px; background: var(--primary); ${author.avatarUrl ? `background-image: url('${author.avatarUrl}'); background-size: cover; background-position: center; color: transparent;` : ''}">${author.avatarInitials || 'U'}</div>
                            <div style="text-align: left;">
                                <div style="font-weight: 700;">${author.displayName}</div>
                                <div style="font-size: 0.85rem; color: var(--text-muted);">${timeStr}</div>
                            </div>
                        </div>
                    </div>
                    <p style="color: var(--text-secondary); line-height: 1.6; margin-bottom: 1rem; font-size: 1.05rem; text-align: left;">${post.content}</p>
                    ${post.image ? `<div style="height: 350px; background-image: url('${post.image}'); background-size: cover; background-position: center; border-radius: var(--radius-md); margin-bottom: 1rem;"></div>` : ''}
                    
                    <div style="display: flex; gap: 1.5rem; color: var(--text-muted); font-size: 0.9rem; font-weight: 600;">
                        <span style="cursor: pointer; display: flex; align-items: center; gap: 0.4rem; color: ${isLiked ? 'var(--primary)' : 'inherit'};" onclick="window.likePost('${post._id}')"><svg width="18" height="18" viewBox="0 0 24 24" fill="${isLiked ? 'var(--primary)' : 'none'}" stroke="${isLiked ? 'var(--primary)' : 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg> ${post.likes.length} Appreciations</span>
                        <span style="cursor: pointer; display: flex; align-items: center; gap: 0.4rem;" onclick="window.commentOnPost('${post._id}')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg> ${post.comments.length} Inquiries</span>
                    </div>
                    ${commentsHtml}
                    ${commentInputHtml}
                </div>`;
            });
            postsContainer.innerHTML = html;
        } catch(err) {
            console.error(err);
            postsContainer.innerHTML = '<p style="text-align: center; color: var(--danger);">Failed to load group discussions.</p>';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.groupPage = new GroupPage();
});
