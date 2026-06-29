// notify.js - Global notification (toast) system
(function() {
    const containerId = 'global-notification-container';

    function ensureContainer() {
        let container = document.getElementById(containerId);
        if (!container) {
            container = document.createElement('div');
            container.id = containerId;
            container.style.position = 'fixed';
            container.style.top = '1rem';
            container.style.right = '1rem';
            container.style.zIndex = 1200;
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.gap = '0.75rem';
            document.body.appendChild(container);
        }
        return container;
    }

    function createNotificationElement(message, type) {
        const el = document.createElement('div');
        el.className = `notification ${type}`;
        el.innerHTML = `
            <div class="notification-content">
                <div class="notification-icon">${getIcon(type)}</div>
                <div class="notification-message">${message}</div>
            </div>
        `;
        return el;
    }

    function getIcon(type) {
        switch(type) {
            case 'success': return '✅';
            case 'error': return '❌';
            case 'warning': return '⚠️';
            default: return 'ℹ️';
        }
    }

    window.notify = function(message, type = 'info', duration = 3500) {
        const container = ensureContainer();
        const el = createNotificationElement(message, type);
        container.appendChild(el);

        // force layout for transition
        requestAnimationFrame(() => el.classList.add('show'));

        const hide = () => {
            el.classList.remove('show');
            setTimeout(() => el.remove(), 300);
        };

        const timeout = setTimeout(hide, duration);

        el.addEventListener('click', () => {
            clearTimeout(timeout);
            hide();
        });
    };

    // expose for older code
    window.showNotification = window.notify;
})();