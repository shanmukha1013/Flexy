// auth.js - Authentication and User Management

class Auth {
    constructor() {
        this.currentUser = null;
        this.isLoggedIn = false;
        this.init();
    }

    init() {
        // Load user from localStorage
        this.loadUser();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Login form submission
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        // OTP verification
        const verifyOtpBtn = document.getElementById('verify-otp');
        if (verifyOtpBtn) {
            verifyOtpBtn.addEventListener('click', () => this.verifyOTP());
        }

        // Resend OTP
        const resendOtpBtn = document.getElementById('resend-otp');
        if (resendOtpBtn) {
            resendOtpBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.resendOTP();
            });
        }

        // Modal close buttons
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                this.closeAllModals();
            });
        });

        // OTP input auto-focus
        this.setupOTPInputs();
    }

    setupOTPInputs() {
        const otpInputs = document.querySelectorAll('.otp-input');
        otpInputs.forEach((input, index) => {
            input.addEventListener('input', (e) => {
                // Auto-focus next input
                if (e.target.value.length === 1 && index < otpInputs.length - 1) {
                    otpInputs[index + 1].focus();
                }
                
                // Auto-submit if all fields filled
                if (index === otpInputs.length - 1 && e.target.value.length === 1) {
                    const allFilled = Array.from(otpInputs).every(inp => inp.value.length === 1);
                    if (allFilled) {
                        setTimeout(() => this.verifyOTP(), 300);
                    }
                }
            });

            input.addEventListener('keydown', (e) => {
                // Move to previous input on backspace
                if (e.key === 'Backspace' && !e.target.value && index > 0) {
                    otpInputs[index - 1].focus();
                }
            });
        });
    }

    handleLogin() {
        const phone = document.getElementById('phone').value;
        const name = document.getElementById('name').value;

        if (!phone || !name) {
            this.showNotification('Please enter phone number and name', 'error');
            return;
        }

        if (phone.length !== 10 || !/^\d+$/.test(phone)) {
            this.showNotification('Please enter a valid 10-digit phone number', 'error');
            return;
        }

        // Show loading state
        const submitBtn = document.querySelector('#login-form .btn-primary');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<div class="loading-spinner"></div>';
        submitBtn.disabled = true;

        // Simulate API call
        setTimeout(() => {
            // Restore button
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;

            // Show OTP modal
            this.showOTPModal(phone, name);
            this.showNotification('OTP sent to your phone', 'success');
        }, 1500);
    }

    showOTPModal(phone, name) {
        // Store temporary user data
        sessionStorage.setItem('temp_phone', phone);
        sessionStorage.setItem('temp_name', name);
        sessionStorage.setItem('temp_otp', '123456'); // Mock OTP for demo

        // Show modal
        document.getElementById('otp-modal').classList.add('active');
        
        // Set focus to first OTP input
        setTimeout(() => {
            document.querySelector('.otp-input').focus();
        }, 100);
    }

    verifyOTP() {
        const otpInputs = document.querySelectorAll('.otp-input');
        const enteredOTP = Array.from(otpInputs).map(input => input.value).join('');
        const expectedOTP = sessionStorage.getItem('temp_otp');

        if (enteredOTP.length !== 6) {
            this.showNotification('Please enter complete 6-digit OTP', 'error');
            return;
        }

        if (enteredOTP !== expectedOTP) {
            this.showNotification('Invalid OTP. Please try again', 'error');
            
            // Clear inputs and focus first
            otpInputs.forEach(input => input.value = '');
            otpInputs[0].focus();
            return;
        }

        // Login successful
        const phone = sessionStorage.getItem('temp_phone');
        const name = sessionStorage.getItem('temp_name');
        
        this.loginUser(phone, name);
        
        // Close modal
        this.closeAllModals();
        
        // Clear temporary data
        sessionStorage.removeItem('temp_phone');
        sessionStorage.removeItem('temp_name');
        sessionStorage.removeItem('temp_otp');
    }

    resendOTP() {
        // Mock resend OTP
        sessionStorage.setItem('temp_otp', '123456');
        
        // Clear OTP inputs
        document.querySelectorAll('.otp-input').forEach(input => input.value = '');
        document.querySelector('.otp-input').focus();
        
        this.showNotification('OTP resent to your phone', 'success');
    }

    loginUser(phone, name) {
        // Generate user ID
        const userId = 'user_' + Date.now();
        
        // Create user object
        this.currentUser = {
            id: userId,
            phone: phone,
            name: name,
            balance: 10000, // Starting balance
            avatar: name.charAt(0).toUpperCase(),
            createdAt: new Date().toISOString(),
            stats: {
                itemsListed: 0,
                itemsSold: 0,
                totalBids: 0,
                rating: 0.0
            }
        };

        // Save to localStorage
        localStorage.setItem('flexy_user', JSON.stringify(this.currentUser));
        localStorage.setItem('flexy_token', 'token_' + userId);
        
        this.isLoggedIn = true;
        this.showNotification(`Welcome ${name}!`, 'success');
        
        // Redirect to home page
        setTimeout(() => {
            window.location.href = 'home.html';
        }, 1000);
    }

    logout() {
        this.currentUser = null;
        this.isLoggedIn = false;
        
        localStorage.removeItem('flexy_user');
        localStorage.removeItem('flexy_token');
        
        this.showNotification('Logged out successfully', 'success');
        
        // Redirect to login
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1000);
    }

    loadUser() {
        const userData = localStorage.getItem('flexy_user');
        const token = localStorage.getItem('flexy_token');
        
        if (userData && token) {
            this.currentUser = JSON.parse(userData);
            this.isLoggedIn = true;
            
            // Update user stats from database
            this.updateUserStats();
        }
    }

    updateUserStats() {
        // Load user stats from localStorage
        const userStats = JSON.parse(localStorage.getItem('flexy_user_stats_' + this.currentUser.id)) || {
            itemsListed: 0,
            itemsSold: 0,
            totalBids: 0,
            rating: 0.0
        };
        
        if (this.currentUser) {
            this.currentUser.stats = userStats;
            localStorage.setItem('flexy_user', JSON.stringify(this.currentUser));
        }
    }

    getUser() {
        return this.currentUser;
    }

    isAuthenticated() {
        return this.isLoggedIn;
    }

    showNotification(message, type = 'info') {
        // Use global notify helper
        notify(message, type);
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
        });
    }

    // Check authentication on page load
    checkAuth() {
        if (!this.isAuthenticated() && 
            !window.location.href.includes('login.html') &&
            !window.location.href.includes('index.html')) {
            window.location.href = 'login.html';
        }
    }
}

// Initialize auth
const auth = new Auth();

// Global functions for HTML onclick handlers
function logout() {
    auth.logout();
}

function sendOTP() {
    // This function is called from login.html
    const phone = document.getElementById('phone').value;
    const name = document.getElementById('name').value;
    
    if (!phone || !name) {
        auth.showNotification('Please enter phone number and name', 'error');
        return;
    }
    
    if (phone.length !== 10) {
        auth.showNotification('Please enter a valid 10-digit phone number', 'error');
        return;
    }
    
    auth.showOTPModal(phone, name);
    auth.showNotification('OTP sent to your phone', 'success');
}

// Export for other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = auth;
}