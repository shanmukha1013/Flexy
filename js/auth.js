// auth.js - Real Email OTP Authentication with Resend API + JWT Sessions
// API key is NEVER in this file — it lives server-side in .env

class Auth {
    constructor() {
        this.currentUser = null;
        this.isLoggedIn = false;
        // API base: same origin (served by Express dev server or Vercel)
        const PRODUCTION_BACKEND_URL = 'https://forreal.onrender.com'; // Change this to your Render backend URL
        this.apiBase = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? `http://${window.location.hostname}:3001`
            : PRODUCTION_BACKEND_URL;
        this.init();
    }

    init() {
        this.loadUser();
        this.setupEventListeners();
        
        // If already logged in and on the login page, redirect
        if (this.isLoggedIn && window.location.pathname.includes('login.html')) {
            if (this.currentUser && !this.currentUser.isVerified) {
                window.location.href = 'profile-setup.html';
            } else {
                window.location.href = 'home.html';
            }
        }
    }

    setupEventListeners() {
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        const verifyOtpBtn = document.getElementById('verify-otp');
        if (verifyOtpBtn) {
            verifyOtpBtn.addEventListener('click', () => this.verifyOTP());
        }

        const resendOtpBtn = document.getElementById('resend-otp');
        if (resendOtpBtn) {
            resendOtpBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.resendOTP();
            });
        }

        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => this.closeAllModals());
        });

        this.setupOTPInputs();
    }

    setupOTPInputs() {
        const otpInputs = document.querySelectorAll('.otp-input');
        otpInputs.forEach((input, index) => {
            input.addEventListener('input', (e) => {
                // Only allow digits
                e.target.value = e.target.value.replace(/\D/g, '');

                if (e.target.value.length === 1 && index < otpInputs.length - 1) {
                    otpInputs[index + 1].focus();
                }

                if (index === otpInputs.length - 1 && e.target.value.length === 1) {
                    const allFilled = Array.from(otpInputs).every(inp => inp.value.length === 1);
                    if (allFilled) {
                        setTimeout(() => this.verifyOTP(), 300);
                    }
                }
            });

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !e.target.value && index > 0) {
                    otpInputs[index - 1].focus();
                }
            });

            // Handle paste
            input.addEventListener('paste', (e) => {
                e.preventDefault();
                const pasted = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
                if (pasted.length >= 6) {
                    otpInputs.forEach((inp, i) => {
                        inp.value = pasted[i] || '';
                    });
                    otpInputs[Math.min(pasted.length - 1, 5)].focus();
                    setTimeout(() => this.verifyOTP(), 300);
                }
            });
        });
    }

    async handleLogin() {
        const emailInput = document.getElementById('email');
        const email = emailInput ? emailInput.value.trim() : '';

        // Validation
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            this.showNotification('Please enter a valid email address', 'error');
            return;
        }

        // Show loading state
        const submitBtn = document.querySelector('#login-form .btn-primary');
        const originalHTML = submitBtn ? submitBtn.innerHTML : '';
        if (submitBtn) {
            submitBtn.innerHTML = '<div class="loading-spinner"></div> Sending OTP...';
            submitBtn.disabled = true;
        }

        try {
            // Real API call for email OTP via Resend
            await this.sendEmailOTP(email);
            this.showNotification('✅ Verification code sent to your email!', 'success');
            this.showOTPModal(email);
        } catch (error) {
            console.error('Login error:', error);
            this.showNotification(error.message || 'Failed to send OTP. Please try again.', 'error');
        } finally {
            if (submitBtn) {
                submitBtn.innerHTML = originalHTML;
                submitBtn.disabled = false;
            }
        }
    }

    async sendEmailOTP(email) {
        const response = await fetch(`${this.apiBase}/api/auth/request-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to send OTP email');
        }

        return data;
    }

    showOTPModal(identifier) {
        sessionStorage.setItem('temp_identifier', identifier);

        const otpMsg = document.getElementById('otp-message');
        if (otpMsg) {
            const maskedId = identifier.replace(/(.{2}).+(@.+)/, '$1***$2');
            otpMsg.innerHTML = `Enter the 6-digit code sent to <strong style="color: var(--primary)">${maskedId}</strong>`;
        }

        // Reset countdown timer (5 minutes)
        this.startOTPCountdown();

        document.getElementById('otp-modal').classList.add('active');
        
        // Reset all input values
        document.querySelectorAll('.otp-input').forEach(inp => inp.value = '');
        
        setTimeout(() => {
            const firstInput = document.querySelector('.otp-input');
            if (firstInput) firstInput.focus();
        }, 100);
    }

    startOTPCountdown() {
        const resendBtn = document.getElementById('resend-otp');
        const countdownEl = document.getElementById('otp-countdown');
        if (!resendBtn || !countdownEl) return;

        let seconds = 300; // 5 minutes
        resendBtn.style.pointerEvents = 'none';
        resendBtn.style.opacity = '0.4';

        if (this._countdownInterval) clearInterval(this._countdownInterval);

        const updateTimerDisplay = () => {
            const m = Math.floor(seconds / 60);
            const s = seconds % 60;
            const sStr = s < 10 ? '0' + s : s;
            countdownEl.textContent = ` (${m}:${sStr})`;
        };

        updateTimerDisplay();

        const interval = setInterval(() => {
            seconds--;
            updateTimerDisplay();
            if (seconds <= 0) {
                clearInterval(interval);
                resendBtn.style.pointerEvents = 'auto';
                resendBtn.style.opacity = '1';
                countdownEl.textContent = '';
            }
        }, 1000);

        this._countdownInterval = interval;
    }

    async verifyOTP() {
        const otpInputs = document.querySelectorAll('.otp-input');
        const enteredOTP = Array.from(otpInputs).map(inp => inp.value).join('');

        if (enteredOTP.length !== 6 || !/^\d{6}$/.test(enteredOTP)) {
            this.showNotification('Please enter the complete 6-digit code', 'error');
            return;
        }

        const verifyBtn = document.getElementById('verify-otp');
        const originalHTML = verifyBtn ? verifyBtn.innerHTML : '';
        if (verifyBtn) {
            verifyBtn.innerHTML = '<div class="loading-spinner"></div> Verifying...';
            verifyBtn.disabled = true;
        }

        try {
            const email = sessionStorage.getItem('temp_identifier');
            await this.verifyEmailOTP(enteredOTP, email);
        } catch (error) {
            console.error('Verify error:', error);
            this.showNotification(error.message || 'Verification failed. Please try again.', 'error');
            
            // Shake animation on error
            const otpContainer = document.querySelector('.otp-container');
            if (otpContainer) {
                otpContainer.style.animation = 'shake 0.5s ease';
                setTimeout(() => otpContainer.style.animation = '', 500);
            }
            // Clear inputs
            otpInputs.forEach(inp => inp.value = '');
            if (otpInputs[0]) otpInputs[0].focus();
        } finally {
            if (verifyBtn) {
                verifyBtn.innerHTML = originalHTML;
                verifyBtn.disabled = false;
            }
        }
    }

    async verifyEmailOTP(otp, email) {
        const response = await fetch(`${this.apiBase}/api/auth/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code: otp })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Verification failed');
        }

        // Real JWT session + user profile from server
        this.completeLogin(data.token, data.user, data.isNewUser);
    }

    completeLogin(token, user, isNewUser) {
        this.currentUser = user;
        this.isLoggedIn = true;

        localStorage.setItem('flexy_user', JSON.stringify(user));
        localStorage.setItem('flexy_token', token);

        // Clear temp session data
        sessionStorage.removeItem('temp_identifier');
        if (this._countdownInterval) clearInterval(this._countdownInterval);

        this.closeAllModals();
        this.showNotification(`🎉 Verification Successful!`, 'success');

        setTimeout(() => {
            if (isNewUser) {
                window.location.href = 'profile-setup.html';
            } else {
                window.location.href = 'home.html';
            }
        }, 1200);
    }

    async resendOTP() {
        const email = sessionStorage.getItem('temp_identifier') || '';
        if (!email) return;

        document.querySelectorAll('.otp-input').forEach(inp => inp.value = '');
        const firstInput = document.querySelector('.otp-input');
        if (firstInput) firstInput.focus();

        try {
            await this.sendEmailOTP(email);
            this.showNotification('✅ New code sent to your email!', 'success');
            this.startOTPCountdown();
        } catch (error) {
            this.showNotification(error.message || 'Failed to resend OTP', 'error');
        }
    }

    async logout() {
        try {
            await fetch(`${this.apiBase}/api/auth/logout`, { method: 'POST' });
        } catch (e) {
            console.error('Logout error:', e);
        }
        this.currentUser = null;
        this.isLoggedIn = false;
        localStorage.removeItem('flexy_user');
        localStorage.removeItem('flexy_token');
        this.showNotification('Logged out successfully', 'success');
        setTimeout(() => { window.location.href = 'login.html'; }, 1000);
    }

    loadUser() {
        const userData = localStorage.getItem('flexy_user');
        const token = localStorage.getItem('flexy_token');
        if (userData && token) {
            try {
                this.currentUser = JSON.parse(userData);
                this.isLoggedIn = true;
            } catch (e) {
                localStorage.removeItem('flexy_user');
                localStorage.removeItem('flexy_token');
            }
        }
    }

    getUser() { return this.currentUser; }
    isAuthenticated() { return this.isLoggedIn; }

    showNotification(message, type = 'info') {
        if (typeof notify === 'function') notify(message, type);
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => modal.classList.remove('active'));
    }

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

// Global functions
function logout() { auth.logout(); }

if (typeof module !== 'undefined' && module.exports) {
    module.exports = auth;
}