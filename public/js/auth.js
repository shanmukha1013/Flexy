// auth.js - Email OTP sign-in (login.html) plus session helpers used by other pages.
// The Resend API key lives server-side; this file only talks to the Flexy API.

const EMAIL_PATTERN = /^[^\s@<>"'()]+@[^\s@<>"'()]+\.[^\s@<>"'()]+$/;
// sessionStorage record of the code currently awaiting entry, so a page refresh
// returns the user to the code screen with accurate timers.
const PENDING_OTP_KEY = 'flexy_pending_otp';

// Access tokens are JWTs. Anything else in storage (for example the fake
// "token_user_..." values written by the retired demo login) is not a session.
function decodeTokenPayload(token) {
    if (typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    try {
        return JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    } catch (e) {
        return null;
    }
}

function formatSeconds(total) {
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s < 10 ? '0' + s : s}`;
}

class Auth {
    constructor() {
        this.currentUser = null;
        this.isLoggedIn = false;
        this.isSending = false;
        this.isVerifying = false;
        this.pending = null;
        // Codes sent during this visit, by email, so re-entering an address
        // whose code is still valid goes back to the code screen.
        this.recentSends = {};
        this._timer = null;
        // API base: the Express server locally, the Render backend in production
        const PRODUCTION_BACKEND_URL = 'https://flexy-backend-pgw7.onrender.com';
        this.apiBase = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? `http://${window.location.hostname}:3001`
            : PRODUCTION_BACKEND_URL;
        this.init();
    }

    init() {
        this.loadUser();
        if (!document.getElementById('login-form')) return;

        this.setupEventListeners();
        this.restoreSession();
    }

    // ---------- Session state ----------

    loadUser() {
        const userData = localStorage.getItem('flexy_user');
        const token = localStorage.getItem('flexy_token');
        if (!userData && !token) return;

        if (!decodeTokenPayload(token)) {
            this.clearSession();
            return;
        }
        try {
            this.currentUser = JSON.parse(userData);
            this.isLoggedIn = Boolean(this.currentUser);
        } catch (e) {
            this.clearSession();
        }
    }

    clearSession() {
        this.currentUser = null;
        this.isLoggedIn = false;
        localStorage.removeItem('flexy_user');
        localStorage.removeItem('flexy_token');
    }

    // On the login page: only skip ahead if the stored session is genuinely
    // usable, so a stale token never bounces the user between pages.
    async restoreSession() {
        const token = localStorage.getItem('flexy_token');
        const payload = decodeTokenPayload(token);

        if (payload && this.currentUser && payload.exp * 1000 > Date.now() + 5000) {
            this.redirectAfterLogin(!this.currentUser.isVerified);
            return;
        }

        if (payload) {
            // The access token expired; the HttpOnly refresh cookie may still be valid.
            try {
                const res = await fetch(`${this.apiBase}/api/auth/refresh`, { method: 'POST', credentials: 'include' });
                if (res.ok) {
                    const data = await res.json();
                    this.storeSession(data.token, data.user);
                    this.redirectAfterLogin(!data.user.isVerified);
                    return;
                }
            } catch (e) { /* offline: fall through to the sign-in form */ }
            this.clearSession();
        }

        this.restorePendingOtp();
    }

    storeSession(token, user) {
        this.currentUser = user;
        this.isLoggedIn = true;
        localStorage.setItem('flexy_user', JSON.stringify(user));
        localStorage.setItem('flexy_token', token);
    }

    redirectAfterLogin(needsProfileSetup) {
        window.location.replace(needsProfileSetup ? 'profile-setup.html' : 'home.html');
    }

    // ---------- API ----------

    async post(path, body, { withCredentials = false } = {}) {
        let res;
        try {
            res = await fetch(`${this.apiBase}${path}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // Needed for the API to set/clear the HttpOnly refresh cookie,
                // which lives on a different origin in production.
                credentials: withCredentials ? 'include' : 'same-origin',
                body: JSON.stringify(body)
            });
        } catch (e) {
            const err = new Error("Can't reach Flexy right now. Check your connection and try again.");
            err.network = true;
            throw err;
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const err = new Error(data.error || (res.status >= 500
                ? 'Flexy is having trouble right now. Please try again shortly.'
                : 'Something went wrong. Please try again.'));
            err.status = res.status;
            err.reason = data.reason;
            err.retryAfter = Number(data.retryAfter) || null;
            throw err;
        }
        return data;
    }

    // ---------- Event wiring ----------

    setupEventListeners() {
        const loginForm = document.getElementById('login-form');
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        const emailInput = document.getElementById('email');
        if (emailInput) emailInput.addEventListener('input', () => this.setFormError(''));

        const verifyOtpBtn = document.getElementById('verify-otp');
        if (verifyOtpBtn) verifyOtpBtn.addEventListener('click', () => this.verifyOTP());

        const resendOtpBtn = document.getElementById('resend-otp');
        if (resendOtpBtn) {
            resendOtpBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.resendOTP();
            });
        }

        const changeEmail = document.getElementById('change-email');
        if (changeEmail) {
            changeEmail.addEventListener('click', (e) => {
                e.preventDefault();
                this.changeEmail();
            });
        }

        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => this.closeOTPModal());
        });

        this.setupOTPInputs();
    }

    setupOTPInputs() {
        const otpInputs = document.querySelectorAll('.otp-input');
        otpInputs.forEach((input, index) => {
            input.addEventListener('input', (e) => {
                // Only allow digits
                e.target.value = e.target.value.replace(/\D/g, '').slice(-1);
                this.setOtpStatus('');

                if (e.target.value.length === 1 && index < otpInputs.length - 1) {
                    otpInputs[index + 1].focus();
                }

                const allFilled = Array.from(otpInputs).every(inp => inp.value.length === 1);
                if (allFilled) setTimeout(() => this.verifyOTP(), 150);
            });

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !e.target.value && index > 0) {
                    otpInputs[index - 1].focus();
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    this.verifyOTP();
                }
            });

            // Handle paste (and SMS/email autofill that pastes the whole code)
            input.addEventListener('paste', (e) => {
                e.preventDefault();
                const pasted = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
                if (!pasted) return;
                otpInputs.forEach((inp, i) => {
                    inp.value = pasted[i] || '';
                });
                otpInputs[Math.min(pasted.length, otpInputs.length) - 1].focus();
                if (pasted.length >= otpInputs.length) setTimeout(() => this.verifyOTP(), 150);
            });
        });
    }

    // ---------- Step 1: request a code ----------

    async handleLogin() {
        if (this.isSending) return;

        const emailInput = document.getElementById('email');
        const email = emailInput ? emailInput.value.trim().toLowerCase() : '';

        if (!email || !EMAIL_PATTERN.test(email)) {
            this.setFormError('Please enter a valid email address, like name@example.com.');
            if (emailInput) emailInput.focus();
            return;
        }
        this.setFormError('');

        const submitBtn = document.querySelector('#login-form .btn-primary');
        const originalHTML = submitBtn ? submitBtn.innerHTML : '';
        this.isSending = true;
        if (submitBtn) {
            submitBtn.innerHTML = '<div class="loading-spinner"></div> Sending code...';
            submitBtn.disabled = true;
        }

        try {
            // The server answers 200 only after the email provider accepted the message.
            const data = await this.post('/api/auth/request-otp', { email });
            this.startPendingOtp(email, data);
            this.showNotification('Verification code sent. Check your inbox.', 'success');
            this.showOTPModal();
        } catch (error) {
            const recent = (this.pending && this.pending.email === email) ? this.pending : this.recentSends[email];
            if (error.status === 429 && recent && recent.expiresAt > Date.now()) {
                // A code for this address went out moments ago and still works.
                this.pending = { ...recent, resendAt: Date.now() + (error.retryAfter || 60) * 1000 };
                this.savePending();
                this.showOTPModal();
                this.setOtpStatus('We already sent a code to this address. Enter it below, or request a new one when the timer ends.', 'info');
            } else {
                const message = error.status === 429 && error.retryAfter
                    ? `${error.message} Try again in ${formatSeconds(error.retryAfter)}.`
                    : error.message;
                this.setFormError(message);
                this.showNotification(message, 'error');
            }
        } finally {
            this.isSending = false;
            if (submitBtn) {
                submitBtn.innerHTML = originalHTML;
                submitBtn.disabled = false;
            }
        }
    }

    startPendingOtp(email, data) {
        const now = Date.now();
        this.pending = {
            email,
            expiresAt: now + (Number(data.expiresInSeconds) || 300) * 1000,
            resendAt: now + (Number(data.resendAvailableInSeconds) || 60) * 1000
        };
        this.recentSends[email] = this.pending;
        this.savePending();
    }

    savePending() {
        if (this.pending) sessionStorage.setItem(PENDING_OTP_KEY, JSON.stringify(this.pending));
        else sessionStorage.removeItem(PENDING_OTP_KEY);
    }

    restorePendingOtp() {
        let saved = null;
        try {
            saved = JSON.parse(sessionStorage.getItem(PENDING_OTP_KEY) || 'null');
        } catch (e) { /* ignore corrupt state */ }

        if (!saved || !saved.email || !(saved.expiresAt > Date.now())) {
            this.pending = null;
            this.savePending();
            return;
        }
        this.pending = saved;
        const emailInput = document.getElementById('email');
        if (emailInput) emailInput.value = saved.email;
        this.showOTPModal();
    }

    // ---------- Step 2: enter the code ----------

    showOTPModal() {
        const otpMsg = document.getElementById('otp-message');
        if (otpMsg && this.pending) {
            const masked = this.pending.email.replace(/(.{2}).+(@.+)/, '$1***$2');
            const strong = document.createElement('strong');
            strong.style.color = 'var(--primary)';
            strong.textContent = masked;
            otpMsg.replaceChildren('Enter the 6-digit code sent to ', strong);
        }

        this.setOtpStatus('');
        this.clearOtpInputs();
        document.getElementById('otp-modal').classList.add('active');
        this.startTimers();

        setTimeout(() => {
            const firstInput = document.querySelector('.otp-input');
            if (firstInput) firstInput.focus();
        }, 100);
    }

    closeOTPModal() {
        this.stopTimers();
        document.querySelectorAll('.modal').forEach(modal => modal.classList.remove('active'));
    }

    changeEmail() {
        this.pending = null;
        this.savePending();
        this.closeOTPModal();
        const emailInput = document.getElementById('email');
        if (emailInput) {
            emailInput.focus();
            emailInput.select();
        }
    }

    startTimers() {
        this.stopTimers();
        this.tick();
        this._timer = setInterval(() => this.tick(), 1000);
    }

    stopTimers() {
        if (this._timer) clearInterval(this._timer);
        this._timer = null;
    }

    // Keeps the expiry notice and the resend button in step with the server's rules.
    tick() {
        if (!this.pending) return;
        const now = Date.now();
        const expiresIn = Math.max(0, Math.ceil((this.pending.expiresAt - now) / 1000));
        const resendIn = expiresIn === 0 ? 0 : Math.max(0, Math.ceil((this.pending.resendAt - now) / 1000));

        const expiryEl = document.getElementById('otp-expiry');
        if (expiryEl) {
            expiryEl.textContent = expiresIn > 0
                ? `Code expires in ${formatSeconds(expiresIn)}`
                : 'This code has expired. Request a new one.';
        }

        const resendBtn = document.getElementById('resend-otp');
        const countdownEl = document.getElementById('otp-countdown');
        const locked = resendIn > 0 || this.isSending;
        if (resendBtn) resendBtn.setAttribute('aria-disabled', locked ? 'true' : 'false');
        if (countdownEl) countdownEl.textContent = resendIn > 0 ? ` (${formatSeconds(resendIn)})` : '';
    }

    async verifyOTP() {
        if (this.isVerifying) return;

        const otpInputs = document.querySelectorAll('.otp-input');
        const code = Array.from(otpInputs).map(inp => inp.value).join('');

        if (!/^\d{6}$/.test(code)) {
            this.setOtpStatus('Enter all 6 digits of the code.', 'error');
            return;
        }
        if (!this.pending) {
            this.setOtpStatus('Your sign-in session ended. Use a different email to start again.', 'error');
            return;
        }
        if (this.pending.expiresAt <= Date.now()) {
            this.setOtpStatus('This code has expired. Request a new one.', 'error');
            return;
        }

        const verifyBtn = document.getElementById('verify-otp');
        const originalHTML = verifyBtn ? verifyBtn.innerHTML : '';
        this.isVerifying = true;
        otpInputs.forEach(inp => { inp.disabled = true; });
        if (verifyBtn) {
            verifyBtn.innerHTML = '<div class="loading-spinner"></div> Verifying...';
            verifyBtn.disabled = true;
        }

        try {
            const data = await this.post('/api/auth/verify-otp', { email: this.pending.email, code }, { withCredentials: true });
            this.completeLogin(data.token, data.user, data.isNewUser);
        } catch (error) {
            this.setOtpStatus(error.message, 'error');
            if (error.reason === 'expired' || error.reason === 'too_many_attempts' || error.reason === 'invalid_code') {
                // This code can no longer succeed: let the user request a new one now.
                this.pending.resendAt = 0;
                if (error.reason === 'expired') this.pending.expiresAt = Date.now();
                this.savePending();
                this.tick();
            }

            // Shake animation on error
            const otpContainer = document.querySelector('.otp-container');
            if (otpContainer) {
                otpContainer.style.animation = 'shake 0.5s ease';
                setTimeout(() => otpContainer.style.animation = '', 500);
            }
            otpInputs.forEach(inp => { inp.disabled = false; });
            this.clearOtpInputs();
            if (otpInputs[0]) otpInputs[0].focus();
        } finally {
            this.isVerifying = false;
            if (verifyBtn) {
                verifyBtn.innerHTML = originalHTML;
                verifyBtn.disabled = false;
            }
        }
    }

    completeLogin(token, user, isNewUser) {
        this.storeSession(token, user);
        this.recentSends = {};
        this.pending = null;
        this.savePending();
        this.closeOTPModal();
        this.showNotification('Verification successful!', 'success');
        setTimeout(() => this.redirectAfterLogin(isNewUser), 800);
    }

    async resendOTP() {
        if (this.isSending || !this.pending) return;
        if (Date.now() < this.pending.resendAt && this.pending.expiresAt > Date.now()) return;

        this.isSending = true;
        this.tick();
        this.setOtpStatus('Sending a new code...', 'info');
        try {
            const data = await this.post('/api/auth/request-otp', { email: this.pending.email });
            this.startPendingOtp(this.pending.email, data);
            this.clearOtpInputs();
            this.setOtpStatus('A new code is on its way. Earlier codes no longer work.', 'success');
            const firstInput = document.querySelector('.otp-input');
            if (firstInput) firstInput.focus();
        } catch (error) {
            if (error.retryAfter) {
                this.pending.resendAt = Date.now() + error.retryAfter * 1000;
                this.savePending();
            }
            this.setOtpStatus(error.message, 'error');
        } finally {
            this.isSending = false;
            this.tick();
        }
    }

    clearOtpInputs() {
        document.querySelectorAll('.otp-input').forEach(inp => {
            inp.value = '';
            inp.disabled = false;
        });
    }

    setOtpStatus(message, type = 'info') {
        const el = document.getElementById('otp-status');
        if (!el) return;
        el.textContent = message;
        el.className = `otp-status${message ? ' is-' + type : ''}`;
    }

    setFormError(message) {
        const el = document.getElementById('email-error');
        if (el) el.textContent = message;
    }

    // ---------- Shared helpers ----------

    async logout() {
        try {
            // Revokes the refresh token server-side and clears the cookie.
            await fetch(`${this.apiBase}/api/auth/logout`, { method: 'POST', credentials: 'include' });
        } catch (e) {
            console.error('Logout error:', e);
        }
        this.clearSession();
        sessionStorage.removeItem(PENDING_OTP_KEY);
        this.showNotification('Logged out successfully', 'success');
        setTimeout(() => { window.location.href = 'login.html'; }, 600);
    }

    getUser() { return this.currentUser; }
    isAuthenticated() { return this.isLoggedIn; }

    showNotification(message, type = 'info') {
        if (typeof notify === 'function') notify(message, type);
    }

    closeAllModals() {
        this.closeOTPModal();
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
