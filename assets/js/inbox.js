// inbox.js - Standalone inbox page
class InboxPage {
    constructor() {
        this.user = null;
        this.filter = 'all';
        this.init();
    }

    init() {
        const userData = localStorage.getItem('flexy_user');
        if (!userData) { window.location.href = 'login.html'; return; }
        this.user = JSON.parse(userData);
        this.loadAndRender();
    }

    key() { return 'flexy_emails_' + this.user.id; }

    loadAndRender() {
        this.mails = JSON.parse(localStorage.getItem(this.key()) || '[]');
        this.renderList();
    }

    renderList() {
        const list = document.getElementById('inbox-list'); if (!list) return;
        const filtered = this.filter === 'unread' ? this.mails.filter(m => !m.read) : this.mails;
        if (!filtered.length) { list.innerHTML = `<div class="empty-state"><h4>No messages</h4><p>Your inbox is empty.</p></div>`; document.getElementById('preview-subject').textContent = 'Select a message'; document.getElementById('preview-body').textContent = ''; return; }
        list.innerHTML = filtered.map(m => `
            <div class="inbox-row ${m.read ? 'read' : 'unread'}" data-mail-id="${m.id}" onclick="inbox.openEmail('${m.id}')">
                <div class="inbox-title">${m.subject}</div>
                <div class="inbox-meta">${new Date(m.date).toLocaleString()}</div>
            </div>
        `).join('');
    }

    openEmail(id) {
        const idx = this.mails.findIndex(m => m.id === id); if (idx === -1) return;
        const mail = this.mails[idx];
        mail.read = true; localStorage.setItem(this.key(), JSON.stringify(this.mails));
        document.getElementById('preview-subject').textContent = mail.subject;
        document.getElementById('preview-body').textContent = mail.body;
        const markBtn = document.getElementById('preview-mark-read'); if (markBtn) markBtn.onclick = () => this.toggleRead(id);
        const delBtn = document.getElementById('preview-delete'); if (delBtn) delBtn.onclick = () => this.deleteEmail(id);
        this.loadAndRender();
    }

    toggleRead(id) {
        const idx = this.mails.findIndex(m => m.id === id); if (idx === -1) return;
        this.mails[idx].read = !this.mails[idx].read; localStorage.setItem(this.key(), JSON.stringify(this.mails)); this.loadAndRender();
    }

    deleteEmail(id) {
        this.mails = this.mails.filter(m => m.id !== id); localStorage.setItem(this.key(), JSON.stringify(this.mails)); this.loadAndRender(); document.getElementById('preview-subject').textContent = 'Select a message'; document.getElementById('preview-body').textContent = ''; notify('Email deleted', 'info');
    }

    setFilter(f) { this.filter = f; this.renderList(); }

    markAllRead() {
        this.mails.forEach(m => m.read = true); localStorage.setItem(this.key(), JSON.stringify(this.mails)); this.loadAndRender(); notify('Marked all as read', 'success');
    }

    exportEmails(format = 'json') {
        const mails = this.mails; if (!mails || !mails.length) { notify('No emails to export', 'info'); return; }
        const filenameBase = `emails_${this.user.id}_${new Date().toISOString().slice(0,10)}`;
        if (format === 'json') { const blob = new Blob([JSON.stringify(mails, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filenameBase + '.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); notify('Exported emails (JSON)', 'success'); return; }
        const rows = [['id','subject','body','date','read']]; mails.forEach(m => rows.push([`"${m.id}"`, `"${m.subject.replace(/"/g,'""')}"`, `"${m.body.replace(/"/g,'""')}"`, new Date(m.date).toLocaleString(), m.read])); const csv = rows.map(r => r.join(',')).join('\n'); const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filenameBase + '.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); notify('Exported emails (CSV)', 'success');
    }
}

const inbox = new InboxPage();

// global hooks for onclicks
function openInboxEmail(id) { inbox.openEmail(id); }