// dashboard.js - Seller Dashboard Mechanics

class SellerDashboard {
    constructor() {
        this.currentUser = null;
        this.myItems = [];
        this.allBids = [];
        this.chartRange = '7d';
        this.init();
    }

    init() {
        // Authenticate
        const userData = localStorage.getItem('flexy_user');
        const token = localStorage.getItem('flexy_token');
        if (!userData || !token) {
            window.location.href = 'login.html';
            return;
        }
        this.currentUser = JSON.parse(userData);

        // Load data
        this.loadData();
        this.renderStats();
        this.renderListings();
        this.renderBidsReceived();
        this.renderChart();

        // Bind global functions to window
        window.deleteAuction = (id) => this.deleteAuction(id);
        window.updateChartRange = (range) => this.updateChartRange(range);
    }

    loadData() {
        const allItems = JSON.parse(localStorage.getItem('flexy_items') || '[]');
        
        // Filter user items
        this.myItems = allItems.filter(item => item.sellerId === this.currentUser.id);
        
        // Collect bids placed on user's items
        this.allBids = [];
        this.myItems.forEach(item => {
            const bids = JSON.parse(localStorage.getItem('flexy_bids_' + item.id) || '[]');
            bids.forEach(bid => {
                this.allBids.push({
                    ...bid,
                    itemTitle: item.title,
                    itemId: item.id
                });
            });
        });

        // Sort bids by date descending
        this.allBids.sort((a, b) => b.date - a.date);
    }

    renderStats() {
        // Active Auctions
        const activeCount = this.myItems.filter(item => {
            const isExpired = (item.endTime && Date.now() > item.endTime) || item.expired;
            return !isExpired;
        }).length;

        // Items Sold & Total Revenue
        let soldCount = 0;
        let totalRevenue = 0;

        this.myItems.forEach(item => {
            const isExpired = (item.endTime && Date.now() > item.endTime) || item.expired;
            const bids = JSON.parse(localStorage.getItem('flexy_bids_' + item.id) || '[]');
            
            if (isExpired && bids.length > 0) {
                soldCount++;
                const highestBid = Math.max(...bids.map(b => b.amount));
                totalRevenue += highestBid;
            }
        });

        // Update UI
        document.getElementById('revenue-stat').textContent = `₹${totalRevenue.toLocaleString('en-IN')}`;
        document.getElementById('active-stat').textContent = activeCount;
        document.getElementById('sold-stat').textContent = soldCount;
        document.getElementById('rating-stat').textContent = (this.currentUser.stats?.rating || 5.0).toFixed(1);

        // Update header user avatar initials
        const userAvatar = document.querySelector('.user-avatar');
        if (userAvatar && this.currentUser.avatar) {
            userAvatar.textContent = this.currentUser.avatar;
        }
    }

    renderListings() {
        const container = document.getElementById('seller-listings');
        if (!container) return;

        if (this.myItems.length === 0) {
            container.innerHTML = `
                <div class="glass-card" style="padding: 3rem; text-align: center;">
                    <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">You haven't listed any items for auction yet.</p>
                    <button class="btn btn-primary" onclick="window.location.href='sell.html'">Sell Your First Item</button>
                </div>
            `;
            return;
        }

        container.innerHTML = this.myItems.map(item => {
            const bids = JSON.parse(localStorage.getItem('flexy_bids_' + item.id) || '[]');
            const highestBid = bids.length > 0 ? Math.max(...bids.map(b => b.amount)) : item.price;
            const isExpired = (item.endTime && Date.now() > item.endTime) || item.expired;
            
            let statusBadge = `<span class="badge" style="background: var(--primary-glow); color: var(--primary); border: 1px solid var(--border-glow);">Live</span>`;
            if (isExpired) {
                statusBadge = bids.length > 0 
                    ? `<span class="badge" style="background: rgba(34, 197, 94, 0.15); color: var(--success); border: 1px solid rgba(34, 197, 94, 0.3);">Sold</span>`
                    : `<span class="badge" style="background: rgba(239, 68, 68, 0.15); color: var(--danger); border: 1px solid rgba(239, 68, 68, 0.3);">No Bids</span>`;
            }

            return `
                <div class="transaction-item" style="background: rgba(255, 255, 255, 0.01); border-color: var(--border-glass);">
                    <div style="display: flex; gap: 1.25rem; align-items: center;">
                        <img src="${item.images && item.images[0] ? item.images[0] : 'assets/placeholder.svg'}" 
                             style="width: 54px; height: 54px; border-radius: var(--radius-sm); object-fit: cover; border: 1px solid var(--border-glass);" 
                             alt="${item.title}">
                        <div>
                            <div class="tx-title">${item.title}</div>
                            <div class="tx-date" style="margin-top: 0.25rem;">
                                ${statusBadge} • ${bids.length} bids received
                            </div>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 1.5rem;">
                        <div style="text-align: right;">
                            <div class="tx-amount" style="color: var(--primary);">₹${highestBid.toLocaleString('en-IN')}</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted);">Current Bid</div>
                        </div>
                        ${!isExpired ? `
                            <div style="display: flex; gap: 0.5rem;">
                                <button class="btn btn-outline" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;" onclick="window.location.href='sell.html?edit=${item.id}'">Edit</button>
                                <button class="btn btn-danger" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;" onclick="deleteAuction('${item.id}')">Delete</button>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    renderBidsReceived() {
        const container = document.getElementById('bids-received');
        if (!container) return;

        if (this.allBids.length === 0) {
            container.innerHTML = `
                <div class="glass-card" style="padding: 2rem; text-align: center; color: var(--text-secondary); font-size: 0.9rem;">
                    No bids received on your items yet. Bids will show up here in real-time.
                </div>
            `;
            return;
        }

        container.innerHTML = this.allBids.slice(0, 5).map(bid => `
            <div class="transaction-item" style="background: rgba(255, 255, 255, 0.01); border-color: var(--border-glass); padding: 1rem 1.25rem;">
                <div>
                    <div style="font-weight: 600; font-size: 0.92rem;">
                        ${bid.userName || 'Anonymous'} <span style="font-weight: 400; color: var(--text-secondary);">bid on</span> ${bid.itemTitle}
                    </div>
                    <div class="tx-date" style="margin-top: 0.2rem;">${new Date(bid.date).toLocaleTimeString()} • ${new Date(bid.date).toLocaleDateString()}</div>
                </div>
                <div class="tx-amount" style="color: var(--success);">+₹${bid.amount.toLocaleString('en-IN')}</div>
            </div>
        `).join('');
    }

    updateChartRange(range) {
        this.chartRange = range;
        this.renderChart();
    }

    renderChart() {
        const canvas = document.getElementById('performance-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        
        // Match canvas layout width
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        const width = rect.width;
        const height = rect.height;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Generate data based on range
        const points = this.chartRange === '7d' ? 7 : 30;
        const labels = [];
        const dataValues = [];

        // Seed realistic progress values
        let cumulativeRevenue = 0;
        const bids = [...this.allBids].reverse();
        
        for (let i = points - 1; i >= 0; i--) {
            const date = new Date(Date.now() - (i * 24 * 60 * 60 * 1000));
            labels.push(date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }));
            
            // Sum bids for this day
            const startOfDay = new Date(date.setHours(0,0,0,0)).getTime();
            const endOfDay = new Date(date.setHours(23,59,59,999)).getTime();
            
            const dailyBids = bids.filter(b => b.date >= startOfDay && b.date <= endOfDay);
            const dailySum = dailyBids.reduce((sum, b) => sum + b.amount, 0);
            
            cumulativeRevenue += dailySum || (i === points - 1 ? 500 : 0); // start with a small seed if empty
            dataValues.push(cumulativeRevenue);
        }

        // Draw Line Chart
        const paddingLeft = 60;
        const paddingRight = 30;
        const paddingTop = 30;
        const paddingBottom = 40;

        const chartWidth = width - paddingLeft - paddingRight;
        const chartHeight = height - paddingTop - paddingBottom;

        const maxVal = Math.max(...dataValues, 10000) * 1.15;
        const minVal = 0;

        // Draw Grid Lines & Y Axis
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        ctx.fillStyle = '#6B7280';
        ctx.font = '10px Outfit';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        const yTicks = 4;
        for (let i = 0; i <= yTicks; i++) {
            const yVal = minVal + ((maxVal - minVal) / yTicks) * i;
            const y = paddingTop + chartHeight - (chartHeight / yTicks) * i;
            
            // Horizontal line
            ctx.beginPath();
            ctx.moveTo(paddingLeft, y);
            ctx.lineTo(width - paddingRight, y);
            ctx.stroke();

            // Label
            ctx.fillText(`₹${Math.round(yVal).toLocaleString('en-IN')}`, paddingLeft - 10, y);
        }

        // Draw X Axis labels
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const labelInterval = points === 30 ? 5 : 1;
        for (let i = 0; i < points; i++) {
            if (i % labelInterval === 0) {
                const x = paddingLeft + (chartWidth / (points - 1)) * i;
                ctx.fillText(labels[i], x, height - paddingBottom + 12);
            }
        }

        // Draw Path
        if (dataValues.length > 0) {
            // Line Gradient
            const lineGrad = ctx.createLinearGradient(0, 0, width, 0);
            lineGrad.addColorStop(0, '#A78BFA');
            lineGrad.addColorStop(1, '#F9A8D4');

            // Fill Gradient
            const fillGrad = ctx.createLinearGradient(0, paddingTop, 0, height - paddingBottom);
            fillGrad.addColorStop(0, 'rgba(167, 139, 250, 0.15)');
            fillGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

            // Begin Path
            ctx.beginPath();
            for (let i = 0; i < points; i++) {
                const x = paddingLeft + (chartWidth / (points - 1)) * i;
                const y = paddingTop + chartHeight - ((dataValues[i] - minVal) / (maxVal - minVal)) * chartHeight;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.strokeStyle = lineGrad;
            ctx.lineWidth = 3;
            ctx.stroke();

            // Close Path for Area Fill
            ctx.lineTo(paddingLeft + chartWidth, paddingTop + chartHeight);
            ctx.lineTo(paddingLeft, paddingTop + chartHeight);
            ctx.closePath();
            ctx.fillStyle = fillGrad;
            ctx.fill();

            // Draw Dots & Pulsing Dot on final point
            ctx.fillStyle = '#F9A8D4';
            for (let i = 0; i < points; i++) {
                const x = paddingLeft + (chartWidth / (points - 1)) * i;
                const y = paddingTop + chartHeight - ((dataValues[i] - minVal) / (maxVal - minVal)) * chartHeight;
                
                if (i === points - 1) {
                    // Pulsing Outer ring
                    ctx.beginPath();
                    ctx.arc(x, y, 8, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(249, 168, 212, 0.3)';
                    ctx.fill();

                    // Solid Center
                    ctx.beginPath();
                    ctx.arc(x, y, 4, 0, Math.PI * 2);
                    ctx.fillStyle = '#F9A8D4';
                    ctx.fill();
                } else if (points === 7) {
                    ctx.beginPath();
                    ctx.arc(x, y, 3, 0, Math.PI * 2);
                    ctx.fillStyle = '#A78BFA';
                    ctx.fill();
                }
            }
        }
    }

    deleteAuction(id) {
        if (!confirm('Are you sure you want to delete this auction item listing? This action cannot be undone.')) return;

        let allItems = JSON.parse(localStorage.getItem('flexy_items') || '[]');
        allItems = allItems.filter(item => item.id !== id);
        localStorage.setItem('flexy_items', JSON.stringify(allItems));

        // Clean bids for deleted item
        localStorage.removeItem('flexy_bids_' + id);

        notify('Auction deleted successfully', 'success');

        // Re-load and re-render page
        this.loadData();
        this.renderStats();
        this.renderListings();
        this.renderBidsReceived();
        this.renderChart();
    }
}

// Instantiate dashboard
document.addEventListener('DOMContentLoaded', () => {
    new SellerDashboard();
});
