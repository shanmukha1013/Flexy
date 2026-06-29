// router.js - Simple Client-side Routing

class Router {
    constructor() {
        this.routes = [];
        this.currentRoute = null;
        this.init();
    }

    init() {
        // Define routes
        this.defineRoutes();
        
        // Handle initial route
        this.handleRoute();
        
        // Listen for URL changes
        window.addEventListener('popstate', () => this.handleRoute());
        
        // Intercept link clicks
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href]');
            if (link && link.href.startsWith(window.location.origin)) {
                e.preventDefault();
                this.navigate(link.getAttribute('href'));
            }
        });
    }

    defineRoutes() {
        this.routes = [
            {
                path: '/',
                component: 'home.html',
                title: 'FLEXY - Home',
                auth: true
            },
            {
                path: '/home.html',
                component: 'home.html',
                title: 'FLEXY - Home',
                auth: true
            },
            {
                path: '/login.html',
                component: 'login.html',
                title: 'FLEXY - Login',
                auth: false
            },
            {
                path: '/profile.html',
                component: 'profile.html',
                title: 'FLEXY - Profile',
                auth: true
            },
            {
                path: '/search.html',
                component: 'search.html',
                title: 'FLEXY - Search',
                auth: true
            },
            {
                path: '/sell.html',
                component: 'sell.html',
                title: 'FLEXY - Sell Item',
                auth: true
            },
            {
                path: '/wallet.html',
                component: 'wallet.html',
                title: 'FLEXY - Wallet',
                auth: true
            }
        ];
    }

    handleRoute() {
        const path = window.location.pathname;
        const route = this.findRoute(path);
        
        if (route) {
            // Check authentication
            if (route.auth && !this.isAuthenticated()) {
                this.redirectToLogin();
                return;
            }
            
            // Update current route
            this.currentRoute = route;
            
            // Update page title
            document.title = route.title;
            
            // Load component (in a real SPA, this would fetch and render)
            // For our multi-page app, we just let the browser handle it
        } else {
            // 404 - Redirect to home
            this.navigate('/');
        }
    }

    findRoute(path) {
        return this.routes.find(route => route.path === path);
    }

    navigate(path, state = {}) {
        // Update URL
        window.history.pushState(state, '', path);
        
        // Handle the new route
        this.handleRoute();
    }

    redirect(path) {
        window.location.href = path;
    }

    isAuthenticated() {
        const user = localStorage.getItem('flexy_user');
        const token = localStorage.getItem('flexy_token');
        return !!(user && token);
    }

    redirectToLogin() {
        this.redirect('/login.html');
    }

    // Public API
    goTo(path) {
        this.navigate(path);
    }

    back() {
        window.history.back();
    }

    forward() {
        window.history.forward();
    }

    reload() {
        window.location.reload();
    }

    // Get current path
    getCurrentPath() {
        return window.location.pathname;
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

    // Update query parameters
    updateQueryParams(newParams) {
        const currentParams = this.getQueryParams();
        const updatedParams = { ...currentParams, ...newParams };
        
        // Remove undefined/null values
        Object.keys(updatedParams).forEach(key => {
            if (updatedParams[key] === undefined || updatedParams[key] === null) {
                delete updatedParams[key];
            }
        });
        
        // Build new query string
        const queryString = Object.entries(updatedParams)
            .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
            .join('&');
        
        const newUrl = window.location.pathname + (queryString ? '?' + queryString : '');
        window.history.pushState({}, '', newUrl);
    }

    // Remove query parameters
    removeQueryParams(keys) {
        const currentParams = this.getQueryParams();
        keys.forEach(key => delete currentParams[key]);
        
        const queryString = Object.entries(currentParams)
            .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
            .join('&');
        
        const newUrl = window.location.pathname + (queryString ? '?' + queryString : '');
        window.history.pushState({}, '', newUrl);
    }

    // Check if route exists
    routeExists(path) {
        return !!this.findRoute(path);
    }

    // Get route by path
    getRoute(path) {
        return this.findRoute(path);
    }

    // Add route dynamically
    addRoute(route) {
        this.routes.push(route);
    }

    // Remove route
    removeRoute(path) {
        this.routes = this.routes.filter(route => route.path !== path);
    }

    // Clear all routes
    clearRoutes() {
        this.routes = [];
    }

    // Get all routes
    getAllRoutes() {
        return [...this.routes];
    }

    // Check if current route requires auth
    currentRouteRequiresAuth() {
        return this.currentRoute?.auth || false;
    }

    // Get current route data
    getCurrentRoute() {
        return this.currentRoute;
    }

    // Show loading state
    showLoading(message = 'Loading...') {
        // Create loading overlay if it doesn't exist
        let overlay = document.getElementById('router-loading');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'router-loading';
            overlay.className = 'router-loading';
            document.body.appendChild(overlay);
        }
        
        overlay.innerHTML = `
            <div class="router-loading-content">
                <div class="router-loading-spinner"></div>
                <div class="router-loading-text">${message}</div>
            </div>
        `;
        
        overlay.classList.add('active');
    }

    // Hide loading state
    hideLoading() {
        const overlay = document.getElementById('router-loading');
        if (overlay) {
            overlay.classList.remove('active');
            setTimeout(() => {
                if (overlay && !overlay.classList.contains('active')) {
                    overlay.remove();
                }
            }, 300);
        }
    }

    // Error handling
    showError(message) {
        const error = document.createElement('div');
        error.className = 'router-error';
        error.innerHTML = `
            <div class="router-error-content">
                <div class="router-error-icon">❌</div>
                <div class="router-error-message">${message}</div>
                <button class="router-error-retry" onclick="router.reload()">Retry</button>
            </div>
        `;
        
        document.body.appendChild(error);
        
        setTimeout(() => {
            error.classList.add('show');
        }, 10);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            error.classList.remove('show');
            setTimeout(() => error.remove(), 300);
        }, 5000);
    }

    // Protected navigation (with auth check)
    protectedNavigate(path) {
        if (this.isAuthenticated()) {
            this.navigate(path);
        } else {
            this.redirectToLogin();
        }
    }

    // Navigation with state
    navigateWithState(path, state) {
        this.navigate(path, state);
    }

    // Get current state
    getCurrentState() {
        return window.history.state;
    }

    // Replace state
    replaceState(state, title, path) {
        window.history.replaceState(state, title, path);
    }

    // Listen for route changes
    onRouteChange(callback) {
        const originalPushState = window.history.pushState;
        const originalReplaceState = window.history.replaceState;
        
        // Override pushState
        window.history.pushState = function(state, title, url) {
            originalPushState.apply(this, arguments);
            callback(url, state);
        };
        
        // Override replaceState
        window.history.replaceState = function(state, title, url) {
            originalReplaceState.apply(this, arguments);
            callback(url, state);
        };
        
        // Listen for popstate
        window.addEventListener('popstate', (e) => {
            callback(window.location.pathname, e.state);
        });
        
        return () => {
            window.history.pushState = originalPushState;
            window.history.replaceState = originalReplaceState;
        };
    }
}

// Create singleton instance
const router = new Router();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = router;
}