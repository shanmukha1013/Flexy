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
        // Messages often contain server error text, so they are rendered as
        // text, never as HTML.
        const content = document.createElement('div');
        content.className = 'notification-content';
        const icon = document.createElement('div');
        icon.className = 'notification-icon';
        icon.textContent = getIcon(type);
        const text = document.createElement('div');
        text.className = 'notification-message';
        text.textContent = String(message);
        content.append(icon, text);
        el.appendChild(content);
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