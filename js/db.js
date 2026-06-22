// db.js - Local Database/Storage Management

class Database {
    constructor() {
        this.dbName = 'flexy_db';
        this.dbVersion = 1;
        this.init();
    }

    init() {
        // Initialize IndexedDB if available, fallback to localStorage
        this.initIndexedDB();
        
        // Setup localStorage fallback
        this.setupLocalStorage();
    }

    // IndexedDB Methods
    initIndexedDB() {
        if ('indexedDB' in window) {
            this.dbRequest = indexedDB.open(this.dbName, this.dbVersion);
            
            this.dbRequest.onerror = (event) => {
                console.error('IndexedDB error:', event.target.error);
                this.useLocalStorage = true;
            };
            
            this.dbRequest.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create object stores
                if (!db.objectStoreNames.contains('users')) {
                    db.createObjectStore('users', { keyPath: 'id' });
                }
                
                if (!db.objectStoreNames.contains('items')) {
                    const itemsStore = db.createObjectStore('items', { keyPath: 'id' });
                    itemsStore.createIndex('category', 'category', { unique: false });
                    itemsStore.createIndex('sellerId', 'sellerId', { unique: false });
                    itemsStore.createIndex('createdAt', 'createdAt', { unique: false });
                }
                
                if (!db.objectStoreNames.contains('bids')) {
                    const bidsStore = db.createObjectStore('bids', { keyPath: 'id' });
                    bidsStore.createIndex('itemId', 'itemId', { unique: false });
                    bidsStore.createIndex('userId', 'userId', { unique: false });
                    bidsStore.createIndex('createdAt', 'createdAt', { unique: false });
                }
                
                if (!db.objectStoreNames.contains('transactions')) {
                    const transactionsStore = db.createObjectStore('transactions', { keyPath: 'id' });
                    transactionsStore.createIndex('userId', 'userId', { unique: false });
                    transactionsStore.createIndex('date', 'date', { unique: false });
                }
                
                if (!db.objectStoreNames.contains('categories')) {
                    db.createObjectStore('categories', { keyPath: 'id' });
                }
            };
            
            this.dbRequest.onsuccess = (event) => {
                this.db = event.target.result;
                this.useLocalStorage = false;
                console.log('IndexedDB initialized successfully');
            };
        } else {
            this.useLocalStorage = true;
            console.log('IndexedDB not available, using localStorage');
        }
    }

    // LocalStorage Methods
    setupLocalStorage() {
        // Ensure localStorage structure
        if (!localStorage.getItem('flexy_db_initialized')) {
            this.initializeLocalStorage();
        }
    }

    initializeLocalStorage() {
        const defaultStructure = {
            users: {},
            items: {},
            bids: {},
            transactions: {},
            categories: {},
            settings: {}
        };
        
        Object.keys(defaultStructure).forEach(key => {
            if (!localStorage.getItem(`flexy_${key}`)) {
                localStorage.setItem(`flexy_${key}`, JSON.stringify(defaultStructure[key]));
            }
        });
        
        localStorage.setItem('flexy_db_initialized', 'true');
    }

    // Generic Database Methods
    async getDatabase() {
        if (this.useLocalStorage) {
            return 'localStorage';
        }
        
        return new Promise((resolve, reject) => {
            if (this.db) {
                resolve(this.db);
            } else {
                // Wait for DB to initialize
                const checkInterval = setInterval(() => {
                    if (this.db) {
                        clearInterval(checkInterval);
                        resolve(this.db);
                    }
                }, 100);
                
                setTimeout(() => {
                    clearInterval(checkInterval);
                    reject(new Error('Database initialization timeout'));
                }, 5000);
            }
        });
    }

    // User Methods
    async saveUser(user) {
        if (this.useLocalStorage) {
            localStorage.setItem('flexy_user', JSON.stringify(user));
            return user;
        }
        
        try {
            const db = await this.getDatabase();
            const transaction = db.transaction(['users'], 'readwrite');
            const store = transaction.objectStore('users');
            
            return new Promise((resolve, reject) => {
                const request = store.put(user);
                request.onsuccess = () => resolve(user);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            // Fallback to localStorage
            localStorage.setItem('flexy_user', JSON.stringify(user));
            return user;
        }
    }

    async getUser(userId) {
        if (this.useLocalStorage) {
            const userData = localStorage.getItem('flexy_user');
            return userData ? JSON.parse(userData) : null;
        }
        
        try {
            const db = await this.getDatabase();
            const transaction = db.transaction(['users'], 'readonly');
            const store = transaction.objectStore('users');
            
            return new Promise((resolve, reject) => {
                const request = store.get(userId);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            // Fallback to localStorage
            const userData = localStorage.getItem('flexy_user');
            return userData ? JSON.parse(userData) : null;
        }
    }

    async deleteUser(userId) {
        if (this.useLocalStorage) {
            localStorage.removeItem('flexy_user');
            localStorage.removeItem('flexy_token');
            return true;
        }
        
        try {
            const db = await this.getDatabase();
            const transaction = db.transaction(['users'], 'readwrite');
            const store = transaction.objectStore('users');
            
            return new Promise((resolve, reject) => {
                const request = store.delete(userId);
                request.onsuccess = () => resolve(true);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            // Fallback to localStorage
            localStorage.removeItem('flexy_user');
            localStorage.removeItem('flexy_token');
            return true;
        }
    }

    // Item Methods
    async saveItem(item) {
        if (this.useLocalStorage) {
            const items = this.getLocalStorageItems();
            items[item.id] = item;
            localStorage.setItem('flexy_items', JSON.stringify(items));
            return item;
        }
        
        try {
            const db = await this.getDatabase();
            const transaction = db.transaction(['items'], 'readwrite');
            const store = transaction.objectStore('items');
            
            return new Promise((resolve, reject) => {
                const request = store.put(item);
                request.onsuccess = () => resolve(item);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            // Fallback to localStorage
            const items = this.getLocalStorageItems();
            items[item.id] = item;
            localStorage.setItem('flexy_items', JSON.stringify(items));
            return item;
        }
    }

    async getItem(itemId) {
        if (this.useLocalStorage) {
            const items = this.getLocalStorageItems();
            return items[itemId] || null;
        }
        
        try {
            const db = await this.getDatabase();
            const transaction = db.transaction(['items'], 'readonly');
            const store = transaction.objectStore('items');
            
            return new Promise((resolve, reject) => {
                const request = store.get(itemId);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            // Fallback to localStorage
            const items = this.getLocalStorageItems();
            return items[itemId] || null;
        }
    }

    async getItems(filters = {}) {
        if (this.useLocalStorage) {
            let items = Object.values(this.getLocalStorageItems());
            
            // Apply filters
            if (filters.category && filters.category !== 'all') {
                items = items.filter(item => item.category === filters.category);
            }
            
            if (filters.sellerId) {
                items = items.filter(item => item.sellerId === filters.sellerId);
            }
            
            if (filters.minPrice !== undefined) {
                items = items.filter(item => item.price >= filters.minPrice);
            }
            
            if (filters.maxPrice !== undefined) {
                items = items.filter(item => item.price <= filters.maxPrice);
            }
            
            if (filters.condition && filters.condition !== 'all') {
                items = items.filter(item => item.condition === filters.condition);
            }
            
            // Filter out expired and sold items by default
            if (filters.active !== false) {
                items = items.filter(item => !item.expired && !item.sold);
            }
            
            // Sort
            if (filters.sortBy) {
                switch (filters.sortBy) {
                    case 'price-low':
                        items.sort((a, b) => a.price - b.price);
                        break;
                    case 'price-high':
                        items.sort((a, b) => b.price - a.price);
                        break;
                    case 'newest':
                        items.sort((a, b) => b.createdAt - a.createdAt);
                        break;
                    case 'ending':
                        items.sort((a, b) => a.timeRemaining - b.timeRemaining);
                        break;
                    case 'bids':
                        items.sort((a, b) => b.bids - a.bids);
                        break;
                }
            }
            
            // Limit
            if (filters.limit) {
                items = items.slice(0, filters.limit);
            }
            
            return items;
        }
        
        try {
            const db = await this.getDatabase();
            const transaction = db.transaction(['items'], 'readonly');
            const store = transaction.objectStore('items');
            
            return new Promise((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => {
                    let items = request.result;
                    
                    // Apply filters
                    if (filters.category && filters.category !== 'all') {
                        items = items.filter(item => item.category === filters.category);
                    }
                    
                    if (filters.sellerId) {
                        items = items.filter(item => item.sellerId === filters.sellerId);
                    }
                    
                    if (filters.minPrice !== undefined) {
                        items = items.filter(item => item.price >= filters.minPrice);
                    }
                    
                    if (filters.maxPrice !== undefined) {
                        items = items.filter(item => item.price <= filters.maxPrice);
                    }
                    
                    if (filters.condition && filters.condition !== 'all') {
                        items = items.filter(item => item.condition === filters.condition);
                    }
                    
                    // Filter out expired and sold items by default
                    if (filters.active !== false) {
                        items = items.filter(item => !item.expired && !item.sold);
                    }
                    
                    // Sort
                    if (filters.sortBy) {
                        switch (filters.sortBy) {
                            case 'price-low':
                                items.sort((a, b) => a.price - b.price);
                                break;
                            case 'price-high':
                                items.sort((a, b) => b.price - a.price);
                                break;
                            case 'newest':
                                items.sort((a, b) => b.createdAt - a.createdAt);
                                break;
                            case 'ending':
                                items.sort((a, b) => a.timeRemaining - b.timeRemaining);
                                break;
                            case 'bids':
                                items.sort((a, b) => b.bids - a.bids);
                                break;
                        }
                    }
                    
                    // Limit
                    if (filters.limit) {
                        items = items.slice(0, filters.limit);
                    }
                    
                    resolve(items);
                };
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            // Fallback to localStorage
            let items = Object.values(this.getLocalStorageItems());
            
            // Apply filters
            if (filters.category && filters.category !== 'all') {
                items = items.filter(item => item.category === filters.category);
            }
            
            if (filters.sellerId) {
                items = items.filter(item => item.sellerId === filters.sellerId);
            }
            
            if (filters.minPrice !== undefined) {
                items = items.filter(item => item.price >= filters.minPrice);
            }
            
            if (filters.maxPrice !== undefined) {
                items = items.filter(item => item.price <= filters.maxPrice);
            }
            
            if (filters.condition && filters.condition !== 'all') {
                items = items.filter(item => item.condition === filters.condition);
            }
            
            // Filter out expired and sold items by default
            if (filters.active !== false) {
                items = items.filter(item => !item.expired && !item.sold);
            }
            
            // Sort
            if (filters.sortBy) {
                switch (filters.sortBy) {
                    case 'price-low':
                        items.sort((a, b) => a.price - b.price);
                        break;
                    case 'price-high':
                        items.sort((a, b) => b.price - a.price);
                        break;
                    case 'newest':
                        items.sort((a, b) => b.createdAt - a.createdAt);
                        break;
                    case 'ending':
                        items.sort((a, b) => a.timeRemaining - b.timeRemaining);
                        break;
                    case 'bids':
                        items.sort((a, b) => b.bids - a.bids);
                        break;
                }
            }
            
            // Limit
            if (filters.limit) {
                items = items.slice(0, filters.limit);
            }
            
            return items;
        }
    }

    async updateItem(itemId, updates) {
        if (this.useLocalStorage) {
            const items = this.getLocalStorageItems();
            if (items[itemId]) {
                items[itemId] = { ...items[itemId], ...updates };
                localStorage.setItem('flexy_items', JSON.stringify(items));
                return items[itemId];
            }
            return null;
        }
        
        try {
            const db = await this.getDatabase();
            const transaction = db.transaction(['items'], 'readwrite');
            const store = transaction.objectStore('items');
            
            return new Promise((resolve, reject) => {
                // First get the item
                const getRequest = store.get(itemId);
                getRequest.onsuccess = () => {
                    const item = getRequest.result;
                    if (item) {
                        const updatedItem = { ...item, ...updates };
                        const putRequest = store.put(updatedItem);
                        putRequest.onsuccess = () => resolve(updatedItem);
                        putRequest.onerror = () => reject(putRequest.error);
                    } else {
                        resolve(null);
                    }
                };
                getRequest.onerror = () => reject(getRequest.error);
            });
        } catch (error) {
            // Fallback to localStorage
            const items = this.getLocalStorageItems();
            if (items[itemId]) {
                items[itemId] = { ...items[itemId], ...updates };
                localStorage.setItem('flexy_items', JSON.stringify(items));
                return items[itemId];
            }
            return null;
        }
    }

    async deleteItem(itemId) {
        if (this.useLocalStorage) {
            const items = this.getLocalStorageItems();
            delete items[itemId];
            localStorage.setItem('flexy_items', JSON.stringify(items));
            return true;
        }
        
        try {
            const db = await this.getDatabase();
            const transaction = db.transaction(['items'], 'readwrite');
            const store = transaction.objectStore('items');
            
            return new Promise((resolve, reject) => {
                const request = store.delete(itemId);
                request.onsuccess = () => resolve(true);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            // Fallback to localStorage
            const items = this.getLocalStorageItems();
            delete items[itemId];
            localStorage.setItem('flexy_items', JSON.stringify(items));
            return true;
        }
    }

    // Bid Methods
    async saveBid(bid) {
        if (this.useLocalStorage) {
            const bids = this.getLocalStorageBids();
            bids[bid.id] = bid;
            localStorage.setItem('flexy_bids', JSON.stringify(bids));
            return bid;
        }
        
        try {
            const db = await this.getDatabase();
            const transaction = db.transaction(['bids'], 'readwrite');
            const store = transaction.objectStore('bids');
            
            return new Promise((resolve, reject) => {
                const request = store.put(bid);
                request.onsuccess = () => resolve(bid);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            // Fallback to localStorage
            const bids = this.getLocalStorageBids();
            bids[bid.id] = bid;
            localStorage.setItem('flexy_bids', JSON.stringify(bids));
            return bid;
        }
    }

    async getBids(filters = {}) {
        if (this.useLocalStorage) {
            let bids = Object.values(this.getLocalStorageBids());
            
            // Apply filters
            if (filters.itemId) {
                bids = bids.filter(bid => bid.itemId === filters.itemId);
            }
            
            if (filters.userId) {
                bids = bids.filter(bid => bid.userId === filters.userId);
            }
            
            // Sort
            bids.sort((a, b) => b.createdAt - a.createdAt);
            
            // Limit
            if (filters.limit) {
                bids = bids.slice(0, filters.limit);
            }
            
            return bids;
        }
        
        try {
            const db = await this.getDatabase();
            const transaction = db.transaction(['bids'], 'readonly');
            const store = transaction.objectStore('bids');
            
            return new Promise((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => {
                    let bids = request.result;
                    
                    // Apply filters
                    if (filters.itemId) {
                        bids = bids.filter(bid => bid.itemId === filters.itemId);
                    }
                    
                    if (filters.userId) {
                        bids = bids.filter(bid => bid.userId === filters.userId);
                    }
                    
                    // Sort
                    bids.sort((a, b) => b.createdAt - a.createdAt);
                    
                    // Limit
                    if (filters.limit) {
                        bids = bids.slice(0, filters.limit);
                    }
                    
                    resolve(bids);
                };
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            // Fallback to localStorage
            let bids = Object.values(this.getLocalStorageBids());
            
            // Apply filters
            if (filters.itemId) {
                bids = bids.filter(bid => bid.itemId === filters.itemId);
            }
            
            if (filters.userId) {
                bids = bids.filter(bid => bid.userId === filters.userId);
            }
            
            // Sort
            bids.sort((a, b) => b.createdAt - a.createdAt);
            
            // Limit
            if (filters.limit) {
                bids = bids.slice(0, filters.limit);
            }
            
            return bids;
        }
    }

    // Transaction Methods
    async saveTransaction(transaction) {
        if (this.useLocalStorage) {
            const transactions = this.getLocalStorageTransactions();
            transactions[transaction.id] = transaction;
            localStorage.setItem('flexy_transactions', JSON.stringify(transactions));
            return transaction;
        }
        
        try {
            const db = await this.getDatabase();
            const transactionStore = db.transaction(['transactions'], 'readwrite');
            const store = transactionStore.objectStore('transactions');
            
            return new Promise((resolve, reject) => {
                const request = store.put(transaction);
                request.onsuccess = () => resolve(transaction);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            // Fallback to localStorage
            const transactions = this.getLocalStorageTransactions();
            transactions[transaction.id] = transaction;
            localStorage.setItem('flexy_transactions', JSON.stringify(transactions));
            return transaction;
        }
    }

    async getTransactions(filters = {}) {
        if (this.useLocalStorage) {
            let transactions = Object.values(this.getLocalStorageTransactions());
            
            // Apply filters
            if (filters.userId) {
                transactions = transactions.filter(txn => txn.userId === filters.userId);
            }
            
            if (filters.type) {
                transactions = transactions.filter(txn => txn.type === filters.type);
            }
            
            // Sort
            transactions.sort((a, b) => b.date - a.date);
            
            // Limit
            if (filters.limit) {
                transactions = transactions.slice(0, filters.limit);
            }
            
            return transactions;
        }
        
        try {
            const db = await this.getDatabase();
            const transaction = db.transaction(['transactions'], 'readonly');
            const store = transaction.objectStore('transactions');
            
            return new Promise((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => {
                    let transactions = request.result;
                    
                    // Apply filters
                    if (filters.userId) {
                        transactions = transactions.filter(txn => txn.userId === filters.userId);
                    }
                    
                    if (filters.type) {
                        transactions = transactions.filter(txn => txn.type === filters.type);
                    }
                    
                    // Sort
                    transactions.sort((a, b) => b.date - a.date);
                    
                    // Limit
                    if (filters.limit) {
                        transactions = transactions.slice(0, filters.limit);
                    }
                    
                    resolve(transactions);
                };
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            // Fallback to localStorage
            let transactions = Object.values(this.getLocalStorageTransactions());
            
            // Apply filters
            if (filters.userId) {
                transactions = transactions.filter(txn => txn.userId === filters.userId);
            }
            
            if (filters.type) {
                transactions = transactions.filter(txn => txn.type === filters.type);
            }
            
            // Sort
            transactions.sort((a, b) => b.date - a.date);
            
            // Limit
            if (filters.limit) {
                transactions = transactions.slice(0, filters.limit);
            }
            
            return transactions;
        }
    }

    // Category Methods
    async saveCategory(category) {
        if (this.useLocalStorage) {
            const categories = this.getLocalStorageCategories();
            categories[category.id] = category;
            localStorage.setItem('flexy_categories', JSON.stringify(categories));
            return category;
        }
        
        try {
            const db = await this.getDatabase();
            const transaction = db.transaction(['categories'], 'readwrite');
            const store = transaction.objectStore('categories');
            
            return new Promise((resolve, reject) => {
                const request = store.put(category);
                request.onsuccess = () => resolve(category);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            // Fallback to localStorage
            const categories = this.getLocalStorageCategories();
            categories[category.id] = category;
            localStorage.setItem('flexy_categories', JSON.stringify(categories));
            return category;
        }
    }

    async getCategories() {
        if (this.useLocalStorage) {
            return Object.values(this.getLocalStorageCategories());
        }
        
        try {
            const db = await this.getDatabase();
            const transaction = db.transaction(['categories'], 'readonly');
            const store = transaction.objectStore('categories');
            
            return new Promise((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            // Fallback to localStorage
            return Object.values(this.getLocalStorageCategories());
        }
    }

    // Search Methods
    async searchItems(query, filters = {}) {
        const items = await this.getItems(filters);
        
        if (!query) return items;
        
        const searchQuery = query.toLowerCase();
        return items.filter(item => {
            return (
                item.title.toLowerCase().includes(searchQuery) ||
                item.description.toLowerCase().includes(searchQuery) ||
                (item.tags && item.tags.some(tag => tag.toLowerCase().includes(searchQuery)))
            );
        });
    }

    // Stats Methods
    async getStats(userId) {
        const [items, bids, transactions] = await Promise.all([
            this.getItems({ sellerId: userId }),
            this.getBids({ userId }),
            this.getTransactions({ userId })
        ]);
        
        const itemsListed = items.length;
        const itemsSold = items.filter(item => item.sold).length;
        const activeBids = bids.filter(bid => {
            const item = items.find(i => i.id === bid.itemId);
            return item && !item.expired && !item.sold;
        }).length;
        const totalSpent = transactions
            .filter(txn => txn.type === 'debit')
            .reduce((total, txn) => total + txn.amount, 0);
        const totalReceived = transactions
            .filter(txn => txn.type === 'credit')
            .reduce((total, txn) => total + txn.amount, 0);
        
        return {
            itemsListed,
            itemsSold,
            activeBids,
            totalSpent,
            totalReceived,
            successRate: itemsListed > 0 ? Math.round((itemsSold / itemsListed) * 100) : 0
        };
    }

    // Backup and Restore
    async backup() {
        const [users, items, bids, transactions, categories] = await Promise.all([
            this.useLocalStorage ? 
                Promise.resolve(this.getLocalStorageUsers()) :
                this.getAllFromStore('users'),
            this.useLocalStorage ? 
                Promise.resolve(this.getLocalStorageItems()) :
                this.getAllFromStore('items'),
            this.useLocalStorage ? 
                Promise.resolve(this.getLocalStorageBids()) :
                this.getAllFromStore('bids'),
            this.useLocalStorage ? 
                Promise.resolve(this.getLocalStorageTransactions()) :
                this.getAllFromStore('transactions'),
            this.useLocalStorage ? 
                Promise.resolve(this.getLocalStorageCategories()) :
                this.getAllFromStore('categories')
        ]);
        
        return {
            timestamp: Date.now(),
            version: this.dbVersion,
            data: {
                users,
                items,
                bids,
                transactions,
                categories
            }
        };
    }

    async restore(backupData) {
        if (!backupData || !backupData.data) {
            throw new Error('Invalid backup data');
        }
        
        const { users, items, bids, transactions, categories } = backupData.data;
        
        // Clear existing data
        await this.clearAll();
        
        // Restore data
        const promises = [];
        
        if (users) {
            Object.values(users).forEach(user => {
                promises.push(this.saveUser(user));
            });
        }
        
        if (items) {
            Object.values(items).forEach(item => {
                promises.push(this.saveItem(item));
            });
        }
        
        if (bids) {
            Object.values(bids).forEach(bid => {
                promises.push(this.saveBid(bid));
            });
        }
        
        if (transactions) {
            Object.values(transactions).forEach(transaction => {
                promises.push(this.saveTransaction(transaction));
            });
        }
        
        if (categories) {
            Object.values(categories).forEach(category => {
                promises.push(this.saveCategory(category));
            });
        }
        
        await Promise.all(promises);
        
        return {
            success: true,
            message: 'Data restored successfully',
            itemsRestored: promises.length
        };
    }

    async clearAll() {
        if (this.useLocalStorage) {
            const keys = [
                'flexy_users',
                'flexy_items',
                'flexy_bids',
                'flexy_transactions',
                'flexy_categories',
                'flexy_user',
                'flexy_token'
            ];
            
            keys.forEach(key => localStorage.removeItem(key));
            localStorage.removeItem('flexy_db_initialized');
        } else {
            try {
                const db = await this.getDatabase();
                const stores = ['users', 'items', 'bids', 'transactions', 'categories'];
                
                const promises = stores.map(storeName => {
                    return new Promise((resolve, reject) => {
                        const transaction = db.transaction([storeName], 'readwrite');
                        const store = transaction.objectStore(storeName);
                        const request = store.clear();
                        
                        request.onsuccess = () => resolve();
                        request.onerror = () => reject(request.error);
                    });
                });
                
                await Promise.all(promises);
            } catch (error) {
                console.error('Error clearing database:', error);
            }
        }
    }

    // Utility Methods
    getLocalStorageUsers() {
        const data = localStorage.getItem('flexy_users');
        return data ? JSON.parse(data) : {};
    }

    getLocalStorageItems() {
        const data = localStorage.getItem('flexy_items');
        return data ? JSON.parse(data) : {};
    }

    getLocalStorageBids() {
        const data = localStorage.getItem('flexy_bids');
        return data ? JSON.parse(data) : {};
    }

    getLocalStorageTransactions() {
        const data = localStorage.getItem('flexy_transactions');
        return data ? JSON.parse(data) : {};
    }

    getLocalStorageCategories() {
        const data = localStorage.getItem('flexy_categories');
        return data ? JSON.parse(data) : {};
    }

    async getAllFromStore(storeName) {
        if (this.useLocalStorage) {
            const data = localStorage.getItem(`flexy_${storeName}`);
            return data ? JSON.parse(data) : {};
        }
        
        try {
            const db = await this.getDatabase();
            const transaction = db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            
            return new Promise((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => {
                    const items = {};
                    request.result.forEach(item => {
                        items[item.id] = item;
                    });
                    resolve(items);
                };
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            const data = localStorage.getItem(`flexy_${storeName}`);
            return data ? JSON.parse(data) : {};
        }
    }

    // Export data as JSON
    async exportData() {
        const backup = await this.backup();
        const jsonString = JSON.stringify(backup, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `flexy_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        return {
            success: true,
            filename: a.download
        };
    }

    // Import data from JSON file
    async importData(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = async (event) => {
                try {
                    const backupData = JSON.parse(event.target.result);
                    const result = await this.restore(backupData);
                    resolve(result);
                } catch (error) {
                    reject(new Error('Invalid backup file'));
                }
            };
            
            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };
            
            reader.readAsText(file);
        });
    }

    // Get database size
    async getDatabaseSize() {
        if (this.useLocalStorage) {
            let total = 0;
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith('flexy_')) {
                    total += localStorage.getItem(key).length;
                }
            }
            return total;
        }
        
        // For IndexedDB, we can only estimate
        return null;
    }

    // Compact database (clean up expired/old data)
    async compact() {
        const items = await this.getItems();
        const now = Date.now();
        const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
        
        // Mark items as expired if time has run out
        const expiredItems = items.filter(item => 
            item.timeRemaining <= 0 && !item.expired
        );
        
        for (const item of expiredItems) {
            await this.updateItem(item.id, { expired: true });
        }
        
        // Clean up old bids (older than 30 days)
        const bids = await this.getBids();
        const oldBids = bids.filter(bid => bid.createdAt < thirtyDaysAgo);
        
        // We'll keep bids for record, but can be cleaned if needed
        
        return {
            expiredItemsMarked: expiredItems.length,
            oldBids: oldBids.length
        };
    }

    // Health check
    async healthCheck() {
        try {
            const [userCount, itemCount, bidCount, transactionCount] = await Promise.all([
                this.useLocalStorage ? 
                    Promise.resolve(Object.keys(this.getLocalStorageUsers()).length) :
                    this.getCount('users'),
                this.useLocalStorage ? 
                    Promise.resolve(Object.keys(this.getLocalStorageItems()).length) :
                    this.getCount('items'),
                this.useLocalStorage ? 
                    Promise.resolve(Object.keys(this.getLocalStorageBids()).length) :
                    this.getCount('bids'),
                this.useLocalStorage ? 
                    Promise.resolve(Object.keys(this.getLocalStorageTransactions()).length) :
                    this.getCount('transactions')
            ]);
            
            return {
                healthy: true,
                storage: this.useLocalStorage ? 'localStorage' : 'indexedDB',
                counts: {
                    users: userCount,
                    items: itemCount,
                    bids: bidCount,
                    transactions: transactionCount
                },
                timestamp: Date.now()
            };
        } catch (error) {
            return {
                healthy: false,
                error: error.message,
                storage: this.useLocalStorage ? 'localStorage' : 'indexedDB',
                timestamp: Date.now()
            };
        }
    }

    async getCount(storeName) {
        if (this.useLocalStorage) {
            const data = localStorage.getItem(`flexy_${storeName}`);
            return data ? Object.keys(JSON.parse(data)).length : 0;
        }
        
        try {
            const db = await this.getDatabase();
            const transaction = db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            
            return new Promise((resolve, reject) => {
                const request = store.count();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            const data = localStorage.getItem(`flexy_${storeName}`);
            return data ? Object.keys(JSON.parse(data)).length : 0;
        }
    }

    // Sync with server (simplified)
    async syncWithServer(serverData) {
        // This would normally sync with a remote server
        // For now, we'll just update local storage
        if (serverData.users) {
            serverData.users.forEach(user => this.saveUser(user));
        }
        
        if (serverData.items) {
            serverData.items.forEach(item => this.saveItem(item));
        }
        
        if (serverData.bids) {
            serverData.bids.forEach(bid => this.saveBid(bid));
        }
        
        return {
            success: true,
            synced: (serverData.users?.length || 0) + 
                   (serverData.items?.length || 0) + 
                   (serverData.bids?.length || 0)
        };
    }
}

// Create singleton instance
const database = new Database();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = database;
}