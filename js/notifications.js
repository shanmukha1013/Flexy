// js/notifications.js
// Handles Notification Center logic for FLEXY

document.addEventListener("DOMContentLoaded", () => {
    // 1. Check Auth
    auth.checkAuth();
    
    // 2. Load User Profile Sidebar
    loadSidebarProfile();
    
    // 3. Load Notifications List
    loadNotificationsList();

    // 4. Hook up Mark All as Read button
    const markAllBtn = document.getElementById('mark-all-read-btn');
    if (markAllBtn) {
        markAllBtn.addEventListener('click', markAllNotificationsAsRead);
    }
});

function loadSidebarProfile() {
    const user = auth.getUser();
    if (!user) return;

    // Set text elements
    const displayNameEl = document.getElementById('sidebar-displayname');
    const usernameEl = document.getElementById('sidebar-username');
    const reputationEl = document.getElementById('sidebar-reputation');
    const avatarEl = document.getElementById('sidebar-avatar');

    if (displayNameEl) displayNameEl.innerText = user.displayName || user.username;
    if (usernameEl) usernameEl.innerText = `@${user.username}`;
    if (reputationEl) reputationEl.innerText = `Reputation: ${user.reputation || 'Elite Collector'}`;

    if (avatarEl) {
        if (user.avatarUrl || user.profilePhoto) {
            avatarEl.style.backgroundImage = `url('${user.avatarUrl || user.profilePhoto}')`;
            avatarEl.style.backgroundSize = 'cover';
            avatarEl.style.backgroundPosition = 'center';
            avatarEl.innerText = '';
        } else {
            avatarEl.innerText = user.avatarInitials || (user.displayName || user.username).substring(0, 2).toUpperCase();
        }
    }

    // Load Joined Communities for Sidebar
    loadSidebarCommunities();
}

async function loadSidebarCommunities() {
    const listEl = document.getElementById('sidebar-communities-list');
    if (!listEl) return;

    try {
        const me = await api.get('/auth/me');
        const communities = me.communities || [];

        if (communities.length === 0) {
            listEl.innerHTML = '<p style="font-size: 0.85rem; color: var(--text-muted);">No joined communities yet.</p>';
            return;
        }

        let html = '';
        communities.forEach(c => {
            html += `
            <a href="community.html?id=${c._id}" style="text-decoration: none; color: var(--text-primary); display: flex; align-items: center; gap: 0.8rem;">
                <span style="font-size: 1.2rem;">👥</span>
                <span style="font-weight: 600; font-size: 0.9rem;">${c.name}</span>
            </a>`;
        });
        listEl.innerHTML = html;
    } catch (err) {
        console.error("Error loading sidebar communities:", err);
    }
}

async function loadNotificationsList() {
    const container = document.getElementById('notifications-list-container');
    if (!container) return;

    try {
        const notifications = await api.get('/notifications');
        
        if (notifications.length === 0) {
            container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔔</div>
                <h3>All Caught Up</h3>
                <p style="margin-top: 0.5rem; font-size: 0.9rem;">You have no notifications at this time.</p>
            </div>`;
            return;
        }

        let html = '';
        notifications.forEach(n => {
            const isUnread = !n.read;
            const timeStr = formatRelativeTime(new Date(n.createdAt));
            const icon = getNotificationIcon(n.type);

            let actionHtml = '';
            // Render inline Approve/Reject buttons for community requests
            if (n.type === 'community_request' && n.relatedItem) {
                actionHtml = `
                <div class="action-buttons" id="actions-${n._id}">
                    <button class="btn btn-primary" style="padding: 0.35rem 0.85rem; font-size: 0.8rem; border-radius: var(--radius-sm);" onclick="handleCommunityRequest('${n._id}', '${n.relatedItem}', '${n.sender._id}', 'approve')">Approve</button>
                    <button class="btn btn-outline" style="padding: 0.35rem 0.85rem; font-size: 0.8rem; border-radius: var(--radius-sm); color: var(--danger); border-color: var(--danger);" onclick="handleCommunityRequest('${n._id}', '${n.relatedItem}', '${n.sender._id}', 'reject')">Reject</button>
                </div>`;
            }

            // Click handler: Mark as read and redirect based on type
            const redirectUrl = getRedirectUrl(n);
            const clickAttr = redirectUrl ? `style="cursor: pointer;" onclick="handleNotificationClick('${n._id}', '${redirectUrl}', event)"` : '';

            html += `
            <div class="notification-card ${isUnread ? 'unread' : ''}" id="notif-${n._id}" ${clickAttr}>
                <div class="notification-icon">${icon}</div>
                <div class="notification-content">
                    <div class="notification-title">${n.title}</div>
                    <div class="notification-msg">${n.message}</div>
                    <div class="notification-time">${timeStr}</div>
                    ${actionHtml}
                </div>
            </div>`;
        });

        container.innerHTML = html;

    } catch (err) {
        console.error("Error loading notifications:", err);
        container.innerHTML = `
        <div style="text-align: center; padding: 3rem; color: var(--danger);">
            <h3>Failed to load notifications</h3>
            <p style="margin-top: 1rem; font-size: 0.9rem;">${err.message}</p>
        </div>`;
    }
}

function getNotificationIcon(type) {
    switch (type) {
        case 'like': return '❤️';
        case 'comment': return '💬';
        case 'bid': return '⚖️';
        case 'outbid': return '⚠️';
        case 'auction_won': return '🏆';
        case 'auction_ended': return '🏁';
        case 'follow': return '👤';
        case 'community_request': return '👥';
        case 'community_approved': return '✅';
        case 'community_rejected': return '❌';
        default: return '🔔';
    }
}

function getRedirectUrl(n) {
    if (n.type === 'community_request') return null; // handled inline
    
    if (n.itemModel === 'Post' && n.relatedItem) {
        // Redirect to community page containing the post if possible
        // Note: Community page fetches posts for that community. 
        // We will just redirect to communities.html or let it slide
        return 'communities.html';
    } else if (n.itemModel === 'Auction' && n.relatedItem) {
        return `item.html?id=${n.relatedItem}`;
    } else if (n.itemModel === 'User' && n.relatedItem) {
        return `profile.html?id=${n.relatedItem}`;
    } else if (n.itemModel === 'Community' && n.relatedItem) {
        return `community.html?id=${n.relatedItem}`;
    }
    return null;
}

async function handleNotificationClick(notificationId, redirectUrl, event) {
    // If user clicked inside action-buttons, don't trigger outer click
    if (event.target.closest('.action-buttons')) return;

    try {
        // Mark as read
        await api.put(`/notifications/${notificationId}/read`);
    } catch (err) {
        console.error("Failed to mark notification as read:", err);
    }

    if (redirectUrl) {
        window.location.href = redirectUrl;
    } else {
        // Just reload to update unread indicator
        loadNotificationsList();
        if (typeof updateNotificationBadge === 'function') {
            updateNotificationBadge();
        }
    }
}

async function handleCommunityRequest(notificationId, communityId, userId, action) {
    const actionsContainer = document.getElementById(`actions-${notificationId}`);
    if (actionsContainer) {
        actionsContainer.innerHTML = '<div class="loading-spinner" style="width: 20px; height: 20px;"></div> Processing...';
    }

    try {
        // 1. Call Community Approve/Reject API
        await api.post(`/communities/${communityId}/requests/${userId}/${action}`);

        // 2. Mark this notification as read
        await api.put(`/notifications/${notificationId}/read`);

        // 3. Update UI
        if (actionsContainer) {
            if (action === 'approve') {
                actionsContainer.innerHTML = '<span style="color: var(--primary); font-weight: 600;">Approved ✅</span>';
            } else {
                actionsContainer.innerHTML = '<span style="color: var(--text-muted); font-weight: 600;">Rejected ❌</span>';
            }
        }

        // Remove unread class from card
        const card = document.getElementById(`notif-${notificationId}`);
        if (card) {
            card.classList.remove('unread');
        }

        // Update badge
        if (typeof updateNotificationBadge === 'function') {
            updateNotificationBadge();
        }

    } catch (err) {
        alert(err.message);
        loadNotificationsList(); // Restore original UI state
    }
}

async function markAllNotificationsAsRead() {
    try {
        await api.post('/notifications/mark-all-read');
        notify('All notifications marked as read', 'success');
        loadNotificationsList();
        if (typeof updateNotificationBadge === 'function') {
            updateNotificationBadge();
        }
    } catch (err) {
        notify(err.message, 'error');
    }
}

function formatRelativeTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffSec < 60) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay === 1) return "Yesterday";
    return date.toLocaleDateString();
}
