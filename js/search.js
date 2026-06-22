// search.js - Search and Filter Functionality

class Search {
    constructor() {
        this.allItems = [];
        this.filteredItems = [];
        this.scope = 'auctions'; // default scope: auctions, collections, collectors, communities
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

    switchScope(scope) {
        this.scope = scope;
        
        // Update active tab styling
        document.querySelectorAll('.explore-tab').forEach(btn => {
            btn.classList.remove('active');
            btn.style.color = 'var(--text-secondary)';
            btn.style.borderBottomColor = 'transparent';
        });
        
        let matchText = '';
        if (scope === 'auctions') matchText = 'auctions';
        if (scope === 'collections') matchText = 'collections';
        if (scope === 'collectors') matchText = 'collectors';
        if (scope === 'communities') matchText = 'communities';

        const activeBtn = Array.from(document.querySelectorAll('.explore-tab')).find(btn => btn.textContent.toLowerCase().includes(matchText));
        if (activeBtn) {
            activeBtn.classList.add('active');
            activeBtn.style.color = 'var(--text-primary)';
            activeBtn.style.borderBottomColor = 'var(--primary)';
        }

        // Hide/Show price filter and condition sections depending on scope
        const priceFilter = document.querySelector('.filter-section');
        const conditionFilter = document.querySelectorAll('.filter-section')[2]; // 3rd section is condition
        
        if (scope === 'auctions') {
            if (priceFilter) priceFilter.style.display = 'block';
            if (conditionFilter) conditionFilter.style.display = 'block';
        } else if (scope === 'collections' || scope === 'communities') {
            if (priceFilter) priceFilter.style.display = 'none';
            if (conditionFilter) conditionFilter.style.display = 'none';
        } else {
            if (priceFilter) priceFilter.style.display = 'none';
            if (conditionFilter) conditionFilter.style.display = 'none';
        }

        this.performSearch();
    }

    getAllCollections() {
        const collections = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('flexy_collections_')) {
                try {
                    const list = JSON.parse(localStorage.getItem(key)) || [];
                    collections.push(...list);
                } catch (e) { console.error('Failed to parse collections', e); }
            }
        }
        return collections;
    }

    getAllCollectors() {
        const collectors = [
            {
                id: 'user_mock_1',
                name: 'Elena Rostova (LuxuryTimer)',
                username: 'luxurytimer',
                bio: 'Vintage watch specialist, focus on 1960s mechanical chronographs.',
                location: 'Geneva, Switzerland',
                interests: ['Watches', 'Antiques'],
                followersCount: 1420,
                rating: 4.9,
                avatar: 'E'
            },
            {
                id: 'user_mock_2',
                name: 'Marcus Aurelius (CoinKing)',
                username: 'coinking',
                bio: 'Ancient Roman and Greek numismatics collector.',
                location: 'Rome, Italy',
                interests: ['Coins', 'Antiques'],
                followersCount: 980,
                rating: 4.8,
                avatar: 'M'
            },
            {
                id: 'user_mock_3',
                name: 'Sarah Jenkins (SneakerHead)',
                username: 'sneakersarah',
                bio: 'Collecting rare Jordan 1s and Nike SB Dunks since 2012.',
                location: 'New York, USA',
                interests: ['Sneakers', 'Fashion'],
                followersCount: 3100,
                rating: 5.0,
                avatar: 'S'
            },
            {
                id: 'user_mock_4',
                name: 'Hiroshi Tanaka (CameraPro)',
                username: 'campro',
                bio: 'Leica and Hasselblad medium format camera enthusiast.',
                location: 'Tokyo, Japan',
                interests: ['Vintage Electronics'],
                followersCount: 880,
                rating: 4.7,
                avatar: 'H'
            }
        ];

        const currentUserData = localStorage.getItem('flexy_user');
        if (currentUserData) {
            const user = JSON.parse(currentUserData);
            collectors.unshift({
                id: user.id,
                name: user.name,
                username: user.username,
                bio: user.bio || 'Premium collector & active bidder.',
                location: user.location || 'Mumbai, India',
                interests: user.interests || ['Coins', 'Watches'],
                followersCount: 142,
                rating: user.stats?.rating || 0.0,
                avatar: user.avatar || user.name.charAt(0).toUpperCase()
            });
        }
        return collectors;
    }

    getAllCommunities() {
        return [
            {
                id: 'coin_collectors',
                name: 'Coin Collectors Club',
                description: 'A community for rare, ancient, and modern coin enthusiasts.',
                category: 'collectibles',
                subgroups: ['Ancient Coins', 'Indian Coins', 'Rare Coins', 'Coin Trading'],
                membersCount: 1240,
                postsCount: 450,
                icon: '🪙'
            },
            {
                id: 'watch_enthusiasts',
                name: 'Watch Enthusiasts',
                description: 'Discuss mechanical movements, luxury horology, and micro-brands.',
                category: 'collectibles',
                subgroups: ['Vintage Rolex', 'Seiko Modders', 'Luxury Escapements'],
                membersCount: 3100,
                postsCount: 920,
                icon: '⌚'
            },
            {
                id: 'sneaker_collectors',
                name: 'Sneaker Collectors Hub',
                description: 'Trade, legit check, and show off your rare kicks and sneakers.',
                category: 'fashion',
                subgroups: ['Grails Chat', 'Legit Check', 'Retail vs Resell'],
                membersCount: 5400,
                postsCount: 1800,
                icon: '👟'
            },
            {
                id: 'vintage_camera_club',
                name: 'Vintage Camera Club',
                description: 'Dedicated to vintage film cameras, rangefinders, and retro gear.',
                category: 'electronics',
                subgroups: ['Film Stock Discussion', 'Rangefinder Love', 'Lens Adapters'],
                membersCount: 880,
                postsCount: 210,
                icon: '📷'
            }
        ];
    }

    createCollectionCard(col) {
        const coverStyle = col.coverPhoto ? `background-image: url('${col.coverPhoto}');` : `background-image: linear-gradient(135deg, var(--dark-2) 0%, var(--dark-3) 100%);`;
        return `
            <div class="item-card glass-card animate-fade-up" style="display: flex; flex-direction: column;">
                <div class="item-image" style="height: 180px; background-size: cover; background-position: center; ${coverStyle} cursor: pointer;" onclick="window.location.href='profile.html'">
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
                            <button class="btn btn-primary btn-sm" style="width: 100%; font-size: 0.75rem; padding: 0.45rem;" onclick="window.location.href='profile.html'">View Showroom</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    createCollectorCard(c) {
        const interestsBadges = (c.interests || []).map(i => `<span class="badge badge-outline" style="border-color:var(--primary); color:var(--primary); font-size:0.7rem; padding:0.15rem 0.4rem; border-radius:3px;">${i}</span>`).join(' ');
        
        return `
            <div class="item-card glass-card animate-fade-up" style="display: flex; flex-direction: column; padding: 1.25rem;">
                <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
                    <div style="width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 800; color: var(--black);">${c.avatar}</div>
                    <div>
                        <div style="font-weight: 700; color: var(--text-primary); font-size: 1.1rem;">${c.name}</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted);">@${c.username} • 📍 ${c.location}</div>
                    </div>
                </div>
                <div style="flex: 1;">
                    <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.4; margin-bottom: 0.75rem;">${c.bio}</p>
                    <div style="display: flex; gap: 0.35rem; flex-wrap: wrap; margin-bottom: 1rem;">
                        ${interestsBadges}
                    </div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-glass); padding-top: 0.75rem; margin-top: auto; font-size: 0.8rem;">
                    <span style="color: var(--text-secondary);"><strong style="color:var(--text-primary);">${c.followersCount}</strong> Followers</span>
                    <span style="color: var(--success);">⭐ ${c.rating.toFixed(1)} Reputation</span>
                </div>
                <button class="btn btn-outline btn-sm" style="margin-top: 1rem; width: 100%; font-size: 0.75rem; padding: 0.45rem;" onclick="window.location.href='profile.html'">View Profile</button>
            </div>
        `;
    }

    createCommunityCard(com) {
        const subgroupBadges = (com.subgroups || []).map(s => `<span class="badge badge-outline" style="border-color:var(--accent); color:var(--accent); font-size:0.7rem; padding:0.15rem 0.4rem; border-radius:3px;">${s}</span>`).join(' ');
        
        return `
            <div class="item-card glass-card animate-fade-up" style="display: flex; flex-direction: column; padding: 1.25rem;">
                <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
                    <div style="width: 50px; height: 50px; border-radius: var(--radius-md); background: var(--dark-2); border: 1px solid var(--border-glass); display: flex; align-items: center; justify-content: center; font-size: 1.75rem;">${com.icon}</div>
                    <div>
                        <div style="font-weight: 700; color: var(--text-primary); font-size: 1.1rem;">${com.name}</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted);">${com.membersCount} collectors • ${com.postsCount} posts</div>
                    </div>
                </div>
                <div style="flex: 1;">
                    <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.4; margin-bottom: 0.75rem;">${com.description}</p>
                    <div style="display: flex; gap: 0.35rem; flex-wrap: wrap; margin-bottom: 1rem;">
                        ${subgroupBadges}
                    </div>
                </div>
                <button class="btn btn-primary btn-sm" style="margin-top: auto; width: 100%; font-size: 0.75rem; padding: 0.45rem;" onclick="window.location.href='home.html'">Enter Community Hub</button>
            </div>
        `;
    }

    filterItems() {
        const query = this.filters.query.toLowerCase();
        
        if (this.scope === 'auctions') {
            this.filteredItems = this.allItems.filter(item => {
                // Exclude showcases from Auctions tab
                if (item.priceType === 'showcase') return false;

                // Search query filter
                if (query) {
                    const matchesQuery = 
                        item.title.toLowerCase().includes(query) ||
                        item.description.toLowerCase().includes(query) ||
                        (item.tags && item.tags.some(tag => tag.toLowerCase().includes(query)));
                    
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
        else if (this.scope === 'collections') {
            const collections = this.getAllCollections();
            this.filteredItems = collections.filter(col => {
                if (query) {
                    const matches = col.name.toLowerCase().includes(query) || col.description.toLowerCase().includes(query);
                    if (!matches) return false;
                }
                return true;
            });
        } 
        else if (this.scope === 'collectors') {
            const collectors = this.getAllCollectors();
            this.filteredItems = collectors.filter(c => {
                if (query) {
                    const matches = c.name.toLowerCase().includes(query) || c.username.toLowerCase().includes(query) || c.bio.toLowerCase().includes(query);
                    if (!matches) return false;
                }
                return true;
            });
        } 
        else if (this.scope === 'communities') {
            const communities = this.getAllCommunities();
            this.filteredItems = communities.filter(com => {
                if (query) {
                    const matches = com.name.toLowerCase().includes(query) || com.description.toLowerCase().includes(query) || com.subgroups.some(s => s.toLowerCase().includes(query));
                    if (!matches) return false;
                }
                
                // Category filter
                if (this.filters.category !== 'all') {
                    const categories = this.filters.category.split(',');
                    if (!categories.includes(com.category)) return false;
                }
                return true;
            });
        }
    }

    sortResults() {
        if (this.scope === 'auctions') {
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
                    this.filteredItems.sort((a, b) => (a.timeRemaining || 0) - (b.timeRemaining || 0));
                    break;
                default:
                    break;
            }
        } else if (this.scope === 'collections') {
            this.filteredItems.sort((a, b) => (b.likes || 0) - (a.likes || 0));
        } else if (this.scope === 'collectors') {
            this.filteredItems.sort((a, b) => b.followersCount - a.followersCount);
        } else if (this.scope === 'communities') {
            this.filteredItems.sort((a, b) => b.membersCount - a.membersCount);
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
            resultsCount.textContent = `${this.filteredItems.length} Result${this.filteredItems.length !== 1 ? 's' : ''} Found`;
        }
        
        if (this.scope === 'auctions') {
            container.innerHTML = this.filteredItems.map(item => this.createItemCard(item)).join('');
            this.setupItemClickHandlers();
        } 
        else if (this.scope === 'collections') {
            container.innerHTML = this.filteredItems.map(col => this.createCollectionCard(col)).join('');
        } 
        else if (this.scope === 'collectors') {
            container.innerHTML = this.filteredItems.map(c => this.createCollectorCard(c)).join('');
        } 
        else if (this.scope === 'communities') {
            container.innerHTML = this.filteredItems.map(com => this.createCommunityCard(com)).join('');
        }
    }

    createItemCard(item) {
        const createdTime = this.formatTime(item.createdAt || Date.now());
        const discount = item.originalPrice > item.price ? Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100) : 0;
        const duration = item.duration || 48*3600*1000;
        const elapsed = Math.max(0, Date.now() - (item.createdAt || Date.now()));
        const pct = Math.min(100, Math.round((elapsed / duration) * 100));

        const actualBids = JSON.parse(localStorage.getItem('flexy_bids_' + item.id) || '[]');
        const bidsCount = actualBids.length;

        return `
            <div class="item-card" data-item-id="${item.id}">
                <div class="item-image">
                    <img src="${item.images && item.images[0] ? item.images[0] : 'assets/placeholder.svg'}" alt="${item.title}">
                    ${discount > 0 ? `<span class="discount-badge">-${discount}%</span>` : ''}
                    ${bidsCount > 10 ? `<span class="hot-badge">🔥 Hot</span>` : ''}
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
                            <span class="item-bids">${bidsCount} bids</span>
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