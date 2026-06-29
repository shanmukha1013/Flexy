// search.js - Search and Filter Functionality

class Search {
    constructor() {
        this.allItems = [];
        this.filteredItems = [];
        this.filters = {
            query: '',
            category: 'all',
            minPrice: 0,
            maxPrice: 1000000,
            condition: 'all',
            sortBy: 'relevance'
        };
        this.init();
    }

    init() {
        // Check authentication
        this.checkAuth();
        
        // Load items
        this.loadItems();
        
        // Setup filters from sessionStorage
        this.loadFilters();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Perform initial search
        this.performSearch();
    }

    checkAuth() {
        const user = localStorage.getItem('flexy_user');
        const token = localStorage.getItem('flexy_token');
        
        if (!user || !token) {
            window.location.href = 'login.html';
        }
    }

    loadItems() {
        const savedItems = localStorage.getItem('flexy_items');
        this.allItems = savedItems ? JSON.parse(savedItems) : [];
        
        // Filter out expired items
        this.allItems = this.allItems.filter(item => !item.expired && !item.sold);
    }

    loadFilters() {
        // Load search query from sessionStorage
        const savedQuery = sessionStorage.getItem('search_query');
        const savedCategory = sessionStorage.getItem('filter_category');
        
        if (savedQuery) {
            this.filters.query = savedQuery;
            const searchInput = document.getElementById('search-input');
            if (searchInput) {
                searchInput.value = savedQuery;
            }
            sessionStorage.removeItem('search_query');
        }
        
        if (savedCategory && savedCategory !== 'all') {
            this.filters.category = savedCategory;
            sessionStorage.removeItem('filter_category');
        }
    }

    setupEventListeners() {
        // Search input
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filters.query = e.target.value;
                this.performSearch();
            });
            
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.performSearch();
                }
            });
        }
        
        // Clear search button
        const clearBtn = document.getElementById('clear-search');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearSearch();
            });
        }
        
        // Filter toggle
        const filterBtn = document.querySelector('[onclick="toggleFilters()"]');
        if (filterBtn) {
            filterBtn.addEventListener('click', () => this.toggleFilters());
        }
        
        // Close filters button
        const closeFilters = document.querySelector('.close-filters');
        if (closeFilters) {
            closeFilters.addEventListener('click', () => this.toggleFilters());
        }
        
        // Filter inputs
        this.setupFilterListeners();
        
        // Sort dropdown
        const sortSelect = document.getElementById('sort-by');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.filters.sortBy = e.target.value;
                this.sortResults();
            });
        }
        
        // Apply filters button
        const applyBtn = document.querySelector('[onclick="applyFilters()"]');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => this.applyFilters());
        }
        
        // Clear filters button
        const clearFiltersBtn = document.querySelector('[onclick="clearFilters()"]');
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => this.clearFilters());
        }
    }

    setupFilterListeners() {
        // Price inputs
        const minPrice = document.getElementById('min-price');
        const maxPrice = document.getElementById('max-price');
        const priceSlider = document.getElementById('price-slider');
        
        if (minPrice) {
            minPrice.addEventListener('input', () => {
                this.filters.minPrice = parseInt(minPrice.value) || 0;
                this.updatePriceSlider();
            });
        }
        
        if (maxPrice) {
            maxPrice.addEventListener('input', () => {
                this.filters.maxPrice = parseInt(maxPrice.value) || 1000000;
                this.updatePriceSlider();
            });
        }
        
        if (priceSlider) {
            priceSlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                this.filters.maxPrice = value;
                if (maxPrice) maxPrice.value = value;
            });
        }
        
        // Category checkboxes
        document.querySelectorAll('.category-filters input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.updateCategoryFilter();
            });
        });
        
        // Condition radios
        document.querySelectorAll('.condition-filters input[type="radio"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.filters.condition = e.target.value;
            });
        });
    }

    updatePriceSlider() {
        const priceSlider = document.getElementById('price-slider');
        if (priceSlider) {
            priceSlider.value = this.filters.maxPrice;
        }
    }

    updateCategoryFilter() {
        const selectedCategories = Array.from(
            document.querySelectorAll('.category-filters input[type="checkbox"]:checked')
        ).map(cb => cb.value);
        
        if (selectedCategories.length === 0) {
            this.filters.category = 'all';
        } else {
            this.filters.category = selectedCategories.join(',');
        }
    }

    performSearch() {
        this.showLoading(true);
        
        // Simulate API delay
        setTimeout(() => {
            this.filterItems();
            this.sortResults();
            this.renderResults();
            this.showLoading(false);
        }, 500);
    }

    filterItems() {
        this.filteredItems = this.allItems.filter(item => {
            // Search query filter
            if (this.filters.query) {
                const query = this.filters.query.toLowerCase();
                const matchesQuery = 
                    item.title.toLowerCase().includes(query) ||
                    item.description.toLowerCase().includes(query) ||
                    item.tags.some(tag => tag.toLowerCase().includes(query));
                
                if (!matchesQuery) return false;
            }
            
            // Category filter
            if (this.filters.category !== 'all') {
                const categories = this.filters.category.split(',');
                if (!categories.includes(item.category)) return false;
            }
            
            // Price filter
            if (item.price < this.filters.minPrice || item.price > this.filters.maxPrice) {
                return false;
            }
            
            // Condition filter
            if (this.filters.condition !== 'all' && item.condition !== this.filters.condition) {
                return false;
            }
            
            return true;
        });
    }

    sortResults() {
        switch(this.filters.sortBy) {
            case 'price-low':
                this.filteredItems.sort((a, b) => a.price - b.price);
                break;
            case 'price-high':
                this.filteredItems.sort((a, b) => b.price - a.price);
                break;
            case 'newest':
                this.filteredItems.sort((a, b) => b.createdAt - a.createdAt);
                break;
            case 'ending':
                this.filteredItems.sort((a, b) => a.timeRemaining - b.timeRemaining);
                break;
            case 'relevance':
            default:
                // Keep relevance-based order (already filtered by relevance)
                break;
        }
    }

    renderResults() {
        const container = document.getElementById('search-results');
        const noResults = document.getElementById('no-results');
        const resultsCount = document.getElementById('results-count');
        
        if (!container) return;
        
        if (this.filteredItems.length === 0) {
            container.innerHTML = '';
            noResults.style.display = 'block';
            if (resultsCount) {
                resultsCount.textContent = 'No Results Found';
            }
            return;
        }
        
        noResults.style.display = 'none';
        
        if (resultsCount) {
            resultsCount.textContent = `${this.filteredItems.length} Item${this.filteredItems.length !== 1 ? 's' : ''} Found`;
        }
        
        container.innerHTML = this.filteredItems.map(item => this.createItemCard(item)).join('');
        
        // Setup click handlers for new items
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
                    ${discount > 0 ? `<span class="discount-badge">-${discount}%</span>` : ''}
                    ${item.bids > 10 ? `<span class="hot-badge">🔥 Hot</span>` : ''}
                    ${item.published === false ? `<span class="badge" style="position:absolute;left:12px;bottom:12px;background:rgba(0,0,0,0.45);">Unpublished</span>` : ''}
                </div>
                <div class="item-info">
                    <div class="seller">${item.sellerName ? `by ${item.sellerName}` : ''} • <span class="muted">${createdTime}</span></div>
                    <div class="item-title">${item.title}</div>
                    <div class="item-category">
                        <span class="category-tag">${this.getCategoryName(item.category)}</span>
                        <span class="condition-tag">${item.condition || ''}</span>
                        <span class="location-tag">📍 ${item.location || ''}</span>
                    </div>
                    <div class="item-description">
                        ${item.description ? item.description.substring(0, 60) : ''}${item.description && item.description.length > 60 ? '...' : ''}
                    </div>
                    <div class="item-footer">
                        <div>
                            <div class="item-price">₹${this.formatPrice(item.price)}</div>
                            ${item.originalPrice > item.price ? 
                                `<div class="item-original-price">₹${this.formatPrice(item.originalPrice)}</div>` : ''}
                        </div>
                        <div class="item-meta">
                            <span class="item-bids">${item.bids} bids</span>
                            <span class="item-time">${createdTime}</span>
                        </div>
                    </div>
                    <div>
                        <div class="progress" aria-hidden="true"><div class="bar" style="width:${pct}%"></div></div>
                    </div>
                    <div class="item-actions">
                        <button class="btn btn-outline" onclick="search.viewItem('${item.id}')">View Details</button>
                    </div>
                </div>
            </div>
        `;
    }

    getCategoryName(categoryId) {
        const categories = {
            'electronics': 'Electronics',
            'fashion': 'Fashion',
            'home': 'Home & Garden',
            'sports': 'Sports',
            'books': 'Books',
            'vehicles': 'Vehicles',
            'collectibles': 'Collectibles',
            'services': 'Services'
        };
        return categories[categoryId] || categoryId;
    }

    formatPrice(price) {
        return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    formatTime(seconds) {
        if (seconds <= 0) return 'Ended';
        
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        
        if (days > 0) return `${days}d ${hours}h left`;
        if (hours > 0) return `${hours}h left`;
        return 'Ending soon';
    }

    setupItemClickHandlers() {
        setTimeout(() => {
            document.querySelectorAll('.item-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    if (!e.target.closest('.btn')) {
                        const itemId = e.currentTarget.dataset.itemId;
                        this.viewItem(itemId);
                    }
                });
            });
        }, 100);
    }

    showLoading(show) {
        const loading = document.getElementById('search-loading');
        const results = document.getElementById('search-results');
        
        if (loading) loading.style.display = show ? 'block' : 'none';
        if (results) results.style.display = show ? 'none' : 'grid';
    }

    toggleFilters() {
        const filtersPanel = document.getElementById('filters-panel');
        if (filtersPanel) {
            filtersPanel.classList.toggle('active');
        }
    }

    applyFilters() {
        // Update filters from UI
        const minPrice = document.getElementById('min-price');
        const maxPrice = document.getElementById('max-price');
        
        if (minPrice) this.filters.minPrice = parseInt(minPrice.value) || 0;
        if (maxPrice) this.filters.maxPrice = parseInt(maxPrice.value) || 1000000;
        
        this.updateCategoryFilter();
        
        // Get selected condition
        const selectedCondition = document.querySelector('.condition-filters input[type="radio"]:checked');
        if (selectedCondition) {
            this.filters.condition = selectedCondition.value;
        }
        
        // Perform search
        this.performSearch();
        
        // Close filters panel
        this.toggleFilters();
        
        this.showNotification('Filters applied', 'success');
    }

    clearFilters() {
        // Reset filter values
        this.filters = {
            query: this.filters.query, // Keep search query
            category: 'all',
            minPrice: 0,
            maxPrice: 1000000,
            condition: 'all',
            sortBy: 'relevance'
        };
        
        // Reset UI
        const searchInput = document.getElementById('search-input');
        if (searchInput) searchInput.value = this.filters.query;
        
        const minPrice = document.getElementById('min-price');
        const maxPrice = document.getElementById('max-price');
        const priceSlider = document.getElementById('price-slider');
        
        if (minPrice) minPrice.value = '';
        if (maxPrice) maxPrice.value = '';
        if (priceSlider) priceSlider.value = 50000;
        
        // Reset checkboxes
        document.querySelectorAll('.category-filters input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
        });
        
        // Reset radios
        document.querySelectorAll('.condition-filters input[type="radio"]').forEach(radio => {
            if (radio.value === 'all') radio.checked = true;
        });
        
        // Reset sort
        const sortSelect = document.getElementById('sort-by');
        if (sortSelect) sortSelect.value = 'relevance';
        
        // Perform search
        this.performSearch();
        
        this.showNotification('Filters cleared', 'success');
    }

    clearSearch() {
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.value = '';
            this.filters.query = '';
            this.performSearch();
        }
    }

    viewItem(itemId) {
        window.location.href = `item.html?id=${encodeURIComponent(itemId)}`;
    }

    bidItem(itemId) {
        const userData = localStorage.getItem('flexy_user');
        if (!userData) {
            notify('Please login to place a bid', 'error');
            window.location.href = 'login.html';
            return;
        }
        
        const user = JSON.parse(userData);
        const item = this.allItems.find(i => i.id === itemId);
        
        if (!item) return;
        
        if (user.balance < item.price) {
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
            user.balance -= amount;
            localStorage.setItem('flexy_user', JSON.stringify(user));
            
            // Record bid
            const userBids = JSON.parse(localStorage.getItem('flexy_user_bids_' + user.id) || '[]');
            userBids.push({
                id: 'bid_' + Date.now(),
                itemId: itemId,
                amount: amount,
                status: 'active',
                createdAt: Date.now(),
                updatedAt: Date.now()
            });
            localStorage.setItem('flexy_user_bids_' + user.id, JSON.stringify(userBids));
            
            // Save updated items
            localStorage.setItem('flexy_items', JSON.stringify(this.allItems));
            
            // Refresh results
            this.loadItems();
            this.performSearch();
            
            this.showNotification(`Bid placed successfully! ₹${this.formatPrice(amount)}`, 'success');
        }
    }

    showNotification(message, type = 'info') {
        notify(message, type);
    }
}

// Initialize search
const search = new Search();

// Global functions for HTML onclick handlers
function toggleFilters() {
    search.toggleFilters();
}

function applyFilters() {
    search.applyFilters();
}

function clearFilters() {
    search.clearFilters();
}

function sortResults() {
    const sortSelect = document.getElementById('sort-by');
    if (sortSelect) {
        search.filters.sortBy = sortSelect.value;
        search.sortResults();
        search.renderResults();
    }
}