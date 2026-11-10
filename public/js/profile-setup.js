// profile-setup.js - The mandatory profile step after sign-up. The server
// decides when a profile is complete (at least one interest; the photo and bio
// are optional) and keeps the marketplace locked until then. This page only
// collects the details.

(function () {
    'use strict';

    const { session, authorized, refreshSession, logout, normalizeUsername, USERNAME_RE, fieldError, showAlert, setBusy, errorMessage } = window.FlexyAuth;

    const INTERESTS = [
        'Art', 'Watches', 'Coins', 'Sneakers', 'Trading Cards',
        'Comic Books', 'Stamps', 'Records', 'Action Figures', 'Vintage Cameras'
    ];
    // Accounts from the retired email sign-in got usernames like user_1a2b3c4d.
    const PLACEHOLDER_USERNAME_RE = /^user_[0-9a-f]{8}$/;
    const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

    const form = document.getElementById('setup-form');
    const alertEl = document.getElementById('form-alert');
    const loading = document.getElementById('setup-loading');
    const submit = form.querySelector('[type="submit"]');
    const bio = form.elements.bio;
    const bioCounter = document.getElementById('bio-counter');
    const chips = document.getElementById('interests');
    const interestsError = document.getElementById('interests-error');
    const identityFields = document.getElementById('identity-fields');
    const displayName = form.elements.displayName;
    const username = form.elements.username;
    const avatarInput = document.getElementById('avatar-input');
    const avatarButton = document.getElementById('avatar-button');
    const avatarPreview = document.getElementById('avatar-preview');
    const avatarPlaceholder = document.getElementById('avatar-placeholder');
    const avatarLabel = document.getElementById('avatar-button-label');
    const avatarRemove = document.getElementById('avatar-remove');

    let me = null;
    let photo = null; // null: unchanged, '': removed, otherwise a data: URL
    let busy = false;
    const selected = new Set();

    function showPhoto(url) {
        avatarPreview.hidden = !url;
        avatarPlaceholder.style.display = url ? 'none' : '';
        if (url) avatarPreview.src = url;
        else avatarPreview.removeAttribute('src');
        avatarRemove.hidden = !url;
        avatarLabel.textContent = url ? 'Change profile photo' : 'Add a profile photo';
    }

    // Interests the member already has are kept, even if they are not in the list.
    function renderInterests(existing) {
        const extra = existing.filter(interest => !INTERESTS.includes(interest));
        for (const interest of [...INTERESTS, ...extra]) {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'auth-chip';
            chip.textContent = interest;
            chip.setAttribute('aria-pressed', String(selected.has(interest)));
            chip.addEventListener('click', () => {
                if (selected.has(interest)) selected.delete(interest);
                else selected.add(interest);
                chip.setAttribute('aria-pressed', String(selected.has(interest)));
                if (selected.size) {
                    interestsError.textContent = '';
                    if (alertEl.classList.contains('is-error')) showAlert(alertEl, '');
                }
            });
            chips.appendChild(chip);
        }
    }

    function updateBioCounter() {
        bioCounter.textContent = `${bio.value.length}/${bio.maxLength}`;
    }

    avatarButton.addEventListener('click', () => avatarInput.click());
    avatarRemove.addEventListener('click', () => {
        photo = '';
        avatarInput.value = '';
        showPhoto('');
        avatarButton.focus();
    });
    avatarInput.addEventListener('change', () => {
        const file = avatarInput.files && avatarInput.files[0];
        fieldError(avatarInput, '');
        if (!file) return;
        if (!PHOTO_TYPES.includes(file.type)) {
            fieldError(avatarInput, 'Choose a JPG, PNG, WebP or GIF image.');
            avatarInput.value = '';
            return;
        }
        if (file.size > MAX_PHOTO_BYTES) {
            fieldError(avatarInput, 'Choose an image smaller than 2 MB.');
            avatarInput.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            photo = reader.result;
            showPhoto(photo);
        };
        reader.onerror = () => fieldError(avatarInput, 'That image could not be read. Try another one.');
        reader.readAsDataURL(file);
    });

    bio.addEventListener('input', updateBioCounter);
    document.getElementById('logout-button').addEventListener('click', logout);

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (busy || !me) return;
        showAlert(alertEl, '');

        const askIdentity = !identityFields.hidden;
        const problems = [];
        if (askIdentity) {
            const name = displayName.value.replace(/\s+/g, ' ').trim();
            const handle = normalizeUsername(username.value);
            const nameProblem = !name ? 'Enter the name other collectors will see' : '';
            const handleProblem = !handle ? 'Choose a username'
                : (!USERNAME_RE.test(handle) || PLACEHOLDER_USERNAME_RE.test(handle))
                    ? 'Use 3-30 letters, numbers, underscores or periods, without a period at the start or end'
                    : '';
            fieldError(displayName, nameProblem);
            fieldError(username, handleProblem);
            if (nameProblem) problems.push(displayName);
            if (handleProblem) problems.push(username);
        }
        interestsError.textContent = selected.size ? '' : 'Pick at least one interest.';
        if (!selected.size) problems.push(chips.querySelector('.auth-chip'));
        if (problems.length) {
            showAlert(alertEl, 'Please fix the highlighted fields.');
            problems[0].focus();
            return;
        }

        const body = { bio: bio.value.trim(), interests: [...selected] };
        if (photo !== null) body.avatarUrl = photo;
        if (askIdentity) {
            body.displayName = displayName.value;
            body.username = username.value;
        }

        busy = true;
        setBusy(submit, true, 'Saving...');
        try {
            const { ok, status, data } = await authorized('PUT', `/users/${me._id}`, body);
            if (ok && data.profileCompleted) {
                // A fresh access token carries the completed-profile claim.
                await refreshSession();
                window.location.replace('home.html');
                return;
            }
            if (ok) {
                showAlert(alertEl, 'Your details were saved, but the profile is not complete yet. Pick at least one interest.');
            } else if (status === 401) {
                session.clear();
                window.location.replace('login.html');
                return;
            } else {
                const message = errorMessage(status, data);
                showAlert(alertEl, message);
                if (askIdentity && /username/i.test(message)) {
                    fieldError(username, message);
                    username.focus();
                }
            }
        } catch (err) {
            showAlert(alertEl, err.message);
        }
        busy = false;
        setBusy(submit, false);
    });

    async function start() {
        let result;
        try {
            result = await authorized('GET', '/auth/me');
        } catch (err) {
            loading.hidden = true;
            showAlert(alertEl, err.message);
            return;
        }
        if (result.status === 401) {
            session.clear();
            window.location.replace('login.html');
            return;
        }
        if (!result.ok) {
            loading.hidden = true;
            showAlert(alertEl, errorMessage(result.status, result.data));
            return;
        }

        me = result.data;
        if (me.profileCompleted) {
            window.location.replace('home.html');
            return;
        }

        document.getElementById('signed-in-as').textContent = `@${me.username}`;
        if (PLACEHOLDER_USERNAME_RE.test(me.username)) {
            identityFields.hidden = false;
            displayName.value = me.displayName || '';
        } else if (me.displayName) {
            document.getElementById('setup-title').textContent = `Welcome, ${me.displayName.split(' ')[0]}`;
        }
        bio.value = me.bio || '';
        updateBioCounter();
        const existing = Array.isArray(me.interests) ? me.interests : [];
        existing.forEach(interest => selected.add(interest));
        renderInterests(existing);
        showPhoto(me.avatarUrl || '');

        loading.hidden = true;
        form.hidden = false;
    }

    start();
})();
