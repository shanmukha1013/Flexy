// wallet.js - Wallet and Transactions Management

class Wallet {
    constructor() {
        this.currentUser = null;
        this.transactions = [];
        this.paymentMethods = [
            { id: 'upi', name: 'UPI', icon: '📱', description: 'Instant payment' },
            { id: 'card', name: 'Card', icon: '💳', description: 'Credit/Debit Card' },
            { id: 'netbanking', name: 'Net Banking', icon: '🏦', description: 'Bank Transfer' }
        ];
        this.init();
    }

    init() {
        // Check authentication
        this.checkAuth();
        
        // Load user
        this.loadUser();
        
        // Load transactions
        this.loadTransactions();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Render wallet
        this.render();
    }

    checkAuth() {
        const user = localStorage.getItem('flexy_user');
        const token = localStorage.getItem('flexy_token');
        
        if (!user || !token) {
            window.location.href = 'login.html';
        }
    }

    loadUser() {
        const userData = localStorage.getItem('flexy_user');
        if (userData) {
            this.currentUser = JSON.parse(userData);
        }
    }

    loadTransactions() {
        const userTransactions = localStorage.getItem('flexy_transactions_' + this.currentUser?.id);
        this.transactions = userTransactions ? JSON.parse(userTransactions) : [];
        
        // Sort by date (newest first)
        this.transactions.sort((a, b) => b.date - a.date);
    }

    setupEventListeners() {
        // Add money modal
        const addMoneyBtn = document.querySelector('[onclick="addMoney()"]');
        if (addMoneyBtn) {
            addMoneyBtn.addEventListener('click', () => this.openAddMoneyModal());
        }
        
        // Other action buttons
        document.querySelectorAll('.action-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const action = e.currentTarget.querySelector('.action-label').textContent;
                this.handleAction(action);
            });
        });
        
        // View all transactions
        const viewAllBtn = document.querySelector('[onclick="showAllTransactions()"]');
        if (viewAllBtn) {
            viewAllBtn.addEventListener('click', () => this.showAllTransactions());
        }
        
        // Refresh balance
        const refreshBtn = document.querySelector('[onclick="refreshBalance()"]');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshBalance());
        }
        
        // Modal close buttons
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                this.closeAllModals();
            });
        });

        // Overlay click to close
        const overlay = document.getElementById('modal-overlay');
        if (overlay) {
            overlay.addEventListener('click', () => this.closeAllModals());
        }

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeAllModals();
        });

        // Clear field errors on input change
        const addAmountInput = document.getElementById('add-amount');
        if (addAmountInput) {
            addAmountInput.addEventListener('input', () => this.clearFieldError('add-amount'));
        }

        // Clear errors when preset selected
        document.querySelectorAll('.preset-amount').forEach(btn => {
            btn.addEventListener('click', () => this.clearFieldError('add-amount'));
        });

        // Clear method error when payment method changed
        document.querySelectorAll('input[name="payment-method"]').forEach(radio => {
            radio.addEventListener('change', () => this.clearMethodError());
        });

        // Prevent form submit and wire Enter key
        const addMoneyForm = document.getElementById('add-money-form');
        if (addMoneyForm) {
            addMoneyForm.addEventListener('submit', (e) => { e.preventDefault(); this.processPayment(); });
        }

        // Focus trap references
        this._trapHandler = null;
        this._activeModal = null;
        
        // Preset amount buttons
        this.setupPresetAmounts();
        
        // Process payment button
        const processPaymentBtn = document.getElementById('add-money-btn');
        if (processPaymentBtn) {
            processPaymentBtn.addEventListener('click', () => this.processPayment());
        }
    }

    setupPresetAmounts() {
        document.querySelectorAll('.preset-amount').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const amount = parseInt(e.currentTarget.dataset.amount);
                this.selectAmount(amount);
            });
        });
    }

    render() {
        this.renderBalance();
        this.renderTransactions();
    }

    renderBalance() {
        if (!this.currentUser) return;
        
        // compute reserved total (sum of values in reserved map)
        const reservedMap = this.currentUser.reserved || {};
        const reservedTotal = Object.values(reservedMap).reduce((s, v) => s + (Number(v) || 0), 0);

        const balanceElement = document.getElementById('balance-amount');
        if (balanceElement) {
            balanceElement.textContent = `₹${this.formatPrice(this.currentUser.balance)}`;
        }
        
        const reservedEl = document.getElementById('reserved-amount');
        if (reservedEl) {
            reservedEl.textContent = `Reserved for bids: ₹${this.formatPrice(reservedTotal)}`;
        }

        // Also update in bid section if exists
        const walletBalanceBid = document.getElementById('wallet-balance-bid');
        if (walletBalanceBid) {
            walletBalanceBid.textContent = `₹${this.formatPrice(this.currentUser.balance - reservedTotal)}`;
        }
    }

    renderTransactions() {
        const container = document.getElementById('transactions-list');
        const emptyState = document.getElementById('empty-transactions');
        
        if (!container) return;
        
        if (this.transactions.length === 0) {
            container.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }
        
        if (emptyState) emptyState.style.display = 'none';
        
        // Show only recent transactions (last 10)
        const recentTransactions = this.transactions.slice(0, 10);
        
        container.innerHTML = recentTransactions.map(transaction => `
            <div class="transaction-item ${transaction.type}">
                <div class="transaction-info">
                    <h4>${transaction.description}</h4>
                    <div class="transaction-date">${this.formatDate(transaction.date)}</div>
                </div>
                <div class="transaction-amount ${transaction.type}">
                    ${transaction.type === 'credit' ? '+' : '-'}₹${this.formatPrice(transaction.amount)}
                </div>
            </div>
        `).join('');
    }

    formatPrice(price) {
        return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    formatDate(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
        
        if (diffInDays === 0) {
            return 'Today';
        } else if (diffInDays === 1) {
            return 'Yesterday';
        } else if (diffInDays < 7) {
            return `${diffInDays} days ago`;
        } else {
            return date.toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short'
            });
        }
    }

    openAddMoneyModal() {
        const modal = document.getElementById('add-money-modal');
        const overlay = document.getElementById('modal-overlay');
        const modalState = document.getElementById('modal-state');
        if (modal) {
            modal.classList.add('active');
            modal.setAttribute('aria-hidden', 'false');
            if (overlay) {
                overlay.classList.add('active');
                overlay.setAttribute('aria-hidden', 'false');
            }

            // Reset form
            const customAmount = document.getElementById('add-amount');
            if (customAmount) { customAmount.value = ''; customAmount.focus(); this.clearFieldError('add-amount'); }
            
            // Clear selected preset
            document.querySelectorAll('.preset-amount').forEach(btn => {
                btn.classList.remove('selected');
            });
            
            // Set default payment method (use last used if available)
            const lastMethod = localStorage.getItem('flexy_last_payment_method');
            let defaultRadio = null;
            if (lastMethod) {
                defaultRadio = document.querySelector(`input[name="payment-method"][value="${lastMethod}"]`);
            }
            if (!defaultRadio) defaultRadio = document.querySelector('input[name="payment-method"][value="upi"]');
            if (defaultRadio) defaultRadio.checked = true;

            // Show last-used indicator
            this.clearLastUsedIndicators();
            if (lastMethod) this.addLastUsedIndicator(lastMethod);

            // Update and show modal state
            if (modalState) modalState.textContent = 'Open';

            // Announce for screen readers
            this.announce('Add money dialog opened');

            // Start focus trap
            this.trapFocus(modal);
        }
    }

    selectAmount(amount) {
        const customAmount = document.getElementById('add-amount');
        if (customAmount) {
            customAmount.value = amount;
        }
        
        // Update selected preset
        document.querySelectorAll('.preset-amount').forEach(btn => {
            btn.classList.remove('selected');
            if (parseInt(btn.dataset.amount) === amount) {
                btn.classList.add('selected');
            }
        });

        // Clear field error when a preset is chosen
        this.clearFieldError('add-amount');
    }

    processPayment() {
        // Defensive parsing of amount (allow commas/spaces)
        const customAmount = document.getElementById('add-amount');
        let raw = customAmount ? customAmount.value.toString().replace(/[,\s]/g, '') : '';
        const amount = raw ? parseInt(raw, 10) : 0;

        // Inline validation with field-level errors
        if (!amount || amount < 100) {
            this.showFieldError('add-amount', 'Minimum amount is ₹100');
            const el = document.getElementById('add-amount'); if (el) el.focus();
            return;
        }

        if (amount > 100000) {
            this.showFieldError('add-amount', 'Maximum amount is ₹100,000');
            const el = document.getElementById('add-amount'); if (el) el.focus();
            return;
        }

        // Get selected payment method
        const selectedMethod = document.querySelector('input[name="payment-method"]:checked');
        if (!selectedMethod) {
            this.showNotification('Please select a payment method', 'error');
            return;
        }

        // Ensure currentUser is loaded
        if (!this.currentUser) {
            this.loadUser();
            if (!this.currentUser) {
                this.showNotification('No user found. Please login again.', 'error');
                setTimeout(() => { window.location.href = 'login.html'; }, 800);
                return;
            }
        }

        // Clear field errors (if any)
        this.clearFieldError('add-amount');

        // Show processing
        const processBtn = document.getElementById('add-money-btn');
        if (processBtn) {
            processBtn.disabled = true;
            processBtn.innerHTML = '<div class="loading-spinner"></div>';
        }

        // Simulate method-specific processing
        const method = selectedMethod.value;

        // Visual processing state on method card
        this.setMethodProcessing(method, true);
        const modalState = document.getElementById('modal-state');
        if (modalState) modalState.textContent = 'Processing…';
        this.announce('Processing payment');

        switch (method) {
            case 'upi':
                this.simulateUPIFlow(amount, selectedMethod);
                break;
            case 'card':
                this.simulateCardFlow(amount, selectedMethod);
                break;
            case 'netbanking':
                this.simulateNetbankFlow(amount, selectedMethod);
                break;
            default:
                setTimeout(() => this.finalizeTopUp(amount, selectedMethod), 1000);
        }
    }

    addTransaction(transaction) {
        this.transactions.unshift(transaction);
        localStorage.setItem('flexy_transactions_' + this.currentUser.id, JSON.stringify(this.transactions));
    }

    /* Field-level error helpers */
    showFieldError(fieldId, message) {
        const el = document.getElementById(fieldId);
        const err = document.getElementById(fieldId + '-error');
        if (el) { el.classList.add('invalid'); el.setAttribute('aria-invalid', 'true'); }
        if (err) { err.textContent = message; err.classList.remove('shake'); void err.offsetWidth; err.classList.add('shake'); }
    }

    clearFieldError(fieldId) {
        const el = document.getElementById(fieldId);
        const err = document.getElementById(fieldId + '-error');
        if (el) { el.classList.remove('invalid'); el.setAttribute('aria-invalid', 'false'); }
        if (err) { err.textContent = ''; err.classList.remove('shake'); }
    }

    /* Focus trap for modals */
    trapFocus(modal) {
        this.releaseFocusTrap();
        if (!modal) return;
        this._activeModal = modal;
        const focusable = Array.from(modal.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
                              .filter(el => el.offsetParent !== null);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        this._trapHandler = (e) => {
            if (e.key !== 'Tab') return;
            if (e.shiftKey) {
                if (document.activeElement === first) { e.preventDefault(); last.focus(); }
            } else {
                if (document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        };
        document.addEventListener('keydown', this._trapHandler);
        first.focus();
    }

    releaseFocusTrap() {
        if (this._trapHandler) {
            document.removeEventListener('keydown', this._trapHandler);
            this._trapHandler = null;
        }
        this._activeModal = null;
    }

    // Accessibility announcer for screen readers
    announce(message) {
        const el = document.getElementById('modal-announce');
        if (el) {
            el.textContent = message;
            // Clear after brief delay to allow repeated announcements
            setTimeout(() => { el.textContent = ''; }, 1500);
        }
    }

    /* Visual helpers: set processing class on method card */
    setMethodProcessing(methodValue, active) {
        const input = document.querySelector(`input[name="payment-method"][value="${methodValue}"]`);
        if (!input) return;
        const label = input.closest('.method-option');
        if (!label) return;
        const card = label.querySelector('.method-card');
        if (!card) return;
        if (active) card.classList.add('processing'); else card.classList.remove('processing');

        const modalState = document.getElementById('modal-state');
        if (!active && modalState) modalState.textContent = 'Open';
    }

    addLastUsedIndicator(methodValue) {
        try {
            const input = document.querySelector(`input[name="payment-method"][value="${methodValue}"]`);
            if (!input) return;
            const card = input.closest('.method-option').querySelector('.method-card');
            if (!card) return;
            // remove existing to avoid duplicates
            const existing = card.querySelector('.last-used');
            if (existing) existing.remove();
            const span = document.createElement('span');
            span.className = 'last-used';
            span.textContent = 'Last used';
            card.appendChild(span);
        } catch (e) { /* ignore */ }
    }

    clearLastUsedIndicators() {
        document.querySelectorAll('.method-card .last-used').forEach(el => el.remove());
    }

    showMethodError(message) {
        const err = document.getElementById('payment-method-error');
        if (err) {
            err.textContent = message;
            err.classList.remove('shake'); void err.offsetWidth; err.classList.add('shake');
        }
        this.announce(message);
    }

    clearMethodError() {
        const err = document.getElementById('payment-method-error');
        if (err) { err.textContent = ''; err.classList.remove('shake'); }
    }

    // Simulate method-specific payment flows
    simulateUPIFlow(amount, selectedMethod) {
        const procBtn = document.getElementById('add-money-btn');
        this.showNotification('Processing UPI payment…', 'info');
        const success = Math.random() < 0.9;
        setTimeout(() => {
            if (success) {
                this.setMethodProcessing(selectedMethod.value, false);
                this.finalizeTopUp(amount, selectedMethod);
            } else {
                if (procBtn) { procBtn.disabled = false; procBtn.textContent = 'Add Money'; }
                this.setMethodProcessing(selectedMethod.value, false);
                this.showMethodError('UPI payment failed. Try again or choose another method.');
            }
        }, 1200);
    }

    simulateCardFlow(amount, selectedMethod) {
        const procBtn = document.getElementById('add-money-btn');
        this.showNotification('Processing card payment…', 'info');
        const success = Math.random() < 0.75;
        setTimeout(() => {
            if (success) {
                this.setMethodProcessing(selectedMethod.value, false);
                this.finalizeTopUp(amount, selectedMethod);
            } else {
                if (procBtn) { procBtn.disabled = false; procBtn.textContent = 'Add Money'; }
                this.setMethodProcessing(selectedMethod.value, false);
                this.showMethodError('Card was declined. Try a different card or method.');
            }
        }, 1400);
    }

    simulateNetbankFlow(amount, selectedMethod) {
        const procBtn = document.getElementById('add-money-btn');
        this.showNotification('Initiating bank transfer…', 'info');
        const success = Math.random() < 0.95;
        setTimeout(() => {
            if (success) {
                this.setMethodProcessing(selectedMethod.value, false);
                this.finalizeTopUp(amount, selectedMethod);
            } else {
                if (procBtn) { procBtn.disabled = false; procBtn.textContent = 'Add Money'; }
                this.setMethodProcessing(selectedMethod.value, false);
                this.showMethodError('Bank transfer failed. Please try again later.');
            }
        }, 2000);
    }

    finalizeTopUp(amount, selectedMethod) {
        // persist last used method
        try { localStorage.setItem('flexy_last_payment_method', selectedMethod.value); } catch (e) { /* ignore */ }

        // Add money to user balance and persist
        this.currentUser.balance = (this.currentUser.balance || 0) + amount;
        localStorage.setItem('flexy_user', JSON.stringify(this.currentUser));

        const txn = {
            id: 'txn_' + Date.now(),
            type: 'credit',
            amount: amount,
            description: `Money added via ${selectedMethod.value.toUpperCase()}`,
            method: selectedMethod.value,
            date: Date.now(),
            status: 'completed'
        };

        this.addTransaction(txn);

        const processBtn = document.getElementById('add-money-btn');
        if (processBtn) {
            processBtn.disabled = false;
            processBtn.textContent = 'Add Money';
        }

        // Clear processing visuals and mark last-used
        this.setMethodProcessing(selectedMethod.value, false);
        this.clearLastUsedIndicators();
        this.addLastUsedIndicator(selectedMethod.value);

        this.closeAllModals();

        this.renderBalance();
        this.renderTransactions();

        this.showNotification(`₹${this.formatPrice(amount)} added to wallet`, 'success');
        this.announce('Payment successful. Balance updated.');
    }

    handleAction(action) {
        switch(action) {
            case 'Add Money':
                this.openAddMoneyModal();
                break;
            case 'Withdraw':
                this.withdrawMoney();
                break;
            case 'Send':
                this.sendMoney();
                break;
            case 'Cards':
                this.viewCards();
                break;
        }
    }

    withdrawMoney() {
        const amount = prompt('Enter amount to withdraw:');
        if (!amount) return;
        
        const withdrawAmount = parseInt(amount);
        
        if (isNaN(withdrawAmount) || withdrawAmount < 100) {
            this.showNotification('Minimum withdrawal is ₹100', 'error');
            return;
        }
        
        if (withdrawAmount > this.currentUser.balance) {
            this.showNotification('Insufficient balance', 'error');
            return;
        }
        
        // Process withdrawal
        this.currentUser.balance -= withdrawAmount;
        localStorage.setItem('flexy_user', JSON.stringify(this.currentUser));
        
        // Record transaction
        this.addTransaction({
            id: 'txn_' + Date.now(),
            type: 'debit',
            amount: withdrawAmount,
            description: 'Withdrawal to bank account',
            method: 'bank_transfer',
            date: Date.now(),
            status: 'processing'
        });
        
        // Update display
        this.renderBalance();
        this.renderTransactions();
        
        this.showNotification(`Withdrawal request for ₹${this.formatPrice(withdrawAmount)} submitted`, 'success');
    }

    sendMoney() {
        const phone = prompt('Enter recipient phone number:');
        if (!phone || phone.length !== 10) {
            this.showNotification('Please enter a valid 10-digit phone number', 'error');
            return;
        }
        
        const amount = prompt('Enter amount to send:');
        if (!amount) return;
        
        const sendAmount = parseInt(amount);
        
        if (isNaN(sendAmount) || sendAmount < 1) {
            this.showNotification('Please enter a valid amount', 'error');
            return;
        }
        
        if (sendAmount > this.currentUser.balance) {
            this.showNotification('Insufficient balance', 'error');
            return;
        }
        
        const recipientName = prompt('Enter recipient name:');
        if (!recipientName) return;
        
        // Process send
        this.currentUser.balance -= sendAmount;
        localStorage.setItem('flexy_user', JSON.stringify(this.currentUser));
        
        // Record transaction
        this.addTransaction({
            id: 'txn_' + Date.now(),
            type: 'debit',
            amount: sendAmount,
            description: `Sent to ${recipientName} (${phone})`,
            method: 'wallet_transfer',
            date: Date.now(),
            status: 'completed'
        });
        
        // Update display
        this.renderBalance();
        this.renderTransactions();
        
        this.showNotification(`₹${this.formatPrice(sendAmount)} sent to ${recipientName}`, 'success');
    }

    viewCards() {
        const cards = JSON.parse(localStorage.getItem('flexy_user_cards_' + this.currentUser.id) || '[]');
        
        if (cards.length === 0) {
            notify('No cards saved. You can add a card when making a payment.', 'info');
        } else {
            const cardList = cards.map(card => 
                `• ${card.type.toUpperCase()} ****${card.last4} (Expires: ${card.expiry})`
            ).join('\n');
            
            notify(`Your Saved Cards:\n\n${cardList.replace(/\n/g, ' \u2022 ')}`, 'info');
        }
    }

    showAllTransactions() {
        if (this.transactions.length === 0) {
            this.showNotification('No transactions to show', 'info');
            return;
        }
        
        const transactionDetails = this.transactions.map((txn, index) => {
            return `${index + 1}. ${this.formatDate(txn.date)}: ${txn.description} - ${txn.type === 'credit' ? '+' : '-'}₹${this.formatPrice(txn.amount)}`;
        }).join('\n');
        
        // notify as fallback
        notify(`All Transactions:\n\n${transactionDetails.replace(/\n/g, ' \u2022 ')}`, 'info');
    }

    // Modal-based transaction viewer
    showTransactionsModal() {
        this.loadTransactions();
        const container = document.getElementById('transactions-modal-list'); if (!container) return;
        if (this.transactions.length === 0) {
            container.innerHTML = `<div class="empty-state"><h4>No transactions yet</h4><p>Your transaction history will appear here.</p></div>`;
        } else {
            container.innerHTML = this.transactions.map(txn => `
                <div class="txn-row" data-txn-id="${txn.id}" onclick="wallet.showTransactionDetail('${txn.id}')">
                    <div>
                        <div class="txn-desc">${txn.description}</div>
                        <div class="muted">${this.formatDate(txn.date)} • ${txn.method || '—'}</div>
                    </div>
                    <div class="txn-amt ${txn.type}">${txn.type === 'credit' ? '+' : '-'}₹${this.formatPrice(txn.amount)}</div>
                </div>
            `).join('');
        }
        const modal = document.getElementById('transactions-modal'); if (modal) { modal.classList.add('active'); modal.setAttribute('aria-hidden','false'); document.getElementById('modal-overlay').classList.add('active'); }
    }

    showTransactionDetail(txnId) {
        const txn = this.transactions.find(t => t.id === txnId);
        if (!txn) return;
        const msg = `${txn.description}\n\nAmount: ${txn.type === 'credit' ? '+' : '-'}₹${this.formatPrice(txn.amount)}\nDate: ${new Date(txn.date).toLocaleString()}\nStatus: ${txn.status || '—'}`;
        notify(msg, 'info');
    }

    exportTransactions(format = 'json') {
        if (!this.transactions || !this.transactions.length) { this.showNotification('No transactions to export', 'info'); return; }
        const filenameBase = `transactions_${this.currentUser.id}_${new Date().toISOString().slice(0,10)}`;
        if (format === 'json') {
            const blob = new Blob([JSON.stringify(this.transactions, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filenameBase + '.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); this.showNotification('Exported transactions (JSON)', 'success'); return;
        }
        const rows = [['id','type','amount','description','date','status','method']];
        this.transactions.forEach(t => rows.push([`"${t.id}"`, t.type, t.amount, `"${(t.description||'').replace(/"/g,'""')}"`, new Date(t.date).toLocaleString(), t.status || '', t.method || '']));
        const csv = rows.map(r => r.join(',')).join('\n'); const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filenameBase + '.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); this.showNotification('Exported transactions (CSV)', 'success');
    }

    refreshBalance() {
        // Simulate API call to refresh balance
        const refreshBtn = document.querySelector('[onclick="refreshBalance()"]');
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '<div class="loading-spinner"></div>';
        }
        
        setTimeout(() => {
            // Just re-render current balance (in real app, this would fetch from server)
            this.renderBalance();
            
            if (refreshBtn) {
                refreshBtn.disabled = false;
                refreshBtn.innerHTML = `
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M23 4V10H17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M1 20V14H7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M3.51 9C4.01717 7.56678 4.87913 6.2854 6.01547 5.27542C7.1518 4.26543 8.52547 3.55976 10.0083 3.22426C11.4911 2.88875 13.0348 2.93434 14.4952 3.35677C15.9556 3.77921 17.2853 4.56471 18.36 5.64L23 10M1 14L5.64 18.36C6.71475 19.4353 8.04437 20.2208 9.50481 20.6432C10.9652 21.0657 12.5089 21.1113 13.9917 20.7757C15.4745 20.4402 16.8482 19.7346 17.9845 18.7246C19.1209 17.7146 19.9828 16.4332 20.49 15" 
                              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                `;
            }
            
            this.showNotification('Balance refreshed', 'success');
        }, 1000);
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
            modal.setAttribute('aria-hidden', 'true');
        });
        const overlay = document.getElementById('modal-overlay');
        if (overlay) {
            overlay.classList.remove('active');
            overlay.setAttribute('aria-hidden', 'true');
        }
        // release focus trap
        this.releaseFocusTrap();
        // return focus to a sensible control
        const firstHeaderBtn = document.querySelector('.header-btn, .back-btn, .btn');
        if (firstHeaderBtn) firstHeaderBtn.focus();
    }

    showNotification(message, type = 'info') {
        notify(message, type);
    }
}

// Initialize wallet
const wallet = new Wallet();

// Global functions for HTML onclick handlers
function addMoney() {
    wallet.openAddMoneyModal();
}

function withdrawMoney() {
    wallet.withdrawMoney();
}

function sendMoney() {
    wallet.sendMoney();
}

function viewCards() {
    wallet.viewCards();
}

function showAllTransactions() {
    wallet.showAllTransactions();
}

function refreshBalance() {
    wallet.refreshBalance();
}

function processPayment() {
    wallet.processPayment();
}

function showTransactions() {
    wallet.showTransactionsModal();
}