// profile.js - User Profile Management

class Profile {
    constructor() {
        this.currentUser = null;
        this.userItems = [];
        this.userBids = [];
        this.init();
    }

    init() {
        // Check authentication
        this.checkAuth();
        
        // Load user data
        this.loadUser();
        
        // Load user items and bids
        this.loadUserData();

        // Remove any leftover simulation/admin artifacts (sim users, demo runs)
        this.clearSimArtifacts();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Render profile
        this.render();
    }

    checkAuth() {
        const user = localStorage.getItem('flexy_user');
        const token = localStorage.getItem('flexy_token');
        
        if (!user || !token) {
            window.location.href = 'login.html';
        }
    }

    loadUser() {
        const userData = localStorage.getItem('flexy_user');
        if (userData) {
            this.currentUser = JSON.parse(userData);
        }
    }

    loadUserData() {
        // Load user items
        const allItems = JSON.parse(localStorage.getItem('flexy_items') || '[]');
        this.userItems = allItems.filter(item => item.sellerId === this.currentUser?.id);
        
        // Load user bids (in a real app, this would come from a database)
        this.userBids = JSON.parse(localStorage.getItem('flexy_user_bids_' + this.currentUser?.id) || '[]');
        
        // Load transactions
        this.transactions = JSON.parse(localStorage.getItem('flexy_transactions_' + this.currentUser?.id) || '[]');

        // Load wins
        this.userWins = JSON.parse(localStorage.getItem('flexy_user_wins_' + this.currentUser?.id) || '[]');
    }

    // Remove any leftover demo/admin simulation data created previously
    clearSimArtifacts() {
        try {
            const sims = JSON.parse(localStorage.getItem('flexy_sim_users') || '[]');
            (sims || []).forEach(s => localStorage.removeItem('flexy_user_' + s.id));
            localStorage.removeItem('flexy_sim_users');
            // remove demo run history for current user
            if (this.currentUser && this.currentUser.id) localStorage.removeItem('flexy_demo_runs_' + this.currentUser.id);
        } catch (e) { /* ignore */ }
    }

    setupEventListeners() {
        // Edit profile button
        const editBtn = document.querySelector('.btn-outline[onclick="editProfile()"]');
        if (editBtn) {
            editBtn.addEventListener('click', () => this.editProfile());
        }
        
        // Avatar change (header avatar)
        const changeBtn = document.getElementById('change-avatar');
        const fileInput = document.getElementById('avatar-input');
        if (changeBtn && fileInput) {
            changeBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => this.handleAvatarUpload(e));
        }

        // Cover change
        const changeCoverBtn = document.getElementById('change-cover');
        const coverInput = document.getElementById('cover-input');
        if (changeCoverBtn && coverInput) {
            changeCoverBtn.addEventListener('click', () => coverInput.click());
            coverInput.addEventListener('change', (e) => this.handleCoverUpload(e));
        }

        // Edit Profile modal hooks (Instagram-like)
        const editSave = document.getElementById('edit-profile-save');
        const editCancel = document.getElementById('edit-profile-cancel');
        const editAvatarBtn = document.getElementById('edit-avatar-btn');
        const editAvatarInput = document.getElementById('edit-avatar-input');
        const editOverlay = document.getElementById('edit-profile-modal');

        if (editSave) editSave.addEventListener('click', () => this.saveProfileChanges());
        if (editCancel) editCancel.addEventListener('click', () => this.hideEditProfileModal());
        if (editAvatarBtn && editAvatarInput) {
            editAvatarBtn.addEventListener('click', () => editAvatarInput.click());
            editAvatarInput.addEventListener('change', (e) => this.handleEditAvatarUpload(e));
        }
        if (editOverlay) editOverlay.addEventListener('click', (e) => { if (e.target === editOverlay) this.hideEditProfileModal(); });

        // Menu item clicks
        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const onclick = e.currentTarget.getAttribute('onclick');
                if (onclick) {
                    const action = onclick.match(/\b(\w+)\b/)?.[1];
                    if (action && typeof this[action] === 'function') {
                        this[action]();
                    }
                }
            });
        });

        // Edit item modal actions
        const saveBtn = document.getElementById('edit-item-save');
        const cancelBtn = document.getElementById('edit-item-cancel');
        if (saveBtn) saveBtn.addEventListener('click', () => this.saveEditModal());
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.hideEditModal());

        // Close modal on overlay click
        const overlay = document.getElementById('edit-item-modal');
        if (overlay) overlay.addEventListener('click', (e) => { if (e.target === overlay) this.hideEditModal(); });

        // Inbox/deleted/cropper overlay close handlers
        const inboxOverlay = document.getElementById('inbox-modal'); if (inboxOverlay) inboxOverlay.addEventListener('click', (e)=>{ if (e.target === inboxOverlay) inboxOverlay.style.display='none'; });
        const deletedOverlay = document.getElementById('deleted-items-modal'); if (deletedOverlay) deletedOverlay.addEventListener('click', (e)=>{ if (e.target === deletedOverlay) deletedOverlay.style.display='none'; });
        const cropperOverlay = document.getElementById('cropper-modal'); if (cropperOverlay) cropperOverlay.addEventListener('click', (e)=>{ if (e.target === cropperOverlay) cropperOverlay.style.display='none'; });


        // Live preview updates in edit modal
        const nameInput = document.getElementById('edit-name'); const bioInput = document.getElementById('edit-bio'); const locationInput = document.getElementById('edit-location');
        if (nameInput) nameInput.addEventListener('input', () => this.updateProfilePreview());
        if (bioInput) bioInput.addEventListener('input', () => this.updateProfilePreview());
        if (locationInput) locationInput.addEventListener('input', () => this.updateProfilePreview());
    }

    render() {
        this.renderProfileInfo();
        this.renderStats();
        this.renderMyItems();
        this.renderShowroom();
        this.renderActiveBids();
        this.renderWins();
    }

    renderProfileInfo() {
        if (!this.currentUser) return;
        
        // Update avatar
        const avatar = document.getElementById('profile-avatar');
        if (avatar) {
            if (this.currentUser.avatarImage) {
                // show uploaded image
                avatar.style.backgroundImage = `url('${this.currentUser.avatarImage}')`;
                avatar.innerHTML = '';
            } else {
                avatar.style.backgroundImage = '';
                avatar.innerHTML = '';
                avatar.textContent = this.currentUser.avatar || (this.currentUser.name || 'U').charAt(0).toUpperCase();

                // Generate random color based on name
                const colors = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed'];
                const colorIndex = (this.currentUser.name || 'A').charCodeAt(0) % colors.length;
                avatar.style.background = `linear-gradient(135deg, ${colors[colorIndex]}, ${colors[(colorIndex + 1) % colors.length]})`;
            }
        }

        // Update cover photo
        const cover = document.getElementById('profile-cover');
        if (cover) {
            if (this.currentUser.coverImage) {
                cover.style.backgroundImage = `url('${this.currentUser.coverImage}')`;
            } else {
                cover.style.backgroundImage = 'linear-gradient(135deg, var(--dark-2) 0%, var(--dark-3) 100%)';
            }
        }
        
        // Update name and phone
        document.getElementById('profile-name').textContent = this.currentUser.name;
        document.getElementById('profile-phone').textContent = this.currentUser.phone ? `+91 ${this.currentUser.phone}` : (this.currentUser.email || '');
        
        // Update member since
        const memberSince = document.getElementById('member-since');
        if (memberSince && this.currentUser.createdAt) {
            const date = new Date(this.currentUser.createdAt);
            memberSince.textContent = date.getFullYear();
        }

        // Update bio & location
        const bioEl = document.getElementById('profile-bio');
        if (bioEl) {
            bioEl.textContent = this.currentUser.bio || 'Premium collector & active bidder. Searching for rare finds and modern designs.';
        }
        const locationEl = document.getElementById('profile-location');
        if (locationEl) {
            locationEl.textContent = this.currentUser.location || 'Mumbai, India';
        }

        // Render interests badges
        const interestsContainer = document.getElementById('profile-interests');
        if (interestsContainer) {
            interestsContainer.innerHTML = '';
            const interests = this.currentUser.interests || [];
            if (interests.length === 0) {
                interestsContainer.innerHTML = '<span class="badge badge-outline" style="color: var(--text-muted);">None</span>';
            } else {
                interests.forEach(interest => {
                    const badge = document.createElement('span');
                    badge.className = 'badge badge-outline';
                    badge.style.borderColor = 'var(--primary)';
                    badge.style.color = 'var(--primary)';
                    badge.textContent = interest.trim();
                    interestsContainer.appendChild(badge);
                });
            }
        }

        // Render categories badges
        const categoriesContainer = document.getElementById('profile-categories');
        if (categoriesContainer) {
            categoriesContainer.innerHTML = '';
            const categories = this.currentUser.categories || [];
            if (categories.length === 0) {
                categoriesContainer.innerHTML = '<span class="badge badge-outline" style="color: var(--text-muted);">None</span>';
            } else {
                categories.forEach(cat => {
                    const badge = document.createElement('span');
                    badge.className = 'badge badge-outline';
                    badge.style.borderColor = 'var(--accent)';
                    badge.style.color = 'var(--accent)';
                    badge.textContent = this.getCategoryName(cat);
                    categoriesContainer.appendChild(badge);
                });
            }
        }

        // Render social links
        const socialsContainer = document.getElementById('profile-socials');
        if (socialsContainer) {
            socialsContainer.innerHTML = '';
            const links = this.currentUser.socialLinks || {};
            
            const addLink = (platform, iconText, value) => {
                if (!value) return;
                const link = document.createElement('a');
                link.href = platform === 'website' ? (value.startsWith('http') ? value : 'http://' + value) : `https://${platform}.com/${value}`;
                link.target = '_blank';
                link.className = 'social-link';
                link.style.textDecoration = 'none';
                link.style.color = 'var(--primary)';
                link.style.fontSize = '1.1rem';
                link.style.display = 'flex';
                link.style.alignItems = 'center';
                link.style.gap = '0.25rem';
                
                let label = platform.charAt(0).toUpperCase() + platform.slice(1);
                link.innerHTML = `<span>${iconText}</span> <span style="font-size: 0.8rem; font-weight:600; color:var(--text-secondary);">${label}</span>`;
                socialsContainer.appendChild(link);
            };
            
            addLink('twitter', '🐦', links.twitter);
            addLink('instagram', '📸', links.instagram);
            addLink('github', '💻', links.github);
            addLink('website', '🌐', links.website);
            
            if (socialsContainer.children.length === 0) {
                socialsContainer.innerHTML = '<span style="font-size: 0.85rem; color: var(--text-muted); font-style: italic;">No social links added</span>';
            }
        }
    }

    renderStats() {
        if (!this.currentUser) return;
        
        // Calculate stats
        const itemsListed = this.userItems.length;
        const itemsSold = this.userItems.filter(item => item.sold).length;
        const totalBids = this.userBids.length;
        const rating = this.currentUser.stats?.rating || 0.0;
        
        // compute earnings from transactions
        const txns = JSON.parse(localStorage.getItem('flexy_transactions_' + this.currentUser.id) || '[]');
        const earnings = txns.filter(t => t.type === 'credit').reduce((s, t) => s + (t.amount || 0), 0);
        
        // Update stats
        document.getElementById('items-listed').textContent = itemsListed;
        document.getElementById('items-sold').textContent = itemsSold;
        document.getElementById('total-bids').textContent = totalBids;
        document.getElementById('rating').textContent = rating.toFixed(1);

        // Update items bought
        const boughtEl = document.getElementById('items-bought');
        if (boughtEl) {
            boughtEl.textContent = this.userWins ? this.userWins.length : 0;
        }

        // create or update earnings card
        let earningsEl = document.getElementById('items-earnings');
        if (!earningsEl) {
            const grid = document.querySelector('.stats-grid');
            if (grid) {
                const div = document.createElement('div');
                div.className = 'stat-card glass-card';
                div.innerHTML = `<div class="stat-number" id="items-earnings">₹${this.formatPrice(earnings)}</div><div class="stat-label">Earnings</div>`;
                grid.appendChild(div);
            }
        } else {
            earningsEl.textContent = `₹${this.formatPrice(earnings)}`;
        }
        
        // Update user stats in localStorage
        this.currentUser.stats = { itemsListed, itemsSold, totalBids, rating };
        localStorage.setItem('flexy_user', JSON.stringify(this.currentUser));

        // Update following count
        const following = JSON.parse(localStorage.getItem('flexy_following_' + this.currentUser.id) || '[]');
        const followingEl = document.getElementById('following-count');
        if (followingEl) followingEl.textContent = following.length;

        // refresh notification & inbox badges
        this.renderNotificationsBadge();
        this.renderInboxBadge();
    }

    renderActiveBids() {
        const container = document.getElementById('my-bids-list');
        if (!container) return;
        
        if (this.userBids.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
                        <path d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" 
                              stroke="#D1D5DB" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    <h4>No Active Bids</h4>
                    <p>Start bidding on items to see them here</p>
                    <button class="btn btn-primary mt-4" onclick="window.location.href='home.html'">
                        Browse Items
                    </button>
                </div>
            `;
            return;
        }
        
        // Get items for active bids
        const allItems = JSON.parse(localStorage.getItem('flexy_items') || '[]');
        const activeBids = this.userBids.filter(bid => {
            const item = allItems.find(i => i.id === bid.itemId);
            return item && !item.expired && !item.sold;
        }).slice(0, 5);
        
        container.innerHTML = activeBids.map(bid => {
            const item = allItems.find(i => i.id === bid.itemId);
            if (!item) return '';
            
            return `
                <div class="bid-item" data-bid-id="${bid.id}">
                    <div class="bid-item-header">
                        <div class="bid-item-image">${item.images[0] || '📦'}</div>
                        <div class="bid-item-info">
                            <div class="bid-item-title">${item.title}</div>
                            <div class="bid-item-meta">
                                <span class="bid-category">${this.getCategoryName(item.category)}</span>
                                <span class="bid-time">${this.formatTime(bid.createdAt)}</span>
                            </div>
                        </div>
                    </div>
                    <div class="bid-item-details">
                        <div class="bid-amount">
                            <span class="bid-label">Your Bid:</span>
                            <span class="bid-value">₹${this.formatPrice(bid.amount)}</span>
                        </div>
                        <div class="bid-status ${bid.status || 'active'}">
                            ${bid.status === 'winning' ? '🏆 Winning' : 
                              bid.status === 'outbid' ? '📉 Outbid' : 
                              bid.status === 'won' ? '🏆 WON' :
                              '🔄 Active'}
                        </div>
                    </div>
                    <button class="btn btn-outline btn-sm" onclick="profile.increaseBid('${bid.id}')">
                        Increase Bid
                    </button>
                </div>
            `;
        }).join('');
    }

    // Render user's own listed items
    renderMyItems() {
        const container = document.getElementById('my-items-list');
        if (!container) return;

        if (!this.userItems || this.userItems.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h4>No items listed</h4>
                    <p>List your first item to start selling.</p>
                    <button class="btn btn-primary mt-4" onclick="window.location.href='sell.html'">Sell an Item</button>
                </div>
            `;
            return;
        }

        container.innerHTML = this.userItems.map(item => `
            <div class="item-card-small" data-item-id="${item.id}">
                <img src="${item.images && item.images[0] ? item.images[0] : 'assets/placeholder.svg'}" alt="${item.title}">
                <div class="meta">
                    <div class="item-title">${item.title}</div>
                    <div class="item-stats">₹${this.formatPrice(item.price)} • ${item.bids} bids • ${item.sold ? 'Sold' : (item.expired ? 'Expired' : 'Active')}</div>
                    ${item.published === false ? `<div class="badge muted" style="margin-top:6px">Unpublished</div>` : ''}
                </div>
                <div class="actions">
                    <button class="btn btn-outline btn-sm" onclick="window.location.href='item.html?id=${encodeURIComponent(item.id)}'">View</button>
                    <button class="btn btn-primary btn-sm" onclick="profile.showEditModal('${item.id}')">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="profile.removeItem('${item.id}')">Remove</button>
                </div>
            </div>
        `).join('');
    }

    // Render user's wins
    renderWins() {
        const container = document.getElementById('my-wins-list');
        if (!container) return;

        const wins = JSON.parse(localStorage.getItem('flexy_user_wins_' + this.currentUser.id) || '[]');
        if (!wins || wins.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h4>No wins yet</h4>
                    <p>Win an auction to see it here.</p>
                    <button class="btn btn-primary mt-4" onclick="window.location.href='home.html'">Browse Auctions</button>
                </div>
            `;
            return;
        }

        const items = JSON.parse(localStorage.getItem('flexy_items') || '[]');
        container.innerHTML = wins.map(win => {
            const item = items.find(i => i.id === win.itemId) || {};
            return `
                <div class="item-card-small">
                    <img src="${item.images && item.images[0] ? item.images[0] : 'assets/placeholder.svg'}" alt="${item.title}">
                    <div class="meta">
                        <div class="item-title">${win.title || item.title}</div>
                        <div class="item-stats">₹${this.formatPrice(win.amount)} • ${new Date(win.date).toLocaleDateString()}</div>
                    </div>
                    <div class="actions">
                        <button class="btn btn-outline btn-sm" onclick="window.location.href='item.html?id=${encodeURIComponent(win.itemId)}'">View</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Show tab content
    showTab(name) {
        // Toggle tab button classes
        document.querySelectorAll('.tab-btn').forEach(b => {
            b.classList.remove('active');
            b.style.color = 'var(--text-secondary)';
            b.style.borderBottomColor = 'transparent';
        });
        
        let btnTextMatch = name;
        if (name === 'showroom') btnTextMatch = 'showroom';
        if (name === 'items') btnTextMatch = 'listings';
        if (name === 'collections') btnTextMatch = 'collections';
        if (name === 'bids') btnTextMatch = 'bids';
        if (name === 'wins') btnTextMatch = 'wins';
        
        const btn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.textContent.toLowerCase().includes(btnTextMatch));
        if (btn) {
            btn.classList.add('active');
            btn.style.color = 'var(--text-primary)';
            btn.style.borderBottomColor = 'var(--primary)';
        }

        // Toggle visibility of tab divs
        const tabIds = ['showroom', 'items', 'collections', 'bids', 'wins'];
        tabIds.forEach(id => {
            const el = document.getElementById(`tab-${id}`);
            if (el) {
                if (id === name) {
                    el.style.display = 'block';
                } else {
                    el.style.display = 'none';
                }
            }
        });

        // Re-render relevant content
        if (name === 'showroom') this.renderShowroom();
        if (name === 'items') this.renderMyItems();
        if (name === 'collections') this.renderCollections();
        if (name === 'bids') this.renderActiveBids();
        if (name === 'wins') this.renderWins();
    }

    getCategoryName(categoryId) {
        const categories = {
            'electronics': 'Electronics',
            'fashion': 'Fashion',
            'home': 'Home',
            'garden': 'Garden',
            'gaming': 'Gaming',
            'collectibles': 'Collectibles',
            'art': 'Art',
            'vehicles': 'Vehicles'
        };
        return categories[categoryId] || categoryId;
    }

    formatPrice(price) {
        return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    formatTime(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
        if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        return 'Just now';
    }

    editProfile() {
        // Open the Instagram-like edit modal instead of prompt
        this.showEditProfileModal();
    }

    handleAvatarUpload(e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { this.showNotification('Please upload an image file', 'error'); return; }
        const reader = new FileReader();
        reader.onload = (ev) => {
            // Resize image to max 512px to keep data URL small
            const img = new Image();
            img.onload = () => {
                const max = 512;
                let w = img.width, h = img.height;
                if (w > max || h > max) {
                    if (w > h) { h = Math.round(h * (max / w)); w = max; }
                    else { w = Math.round(w * (max / h)); h = max; }
                }
                const canvas = document.createElement('canvas');
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                this.currentUser.avatarImage = dataUrl;
                localStorage.setItem('flexy_user', JSON.stringify(this.currentUser));
                this.renderProfileInfo();
                this.showNotification('Profile photo updated', 'success');
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    }

    handleCoverUpload(e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { this.showNotification('Please upload an image file', 'error'); return; }
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
                const max = 1200;
                let w = img.width, h = img.height;
                if (w > max || h > max) {
                    if (w > h) { h = Math.round(h * (max / w)); w = max; }
                    else { w = Math.round(w * (max / h)); h = max; }
                }
                const canvas = document.createElement('canvas');
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.80);
                this.currentUser.coverImage = dataUrl;
                localStorage.setItem('flexy_user', JSON.stringify(this.currentUser));
                this.renderProfileInfo();
                this.showNotification('Cover photo updated', 'success');
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    }

    showMyItems() {
        // Show the items tab and render the list
        this.renderMyItems();
        this.showTab('items');
        const el = document.getElementById('my-items-list');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
    }

    showMyBids() {
        this.renderActiveBids();
        // Scroll to bids section
        document.getElementById('my-bids-list').scrollIntoView({ behavior: 'smooth' });
    }

    showSettings() {
        notify('Settings feature coming soon!', 'info');
    }

    showHelp() {
        const helpContent = `
            FLEXY Help & Support:
            
            1. How to list an item?
               - Click on "Sell" in the bottom navigation
               - Fill in item details and upload photos
               - Set your price and publish
            
            2. How to place a bid?
               - Browse items on Home or Search pages
               - Click "Place Bid" on any item
               - Enter your bid amount
            
            3. How to add money to wallet?
               - Go to Wallet page
               - Click "Add Money"
               - Enter amount and choose payment method
            
            4. Need more help?
               Email: support@flexy.com
               Phone: 1800-123-4567
        `;
        
        notify(helpContent, 'info');
    }

    // Notifications
    renderNotifications() {
        const key = 'flexy_notifications_' + this.currentUser.id;
        const notes = JSON.parse(localStorage.getItem(key) || '[]');

        // build modal
        let modal = document.querySelector('.notifications-modal');
        if (modal) modal.remove();
        modal = document.createElement('div'); modal.className = 'notifications-modal';

        if (!notes.length) {
            modal.innerHTML = `<div class="empty-state"><h4>No notifications</h4><p>You're all caught up.</p></div>`;
        } else {
            notes.slice(0, 20).forEach(n => {
                const row = document.createElement('div');
                row.className = 'notification-row' + (n.read ? '' : ' unread');
                row.innerHTML = `
                    <div style="flex:1">
                        <div>${n.message}</div>
                        <div class="time">${new Date(n.date).toLocaleString()}</div>
                    </div>
                `;
                modal.appendChild(row);
            });

            const actions = document.createElement('div'); actions.className = 'notification-actions';
            actions.innerHTML = `
                <button class="btn btn-outline btn-sm" onclick="profile.clearNotifications()">Clear</button>
                <button class="btn btn-primary btn-sm" onclick="profile.markAllRead()">Mark all read</button>
            `;
            modal.appendChild(actions);
        }

        document.body.appendChild(modal);
    }

    showNotifications() {
        this.renderNotifications();
        // hide badge
        const badge = document.getElementById('notif-count'); if (badge) { badge.style.display = 'none'; }
    }

    clearNotifications() {
        const key = 'flexy_notifications_' + this.currentUser.id;
        localStorage.setItem(key, JSON.stringify([]));
        const modal = document.querySelector('.notifications-modal'); if (modal) modal.remove();
        this.renderNotificationsBadge();
        notify('Notifications cleared', 'info');
    }

    markAllRead() {
        const key = 'flexy_notifications_' + this.currentUser.id;
        const notes = JSON.parse(localStorage.getItem(key) || '[]');
        notes.forEach(n => n.read = true);
        localStorage.setItem(key, JSON.stringify(notes));
        this.renderNotifications();
        this.renderNotificationsBadge();
    }

    renderNotificationsBadge() {
        const key = 'flexy_notifications_' + this.currentUser.id;
        const notes = JSON.parse(localStorage.getItem(key) || '[]');
        const unread = notes.filter(n => !n.read).length;
        const badge = document.getElementById('notif-count');
        if (badge) {
            if (unread > 0) {
                badge.style.display = 'inline-block';
                badge.textContent = unread;
            } else {
                badge.style.display = 'none';
            }
        }
    }

    // Edit and Remove item actions
    editItem(itemId) {
        const allItems = JSON.parse(localStorage.getItem('flexy_items') || '[]');
        const item = allItems.find(i => i.id === itemId);
        if (!item) { notify('Item not found', 'error'); return; }
        // Save to edit slot and redirect to sell page
        localStorage.setItem('flexy_edit_item', JSON.stringify(item));
        notify('Opening editor for your item', 'info');
        setTimeout(() => window.location.href = 'sell.html', 300);
    }

    // push a persistent notification for another user
    pushUserNotification(userId, message, type = 'info') {
        try {
            const key = 'flexy_notifications_' + userId;
            const list = JSON.parse(localStorage.getItem(key) || '[]');
            list.unshift({ id: 'n_' + Date.now(), message, type, date: Date.now(), read: false });
            localStorage.setItem(key, JSON.stringify(list));
        } catch (e) { console.error('push notif failed', e); }
    }

    // Inline edit modal
    showEditModal(itemId) {
        const items = JSON.parse(localStorage.getItem('flexy_items') || '[]');
        const item = items.find(i => i.id === itemId);
        if (!item) { notify('Item not found', 'error'); return; }
        this.editInlineId = itemId;
        document.getElementById('edit-item-title').value = item.title || '';
        document.getElementById('edit-item-price').value = item.price || '';
        document.getElementById('edit-item-desc').value = item.description || '';
        document.getElementById('edit-item-location').value = item.location || '';
        // initialize image buffer for edit
        this._editInlineImages = item.images ? item.images.slice() : [];
        this.renderEditItemImages();
        const editImagesInput = document.getElementById('edit-item-images'); if (editImagesInput) editImagesInput.onchange = (e) => this.handleEditItemImages(e);
        const modal = document.getElementById('edit-item-modal'); if (modal) { modal.style.display = 'flex'; modal.setAttribute('aria-hidden','false'); }
    }

    hideEditModal() {
        const modal = document.getElementById('edit-item-modal'); if (modal) { modal.style.display = 'none'; modal.setAttribute('aria-hidden','true'); }
        this.editInlineId = null;
        ['edit-item-title','edit-item-price','edit-item-desc','edit-item-location'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
    }

    // Show the Instagram-like Edit Profile modal
    showEditProfileModal() {
        if (!this.currentUser) return;
        document.getElementById('edit-name').value = this.currentUser.name || '';
        document.getElementById('edit-bio').value = this.currentUser.bio || '';
        document.getElementById('edit-location').value = this.currentUser.location || '';
        document.getElementById('edit-interests').value = (this.currentUser.interests || []).join(', ');

        // Check checkboxes for categories
        const categoryCheckboxes = document.querySelectorAll('input[name="edit-categories"]');
        const userCats = this.currentUser.categories || [];
        categoryCheckboxes.forEach(cb => {
            cb.checked = userCats.includes(cb.value);
        });

        // Populate social links
        const links = this.currentUser.socialLinks || {};
        document.getElementById('edit-social-twitter').value = links.twitter || '';
        document.getElementById('edit-social-instagram').value = links.instagram || '';
        document.getElementById('edit-social-github').value = links.github || '';
        document.getElementById('edit-social-website').value = links.website || '';

        const modal = document.getElementById('edit-profile-modal');
        if (modal) {
            modal.classList.add('active');
            modal.setAttribute('aria-hidden', 'false');
        }
        // populate live preview
        this.updateProfilePreview();
    }

    hideEditProfileModal() {
        const modal = document.getElementById('edit-profile-modal');
        if (modal) {
            modal.classList.remove('active');
            modal.setAttribute('aria-hidden', 'true');
        }
    }

    saveProfileChanges() {
        const name = document.getElementById('edit-name').value.trim();
        const bio = document.getElementById('edit-bio').value.trim();
        const location = document.getElementById('edit-location').value.trim();

        if (!name) { notify('Please enter your name', 'warning'); return; }

        this.currentUser.name = name;
        this.currentUser.bio = bio;
        this.currentUser.location = location;

        // Save interests (split by comma and clean)
        const interestsVal = document.getElementById('edit-interests').value;
        this.currentUser.interests = interestsVal ? interestsVal.split(',').map(s => s.trim()).filter(Boolean) : [];

        // Save categories
        const categoryCheckboxes = document.querySelectorAll('input[name="edit-categories"]');
        const selectedCats = [];
        categoryCheckboxes.forEach(cb => {
            if (cb.checked) selectedCats.push(cb.value);
        });
        this.currentUser.categories = selectedCats;

        // Save social links
        this.currentUser.socialLinks = {
            twitter: document.getElementById('edit-social-twitter').value.trim(),
            instagram: document.getElementById('edit-social-instagram').value.trim(),
            github: document.getElementById('edit-social-github').value.trim(),
            website: document.getElementById('edit-social-website').value.trim()
        };

        localStorage.setItem('flexy_user', JSON.stringify(this.currentUser));
        this.renderProfileInfo();
        this.loadUserData();
        this.renderStats();
        this.hideEditProfileModal();
        notify('Profile updated successfully', 'success');
    }

    // Update the small live preview inside the edit modal
    updateProfilePreview() {
        const name = document.getElementById('edit-name').value.trim() || this.currentUser.name || 'Your Name';
        const bio = document.getElementById('edit-bio').value.trim() || this.currentUser.bio || '';
        const avatar = document.getElementById('preview-avatar');
        const previewName = document.getElementById('preview-name');
        const previewBio = document.getElementById('preview-bio');
        if (previewName) previewName.textContent = name;
        if (previewBio) previewBio.textContent = bio;
        if (avatar) {
            if (this.currentUser.avatarImage) {
                avatar.style.backgroundImage = `url('${this.currentUser.avatarImage}')`; avatar.textContent = '';
            } else {
                avatar.style.backgroundImage = '';
                avatar.textContent = (name || 'U').charAt(0).toUpperCase();
            }
        }
    }

    // Avatar upload specifically for the edit modal
    handleEditAvatarUpload(e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { this.showNotification('Please upload an image file', 'error'); return; }
        const reader = new FileReader();
        reader.onload = (ev) => {
            // open cropper with image
            this.showCropperWithImage(ev.target.result);
        };
        reader.readAsDataURL(file);
    }

    saveEditModal() {
        const id = this.editInlineId; if (!id) return;
        const title = document.getElementById('edit-item-title').value.trim();
        const price = parseInt(document.getElementById('edit-item-price').value) || 0;
        const desc = document.getElementById('edit-item-desc').value.trim();
        const location = document.getElementById('edit-item-location').value.trim();
        if (!title || price <= 0) { notify('Please provide title and valid price', 'warning'); return; }

        let items = JSON.parse(localStorage.getItem('flexy_items') || '[]');
        const idx = items.findIndex(i => i.id === id);
        if (idx === -1) { notify('Item not found', 'error'); return; }
        items[idx].title = title; items[idx].price = price; items[idx].description = desc; items[idx].location = location;
        // update images if edited
        if (this._editInlineImages && this._editInlineImages.length) items[idx].images = this._editInlineImages.slice();
        localStorage.setItem('flexy_items', JSON.stringify(items));

        this.hideEditModal();
        this.loadUserData();
        this.renderMyItems();
        notify('Item updated', 'success');
    }

    // Remove an item (soft delete with refunds and undo)
    removeItem(itemId) {
        if (!confirm('Remove this item? This action can be undone for 15 seconds.')) return;
        const items = JSON.parse(localStorage.getItem('flexy_items') || '[]');
        const idx = items.findIndex(i => i.id === itemId);
        if (idx === -1) { notify('Item not found', 'error'); return; }
        const item = items[idx];

        // Process refunds for all bids on this item
        const bids = JSON.parse(localStorage.getItem('flexy_bids_' + itemId) || '[]');
        bids.forEach(b => {
            try {
                const uKey = 'flexy_user_' + b.userId;
                const user = JSON.parse(localStorage.getItem(uKey) || 'null');
                if (!user) return;
                user.reserved = user.reserved || {};
                const reservedAmt = user.reserved[itemId] || 0;
                const refund = reservedAmt || b.amount || 0;
                user.balance = (user.balance || 0) + refund;
                if (user.reserved && user.reserved[itemId]) delete user.reserved[itemId];
                localStorage.setItem(uKey, JSON.stringify(user));

                // Create transaction record
                const txKey = 'flexy_transactions_' + user.id;
                const txs = JSON.parse(localStorage.getItem(txKey) || '[]');
                txs.unshift({ id: 'txn_' + Date.now(), type: 'credit', amount: refund, note: `Refund for item ${item.title}`, date: Date.now() });
                localStorage.setItem(txKey, JSON.stringify(txs));

                // Update user's per-item bids
                const ubKey = 'flexy_user_bids_' + user.id;
                let ub = JSON.parse(localStorage.getItem(ubKey) || '[]');
                ub = ub.map(u => u.itemId === itemId ? { ...u, status: 'refunded' } : u);
                localStorage.setItem(ubKey, JSON.stringify(ub));

                // Push notification
                this.pushUserNotification(user.id, `You have been refunded ₹${this.formatPrice(refund)} for item \"${item.title}\"`, 'info');
            } catch (e) { console.error('refund failed', e); }
        });

        // Remove the bids list for this item
        localStorage.removeItem('flexy_bids_' + itemId);

        // Soft-delete with undo support
        const deletedKey = 'flexy_deleted_items_' + this.currentUser.id;
        const deleted = JSON.parse(localStorage.getItem(deletedKey) || '[]');
        deleted.unshift({ ...item, deletedAt: Date.now() });
        localStorage.setItem(deletedKey, JSON.stringify(deleted));

        // Remove from main items list
        items.splice(idx, 1);
        localStorage.setItem('flexy_items', JSON.stringify(items));

        // Show undo banner
        this.showUndoBanner(item);

        // Schedule permanent deletion after 15s
        setTimeout(() => {
            let dList = JSON.parse(localStorage.getItem(deletedKey) || '[]');
            const delIdx = dList.findIndex(d => d.id === itemId);
            if (delIdx !== -1) {
                dList.splice(delIdx, 1);
                localStorage.setItem(deletedKey, JSON.stringify(dList));
                // announce expiry
                notify('Undo period expired — item permanently deleted', 'info');
            }
        }, 15000);

        this.loadUserData();
        this.renderMyItems();
        this.renderShowroom();
        notify('Item removed. You can undo within 15 seconds.', 'info');
    }

    showUndoBanner(item) {
        // remove any existing banner
        const existing = document.getElementById('undo-banner'); if (existing) existing.remove();
        const banner = document.createElement('div');
        banner.id = 'undo-banner';
        banner.className = 'undo-banner';
        banner.innerHTML = `
            <div>Item <strong>${item.title}</strong> removed. <button class="btn btn-link" id="undo-restore">Undo</button></div>
            <div class="undo-countdown">15</div>
        `;
        document.body.appendChild(banner);

        const restoreBtn = document.getElementById('undo-restore');
        if (restoreBtn) restoreBtn.addEventListener('click', () => this.restoreDeletedItem(item.id));

        let count = 15;
        const countdown = banner.querySelector('.undo-countdown');
        const tid = setInterval(() => {
            count--; if (countdown) countdown.textContent = String(count);
            if (count <= 0) { clearInterval(tid); banner.remove(); }
        }, 1000);

        // remove banner after 15s
        setTimeout(() => { const el = document.getElementById('undo-banner'); if (el) el.remove(); }, 15000);
    }

    restoreDeletedItem(itemId) {
        const key = 'flexy_deleted_items_' + this.currentUser.id;
        let deleted = JSON.parse(localStorage.getItem(key) || '[]');
        const idx = deleted.findIndex(d => d.id === itemId);
        if (idx === -1) { notify('No deleted item found', 'error'); return; }
        const item = deleted[idx];
        deleted.splice(idx, 1);
        localStorage.setItem(key, JSON.stringify(deleted));

        const items = JSON.parse(localStorage.getItem('flexy_items') || '[]');
        items.unshift(item);
        localStorage.setItem('flexy_items', JSON.stringify(items));

        const banner = document.getElementById('undo-banner'); if (banner) banner.remove();
        this.loadUserData(); this.renderMyItems(); this.renderShowroom();
        notify('Item restored', 'success');
    }

    // Export notifications
    exportNotifications(format = 'json') {
        const key = 'flexy_notifications_' + this.currentUser.id;
        const notes = JSON.parse(localStorage.getItem(key) || '[]');
        if (!notes.length) { notify('No notifications to export', 'info'); return; }

        const filenameBase = `notifications_${this.currentUser.id}_${new Date().toISOString().slice(0,10)}`;
        if (format === 'json') {
            const blob = new Blob([JSON.stringify(notes, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = filenameBase + '.json'; document.body.appendChild(a); a.click(); a.remove();
            URL.revokeObjectURL(url);
            notify('Exported notifications (JSON)', 'success');
            return;
        }

        // CSV
        const rows = [['id','message','type','date','read']];
        notes.forEach(n => rows.push([`"${n.id}"`, `"${n.message.replace(/"/g,'""')}"`, n.type, new Date(n.date).toLocaleString(), n.read]));
        const csv = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = filenameBase + '.csv'; document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
        notify('Exported notifications (CSV)', 'success');
    }

    // --- Inbox / Emails ---
    showInbox() {
        const key = 'flexy_emails_' + this.currentUser.id;
        const mails = JSON.parse(localStorage.getItem(key) || '[]');
        this.renderInbox(mails);
        const modal = document.getElementById('inbox-modal'); if (modal) { modal.style.display = 'flex'; modal.setAttribute('aria-hidden','false'); }
        this.renderInboxBadge();
    }

    renderInbox(mails) {
        const list = document.getElementById('inbox-list');
        if (!list) return;
        if (!mails || mails.length === 0) {
            list.innerHTML = `<div class="empty-state"><h4>No messages</h4><p>Your inbox is empty.</p></div>`;
            document.getElementById('preview-subject').textContent = 'Select a message';
            document.getElementById('preview-body').textContent = '';
            return;
        }

        list.innerHTML = mails.map(m => `
            <div class="inbox-row ${m.read ? 'read' : 'unread'}" data-mail-id="${m.id}" onclick="profile.openEmail('${m.id}')">
                <div class="inbox-title">${m.subject}</div>
                <div class="inbox-meta">${new Date(m.date).toLocaleString()}</div>
            </div>
        `).join('');

        document.getElementById('inbox-count-label').textContent = `${mails.length} message(s)`;
    }

    openEmail(mailId) {
        const key = 'flexy_emails_' + this.currentUser.id;
        const mails = JSON.parse(localStorage.getItem(key) || '[]');
        const mail = mails.find(m => m.id === mailId);
        if (!mail) return;
        // mark read
        mail.read = true;
        localStorage.setItem(key, JSON.stringify(mails));
        this.renderInbox(mails);
        this.renderInboxBadge();

        // show preview
        document.getElementById('preview-subject').textContent = mail.subject;
        document.getElementById('preview-body').textContent = mail.body;

        const markBtn = document.getElementById('preview-mark-read');
        const deleteBtn = document.getElementById('preview-delete');
        if (markBtn) markBtn.textContent = mail.read ? 'Mark unread' : 'Mark read';
        if (markBtn) markBtn.onclick = () => this.toggleMailRead(mailId);
        if (deleteBtn) deleteBtn.onclick = () => this.deleteEmail(mailId);
    }

    toggleMailRead(mailId) {
        const key = 'flexy_emails_' + this.currentUser.id;
        const mails = JSON.parse(localStorage.getItem(key) || '[]');
        const idx = mails.findIndex(m => m.id === mailId);
        if (idx === -1) return;
        mails[idx].read = !mails[idx].read;
        localStorage.setItem(key, JSON.stringify(mails));
        this.renderInbox(mails);
        this.renderInboxBadge();
        // update preview button
        const markBtn = document.getElementById('preview-mark-read'); if (markBtn) markBtn.textContent = mails[idx].read ? 'Mark unread' : 'Mark read';
    }

    deleteEmail(mailId) {
        const key = 'flexy_emails_' + this.currentUser.id;
        let mails = JSON.parse(localStorage.getItem(key) || '[]');
        mails = mails.filter(m => m.id !== mailId);
        localStorage.setItem(key, JSON.stringify(mails));
        this.renderInbox(mails);
        this.renderInboxBadge();
        document.getElementById('preview-subject').textContent = 'Select a message';
        document.getElementById('preview-body').textContent = '';
        notify('Email deleted', 'info');
    }

    renderInboxBadge() {
        const key = 'flexy_emails_' + this.currentUser.id;
        const mails = JSON.parse(localStorage.getItem(key) || '[]');
        const unread = mails.filter(m => !m.read).length;
        const badge = document.getElementById('inbox-count');
        if (badge) {
            if (unread > 0) { badge.style.display = 'inline-block'; badge.textContent = unread; }
            else { badge.style.display = 'none'; }
        }
    }

    exportEmails(format = 'json') {
        const key = 'flexy_emails_' + this.currentUser.id;
        const mails = JSON.parse(localStorage.getItem(key) || '[]');
        if (!mails || !mails.length) { notify('No emails to export', 'info'); return; }
        const filenameBase = `emails_${this.currentUser.id}_${new Date().toISOString().slice(0,10)}`;
        if (format === 'json') {
            const blob = new Blob([JSON.stringify(mails, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = filenameBase + '.json'; document.body.appendChild(a); a.click(); a.remove();
            URL.revokeObjectURL(url);
            notify('Exported emails (JSON)', 'success');
            return;
        }
        const rows = [['id','subject','body','date','read']];
        mails.forEach(m => rows.push([`"${m.id}"`, `"${m.subject.replace(/"/g,'""')}"`, `"${m.body.replace(/"/g,'""')}"`, new Date(m.date).toLocaleString(), m.read]));
        const csv = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = filenameBase + '.csv'; document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
        notify('Exported emails (CSV)', 'success');
    }

    // --- Deleted Items Manager ---
    showDeletedItems() {
        const key = 'flexy_deleted_items_' + this.currentUser.id;
        const deleted = JSON.parse(localStorage.getItem(key) || '[]');
        const list = document.getElementById('deleted-items-list');
        if (!list) return;
        if (!deleted.length) {
            list.innerHTML = `<div class="empty-state"><h4>No deleted items</h4><p>Items you remove will appear here for recovery.</p></div>`;
        } else {
            list.innerHTML = deleted.map(d => `
                <div class="deleted-row">
                    <div class="deleted-meta"><strong>${d.title}</strong><div class="muted">Removed ${new Date(d.deletedAt).toLocaleString()}</div></div>
                    <div class="deleted-actions">
                        <button class="btn btn-outline btn-sm" onclick="profile.restoreDeletedItem('${d.id}')">Restore</button>
                        <button class="btn btn-danger btn-sm" onclick="profile.permanentlyDelete('${d.id}')">Delete</button>
                    </div>
                </div>
            `).join('');
        }
        const modal = document.getElementById('deleted-items-modal'); if (modal) { modal.style.display = 'flex'; modal.setAttribute('aria-hidden','false'); }
    }

    restoreDeletedItem(itemId) {
        const key = 'flexy_deleted_items_' + this.currentUser.id;
        let deleted = JSON.parse(localStorage.getItem(key) || '[]');
        const idx = deleted.findIndex(d => d.id === itemId);
        if (idx === -1) { notify('No deleted item found', 'error'); return; }
        const item = deleted[idx];
        deleted.splice(idx, 1);
        localStorage.setItem(key, JSON.stringify(deleted));

        const items = JSON.parse(localStorage.getItem('flexy_items') || '[]');
        items.unshift(item);
        localStorage.setItem('flexy_items', JSON.stringify(items));

        const modal = document.getElementById('deleted-items-modal'); if (modal) modal.style.display = 'none';
        this.loadUserData(); this.renderMyItems();
        notify('Item restored', 'success');
    }

    permanentlyDelete(itemId) {
        const key = 'flexy_deleted_items_' + this.currentUser.id;
        let deleted = JSON.parse(localStorage.getItem(key) || '[]');
        deleted = deleted.filter(d => d.id !== itemId);
        localStorage.setItem(key, JSON.stringify(deleted));
        this.showDeletedItems();
        notify('Item permanently deleted', 'info');
    }

    clearDeletedItems() {
        if (!confirm('Permanently delete all removed items?')) return;
        const key = 'flexy_deleted_items_' + this.currentUser.id; localStorage.setItem(key, JSON.stringify([]));
        this.showDeletedItems();
        notify('Cleared deleted items', 'success');
    }

    closeDeletedModal() { const modal = document.getElementById('deleted-items-modal'); if (modal) modal.style.display = 'none'; }

    // --- Cropper ---
    showCropperWithImage(dataUrl) {
        const modal = document.getElementById('cropper-modal'); if (!modal) return;
        const canvas = document.getElementById('cropper-canvas'); const ctx = canvas.getContext('2d');
        const img = new Image(); img.onload = () => {
            // store state
            this._cropImage = img; this._cropScale = 1; this._cropOffsetX = 0; this._cropOffsetY = 0;
            canvas.width = 400; canvas.height = 400; this._drawCropper();
        };
        img.src = dataUrl;
        modal.style.display = 'flex'; modal.setAttribute('aria-hidden','false');

        const zoom = document.getElementById('cropper-zoom'); if (zoom) {
            zoom.value = 1; zoom.oninput = (e) => { this._cropScale = parseFloat(e.target.value); this._drawCropper(); };
        }
        const rotate = document.getElementById('cropper-rotate'); if (rotate) { rotate.value = 0; rotate.oninput = (e) => { this._cropRotation = parseInt(e.target.value) * (Math.PI/180); this._drawCropper(); } }
        const reset = document.getElementById('cropper-reset'); if (reset) reset.onclick = () => { this._cropScale = 1; this._cropOffsetX = 0; this._cropOffsetY = 0; this._cropRotation = 0; if (zoom) zoom.value = 1; if (rotate) rotate.value = 0; this._drawCropper(); };

        // basic drag to move
        let dragging = false; let start = null;
        const onDown = (e) => { dragging = true; start = { x: e.clientX || e.touches?.[0]?.clientX, y: e.clientY || e.touches?.[0]?.clientY }; };
        const onMove = (e) => { if (!dragging) return; const p = { x: e.clientX || e.touches?.[0]?.clientX, y: e.clientY || e.touches?.[0]?.clientY }; this._cropOffsetX += (p.x - start.x); this._cropOffsetY += (p.y - start.y); start = p; this._drawCropper(); };
        const onUp = () => { dragging = false; start = null; };
        canvas.addEventListener('mousedown', onDown); canvas.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
        canvas.addEventListener('touchstart', onDown); canvas.addEventListener('touchmove', onMove); document.addEventListener('touchend', onUp);

        const saveBtn = document.getElementById('cropper-save'); if (saveBtn) saveBtn.onclick = () => this.saveCrop();
        const cancelBtn = document.getElementById('cropper-cancel'); if (cancelBtn) cancelBtn.onclick = () => { modal.style.display = 'none'; };
    }

    _drawCropper() {
        const canvas = document.getElementById('cropper-canvas'); if (!canvas || !this._cropImage) return; const ctx = canvas.getContext('2d');
        const w = canvas.width; const h = canvas.height;
        ctx.clearRect(0,0,w,h);
        // base background
        ctx.save(); ctx.fillStyle = '#111'; ctx.fillRect(0,0,w,h);

        const img = this._cropImage; const scale = this._cropScale || 1;
        const drawW = img.width * scale; const drawH = img.height * scale;
        const cx = w/2 + (this._cropOffsetX || 0); const cy = h/2 + (this._cropOffsetY || 0);

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(this._cropRotation || 0);
        ctx.drawImage(img, -drawW/2, -drawH/2, drawW, drawH);
        ctx.restore();

        // draw circular mask overlay
        ctx.globalCompositeOperation = 'destination-in'; ctx.beginPath(); ctx.arc(w/2, h/2, Math.min(w,h)/2 - 8, 0, Math.PI*2); ctx.fill(); ctx.restore();
    }

    saveCrop() {
        const canvas = document.createElement('canvas'); const size = 256; canvas.width = size; canvas.height = size; const ctx = canvas.getContext('2d');
        // draw circular crop from cropper canvas
        const c = document.getElementById('cropper-canvas'); ctx.drawImage(c, 72, 72, 256, 256, 0, 0, size, size);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        this.currentUser.avatarImage = dataUrl; localStorage.setItem('flexy_user', JSON.stringify(this.currentUser));
        // update UI
        const avatar = document.getElementById('profile-avatar'); if (avatar) { avatar.style.backgroundImage = `url('${dataUrl}')`; avatar.textContent = ''; }
        const modal = document.getElementById('cropper-modal'); if (modal) modal.style.display = 'none';
        notify('Profile photo updated (cropped)', 'success');
    }

    // Send notification emails simulation for this user (process unsent notifications)
    sendNotificationEmails() {
        const key = 'flexy_notifications_' + this.currentUser.id;
        const notes = JSON.parse(localStorage.getItem(key) || '[]');
        if (!notes || notes.length === 0) { notify('No notifications to send', 'info'); return; }

        const unsent = notes.filter(n => !n.emailSent);
        if (!unsent.length) { notify('All notifications already have emails sent', 'info'); return; }

        unsent.forEach(n => {
            this.simulateEmailSend(this.currentUser.id, `Notification: ${this.truncateText(n.message, 60)}`, n.message);
            n.emailSent = true;
        });

        localStorage.setItem(key, JSON.stringify(notes));
        notify(`Sent ${unsent.length} email(s)`, 'success');
    }

    // Append an email to the user's mailbox in localStorage
    simulateEmailSend(userId, subject, body) {
        const key = 'flexy_emails_' + userId;
        const mails = JSON.parse(localStorage.getItem(key) || '[]');
        mails.unshift({ id: 'mail_' + Date.now(), subject, body, date: Date.now(), read: false });
        localStorage.setItem(key, JSON.stringify(mails));
    }
















    // Edit inline item image helpers
    async handleEditItemImages(e) {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        this._editInlineImages = this._editInlineImages || [];
        for (const f of files) {
            if (!f.type.startsWith('image/')) continue;
            try {
                const dataUrl = await utils.compressImage(f, 1400, 0.8);
                this._editInlineImages.push(dataUrl);
                this.renderEditItemImages();
            } catch (err) { console.error('edit image compress failed', err); notify('Image processing failed', 'error'); }
        }
    }

    renderEditItemImages() {
        const preview = document.getElementById('edit-item-image-preview'); if (!preview) return;
        const imgs = this._editInlineImages || [];
        preview.innerHTML = imgs.map((src, idx) => `
            <div class="thumb" data-idx="${idx}" draggable="true">
                <img src="${src}" alt="img-${idx}">
                <div class="thumb-controls">
                    <button class="btn btn-sm" onclick="profile.editMoveImage(${idx}, -1)">◀</button>
                    <button class="btn btn-sm" onclick="profile.editMoveImage(${idx}, 1)">▶</button>
                </div>
                <div class="remove" onclick="profile.removeEditImage(${idx})">×</div>
            </div>
        `).join('');

        // add drag handlers
        preview.querySelectorAll('.thumb[draggable="true"]').forEach(el => {
            el.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', el.dataset.idx); el.classList.add('dragging'); });
            el.addEventListener('dragend', () => el.classList.remove('dragging'));
            el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('drag-over'); });
            el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
            el.addEventListener('drop', (e) => {
                e.preventDefault(); el.classList.remove('drag-over');
                const src = parseInt(e.dataTransfer.getData('text/plain'));
                const tgt = parseInt(el.dataset.idx);
                if (!isNaN(src) && !isNaN(tgt)) {
                    const arr = this._editInlineImages || [];
                    const [m] = arr.splice(src, 1);
                    arr.splice(tgt, 0, m);
                    this._editInlineImages = arr;
                    this.renderEditItemImages();
                }
            });
        });
    }

    removeEditImage(idx) {
        if (!this._editInlineImages) return;
        this._editInlineImages.splice(idx,1);
        this.renderEditItemImages();
    }



    editMoveImage(idx, dir) {
        const arr = this._editInlineImages || [];
        const to = idx + dir; if (to < 0 || to >= arr.length) return;
        const [m] = arr.splice(idx, 1); arr.splice(to, 0, m);
        this._editInlineImages = arr; this.renderEditItemImages();
    }











    // Enhanced cropper with rotation + reset (showCropperWithImage/_drawCropper/saveCrop modified)
    showCropperWithImage(dataUrl) {
        const modal = document.getElementById('cropper-modal'); if (!modal) return;
        const canvas = document.getElementById('cropper-canvas'); const ctx = canvas.getContext('2d');
        const img = new Image(); img.onload = () => {
            // store state
            this._cropImage = img; this._cropScale = 1; this._cropOffsetX = 0; this._cropOffsetY = 0; this._cropRotation = 0;
            canvas.width = 400; canvas.height = 400; this._drawCropper();
        };
        img.src = dataUrl;
        modal.style.display = 'flex'; modal.setAttribute('aria-hidden','false');

        const zoom = document.getElementById('cropper-zoom'); if (zoom) {
            zoom.value = 1; zoom.oninput = (e) => { this._cropScale = parseFloat(e.target.value); this._drawCropper(); };
        }
        const rotate = document.getElementById('cropper-rotate'); if (rotate) { rotate.value = 0; rotate.oninput = (e) => { this._cropRotation = parseInt(e.target.value) * (Math.PI/180); this._drawCropper(); } }
        const reset = document.getElementById('cropper-reset'); if (reset) reset.onclick = () => { this._cropScale = 1; this._cropOffsetX = 0; this._cropOffsetY = 0; this._cropRotation = 0; if (zoom) zoom.value = 1; if (rotate) rotate.value = 0; this._drawCropper(); };

        // basic drag to move
        let dragging = false; let start = null;
        const onDown = (e) => { dragging = true; start = { x: e.clientX || e.touches?.[0]?.clientX, y: e.clientY || e.touches?.[0]?.clientY }; };
        const onMove = (e) => { if (!dragging) return; const p = { x: e.clientX || e.touches?.[0]?.clientX, y: e.clientY || e.touches?.[0]?.clientY }; this._cropOffsetX += (p.x - start.x); this._cropOffsetY += (p.y - start.y); start = p; this._drawCropper(); };
        const onUp = () => { dragging = false; start = null; };
        canvas.addEventListener('mousedown', onDown); canvas.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
        canvas.addEventListener('touchstart', onDown); canvas.addEventListener('touchmove', onMove); document.addEventListener('touchend', onUp);

        const saveBtn = document.getElementById('cropper-save'); if (saveBtn) saveBtn.onclick = () => this.saveCrop();
        const cancelBtn = document.getElementById('cropper-cancel'); if (cancelBtn) cancelBtn.onclick = () => { modal.style.display = 'none'; };
    }

    _drawCropper() {
        const canvas = document.getElementById('cropper-canvas'); if (!canvas || !this._cropImage) return; const ctx = canvas.getContext('2d');
        const w = canvas.width; const h = canvas.height; ctx.clearRect(0,0,w,h); ctx.save(); ctx.fillStyle = '#111'; ctx.fillRect(0,0,w,h);
        const img = this._cropImage; const scale = this._cropScale || 1; const iw = img.width * scale; const ih = img.height * scale;
        const x = (w - iw) / 2 + (this._cropOffsetX || 0); const y = (h - ih) / 2 + (this._cropOffsetY || 0);
        ctx.drawImage(img, x, y, iw, ih);
        // draw circular mask overlay
        ctx.globalCompositeOperation = 'destination-in'; ctx.beginPath(); ctx.arc(w/2, h/2, Math.min(w,h)/2 - 8, 0, Math.PI*2); ctx.fill(); ctx.restore();
    }

    saveCrop() {
        const canvas = document.createElement('canvas'); const size = 256; canvas.width = size; canvas.height = size; const ctx = canvas.getContext('2d');
        // draw circular crop from cropper canvas
        const c = document.getElementById('cropper-canvas'); ctx.drawImage(c, 72, 72, 256, 256, 0, 0, size, size);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        this.currentUser.avatarImage = dataUrl; localStorage.setItem('flexy_user', JSON.stringify(this.currentUser));
        // update UI
        const avatar = document.getElementById('profile-avatar'); if (avatar) { avatar.style.backgroundImage = `url('${dataUrl}')`; avatar.textContent = ''; }
        const modal = document.getElementById('cropper-modal'); if (modal) modal.style.display = 'none';
        notify('Profile photo updated (cropped)', 'success');
    }

    increaseBid(bidId) {
        const bid = this.userBids.find(b => b.id === bidId);
        if (!bid) return;
        
        const allItems = JSON.parse(localStorage.getItem('flexy_items') || '[]');
        const item = allItems.find(i => i.id === bid.itemId);
        
        if (!item) return;
        
        const newBid = prompt(`Current bid: ₹${this.formatPrice(bid.amount)}\nEnter new bid amount (minimum: ₹${this.formatPrice(item.price)}):`, item.price);
        
        if (newBid) {
            const amount = parseInt(newBid.replace(/,/g, ''));
            
            if (isNaN(amount) || amount <= bid.amount) {
                notify(`New bid must be higher than current bid (₹${this.formatPrice(bid.amount)})`, 'warning');
                return;
            }
            
            if (this.currentUser.balance < amount) {
                notify('Insufficient balance. Please add money to your wallet.', 'error');
                window.location.href = 'wallet.html';
                return;
            }
            
            // Update bid amount
            bid.amount = amount;
            bid.updatedAt = Date.now();
            
            // Update item price if this is the highest bid
            if (amount > item.price) {
                item.price = amount;
                localStorage.setItem('flexy_items', JSON.stringify(allItems));
            }
            
            // Update user balance
            const difference = amount - bid.amount;
            this.currentUser.balance -= difference;
            
            // Save updates
            localStorage.setItem('flexy_user_bids_' + this.currentUser.id, JSON.stringify(this.userBids));
            localStorage.setItem('flexy_user', JSON.stringify(this.currentUser));
            
            this.showNotification(`Bid increased to ₹${this.formatPrice(amount)}`, 'success');
            this.renderActiveBids();
        }
    }

    renderShowroom() {
        const container = document.getElementById('my-showroom-grid');
        if (!container) return;

        const allItems = JSON.parse(localStorage.getItem('flexy_items') || '[]');
        const userShowcases = allItems.filter(item => item.sellerId === this.currentUser?.id && item.priceType === 'showcase');

        if (userShowcases.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 3rem;">
                    <h4>No showcases listed yet</h4>
                    <p>Share your first collection story to showcase it on your showroom.</p>
                    <button class="btn btn-primary mt-4" onclick="window.location.href='sell.html'">+ Add Showcase</button>
                </div>
            `;
            return;
        }

        container.innerHTML = userShowcases.map(item => `
            <div class="item-card glass-card animate-fade-up" style="display: flex; flex-direction: column;">
                <div class="item-image" style="height: 180px; background: var(--dark-2); cursor: pointer;" onclick="window.location.href='item.html?id=${encodeURIComponent(item.id)}'">
                    ${item.images && item.images[0] ? `<img src="${item.images[0]}" alt="${item.title}" style="width:100%; height:100%; object-fit:cover;">` : `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="width: 60px; height: 60px; color: var(--primary); margin: 60px auto; display: block;">
                        <polygon points="12,2 22,9 17,20 7,20 2,9" stroke-width="1.5" />
                        <circle cx="12" cy="12" r="3" />
                    </svg>
                    `}
                    <span class="featured-badge" style="background: rgba(49, 46, 129, 0.4); border-color: var(--primary); color: var(--primary); font-weight: 700;">💎 Showcase</span>
                </div>
                <div class="item-info" style="padding: 1.25rem; flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
                    <div>
                        <div class="item-title" style="font-size: 1.05rem; font-weight: 700; margin-bottom: 0.5rem; color: var(--text-primary);">${item.title}</div>
                        <p style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 0.75rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.4;">${item.story || item.description}</p>
                    </div>
                    <div>
                        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; border-top: 1px solid var(--border-glass); padding-top: 0.75rem; margin-top: 0.5rem;">
                            <span style="color: var(--accent); font-weight: 700;">Valuation: ₹${this.formatPrice(item.price)}</span>
                            <span style="color: var(--text-muted);">💖 ${item.likes || 0} • 💬 ${(item.comments || []).length}</span>
                        </div>
                        <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem;">
                            <button class="btn btn-outline btn-sm" style="flex: 1; font-size: 0.75rem; padding: 0.35rem;" onclick="window.location.href='item.html?id=${encodeURIComponent(item.id)}'">View</button>
                            <button class="btn btn-primary btn-sm" style="flex: 1; font-size: 0.75rem; padding: 0.35rem;" onclick="profile.editItem('${item.id}')">Edit</button>
                            <button class="btn btn-danger btn-sm" style="flex: 0.5; font-size: 0.75rem; padding: 0.35rem;" onclick="profile.removeItem('${item.id}')">Delete</button>
                        </div>
                    </div>
                </div>
            `).join('');
    }

    renderCollections() {
        const container = document.getElementById('my-collections-grid');
        if (!container) return;

        const key = 'flexy_collections_' + this.currentUser?.id;
        const collections = JSON.parse(localStorage.getItem(key) || '[]');

        if (collections.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 3rem;">
                    <h4>No collections created yet</h4>
                    <p>Group your items into curated collections to showcase your passion.</p>
                    <button class="btn btn-primary mt-4" onclick="openCreateCollectionModal()">+ Create Collection</button>
                </div>
            `;
            return;
        }

        container.innerHTML = collections.map(col => {
            const coverStyle = col.coverPhoto ? `background-image: url('${col.coverPhoto}');` : `background-image: linear-gradient(135deg, var(--dark-2) 0%, var(--dark-3) 100%);`;
            return `
                <div class="item-card glass-card animate-fade-up" style="display: flex; flex-direction: column;">
                    <div class="item-image" style="height: 180px; background-size: cover; background-position: center; ${coverStyle} cursor: pointer;" onclick="profile.viewCollectionDetail('${col.id}')">
                        <span class="featured-badge" style="background: rgba(167, 139, 250, 0.4); border-color: var(--primary); color: var(--primary); font-weight: 700;">📂 Collection (${col.itemIds ? col.itemIds.length : 0} Items)</span>
                    </div>
                    <div class="item-info" style="padding: 1.25rem; flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
                        <div>
                            <div class="item-title" style="font-size: 1.05rem; font-weight: 700; margin-bottom: 0.5rem; color: var(--text-primary);">${col.name}</div>
                            <p style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 0.75rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.4;">${col.description}</p>
                        </div>
                        <div>
                            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; border-top: 1px solid var(--border-glass); padding-top: 0.75rem; margin-top: 0.5rem;">
                                <span style="color: var(--accent); font-weight: 700;">❤️ ${col.likes || 0} Likes</span>
                                <span style="color: var(--text-muted);">👥 ${col.followers ? col.followers.length : 0} Followers</span>
                            </div>
                            <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem;">
                                <button class="btn btn-outline btn-sm" style="flex: 1; font-size: 0.75rem; padding: 0.35rem;" onclick="profile.viewCollectionDetail('${col.id}')">View Details</button>
                                <button class="btn btn-danger btn-sm" style="flex: 0.3; font-size: 0.75rem; padding: 0.35rem;" onclick="profile.deleteCollection('${col.id}')">Delete</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    openCreateCollectionModal() {
        if (!this.currentUser) return;
        
        // Reset form
        document.getElementById('collection-name').value = '';
        document.getElementById('collection-desc').value = '';
        document.getElementById('collection-cover-name').textContent = 'No image chosen';
        document.getElementById('collection-cover-input').value = '';
        this._tempCollectionCover = null;

        // Load items select list
        const selectList = document.getElementById('collection-items-select-list');
        if (selectList) {
            selectList.innerHTML = '';
            
            // Get all user showcases and auctions
            const allItems = JSON.parse(localStorage.getItem('flexy_items') || '[]');
            const userItems = allItems.filter(item => item.sellerId === this.currentUser?.id);

            if (userItems.length === 0) {
                selectList.innerHTML = '<p style="font-size: 0.8rem; color: var(--text-muted); padding: 0.5rem;">You need to list showcases or auctions first before creating a collection.</p>';
            } else {
                userItems.forEach(item => {
                    const label = document.createElement('label');
                    label.style.display = 'flex';
                    label.style.alignItems = 'center';
                    label.style.gap = '0.5rem';
                    label.style.fontSize = '0.85rem';
                    label.style.color = 'var(--text-secondary)';
                    label.style.cursor = 'pointer';
                    label.style.padding = '0.25rem 0';
                    
                    label.innerHTML = `
                        <input type="checkbox" name="collection-select-item" value="${item.id}">
                        <span>${item.title} <span style="font-size: 0.7rem; color: var(--text-muted);">(${item.priceType === 'showcase' ? 'Showcase' : 'Auction'})</span></span>
                    `;
                    selectList.appendChild(label);
                });
            }
        }

        const modal = document.getElementById('create-collection-modal');
        if (modal) {
            modal.classList.add('active');
            modal.setAttribute('aria-hidden', 'false');
        }
    }

    closeCreateCollectionModal() {
        const modal = document.getElementById('create-collection-modal');
        if (modal) {
            modal.classList.remove('active');
            modal.setAttribute('aria-hidden', 'true');
        }
    }

    handleCollectionCoverSelect(input) {
        const file = input.files && input.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { this.showNotification('Please select an image file', 'error'); return; }
        
        document.getElementById('collection-cover-name').textContent = file.name;
        
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
                const max = 800; // max size for collection covers
                let w = img.width, h = img.height;
                if (w > max || h > max) {
                    if (w > h) { h = Math.round(h * (max / w)); w = max; }
                    else { w = Math.round(w * (max / h)); h = max; }
                }
                const canvas = document.createElement('canvas');
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                this._tempCollectionCover = canvas.toDataURL('image/jpeg', 0.85);
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    }

    saveNewCollection() {
        const name = document.getElementById('collection-name').value.trim();
        const desc = document.getElementById('collection-desc').value.trim();
        
        if (!name || !desc) { notify('Please enter a name and description', 'warning'); return; }
        
        // Get selected items
        const checkboxes = document.querySelectorAll('input[name="collection-select-item"]:checked');
        const itemIds = Array.from(checkboxes).map(cb => cb.value);

        const newCollection = {
            id: 'col_' + Date.now(),
            name: name,
            description: desc,
            coverPhoto: this._tempCollectionCover || null,
            itemIds: itemIds,
            likes: 0,
            likedBy: [],
            comments: [],
            followers: [],
            createdAt: Date.now()
        };

        const key = 'flexy_collections_' + this.currentUser.id;
        const collections = JSON.parse(localStorage.getItem(key) || '[]');
        collections.unshift(newCollection);
        localStorage.setItem(key, JSON.stringify(collections));

        this.closeCreateCollectionModal();
        this.renderCollections();
        notify('Collection created successfully', 'success');
    }

    deleteCollection(collectionId) {
        if (!confirm('Are you sure you want to delete this collection?')) return;
        const key = 'flexy_collections_' + this.currentUser.id;
        let collections = JSON.parse(localStorage.getItem(key) || '[]');
        collections = collections.filter(c => c.id !== collectionId);
        localStorage.setItem(key, JSON.stringify(collections));
        this.renderCollections();
        notify('Collection deleted', 'info');
    }

    viewCollectionDetail(collectionId) {
        const key = 'flexy_collections_' + this.currentUser?.id;
        const collections = JSON.parse(localStorage.getItem(key) || '[]');
        const col = collections.find(c => c.id === collectionId);
        
        if (!col) { notify('Collection not found', 'error'); return; }

        this._activeCollectionId = collectionId;

        // Set Cover
        const coverEl = document.getElementById('collection-detail-cover');
        if (coverEl) {
            if (col.coverPhoto) {
                coverEl.style.backgroundImage = `url('${col.coverPhoto}')`;
            } else {
                coverEl.style.backgroundImage = 'linear-gradient(135deg, var(--dark-2) 0%, var(--dark-3) 100%)';
            }
        }

        // Set Text details
        document.getElementById('collection-detail-name').textContent = col.name;
        document.getElementById('collection-detail-author').textContent = this.currentUser.name;
        document.getElementById('collection-detail-date').textContent = new Date(col.createdAt).toLocaleDateString();
        document.getElementById('collection-detail-desc').textContent = col.description;
        document.getElementById('collection-detail-likes').textContent = col.likes || 0;

        // Like Button Active State
        const likeBtn = document.getElementById('collection-like-btn');
        if (likeBtn) {
            if (col.likedBy && col.likedBy.includes(this.currentUser.id)) {
                likeBtn.style.background = 'var(--accent)';
                likeBtn.style.color = 'var(--black)';
            } else {
                likeBtn.style.background = 'none';
                likeBtn.style.color = 'var(--accent)';
            }
            likeBtn.onclick = () => this.likeCollection(collectionId);
        }

        // Follow Button State
        const followBtn = document.getElementById('collection-follow-btn');
        if (followBtn) {
            if (col.followers && col.followers.includes(this.currentUser.id)) {
                followBtn.innerHTML = '<span>✓</span> Following';
                followBtn.style.background = 'var(--primary)';
                followBtn.style.color = 'var(--black)';
            } else {
                followBtn.innerHTML = '<span>➕</span> Follow Collection';
                followBtn.style.background = 'none';
                followBtn.style.color = 'var(--primary)';
            }
            followBtn.onclick = () => this.followCollection(collectionId);
        }

        // Render items in collection
        const itemsContainer = document.getElementById('collection-detail-items');
        if (itemsContainer) {
            itemsContainer.innerHTML = '';
            
            const allItems = JSON.parse(localStorage.getItem('flexy_items') || '[]');
            const colItems = allItems.filter(i => col.itemIds && col.itemIds.includes(i.id));

            if (colItems.length === 0) {
                itemsContainer.innerHTML = '<p style="font-size: 0.85rem; color: var(--text-muted); font-style: italic; padding: 1rem; grid-column:1/-1;">No items inside this collection.</p>';
            } else {
                itemsContainer.innerHTML = colItems.map(item => `
                    <div class="item-card glass-card" style="display: flex; flex-direction: column; cursor: pointer; padding: 0.5rem;" onclick="window.location.href='item.html?id=${encodeURIComponent(item.id)}'">
                        <img src="${item.images && item.images[0] ? item.images[0] : 'assets/placeholder.svg'}" alt="${item.title}" style="width: 100%; height: 120px; object-fit: cover; border-radius: var(--radius-sm);">
                        <div style="padding: 0.5rem 0 0;">
                            <div style="font-weight: 700; font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-primary);">${item.title}</div>
                            <div style="font-size: 0.75rem; color: var(--accent); margin-top: 0.25rem;">₹${this.formatPrice(item.price)}</div>
                        </div>
                    </div>
                `).join('');
            }
        }

        // Render Comments
        this.renderCollectionComments(col);

        // Hook comments submit
        const commentSubmitBtn = document.getElementById('collection-comment-submit');
        if (commentSubmitBtn) {
            commentSubmitBtn.onclick = () => this.submitCollectionComment(collectionId);
        }

        const modal = document.getElementById('collection-detail-modal');
        if (modal) {
            modal.classList.add('active');
            modal.setAttribute('aria-hidden', 'false');
        }
    }

    closeCollectionDetailModal() {
        const modal = document.getElementById('collection-detail-modal');
        if (modal) {
            modal.classList.remove('active');
            modal.setAttribute('aria-hidden', 'true');
        }
    }

    likeCollection(collectionId) {
        const key = 'flexy_collections_' + this.currentUser.id;
        const collections = JSON.parse(localStorage.getItem(key) || '[]');
        const col = collections.find(c => c.id === collectionId);
        
        if (!col) return;

        col.likedBy = col.likedBy || [];
        const idx = col.likedBy.indexOf(this.currentUser.id);
        if (idx !== -1) {
            col.likedBy.splice(idx, 1);
            col.likes = Math.max(0, (col.likes || 1) - 1);
        } else {
            col.likedBy.push(this.currentUser.id);
            col.likes = (col.likes || 0) + 1;
        }

        localStorage.setItem(key, JSON.stringify(collections));
        
        // Refresh detail view
        document.getElementById('collection-detail-likes').textContent = col.likes;
        const likeBtn = document.getElementById('collection-like-btn');
        if (col.likedBy.includes(this.currentUser.id)) {
            likeBtn.style.background = 'var(--accent)';
            likeBtn.style.color = 'var(--black)';
        } else {
            likeBtn.style.background = 'none';
            likeBtn.style.color = 'var(--accent)';
        }
        
        this.renderCollections();
    }

    followCollection(collectionId) {
        const key = 'flexy_collections_' + this.currentUser.id;
        const collections = JSON.parse(localStorage.getItem(key) || '[]');
        const col = collections.find(c => c.id === collectionId);
        
        if (!col) return;

        col.followers = col.followers || [];
        const idx = col.followers.indexOf(this.currentUser.id);
        if (idx !== -1) {
            col.followers.splice(idx, 1);
            notify('Unfollowed collection', 'info');
        } else {
            col.followers.push(this.currentUser.id);
            notify('Following collection', 'success');
        }

        localStorage.setItem(key, JSON.stringify(collections));
        
        // Refresh follow button state
        const followBtn = document.getElementById('collection-follow-btn');
        if (col.followers.includes(this.currentUser.id)) {
            followBtn.innerHTML = '<span>✓</span> Following';
            followBtn.style.background = 'var(--primary)';
            followBtn.style.color = 'var(--black)';
        } else {
            followBtn.innerHTML = '<span>➕</span> Follow Collection';
            followBtn.style.background = 'none';
            followBtn.style.color = 'var(--primary)';
        }
        
        this.renderCollections();
    }

    renderCollectionComments(col) {
        const commentsContainer = document.getElementById('collection-detail-comments');
        if (!commentsContainer) return;
        
        commentsContainer.innerHTML = '';
        const comments = col.comments || [];

        if (comments.length === 0) {
            commentsContainer.innerHTML = '<p style="font-size: 0.8rem; color: var(--text-muted); font-style: italic; padding: 0.5rem 0;">No comments yet. Start the conversation!</p>';
            return;
        }

        commentsContainer.innerHTML = comments.map(c => `
            <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-glass); padding: 0.75rem; border-radius: var(--radius-sm); display: flex; gap: 0.75rem; flex-direction: column;">
                <div style="display: flex; justify-content: space-between; font-size: 0.78rem;">
                    <strong style="color: var(--primary);">${c.userName}</strong>
                    <span style="color: var(--text-muted);">${new Date(c.date).toLocaleString()}</span>
                </div>
                <div style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.4;">${c.comment}</div>
            </div>
        `).join('');
        
        // Scroll to bottom
        commentsContainer.scrollTop = commentsContainer.scrollHeight;
    }

    submitCollectionComment(collectionId) {
        const input = document.getElementById('collection-comment-input');
        const text = input.value.trim();
        if (!text) return;

        const key = 'flexy_collections_' + this.currentUser.id;
        const collections = JSON.parse(localStorage.getItem(key) || '[]');
        const col = collections.find(c => c.id === collectionId);
        
        if (!col) return;

        col.comments = col.comments || [];
        col.comments.push({
            userId: this.currentUser.id,
            userName: this.currentUser.name,
            comment: text,
            date: Date.now()
        });

        localStorage.setItem(key, JSON.stringify(collections));
        
        input.value = '';
        this.renderCollectionComments(col);
        notify('Comment posted', 'success');
    }

    showNotification(message, type = 'info') {
        notify(message, type);
    }
}

// Initialize profile
const profile = new Profile();

// Global functions for HTML onclick handlers
function editProfile() {
    profile.editProfile();
}

function showMyItems() {
    profile.showMyItems();
}

function showMyBids() {
    profile.showMyBids();
}

function showNotifications() {
    profile.showNotifications();
}

function showSettings() {
    profile.showSettings();
}

function showHelp() {
    profile.showHelp();
}

// Expose collection global helpers
window.openCreateCollectionModal = () => profile.openCreateCollectionModal();
window.closeCreateCollectionModal = () => profile.closeCreateCollectionModal();
window.closeCollectionDetailModal = () => profile.closeCollectionDetailModal();
window.saveNewCollection = () => profile.saveNewCollection();
window.handleCollectionCoverSelect = (input) => profile.handleCollectionCoverSelect(input);