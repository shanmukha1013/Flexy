// item.js - Item detail and bidding (enhanced)

(function() {
    function getQueryParam(key) {
        const params = new URLSearchParams(window.location.search);
        return params.get(key);
    }

    const itemId = getQueryParam('id');
    const itemImage = document.getElementById('item-image');
    const itemTitle = document.getElementById('item-title');
    const itemDescription = document.getElementById('item-description');
    const itemPriceEl = document.getElementById('item-price');
    const itemBidsEl = document.getElementById('item-bids');
    const bidAmountInput = document.getElementById('bid-amount');
    const placeBidBtn = document.getElementById('place-bid');
    const bidsListEl = document.getElementById('bids-list');
    const bidsCountEl = document.getElementById('bids-count');
    const highestBadge = document.getElementById('highest-bid-badge');
    const countdownEl = document.getElementById('countdown');
    const minIncrementEl = document.getElementById('min-increment');
    const watchToggle = document.getElementById('watch-toggle');
    const sellerAvatar = document.getElementById('seller-avatar');

    let items = JSON.parse(localStorage.getItem('flexy_items') || '[]');
    const item = items.find(i => i.id === itemId);

    if (!item) {
        itemTitle.textContent = 'Item not found';
        if (bidAmountInput) bidAmountInput.disabled = true;
        if (placeBidBtn) placeBidBtn.disabled = true;
        return;
    }

    // Ensure auction end time exists (demo: default 48 hours if missing)
    if (!item.endTime) {
        item.endTime = Date.now() + (48 * 60 * 60 * 1000);
        items = items.map(i => i.id === item.id ? item : i);
        localStorage.setItem('flexy_items', JSON.stringify(items));
    }

    // Load bids for item
    let bids = JSON.parse(localStorage.getItem('flexy_bids_' + item.id) || '[]');

    function currentHighest() {
        if (bids.length === 0) return item.price || 0;
        return Math.max(...bids.map(b => b.amount));
    }

    function minIncrement(current) {
        return Math.max(100, Math.round(current * 0.05));
    }

    function formatPrice(n) {
        return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    function renderItem() {
        itemImage.src = item.images && item.images[0] ? item.images[0] : 'assets/placeholder.svg';
        itemTitle.textContent = item.title;
        itemDescription.textContent = item.description;

        const highest = currentHighest();
        itemPriceEl.textContent = `₹${formatPrice(highest)}`;
        highestBadge.textContent = `₹${formatPrice(highest)}`;
        bidsCountEl.textContent = `${bids.length} bids`;
        minIncrementEl.textContent = `${minIncrement(highest)}`;

        // seller (demo)
        const seller = item.sellerName || 'Seller';
        document.getElementById('seller-name').textContent = seller;

        // Avatar - if sellerImage available
        if (item.sellerImage) {
            sellerAvatar.style.backgroundImage = `url('${item.sellerImage}')`;
            sellerAvatar.textContent = '';
        } else {
            sellerAvatar.textContent = (seller || 'S').charAt(0).toUpperCase();
        }

        renderBids();
    }

    function renderBids() {
        if (!bidsListEl) return;
        if (bids.length === 0) {
            bidsListEl.innerHTML = `<div class="empty-state"><p class="muted">No bids yet — be the first to bid!</p></div>`;
            return;
        }
        bidsListEl.innerHTML = bids.slice().reverse().map(b => `
            <div class="bid-row">
                <div class="who">${escapeHtml(b.userName || 'Anonymous')}</div>
                <div class="amount">₹${formatPrice(b.amount)} <span class="muted">• ${timeAgo(b.date)}</span></div>
            </div>
        `).join('');
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[c]);
    }

    function timeAgo(ts) {
        const diff = Date.now() - ts;
        const secs = Math.floor(diff/1000);
        if (secs < 60) return `${secs}s ago`;
        const mins = Math.floor(secs/60);
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins/60);
        if (hrs < 24) return `${hrs}h ago`;
        const days = Math.floor(hrs/24);
        return `${days}d ago`;
    }

    // Countdown timer
    let countdownTimer = null;
    function startCountdown() {
        updateCountdown();
        countdownTimer = setInterval(updateCountdown, 1000);
    }

    function updateCountdown() {
        const now = Date.now();
        const diff = item.endTime - now;
        if (diff <= 0) {
            countdownEl.textContent = 'Ended';
            endAuction();
            clearInterval(countdownTimer);
            return;
        }
        const h = Math.floor(diff / (1000*60*60));
        const m = Math.floor((diff % (1000*60*60)) / (1000*60));
        const s = Math.floor((diff % (1000*60)) / 1000);
        countdownEl.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }

    function endAuction() {
        // mark item expired
        item.expired = true;
        items = items.map(i => i.id === item.id ? item : i);
        localStorage.setItem('flexy_items', JSON.stringify(items));
        notify('Auction ended', 'info');
        placeBidBtn.disabled = true;
        bidAmountInput.disabled = true;
    }

    // Quick bid helpers
    document.querySelectorAll('.quick-bid').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const current = currentHighest();
            let val = current;
            const add = parseInt(e.currentTarget.dataset.add || '0', 10);
            const pct = parseFloat(e.currentTarget.dataset.percent || '0');
            if (add) val = current + add;
            if (pct) val = Math.ceil(current * (1 + pct/100));
            bidAmountInput.value = val;
            bidAmountInput.focus();
        });
    });

    // Watch toggle
    if (watchToggle) {
        const user = JSON.parse(localStorage.getItem('flexy_user') || 'null');
        if (user) {
            const watchKey = 'flexy_watch_' + user.id;
            const list = JSON.parse(localStorage.getItem(watchKey) || '[]');
            if (list.includes(item.id)) watchToggle.setAttribute('aria-pressed', 'true');
        }
        watchToggle.addEventListener('click', () => {
            const userData = JSON.parse(localStorage.getItem('flexy_user') || 'null');
            if (!userData) { notify('Please login to watch items', 'info'); window.location.href = 'login.html'; return; }
            const watchKey = 'flexy_watch_' + userData.id;
            const list = JSON.parse(localStorage.getItem(watchKey) || '[]');
            const idx = list.indexOf(item.id);
            if (idx === -1) { list.push(item.id); watchToggle.setAttribute('aria-pressed', 'true'); notify('Added to watchlist', 'success'); }
            else { list.splice(idx,1); watchToggle.setAttribute('aria-pressed', 'false'); notify('Removed from watchlist', 'info'); }
            localStorage.setItem(watchKey, JSON.stringify(list));
        });
    }

    // Place bid
    if (placeBidBtn) {
        placeBidBtn.addEventListener('click', () => {
            const userData = JSON.parse(localStorage.getItem('flexy_user') || 'null');
            if (!userData) { notify('Please login to place a bid', 'error'); window.location.href = 'login.html'; return; }

            const bid = parseInt((bidAmountInput.value || '').toString().replace(/[,\s]/g, ''), 10);
            if (isNaN(bid) || bid <= 0) { notify('Enter a valid bid amount', 'error'); return; }

            const current = currentHighest();
            const minInc = minIncrement(current);
            const minAllowed = current + minInc;
            if (bid < minAllowed) { notify(`Bid must be at least ₹${formatPrice(minAllowed)}`, 'warning'); return; }

            if (userData.balance < bid) { notify('Insufficient balance. Please add money to wallet.', 'error'); window.location.href = 'wallet.html'; return; }

            // Processing UI
            placeBidBtn.disabled = true;
            placeBidBtn.innerHTML = '<div class="loading-spinner"></div>';
            setTimeout(() => {
                // Deduct balance (simplified, immediate hold)
                userData.balance -= bid;
                localStorage.setItem('flexy_user', JSON.stringify(userData));

                // Save bid
                const bidObj = { id: 'bid_' + Date.now(), itemId: item.id, userId: userData.id, userName: userData.name || userData.phone, amount: bid, date: Date.now() };
                bids.push(bidObj);
                localStorage.setItem('flexy_bids_' + item.id, JSON.stringify(bids));

                // Update item stats
                item.bids = bids.length;
                item.price = bid;
                items = items.map(i => i.id === item.id ? item : i);
                localStorage.setItem('flexy_items', JSON.stringify(items));

                // Record transaction
                const transactions = JSON.parse(localStorage.getItem('flexy_transactions_' + userData.id) || '[]');
                transactions.unshift({ id: 'txn_' + Date.now(), type: 'debit', amount: bid, description: `Bid placed on ${item.title}`, date: Date.now(), status: 'completed' });
                localStorage.setItem('flexy_transactions_' + userData.id, JSON.stringify(transactions));

                // Visual feedback
                animatePriceUpdate();
                celebrate();

                // Reset UI
                placeBidBtn.disabled = false;
                placeBidBtn.textContent = 'Place Bid';
                bidAmountInput.value = '';

                renderItem();
                notify('Bid placed successfully! You are the highest bidder', 'success');
            }, 900);
        });
    }

    function animatePriceUpdate() {
        itemPriceEl.classList.add('price-update');
        setTimeout(() => itemPriceEl.classList.remove('price-update'), 800);
    }

    function celebrate() {
        // small pulse + confetti-like dots
        const el = document.createElement('div');
        el.className = 'celebrate';
        el.innerHTML = '<div class="dot dot1"></div><div class="dot dot2"></div><div class="dot dot3"></div>';
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 1400);
    }

    // Simple confetti styles injected dynamically
    (function injectConfettiCSS(){
        const css = `
        .celebrate { position: fixed; left: 50%; top: 25%; transform: translateX(-50%); z-index: 1500; pointer-events:none; }
        .celebrate .dot { width:10px;height:10px;border-radius:50%;position:absolute; }
        .celebrate .dot1 { background:#f59e0b; left:-8px; animation: fly1 900ms ease forwards; }
        .celebrate .dot2 { background:#10b981; left:0; animation: fly2 1000ms ease forwards; }
        .celebrate .dot3 { background:#ef4444; left:8px; animation: fly3 1100ms ease forwards; }
        @keyframes fly1 { to { transform: translate(-60px,-60px); opacity:0; } }
        @keyframes fly2 { to { transform: translate(0px,-80px); opacity:0; } }
        @keyframes fly3 { to { transform: translate(60px,-60px); opacity:0; } }
        `;
        const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
    })();

    // --- Auto-bid & auction engine ---

    // Store auto-bids persistently per item
    function loadAutoBids() {
        return JSON.parse(localStorage.getItem('flexy_autobids_' + item.id) || '[]');
    }

    function saveAutoBids(list) {
        localStorage.setItem('flexy_autobids_' + item.id, JSON.stringify(list));
    }

    function setAutoBid(userId, userName, maxAmount) {
        const list = loadAutoBids();
        const existing = list.find(a => a.userId === userId);
        if (existing) existing.max = maxAmount; else list.push({ userId, userName, max: maxAmount });
        saveAutoBids(list);

        // Reserve funds for this item in user's reserved map
        const user = loadUser(userId);
        if (!user) return false;
        user.reserved = user.reserved || {};
        const avail = availableBalance(user);
        const toReserve = Math.min(maxAmount, user.balance - sumReservedExcept(user, item.id));
        user.reserved[item.id] = toReserve;
        saveUser(user);
        return true;
    }

    function clearAutoBid(userId) {
        let list = loadAutoBids();
        list = list.filter(a => a.userId !== userId);
        saveAutoBids(list);
        const user = loadUser(userId);
        if (!user) return;
        if (user.reserved) { delete user.reserved[item.id]; saveUser(user); }
    }

    function sumReservedExcept(user, exceptItemId) {
        if (!user.reserved) return 0;
        return Object.keys(user.reserved).reduce((s, k) => s + (k === exceptItemId ? 0 : (Number(user.reserved[k])||0)), 0);
    }

    function availableBalance(user) {
        const reserved = user.reserved ? Object.values(user.reserved).reduce((s, v) => s + (Number(v)||0), 0) : 0;
        return (user.balance || 0) - reserved;
    }

    // Resolve proxy bidding after any new bid or auto-bid change
    function resolveProxyBids() {
        const autoList = loadAutoBids();
        if (!autoList.length) return;
        // sort by max desc
        const sorted = autoList.slice().sort((a,b) => b.max - a.max);
        const top = sorted[0];
        const second = sorted[1];
        const current = currentHighest();
        const inc = minIncrement(current);

        // winner is top, price is min(top.max, max(current+inc, second.max + inc))
        const secondMax = second ? second.max : (current);
        const target = Math.max(current + inc, secondMax + inc);
        const winningAmount = Math.min(top.max, target);

        // if winningAmount > current, create or update a bid by top user
        if (winningAmount > current) {
            // remove existing bids by top user for this item in bids array
            bids = bids.filter(b => !(b.userId === top.userId && b.itemId === item.id));
            const bidObj = { id: 'bid_' + Date.now(), itemId: item.id, userId: top.userId, userName: top.userName, amount: winningAmount, date: Date.now() };
            bids.push(bidObj);
            localStorage.setItem('flexy_bids_' + item.id, JSON.stringify(bids));

            // adjust reserved for top user to at least winningAmount
            const user = loadUser(top.userId);
            if (user) {
                user.reserved = user.reserved || {};
                user.reserved[item.id] = Math.max(Number(user.reserved[item.id]||0), winningAmount);
                saveUser(user);
            }

            renderItem();
            notify(`${top.userName} placed an automated bid of ₹${formatPrice(winningAmount)}`, 'info');
        }
    }

    // Simulate other bidders periodically
    function ensureSimUsers() {
        let sims = JSON.parse(localStorage.getItem('flexy_sim_users') || 'null');
        if (sims) return sims;
        sims = [
            { id: 'sim_A', name: 'Asha' },
            { id: 'sim_R', name: 'Raj' },
            { id: 'sim_S', name: 'Sam' },
            { id: 'sim_M', name: 'Mira' }
        ];
        localStorage.setItem('flexy_sim_users', JSON.stringify(sims));
        // Give them some balances
        sims.forEach(s => {
            let u = loadUser(s.id);
            if (!u) { u = { id: s.id, name: s.name, phone: '', balance: 50000, reserved: {} }; saveUser(u); }
        });
        return sims;
    }

    function randomSimBid() {
        const sims = ensureSimUsers();
        const sim = sims[Math.floor(Math.random()*sims.length)];
        const user = loadUser(sim.id);
        if (!user) return;
        const current = currentHighest();
        const inc = minIncrement(current);
        const bidVal = current + inc + Math.floor(Math.random()*inc);
        if (availableBalance(user) < bidVal) return; // skip if not enough

        // push bid
        const bidObj = { id: 'bid_' + Date.now(), itemId: item.id, userId: user.id, userName: user.name, amount: bidVal, date: Date.now() };
        bids.push(bidObj);
        localStorage.setItem('flexy_bids_' + item.id, JSON.stringify(bids));

        // reserve for sim
        user.reserved = user.reserved || {};
        user.reserved[item.id] = Math.max(Number(user.reserved[item.id]||0), bidVal);
        saveUser(user);

        renderItem();
        notify(`${user.name} placed a bid of ₹${formatPrice(bidVal)}`, 'info');

        // after sim bid, resolve proxy bids which may cause auto-bids
        resolveProxyBids();
    }

    // helper user storage
    function loadUser(userId) {
        const u = localStorage.getItem('flexy_user_' + userId) || null;
        if (u) return JSON.parse(u);
        // fallback: try global flexy_user for current user
        const global = JSON.parse(localStorage.getItem('flexy_user') || 'null');
        if (global && global.id === userId) return global;
        return null;
    }

    function saveUser(user) {
        if (!user) return;
        // if this is the current logged-in user, also update flexy_user
        const global = JSON.parse(localStorage.getItem('flexy_user') || 'null');
        if (global && global.id === user.id) {
            // merge and persist
            Object.assign(global, user);
            localStorage.setItem('flexy_user', JSON.stringify(global));
        }
        // store user-specific key
        localStorage.setItem('flexy_user_' + user.id, JSON.stringify(user));
    }

    // Push a persistent notification for a user
    function pushUserNotification(userId, message, type = 'info') {
        try {
            const key = 'flexy_notifications_' + userId;
            const list = JSON.parse(localStorage.getItem(key) || '[]');
            list.unshift({ id: 'n_' + Date.now(), message, type, date: Date.now(), read: false });
            localStorage.setItem(key, JSON.stringify(list));

            // If the current logged-in user matches, show a toast immediately and update badge
            const current = JSON.parse(localStorage.getItem('flexy_user') || 'null');
            if (current && current.id === userId) {
                notify(message, type === 'success' ? 'success' : type === 'error' ? 'error' : 'info');
                // update badge count in page if present
                const notesForUser = JSON.parse(localStorage.getItem(key) || '[]');
                const unread = notesForUser.filter(n => !n.read).length;
                const badge = document.getElementById('notif-count');
                if (badge) { badge.style.display = unread > 0 ? 'inline-block' : 'none'; badge.textContent = unread; }
            }
        } catch (e) {
            console.error('Failed to push notification', e);
        }
    }

    // Place a user bid (human flow now uses reservation instead of immediate debit)
    function userPlaceBid(userId, userName, bidAmount, autoMax) {
        const user = loadUser(userId) || { id: userId, name: userName, balance: 0, reserved: {} };
        const avail = availableBalance(user);
        if (avail < bidAmount) { notify('Insufficient available balance to place bid', 'error'); return false; }

        // set reservation for this bid
        user.reserved = user.reserved || {};
        user.reserved[item.id] = Math.max(Number(user.reserved[item.id]||0), bidAmount);
        saveUser(user);

        // store manual bid
        bids.push({ id: 'bid_' + Date.now(), itemId: item.id, userId: user.id, userName: user.name, amount: bidAmount, date: Date.now() });
        localStorage.setItem('flexy_bids_' + item.id, JSON.stringify(bids));

        // if autoMax present, set auto-bid
        if (autoMax && autoMax > bidAmount) setAutoBid(user.id, user.name, autoMax);

        renderItem();
        resolveProxyBids();
        return true;
    }

    // auction finalization: called when endTime reached
    function finalizeAuction() {
        // compute winner
        const highest = currentHighest();
        if (bids.length === 0) return;
        const winner = bids.slice().sort((a,b)=>b.amount-a.amount)[0];
        if (!winner) return;

        // Deduct from winner actual amount and remove reservation
        const winnerUser = loadUser(winner.userId) || null;
        if (winnerUser) {
            // ensure reserved exists
            const reservedAmt = Number(winnerUser.reserved?.[item.id] || 0);
            const pay = winner.amount;
            // deduct from balance using reserved funds and leftover
            // first reduce reserved and balance accordingly
            if (reservedAmt >= pay) {
                // reserved covers full payment
                winnerUser.reserved[item.id] = 0; delete winnerUser.reserved[item.id];
            } else {
                // use reserved and then deduct remainder from balance
                if (reservedAmt) { delete winnerUser.reserved[item.id]; }
                winnerUser.balance = (winnerUser.balance || 0) - (pay - reservedAmt);
            }
            // record transaction
            const txns = JSON.parse(localStorage.getItem('flexy_transactions_' + winnerUser.id) || '[]');
            txns.unshift({ id: 'txn_' + Date.now(), type: 'debit', amount: pay, description: `Won auction: ${item.title}`, date: Date.now(), status: 'completed' });
            localStorage.setItem('flexy_transactions_' + winnerUser.id, JSON.stringify(txns));
            saveUser(winnerUser);
        }

        // release reservations for everyone else for this item
        const allUsers = [/* current user */ JSON.parse(localStorage.getItem('flexy_user') || 'null')].concat(JSON.parse(localStorage.getItem('flexy_sim_users') || '[]') || []);
        allUsers.forEach(u => {
            if (!u) return;
            const user = loadUser(u.id) || null;
            if (!user) return;
            if (user.reserved && user.reserved[item.id]) { delete user.reserved[item.id]; saveUser(user); }
        });

        // mark item sold/expired
        item.sold = true;
        item.expired = true;
        items = items.map(i => i.id === item.id ? item : i);
        localStorage.setItem('flexy_items', JSON.stringify(items));

        // Record win for the winner user
        if (winnerUser) {
            const winsKey = 'flexy_user_wins_' + winnerUser.id;
            const wins = JSON.parse(localStorage.getItem(winsKey) || '[]');
            wins.unshift({ id: 'win_' + Date.now(), itemId: item.id, title: item.title, amount: winner.amount, date: Date.now() });
            localStorage.setItem(winsKey, JSON.stringify(wins));

            // Update user's bids: set status to 'won' for their bid(s) on this item
            const userBidsKey = 'flexy_user_bids_' + winnerUser.id;
            const userBids = JSON.parse(localStorage.getItem(userBidsKey) || '[]');
            userBids.forEach(b => { if (b.itemId === item.id) { b.status = (b.amount === winner.amount ? 'won' : 'outbid'); } });
            localStorage.setItem(userBidsKey, JSON.stringify(userBids));

            // Notify winner
            pushUserNotification(winnerUser.id, `You won the auction: ${item.title} for ₹${formatPrice(winner.amount)}`, 'success');
        }

        // Notify seller and record transaction
        const sellerUser = loadUser(item.sellerId) || null;
        if (sellerUser) {
            const txns = JSON.parse(localStorage.getItem('flexy_transactions_' + sellerUser.id) || '[]');
            txns.unshift({ id: 'txn_' + Date.now(), type: 'credit', amount: winner.amount, description: `Sold: ${item.title}`, date: Date.now(), status: 'completed' });
            localStorage.setItem('flexy_transactions_' + sellerUser.id, JSON.stringify(txns));
            sellerUser.stats = sellerUser.stats || {};
            sellerUser.stats.itemsSold = (sellerUser.stats.itemsSold || 0) + 1;
            saveUser(sellerUser);

            // Notify seller
            pushUserNotification(sellerUser.id, `Your item sold: ${item.title} for ₹${formatPrice(winner.amount)}`, 'success');
        }

        // Mark other users' bids for this item as 'lost'
        const allBids = JSON.parse(localStorage.getItem('flexy_bids_' + item.id) || '[]');
        allBids.forEach(b => {
            if (b.userId && b.userId !== winner.userId) {
                const otherBidsKey = 'flexy_user_bids_' + b.userId;
                const otherBids = JSON.parse(localStorage.getItem(otherBidsKey) || '[]');
                let changed = false;
                otherBids.forEach(ob => { if (ob.itemId === item.id && ob.status !== 'won') { ob.status = 'lost'; changed = true; } });
                if (changed) localStorage.setItem(otherBidsKey, JSON.stringify(otherBids));
            }
        });

        // Seller already credited and notified earlier; duplication removed.

        renderItem();
        notify(`Auction won by ${winner.userName} for ₹${formatPrice(winner.amount)}`, 'success');
    }

    // Hook into countdown end
    const origEndAuction = endAuction;
    function endAuction() { finalizeAuction(); }

    // Initialize simulated bidders
    const simInterval = setInterval(() => {
        // Randomize frequency
        if (Math.random() < 0.5) randomSimBid();
    }, 8000 + Math.floor(Math.random()*10000));

    // UI: gallery thumbs
    (function setupGallery(){
        const thumbs = document.createElement('div'); thumbs.className='gallery-thumbs';
        (item.images || ['assets/placeholder.svg']).forEach((src, idx) => {
            const img = document.createElement('img'); img.src = src; if (idx === 0) img.classList.add('selected');
            img.addEventListener('click', () => {
                document.querySelectorAll('.gallery-thumbs img').forEach(i=>i.classList.remove('selected'));
                img.classList.add('selected');
                itemImage.src = src;
            });
            thumbs.appendChild(img);
        });
        itemImage.parentNode.appendChild(thumbs);

        // Lightbox
        const lightbox = document.createElement('div'); lightbox.className='lightbox';
        lightbox.innerHTML = '<img id="lightbox-img" src="" alt="preview"><button class="close-modal" aria-label="Close" style="position:absolute;top:24px;right:24px;background:#fff;border-radius:8px;padding:8px;">×</button>';
        document.body.appendChild(lightbox);
        itemImage.addEventListener('click', () => { document.getElementById('lightbox-img').src = itemImage.src; lightbox.classList.add('active'); });
        lightbox.querySelector('.close-modal').addEventListener('click', () => lightbox.classList.remove('active'));
        lightbox.addEventListener('click', (e)=> { if (e.target === lightbox) lightbox.classList.remove('active'); });
    })();

    // Auto-start
    renderItem();
    startCountdown();
})();