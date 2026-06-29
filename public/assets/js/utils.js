// utils.js - Utility Functions

class Utils {
    constructor() {
        // Initialize any required setup
    }

    // Format currency
    formatCurrency(amount, currency = 'INR') {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    }

    // Format date
    formatDate(date, format = 'relative') {
        const d = new Date(date);
        const now = new Date();
        const diffInMs = now - d;
        const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

        if (format === 'relative') {
            if (diffInDays === 0) {
                return 'Today';
            } else if (diffInDays === 1) {
                return 'Yesterday';
            } else if (diffInDays < 7) {
                return `${diffInDays} days ago`;
            } else if (diffInDays < 30) {
                const weeks = Math.floor(diffInDays / 7);
                return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
            } else {
                return d.toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                });
            }
        } else if (format === 'short') {
            return d.toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short'
            });
        } else {
            return d.toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
        }
    }

    // Format time remaining
    formatTimeRemaining(seconds) {
        if (seconds <= 0) return 'Ended';
        
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (days > 0) {
            return `${days}d ${hours}h`;
        } else if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    }

    // Generate unique ID
    generateId(prefix = 'id') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Debounce function
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Throttle function
    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // Validate email
    validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    // Validate phone number (Indian)
    validatePhone(phone) {
        const re = /^[6-9]\d{9}$/;
        return re.test(phone);
    }

    // Validate price
    validatePrice(price) {
        return !isNaN(price) && price > 0 && price <= 100000000; // Max 10 crore
    }

    // Truncate text
    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    // Generate avatar from name
    generateAvatar(name) {
        if (!name) return '?';
        return name.charAt(0).toUpperCase();
    }

    // Get random color for avatar
    getAvatarColor(name) {
        const colors = [
            '#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed',
            '#db2777', '#0891b2', '#65a30d', '#ca8a04', '#4f46e5'
        ];
        
        if (!name) return colors[0];
        
        const charCode = name.charCodeAt(0);
        return colors[charCode % colors.length];
    }

    // Calculate discount percentage
    calculateDiscount(originalPrice, currentPrice) {
        if (originalPrice <= currentPrice) return 0;
        return Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
    }

    // Format file size
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Compress image File to a JPEG DataURL with max width and quality
    async compressImage(file, maxWidth = 1200, quality = 0.8) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    try {
                        let w = img.width, h = img.height;
                        if (w > maxWidth) { h = Math.round(h * (maxWidth / w)); w = maxWidth; }
                        const canvas = document.createElement('canvas');
                        canvas.width = w; canvas.height = h;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, w, h);
                        const dataUrl = canvas.toDataURL('image/jpeg', quality);
                        resolve(dataUrl);
                    } catch (err) { reject(err); }
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // Deep clone object
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    // Merge objects
    mergeObjects(...objects) {
        return objects.reduce((merged, obj) => {
            return { ...merged, ...obj };
        }, {});
    }

    // Get query parameters
    getQueryParams() {
        const params = {};
        const queryString = window.location.search.substring(1);
        const pairs = queryString.split('&');
        
        pairs.forEach(pair => {
            const [key, value] = pair.split('=');
            if (key) {
                params[decodeURIComponent(key)] = decodeURIComponent(value || '');
            }
        });
        
        return params;
    }

    // Set query parameters
    setQueryParams(params) {
        const queryString = Object.entries(params)
            .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
            .join('&');
        
        const newUrl = window.location.pathname + (queryString ? '?' + queryString : '');
        window.history.pushState({}, '', newUrl);
    }

    // Scroll to element
    scrollToElement(elementId, offset = 0) {
        const element = document.getElementById(elementId);
        if (element) {
            const elementPosition = element.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - offset;
            
            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    }

    // Copy to clipboard
    copyToClipboard(text) {
        return new Promise((resolve, reject) => {
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(text)
                    .then(resolve)
                    .catch(reject);
            } else {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                
                try {
                    document.execCommand('copy');
                    resolve();
                } catch (err) {
                    reject(err);
                }
                
                textArea.remove();
            }
        });
    }

    // Create notification
    createNotification(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">
                    ${type === 'success' ? '✅' : 
                      type === 'error' ? '❌' : 
                      type === 'warning' ? '⚠️' : 'ℹ️'}
                </span>
                <span class="notification-message">${message}</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Show notification
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        // Auto-remove after duration
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, duration);
        
        return notification;
    }

    // Show loading overlay
    showLoading(show = true, message = 'Loading...') {
        let overlay = document.getElementById('loading-overlay');
        
        if (show) {
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'loading-overlay';
                overlay.className = 'loading-overlay';
                overlay.innerHTML = `
                    <div class="loading-content">
                        <div class="loading-spinner large"></div>
                        <div class="loading-text">${message}</div>
                    </div>
                `;
                document.body.appendChild(overlay);
            }
            overlay.classList.add('active');
        } else {
            if (overlay) {
                overlay.classList.remove('active');
                setTimeout(() => {
                    if (overlay && !overlay.classList.contains('active')) {
                        overlay.remove();
                    }
                }, 300);
            }
        }
    }

    // Validate form
    validateForm(formData, rules) {
        const errors = {};
        
        Object.keys(rules).forEach(field => {
            const value = formData[field];
            const fieldRules = rules[field];
            
            if (fieldRules.required && !value) {
                errors[field] = fieldRules.requiredMessage || 'This field is required';
                return;
            }
            
            if (value) {
                if (fieldRules.minLength && value.length < fieldRules.minLength) {
                    errors[field] = fieldRules.minLengthMessage || `Minimum ${fieldRules.minLength} characters required`;
                } else if (fieldRules.maxLength && value.length > fieldRules.maxLength) {
                    errors[field] = fieldRules.maxLengthMessage || `Maximum ${fieldRules.maxLength} characters allowed`;
                } else if (fieldRules.pattern && !fieldRules.pattern.test(value)) {
                    errors[field] = fieldRules.patternMessage || 'Invalid format';
                } else if (fieldRules.validate && !fieldRules.validate(value)) {
                    errors[field] = fieldRules.validateMessage || 'Invalid value';
                }
            }
        });
        
        return {
            isValid: Object.keys(errors).length === 0,
            errors
        };
    }

    // Parse JSON safely
    safeParse(json, defaultValue = {}) {
        try {
            return JSON.parse(json);
        } catch (error) {
            return defaultValue;
        }
    }

    // Get device type
    getDeviceType() {
        const ua = navigator.userAgent;
        
        if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
            return 'mobile';
        } else if (/Tablet|iPad|PlayBook|Silk|(Android(?!.*Mobile))/.test(ua)) {
            return 'tablet';
        } else {
            return 'desktop';
        }
    }

    // Check if touch device
    isTouchDevice() {
        return ('ontouchstart' in window) ||
               (navigator.maxTouchPoints > 0) ||
               (navigator.msMaxTouchPoints > 0);
    }

    // Get current location (simplified)
    getCurrentLocation() {
        return new Promise((resolve, reject) => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        resolve({
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude
                        });
                    },
                    (error) => {
                        reject(error);
                    },
                    { timeout: 10000 }
                );
            } else {
                reject(new Error('Geolocation is not supported'));
            }
        });
    }

    // Calculate distance between coordinates (in km)
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in km
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    toRad(degrees) {
        return degrees * Math.PI / 180;
    }

    // Generate random number in range
    randomInRange(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // Shuffle array
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    // Group array by key
    groupBy(array, key) {
        return array.reduce((groups, item) => {
            const groupKey = item[key];
            if (!groups[groupKey]) {
                groups[groupKey] = [];
            }
            groups[groupKey].push(item);
            return groups;
        }, {});
    }

    // Sort array by key
    sortBy(array, key, order = 'asc') {
        return [...array].sort((a, b) => {
            const aValue = a[key];
            const bValue = b[key];
            
            if (aValue < bValue) return order === 'asc' ? -1 : 1;
            if (aValue > bValue) return order === 'asc' ? 1 : -1;
            return 0;
        });
    }

    // Create URL slug
    createSlug(text) {
        return text
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/--+/g, '-')
            .trim();
    }

    // Capitalize first letter
    capitalize(text) {
        return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    }

    // Format number with commas
    formatNumber(number) {
        return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    // Get file extension
    getFileExtension(filename) {
        return filename.split('.').pop().toLowerCase();
    }

    // Check if file is image
    isImageFile(filename) {
        const extensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
        const ext = this.getFileExtension(filename);
        return extensions.includes(ext);
    }

    // Create data URL from file
    createDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // Download file
    downloadFile(data, filename, type = 'text/plain') {
        const blob = new Blob([data], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Sleep/delay function
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Retry function
    async retry(fn, retries = 3, delay = 1000) {
        try {
            return await fn();
        } catch (error) {
            if (retries > 0) {
                await this.sleep(delay);
                return this.retry(fn, retries - 1, delay * 2);
            }
            throw error;
        }
    }

    // Batch process array
    async batchProcess(array, processor, batchSize = 10) {
        const results = [];
        for (let i = 0; i < array.length; i += batchSize) {
            const batch = array.slice(i, i + batchSize);
            const batchResults = await Promise.all(batch.map(item => processor(item)));
            results.push(...batchResults);
        }
        return results;
    }

    // Memoize function
    memoize(fn) {
        const cache = new Map();
        return (...args) => {
            const key = JSON.stringify(args);
            if (cache.has(key)) {
                return cache.get(key);
            }
            const result = fn(...args);
            cache.set(key, result);
            return result;
        };
    }

    // Create UUID
    createUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // Check if object is empty
    isEmpty(obj) {
        return Object.keys(obj).length === 0;
    }

    // Remove duplicates from array
    removeDuplicates(array, key = null) {
        if (key) {
            const seen = new Set();
            return array.filter(item => {
                const value = item[key];
                if (seen.has(value)) {
                    return false;
                }
                seen.add(value);
                return true;
            });
        } else {
            return [...new Set(array)];
        }
    }

    // Flatten nested array
    flatten(array) {
        return array.reduce((flat, item) => {
            return flat.concat(Array.isArray(item) ? this.flatten(item) : item);
        }, []);
    }

    // Chunk array
    chunk(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    // Pick properties from object
    pick(obj, keys) {
        return keys.reduce((result, key) => {
            if (obj.hasOwnProperty(key)) {
                result[key] = obj[key];
            }
            return result;
        }, {});
    }

    // Omit properties from object
    omit(obj, keys) {
        const result = { ...obj };
        keys.forEach(key => delete result[key]);
        return result;
    }

    // Deep equal comparison
    deepEqual(a, b) {
        if (a === b) return true;
        if (a == null || b == null) return false;
        if (a.constructor !== b.constructor) return false;

        if (Array.isArray(a)) {
            if (a.length !== b.length) return false;
            return a.every((item, index) => this.deepEqual(item, b[index]));
        }

        if (typeof a === 'object') {
            const aKeys = Object.keys(a);
            const bKeys = Object.keys(b);
            if (aKeys.length !== bKeys.length) return false;
            return aKeys.every(key => this.deepEqual(a[key], b[key]));
        }

        return false;
    }
}

// Create singleton instance
const utils = new Utils();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = utils;
}