// auth.js - Log-in, sign-up and password pages, plus the session helpers they
// share with the profile setup and settings pages (window.FlexyAuth).
//
// Sessions: the API returns a short-lived access token (kept in localStorage
// and sent as a Bearer header) and sets a 30-day HttpOnly refresh cookie that
// scripts cannot read. Passwords are only ever sent to the API; nothing about
// them is stored in the browser.

(function () {
    'use strict';

    const PRODUCTION_BACKEND_URL = 'https://flexy-backend-pgw7.onrender.com';
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API = `${isLocal ? `http://${window.location.hostname}:3001` : PRODUCTION_BACKEND_URL}/api`;
    const TOKEN_KEY = 'flexy_token';
    const USER_KEY = 'flexy_user';

    const SERVER_TROUBLE = 'Flexy is having trouble right now. Please try again shortly.';
    const FIX_FIELDS = 'Please fix the highlighted fields.';

    // The server's rules (lib/validation.js, lib/passwords.js), repeated here
    // for instant feedback. The server checks everything again.
    const EMAIL_RE = /^[^\s@<>"'()]+@[^\s@<>"'()]+\.[^\s@<>"'()]+$/;
    const USERNAME_RE = /^(?!\.)(?!.*\.\.)(?!.*\.$)[a-z0-9._]{3,30}$/;
    const PASSWORD_MIN = 8;
    const PASSWORD_MAX = 128;

    // ---------- Session ----------

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

    const session = {
        token() {
            return localStorage.getItem(TOKEN_KEY);
        },
        user() {
            try {
                return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
            } catch (e) {
                return null;
            }
        },
        store(token, user) {
            localStorage.setItem(TOKEN_KEY, token);
            localStorage.setItem(USER_KEY, JSON.stringify(user));
            // api.js keeps its own copy of the token when it is on the page.
            if (typeof api !== 'undefined' && api) api.token = token;
        },
        clear() {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
        },
        // A stored access token that is a real JWT and still valid for a few seconds.
        hasFreshToken() {
            const payload = decodeTokenPayload(session.token());
            return Boolean(payload && payload.exp * 1000 > Date.now() + 5000);
        },
        // Where a signed-in user belongs. The server enforces the same rule.
        destinationFor(user) {
            return user && user.profileCompleted ? 'home.html' : 'profile-setup.html';
        }
    };

    // Resolves to { ok, status, data } for any HTTP answer and rejects only
    // when the server cannot be reached.
    async function callApi(method, path, body, { token, withCookies = false } = {}) {
        const headers = {};
        if (body !== undefined) headers['Content-Type'] = 'application/json';
        if (token) headers.Authorization = `Bearer ${token}`;
        let res;
        try {
            res = await fetch(`${API}${path}`, {
                method,
                headers,
                // Lets the API set and read the refresh cookie, which lives on
                // the API's own (cross-site) origin in production.
                credentials: withCookies ? 'include' : 'same-origin',
                body: body === undefined ? undefined : JSON.stringify(body)
            });
        } catch (e) {
            const err = new Error("Can't reach Flexy right now. Check your connection and try again.");
            err.network = true;
            throw err;
        }
        const data = await res.json().catch(() => ({}));
        return { ok: res.ok, status: res.status, data };
    }

    // Swaps the refresh cookie for a new access token. Returns the API's
    // { token, user } or null when there is no usable session.
    async function refreshSession() {
        try {
            const { ok, data } = await callApi('POST', '/auth/refresh', undefined, { withCookies: true });
            if (ok && data.token) {
                session.store(data.token, data.user);
                return data;
            }
        } catch (e) { /* offline: treated as signed out */ }
        return null;
    }

    // A signed-in API call that renews an expired access token once.
    async function authorized(method, path, body, { withCookies = false } = {}) {
        let token = session.token();
        if (!session.hasFreshToken()) {
            const renewed = await refreshSession();
            token = renewed ? renewed.token : null;
        }
        if (!token) return { ok: false, status: 401, data: { error: 'Please log in again.' } };

        let result = await callApi(method, path, body, { token, withCookies });
        if (result.status === 401) {
            const renewed = await refreshSession();
            if (renewed) result = await callApi(method, path, body, { token: renewed.token, withCookies });
        }
        return result;
    }

    // Signs out every device: the server revokes all refresh tokens.
    async function logout() {
        try {
            await callApi('POST', '/auth/logout', undefined, { withCookies: true });
        } catch (e) { /* offline: still clear the local session */ }
        session.clear();
        window.location.replace('login.html');
    }

    // On the log-in and sign-up pages: skip ahead only if the stored session
    // genuinely works, so a stale token never bounces between pages.
    async function resumeExistingSession() {
        const user = session.user();
        if (session.hasFreshToken() && user && typeof user.profileCompleted === 'boolean') {
            window.location.replace(session.destinationFor(user));
            return;
        }
        if (!session.token()) return;
        // The access token expired; the refresh cookie may still be valid.
        const renewed = await refreshSession();
        if (renewed) window.location.replace(session.destinationFor(renewed.user));
        else session.clear();
    }

    // ---------- Validation ----------

    function normalizeUsername(value) {
        const name = String(value || '').trim();
        return (name.startsWith('@') ? name.slice(1) : name).toLowerCase();
    }

    function normalizePhone(value) {
        const phone = String(value || '').trim();
        if (!/^\+?[\d\s().-]+$/.test(phone)) return null;
        const digits = phone.replace(/\D/g, '');
        return digits.length >= 7 && digits.length <= 15 ? (phone.startsWith('+') ? '+' : '') + digits : null;
    }

    function passwordProblem(password, { username, email } = {}) {
        if (!password) return 'Enter a password';
        if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters`;
        if (password.length > PASSWORD_MAX) return `Use at most ${PASSWORD_MAX} characters`;
        if (!/\p{L}/u.test(password) || !/\p{N}/u.test(password)) return 'Include at least one letter and one number';
        const lower = password.toLowerCase();
        const personal = [username, email, email ? email.split('@')[0] : ''].filter(v => v && v.length >= 3);
        if (personal.includes(lower)) return 'Your password must not be your username or email';
        return '';
    }

    const checks = {
        fullName(value) {
            const name = value.replace(/\s+/g, ' ').trim();
            if (!name) return 'Enter your full name';
            return name.length > 50 ? 'Use at most 50 characters' : '';
        },
        username(value) {
            const name = normalizeUsername(value);
            if (!name) return 'Choose a username';
            return USERNAME_RE.test(name) ? '' : 'Use 3-30 letters, numbers, underscores or periods, without a period at the start or end';
        },
        phone(value) {
            if (!value.trim()) return 'Enter your phone number';
            return normalizePhone(value) ? '' : 'Enter a valid phone number with 7-15 digits, like +91 98765 43210';
        },
        email(value) {
            const email = value.trim().toLowerCase();
            if (!email) return 'Enter your email address';
            return email.length <= 254 && EMAIL_RE.test(email) ? '' : 'Enter a valid email address, like name@example.com';
        }
    };

    function confirmProblem(confirm, password) {
        if (!confirm) return 'Re-enter your password';
        return confirm === password ? '' : 'Passwords do not match';
    }

    // ---------- Form helpers ----------

    function fieldError(input, message) {
        const el = document.getElementById(`${input.id}-error`);
        if (el) el.textContent = message || '';
        input.setAttribute('aria-invalid', message ? 'true' : 'false');
    }

    function showAlert(el, message, type = 'error') {
        if (!el) return;
        el.textContent = message || '';
        el.className = `auth-alert${message ? ` is-visible is-${type}` : ''}`;
    }

    function setBusy(button, busy, busyLabel) {
        if (busy) {
            button.dataset.label = button.textContent.trim();
            button.disabled = true;
            button.setAttribute('aria-busy', 'true');
            const spinner = document.createElement('span');
            spinner.className = 'auth-spinner';
            spinner.setAttribute('aria-hidden', 'true');
            button.replaceChildren(spinner, document.createTextNode(busyLabel));
        } else {
            button.disabled = false;
            button.removeAttribute('aria-busy');
            if (button.dataset.label) button.textContent = button.dataset.label;
        }
    }

    function wirePasswordToggles(root = document) {
        root.querySelectorAll('[data-toggle-password]').forEach(button => {
            const input = document.getElementById(button.dataset.togglePassword);
            if (!input) return;
            button.addEventListener('click', () => {
                const show = input.type === 'password';
                input.type = show ? 'text' : 'password';
                button.textContent = show ? 'Hide' : 'Show';
                button.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
            });
        });
    }

    // Password managers only offer to save fields that are type="password" at submit.
    function hidePasswords(form) {
        form.querySelectorAll('[data-toggle-password]').forEach(button => {
            const input = document.getElementById(button.dataset.togglePassword);
            if (input && input.type === 'text') button.click();
        });
    }

    function updateChecklist(list, password) {
        if (!list) return;
        const rules = {
            length: password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX,
            mix: /\p{L}/u.test(password) && /\p{N}/u.test(password)
        };
        list.querySelectorAll('[data-rule]').forEach(item => {
            item.classList.toggle('is-met', Boolean(rules[item.dataset.rule]));
        });
    }

    // Shows the server's per-field messages; returns the first field it marked.
    function applyFieldErrors(form, fields) {
        let first = null;
        for (const [name, message] of Object.entries(fields || {})) {
            const input = form.elements[name];
            if (!input) continue;
            fieldError(input, message);
            first = first || input;
        }
        return first;
    }

    function errorMessage(status, data) {
        if (data && data.error) return data.error;
        return status >= 500 ? SERVER_TROUBLE : 'Something went wrong. Please try again.';
    }

    // ---------- Log in ----------

    function initLoginPage(form) {
        const identifier = form.elements.identifier;
        const password = form.elements.password;
        const alertEl = document.getElementById('form-alert');
        const submit = form.querySelector('[type="submit"]');
        let busy = false;

        resumeExistingSession();

        for (const input of [identifier, password]) {
            input.addEventListener('input', () => {
                fieldError(input, '');
                if (alertEl.classList.contains('is-error')) showAlert(alertEl, '');
            });
        }

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (busy) return;
            showAlert(alertEl, '');

            const id = identifier.value.trim();
            fieldError(identifier, id ? '' : 'Enter your username or email');
            fieldError(password, password.value ? '' : 'Enter your password');
            if (!id) return identifier.focus();
            if (!password.value) return password.focus();

            busy = true;
            hidePasswords(form);
            setBusy(submit, true, 'Logging in...');
            try {
                const { ok, status, data } = await callApi('POST', '/auth/login',
                    { identifier: id, password: password.value }, { withCookies: true });
                if (ok) {
                    session.store(data.token, data.user);
                    window.location.replace(session.destinationFor(data.user));
                    return;
                }
                showAlert(alertEl, errorMessage(status, data));
                if (status === 401) {
                    password.value = '';
                    password.focus();
                }
            } catch (err) {
                showAlert(alertEl, err.message);
            }
            busy = false;
            setBusy(submit, false);
        });
    }

    // ---------- Sign up ----------

    function initSignupPage(form) {
        const alertEl = document.getElementById('form-alert');
        const submit = form.querySelector('[type="submit"]');
        const checklist = document.getElementById('password-rules');
        const names = ['fullName', 'username', 'phone', 'email', 'password', 'confirmPassword'];
        const inputs = names.map(name => form.elements[name]);
        const touched = new Set();
        let busy = false;

        resumeExistingSession();

        function problemFor(input) {
            const value = input.value;
            if (input.name === 'password') {
                return passwordProblem(value, {
                    username: normalizeUsername(form.elements.username.value),
                    email: form.elements.email.value.trim().toLowerCase()
                });
            }
            if (input.name === 'confirmPassword') return confirmProblem(value, form.elements.password.value);
            return checks[input.name](value);
        }

        function validate(input) {
            const problem = problemFor(input);
            fieldError(input, problem);
            return problem;
        }

        for (const input of inputs) {
            // Errors appear once the user leaves a field, and disappear as
            // soon as the value becomes valid.
            input.addEventListener('blur', () => {
                if (!input.value && !touched.has(input.name)) return;
                touched.add(input.name);
                if (!validate(input) && input.name === 'username') input.value = normalizeUsername(input.value);
            });
            input.addEventListener('input', () => {
                if (input.getAttribute('aria-invalid') === 'true') validate(input);
                if (input.name === 'password') {
                    updateChecklist(checklist, input.value);
                    if (touched.has('confirmPassword')) validate(form.elements.confirmPassword);
                }
                if (alertEl.classList.contains('is-error')) showAlert(alertEl, '');
            });
        }

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (busy) return;
            names.forEach(name => touched.add(name));
            const invalid = inputs.filter(input => validate(input));
            if (invalid.length) {
                showAlert(alertEl, FIX_FIELDS);
                invalid[0].focus();
                return;
            }

            busy = true;
            hidePasswords(form);
            showAlert(alertEl, '');
            setBusy(submit, true, 'Creating your account...');
            try {
                const body = Object.fromEntries(inputs.map(input => [input.name, input.value]));
                const { ok, status, data } = await callApi('POST', '/auth/signup', body, { withCookies: true });
                if (ok) {
                    session.store(data.token, data.user);
                    window.location.replace('profile-setup.html');
                    return;
                }
                const first = applyFieldErrors(form, data.fields);
                showAlert(alertEl, errorMessage(status, data));
                if (first) first.focus();
            } catch (err) {
                showAlert(alertEl, err.message);
            }
            busy = false;
            setBusy(submit, false);
        });
    }

    // ---------- One-time password link ----------

    function initResetPage(form) {
        const alertEl = document.getElementById('form-alert');
        const submit = form.querySelector('[type="submit"]');
        const done = document.getElementById('reset-done');
        const checklist = document.getElementById('password-rules');
        const password = form.elements.password;
        const confirm = form.elements.confirmPassword;
        let busy = false;

        // The token is in the URL fragment, which browsers never send to a
        // server. Take it out of the address bar as well.
        const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
        if (window.location.hash) history.replaceState(null, '', window.location.pathname + window.location.search);

        function linkUnusable(message) {
            form.hidden = true;
            showAlert(alertEl, message || 'This password link is invalid, has expired or was already used. Ask for a new one.');
        }
        if (!token) {
            linkUnusable('Open the full password link you were sent. If it no longer works, ask for a new one.');
            return;
        }

        password.addEventListener('input', () => {
            updateChecklist(checklist, password.value);
            if (password.getAttribute('aria-invalid') === 'true') fieldError(password, passwordProblem(password.value));
            if (confirm.value) fieldError(confirm, confirmProblem(confirm.value, password.value));
        });
        confirm.addEventListener('input', () => {
            if (confirm.getAttribute('aria-invalid') === 'true') fieldError(confirm, confirmProblem(confirm.value, password.value));
        });

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (busy) return;
            const passwordIssue = passwordProblem(password.value);
            const confirmIssue = confirmProblem(confirm.value, password.value);
            fieldError(password, passwordIssue);
            fieldError(confirm, confirmIssue);
            if (passwordIssue) return password.focus();
            if (confirmIssue) return confirm.focus();

            busy = true;
            hidePasswords(form);
            showAlert(alertEl, '');
            setBusy(submit, true, 'Saving...');
            try {
                const { ok, status, data } = await callApi('POST', '/auth/password-reset',
                    { token, password: password.value, confirmPassword: confirm.value });
                if (ok) {
                    // Every session was signed out on the server; drop the local one too.
                    session.clear();
                    form.hidden = true;
                    const name = document.getElementById('reset-username');
                    if (name && data.username) name.textContent = `@${data.username}`;
                    done.hidden = false;
                    done.querySelector('a').focus();
                    return;
                }
                if (data.reason === 'invalid_link') {
                    linkUnusable(data.error);
                    return;
                }
                const first = applyFieldErrors(form, data.fields);
                showAlert(alertEl, errorMessage(status, data));
                if (first) first.focus();
            } catch (err) {
                showAlert(alertEl, err.message);
            }
            busy = false;
            setBusy(submit, false);
        });
    }

    // ---------- Settings: set or change password ----------

    function initPasswordSettings(form) {
        const alertEl = document.getElementById('password-alert');
        const submit = form.querySelector('[type="submit"]');
        const currentField = document.getElementById('current-password-field');
        const intro = document.getElementById('password-intro');
        const checklist = document.getElementById('password-rules');
        const current = form.elements.currentPassword;
        const next = form.elements.newPassword;
        const confirm = form.elements.confirmPassword;
        let hasPassword = true;
        let busy = false;

        authorized('GET', '/auth/me').then(({ ok, data }) => {
            if (!ok) return;
            const email = document.getElementById('security-email-display');
            if (email) email.textContent = data.email || `@${data.username}`;
            const username = document.getElementById('security-username-display');
            if (username) username.textContent = `@${data.username}`;
            hasPassword = data.hasPassword !== false;
            if (!hasPassword) {
                currentField.hidden = true;
                submit.textContent = 'Set password';
                intro.textContent = 'Your account was created with an email code and has no password yet. Set one now so you can keep logging in with your username or email.';
            }
        }).catch(() => {});

        next.addEventListener('input', () => updateChecklist(checklist, next.value));
        for (const input of [current, next, confirm]) {
            input.addEventListener('input', () => fieldError(input, ''));
        }

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (busy) return;
            const problems = [
                [current, hasPassword && !current.value ? 'Enter your current password' : ''],
                [next, passwordProblem(next.value)],
                [confirm, confirmProblem(confirm.value, next.value)]
            ];
            problems.forEach(([input, problem]) => fieldError(input, problem));
            const firstInvalid = problems.find(([, problem]) => problem);
            if (firstInvalid) return firstInvalid[0].focus();

            busy = true;
            hidePasswords(form);
            showAlert(alertEl, '');
            setBusy(submit, true, 'Saving...');
            try {
                const body = { newPassword: next.value, confirmPassword: confirm.value };
                if (hasPassword) body.currentPassword = current.value;
                const { ok, status, data } = await authorized('POST', '/auth/change-password', body, { withCookies: true });
                if (ok) {
                    session.store(data.token, { ...(session.user() || {}), ...data.user, hasPassword: true });
                    form.reset();
                    updateChecklist(checklist, '');
                    hasPassword = true;
                    currentField.hidden = false;
                    submit.dataset.label = 'Change password';
                    intro.textContent = 'Changing your password signs you out on every other device.';
                    showAlert(alertEl, data.message, 'success');
                } else {
                    const first = applyFieldErrors(form, data.fields);
                    showAlert(alertEl, errorMessage(status, data));
                    if (first) first.focus();
                }
            } catch (err) {
                showAlert(alertEl, err.message);
            }
            busy = false;
            setBusy(submit, false);
        });
    }

    // ---------- Wiring ----------

    function init() {
        wirePasswordToggles();
        const pages = [
            ['login-form', initLoginPage],
            ['signup-form', initSignupPage],
            ['reset-form', initResetPage],
            ['password-form', initPasswordSettings]
        ];
        for (const [id, initPage] of pages) {
            const form = document.getElementById(id);
            if (form) initPage(form);
        }
    }

    window.FlexyAuth = {
        session,
        callApi,
        authorized,
        refreshSession,
        logout,
        normalizeUsername,
        USERNAME_RE,
        fieldError,
        showAlert,
        setBusy,
        errorMessage
    };
    // Pages with a "Sign out" button call logout(); api.js defines the same.
    if (typeof window.logout !== 'function') window.logout = logout;

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
