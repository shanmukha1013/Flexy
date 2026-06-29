// state.js - Application State Management

class AppState {
    constructor() {
        this.state = {
            user: null,
            items: [],
            categories: [],
            filters: {
                query: '',
                category: 'all',
                minPrice: 0,
                maxPrice: 1000000,
                condition: 'all'
            },
            cart: [],
            notifications: [],
            loading: false,
            error: null
        };
        
        this.listeners = [];
        this.init();
    }

    init() {
        // Load initial state from localStorage
        this.loadFromStorage();
        
        // Set up storage sync
        this.setupStorageSync();
    }

    // Get state
    getState() {
        return { ...this.state };
    }

    // Subscribe to state changes
    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    // Notify all listeners
    notify() {
        this.listeners.forEach(listener => listener(this.state));
    }

    // Update state
    setState(updates) {
        this.state = { ...this.state, ...updates };
        this.saveToStorage();
        this.notify();
    }

    // User actions
    setUser(user) {
        this.setState({ user });
    }

    clearUser() {
        this.setState({ user: null });
    }

    updateUser(updates) {
        if (this.state.user) {
            this.setState({
                user: { ...this.state.user, ...updates }
            });
        }
    }

    // Items actions
    setItems(items) {
        this.setState({ items });
    }

    addItem(item) {
        this.setState({
            items: [...this.state.items, item]
        });
    }

    updateItem(itemId, updates) {
        this.setState({
            items: this.state.items.map(item =>
                item.id === itemId ? { ...item, ...updates } : item
            )
        });
    }

    removeItem(itemId) {
        this.setState({
            items: this.state.items.filter(item => item.id !== itemId)
        });
    }

    // Filter actions
    setFilters(filters) {
        this.setState({ filters: { ...this.state.filters, ...filters } });
    }

    clearFilters() {
        this.setState({
            filters: {
                query: '',
                category: 'all',
                minPrice: 0,
                maxPrice: 1000000,
                condition: 'all'
            }
        });
    }

    // Cart actions
    addToCart(item) {
        this.setState({
            cart: [...this.state.cart, { ...item, cartId: Date.now() }]
        });
    }

    removeFromCart(cartId) {
        this.setState({
            cart: this.state.cart.filter(item => item.cartId !== cartId)
        });
    }

    clearCart() {
        this.setState({ cart: [] });
    }

    // Notification actions
    addNotification(notification) {
        const id = Date.now();
        const newNotification = { id, ...notification };
        
        this.setState({
            notifications: [...this.state.notifications, newNotification]
        });
        
        // Auto-remove notification after 5 seconds
        setTimeout(() => {
            this.removeNotification(id);
        }, 5000);
    }

    removeNotification(id) {
        this.setState({
            notifications: this.state.notifications.filter(n => n.id !== id)
        });
    }

    clearNotifications() {
        this.setState({ notifications: [] });
    }

    // Loading state
    setLoading(loading) {
        this.setState({ loading });
    }

    // Error handling
    setError(error) {
        this.setState({ error });
        this.addNotification({
            type: 'error',
            message: error?.message || 'An error occurred',
            duration: 5000
        });
    }

    clearError() {
        this.setState({ error: null });
    }

    // Storage management
    saveToStorage() {
        try {
            // Save user and items to localStorage
            if (this.state.user) {
                localStorage.setItem('flexy_user', JSON.stringify(this.state.user));
                localStorage.setItem('flexy_token', 'token_' + this.state.user.id);
            }
            
            if (this.state.items.length > 0) {
                localStorage.setItem('flexy_items', JSON.stringify(this.state.items));
            }
            
            localStorage.setItem('flexy_cart', JSON.stringify(this.state.cart));
            localStorage.setItem('flexy_filters', JSON.stringify(this.state.filters));
        } catch (error) {
            console.error('Failed to save state to storage:', error);
        }
    }

    loadFromStorage() {
        try {
            // Load user
            const userData = localStorage.getItem('flexy_user');
            const token = localStorage.getItem('flexy_token');
            
            if (userData && token) {
                this.state.user = JSON.parse(userData);
            }
            
            // Load items
            const itemsData = localStorage.getItem('flexy_items');
            if (itemsData) {
                this.state.items = JSON.parse(itemsData);
            }
            
            // Load cart
            const cartData = localStorage.getItem('flexy_cart');
            if (cartData) {
                this.state.cart = JSON.parse(cartData);
            }
            
            // Load filters
            const filtersData = localStorage.getItem('flexy_filters');
            if (filtersData) {
                this.state.filters = JSON.parse(filtersData);
            }
        } catch (error) {
            console.error('Failed to load state from storage:', error);
        }
    }

    setupStorageSync() {
        // Listen for storage changes from other tabs
        window.addEventListener('storage', (e) => {
            if (e.key === 'flexy_user') {
                this.state.user = e.newValue ? JSON.parse(e.newValue) : null;
                this.notify();
            } else if (e.key === 'flexy_items') {
                this.state.items = e.newValue ? JSON.parse(e.newValue) : [];
                this.notify();
            } else if (e.key === 'flexy_cart') {
                this.state.cart = e.newValue ? JSON.parse(e.newValue) : [];
                this.notify();
            }
        });
    }

    // Utility methods
    getFilteredItems() {
        const { items, filters } = this.state;
        
        return items.filter(item => {
            // Search query filter
            if (filters.query) {
                const query = filters.query.toLowerCase();
                const matchesQuery = 
                    item.title.toLowerCase().includes(query) ||
                    item.description.toLowerCase().includes(query) ||
                    (item.tags && item.tags.some(tag => tag.toLowerCase().includes(query)));
                
                if (!matchesQuery) return false;
            }
            
            // Category filter
            if (filters.category !== 'all' && item.category !== filters.category) {
                return false;
            }
            
            // Price filter
            if (item.price < filters.minPrice || item.price > filters.maxPrice) {
                return false;
            }
            
            // Condition filter
            if (filters.condition !== 'all' && item.condition !== filters.condition) {
                return false;
            }
            
            return true;
        });
    }

    getItemById(itemId) {
        return this.state.items.find(item => item.id === itemId);
    }

    getUserItems() {
        if (!this.state.user) return [];
        return this.state.items.filter(item => item.sellerId === this.state.user.id);
    }

    getCartTotal() {
        return this.state.cart.reduce((total, item) => total + item.price, 0);
    }

    getCartCount() {
        return this.state.cart.length;
    }

    // Check authentication
    isAuthenticated() {
        return !!this.state.user;
    }

    // Reset state (for logout)
    reset() {
        this.state = {
            user: null,
            items: [],
            categories: [],
            filters: {
                query: '',
                category: 'all',
                minPrice: 0,
                maxPrice: 1000000,
                condition: 'all'
            },
            cart: [],
            notifications: [],
            loading: false,
            error: null
        };
        
        // Clear localStorage
        localStorage.removeItem('flexy_user');
        localStorage.removeItem('flexy_token');
        localStorage.removeItem('flexy_cart');
        
        this.notify();
    }
}

// Create singleton instance
const appState = new AppState();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = appState;
}