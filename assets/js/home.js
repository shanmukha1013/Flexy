// home.js - Home Page Functionality

class Home {
    constructor() {
        this.currentUser = null;
        this.items = [];
        this.categories = [
            { id: 'electronics', name: 'Electronics', icon: '📱' },
            { id: 'fashion', name: 'Fashion', icon: '👕' },
            { id: 'home', name: 'Home & Garden', icon: '🏠' },
            { id: 'sports', name: 'Sports', icon: '⚽' },
            { id: 'books', name: 'Books & Media', icon: '📚' },
            { id: 'vehicles', name: 'Vehicles', icon: '🚗' },
            { id: 'collectibles', name: 'Collectibles', icon: '🎨' },
            { id: 'services', name: 'Services', icon: '🔧' }
        ];
        this.init();
    }

    init() {
        // Check authentication
        this.checkAuth();
        
        // Load user
        this.loadUser();
        
        // Load data
        this.loadData();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Render content
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

    loadData() {
        // Load items from localStorage or use mock data
        const savedItems = localStorage.getItem('flexy_items');
        
        if (savedItems) {
            this.items = JSON.parse(savedItems);
        } else {
            // Load mock data
            this.loadMockData();
        }
        
        // Filter out expired items
        this.items = this.items.filter(item => !item.expired);
    }

    loadMockData() {
        this.items = [
            {
                id: 'item_1',
                title: 'iPhone 14 Pro Max 256GB',
                description: 'Brand new, sealed box. Space Black color. Includes all accessories.',
                price: 89999,
                originalPrice: 129999,
                category: 'electronics',
                condition: 'New',
                sellerId: 'seller_1',
                sellerName: 'TechGuru',
                sellerRating: 4.8,
                location: 'Mumbai',
                images: ['assets/item_1_1.svg','assets/item_1_2.svg','assets/item_1_3.svg'],
                bids: 12,
                timeRemaining: 172800, // 2 days in seconds
                createdAt: Date.now() - 86400000, // 1 day ago
                featured: true,
                tags: ['apple', 'smartphone', 'new']
            },
            {
                id: 'item_2',
                title: 'Designer Leather Jacket',
                description: 'Genuine leather, perfect condition. Size M. Imported from Italy.',
                price: 14999,
                originalPrice: 29999,
                category: 'fashion',
                condition: 'Like New',
                sellerId: 'seller_2',
                sellerName: 'Fashionista',
                sellerRating: 4.6,
                location: 'Delhi',
                images: ['assets/item_2_1.svg','assets/item_2_2.svg','assets/item_2_2.svg'],
                bids: 8,
                timeRemaining: 86400, // 1 day
                createdAt: Date.now() - 43200000, // 12 hours ago
                featured: true,
                tags: ['leather', 'jacket', 'designer']
            },
            {
                id: 'item_3',
                title: 'Professional DSLR Camera',
                description: 'Canon EOS R5 with 24-70mm lens. Low shutter count. Perfect for professionals.',
                price: 199999,
                originalPrice: 299999,
                category: 'electronics',
                condition: 'Used - Excellent',
                sellerId: 'seller_3',
                sellerName: 'CameraPro',
                sellerRating: 4.9,
                location: 'Bangalore',
                images: ['assets/item_3_1.svg','assets/item_3_2.svg','assets/item_3_3.svg'],
                bids: 24,
                timeRemaining: 259200, // 3 days
                createdAt: Date.now() - 172800000, // 2 days ago
                featured: true,
                tags: ['camera', 'dslr', 'professional']
            },
            {
                id: 'item_4',
                title: 'Vintage Watch Collection',
                description: 'Collection of 3 vintage watches from 1960s. All in working condition.',
                price: 49999,
                originalPrice: 79999,
                category: 'collectibles',
                condition: 'Vintage',
                sellerId: 'seller_4',
                sellerName: 'WatchCollector',
                sellerRating: 4.7,
                location: 'Kolkata',
                images: ['assets/item_4_1.svg','assets/item_4_2.svg'],
                bids: 15,
                timeRemaining: 432000, // 5 days
                createdAt: Date.now() - 259200000, // 3 days ago
                featured: false,
                tags: ['watch', 'vintage', 'collection']
            },
            {
                id: 'item_5',
                title: 'Gaming Laptop - RTX 4070',
                description: 'ASUS ROG Zephyrus G16. 32GB RAM, 1TB SSD. Used for 3 months.',
                price: 159999,
                originalPrice: 219999,
                category: 'electronics',
                condition: 'Used - Good',
                sellerId: 'seller_5',
                sellerName: 'GamerPro',
                sellerRating: 4.5,
                location: 'Hyderabad',
                images: ['assets/item_5_1.svg','assets/item_5_2.svg','assets/item_5_3.svg'],
                bids: 18,
                timeRemaining: 604800, // 7 days
                createdAt: Date.now() - 345600000, // 4 days ago
                featured: true,
                tags: ['gaming', 'laptop', 'rtx']
            },
            {
                id: 'item_6',
                title: 'Handwoven Persian Rug',
                description: 'Authentic Persian rug, 8x10 feet. Excellent condition. Handmade silk.',
                price: 89999,
                originalPrice: 149999,
                category: 'home',
                condition: 'Used - Excellent',
                sellerId: 'seller_6',
                sellerName: 'HomeDecor',
                sellerRating: 4.8,
                location: 'Chennai',
                images: ['assets/item_6_1.svg','assets/item_6_2.svg'],
                bids: 6,
                timeRemaining: 345600, // 4 days
                createdAt: Date.now() - 432000000, // 5 days ago
                featured: false,
                tags: ['rug', 'persian', 'home-decor']
            }
        ];
        
        // Save to localStorage for future use
        localStorage.setItem('flexy_items', JSON.stringify(this.items));
    }

    setupEventListeners() {
        // Global search
        const searchInput = document.getElementById('global-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.handleSearch(e.target.value);
            });
        }

        // Category click handlers
        document.querySelectorAll('.category-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const category = e.currentTarget.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
                if (category) {
                    this.filterByCategory(category);
                }
            });
        });

        // View all buttons
        document.querySelectorAll('.view-all').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = 'search.html';
            });
        });

        // Item click handlers
        this.setupItemClickHandlers();
    }

    setupItemClickHandlers() {
        // Will be called after items are rendered
        setTimeout(() => {
            document.querySelectorAll('.item-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    const itemId = e.currentTarget.dataset.itemId;
                    if (itemId && !e.target.closest('.btn')) {
                        this.viewItem(itemId);
                    }
                });
            });
        }, 100);
    }

    render() {
        this.renderUserInfo();
        this.renderCategories();
        this.renderTrendingItems();
        this.renderRecentItems();
        this.startTimers();
    }

    renderUserInfo() {
        if (!this.currentUser) return;
        
        // Update header with user info
        const userAvatar = document.querySelector('.user-avatar');
        const userName = document.querySelector('.user-name');
        
        if (userAvatar) {
            userAvatar.textContent = this.currentUser.avatar;
        }
        if (userName) {
            userName.textContent = this.currentUser.name;
        }
    }

    renderCategories() {
        const container = document.querySelector('.categories-grid');
        if (!container) return;
        
        container.innerHTML = this.categories.slice(0, 4).map(category => `
            <div class="category-card" onclick="home.filterByCategory('${category.id}')">
                <div class="category-icon">${category.icon}</div>
                <span>${category.name}</span>
            </div>
        `).join('');
    }

    renderTrendingItems() {
        const container = document.getElementById('trending-items');
        if (!container) return;
        
        // Get trending items (most bids)
        const trending = [...this.items]
            .filter(item => item.featured)
            .sort((a, b) => b.bids - a.bids)
            .slice(0, 6);
        
        container.innerHTML = trending.map(item => this.createItemCard(item)).join('');
        
        // Re-setup click handlers
        this.setupItemClickHandlers();
    }

    renderRecentItems() {
        const container = document.getElementById('recent-items');
        if (!container) return;
        
        // Get recent items
        const recent = [...this.items]
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, 6);
        
        container.innerHTML = recent.map(item => this.createItemCard(item)).join('');
        
        // Re-setup click handlers
        this.setupItemClickHandlers();
    }

    createItemCard(item) {
        const createdTime = this.formatTime(item.createdAt || Date.now());
        const discount = item.originalPrice > item.price ? Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100) : 0;
        const duration = item.duration || 48*3600*1000;
        const elapsed = Math.max(0, Date.now() - (item.createdAt || Date.now()));
        const pct = Math.min(100, Math.round((elapsed / duration) * 100));
        
        return `
            <div class="item-card" data-item-id="${item.id}">
                <div class="item-image">
                    <img src="${item.images && item.images[0] ? item.images[0] : 'assets/placeholder.svg'}" alt="${item.title}">
                    ${item.featured ? '<span class="featured-badge">🔥 Trending</span>' : ''}
                    ${discount > 0 ? `<span class="discount-badge">-${discount}%</span>` : ''}
                    ${item.published === false ? `<span class="badge" style="position:absolute;left:12px;bottom:12px;background:rgba(0,0,0,0.45);">Unpublished</span>` : ''}
                </div>
                <div class="item-info">
                    <div class="seller">${item.sellerName ? `by ${item.sellerName}` : ''} • <span class="muted">${createdTime}</span></div>
                    <div class="item-title">${item.title}</div>
                    <div class="item-category">
                        <span class="category-tag">${this.getCategoryName(item.category)}</span>
                        <span class="condition-tag">${item.condition || ''}</span>
                    </div>
                    <div class="item-footer">
                        <div>
                            <div class="item-price">₹${this.formatPrice(item.price)}</div>
                            ${item.originalPrice > item.price ? 
                                `<div class="item-original-price">₹${this.formatPrice(item.originalPrice)}</div>` : ''}
                        </div>
                        <div class="item-meta">
                            <span class="item-bids">${item.bids} bids</span>
                            <span class="item-time">${elapsed > 0 ? createdTime : 'Just now'}</span>
                        </div>
                    </div>
                    <div>
                        <div class="progress" aria-hidden="true"><div class="bar" style="width:${pct}%"></div></div>
                    </div>
                    <div class="item-actions" style="margin-top:8px">
                        <button class="btn btn-outline" onclick="home.viewItem('${item.id}')">View</button>
                    </div>
                </div>
            </div>
        `;
    }

    formatPrice(price) {
        return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    formatTime(seconds) {
        if (seconds <= 0) return 'Ended';
        
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m left`;
    }

    getCategoryName(categoryId) {
        const category = this.categories.find(c => c.id === categoryId);
        return category ? category.name : categoryId;
    }

    startTimers() {
        // Update timers every minute
        setInterval(() => {
            document.querySelectorAll('.item-time').forEach(element => {
                const itemId = element.closest('.item-card')?.dataset.itemId;
                if (itemId) {
                    const item = this.items.find(i => i.id === itemId);
                    if (item && item.timeRemaining > 0) {
                        item.timeRemaining -= 60;
                        element.textContent = this.formatTime(item.timeRemaining);
                        
                        // Mark as expired if time runs out
                        if (item.timeRemaining <= 0) {
                            item.expired = true;
                            element.textContent = 'Ended';
                            element.style.color = 'var(--danger)';
                        }
                    }
                }
            });
        }, 60000);
    }

    handleSearch(query) {
        if (query.trim().length > 0) {
            // Redirect to search page with query
            sessionStorage.setItem('search_query', query);
            window.location.href = 'search.html';
        }
    }

    filterByCategory(category) {
        sessionStorage.setItem('filter_category', category);
        window.location.href = 'search.html';
    }

    viewItem(itemId) {
        // Navigate to item detail page with query param
        window.location.href = `item.html?id=${encodeURIComponent(itemId)}`;
    }

    bidItem(itemId) {
        if (!this.currentUser) {
            notify('Please login to place a bid', 'error');
            return;
        }
        
        const item = this.items.find(i => i.id === itemId);
        if (item) {
            // Check if user has enough balance
            if (this.currentUser.balance < item.price) {
                notify('Insufficient balance. Please add money to your wallet.', 'error');
                window.location.href = 'wallet.html';
                return;
            }
            
            const bidAmount = prompt(`Enter your bid amount (minimum: ₹${this.formatPrice(item.price)}):`, item.price);
            
            if (bidAmount) {
                const amount = parseInt(bidAmount.replace(/,/g, ''));
                
                if (isNaN(amount) || amount < item.price) {
                    notify(`Bid must be at least ₹${this.formatPrice(item.price)}`, 'warning');
                    return;
                }
                
                // Place bid
                item.bids++;
                item.price = Math.max(item.price, amount);
                
                // Update user balance
                this.currentUser.balance -= amount;
                localStorage.setItem('flexy_user', JSON.stringify(this.currentUser));
                
                // Save updated items
                localStorage.setItem('flexy_items', JSON.stringify(this.items));
                
                // Show success message
                notify(`Bid placed successfully! ₹${this.formatPrice(amount)}`, 'success');
                
                // Refresh display
                this.renderTrendingItems();
                this.renderRecentItems();
            }
        }
    }

    showNotification(message, type = 'info') {
        notify(message, type);
    }
}

// Initialize home page
const home = new Home();

// Global functions for HTML onclick handlers
function filterCategory(category) {
    home.filterByCategory(category);
}

function searchItems(query) {
    home.handleSearch(query);
}