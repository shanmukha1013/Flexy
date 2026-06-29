// js/api.js
// Handles all communication with the real backend.

const PRODUCTION_BACKEND_URL = 'https://flexy-backend-pgw7.onrender.com';

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3001/api'
    : `${PRODUCTION_BACKEND_URL}/api`;

class ApiClient {
    constructor() {
        this.token = localStorage.getItem('flexy_token');
        this.isRefreshing = false;
        this.refreshSubscribers = [];
    }

    getHeaders() {
        const headers = { 'Content-Type': 'application/json' };
        if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
        return headers;
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    }

    subscribeTokenRefresh(cb) {
        this.refreshSubscribers.push(cb);
    }

    onRefreshed(token) {
        this.refreshSubscribers.map(cb => cb(token));
        this.refreshSubscribers = [];
    }

    async refreshToken() {
        if (this.isRefreshing) {
            return new Promise(resolve => {
                this.subscribeTokenRefresh(token => {
                    resolve(token);
                });
            });
        }

        this.isRefreshing = true;

        try {
            const res = await fetch(`${API_BASE}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            if (!res.ok) {
                throw new Error('Refresh failed');
            }
            const data = await res.json();
            this.token = data.token;
            localStorage.setItem('flexy_token', data.token);
            localStorage.setItem('flexy_user', JSON.stringify(data.user));
            this.isRefreshing = false;
            this.onRefreshed(data.token);
            return data.token;
        } catch (err) {
            this.isRefreshing = false;
            this.onRefreshed(null);
            localStorage.removeItem('flexy_token');
            localStorage.removeItem('flexy_user');
            if (!window.location.pathname.includes('login.html')) {
                window.location.href = 'login.html';
            }
            return null;
        }
    }

    async get(endpoint) {
        let res = await fetch(`${API_BASE}${endpoint}`, { headers: this.getHeaders() });
        
        if (res.status === 401) {
            const newToken = await this.refreshToken();
            if (newToken) {
                res = await fetch(`${API_BASE}${endpoint}`, { headers: this.getHeaders() });
            }
        }
        
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    }

    async post(endpoint, data) {
        let res = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(data)
        });
        
        if (res.status === 401) {
            const newToken = await this.refreshToken();
            if (newToken) {
                res = await fetch(`${API_BASE}${endpoint}`, {
                    method: 'POST',
                    headers: this.getHeaders(),
                    body: JSON.stringify(data)
                });
            }
        }
        
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    }

    async put(endpoint, data) {
        let res = await fetch(`${API_BASE}${endpoint}`, {
            method: 'PUT',
            headers: this.getHeaders(),
            body: JSON.stringify(data)
        });
        
        if (res.status === 401) {
            const newToken = await this.refreshToken();
            if (newToken) {
                res = await fetch(`${API_BASE}${endpoint}`, {
                    method: 'PUT',
                    headers: this.getHeaders(),
                    body: JSON.stringify(data)
                });
            }
        }
        
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    }
}

const api = new ApiClient();

// Rendering logic
async function loadHomeFeed() {
    const feedContainer = document.getElementById('social-feed-container');
    if (!feedContainer) return;

    try {
        if (!feedContainer.querySelector('.glass-card')) {
            feedContainer.innerHTML = `<div class="skeleton-card skeleton">
    <div class="skeleton-row">
        <div class="skeleton skeleton-avatar"></div>
        <div style="flex: 1;">
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text short"></div>
        </div>
    </div>
    <div class="skeleton skeleton-box"></div>
</div>`;
        }
        const posts = await api.get('/posts');
        
        if (posts.length === 0) {
            feedContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted); margin-top: 2rem;">Your next discovery is waiting.</p>';
            return;
        }

        const currentUser = JSON.parse(localStorage.getItem('flexy_user') || '{}');
        let html = '';
        posts.forEach(post => {
            const author = post.author || { displayName: 'Anonymous', username: 'anonymous', avatarInitials: '?' };
            const community = post.community || { name: 'General Platform' };
            const timeStr = new Date(post.createdAt).toLocaleDateString();
            const isLiked = post.likes && post.likes.some(id => (id._id || id) === currentUser._id);

            let commentsHtml = '';
            if (post.comments && post.comments.length > 0) {
                commentsHtml = `
                <div class="comments-list" style="margin-top: 1rem; border-top: 1px solid var(--border-glass); padding-top: 1rem; display: flex; flex-direction: column; gap: 0.75rem;">
                    ${post.comments.map(c => {
                        const cAuthor = c.author || { displayName: 'Anonymous', avatarInitials: '?' };
                        return `
                        <div style="display: flex; gap: 0.75rem; align-items: flex-start; text-align: left;">
                            <div class="avatar-circle" style="width: 30px; height: 30px; font-size: 0.75rem; background: var(--primary); ${cAuthor.avatarUrl ? `background-image: url('${cAuthor.avatarUrl}'); background-size: cover; background-position: center; color: transparent;` : ''}">${cAuthor.avatarInitials}</div>
                            <div style="background: var(--dark-2); padding: 0.5rem 0.85rem; border-radius: 12px; flex: 1;">
                                <div style="font-weight: 700; font-size: 0.8rem; color: var(--text-primary); margin-bottom: 0.15rem;">${cAuthor.displayName}</div>
                                <div style="color: var(--text-secondary); font-size: 0.85rem; line-height: 1.4;">${c.content}</div>
                            </div>
                        </div>`;
                    }).join('')}
                </div>`;
            }

            const commentInputHtml = `
            <div style="display: flex; gap: 0.75rem; margin-top: 1rem; align-items: center;">
                <div class="avatar-circle" style="width: 30px; height: 30px; font-size: 0.75rem; background: var(--primary); ${currentUser.avatarUrl ? `background-image: url('${currentUser.avatarUrl}'); background-size: cover; background-position: center; color: transparent;` : ''}">${currentUser.avatarInitials || 'U'}</div>
                <input type="text" placeholder="Add an inquiry..." id="comment-input-${post._id}" style="flex: 1; padding: 0.5rem 1rem; border-radius: 20px; border: 1px solid var(--border-glass); background: var(--dark-1); color: var(--text-primary); font-size: 0.85rem; outline: none; font-family: var(--font-app);" onkeydown="if(event.key === 'Enter') window.submitComment('${post._id}')">
                <button class="btn btn-primary" style="padding: 0.4rem 1rem; font-size: 0.8rem; border-radius: 20px;" onclick="window.submitComment('${post._id}')">Send</button>
            </div>`;

            html += `
            <div class="glass-card animate-fade-up" style="padding: 1.5rem; margin-bottom: 1.5rem;">
                <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
                    <div class="avatar-circle" style="width: 45px; height: 45px; background: var(--primary); ${author.avatarUrl ? `background-image: url('${author.avatarUrl}'); background-size: cover; background-position: center; color: transparent;` : ''}">${author.avatarInitials}</div>
                    <div style="text-align: left;">
                        <div style="font-weight: 700; cursor: pointer;" onclick="window.location.href='profile.html?id=${author._id || author}'">${author.displayName}</div>
                        <div style="font-size: 0.85rem; color: var(--text-muted);">${timeStr} • Documented in <span style="color: var(--primary); font-weight: 600; cursor: pointer;" onclick="window.location.href='community.html?id=${post.community?._id || ''}'">${community.name}</span></div>
                    </div>
                </div>
                <p style="color: var(--text-secondary); line-height: 1.6; margin-bottom: 1rem; font-size: 1.05rem; text-align: left;">${post.content}</p>
                ${post.image ? `<div style="height: 350px; background-image: url('${post.image}'); background-size: cover; background-position: center; border-radius: var(--radius-md); margin-bottom: 1rem; cursor: pointer;" onclick="window.location.href='item.html'"></div>` : ''}
                
                <div style="display: flex; gap: 1.5rem; color: var(--text-muted); font-size: 0.9rem; font-weight: 600; border-bottom: 1px solid var(--border-glass); padding-bottom: 0.8rem;">
                    <span style="cursor: pointer; display: flex; align-items: center; gap: 0.4rem; color: ${isLiked ? 'var(--primary)' : 'inherit'};" onclick="window.likePost('${post._id}')"><svg width="18" height="18" viewBox="0 0 24 24" fill="${isLiked ? 'var(--primary)' : 'none'}" stroke="${isLiked ? 'var(--primary)' : 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg> ${post.likes.length} Appreciations</span>
                    <span style="cursor: pointer; display: flex; align-items: center; gap: 0.4rem;" onclick="window.commentOnPost('${post._id}')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg> ${post.comments.length} Inquiries</span>
                </div>
                
                ${commentsHtml}
                ${commentInputHtml}
            </div>`;
        });
        
        feedContainer.innerHTML = html;
    } catch (err) {
        console.error(err);
        feedContainer.innerHTML = '<p style="color: red; text-align: center;">Unable to retrieve the horological archives.</p>';
    }
}

// Auto-init on page load
document.addEventListener('DOMContentLoaded', () => {
    loadHomeFeed();
    initHomeFeedActions();
});

window.likePost = async function(postId) {
    if (!api.token) return notify('Please login to appreciate flexes.', 'info');
    try {
        const user = JSON.parse(localStorage.getItem('flexy_user') || '{}');
        await api.post(`/posts/${postId}/like`, { userId: user._id });
        loadHomeFeed(); // simple re-render
    } catch (err) {
        notify(err.message, 'error');
    }
};

window.commentOnPost = function(postId) {
    const input = document.getElementById(`comment-input-${postId}`);
    if (input) input.focus();
};

window.submitComment = async function(postId) {
    const input = document.getElementById(`comment-input-${postId}`);
    if (!input) return;
    const content = input.value.trim();
    if (!content) return;
    if (!api.token) return notify('Please login to comment.', 'info');
    
    try {
        const user = JSON.parse(localStorage.getItem('flexy_user') || '{}');
        await api.post(`/posts/${postId}/comments`, { authorId: user._id, content });
        input.value = '';
        
        // Refresh feed depending on page
        const feedContainer = document.getElementById('social-feed-container');
        if (feedContainer) {
            await loadHomeFeed();
        }
        const communityPageContainer = document.getElementById('community-page-container');
        if (communityPageContainer && typeof initCommunityPage === 'function') {
            await initCommunityPage();
        }
    } catch (err) {
        notify(err.message, 'error');
    }
};

function initHomeFeedActions() {
    const fileInput = document.getElementById('flex-image-upload');
    const submitBtn = document.getElementById('submit-flex-btn');
    const textInput = document.getElementById('new-flex-input');
    const previewDiv = document.getElementById('new-flex-image-preview');
    const removeBtn = document.getElementById('remove-flex-image');

    if (!submitBtn || !textInput) return; // not on home page

    let pendingImageBase64 = null;

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    pendingImageBase64 = event.target.result;
                    previewDiv.style.backgroundImage = `url(${pendingImageBase64})`;
                    previewDiv.style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (removeBtn) {
        removeBtn.addEventListener('click', () => {
            pendingImageBase64 = null;
            previewDiv.style.display = 'none';
            fileInput.value = '';
        });
    }

    submitBtn.addEventListener('click', async () => {
        const content = textInput.value.trim();
        if (!content && !pendingImageBase64) return notify("Cannot flex nothing!", 'info');
        
        submitBtn.innerText = "Flexing...";
        submitBtn.style.opacity = "0.7";
        
        try {
            const userStr = localStorage.getItem('flexy_user');
            if (!userStr) throw new Error("Please login first");
            const user = JSON.parse(userStr);
            
            await api.post('/posts', {
                content,
                authorId: user._id,
                image: pendingImageBase64
            });
            
            textInput.value = '';
            if (removeBtn) removeBtn.click();
            await loadHomeFeed();
        } catch(err) {
            notify(err.message, 'error');
        } finally {
            submitBtn.innerText = "Flex";
            submitBtn.style.opacity = "1";
        }
    });
}
async function loadCommunities() {
    const container = document.getElementById("communities-feed-container");
    if (!container) return;
    try {
        container.innerHTML = `<div class="skeleton-card skeleton">
    <div class="skeleton-row">
        <div class="skeleton skeleton-avatar"></div>
        <div style="flex: 1;">
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text short"></div>
        </div>
    </div>
    <div class="skeleton skeleton-box"></div>
</div>`;
        const comms = await api.get("/communities");
        if (comms.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-muted);">Start exploring collections.</p>';
            return;
        }
        let html = "";
        const user = JSON.parse(localStorage.getItem('flexy_user') || '{}');
        comms.forEach(c => {
            const isMember = c.members && c.members.some(m => (m._id || m) === user._id);
            const isPending = c.pendingRequests && c.pendingRequests.some(m => (m._id || m) === user._id);
            let buttonHtml = '';
            if (isMember) {
                buttonHtml = `<button class="btn btn-outline" disabled style="margin-left: auto; padding: 0.6rem 1.5rem; border-radius: var(--radius-full); font-weight: 600; opacity: 0.7; cursor: default;">Admitted</button>`;
            } else if (isPending) {
                buttonHtml = `<button class="btn btn-outline" disabled style="margin-left: auto; padding: 0.6rem 1.5rem; border-radius: var(--radius-full); font-weight: 600; opacity: 0.7; cursor: default; border-color: var(--primary); color: var(--primary);">Pending</button>`;
            } else {
                const label = c.privacy === 'private' ? 'Request Admission' : 'Join';
                buttonHtml = `<button class="btn btn-primary" onclick="event.stopPropagation(); window.joinCommunity('${c._id}')" style="margin-left: auto; padding: 0.6rem 1.5rem; border-radius: var(--radius-full); font-weight: 600;">${label}</button>`;
            }

            html += `
            <div class="glass-card hover-lift" style="padding: 1.5rem; margin-bottom: 1.5rem; cursor: pointer; text-align: left;" onclick="window.location.href='community.html?id=${c._id}'">
                <div style="display: flex; gap: 1.5rem; align-items: center;">
                    <div style="font-size: 3.5rem; background: var(--surface); border: 2px solid var(--border-glass); border-radius: var(--radius-md); padding: 1rem; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">${c.icon}</div>
                    <div style="flex: 1;">
                        <h3 style="margin: 0 0 0.5rem 0; font-family: var(--font-brand); font-size: 1.5rem; color: var(--heading-color);">${c.name}</h3>
                        <p style="color: var(--text-secondary); margin: 0; line-height: 1.5;">${c.description}</p>
                        <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.8rem; display: flex; gap: 1rem;">
                            <span>Curated by <strong style="color: var(--primary);">${c.creator ? c.creator.username : 'Unknown'}</strong></span>
                            <span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg> ${c.members.length} Eminent Members</span>
                        </div>
                    </div>
                    ${buttonHtml}
                </div>
            </div>`;
        });
        container.innerHTML = html;
    } catch(e) { 
        container.innerHTML = "<p>Error loading the registries.</p>"; 
    }
}

async function loadCollections() {
    const container = document.getElementById("collections-feed-container");
    if (!container) return;
    try {
        container.innerHTML = `<div class="skeleton-card skeleton">
    <div class="skeleton-row">
        <div class="skeleton skeleton-avatar"></div>
        <div style="flex: 1;">
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text short"></div>
        </div>
    </div>
    <div class="skeleton skeleton-box"></div>
</div>`;
        const colls = await api.get("/collections");
        if (colls.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-muted);">Start exploring collections.</p>';
            return;
        }
        let html = "";
        colls.forEach(c => {
            const owner = c.owner || { username: 'Anonymous', displayName: 'Anonymous', avatarInitials: '?' };
            html += `
            <div class="glass-card collection-card" style="margin-bottom: 2rem;">
                <div style="height: 250px; background-image: url('${c.coverImage || 'assets/rolex.png'}'); background-size: cover; background-position: center; border-radius: var(--radius-lg) var(--radius-lg) 0 0; position: relative;">
                    <div style="position: absolute; top: 1rem; right: 1rem; background: rgba(255,255,255,0.9); padding: 0.4rem 1rem; border-radius: var(--radius-full); font-size: 0.8rem; font-weight: 700; color: var(--text-primary); backdrop-filter: blur(10px);">${c.category}</div>
                </div>
                <div style="padding: 1.5rem;">
                    <h3 style="margin: 0 0 0.5rem 0; font-family: var(--font-brand); font-size: 1.5rem; color: var(--heading-color);">${c.title}</h3>
                    <p style="color: var(--text-secondary); margin: 0 0 1rem 0; line-height: 1.5;">${c.description}</p>
                    <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-glass); padding-top: 1rem;">
                        <div style="display: flex; align-items: center; gap: 0.8rem;">
                            <div class="avatar-circle" style="width: 32px; height: 32px; background: var(--primary); ${owner.avatarUrl ? `background-image: url('${owner.avatarUrl}'); background-size: cover; background-position: center; color: transparent;` : ''}">${owner.avatarUrl ? '' : owner.avatarInitials}</div>
                            <span style="font-size: 0.9rem; font-weight: 600; color: var(--text-primary); cursor: pointer;" onclick="window.location.href='profile.html?id=${owner._id || ''}'">${owner.displayName || owner.username}</span>
                        </div>
                        <div style="font-size: 0.9rem; color: var(--text-muted); font-weight: 600;">
                            ${c.items ? c.items.length : 0} Artifacts
                        </div>
                    </div>
                </div>
            </div>`;
        });
        container.innerHTML = html;
    } catch(e) { 
        container.innerHTML = "<p>Error loading the exhibitions.</p>"; 
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadCommunities();
    loadCollections();
});

async function loadAuctions() {
    const container = document.getElementById("auctions-feed-container");
    if (!container) return;
    try {
        container.innerHTML = `<div class="skeleton-card skeleton">

    <div class="skeleton-row">
        <div class="skeleton skeleton-avatar"></div>
        <div style="flex: 1;">
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text short"></div>
        </div>
    </div>
    <div class="skeleton skeleton-box"></div>
</div>`;
        const auctions = await api.get("/auctions");
        if (auctions.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-muted);">Your next discovery is waiting.</p>';
            return;
        }
        let html = "";
        auctions.forEach(a => {
            html += `
            <div class="glass-card collection-card" style="margin-bottom: 2rem;">
                <div style="height: 250px; background-image: url('${a.image || 'assets/rolex.png'}'); background-size: cover; background-position: center; border-radius: var(--radius-lg) var(--radius-lg) 0 0; position: relative; cursor: pointer;" onclick="window.location.href='item.html?id=${a._id}'">
                    <div style="position: absolute; top: 1rem; left: 1rem; background: rgba(255,255,255,0.9); padding: 0.4rem 1rem; border-radius: var(--radius-full); font-size: 0.8rem; font-weight: 700; color: var(--danger); backdrop-filter: blur(10px); display: flex; align-items: center; gap: 0.5rem;"><span style="display:inline-block; width:8px; height:8px; background:var(--danger); border-radius:50%; box-shadow: 0 0 8px var(--danger);"></span> LIVE AUCTION</div>
                    <div style="position: absolute; bottom: 1rem; right: 1rem; background: rgba(0,0,0,0.7); padding: 0.4rem 1rem; border-radius: var(--radius-sm); font-size: 0.9rem; font-weight: 700; color: #fff; backdrop-filter: blur(10px);">
                        Ends in: <span class="auction-timer" data-endtime="${a.endTime}">--h --m --s</span>
                    </div>
                </div>
                <div style="padding: 1.5rem;">
                    <h3 style="margin: 0 0 0.5rem 0; font-family: var(--font-brand); font-size: 1.4rem; color: var(--heading-color);">${a.title}</h3>
                    <p style="color: var(--text-secondary); margin: 0 0 1rem 0; line-height: 1.5; font-size: 0.95rem;">${a.description}</p>
                    
                    <div style="display: flex; justify-content: space-between; align-items: flex-end; padding-top: 1rem; border-top: 1px solid var(--border-glass);">
                        <div>
                            <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.2rem;">Current Bid</div>
                            <div style="font-size: 1.3rem; font-weight: 700; color: var(--primary);">${api.formatCurrency(a.currentBid)}</div>
                        </div>
                        <button class="btn btn-outline" onclick="window.location.href='item.html?id=${a._id}'">Place Bid</button>
                    </div>
                </div>
            </div>`;
        });
        container.innerHTML = html;
    } catch(e) { 
        container.innerHTML = "<p>Error loading the auctions.</p>"; 
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadAuctions();
});

async function loadLiveAuction() {
    const container = document.getElementById("live-auction-container");
    if (!container) return;
    
    // Parse ID from URL ?id=xxxx
    const urlParams = new URLSearchParams(window.location.search);
    let auctionId = urlParams.get('id');
    
    try {
        if (!auctionId) {
            // fallback to fetch the first active auction if none specified
            const all = await api.get('/auctions');
            if(all.length > 0) auctionId = all[0]._id;
            else {
                container.innerHTML = "<p>Your next discovery is waiting.</p>";
                return;
            }
        }

        const a = await api.get('/auctions/' + auctionId);
        
        container.innerHTML = `
        <div style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 3rem;">
            <!-- Image -->
            <div>
                <div style="height: 500px; background-image: url('${a.image || 'assets/rolex.png'}'); background-size: cover; background-position: center; border-radius: var(--radius-xl); box-shadow: 0 10px 40px rgba(0,0,0,0.1); position: relative;">
                    <div style="position: absolute; top: 1.5rem; left: 1.5rem; background: rgba(255,255,255,0.9); padding: 0.5rem 1.5rem; border-radius: var(--radius-full); font-weight: 700; color: var(--danger); backdrop-filter: blur(10px); display: flex; align-items: center; gap: 0.5rem;"><span style="display:inline-block; width:10px; height:10px; background:var(--danger); border-radius:50%; box-shadow: 0 0 10px var(--danger);"></span> LIVE AUCTION</div>
                    <div style="position: absolute; bottom: 1rem; right: 1rem; background: rgba(0,0,0,0.7); padding: 0.4rem 1rem; border-radius: var(--radius-sm); font-size: 0.9rem; font-weight: 700; color: #fff; backdrop-filter: blur(10px);">
                        Ends in: <span class="auction-timer" data-endtime="${a.endTime}">--h --m --s</span>
                    </div>
                </div>
            </div>
            
            <!-- Details -->
            <div>
                <h1 style="font-family: var(--font-brand); font-size: 2.5rem; margin-bottom: 1rem; color: var(--heading-color);">${a.title}</h1>
                <p style="color: var(--text-secondary); font-size: 1.1rem; line-height: 1.6; margin-bottom: 2rem;">${a.description}</p>
                
                <div class="glass-card" style="padding: 2rem; margin-bottom: 2rem; text-align: center; border: 2px solid var(--primary);">
                    <div style="font-size: 0.9rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.5rem;">Current Bid</div>
                    <div id="live-bid-amount" style="font-size: 3rem; font-family: var(--font-brand); color: var(--primary); font-weight: 600; margin-bottom: 1.5rem;">${api.formatCurrency(a.currentBid)}</div>
                    
                    <div style="display: flex; gap: 1rem;">
                        <input type="number" id="bid-input" placeholder="Enter Amount" style="flex: 1; padding: 1rem; border: 1px solid var(--border-glass); border-radius: var(--radius-md); font-size: 1.1rem; text-align: center; background: rgba(255,255,255,0.5);">
                        <button id="place-bid-btn" class="btn btn-primary" style="padding: 0 2rem; font-weight: 700;">Place Bid</button>
                    </div>
                    <div id="bid-status" style="margin-top: 1rem; color: var(--danger); font-size: 0.9rem;"></div>
                </div>
                
                <div class="glass-card" style="padding: 1.5rem;">
                    <h3 style="margin: 0 0 1rem 0; font-family: var(--font-brand);">Provenance / Seller</h3>
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <div class="avatar-circle" style="width: 50px; height: 50px; background: var(--primary); ${a.seller.avatarUrl ? `background-image: url('${a.seller.avatarUrl}'); background-size: cover; background-position: center; color: transparent;` : ''}">${a.seller.avatarUrl ? '' : a.seller.avatarInitials}</div>
                        <div>
                            <div style="font-weight: 700; font-size: 1.1rem; cursor: pointer;" onclick="window.location.href='profile.html?id=${a.seller._id}'">${a.seller.displayName || a.seller.username}</div>
                            <div style="font-size: 0.9rem; color: var(--text-muted);">@${a.seller.username} · ${a.seller.reputation || 'Eminent Collector'}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;

        // Socket.IO Integration
        if (typeof io !== 'undefined') {
            const socketUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                ? `http://${window.location.hostname}:3001`
                : PRODUCTION_BACKEND_URL;
            const socket = io(socketUrl);
            socket.emit('join_auction', auctionId);
            
            socket.on('new_bid', (data) => {
                const el = document.getElementById('live-bid-amount');
                if (el) {
                    el.innerText = api.formatCurrency(data.amount);
                    el.style.animation = 'pulse 0.5s ease';
                    setTimeout(() => el.style.animation = '', 500);
                }
            });

            document.getElementById('place-bid-btn').addEventListener('click', async () => {
                const amount = parseInt(document.getElementById('bid-input').value);
                const status = document.getElementById('bid-status');
                if (!amount || amount <= a.currentBid) {
                    status.innerText = "Bid must be higher than current bid.";
                    return;
                }
                
                try {
                    status.innerText = "Processing...";
                    // Requires user to be logged in to have an ID, we'll mock an ID if unauthenticated for testing
                    let user = JSON.parse(localStorage.getItem('flexy_user'));
                    if (!user || !user._id) {
                        status.innerText = "Please login to place a bid.";
                        status.style.color = "var(--danger)";
                        return;
                    }
                    let userId = user._id;
                    
                    const res = await api.post('/auctions/' + auctionId + '/bid', { bidderId: userId, amount });
                    status.innerText = "Bid placed successfully!";
                    status.style.color = "var(--primary)";
                    
                    socket.emit('place_bid', { auctionId, amount });
                } catch(err) {
                    status.innerText = err.message || "Failed to place bid.";
                    status.style.color = "var(--danger)";
                }
            });
        }
    } catch(e) {
        container.innerHTML = "<p>Error loading the live auction.</p>";
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadLiveAuction();
});

// Global Profile State Management
async function initGlobalProfile() {
    try {
        let token = localStorage.getItem('flexy_token');
        let user;

        if (!token) {
            // Try to restore session using refresh token cookie
            token = await api.refreshToken();
        }

        if (!token) {
            if (!window.location.pathname.includes('login.html') && !window.location.pathname.includes('index.html')) {
                window.location.href = 'login.html';
            }
            return;
        }

        // Fetch fresh user data from server via JWT token
        try {
            user = await api.get('/auth/me');
            localStorage.setItem('flexy_user', JSON.stringify(user));
        } catch (err) {
            // Access token might be expired, let's try refresh once
            token = await api.refreshToken();
            if (token) {
                user = await api.get('/auth/me');
                localStorage.setItem('flexy_user', JSON.stringify(user));
            } else {
                localStorage.removeItem('flexy_token');
                localStorage.removeItem('flexy_user');
                if (!window.location.pathname.includes('login.html') && !window.location.pathname.includes('index.html')) {
                    window.location.href = 'login.html';
                }
                return;
            }
        }

        if (user) {
            // Onboarding check
            if (!user.isVerified) {
                if (!window.location.pathname.includes('profile-setup.html') && 
                    !window.location.pathname.includes('login.html') && 
                    !window.location.pathname.includes('index.html')) {
                    window.location.href = 'profile-setup.html';
                    return;
                }
            } else {
                // If verified but somehow on profile-setup, redirect to home
                if (window.location.pathname.includes('profile-setup.html')) {
                    window.location.href = 'home.html';
                    return;
                }
            }
            // Update Navbar across all pages
            const profileBtns = document.querySelectorAll('.header-actions button[onclick*="profile.html"]');
            profileBtns.forEach(btn => {
                btn.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <div class="avatar-circle" style="width: 28px; height: 28px; font-size: 0.8rem; background: var(--primary); ${user.avatarUrl ? 'background-image: url(' + user.avatarUrl + '); background-size: cover; background-position: center;' : ''}">${user.avatarUrl ? '' : user.avatarInitials}</div>
                        <span style="font-weight: 600;">${user.displayName}</span>
                    </div>
                `;
                btn.style.padding = '0.3rem 0.8rem 0.3rem 0.3rem';
            });
            
            // Update Home Page Sidebar
            const sidebarAvatar = document.getElementById('sidebar-avatar');
            const sidebarDisplayName = document.getElementById('sidebar-displayname');
            const sidebarUsername = document.getElementById('sidebar-username');
            const sidebarReputation = document.getElementById('sidebar-reputation');
            const newFlexAvatar = document.getElementById('new-flex-avatar');

            if (sidebarAvatar) {
                if (user.avatarUrl) {
                    sidebarAvatar.style.backgroundImage = `url(${user.avatarUrl})`;
                    sidebarAvatar.style.backgroundSize = 'cover';
                    sidebarAvatar.style.backgroundPosition = 'center';
                    sidebarAvatar.innerHTML = '';
                } else {
                    sidebarAvatar.innerHTML = user.avatarInitials;
                }
            }
            if (sidebarDisplayName) sidebarDisplayName.innerText = user.displayName || user.username;
            if (sidebarUsername) sidebarUsername.innerText = `@${user.username}`;
            if (sidebarReputation) sidebarReputation.innerText = `Reputation: ${user.reputation || 'Newcomer'}`;
            
            if (newFlexAvatar) {
                if (user.avatarUrl) {
                    newFlexAvatar.style.backgroundImage = `url(${user.avatarUrl})`;
                    newFlexAvatar.style.backgroundSize = 'cover';
                    newFlexAvatar.style.backgroundPosition = 'center';
                    newFlexAvatar.innerHTML = '';
                } else {
                    newFlexAvatar.innerHTML = user.avatarInitials;
                }
            }
        }
    } catch(err) {
        console.error("Error initializing global profile", err);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    initGlobalProfile();
});

// Settings Page Logic
async function initSettingsPage() {
    const nameInput = document.getElementById('setting-name');
    const usernameInput = document.getElementById('setting-username');
    const bioInput = document.getElementById('setting-bio');
    const emailInput = document.getElementById('setting-email');
    const saveBtn = document.getElementById('save-settings-btn');
    
    if (!nameInput || !saveBtn) return; // Not on settings page

    let userStr = localStorage.getItem('flexy_user');
    if (!userStr) return;
    let user = JSON.parse(userStr);

    
    // Pre-fill
    nameInput.value = user.displayName || '';
    usernameInput.value = user.username || '';
    bioInput.value = user.bio || '';
    emailInput.value = user.email || '';
    
    // Avatar Pre-fill
    if (user.avatarUrl) {
        const initialsSpan = document.getElementById('avatar-initials');
        const displayDiv = document.getElementById('avatar-display');
        if (initialsSpan) initialsSpan.style.display = 'none';
        if (displayDiv) {
            displayDiv.style.backgroundImage = `url(${user.avatarUrl})`;
            displayDiv.style.backgroundSize = 'cover';
            displayDiv.style.backgroundPosition = 'center';
        }
    }
    // Handle Save
    saveBtn.addEventListener('click', async () => {
        saveBtn.innerText = "Saving...";
        saveBtn.style.opacity = "0.7";
        
        let usernameVal = usernameInput.value.trim();
        if (usernameVal.startsWith('@')) {
            usernameVal = usernameVal.substring(1);
        }
        
        try {
            const updatedUser = await api.put('/users/' + user._id, {
                displayName: nameInput.value,
                username: usernameVal,
                bio: bioInput.value,
                email: emailInput.value,
                avatarUrl: window.pendingAvatarBase64 || user.avatarUrl
            }); // We'll implement actual PUT via fetch in api.post override or update api client
            
            // Re-fetch and update local storage
            const freshUser = await api.get('/users/' + user._id);
            localStorage.setItem('flexy_user', JSON.stringify(freshUser));
            
            // Re-init global profile to update Navbars instantly
            initGlobalProfile();
            
            saveBtn.innerText = "Saved!";
            saveBtn.style.background = "var(--success)";
            setTimeout(() => {
                saveBtn.innerText = "Save Changes";
                saveBtn.style.background = "var(--primary)";
                saveBtn.style.opacity = "1";
            }, 2000);
        } catch(err) {
            notify("Error saving profile: " + err.message, 'error');
            saveBtn.innerText = "Save Changes";
            saveBtn.style.opacity = "1";
        }
    });
}

// Add PUT support to ApiClient
if (!ApiClient.prototype.put) {
    ApiClient.prototype.put = async function(endpoint, data) {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            method: 'PUT',
            headers: this.getHeaders(),
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    };
}

document.addEventListener("DOMContentLoaded", () => {
    initSettingsPage();
});

// Profile Page Logic
async function initProfilePage() {
    const container = document.getElementById('profile-container');
    if (!container) return; // Not on profile page

    const urlParams = new URLSearchParams(window.location.search);
    const profileId = urlParams.get('id');
    const currentUser = JSON.parse(localStorage.getItem('flexy_user') || '{}');
    const isOwnProfile = !profileId || profileId === currentUser._id || profileId === currentUser.id;

    let user = null;
    
    if (isOwnProfile) {
        // Fetch fresh current user
        try {
            const freshUser = await api.get('/auth/me');
            if (freshUser) {
                user = freshUser;
                localStorage.setItem('flexy_user', JSON.stringify(user));
            }
        } catch(err) {
            console.error("Profile page auth error:", err);
            localStorage.removeItem('flexy_token');
            localStorage.removeItem('flexy_user');
            window.location.href = 'login.html';
            return;
        }
    } else {
        // Fetch someone else's profile
        try {
            user = await api.get('/users/' + profileId);
        } catch(err) {
            console.error("Error fetching user profile:", err);
            container.innerHTML = `<div style="text-align: center; padding: 5rem;"><h2 style="font-family: var(--font-brand);">User Not Found</h2></div>`;
            return;
        }
    }

    if (!user) {
        container.innerHTML = '<div style="text-align: center; padding: 5rem;"><h2 style="font-family: var(--font-brand);">Please Login</h2></div>';
        return;
    }

    const followersCount = user.followers ? user.followers.length : 0;
    const followingCount = user.following ? user.following.length : 0;
    const itemCount = user.showcaseCabinet ? user.showcaseCabinet.length : 0;
    const interests = user.interests || ['Watches', 'Art', 'Antiquities'];
    const achievements = user.achievements || [];
    const isFollowing = user.followers && user.followers.some(f => (f._id || f) === currentUser._id);

    const avatarHtml = user.avatarUrl 
        ? `<div class="avatar-circle" style="width: 100px; height: 100px; margin-bottom: 1rem; border: 4px solid var(--dark-1); box-shadow: 0 10px 25px rgba(0,0,0,0.05); background-image: url('${user.avatarUrl}'); background-size: cover; background-position: center; color: transparent;">${user.avatarInitials}</div>`
        : `<div class="avatar-circle" style="width: 100px; height: 100px; font-size: 2.5rem; margin-bottom: 1rem; border: 4px solid var(--dark-1); box-shadow: 0 10px 25px rgba(0,0,0,0.05); background: var(--primary);">${user.avatarInitials}</div>`;

    let actionButtons = '';
    if (isOwnProfile) {
        actionButtons = `<button class="btn btn-outline" style="border-radius: var(--radius-full); padding: 0.6rem 2rem;" onclick="window.location.href='settings.html'">Edit Profile</button>`;
    } else {
        actionButtons = `
            ${isFollowing 
                ? `<button class="btn btn-outline" style="border-radius: var(--radius-full); padding: 0.6rem 2rem;" onclick="window.unfollowUser('${user._id}')">Unfollow</button>`
                : `<button class="btn btn-primary" style="border-radius: var(--radius-full); padding: 0.6rem 2rem;" onclick="window.followUser('${user._id}')">Follow</button>`
            }
            <button class="btn btn-outline" style="border-radius: var(--radius-full); padding: 0.6rem 2rem;" onclick="window.location.href='messages.html?id=${user._id}&name=${encodeURIComponent(user.displayName || user.username)}'">Message</button>
        `;
    }

    container.innerHTML = `
        <div class="profile-header animate-fade-up stagger-1" style="display: flex; flex-direction: column; align-items: center; text-align: center; margin-bottom: 3rem; padding-top: 2rem;">
            ${avatarHtml}
            <h1 style="font-family: var(--font-brand); margin-bottom: 0.25rem;">${user.displayName}</h1>
            <p style="color: var(--text-muted); margin-bottom: 1rem; font-family: var(--font-brand);">@${user.username || 'unknown'} · ${user.reputation || 'New Collector'}</p>
            
            <p style="max-width: 500px; margin: 0.5rem auto 1.5rem auto; line-height: 1.6; color: var(--text-secondary); font-style: italic;">
                ${user.bio || 'A dedicated curator and archivist, exploring rare acquisitions and documenting history on Flexy.'}
            </p>

            <!-- ACHIEVEMENTS -->
            ${achievements.length > 0 ? `
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: center; margin-bottom: 1.5rem;">
                ${achievements.map(a => `<span class="achievement-badge">🏆 ${a}</span>`).join('')}
            </div>` : ''}

            <div style="display: flex; gap: 2.5rem; margin-bottom: 2rem; font-family: var(--font-app);">
                <div style="text-align: center;">
                    <div style="font-size: 1.75rem; font-weight: 700; color: var(--text-primary); font-family: var(--font-brand); line-height: 1.2;">${itemCount}</div>
                    <div style="color: var(--text-muted); font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 0.25rem;">Items</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 1.75rem; font-weight: 700; color: var(--text-primary); font-family: var(--font-brand); line-height: 1.2;">${followersCount}</div>
                    <div style="color: var(--text-muted); font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 0.25rem;">Followers</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 1.75rem; font-weight: 700; color: var(--text-primary); font-family: var(--font-brand); line-height: 1.2;">${followingCount}</div>
                    <div style="color: var(--text-muted); font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 0.25rem;">Following</div>
                </div>
            </div>

            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: center; margin-bottom: 1.5rem; font-family: var(--font-app);">
                ${interests.map(i => `<span style="background: var(--dark-1); color: var(--primary); border: 1px solid var(--border-glass); padding: 0.4rem 1rem; border-radius: 20px; font-size: 0.85rem; font-weight: 600; text-transform: lowercase;">#${i.replace(/^#/, '')}</span>`).join('')}
            </div>

            <div style="display: flex; gap: 1rem;">
                ${actionButtons}
            </div>
        </div>
          <div class="tabs profile-header-tabs animate-fade-up stagger-2" style="border-bottom: 1px solid var(--border); margin-bottom: 2rem; display: flex; gap: 1.5rem; overflow-x: auto;">
            <button class="tab-trigger active" onclick="window.switchProfileTab('overview', '${user._id}')">Overview</button>
            <button class="tab-trigger" onclick="window.switchProfileTab('museum', '${user._id}')">Museum Preview</button>
            <button class="tab-trigger" onclick="window.switchProfileTab('collections', '${user._id}')">Collections</button>
            <button class="tab-trigger" onclick="window.switchProfileTab('auctions', '${user._id}')">Auctions</button>
            <button class="tab-trigger" onclick="window.switchProfileTab('groups', '${user._id}')">Groups</button>
            <button class="tab-trigger" onclick="window.switchProfileTab('communities', '${user._id}')">Communities</button>
            <button class="tab-trigger" onclick="window.switchProfileTab('followers', '${user._id}')">Followers</button>
            <button class="tab-trigger" onclick="window.switchProfileTab('following', '${user._id}')">Following</button>
            <button class="tab-trigger" onclick="window.switchProfileTab('activity', '${user._id}')">Activity</button>
        </div>
        
        <div class="museum-grid animate-fade-up stagger-3" id="showcase-cabinet"></div>
    `;

    // Load default tab
    window.switchProfileTab('overview', user._id);
}

window.followUser = async function(id) {
    if (!api.token) return notify('Please login to follow other collectors.', 'info');
    try {
        await api.post(`/users/${id}/follow`, {});
        initProfilePage();
    } catch(err) {
        notify(err.message, 'error');
    }
};

window.unfollowUser = async function(id) {
    if (!api.token) return notify('Please login to unfollow.', 'info');
    try {
        await api.post(`/users/${id}/unfollow`, {});
        initProfilePage();
    } catch(err) {
        notify(err.message, 'error');
    }
};

window.switchProfileTab = async function(tab, userId) {
    const grid = document.getElementById('showcase-cabinet');
    if (!grid) return;
    
    // Update active tab styling
    const tabBtns = document.querySelectorAll('.profile-header-tabs .tab-trigger');
    tabBtns.forEach(t => {
        if (t.getAttribute('onclick').includes(tab)) {
            t.classList.add('active');
        } else {
            t.classList.remove('active');
        }
    });

    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 3rem;"><div class="loading-spinner" style="margin:0 auto;"></div></div>';

    try {
        const user = await api.get('/users/' + userId);
        const currentUser = JSON.parse(localStorage.getItem('flexy_user') || '{}');
        const isOwnProfile = userId === currentUser._id || userId === currentUser.id;

        if (tab === 'cabinet') {
            if (user.showcaseCabinet && user.showcaseCabinet.length > 0) {
                grid.innerHTML = user.showcaseCabinet.map(item => `
                    <div class="glass-card hover-lift" style="cursor: pointer; overflow: hidden; padding: 1.5rem;" onclick="window.location.href='item.html?id=${item._id}'">
                        <div style="height: 250px; background-image: url('${item.image || 'assets/camera.png'}'); background-size: cover; background-position: center; border-radius: var(--radius-md); margin-bottom: 1.5rem;"></div>
                        <h4 style="margin: 0 0 0.5rem 0; font-family: var(--font-brand); font-size: 1.25rem;">${item.title}</h4>
                        <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1.5rem; line-height: 1.5;">${item.description || ''}</p>
                    </div>
                `).join('');
            } else {
                grid.innerHTML = `
                    <div style="text-align: center; padding: 3rem; background: var(--dark-1); border-radius: var(--radius-xl); border: 1px solid var(--border-glass); grid-column: 1 / -1; width: 100%;">
                        <h3 style="font-family: var(--font-brand); color: var(--text-muted); margin-bottom: 1rem;">No museum items cataloged yet.</h3>
                        ${isOwnProfile ? `<button class="btn btn-primary" style="border-radius: var(--radius-full);" onclick="window.location.href='collections.html'">Create First Collection</button>` : ''}

                    </div>
                `;
            }
        } else if (tab === 'flexes') {
            const posts = await api.get('/posts');
            const userPosts = posts.filter(p => p.author && (p.author._id === userId || p.author === userId));
            if (userPosts.length > 0) {
                grid.innerHTML = userPosts.map(post => {
                    const timeStr = new Date(post.createdAt).toLocaleDateString();
                    return `
                    <div class="glass-card" style="padding: 1.5rem; margin-bottom: 1.5rem; grid-column: 1/-1; text-align: left;">
                        <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
                            <div class="avatar-circle" style="width: 45px; height: 45px; background: var(--primary); ${user.avatarUrl ? `background-image: url('${user.avatarUrl}'); background-size: cover; background-position: center; color: transparent;` : ''}">${user.avatarInitials}</div>
                            <div>
                                <div style="font-weight: 700;">${user.displayName}</div>
                                <div style="font-size: 0.85rem; color: var(--text-muted);">${timeStr}</div>
                            </div>
                        </div>
                        <p style="color: var(--text-secondary); line-height: 1.6; margin-bottom: 1rem; font-size: 1.05rem;">${post.content}</p>
                        ${post.image ? `<div style="height: 350px; background-image: url('${post.image}'); background-size: cover; background-position: center; border-radius: var(--radius-md); margin-bottom: 1rem;"></div>` : ''}
                    </div>
                    `;
                }).join('');
            } else {
                grid.innerHTML = `
                    <div style="text-align: center; padding: 3rem; background: var(--dark-1); border-radius: var(--radius-xl); border: 1px solid var(--border-glass); grid-column: 1 / -1; width: 100%;">
                        <h3 style="font-family: var(--font-brand); color: var(--text-muted); margin-bottom: 1rem;">No flexes shared yet.</h3>
                    </div>
                `;
            }
        } else if (tab === 'auctions') {
            const auctions = await api.get('/auctions');
            const userAuctions = auctions.filter(a => a.seller && (a.seller._id === userId || a.seller === userId));
            if (userAuctions.length > 0) {
                grid.innerHTML = userAuctions.map(a => `
                    <div class="glass-card hover-lift" onclick="window.location.href='item.html?id=${a._id}'" style="cursor: pointer; overflow: hidden; padding: 1.5rem;">
                        <div style="height: 250px; background-image: url('${a.image || 'assets/rolex.png'}'); background-size: cover; background-position: center; border-radius: var(--radius-md); margin-bottom: 1.5rem;"></div>
                        <h4 style="margin: 0 0 0.5rem 0; font-family: var(--font-brand); font-size: 1.25rem;">${a.title}</h4>
                        <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1.5rem;">${a.category || 'Auction'}</p>
                        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-glass); padding-top: 1rem;">
                            <div>
                                <div style="font-size: 0.8rem; color: var(--text-muted);">Current Bid</div>
                                <div style="font-size: 1.1rem; font-weight: 700; color: var(--primary);">${api.formatCurrency(a.currentBid || a.startingBid)}</div>
                            </div>
                            <button class="btn btn-outline" style="padding: 0.4rem 1.5rem; font-size: 0.9rem;">Bid</button>
                        </div>
                    </div>
                `).join('');
            } else {
                grid.innerHTML = `
                    <div style="text-align: center; padding: 3rem; background: var(--dark-1); border-radius: var(--radius-xl); border: 1px solid var(--border-glass); grid-column: 1 / -1; width: 100%;">
                        <h3 style="font-family: var(--font-brand); color: var(--text-muted); margin-bottom: 1rem;">No active auctions.</h3>
                        ${isOwnProfile ? `<button class="btn btn-primary" style="border-radius: var(--radius-full);" onclick="window.location.href='sell.html'">Start Auction</button>` : ''}
                    </div>
                `;
            }
        } else if (tab === 'communities') {
            if (user.communities && user.communities.length > 0) {
                grid.innerHTML = user.communities.map(c => `
                    <div class="glass-card hover-lift" style="padding: 1.5rem; cursor: pointer;" onclick="window.location.href='community.html?id=${c._id}'">
                        <h4 style="margin: 0 0 0.5rem 0; font-family: var(--font-brand); font-size: 1.25rem;">${c.name}</h4>
                        <p style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.4;">${c.description || ''}</p>
                    </div>
                `).join('');
            } else {
                grid.innerHTML = `
                    <div style="text-align: center; padding: 3rem; background: var(--dark-1); border-radius: var(--radius-xl); border: 1px solid var(--border-glass); grid-column: 1 / -1; width: 100%;">
                        <h3 style="font-family: var(--font-brand); color: var(--text-muted); margin-bottom: 1rem;">Not joined any communities yet.</h3>
                    </div>
                `;
            }
        } else if (tab === 'groups') {
            try {
                const groups = await api.get(`/groups/user/${userId}`);
                if (groups && groups.length > 0) {
                    grid.innerHTML = groups.map(g => `
                        <div class="glass-card hover-lift" style="padding: 1.5rem; cursor: pointer; text-align: left;" onclick="window.location.href='community.html?id=${g.community ? g.community._id : ''}'">
                            <h4 style="margin: 0 0 0.5rem 0; font-family: var(--font-brand); font-size: 1.25rem;">${g.name}</h4>
                            <p style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.4; margin-bottom: 0.5rem;">${g.description || ''}</p>
                            <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500;">🏛️ Part of ${g.community ? g.community.name : 'Community'}</span>
                        </div>
                    `).join('');
                } else {
                    grid.innerHTML = `
                        <div style="text-align: center; padding: 3rem; background: var(--dark-1); border-radius: var(--radius-xl); border: 1px solid var(--border-glass); grid-column: 1 / -1; width: 100%;">
                            <h3 style="font-family: var(--font-brand); color: var(--text-muted); margin-bottom: 1rem;">Not joined any groups yet.</h3>
                        </div>
                    `;
                }
            } catch (err) {
                console.error(err);
                grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">Error loading groups.</div>';
            }
        }
    } catch(err) {
        console.error(err);
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">Error loading tab.</div>';
    }
};

document.addEventListener("DOMContentLoaded", () => {
    initProfilePage();
});

window.settings = window.settings || {};
window.settings.markDirty = function() {
    const saveBtn = document.getElementById('save-settings-btn');
    if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.style.opacity = "1";
    }
};
window.settings.saveSetting = function(key, value) {
    console.log(`Setting saved: ${key} = ${value}`);
};
window.settings.changeEmail = function() {
    notify("Please contact administration to request a change of registered email address.", 'info');
};
window.settings.logoutAll = function() {
    notify("Initiated security protocol: Logged out from all other active sessions.", 'info');
};
window.settings.deleteAccount = function() {
    if (confirm("Are you sure you want to permanently delete your collector legacy on Flexy? This action is irreversible.")) {
        notify("Legacy deleted.", 'info');
        localStorage.clear();
        window.location.href = "login.html";
    }
};
window.settings.addFunds = function() {
    window.location.href = "wallet.html";
};
window.settings.handleAvatarUpload = function(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const base64Str = e.target.result;
            
            // Set global var to be used in save
            window.pendingAvatarBase64 = base64Str;
            
            // Update preview
            const initialsSpan = document.getElementById('avatar-initials');
            const displayDiv = document.getElementById('avatar-display');
            
            if (initialsSpan) initialsSpan.style.display = 'none';
            if (displayDiv) {
                displayDiv.style.backgroundImage = `url(${base64Str})`;
                displayDiv.style.backgroundSize = 'cover';
                displayDiv.style.backgroundPosition = 'center';
            }
        };
        reader.readAsDataURL(input.files[0]);
    }
};

// Global Auction Timer Loop
function updateAuctionTimers() {
    const timers = document.querySelectorAll('.auction-timer');
    const now = new Date().getTime();

    timers.forEach(timer => {
        const endTimeStr = timer.getAttribute('data-endtime');
        if (!endTimeStr) return;
        
        const end = new Date(endTimeStr).getTime();
        const distance = end - now;

        if (distance < 0) {
            timer.innerHTML = "Ended";
            timer.classList.remove('timer-urgent');
            return;
        }

        const h = Math.floor(distance / (1000 * 60 * 60));
        const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((distance % (1000 * 60)) / 1000);

        timer.innerHTML = `${h}h ${m}m ${s}s`;

        if (distance < 1000 * 60 * 60) {
            timer.classList.add('timer-urgent');
        }
    });
}
setInterval(updateAuctionTimers, 1000);

async function initExplorePage() {
    const searchInput = document.getElementById('global-search-input');
    const searchBtn = document.getElementById('global-search-btn');
    const resultsContainer = document.getElementById('search-results-container');
    const filterBtns = document.querySelectorAll('#search-filters button[data-filter]');
    if (!searchInput || !searchBtn || !resultsContainer) return;

    let currentFilter = 'all';

    // Wire up filter buttons
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => { b.classList.remove('btn-primary'); b.classList.add('btn-outline'); });
            btn.classList.add('btn-primary');
            btn.classList.remove('btn-outline');
            currentFilter = btn.getAttribute('data-filter');
            // Re-trigger search with current query
            if (searchInput.value.trim()) searchBtn.click();
        });
    });

    searchBtn.addEventListener('click', async () => {
        const q = searchInput.value.trim();
        if (!q) return;
        resultsContainer.innerHTML = '<div class="skeleton-card skeleton" style="height:200px;"></div>';
        try {
            const data = await api.get('/search?q=' + encodeURIComponent(q));
            let html = '';

            // Collectors
            if ((currentFilter === 'all' || currentFilter === 'collectors' || currentFilter === 'users') && data.users && data.users.length) {
                html += '<h3 style="margin: 1.5rem 0 1rem;">Collectors</h3><div style="display:flex; gap:1rem; flex-wrap:wrap; margin-bottom: 2rem;">';
                data.users.forEach(u => {
                    html += `<div class="glass-card hover-lift" onclick="window.location.href='profile.html?id=${u._id}'" style="padding: 1.5rem; width: 220px; text-align: center; cursor: pointer;"><div class="avatar-circle" style="margin: 0 auto 1rem auto; width: 50px; height: 50px; background: var(--primary); ${u.avatarUrl ? `background-image: url('${u.avatarUrl}'); background-size: cover; background-position: center; color: transparent;` : ''}">${u.avatarUrl ? '' : (u.avatarInitials || '?')}</div><h4 style="margin: 0 0 0.25rem;">${u.displayName || u.username}</h4><p style="font-size: 0.8rem; color: var(--text-muted); margin: 0;">@${u.username}</p></div>`;
                });
                html += '</div>';
            }

            // Communities
            if ((currentFilter === 'all' || currentFilter === 'communities') && data.communities && data.communities.length) {
                html += '<h3 style="margin: 1.5rem 0 1rem;">Communities</h3><div style="display:flex; gap:1rem; flex-wrap:wrap; margin-bottom: 2rem;">';
                data.communities.forEach(c => {
                    html += `<div class="glass-card hover-lift" style="padding: 1.5rem; width: 280px; cursor: pointer;" onclick="window.location.href='community.html?id=${c._id}'"><h4 style="margin: 0 0 0.5rem;">${c.name}</h4><p style="font-size: 0.85rem; color: var(--text-muted); margin: 0; line-height: 1.4;">${(c.description || '').substring(0, 80)}${c.description && c.description.length > 80 ? '...' : ''}</p></div>`;
                });
                html += '</div>';
            }

            // Groups
            if ((currentFilter === 'all' || currentFilter === 'groups') && data.groups && data.groups.length) {
                html += '<h3 style="margin: 1.5rem 0 1rem;">Groups</h3><div style="display:flex; gap:1rem; flex-wrap:wrap; margin-bottom: 2rem;">';
                data.groups.forEach(g => {
                    html += `<div class="glass-card hover-lift" style="padding: 1.5rem; width: 280px; cursor: pointer;" onclick="window.location.href='group.html?id=${g._id}'"><h4 style="margin: 0 0 0.5rem;">${g.name}</h4><p style="font-size: 0.85rem; color: var(--text-muted); margin: 0; line-height: 1.4;">${(g.description || '').substring(0, 80)}${g.description && g.description.length > 80 ? '...' : ''}</p></div>`;
                });
                html += '</div>';
            }

            // Collections
            if ((currentFilter === 'all' || currentFilter === 'collections') && data.collections && data.collections.length) {
                html += '<h3 style="margin: 1.5rem 0 1rem;">Collections</h3><div style="display:flex; gap:1rem; flex-wrap:wrap; margin-bottom: 2rem;">';
                data.collections.forEach(c => {
                    html += `<div class="glass-card hover-lift" style="padding: 1.5rem; width: 280px; cursor: pointer;" onclick="window.location.href='collections.html'"><h4 style="margin: 0 0 0.5rem;">${c.title}</h4><p style="font-size: 0.85rem; color: var(--text-muted); margin: 0;">${c.category || 'Collection'} &middot; ${c.items ? c.items.length : 0} items</p></div>`;
                });
                html += '</div>';
            }

            // Auctions
            if ((currentFilter === 'all' || currentFilter === 'auctions') && data.auctions && data.auctions.length) {
                html += '<h3 style="margin: 1.5rem 0 1rem;">Auctions</h3><div style="display:flex; gap:1rem; flex-wrap:wrap; margin-bottom: 2rem;">';
                data.auctions.forEach(a => {
                    html += `<div class="glass-card hover-lift" style="padding: 1.5rem; width: 280px; cursor: pointer;" onclick="window.location.href='item.html?id=${a._id}'"><h4 style="margin: 0 0 0.5rem;">${a.title}</h4><p style="font-size: 0.85rem; color: var(--primary); margin: 0; font-weight: 600;">${api.formatCurrency(a.currentBid || a.startingBid)}</p></div>`;
                });
                html += '</div>';
            }

            // Items
            if ((currentFilter === 'all') && data.items && data.items.length) {
                html += '<h3 style="margin: 1.5rem 0 1rem;">Items</h3><div style="display:flex; gap:1rem; flex-wrap:wrap; margin-bottom: 2rem;">';
                data.items.forEach(i => {
                    html += `<div class="glass-card hover-lift" style="padding: 1.5rem; width: 280px;"><h4 style="margin: 0 0 0.5rem;">${i.title}</h4><p style="font-size: 0.85rem; color: var(--text-muted); margin: 0;">${i.category || 'Item'}</p></div>`;
                });
                html += '</div>';
            }

            if (!html) html = '<p style="text-align: center; color: var(--text-muted); margin-top: 3rem;">No results found for "' + q + '".</p>';
            resultsContainer.innerHTML = html;
        } catch(e) {
            console.error('Search error:', e);
            resultsContainer.innerHTML = '<p style="color: var(--text-muted); text-align: center; margin-top: 3rem;">Error performing search. Please try again.</p>';
        }
    });

    // Allow Enter key to trigger search
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') searchBtn.click();
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initExplorePage();
});

// Community Actions
window.createCommunity = async function() {
    if (!api.token) return notify('Please login to create a community.', 'info');
    const name = prompt('Community Name:');
    if (!name) return;
    const description = prompt('Community Description:');
    if (!description) return;
    try {
        const user = JSON.parse(localStorage.getItem('flexy_user') || '{}');
        await api.post('/communities', { name, description, icon: 'C', creatorId: user._id });
        notify('Community created successfully!', 'success');
        if (typeof loadCommunities === 'function') loadCommunities();
    } catch(err) {
        notify(err.message, 'error');
    }
};

window.joinCommunity = async function(id) {
    if (!api.token) return notify('Please login to join a community.', 'info');
    try {
        const user = JSON.parse(localStorage.getItem('flexy_user') || '{}');
        const res = await api.post('/communities/' + id + '/join', { userId: user._id });
        if (res.pending) {
            notify('Request sent to creator successfully!', 'success');
        } else {
            notify('Joined community successfully!', 'success');
        }
        if (typeof loadCommunities === 'function') loadCommunities();
    } catch(err) {
        notify(err.message, 'error');
    }
};

// Collection Actions
window.createCollection = async function() {
    if (!api.token) return notify('Please login to create a collection.', 'info');
    const title = prompt('Collection Title:');
    if (!title) return;
    const description = prompt('Collection Description:');
    if (!description) return;
    const category = prompt('Category (e.g. Horology, Numismatics, Trading Cards):') || 'General';
    try {
        const user = JSON.parse(localStorage.getItem('flexy_user') || '{}');
        await api.post('/collections', { title, description, category, ownerId: user._id });
        notify('Collection created successfully!', 'success');
        if (typeof loadCollections === 'function') loadCollections();
    } catch(err) {
        notify(err.message, 'error');
    }
};

window.viewMyMuseum = function() {
    window.location.href = 'profile.html';
};

// Community Detail Page Logic
async function initCommunityPage() {
    const pageContainer = document.getElementById('community-page-container');
    const loadingView = document.getElementById('community-loading-view');
    if (!pageContainer) return; // Not on community page

    const urlParams = new URLSearchParams(window.location.search);
    const communityId = urlParams.get('id');
    if (!communityId) {
        if (loadingView) loadingView.innerHTML = `<div style="padding: 3rem;"><h2 style="font-family: var(--font-brand);">Invalid Community ID</h2></div>`;
        return;
    }

    try {
        const community = await api.get('/communities/' + communityId);
        const currentUser = JSON.parse(localStorage.getItem('flexy_user') || '{}');
        
        // Hide loading, show page
        if (loadingView) loadingView.style.display = 'none';
        pageContainer.style.display = 'block';

        // Set text details
        document.getElementById('community-icon').innerText = community.icon || '🏛️';
        document.getElementById('community-title').innerText = community.name;
        document.getElementById('community-curator').innerText = `Curated by @${community.creator ? community.creator.username : 'archivist'}`;
        document.getElementById('community-desc').innerText = community.description;

        // Render member badges
        const membersList = document.getElementById('community-members-list');
        if (membersList && community.members) {
            membersList.innerHTML = community.members.map(m => `
                <div class="member-badge" title="${m.displayName || m.username}">
                    <div class="avatar-circle" style="width: 20px; height: 20px; font-size: 0.6rem; background: var(--primary); ${m.avatarUrl ? `background-image: url('${m.avatarUrl}'); background-size: cover; background-position: center; color: transparent;` : ''}">${m.avatarInitials || 'U'}</div>
                    <span>${m.displayName || m.username}</span>
                </div>
            `).join('');
        }

        // Render sub-groups
        const groupsList = document.getElementById('community-groups-list');
        if (groupsList) {
            try {
                const groups = await api.get(`/communities/${communityId}/groups`);
                if (groups.length === 0) {
                    groupsList.innerHTML = '<p style="font-size: 0.8rem; color: var(--text-muted); text-align: center; margin: 1rem 0;">No sub-groups created yet.</p>';
                } else {
                    groupsList.innerHTML = groups.map(g => {
                        const userJoined = g.members && g.members.some(mId => (mId._id || mId) === currentUser._id);
                        const memberCount = g.members ? g.members.length : 0;
                        return `
                            <div class="glass-card" style="padding: 0.75rem; border-radius: var(--radius-md); background: var(--dark-2); display: flex; flex-direction: column; gap: 0.5rem;">
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;">
                                    <div style="text-align: left;">
                                        <h5 style="font-family: var(--font-brand); font-size: 0.9rem; font-weight: bold; margin: 0; color: var(--text-primary);">${g.name}</h5>
                                        <p style="font-size: 0.75rem; color: var(--text-secondary); margin: 0.2rem 0 0 0; line-height: 1.3;">${g.description}</p>
                                        <span style="font-size: 0.7rem; color: var(--text-muted); font-weight: 500;">👥 ${memberCount} ${memberCount === 1 ? 'member' : 'members'}</span>
                                    </div>
                                    ${isMember ? `
                                        <button class="btn ${userJoined ? 'btn-outline' : 'btn-primary'}" style="padding: 0.2rem 0.6rem; font-size: 0.75rem; border-radius: var(--radius-full); flex-shrink: 0;" onclick="window.toggleGroupMembership('${g._id}', ${userJoined}, '${communityId}')">
                                            ${userJoined ? 'Leave' : 'Join'}
                                        </button>
                                    ` : ''}
                                </div>
                            </div>
                        `;
                    }).join('');
                }
            } catch (err) {
                console.error("Error loading groups:", err);
                groupsList.innerHTML = '<p style="font-size: 0.8rem; color: var(--text-muted);">Failed to load groups.</p>';
            }
        }

        // Join / Admitted Button State
        const joinBtn = document.getElementById('community-join-btn');
        const postCard = document.getElementById('community-new-post-card');
        const isMember = community.members && community.members.some(m => (m._id || m) === currentUser._id);

        if (joinBtn) {
            if (isMember) {
                joinBtn.innerText = "Admitted";
                joinBtn.disabled = true;
                joinBtn.style.opacity = "0.7";
                joinBtn.style.cursor = "default";
                if (postCard) postCard.style.display = 'block';
            } else {
                joinBtn.innerText = "Request Admission";
                joinBtn.disabled = false;
                joinBtn.style.opacity = "1";
                joinBtn.style.cursor = "pointer";
                joinBtn.onclick = async () => {
                    try {
                        await api.post(`/communities/${communityId}/join`, { userId: currentUser._id });
                        notify("Admitted to community!", 'info');
                        initCommunityPage();
                    } catch(err) {
                        notify(err.message, 'error');
                    }
                };
                if (postCard) postCard.style.display = 'none';
            }
        }

        // Update post feed
        const postsContainer = document.getElementById('community-posts-container');
        if (postsContainer) {
            if (!postsContainer.querySelector('.glass-card')) {
                postsContainer.innerHTML = '<div class="loading-spinner" style="margin: 3rem auto;"></div>';
            }
            const posts = await api.get('/posts?community=' + communityId);

            if (posts.length === 0) {
                postsContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted); margin-top: 3rem; font-family: var(--font-app);">No flexes here yet. Be the first to catalog a piece!</p>';
                return;
            }

            let html = '';
            posts.forEach(post => {
                const author = post.author || { displayName: 'Anonymous', username: 'anonymous', avatarInitials: '?' };
                const timeStr = new Date(post.createdAt).toLocaleDateString();
                const isLiked = post.likes && post.likes.some(id => (id._id || id) === currentUser._id);

                let commentsHtml = '';
                if (post.comments && post.comments.length > 0) {
                    commentsHtml = `
                    <div class="comments-list" style="margin-top: 1rem; border-top: 1px solid var(--border-glass); padding-top: 1rem; display: flex; flex-direction: column; gap: 0.75rem;">
                        ${post.comments.map(c => {
                            const cAuthor = c.author || { displayName: 'Anonymous', avatarInitials: '?' };
                            return `
                            <div style="display: flex; gap: 0.75rem; align-items: flex-start; text-align: left;">
                                <div class="avatar-circle" style="width: 30px; height: 30px; font-size: 0.75rem; background: var(--primary); ${cAuthor.avatarUrl ? `background-image: url('${cAuthor.avatarUrl}'); background-size: cover; background-position: center; color: transparent;` : ''}">${cAuthor.avatarInitials}</div>
                                <div style="background: var(--dark-2); padding: 0.5rem 0.85rem; border-radius: 12px; flex: 1;">
                                    <div style="font-weight: 700; font-size: 0.8rem; color: var(--text-primary); margin-bottom: 0.15rem;">${cAuthor.displayName}</div>
                                    <div style="color: var(--text-secondary); font-size: 0.85rem; line-height: 1.4;">${c.content}</div>
                                </div>
                            </div>`;
                        }).join('')}
                    </div>`;
                }

                const commentInputHtml = `
                <div style="display: flex; gap: 0.75rem; margin-top: 1rem; align-items: center;">
                    <div class="avatar-circle" style="width: 30px; height: 30px; font-size: 0.75rem; background: var(--primary); ${currentUser.avatarUrl ? `background-image: url('${currentUser.avatarUrl}'); background-size: cover; background-position: center; color: transparent;` : ''}">${currentUser.avatarInitials || 'U'}</div>
                    <input type="text" placeholder="Add an inquiry..." id="comment-input-${post._id}" style="flex: 1; padding: 0.5rem 1rem; border-radius: 20px; border: 1px solid var(--border-glass); background: var(--dark-1); color: var(--text-primary); font-size: 0.85rem; outline: none; font-family: var(--font-app);" onkeydown="if(event.key === 'Enter') window.submitComment('${post._id}')">
                    <button class="btn btn-primary" style="padding: 0.4rem 1rem; font-size: 0.8rem; border-radius: 20px;" onclick="window.submitComment('${post._id}')">Send</button>
                </div>`;

                html += `
                <div class="glass-card animate-fade-up" style="padding: 1.5rem; margin-bottom: 1.5rem;">
                    <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
                        <div class="avatar-circle" style="width: 45px; height: 45px; background: var(--primary); ${author.avatarUrl ? `background-image: url('${author.avatarUrl}'); background-size: cover; background-position: center; color: transparent;` : ''}">${author.avatarInitials}</div>
                        <div style="text-align: left;">
                            <div style="font-weight: 700; cursor: pointer;" onclick="window.location.href='profile.html?id=${author._id || author}'">${author.displayName}</div>
                            <div style="font-size: 0.85rem; color: var(--text-muted);">${timeStr}</div>
                        </div>
                    </div>
                    <p style="color: var(--text-secondary); line-height: 1.6; margin-bottom: 1rem; font-size: 1.05rem; text-align: left;">${post.content}</p>
                    ${post.image ? `<div style="height: 350px; background-image: url('${post.image}'); background-size: cover; background-position: center; border-radius: var(--radius-md); margin-bottom: 1rem; cursor: pointer;" onclick="window.location.href='item.html'"></div>` : ''}
                    
                    <div style="display: flex; gap: 1.5rem; color: var(--text-muted); font-size: 0.9rem; font-weight: 600; border-bottom: 1px solid var(--border-glass); padding-bottom: 0.8rem;">
                        <span style="cursor: pointer; display: flex; align-items: center; gap: 0.4rem; color: ${isLiked ? 'var(--primary)' : 'inherit'};" onclick="window.likePost('${post._id}')"><svg width="18" height="18" viewBox="0 0 24 24" fill="${isLiked ? 'var(--primary)' : 'none'}" stroke="${isLiked ? 'var(--primary)' : 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg> ${post.likes.length} Appreciations</span>
                        <span style="cursor: pointer; display: flex; align-items: center; gap: 0.4rem;" onclick="window.commentOnPost('${post._id}')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg> ${post.comments.length} Inquiries</span>
                    </div>
                    
                    ${commentsHtml}
                    ${commentInputHtml}
                </div>`;
            });
            postsContainer.innerHTML = html;
        }

        // Set up post form events
        window.communityPendingImageBase64 = null;
        const fileInput = document.getElementById('community-post-image-input');
        const previewDiv = document.getElementById('community-post-preview');
        if (fileInput) {
            fileInput.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        window.communityPendingImageBase64 = event.target.result;
                        if (previewDiv) {
                            previewDiv.style.backgroundImage = `url('${event.target.result}')`;
                            previewDiv.style.display = 'block';
                        }
                    };
                    reader.readAsDataURL(file);
                }
            };
        }

        // Set up personal DP in new post card
        const newPostAvatar = document.getElementById('new-post-avatar');
        if (newPostAvatar && currentUser) {
            if (currentUser.avatarUrl) {
                newPostAvatar.style.backgroundImage = `url('${currentUser.avatarUrl}')`;
                newPostAvatar.style.backgroundSize = 'cover';
                newPostAvatar.style.backgroundPosition = 'center';
                newPostAvatar.innerHTML = '';
            } else {
                newPostAvatar.innerHTML = currentUser.avatarInitials || 'U';
            }
        }

    } catch(err) {
        console.error(err);
        if (loadingView) {
            loadingView.innerHTML = `<div style="padding: 3rem;"><h2 style="font-family: var(--font-brand); color: var(--danger);">Failed to load community details</h2><p style="color: var(--text-secondary); margin-top: 1rem;">${err.message}</p></div>`;
        }
    }
}

window.clearCommunityPostImage = function() {
    window.communityPendingImageBase64 = null;
    const previewDiv = document.getElementById('community-post-preview');
    if (previewDiv) previewDiv.style.display = 'none';
    const fileInput = document.getElementById('community-post-image-input');
    if (fileInput) fileInput.value = '';
};

window.createCommunityPost = async function() {
    const textInput = document.getElementById('community-post-content');
    if (!textInput) return;
    const content = textInput.value.trim();
    if (!content && !window.communityPendingImageBase64) return notify('Cannot post empty content.', 'info');

    const urlParams = new URLSearchParams(window.location.search);
    const communityId = urlParams.get('id');
    const user = JSON.parse(localStorage.getItem('flexy_user') || '{}');

    try {
        await api.post('/posts', {
            content,
            authorId: user._id,
            communityId: communityId,
            image: window.communityPendingImageBase64
        });
        textInput.value = '';
        window.clearCommunityPostImage();
        initCommunityPage(); // reload posts
    } catch(err) {
        notify(err.message, 'error');
    }
};

window.toggleGroupMembership = async function(groupId, isMember, communityId) {
    try {
        const action = isMember ? 'leave' : 'join';
        await api.post(`/groups/${groupId}/${action}`);
        initCommunityPage();
    } catch (err) {
        notify(err.message || "Failed to update group membership", 'error');
    }
};

window.triggerCreateGroup = async function() {
    const urlParams = new URLSearchParams(window.location.search);
    const communityId = urlParams.get('id');
    if (!communityId) return;

    // Check if user is a member of the community first
    const community = await api.get('/communities/' + communityId);
    const currentUser = JSON.parse(localStorage.getItem('flexy_user') || '{}');
    const isMember = community.members && community.members.some(m => (m._id || m) === currentUser._id);
    if (!isMember) {
        notify("You must join this community before creating a sub-group.", 'info');
        return;
    }

    const name = prompt("Enter sub-group name:");
    if (!name || !name.trim()) return;
    const description = prompt("Enter sub-group description:");
    if (!description || !description.trim()) return;

    try {
        await api.post(`/communities/${communityId}/groups`, { name: name.trim(), description: description.trim() });
        notify("Sub-group created successfully!", 'success');
        initCommunityPage();
    } catch (err) {
        notify(err.message || "Failed to create sub-group", 'error');
    }
};
async function loadFollowSuggestions() {
    const container = document.getElementById('collectors-to-follow-container');
    if (!container) return;

    try {
        const users = await api.get('/users');
        if (users.length === 0) {
            container.innerHTML = '<p style="font-size: 0.85rem; color: var(--text-muted); text-align: center;">No suggestions found</p>';
            return;
        }

        const currentUser = JSON.parse(localStorage.getItem('flexy_user') || '{}');
        let me;
        try {
            me = await api.get('/auth/me');
        } catch (e) {
            me = currentUser;
        }

        const followingIds = new Set((me.following || []).map(f => (f._id || f).toString()));

        // Display suggestions (excluding already followed users)
        const suggestions = users.filter(u => !followingIds.has(u._id.toString())).slice(0, 5);

        if (suggestions.length === 0) {
            container.innerHTML = '<p style="font-size: 0.85rem; color: var(--text-muted); text-align: center;">You follow everyone!</p>';
            return;
        }

        let html = '';
        suggestions.forEach(u => {
            const avatarStyle = u.avatarUrl || u.profilePhoto
                ? `background-image: url('${u.avatarUrl || u.profilePhoto}'); background-size: cover; background-position: center; color: transparent;`
                : 'background: var(--primary);';
            const initials = u.avatarInitials || (u.displayName || u.username).substring(0, 2).toUpperCase();

            html += `
            <div style="display: flex; justify-content: space-between; align-items: center;" id="suggestion-row-${u._id}">
                <div style="display: flex; align-items: center; gap: 0.8rem; cursor: pointer;" onclick="window.location.href='profile.html?id=${u._id}'">
                    <div class="avatar-circle" style="width: 35px; height: 35px; font-size: 1rem; ${avatarStyle}">${u.avatarUrl || u.profilePhoto ? '' : initials}</div>
                    <div style="text-align: left;">
                        <div style="font-weight: 600; font-size: 0.9rem;">${u.displayName || u.username}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">@${u.username}</div>
                    </div>
                </div>
                <button class="btn btn-outline" style="padding: 0.2rem 0.6rem; font-size: 0.75rem;" onclick="followSuggestedUser('${u._id}')">Follow</button>
            </div>`;
        });

        container.innerHTML = html;

    } catch (err) {
        console.error("Error loading follow suggestions:", err);
        container.innerHTML = '<p style="font-size: 0.85rem; color: var(--danger); text-align: center;">Error loading suggestions</p>';
    }
}

window.followSuggestedUser = async function(userId) {
    try {
        await api.post(`/users/${userId}/follow`);
        const row = document.getElementById(`suggestion-row-${userId}`);
        if (row) {
            const btn = row.querySelector('button');
            if (btn) {
                btn.className = 'btn btn-primary';
                btn.innerText = 'Following';
                btn.disabled = true;
                btn.style.pointerEvents = 'none';
            }
        }
        if (typeof loadHomeFeed === 'function') {
            loadHomeFeed();
        }
    } catch(err) {
        notify(err.message, 'error');
    }
};

async function updateNotificationBadge() {
    const badge = document.getElementById('nav-notification-badge');
    if (!badge) return;

    try {
        const notifications = await api.get('/notifications');
        const unreadCount = notifications.filter(n => !n.read).length;
        
        if (unreadCount > 0) {
            badge.innerText = unreadCount;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    } catch (err) {
        badge.style.display = 'none';
    }
}

document.addEventListener("DOMContentLoaded", () => {
    initCommunityPage();
    loadFollowSuggestions();
    updateNotificationBadge();
});

