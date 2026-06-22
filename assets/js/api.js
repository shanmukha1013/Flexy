// api.js - API Integration Layer

class API {
    constructor() {
        this.baseURL = 'https://api.flexy.com/v1'; // Replace with actual API URL
        this.timeout = 10000; // 10 seconds
        this.init();
    }

    init() {
        // Set up interceptors or other initialization
        this.setupInterceptors();
    }

    setupInterceptors() {
        // Request interceptor
        this.interceptors = {
            request: [],
            response: []
        };
    }

    // Add request interceptor
    addRequestInterceptor(interceptor) {
        this.interceptors.request.push(interceptor);
    }

    // Add response interceptor
    addResponseInterceptor(interceptor) {
        this.interceptors.response.push(interceptor);
    }

    // Get auth token
    getAuthToken() {
        return localStorage.getItem('flexy_token');
    }

    // Get headers
    getHeaders(contentType = 'application/json') {
        const headers = {
            'Content-Type': contentType,
            'Accept': 'application/json'
        };

        const token = this.getAuthToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        return headers;
    }

    // Handle response
    async handleResponse(response) {
        if (!response.ok) {
            const error = await response.json().catch(() => ({
                message: `HTTP ${response.status}: ${response.statusText}`
            }));
            throw new Error(error.message || 'Request failed');
        }

        return response.json();
    }

    // Request method
    async request(endpoint, options = {}) {
        const url = endpoint.startsWith('http') ? endpoint : `${this.baseURL}${endpoint}`;
        
        // Apply request interceptors
        let processedOptions = { ...options };
        for (const interceptor of this.interceptors.request) {
            processedOptions = await interceptor(processedOptions);
        }

        // Add timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch(url, {
                ...processedOptions,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            // Apply response interceptors
            let processedResponse = response;
            for (const interceptor of this.interceptors.response) {
                processedResponse = await interceptor(processedResponse);
            }

            return this.handleResponse(processedResponse);
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            throw error;
        }
    }

    // GET request
    async get(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        
        return this.request(url, {
            method: 'GET',
            headers: this.getHeaders()
        });
    }

    // POST request
    async post(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(data)
        });
    }

    // PUT request
    async put(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            headers: this.getHeaders(),
            body: JSON.stringify(data)
        });
    }

    // PATCH request
    async patch(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'PATCH',
            headers: this.getHeaders(),
            body: JSON.stringify(data)
        });
    }

    // DELETE request
    async delete(endpoint) {
        return this.request(endpoint, {
            method: 'DELETE',
            headers: this.getHeaders()
        });
    }

    // Upload file
    async upload(endpoint, file, fieldName = 'file') {
        const formData = new FormData();
        formData.append(fieldName, file);

        return this.request(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.getAuthToken()}`
            },
            body: formData
        });
    }

    // Auth API Methods

    // Login with OTP
    async loginWithOTP(phone, name) {
        try {
            // In a real app, this would call the actual API
            // For demo, simulate API call
            await this.simulateDelay();
            
            // Generate mock response
            return {
                success: true,
                data: {
                    user: {
                        id: 'user_' + Date.now(),
                        phone: phone,
                        name: name,
                        avatar: name.charAt(0).toUpperCase()
                    },
                    token: 'token_' + Date.now()
                },
                message: 'OTP sent successfully'
            };
        } catch (error) {
            throw error;
        }
    }

    // Verify OTP
    async verifyOTP(phone, otp) {
        try {
            await this.simulateDelay();
            
            // Mock verification
            if (otp === '123456') {
                return {
                    success: true,
                    data: {
                        user: {
                            id: 'user_' + Date.now(),
                            phone: phone,
                            name: 'User',
                            avatar: 'U'
                        },
                        token: 'token_' + Date.now()
                    },
                    message: 'Login successful'
                };
            } else {
                throw new Error('Invalid OTP');
            }
        } catch (error) {
            throw error;
        }
    }

    // Get user profile
    async getUserProfile() {
        try {
            await this.simulateDelay();
            
            const userData = localStorage.getItem('flexy_user');
            if (!userData) {
                throw new Error('User not found');
            }
            
            return {
                success: true,
                data: JSON.parse(userData)
            };
        } catch (error) {
            throw error;
        }
    }

    // Update user profile
    async updateUserProfile(updates) {
        try {
            await this.simulateDelay();
            
            const userData = localStorage.getItem('flexy_user');
            if (!userData) {
                throw new Error('User not found');
            }
            
            const user = JSON.parse(userData);
            const updatedUser = { ...user, ...updates };
            
            localStorage.setItem('flexy_user', JSON.stringify(updatedUser));
            
            return {
                success: true,
                data: updatedUser,
                message: 'Profile updated successfully'
            };
        } catch (error) {
            throw error;
        }
    }

    // Items API Methods

    // Get items with filters
    async getItems(filters = {}) {
        try {
            await this.simulateDelay();
            
            const itemsData = localStorage.getItem('flexy_items');
            const items = itemsData ? JSON.parse(itemsData) : [];
            
            // Apply filters
            let filteredItems = items.filter(item => !item.expired && !item.sold);
            
            if (filters.query) {
                const query = filters.query.toLowerCase();
                filteredItems = filteredItems.filter(item =>
                    item.title.toLowerCase().includes(query) ||
                    item.description.toLowerCase().includes(query) ||
                    (item.tags && item.tags.some(tag => tag.toLowerCase().includes(query)))
                );
            }
            
            if (filters.category && filters.category !== 'all') {
                filteredItems = filteredItems.filter(item => item.category === filters.category);
            }
            
            if (filters.minPrice !== undefined) {
                filteredItems = filteredItems.filter(item => item.price >= filters.minPrice);
            }
            
            if (filters.maxPrice !== undefined) {
                filteredItems = filteredItems.filter(item => item.price <= filters.maxPrice);
            }
            
            if (filters.condition && filters.condition !== 'all') {
                filteredItems = filteredItems.filter(item => item.condition === filters.condition);
            }
            
            // Sort
            if (filters.sortBy) {
                switch (filters.sortBy) {
                    case 'price-low':
                        filteredItems.sort((a, b) => a.price - b.price);
                        break;
                    case 'price-high':
                        filteredItems.sort((a, b) => b.price - a.price);
                        break;
                    case 'newest':
                        filteredItems.sort((a, b) => b.createdAt - a.createdAt);
                        break;
                    case 'ending':
                        filteredItems.sort((a, b) => a.timeRemaining - b.timeRemaining);
                        break;
                }
            }
            
            // Pagination
            const page = filters.page || 1;
            const limit = filters.limit || 20;
            const startIndex = (page - 1) * limit;
            const endIndex = page * limit;
            
            const paginatedItems = filteredItems.slice(startIndex, endIndex);
            
            return {
                success: true,
                data: {
                    items: paginatedItems,
                    total: filteredItems.length,
                    page: page,
                    limit: limit,
                    totalPages: Math.ceil(filteredItems.length / limit)
                }
            };
        } catch (error) {
            throw error;
        }
    }

    // Get item by ID
    async getItemById(itemId) {
        try {
            await this.simulateDelay();
            
            const itemsData = localStorage.getItem('flexy_items');
            const items = itemsData ? JSON.parse(itemsData) : [];
            
            const item = items.find(i => i.id === itemId);
            
            if (!item) {
                throw new Error('Item not found');
            }
            
            return {
                success: true,
                data: item
            };
        } catch (error) {
            throw error;
        }
    }

    // Create item
    async createItem(itemData) {
        try {
            await this.simulateDelay();
            
            const itemsData = localStorage.getItem('flexy_items');
            const items = itemsData ? JSON.parse(itemsData) : [];
            
            const newItem = {
                id: 'item_' + Date.now(),
                ...itemData,
                createdAt: Date.now(),
                bids: 0,
                expired: false,
                sold: false
            };
            
            items.push(newItem);
            localStorage.setItem('flexy_items', JSON.stringify(items));
            
            return {
                success: true,
                data: newItem,
                message: 'Item created successfully'
            };
        } catch (error) {
            throw error;
        }
    }

    // Update item
    async updateItem(itemId, updates) {
        try {
            await this.simulateDelay();
            
            const itemsData = localStorage.getItem('flexy_items');
            const items = itemsData ? JSON.parse(itemsData) : [];
            
            const index = items.findIndex(i => i.id === itemId);
            
            if (index === -1) {
                throw new Error('Item not found');
            }
            
            items[index] = { ...items[index], ...updates };
            localStorage.setItem('flexy_items', JSON.stringify(items));
            
            return {
                success: true,
                data: items[index],
                message: 'Item updated successfully'
            };
        } catch (error) {
            throw error;
        }
    }

    // Delete item
    async deleteItem(itemId) {
        try {
            await this.simulateDelay();
            
            const itemsData = localStorage.getItem('flexy_items');
            const items = itemsData ? JSON.parse(itemsData) : [];
            
            const filteredItems = items.filter(i => i.id !== itemId);
            localStorage.setItem('flexy_items', JSON.stringify(filteredItems));
            
            return {
                success: true,
                message: 'Item deleted successfully'
            };
        } catch (error) {
            throw error;
        }
    }

    // Bids API Methods

    // Place bid
    async placeBid(itemId, amount) {
        try {
            await this.simulateDelay();
            
            // Check user balance
            const userData = localStorage.getItem('flexy_user');
            if (!userData) {
                throw new Error('User not found');
            }
            
            const user = JSON.parse(userData);
            if (user.balance < amount) {
                throw new Error('Insufficient balance');
            }
            
            // Update item
            const itemsData = localStorage.getItem('flexy_items');
            const items = itemsData ? JSON.parse(itemsData) : [];
            
            const itemIndex = items.findIndex(i => i.id === itemId);
            if (itemIndex === -1) {
                throw new Error('Item not found');
            }
            
            // Update item bids and price
            items[itemIndex].bids += 1;
            items[itemIndex].price = Math.max(items[itemIndex].price, amount);
            
            // Update user balance
            user.balance -= amount;
            localStorage.setItem('flexy_user', JSON.stringify(user));
            
            // Save items
            localStorage.setItem('flexy_items', JSON.stringify(items));
            
            // Record bid
            const userBids = JSON.parse(localStorage.getItem('flexy_user_bids_' + user.id) || '[]');
            userBids.push({
                id: 'bid_' + Date.now(),
                itemId: itemId,
                amount: amount,
                status: 'active',
                createdAt: Date.now()
            });
            localStorage.setItem('flexy_user_bids_' + user.id, JSON.stringify(userBids));
            
            return {
                success: true,
                data: {
                    bidId: 'bid_' + Date.now(),
                    amount: amount,
                    itemId: itemId
                },
                message: 'Bid placed successfully'
            };
        } catch (error) {
            throw error;
        }
    }

    // Get user bids
    async getUserBids() {
        try {
            await this.simulateDelay();
            
            const userData = localStorage.getItem('flexy_user');
            if (!userData) {
                throw new Error('User not found');
            }
            
            const user = JSON.parse(userData);
            const userBids = JSON.parse(localStorage.getItem('flexy_user_bids_' + user.id) || '[]');
            
            // Get items for bids
            const itemsData = localStorage.getItem('flexy_items');
            const items = itemsData ? JSON.parse(itemsData) : [];
            
            const bidsWithItems = userBids.map(bid => {
                const item = items.find(i => i.id === bid.itemId);
                return {
                    ...bid,
                    item: item || null
                };
            });
            
            return {
                success: true,
                data: bidsWithItems
            };
        } catch (error) {
            throw error;
        }
    }

    // Wallet API Methods

    // Get wallet balance
    async getWalletBalance() {
        try {
            await this.simulateDelay();
            
            const userData = localStorage.getItem('flexy_user');
            if (!userData) {
                throw new Error('User not found');
            }
            
            const user = JSON.parse(userData);
            
            return {
                success: true,
                data: {
                    balance: user.balance || 0,
                    currency: 'INR'
                }
            };
        } catch (error) {
            throw error;
        }
    }

    // Add money to wallet
    async addMoney(amount, paymentMethod) {
        try {
            await this.simulateDelay();
            
            const userData = localStorage.getItem('flexy_user');
            if (!userData) {
                throw new Error('User not found');
            }
            
            const user = JSON.parse(userData);
            user.balance += amount;
            localStorage.setItem('flexy_user', JSON.stringify(user));
            
            // Record transaction
            const transactions = JSON.parse(localStorage.getItem('flexy_transactions_' + user.id) || '[]');
            transactions.unshift({
                id: 'txn_' + Date.now(),
                type: 'credit',
                amount: amount,
                description: `Money added via ${paymentMethod}`,
                method: paymentMethod,
                date: Date.now(),
                status: 'completed'
            });
            localStorage.setItem('flexy_transactions_' + user.id, JSON.stringify(transactions));
            
            return {
                success: true,
                data: {
                    newBalance: user.balance,
                    transactionId: 'txn_' + Date.now()
                },
                message: 'Money added successfully'
            };
        } catch (error) {
            throw error;
        }
    }

    // Get transactions
    async getTransactions(filters = {}) {
        try {
            await this.simulateDelay();
            
            const userData = localStorage.getItem('flexy_user');
            if (!userData) {
                throw new Error('User not found');
            }
            
            const user = JSON.parse(userData);
            let transactions = JSON.parse(localStorage.getItem('flexy_transactions_' + user.id) || '[]');
            
            // Apply filters
            if (filters.type) {
                transactions = transactions.filter(txn => txn.type === filters.type);
            }
            
            if (filters.startDate) {
                transactions = transactions.filter(txn => txn.date >= filters.startDate);
            }
            
            if (filters.endDate) {
                transactions = transactions.filter(txn => txn.date <= filters.endDate);
            }
            
            // Sort by date (newest first)
            transactions.sort((a, b) => b.date - a.date);
            
            // Pagination
            const page = filters.page || 1;
            const limit = filters.limit || 20;
            const startIndex = (page - 1) * limit;
            const endIndex = page * limit;
            
            const paginatedTransactions = transactions.slice(startIndex, endIndex);
            
            return {
                success: true,
                data: {
                    transactions: paginatedTransactions,
                    total: transactions.length,
                    page: page,
                    limit: limit,
                    totalPages: Math.ceil(transactions.length / limit)
                }
            };
        } catch (error) {
            throw error;
        }
    }

    // Categories API Methods

    // Get categories
    async getCategories() {
        try {
            await this.simulateDelay();
            
            const categories = [
                { id: 'electronics', name: 'Electronics', icon: '📱', itemCount: 124 },
                { id: 'fashion', name: 'Fashion', icon: '👕', itemCount: 89 },
                { id: 'home', name: 'Home & Garden', icon: '🏠', itemCount: 67 },
                { id: 'sports', name: 'Sports', icon: '⚽', itemCount: 45 },
                { id: 'books', name: 'Books & Media', icon: '📚', itemCount: 56 },
                { id: 'vehicles', name: 'Vehicles', icon: '🚗', itemCount: 23 },
                { id: 'collectibles', name: 'Collectibles', icon: '🎨', itemCount: 34 },
                { id: 'services', name: 'Services', icon: '🔧', itemCount: 78 }
            ];
            
            return {
                success: true,
                data: categories
            };
        } catch (error) {
            throw error;
        }
    }

    // Search API Methods

    // Search items
    async searchItems(query, filters = {}) {
        try {
            await this.simulateDelay();
            
            const itemsData = localStorage.getItem('flexy_items');
            const items = itemsData ? JSON.parse(itemsData) : [];
            
            let results = items.filter(item => !item.expired && !item.sold);
            
            // Apply search query
            if (query) {
                const searchQuery = query.toLowerCase();
                results = results.filter(item =>
                    item.title.toLowerCase().includes(searchQuery) ||
                    item.description.toLowerCase().includes(searchQuery) ||
                    (item.tags && item.tags.some(tag => tag.toLowerCase().includes(searchQuery)))
                );
            }
            
            // Apply filters
            if (filters.category && filters.category !== 'all') {
                results = results.filter(item => item.category === filters.category);
            }
            
            if (filters.minPrice !== undefined) {
                results = results.filter(item => item.price >= filters.minPrice);
            }
            
            if (filters.maxPrice !== undefined) {
                results = results.filter(item => item.price <= filters.maxPrice);
            }
            
            if (filters.condition && filters.condition !== 'all') {
                results = results.filter(item => item.condition === filters.condition);
            }
            
            // Sort results
            if (filters.sortBy) {
                switch (filters.sortBy) {
                    case 'price-low':
                        results.sort((a, b) => a.price - b.price);
                        break;
                    case 'price-high':
                        results.sort((a, b) => b.price - a.price);
                        break;
                    case 'newest':
                        results.sort((a, b) => b.createdAt - a.createdAt);
                        break;
                    case 'ending':
                        results.sort((a, b) => a.timeRemaining - b.timeRemaining);
                        break;
                    case 'relevance':
                        // Simple relevance: more bids = more relevant
                        results.sort((a, b) => b.bids - a.bids);
                        break;
                }
            }
            
            return {
                success: true,
                data: {
                    items: results,
                    total: results.length,
                    query: query
                }
            };
        } catch (error) {
            throw error;
        }
    }

    // Analytics API Methods

    // Get user stats
    async getUserStats() {
        try {
            await this.simulateDelay();
            
            const userData = localStorage.getItem('flexy_user');
            if (!userData) {
                throw new Error('User not found');
            }
            
            const user = JSON.parse(userData);
            
            // Get items
            const itemsData = localStorage.getItem('flexy_items');
            const items = itemsData ? JSON.parse(itemsData) : [];
            
            // Get bids
            const userBids = JSON.parse(localStorage.getItem('flexy_user_bids_' + user.id) || '[]');
            
            // Calculate stats
            const itemsListed = items.filter(item => item.sellerId === user.id).length;
            const itemsSold = items.filter(item => item.sellerId === user.id && item.sold).length;
            const activeBids = userBids.filter(bid => {
                const item = items.find(i => i.id === bid.itemId);
                return item && !item.expired && !item.sold;
            }).length;
            const itemsWon = userBids.filter(bid => {
                const item = items.find(i => i.id === bid.itemId);
                return item && item.expired && !item.sold && item.price === bid.amount;
            }).length;
            
            return {
                success: true,
                data: {
                    itemsListed,
                    itemsSold,
                    activeBids,
                    itemsWon,
                    totalSpent: userBids.reduce((total, bid) => total + bid.amount, 0),
                    successRate: itemsListed > 0 ? Math.round((itemsSold / itemsListed) * 100) : 0
                }
            };
        } catch (error) {
            throw error;
        }
    }

    // Get trending items
    async getTrendingItems(limit = 10) {
        try {
            await this.simulateDelay();
            
            const itemsData = localStorage.getItem('flexy_items');
            const items = itemsData ? JSON.parse(itemsData) : [];
            
            const trending = items
                .filter(item => !item.expired && !item.sold)
                .sort((a, b) => b.bids - a.bids)
                .slice(0, limit);
            
            return {
                success: true,
                data: trending
            };
        } catch (error) {
            throw error;
        }
    }

    // Get recently added items
    async getRecentItems(limit = 10) {
        try {
            await this.simulateDelay();
            
            const itemsData = localStorage.getItem('flexy_items');
            const items = itemsData ? JSON.parse(itemsData) : [];
            
            const recent = items
                .filter(item => !item.expired && !item.sold)
                .sort((a, b) => b.createdAt - a.createdAt)
                .slice(0, limit);
            
            return {
                success: true,
                data: recent
            };
        } catch (error) {
            throw error;
        }
    }

    // Get ending soon items
    async getEndingSoonItems(limit = 10) {
        try {
            await this.simulateDelay();
            
            const itemsData = localStorage.getItem('flexy_items');
            const items = itemsData ? JSON.parse(itemsData) : [];
            
            const endingSoon = items
                .filter(item => !item.expired && !item.sold && item.timeRemaining < 86400) // Less than 24 hours
                .sort((a, b) => a.timeRemaining - b.timeRemaining)
                .slice(0, limit);
            
            return {
                success: true,
                data: endingSoon
            };
        } catch (error) {
            throw error;
        }
    }

    // Utility Methods

    // Simulate network delay
    simulateDelay(min = 300, max = 1000) {
        const delay = Math.random() * (max - min) + min;
        return new Promise(resolve => setTimeout(resolve, delay));
    }

    // Check internet connection
    checkConnection() {
        return navigator.onLine;
    }

    // Retry request
    async retryRequest(fn, retries = 3, delay = 1000) {
        try {
            return await fn();
        } catch (error) {
            if (retries > 0) {
                await this.simulateDelay(delay);
                return this.retryRequest(fn, retries - 1, delay * 2);
            }
            throw error;
        }
    }

    // Batch requests
    async batchRequests(requests, batchSize = 5) {
        const results = [];
        for (let i = 0; i < requests.length; i += batchSize) {
            const batch = requests.slice(i, i + batchSize);
            const batchResults = await Promise.allSettled(batch.map(req => req()));
            results.push(...batchResults);
        }
        return results;
    }

    // Clear cache
    clearCache() {
        // Clear specific cache entries
        const cacheKeys = [
            'flexy_items_cache',
            'flexy_categories_cache',
            'flexy_user_cache'
        ];
        
        cacheKeys.forEach(key => {
            localStorage.removeItem(key);
        });
    }

    // Get API status
    async getAPIStatus() {
        try {
            const response = await fetch(`${this.baseURL}/health`, {
                method: 'GET',
                timeout: 5000
            });
            
            return {
                status: response.status,
                online: response.ok,
                timestamp: Date.now()
            };
        } catch (error) {
            return {
                status: 0,
                online: false,
                error: error.message,
                timestamp: Date.now()
            };
        }
    }

    // Get API version
    async getAPIVersion() {
        try {
            const response = await fetch(`${this.baseURL}/version`);
            const data = await response.json();
            return data;
        } catch (error) {
            return {
                version: '1.0.0',
                build: 'local'
            };
        }
    }

    // Error handling wrapper
    async withErrorHandling(fn, errorMessage = 'An error occurred') {
        try {
            return await fn();
        } catch (error) {
            console.error(errorMessage, error);
            
            // Show user-friendly error message
            this.showError(errorMessage);
            
            throw error;
        }
    }

    // Show error
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'api-error';
        errorDiv.innerHTML = `
            <div class="api-error-content">
                <div class="api-error-icon">⚠️</div>
                <div class="api-error-message">${message}</div>
                <button class="api-error-dismiss" onclick="this.parentElement.parentElement.remove()">Dismiss</button>
            </div>
        `;
        
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.classList.add('show');
        }, 10);
        
        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            errorDiv.classList.remove('show');
            setTimeout(() => errorDiv.remove(), 300);
        }, 5000);
    }

    // Show success message
    showSuccess(message) {
        const successDiv = document.createElement('div');
        successDiv.className = 'api-success';
        successDiv.innerHTML = `
            <div class="api-success-content">
                <div class="api-success-icon">✅</div>
                <div class="api-success-message">${message}</div>
            </div>
        `;
        
        document.body.appendChild(successDiv);
        
        setTimeout(() => {
            successDiv.classList.add('show');
        }, 10);
        
        // Auto-dismiss after 3 seconds
        setTimeout(() => {
            successDiv.classList.remove('show');
            setTimeout(() => successDiv.remove(), 300);
        }, 3000);
    }

    // Loading indicator
    showLoading(show = true, message = 'Loading...') {
        let loadingDiv = document.getElementById('api-loading');
        
        if (show) {
            if (!loadingDiv) {
                loadingDiv = document.createElement('div');
                loadingDiv.id = 'api-loading';
                loadingDiv.className = 'api-loading';
                document.body.appendChild(loadingDiv);
            }
            
            loadingDiv.innerHTML = `
                <div class="api-loading-content">
                    <div class="api-loading-spinner"></div>
                    <div class="api-loading-text">${message}</div>
                </div>
            `;
            
            loadingDiv.classList.add('active');
        } else {
            if (loadingDiv) {
                loadingDiv.classList.remove('active');
                setTimeout(() => {
                    if (loadingDiv && !loadingDiv.classList.contains('active')) {
                        loadingDiv.remove();
                    }
                }, 300);
            }
        }
    }
}

// Create singleton instance
const api = new API();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
}