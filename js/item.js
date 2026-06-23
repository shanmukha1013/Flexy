// item.js - Complete Auction Item Detail Logic

class ItemDetail {
    constructor() {
        this.item = null;
        this.currentUser = null;
        this.countdown = null;
        this.items = [];
        this.init();
    }

    init() {
        this.currentUser = JSON.parse(localStorage.getItem('flexy_user') || 'null');
        this.loadItem();
        this.setupScrollHeader();
    }

    setupScrollHeader() {
        window.addEventListener('scroll', () => {
            const header = document.getElementById('main-header');
            if (header) {
                if (window.scrollY > 20) header.classList.add('scrolled');
                else header.classList.remove('scrolled');
            }
        });

        // Update header avatar
        if (this.currentUser) {
            const av = document.getElementById('header-avatar');
            if (av) {
                if (this.currentUser.avatarUrl || this.currentUser.avatarImage) {
                    av.style.backgroundImage = `url(${this.currentUser.avatarUrl || this.currentUser.avatarImage})`;
                    av.style.backgroundSize = 'cover';
                    av.style.backgroundPosition = 'center';
                    av.textContent = '';
                } else {
                    av.textContent = this.currentUser.avatarInitials || this.currentUser.avatar || this.currentUser.displayName?.[0]?.toUpperCase() || 'U';
                }
            }
        }
    }

    async loadItem() {
        const params = new URLSearchParams(window.location.search);
        const itemId = params.get('id');

        if (!itemId) {
            this.showError('No item ID provided.');
            return;
        }

        try {
            let res = await fetch(`/api/auctions/${itemId}`);
            if (res.ok) {
                this.item = await res.json();
            } else {
                // If not found, try fetching as a regular item / collection item if such endpoint exists,
                // For now, if it's not an auction, we might show error or redirect
                this.showError('Item not found or auction ended.');
                return;
            }

            this.renderItem();
        } catch (err) {
            console.error(err);
            this.showError('Error loading item from server.');
        }
    }

    renderItem() {
        const item = this.item;

        // Hide loading, show content
        document.getElementById('loading-state').style.display = 'none';
        document.getElementById('item-content').style.display = 'block';

        // Update page title
        document.title = `${item.title} - FLEXY`;

        // Gallery
        this.renderGallery(item.images || []);

        // Badge (live / showcase / ended)
        this.renderBadgeArea(item);

        // Title + meta
        document.getElementById('item-title').textContent = item.title || 'Untitled';
        document.getElementById('item-description').textContent = item.description || '';
        document.getElementById('item-condition').textContent = this.formatCondition(item.condition);
        document.getElementById('item-location-display').textContent = item.location ? `📍 ${item.location}` : '';

        // Tags
        const tagsEl = document.getElementById('item-tags');
        if (item.tags && item.tags.length > 0) {
            tagsEl.innerHTML = item.tags.map(tag => `<span class="item-tag">#${tag}</span>`).join('');
        }

        // Watchers
        const watchers = (item.watchers || []).length;
        document.getElementById('watchers-num').textContent = watchers;

        // Specs grid
        this.renderSpecs(item);

        // Seller info
        const sName = item.seller?.displayName || item.seller?.username || 'Unknown';
        document.getElementById('seller-name').textContent = sName;
        const sellerAv = document.getElementById('seller-av');
        if (item.seller?.avatarUrl || item.seller?.avatarImage) {
            sellerAv.style.backgroundImage = `url(${item.seller?.avatarUrl || item.seller?.avatarImage})`;
            sellerAv.style.backgroundSize = 'cover';
            sellerAv.textContent = '';
        } else {
            sellerAv.textContent = item.seller?.avatarInitials || sName.charAt(0).toUpperCase();
        }

        // Render based on type
        if (item.priceType === 'showcase') {
            this.renderShowcase(item);
        } else {
            this.renderAuction(item);
        }

        // Discussion thread
        this.renderDiscussion(item);

        // Watch button state
        this.updateWatchBtn();

        // Track view
        this.trackView(item);
    }

    renderGallery(images) {
        const mainImg = document.getElementById('main-image');
        const thumbsEl = document.getElementById('gallery-thumbs');

        if (!images || images.length === 0) {
            mainImg.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect fill="%231a1a1a" width="400" height="300"/><text fill="%23525252" font-size="18" x="50%" y="50%" text-anchor="middle" dy=".3em">No Image</text></svg>';
            return;
        }

        mainImg.src = images[0];

        if (images.length > 1) {
            thumbsEl.innerHTML = images.map((src, i) =>
                `<img class="gallery-thumb ${i === 0 ? 'active' : ''}" src="${src}" alt="Photo ${i + 1}" onclick="itemDetail.switchImage(${i})">`
            ).join('');
        }
    }

    switchImage(index) {
        const images = this.item.images || [];
        const mainImg = document.getElementById('main-image');
        mainImg.style.opacity = '0';
        setTimeout(() => {
            mainImg.src = images[index];
            mainImg.style.opacity = '1';
        }, 150);

        document.querySelectorAll('.gallery-thumb').forEach((el, i) => {
            el.classList.toggle('active', i === index);
        });
    }

    renderBadgeArea(item) {
        const badgeArea = document.getElementById('item-badge-area');
        const isExpired = this.isAuctionExpired(item);

        if (item.priceType === 'showcase') {
            badgeArea.innerHTML = `<span class="showcase-badge">💎 Showcase</span>`;
        } else if (isExpired) {
            badgeArea.innerHTML = `<span style="background: rgba(0,0,0,0.7); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 0.3rem 0.75rem; font-size: 0.75rem; font-weight: 700; color: #A3A3A3; text-transform: uppercase; letter-spacing: 0.08em;">⏰ Ended</span>`;
        } else {
            badgeArea.innerHTML = `<span class="live-badge"><span class="live-dot"></span>Live Auction</span>`;
        }
    }

    renderAuction(item) {
        const isExpired = this.isAuctionExpired(item);
        const bids = item.bids || [];
        const highestBid = bids.length > 0 ? Math.max(...bids.map(b => b.amount)) : (item.price || 0);
        const bidCount = bids.length;

        // Show auction type badge
        document.getElementById('auction-type-badge').innerHTML = !isExpired
            ? `<div class="live-badge" style="margin-bottom: 1rem;"><span class="live-dot"></span>Live Auction</div>`
            : '';

        // Bid display
        document.getElementById('bid-label').textContent = bidCount > 0 ? 'Current Highest Bid' : 'Starting Bid';
        document.getElementById('current-bid-display').textContent = `₹${this.formatNum(highestBid)}`;
        document.getElementById('bid-meta').textContent = bidCount > 0
            ? `${bidCount} bid${bidCount !== 1 ? 's' : ''} placed`
            : 'No bids yet — be the first!';

        // Bids tab badge
        document.getElementById('bids-count-badge').textContent = bidCount;

        // Bid history
        this.renderBidHistory(bids);

        if (isExpired) {
            // Show ended state
            document.getElementById('auction-ended-banner').style.display = 'block';
            const winner = bids.find(b => b.amount === highestBid);
            document.getElementById('auction-ended-sub').textContent = winner
                ? `Sold for ₹${this.formatNum(highestBid)} to ${winner.bidderName}`
                : `Ended at ₹${this.formatNum(highestBid)}`;
            document.getElementById('place-bid-section').style.display = 'none';
            document.getElementById('countdown-block').style.display = 'none';
        } else {
            // Countdown
            this.startCountdown(item);

            // Min bid
            const minBid = highestBid + (item.auctionSettings?.bidIncrement || 100);
            document.getElementById('min-bid-display').textContent = this.formatNum(minBid);
            document.getElementById('bid-amount-input').value = minBid;
            document.getElementById('bid-amount-input').min = minBid;

            // Wallet balance
            const balance = this.currentUser?.balance || 0;
            document.getElementById('wallet-balance-display').textContent = this.formatNum(balance);

            // If not logged in, hide bid controls
            if (!this.currentUser) {
                document.getElementById('place-bid-section').innerHTML = `
                    <div style="text-align: center; padding: 1rem; background: var(--dark-2); border-radius: var(--radius-md);">
                        <p style="color: var(--text-secondary); margin-bottom: 0.75rem;">Sign in to place a bid</p>
                        <a href="login.html" class="btn btn-primary btn-block">Sign In</a>
                    </div>`;
            }

            // Check if this is the seller
            if (this.currentUser && item.sellerId === this.currentUser.id) {
                document.getElementById('place-bid-section').innerHTML = `
                    <div style="text-align: center; padding: 1rem; background: var(--dark-2); border-radius: var(--radius-md); color: var(--text-muted); font-size: 0.85rem;">
                        You cannot bid on your own item.
                    </div>`;
            }
        }
    }

    renderShowcase(item) {
        document.getElementById('auction-bidding-section').style.display = 'none';
        document.getElementById('countdown-block') && (document.getElementById('countdown-block').style.display = 'none');

        if (item.price) {
            document.getElementById('valuation-block').style.display = 'block';
            document.getElementById('valuation-display').textContent = `₹${this.formatNum(item.price)}`;
        }

        document.getElementById('showcase-action-section').style.display = 'block';
        document.getElementById('bids-tab-btn').style.display = 'none';

        // Update like button state
        const likeBtn = document.getElementById('like-btn');
        const likedBy = item.likedBy || [];
        const isLiked = this.currentUser && likedBy.includes(this.currentUser.id);
        if (likeBtn) {
            likeBtn.textContent = isLiked ? '♥ Liked' : '♡ Like this Flex';
            likeBtn.style.color = isLiked ? 'var(--primary)' : '';
        }
    }

    renderSpecs(item) {
        const specsEl = document.getElementById('specs-grid');
        const specs = [
            { label: 'Category', value: this.formatCategory(item.category) },
            { label: 'Condition', value: this.formatCondition(item.condition) },
            { label: 'Type', value: item.priceType === 'showcase' ? 'Showcase' : 'Live Auction' },
            { label: 'Location', value: item.location || 'Not specified' },
            { label: 'Listed', value: item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-IN') : 'Unknown' },
            { label: 'Views', value: (item.views || 0).toString() }
        ];

        specsEl.innerHTML = specs.map(s => `
            <div class="spec-item">
                <div class="spec-label">${s.label}</div>
                <div class="spec-value">${s.value}</div>
            </div>
        `).join('');
    }

    renderBidHistory(bids) {
        const el = document.getElementById('bid-history-list');
        if (!bids || bids.length === 0) {
            el.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 2rem;">No bids yet. Be the first!</p>';
            return;
        }

        const sorted = [...bids].sort((a, b) => b.amount - a.amount);
        el.innerHTML = sorted.map((bid, i) => {
            const bName = bid.bidder?.displayName || bid.bidder?.username || 'Anonymous';
            const bInit = bid.bidder?.avatarInitials || bName.charAt(0).toUpperCase();
            const bAv = bid.bidder?.avatarUrl ? `url(${bid.bidder.avatarUrl})` : `linear-gradient(135deg, var(--primary), #ea580c)`;
            
            return \`
            <div class="bid-history-item">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <div style="width: 28px; height: 28px; border-radius: 50%; background: \${bAv}; background-size: cover; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 700; color: white;">\${!bid.bidder?.avatarUrl ? bInit : ''}</div>
                    <div>
                        <div style="font-size: 0.85rem; font-weight: 600; \${i === 0 ? 'color: var(--primary);' : ''}">\${bName} \${i === 0 ? '👑' : ''}</div>
                        <div style="font-size: 0.72rem; color: var(--text-muted);">\${this.timeAgo(bid.timestamp || bid.date || new Date())}</div>
                    </div>
                </div>
                <div style="font-weight: 700; \${i === 0 ? 'color: var(--primary);' : 'color: var(--text-secondary);'}">₹\${this.formatNum(bid.amount)}</div>
            </div>
            \`;
        }).join('');
    }

    renderDiscussion(item) {
        const thread = document.getElementById('discussion-thread');
        const comments = item.comments || [];

        if (comments.length === 0) {
            thread.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem;">No comments yet. Start the discussion!</p>';
        } else {
            thread.innerHTML = comments.map(c => {
                const authorName = c.author?.displayName || c.author?.username || 'Collector';
                const initial = c.author?.avatarInitials || authorName.charAt(0).toUpperCase();
                return \`
                <div class="comment-item">
                    <div class="comment-avatar">\${initial}</div>
                    <div class="comment-bubble">
                        <div class="comment-author">\${authorName}</div>
                        <div class="comment-text">\${this.escapeHtml(c.text)}</div>
                        <div class="comment-time">\${this.timeAgo(c.timestamp || c.date || new Date())}</div>
                    </div>
                </div>
                \`;
            }).join('');
        }

        // Show comment form or login prompt
        if (!this.currentUser) {
            document.getElementById('comment-form').style.display = 'none';
            document.getElementById('comment-login-msg').style.display = 'block';
        }
    }

    startCountdown(item) {
        if (this.countdown) clearInterval(this.countdown);

        // backend sets item.endTime
        const endTime = new Date(item.endTime).getTime();

        const updateCountdown = () => {
            const now = Date.now();
            const remaining = endTime - now;

            if (remaining <= 0) {
                clearInterval(this.countdown);
                // Mark as expired
                document.getElementById('cnt-d').textContent = '0';
                document.getElementById('cnt-h').textContent = '00';
                document.getElementById('cnt-m').textContent = '00';
                document.getElementById('cnt-s').textContent = '00';
                // Refresh to show expired state
                location.reload();
                return;
            }

            const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
            const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const mins = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
            const secs = Math.floor((remaining % (1000 * 60)) / 1000);

            document.getElementById('cnt-d').textContent = days;
            document.getElementById('cnt-h').textContent = String(hours).padStart(2, '0');
            document.getElementById('cnt-m').textContent = String(mins).padStart(2, '0');
            document.getElementById('cnt-s').textContent = String(secs).padStart(2, '0');

            // Urgent styling when < 1 hour
            const isUrgent = remaining < 3600000;
            ['cnt-hours', 'cnt-mins', 'cnt-secs'].forEach(id => {
                document.getElementById(id)?.classList.toggle('urgent', isUrgent);
            });
        };

        updateCountdown();
        this.countdown = setInterval(updateCountdown, 1000);
    }

    isAuctionExpired(item) {
        if (item.priceType === 'showcase') return false;
        const endTime = item.createdAt + (item.timeRemaining * 1000);
        return Date.now() > endTime;
    }

    updateWatchBtn() {
        const btn = document.getElementById('watch-toggle');
        if (!btn) return;
        const watchers = this.item.watchers || [];
        const isWatching = this.currentUser && watchers.includes(this.currentUser.id);
        btn.textContent = isWatching ? '♥' : '♡';
        btn.style.color = isWatching ? 'var(--primary)' : '';
        btn.style.borderColor = isWatching ? 'var(--primary)' : '';
    }

    trackView(item) {
        // Increment view count
        item.views = (item.views || 0) + 1;
        this.saveItem(item);
    }

    saveItem(item) {
        // Backend handles saving, no local storage update needed.
    }

    showError(msg) {
        document.getElementById('loading-state').innerHTML = `
            <div style="text-align: center; padding: 4rem;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">😔</div>
                <h3 style="margin-bottom: 0.5rem;">${msg}</h3>
                <a href="search.html" class="btn btn-primary" style="margin-top: 1rem;">Browse Auctions</a>
            </div>
        `;
    }

    // Formatting helpers
    formatNum(n) { return Number(n).toLocaleString('en-IN'); }

    formatCondition(c) {
        return { 'new': 'Brand New', 'like-new': 'Like New', 'good': 'Good', 'fair': 'Fair' }[c] || (c || 'Unknown');
    }

    formatCategory(c) {
        const map = { electronics: 'Electronics', fashion: 'Fashion', home: 'Home', garden: 'Garden', gaming: 'Gaming', collectibles: 'Collectibles', art: 'Art', vehicles: 'Vehicles' };
        return map[c] || (c || 'Other');
    }

    timeAgo(ts) {
        if (!ts) return 'Just now';
        const diff = Date.now() - ts;
        const m = Math.floor(diff / 60000);
        const h = Math.floor(m / 60);
        const d = Math.floor(h / 24);
        if (d > 0) return `${d}d ago`;
        if (h > 0) return `${h}h ago`;
        if (m > 0) return `${m}m ago`;
        return 'Just now';
    }

    escapeHtml(text) {
        return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
}

// Initialize
let itemDetail;
document.addEventListener('DOMContentLoaded', () => {
    itemDetail = new ItemDetail();
});

// Global action functions
function switchTab(tab) {
    document.querySelectorAll('.detail-tab').forEach((el, i) => {
        el.classList.toggle('active', ['description', 'specs', 'bids', 'discuss'][i] === tab);
    });
    document.querySelectorAll('.detail-tab-content').forEach(el => el.classList.remove('active'));
    const content = document.getElementById(`tab-${tab}`);
    if (content) content.classList.add('active');
}

function quickBid(amount) {
    const input = document.getElementById('bid-amount-input');
    if (!input) return;
    const currentMin = parseInt(input.min) || 0;
    input.value = currentMin + amount;
}

function quickBidPct(pct) {
    const input = document.getElementById('bid-amount-input');
    if (!input || !itemDetail?.item) return;
    const bids = itemDetail.item.bids || [];
    const highest = bids.length > 0 ? Math.max(...bids.map(b => b.amount)) : (itemDetail.item.price || 0);
    input.value = Math.ceil(highest * (1 + pct / 100));
}

function placeBid() {
    if (!itemDetail) return;
    const item = itemDetail.item;
    const currentUser = itemDetail.currentUser;

    if (!currentUser) {
        notify('Please sign in to place a bid', 'warning');
        setTimeout(() => window.location.href = 'login.html', 1200);
        return;
    }

    if (item.sellerId === currentUser.id) {
        notify('You cannot bid on your own item', 'error');
        return;
    }

    const bidInput = document.getElementById('bid-amount-input');
    const bidAmount = parseInt(bidInput.value);
    const bids = item.bids || [];
    const highestBid = bids.length > 0 ? Math.max(...bids.map(b => b.amount)) : (item.price || 0);
    const increment = item.auctionSettings?.bidIncrement || 100;
    const minBid = highestBid + increment;

    if (!bidAmount || bidAmount < minBid) {
        notify(`Minimum bid is ₹${itemDetail.formatNum(minBid)}`, 'error');
        return;
    }

    if (bidAmount > currentUser.balance) {
        notify(`Insufficient balance. You have ₹${itemDetail.formatNum(currentUser.balance)}`, 'error');
        return;
    }

    // Place the bid
    const newBid = {
        bidderId: currentUser.id,
        bidderName: currentUser.name,
        amount: bidAmount,
        timestamp: Date.now()
    };

    item.bids = [...bids, newBid];

    // Deduct from wallet (escrow)
    // Refund previous bid from same user if any
    const prevBids = bids.filter(b => b.bidderId === currentUser.id);
    if (prevBids.length > 0) {
        const prevMax = Math.max(...prevBids.map(b => b.amount));
        currentUser.balance += prevMax;
    }
    currentUser.balance -= bidAmount;

    // Save everything
    localStorage.setItem('flexy_user', JSON.stringify(currentUser));
    itemDetail.currentUser = currentUser;
    itemDetail.saveItem(item);

    // Update stats
    const stats = JSON.parse(localStorage.getItem('flexy_user_stats_' + currentUser.id) || '{}');
    stats.totalBids = (stats.totalBids || 0) + 1;
    localStorage.setItem('flexy_user_stats_' + currentUser.id, JSON.stringify(stats));

    // Update UI
    document.getElementById('current-bid-display').textContent = `₹${itemDetail.formatNum(bidAmount)}`;
    document.getElementById('bid-meta').textContent = `${item.bids.length} bid${item.bids.length !== 1 ? 's' : ''} placed`;
    document.getElementById('bids-count-badge').textContent = item.bids.length;
    document.getElementById('wallet-balance-display').textContent = itemDetail.formatNum(currentUser.balance);

    const newMin = bidAmount + increment;
    document.getElementById('min-bid-display').textContent = itemDetail.formatNum(newMin);
    bidInput.value = newMin;
    bidInput.min = newMin;

    itemDetail.renderBidHistory(item.bids);

    // Confetti on winning bid
    if (typeof confetti === 'function') {
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 }, colors: ['#F97316', '#FB923C', '#ffffff'] });
    }

    notify(`🎉 Bid of ₹${itemDetail.formatNum(bidAmount)} placed! You are the highest bidder.`, 'success');

    // Add to inbox notifications
    const notifications = JSON.parse(localStorage.getItem('flexy_notifications_' + currentUser.id) || '[]');
    notifications.unshift({
        id: 'notif_' + Date.now(),
        type: 'bid_placed',
        title: 'Bid Placed',
        message: `You placed a bid of ₹${itemDetail.formatNum(bidAmount)} on "${item.title}"`,
        itemId: item.id,
        timestamp: Date.now(),
        read: false
    });
    localStorage.setItem('flexy_notifications_' + currentUser.id, JSON.stringify(notifications));
}

function toggleWatch() {
    if (!itemDetail) return;
    const currentUser = itemDetail.currentUser;

    if (!currentUser) {
        notify('Please sign in to watch items', 'warning');
        return;
    }

    const item = itemDetail.item;
    const watchers = item.watchers || [];
    const isWatching = watchers.includes(currentUser.id);

    if (isWatching) {
        item.watchers = watchers.filter(w => w !== currentUser.id);
        notify('Removed from watchlist', 'info');
    } else {
        item.watchers = [...watchers, currentUser.id];
        notify('Added to watchlist ♥', 'success');
    }

    document.getElementById('watchers-num').textContent = item.watchers.length;
    itemDetail.saveItem(item);
    itemDetail.updateWatchBtn();
}

function likeItem() {
    if (!itemDetail) return;
    const currentUser = itemDetail.currentUser;

    if (!currentUser) {
        notify('Please sign in to like items', 'warning');
        return;
    }

    const item = itemDetail.item;
    const likedBy = item.likedBy || [];
    const isLiked = likedBy.includes(currentUser.id);

    if (isLiked) {
        item.likedBy = likedBy.filter(u => u !== currentUser.id);
        item.likes = (item.likes || 1) - 1;
    } else {
        item.likedBy = [...likedBy, currentUser.id];
        item.likes = (item.likes || 0) + 1;
    }

    const likeBtn = document.getElementById('like-btn');
    const nowLiked = !isLiked;
    if (likeBtn) {
        likeBtn.textContent = nowLiked ? '♥ Liked' : '♡ Like this Flex';
        likeBtn.style.color = nowLiked ? 'var(--primary)' : '';
    }

    itemDetail.saveItem(item);
    if (!isLiked) notify('❤️ Liked!', 'success');
}

function postComment() {
    if (!itemDetail) return;
    const currentUser = itemDetail.currentUser;

    if (!currentUser) {
        notify('Please sign in to comment', 'warning');
        return;
    }

    const input = document.getElementById('comment-input');
    const text = input.value.trim();

    if (!text) {
        notify('Please enter a comment', 'warning');
        return;
    }

    if (text.length > 500) {
        notify('Comment too long (max 500 characters)', 'error');
        return;
    }

    const item = itemDetail.item;
    const newComment = {
        id: 'cmt_' + Date.now(),
        authorId: currentUser.id,
        authorName: currentUser.name,
        text,
        timestamp: Date.now()
    };

    item.comments = [...(item.comments || []), newComment];
    itemDetail.saveItem(item);
    input.value = '';
    itemDetail.renderDiscussion(item);

    notify('Comment posted!', 'success');
}

function viewSeller() {
    notify('Viewing seller profile...', 'info');
}

function shareItem() {
    const url = window.location.href;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => notify('Link copied to clipboard!', 'success'));
    } else {
        notify('Copy this URL: ' + url, 'info');
    }
}

function contactSeller() {
    if (!itemDetail?.currentUser) {
        notify('Please sign in to message the seller', 'warning');
        return;
    }
    window.location.href = 'inbox.html';
}

function reportItem() {
    notify('Thank you for the report. Our team will review this item.', 'info');
}