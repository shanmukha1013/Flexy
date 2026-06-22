// home.js - Home Page Functionality

class Home {
    constructor() {
        this.currentUser = null;
        this.items = [];
        this.categories = [
            { id: 'electronics', name: 'Electronics', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" /><line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" /><line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" /><line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="15" x2="23" y2="15" /><line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="15" x2="4" y2="15" /></svg>` },
            { id: 'fashion', name: 'Fashion', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 1 3 3c0 .82-.33 1.57-.88 2.12L22 13H2l7.88-5.88C9.33 6.57 9 5.82 9 5a3 3 0 0 1 3-3Z" /><line x1="2" y1="13" x2="22" y2="13" /></svg>` },
            { id: 'home', name: 'Home', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>` },
            { id: 'garden', name: 'Garden', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22V8" /><path d="M12 8c-3-2.5-6-1.5-6 1.5s3 4.5 6 1.5" /><path d="M12 12c3-2.5 6-1.5 6 1.5s-3 4.5-6 1.5" /></svg>` },
            { id: 'gaming', name: 'Gaming', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="12" x2="10" y2="12" /><line x1="8" y1="10" x2="8" y2="14" /><line x1="15" y1="13" x2="15.01" y2="13" /><line x1="18" y1="11" x2="18.01" y2="11" /><rect x="2" y="6" width="20" height="12" rx="3" /></svg>` },
            { id: 'collectibles', name: 'Collectibles', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12l4 6-10 12L2 9z" /><path d="M11 3 8 9l4 12 4-12-3-6" /><path d="M2 9h20" /></svg>` },
            { id: 'art', name: 'Art', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22C17.52 22 22 17.52 22 12S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10zm0-15a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm4 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm-8 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm1 6a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" /></svg>` },
            { id: 'vehicles', name: 'Vehicles', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" /><circle cx="7" cy="17" r="2" /><path d="M9 17h6" /><circle cx="17" cy="17" r="2" /></svg>` }
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
        
        // Setup scroll animations
        this.setupScrollAnimations();
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
            // Schema migration check: if items lack priceType, reset with high-fidelity rebrand seed
            if (this.items.length > 0 && !this.items[0].hasOwnProperty('priceType')) {
                this.loadMockData();
            }
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
                title: 'Rare 1804 Class I Draped Bust Silver Dollar',
                description: 'An authentic, pristine 1804 Class I Silver Dollar. Known as the King of US Coins. One of the finest known specimens, featuring the draped bust of Liberty.',
                story: 'This coin has been in our family collection for three generations, originally acquired in 1952. The details on Liberty\'s hair are exceptionally sharp, and it retains a beautiful, natural blue-grey patina around the margins. Sharing this with fellow numismatists to flex one of the crown jewels of coinage history! Not for sale, just showcasing.',
                price: 12000000,
                originalPrice: 12000000,
                category: 'collectibles',
                condition: 'New',
                priceType: 'showcase',
                sellerId: 'seller_1',
                sellerName: 'CoinKing',
                sellerRating: 4.9,
                location: 'Mumbai',
                images: ['assets/item_4_1.svg'], // reuse vector placeholders
                bids: 0,
                likes: 48,
                likedBy: ['seller_2', 'seller_3'],
                comments: [
                    { id: 'c_1', userId: 'seller_2', userName: 'TechGuru', avatar: 'T', text: 'Absolutely stunning! The strike on the reverse is incredibly crisp. Thanks for showcasing this legend.', createdAt: Date.now() - 36000000 },
                    { id: 'c_2', userId: 'seller_3', userName: 'WatchCollector', avatar: 'W', text: 'This belongs in a museum! How do you store it to preserve the tone?', createdAt: Date.now() - 18000000 }
                ],
                timeRemaining: 0,
                createdAt: Date.now() - 86400000,
                featured: true,
                tags: ['coin', 'rare', 'gold', 'silver']
            },
            {
                id: 'item_2',
                title: 'Vintage Rolex Submariner Ref. 5513 (1978)',
                description: 'A vintage Rolex Submariner Ref. 5513 from 1978. Matte dial with beautiful pumpkin-colored tritium patina on the hour markers. Completely original tritium handset.',
                story: 'Found this beauty at a local estate sale in London. It was sitting in a drawer for decades! Fully serviced now, keeping perfect time, but left unpolished to preserve its rich character and the razor-sharp bevels on the lugs. The pumpkin patina is just breathtaking.',
                price: 950000,
                originalPrice: 950000,
                category: 'collectibles',
                condition: 'Like New',
                priceType: 'showcase',
                sellerId: 'seller_3',
                sellerName: 'WatchCollector',
                sellerRating: 4.8,
                location: 'Delhi',
                images: ['assets/item_4_2.svg'],
                bids: 0,
                likes: 64,
                likedBy: ['seller_1', 'seller_5'],
                comments: [
                    { id: 'c_3', userId: 'seller_1', userName: 'CoinKing', avatar: 'C', text: 'That pumpkin patina is the holy grail. Unbelievable find!', createdAt: Date.now() - 25000000 }
                ],
                timeRemaining: 0,
                createdAt: Date.now() - 43200000,
                featured: true,
                tags: ['watch', 'rolex', 'vintage']
            },
            {
                id: 'item_3',
                title: 'Air Jordan 1 OG Chicago (1985)',
                description: 'True original 1985 Air Jordan 1 Chicago. Size 10.5. Leather is beautifully aged with light cracking on the black collar foam.',
                story: 'Picked these up from a collector in Chicago. These are not retroed, these are the original 1985 launch pair designed for Michael Jordan himself. The silhouette shape and the quality of leather cannot be replicated. Wearing them is like walking on history.',
                price: 180000,
                originalPrice: 180000,
                category: 'fashion',
                condition: 'Used - Excellent',
                priceType: 'showcase',
                sellerId: 'seller_4',
                sellerName: 'SneakerHead',
                sellerRating: 4.7,
                location: 'Bangalore',
                images: ['assets/item_2_1.svg'],
                bids: 0,
                likes: 82,
                likedBy: ['seller_1', 'seller_2'],
                comments: [
                    { id: 'c_4', userId: 'seller_2', userName: 'TechGuru', avatar: 'T', text: 'An absolute piece of history! Take care of that collar foam, it looks mint.', createdAt: Date.now() - 12000000 }
                ],
                timeRemaining: 0,
                createdAt: Date.now() - 172800000,
                featured: true,
                tags: ['sneakers', 'jordan', 'vintage']
            },
            {
                id: 'item_4',
                title: 'Canon EOS R5 Mirrorless Camera Body',
                description: 'Canon EOS R5 Mirrorless Camera Body. Low shutter count of 4,200. Original box and charger included.',
                price: 210000,
                originalPrice: 200000,
                category: 'electronics',
                condition: 'Like New',
                priceType: 'auction',
                sellerId: 'seller_5',
                sellerName: 'CameraPro',
                sellerRating: 4.9,
                location: 'Bangalore',
                images: ['assets/item_3_1.svg', 'assets/item_3_2.svg'],
                bids: 3,
                likes: 12,
                likedBy: [],
                comments: [],
                timeRemaining: 172800,
                createdAt: Date.now() - 86400000,
                featured: false,
                tags: ['camera', 'canon', 'electronics'],
                auctionSettings: {
                    startingBid: 200000,
                    bidIncrement: 5000,
                    duration: 3
                }
            },
            {
                id: 'item_5',
                title: 'Vintage Leica M3 Double Stroke (1955)',
                description: 'Leica M3 rangefinder camera, double stroke version. Viewfinder is clean and bright. Shutter speeds are accurate.',
                price: 145000,
                originalPrice: 140000,
                category: 'collectibles',
                condition: 'Used - Excellent',
                priceType: 'auction',
                sellerId: 'seller_6',
                sellerName: 'VintageLens',
                sellerRating: 4.8,
                location: 'Kolkata',
                images: ['assets/item_3_3.svg'],
                bids: 2,
                likes: 8,
                likedBy: [],
                comments: [],
                timeRemaining: 86400,
                createdAt: Date.now() - 129600000,
                featured: false,
                tags: ['camera', 'leica', 'vintage'],
                auctionSettings: {
                    startingBid: 140000,
                    bidIncrement: 2500,
                    duration: 3
                }
            },
            {
                id: 'item_6',
                title: 'PSA 8 autographed Pokémon 1st Edition Charizard',
                description: 'PSA 8 Near Mint-Mint 1st Edition Shadowless Charizard, signed by Mitsuhiro Arita at Paris Manga 2023.',
                price: 350000,
                originalPrice: 320000,
                category: 'gaming',
                condition: 'Like New',
                priceType: 'auction',
                sellerId: 'seller_2',
                sellerName: 'TechGuru',
                sellerRating: 4.8,
                location: 'Hyderabad',
                images: ['assets/item_1_1.svg'],
                bids: 4,
                likes: 31,
                likedBy: [],
                comments: [],
                timeRemaining: 259200,
                createdAt: Date.now() - 43200000,
                featured: true,
                tags: ['pokemon', 'charizard', 'card'],
                auctionSettings: {
                    startingBid: 320000,
                    bidIncrement: 10000,
                    duration: 5
                }
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
        this.renderHeroPreview();
        this.renderShowcaseFeed();
        this.renderTrendingItems(); // Auctions
        this.renderCommunities();
        this.startTimers();
        this.startHeroCountdown();
    }

    renderHeroPreview() {
        const wrapper = document.querySelector('.floating-card-wrapper');
        if (!wrapper) return;
        
        // Find Rolex Showcase (item_2) to match HTML static render
        const featuredItem = this.items.find(item => item.id === 'item_2') || this.items[0];
        if (!featuredItem) return;
        
        wrapper.innerHTML = `
            <!-- Hero Preview Card -->
            <div class="item-card glass-card animate-fade-up stagger-3" style="width: 320px; cursor: pointer; border-color: var(--border-glow);" onclick="home.switchTab('feed')">
                <div class="item-image" style="height: 200px; background: var(--dark-3);">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="width: 80px; height: 80px; color: var(--accent); margin: 60px auto; display: block;">
                        <circle cx="12" cy="12" r="7" stroke-width="1.5" />
                        <polyline points="12 8 12 12 15 14" stroke-width="2" stroke-linecap="round" />
                        <path d="M12 2 C10 2 9 4 9 4 L15 4 C15 4 14 2 12 2 Z" />
                        <path d="M12 22 C10 22 9 20 9 20 L15 20 C15 20 14 22 12 22 Z" />
                    </svg>
                    <span class="featured-badge" style="background: var(--accent); color: var(--black); box-shadow: 0 0 12px var(--accent-glow);">💎 Trending Showcase</span>
                </div>
                <div class="item-info">
                    <div class="seller">by ${featuredItem.sellerName || 'WatchCollector'} • Featured</div>
                    <div class="item-title">${featuredItem.title}</div>
                    <div class="item-footer">
                        <div>
                            <div class="item-price" style="color: var(--accent); font-size: 1.15rem; font-weight: 700;">₹${this.formatPrice(featuredItem.price)}</div>
                            <div style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 0.15rem;">Est. Valuation</div>
                        </div>
                        <div class="item-meta">
                            <span class="item-bids" style="color: var(--accent); font-weight: 600;">💖 ${featuredItem.likes || 0} likes</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    startHeroCountdown() {
        // Showcase does not require active bidding countdown. Left intact as noop/featured
        const timerEl = document.getElementById('hero-preview-timer');
        if (!timerEl) return;
        timerEl.textContent = "Featured Showcase";
    }

    renderUserInfo() {
        if (!this.currentUser) return;
        
        // Update header with user info
        const userAvatars = document.querySelectorAll('.user-avatar');
        userAvatars.forEach(el => {
            el.textContent = this.currentUser.avatar || 'U';
            if (this.currentUser.avatarColor) {
                el.style.background = this.currentUser.avatarColor;
            }
        });
    }

    renderCategories() {
        const container = document.getElementById('categories-grid');
        if (!container) return;
        
        container.innerHTML = this.categories.map(category => `
            <div class="category-card" onclick="home.filterByCategory('${category.id}')">
                <div class="category-icon">${category.icon}</div>
                <span>${category.name}</span>
            </div>
        `).join('');
    }

    // Switch Homepage Tabs
    switchTab(tabName) {
        // Toggle tab button states
        document.querySelectorAll('.tab-trigger').forEach(btn => {
            btn.classList.remove('active');
            btn.style.color = 'var(--text-muted)';
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
                btn.style.color = 'var(--text-primary)';
            }
        });

        // Toggle pane visibility
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active');
            pane.style.display = 'none';
        });

        const targetPane = document.getElementById(`pane-${tabName}`);
        if (targetPane) {
            targetPane.classList.add('active');
            targetPane.style.display = 'block';
        }
    }

    // Tab 1: Render Showcase Feed
    renderShowcaseFeed() {
        const container = document.getElementById('showcase-feed-items');
        if (!container) return;

        const showcases = this.items.filter(item => item.priceType === 'showcase');
        
        if (showcases.length === 0) {
            container.innerHTML = `<div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 3rem;"><h4>No showcases yet</h4><p>Click "List Yours" to show off your collection.</p></div>`;
            return;
        }

        const followingList = JSON.parse(localStorage.getItem('flexy_following_' + (this.currentUser?.id || 'guest')) || '[]');

        container.innerHTML = showcases.map(item => {
            const isLiked = item.likedBy && item.likedBy.includes(this.currentUser?.id || 'guest');
            const isFollowing = followingList.includes(item.sellerId);
            
            // Build comments list HTML
            const commentsHtml = (item.comments || []).map(c => `
                <div class="comment-item">
                    <div class="comment-avatar">${c.avatar || 'U'}</div>
                    <div class="comment-bubble">
                        <span class="comment-user">${c.userName}</span>
                        <span class="comment-text">${c.text}</span>
                    </div>
                </div>
            `).join('');

            return `
                <div class="card glass-card showcase-card" style="overflow: hidden; display: flex; flex-direction: column;">
                    <div class="showcase-header">
                        <div class="showcase-user">
                            <div class="showcase-avatar">${item.sellerName ? item.sellerName.charAt(0).toUpperCase() : 'C'}</div>
                            <div class="showcase-name-meta">
                                <span class="showcase-username">${item.sellerName || 'Collector'}</span>
                                <span class="showcase-meta">${item.location || 'India'}</span>
                            </div>
                        </div>
                        ${item.sellerId !== this.currentUser?.id ? `
                            <button class="btn-follow ${isFollowing ? 'following' : ''}" onclick="home.toggleFollow(event, '${item.sellerId}', this)">
                                ${isFollowing ? 'Following' : '+ Follow'}
                            </button>
                        ` : ''}
                    </div>
                    
                    <div class="item-image" style="height: 240px; background: var(--dark-2); cursor: pointer;" onclick="home.viewItem('${item.id}')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="width: 70px; height: 70px; color: var(--primary); margin: 85px auto; display: block;">
                            <polygon points="12,2 22,9 17,20 7,20 2,9" stroke-width="1.5" />
                            <circle cx="12" cy="12" r="3" />
                        </svg>
                        <span class="featured-badge" style="background: rgba(49, 46, 129, 0.4); border-color: var(--primary); color: var(--primary); font-weight: 700;">💎 ${this.getCategoryName(item.category)} Showcase</span>
                    </div>
                    
                    <div class="showcase-story">
                        <strong>${item.title}</strong>
                        <p>${item.story || item.description}</p>
                        <span style="font-size: 0.78rem; color: var(--primary); font-weight: 700;">Est. Value: ₹${this.formatPrice(item.price)}</span>
                    </div>
                    
                    <div class="showcase-actions">
                        <button class="action-btn btn-like ${isLiked ? 'liked' : ''}" onclick="home.toggleLike('${item.id}', this)">
                            <svg viewBox="0 0 24 24">
                                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                            </svg>
                            <span class="like-count">${item.likes || 0} Likes</span>
                        </button>
                        
                        <button class="action-btn" onclick="home.toggleCommentsSection('${item.id}')">
                            <svg viewBox="0 0 24 24">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                            </svg>
                            <span>${(item.comments || []).length} Comments</span>
                        </button>
                        
                        <button class="action-btn" onclick="home.shareShowcase('${item.title}')">
                            <svg viewBox="0 0 24 24">
                                <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                            </svg>
                            <span>Share</span>
                        </button>
                    </div>
                    
                    <div id="comments-${item.id}" class="showcase-comments-sec" style="display: none;">
                        <div class="comments-list" id="comments-list-${item.id}">
                            ${commentsHtml || '<p style="color:var(--text-muted); font-size:0.8rem; text-align:center;">No comments yet. Start the conversation!</p>'}
                        </div>
                        <div class="comment-input-sec">
                            <input type="text" id="comment-field-${item.id}" class="comment-field" placeholder="Add a comment..." onkeypress="if(event.key==='Enter') home.postComment('${item.id}')">
                            <button class="btn btn-outline" style="padding: 0.5rem 1rem; border-radius: var(--radius-md); font-size: 0.8rem;" onclick="home.postComment('${item.id}')">Flex</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    toggleCommentsSection(itemId) {
        const sec = document.getElementById(`comments-${itemId}`);
        if (sec) {
            sec.style.display = sec.style.display === 'none' ? 'block' : 'none';
        }
    }

    toggleFollow(event, sellerId, element) {
        event.stopPropagation();
        if (!this.currentUser) {
            notify('Please login to follow collectors', 'error');
            return;
        }

        const key = 'flexy_following_' + this.currentUser.id;
        let following = JSON.parse(localStorage.getItem(key) || '[]');

        if (following.includes(sellerId)) {
            following = following.filter(id => id !== sellerId);
            element.classList.remove('following');
            element.textContent = '+ Follow';
            notify('Unfollowed collector', 'info');
        } else {
            following.push(sellerId);
            element.classList.add('following');
            element.textContent = 'Following';
            notify('Following collector!', 'success');
        }

        localStorage.setItem(key, JSON.stringify(following));
        
        // Update counts if profile loads it
        const followEvent = new CustomEvent('followChange');
        window.dispatchEvent(followEvent);
    }

    toggleLike(itemId, element) {
        if (!this.currentUser) {
            notify('Please login to like collections', 'error');
            return;
        }

        const idx = this.items.findIndex(i => i.id === itemId);
        if (idx === -1) return;

        const item = this.items[idx];
        if (!item.likedBy) item.likedBy = [];

        const userIndex = item.likedBy.indexOf(this.currentUser.id);
        const countSpan = element.querySelector('.like-count');

        if (userIndex !== -1) {
            // Unlike
            item.likedBy.splice(userIndex, 1);
            item.likes = Math.max(0, (item.likes || 1) - 1);
            element.classList.remove('liked');
            notify('Removed like', 'info');
        } else {
            // Like
            item.likedBy.push(this.currentUser.id);
            item.likes = (item.likes || 0) + 1;
            element.classList.add('liked');
            notify('You liked this collection!', 'success');
        }

        countSpan.textContent = `${item.likes} Likes`;
        localStorage.setItem('flexy_items', JSON.stringify(this.items));
    }

    postComment(itemId) {
        const field = document.getElementById(`comment-field-${itemId}`);
        if (!field || !field.value.trim()) return;

        if (!this.currentUser) {
            notify('Please login to comment', 'error');
            return;
        }

        const idx = this.items.findIndex(i => i.id === itemId);
        if (idx === -1) return;

        const item = this.items[idx];
        if (!item.comments) item.comments = [];

        const newComment = {
            id: 'c_' + Date.now(),
            userId: this.currentUser.id,
            userName: this.currentUser.name,
            avatar: this.currentUser.avatar || 'U',
            text: field.value.trim(),
            createdAt: Date.now()
        };

        item.comments.push(newComment);
        localStorage.setItem('flexy_items', JSON.stringify(this.items));
        field.value = '';

        // Re-render showcase pane to show comment instantly
        this.renderShowcaseFeed();
        
        // Keep comments section open
        const sec = document.getElementById(`comments-${itemId}`);
        if (sec) sec.style.display = 'block';
    }

    shareShowcase(title) {
        const fakeUrl = window.location.origin + '/share/' + encodeURIComponent(title);
        navigator.clipboard.writeText(fakeUrl).then(() => {
            notify('Share link copied to clipboard!', 'success');
        }).catch(() => {
            notify('Failed to copy share link', 'error');
        });
    }

    // Tab 2: Render Live Auctions
    renderTrendingItems() {
        const container = document.getElementById('trending-items');
        if (!container) return;
        
        const auctions = this.items.filter(item => item.priceType === 'auction');
        
        if (auctions.length === 0) {
            container.innerHTML = `<div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 3rem;"><h4>No active auctions</h4><p>Check back later or list your own auction.</p></div>`;
            return;
        }
        
        container.innerHTML = auctions.map(item => this.createItemCard(item)).join('');
        this.setupItemClickHandlers();
    }

    renderRecentItems() {
        // Unified homepage feeds handles tab toggle. Included for compatibility
    }

    createItemCard(item) {
        const actualBids = JSON.parse(localStorage.getItem('flexy_bids_' + item.id) || '[]');
        const bidsCount = actualBids.length > 0 ? actualBids.length : (item.bids || 0);

        return `
            <div class="item-card" data-item-id="${item.id}" style="cursor: pointer;">
                <div class="item-image" style="background: var(--dark-2); height: 200px;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="width: 70px; height: 70px; color: var(--primary); margin: 65px auto; display: block;">
                        <rect x="3" y="3" width="18" height="18" rx="2" stroke-width="1.5" />
                        <path d="M21 16H3M12 3v13" />
                    </svg>
                    <span class="featured-badge" style="background: var(--primary); color: var(--black); box-shadow: 0 0 10px var(--primary-glow);">🔨 Live Auction</span>
                </div>
                <div class="item-info">
                    <div class="seller">by ${item.sellerName || 'TechGuru'} • <span class="muted">${item.location || 'India'}</span></div>
                    <div class="item-title">${item.title}</div>
                    <div class="item-category">
                        <span class="category-tag" style="background: rgba(167,139,250,0.06); color: var(--primary); border: 1px solid rgba(167,139,250,0.1);">${this.getCategoryName(item.category)}</span>
                        <span class="condition-tag">${item.condition || 'Mint'}</span>
                    </div>
                    <div class="item-footer">
                        <div>
                            <div class="item-price" style="color: var(--primary); font-size: 1.15rem; font-weight: 700;">₹${this.formatPrice(item.price)}</div>
                            <div style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 0.15rem;">Highest Bid</div>
                        </div>
                        <div class="item-meta">
                            <span class="item-bids" style="color: var(--success); font-weight: 600;">${bidsCount} bids</span>
                            <span class="item-time" style="background: rgba(167, 139, 250, 0.08); color: var(--primary); font-weight: 700; border-radius: var(--radius-sm); padding: 0.2rem 0.5rem;">Active</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Tab 3: Render Communities Hub
    renderCommunities() {
        const container = document.getElementById('communities-grid-list');
        if (!container) return;

        this.communities = [
            { id: 'coins', name: 'Coin Collectors Club', icon: '🪙', desc: 'Discussions about rare coins, grading, history, and treasures.' },
            { id: 'watches', name: 'Watch Enthusiasts Hub', icon: '⌚', desc: 'A premium space for luxury horology, mechanical movements, and vintage watches.' },
            { id: 'sneakers', name: 'Sneaker Collectors', icon: '👟', desc: 'Flex, share, and discuss rare kicks, retro jordans, and streetwear.' },
            { id: 'cameras', name: 'Vintage Camera Club', icon: '📷', desc: 'Film rangefinders, SLRs, antique glass, and analog photography.' }
        ];

        container.innerHTML = this.communities.map(c => `
            <div class="community-card" onclick="home.openCommunityHub('${c.id}')">
                <div class="community-badge">${c.icon}</div>
                <div style="flex:1;">
                    <h4 style="font-size:1.15rem; color: var(--text-primary);">${c.name}</h4>
                    <p style="color:var(--text-secondary); font-size:0.82rem; margin-top:0.25rem; line-height:1.45;">${c.desc}</p>
                </div>
            </div>
        `).join('');
    }

    // Modal Hub: Open Community Hub Overlay
    openCommunityHub(comId) {
        const com = this.communities.find(c => c.id === comId);
        if (!com) return;

        this.activeCommunityId = comId;
        this.loadCommunityData(comId);

        const modal = document.getElementById('community-hub-modal');
        const title = document.getElementById('hub-community-title');
        const desc = document.getElementById('hub-community-desc');

        if (modal && title && desc) {
            title.textContent = com.name;
            desc.textContent = com.desc;
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';

            // Define subgroups
            const subgroups = {
                'coins': ['Ancient Coins', 'Indian Coins', 'Rare Coins', 'Coin Trading'],
                'watches': ['Vintage Rolex', 'Seiko Modders', 'Luxury Escapements'],
                'sneakers': ['Sneaker Authentics', 'Nike SB Dunks', 'Grail Showrooms'],
                'cameras': ['Rangefinder Love', 'Film Stock', 'Medium Format']
            }[comId] || [];

            this.renderSubgroupsList(subgroups);
            if (subgroups.length > 0) {
                this.selectSubgroup(subgroups[0]);
            }
        }
    }

    closeCommunityHub() {
        const modal = document.getElementById('community-hub-modal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }



    // Load Chat Room & Discussion Thread data per subgroup
    loadCommunityData(comId) {
        const subgroups = {
            'coins': ['Ancient Coins', 'Indian Coins', 'Rare Coins', 'Coin Trading'],
            'watches': ['Vintage Rolex', 'Seiko Modders', 'Luxury Escapements'],
            'sneakers': ['Sneaker Authentics', 'Nike SB Dunks', 'Grail Showrooms'],
            'cameras': ['Rangefinder Love', 'Film Stock', 'Medium Format']
        }[comId] || [];

        subgroups.forEach(sub => {
            const subKey = sub.replace(/\s+/g, '_').toLowerCase();
            const chatKey = `flexy_com_chat_${comId}_${subKey}`;
            
            if (!localStorage.getItem(chatKey)) {
                const defaultChats = [
                    { id: 'ch_1', userName: 'TechGuru', avatar: 'T', text: `Welcome to the ${sub} group chat!`, time: Date.now() - 3600000 },
                    { id: 'ch_2', userName: 'Fashionista', avatar: 'F', text: `Hey collectors! Excited to talk about ${sub} here.`, time: Date.now() - 1800000 }
                ];
                localStorage.setItem(chatKey, JSON.stringify(defaultChats));
            }
        });
    }

    renderSubgroupsList(subgroups) {
        const container = document.getElementById('hub-subgroups-list');
        if (!container) return;
        
        container.innerHTML = subgroups.map(sub => {
            return `
                <button class="subgroup-item-btn" onclick="home.selectSubgroup('${sub}')" style="text-align: left; width: 100%; padding: 0.6rem 0.75rem; background: transparent; border: none; border-radius: var(--radius-sm); color: var(--text-secondary); font-size: 0.85rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; transition: all var(--transition-fast);">
                    <span>#</span>
                    <span class="subgroup-name">${sub}</span>
                </button>
            `;
        }).join('');
    }

    selectSubgroup(subgroupName) {
        this.activeSubgroupId = subgroupName.replace(/\s+/g, '_').toLowerCase();
        
        // Update active class in sidebar buttons
        document.querySelectorAll('.subgroup-item-btn').forEach(btn => {
            const nameEl = btn.querySelector('.subgroup-name');
            if (nameEl && nameEl.textContent === subgroupName) {
                btn.style.background = 'var(--primary-glow)';
                btn.style.color = 'var(--primary)';
            } else {
                btn.style.background = 'transparent';
                btn.style.color = 'var(--text-secondary)';
            }
        });

        this.renderHubChat();
    }

    renderHubChat() {
        const container = document.getElementById('hub-chat-messages');
        if (!container) return;

        const chatKey = `flexy_com_chat_${this.activeCommunityId}_${this.activeSubgroupId}`;
        const chats = JSON.parse(localStorage.getItem(chatKey) || '[]');

        if (chats.length === 0) {
            container.innerHTML = `<p style="color:var(--text-muted); font-size:0.85rem; text-align:center; padding: 2rem;">No messages in this chat room. Start the conversation!</p>`;
            return;
        }

        container.innerHTML = chats.map(c => {
            const isSelf = c.userName === (this.currentUser?.name || 'Guest');
            return `
                <div class="chat-bubble ${isSelf ? 'self' : ''}">
                    <div class="chat-avatar">${c.avatar || 'U'}</div>
                    <div class="chat-text-wrapper">
                        <div class="chat-user">${c.userName}</div>
                        <div class="chat-msg-text">${c.text}</div>
                        <div class="chat-msg-time">${new Date(c.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                </div>
            `;
        }).join('');
        this.scrollToChatBottom();
    }

    scrollToChatBottom() {
        const container = document.getElementById('hub-chat-messages');
        if (container) {
            setTimeout(() => {
                container.scrollTop = container.scrollHeight;
            }, 50);
        }
    }

    sendCommunityChatMessage() {
        const input = document.getElementById('hub-chat-input');
        if (!input || !input.value.trim()) return;

        const chatKey = `flexy_com_chat_${this.activeCommunityId}_${this.activeSubgroupId}`;
        const chats = JSON.parse(localStorage.getItem(chatKey) || '[]');

        const newChatMsg = {
            id: 'ch_' + Date.now(),
            userName: this.currentUser?.name || 'Guest',
            avatar: this.currentUser?.avatar || 'G',
            text: input.value.trim(),
            time: Date.now()
        };

        chats.push(newChatMsg);
        localStorage.setItem(chatKey, JSON.stringify(chats));
        input.value = '';

        this.renderHubChat();
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

    setupScrollAnimations() {
        const sections = document.querySelectorAll('.categories-section, .tabs-section, .tab-pane');
        sections.forEach(s => s.classList.add('reveal-on-scroll'));
        
        const grids = document.querySelectorAll('.items-grid, .categories-grid, .community-grid');
        grids.forEach(g => g.classList.add('stagger-grid'));

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('active');
                    const gridsInSec = entry.target.querySelectorAll('.stagger-grid');
                    gridsInSec.forEach(g => g.classList.add('active'));
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.05 });

        sections.forEach(s => observer.observe(s));
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
            sessionStorage.setItem('search_query', query);
            window.location.href = 'search.html';
        }
    }

    filterByCategory(category) {
        sessionStorage.setItem('filter_category', category);
        window.location.href = 'search.html';
    }

    viewItem(itemId) {
        window.location.href = `item.html?id=${encodeURIComponent(itemId)}`;
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