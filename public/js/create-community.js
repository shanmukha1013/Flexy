// create-community.js - Wizard Logic

class CreateCommunityApp {
    constructor() {
        this.currentStep = 1;
        this.totalSteps = 3;
        this.selectedGroups = new Set();
        this.userGroups = [];
        this.currentUser = JSON.parse(localStorage.getItem('flexy_user') || 'null');
        
        this.init();
    }

    init() {
        if (!this.currentUser) {
            window.location.href = 'login.html';
            return;
        }
        window.ccApp = this;
    }

    async loadUserGroups() {
        const list = document.getElementById('groups-list');
        list.innerHTML = `<div style="text-align: center; padding: 2rem;">Loading your groups...</div>`;
        try {
            const groups = await api.get(`/groups/user/${this.currentUser.id || this.currentUser._id}`);
            this.userGroups = groups || [];
            
            // Only show groups that are NOT already in a community
            const unassigned = this.userGroups.filter(g => !g.community);

            if (unassigned.length === 0) {
                list.innerHTML = `
                    <div style="text-align: center; padding: 2rem; color: var(--text-muted); border: 1px dashed var(--border-glass); border-radius: var(--radius-sm);">
                        You don't have any standalone groups.<br>
                        <button class="btn btn-outline" style="margin-top: 1rem;" onclick="window.location.href='create-group.html'">Create a Group</button>
                    </div>`;
                return;
            }

            list.innerHTML = unassigned.map(g => `
                <div class="group-select-card" id="group-card-${g._id}" onclick="ccApp.toggleGroup('${g._id}')">
                    <div>
                        <h4 style="margin: 0 0 0.2rem 0;">${g.name}</h4>
                        <div style="font-size: 0.8rem; color: var(--text-muted);">${g.members ? g.members.length : 1} Members</div>
                    </div>
                    <div class="checkbox-circle" style="width: 20px; height: 20px; border: 2px solid var(--border-glass); border-radius: 50%; display: flex; align-items: center; justify-content: center;"></div>
                </div>
            `).join('');
        } catch (err) {
            list.innerHTML = `<div style="color: var(--danger); padding: 1rem;">Failed to load groups.</div>`;
        }
    }

    toggleGroup(id) {
        const card = document.getElementById(`group-card-${id}`);
        const checkbox = card.querySelector('.checkbox-circle');
        if (this.selectedGroups.has(id)) {
            this.selectedGroups.delete(id);
            card.classList.remove('selected');
            checkbox.innerHTML = '';
            checkbox.style.borderColor = 'var(--border-glass)';
            checkbox.style.background = 'transparent';
        } else {
            this.selectedGroups.add(id);
            card.classList.add('selected');
            checkbox.innerHTML = '✓';
            checkbox.style.borderColor = 'var(--primary)';
            checkbox.style.background = 'var(--primary)';
            checkbox.style.color = 'var(--black)';
            checkbox.style.fontSize = '12px';
            checkbox.style.fontWeight = 'bold';
        }
    }

    validateStep1() {
        const name = document.getElementById('comm-name').value;
        const desc = document.getElementById('comm-desc').value;
        if (!name || !desc) {
            notify('Please fill out all required fields.', 'warning');
            return false;
        }
        return true;
    }

    validateStep2() {
        if (this.selectedGroups.size === 0) {
            notify('You must select at least one group.', 'warning');
            return false;
        }
        return true;
    }

    updateReview() {
        document.getElementById('review-icon').textContent = document.getElementById('comm-icon').value || '🏛️';
        document.getElementById('review-name').textContent = document.getElementById('comm-name').value;
        document.getElementById('review-desc').textContent = document.getElementById('comm-desc').value;
        document.getElementById('review-groups-count').textContent = `${this.selectedGroups.size} Group(s) Selected`;
    }

    nextStep() {
        if (this.currentStep === 1) {
            if (!this.validateStep1()) return;
            this.loadUserGroups(); // Load groups when entering step 2
        }
        if (this.currentStep === 2) {
            if (!this.validateStep2()) return;
            this.updateReview();
        }

        if (this.currentStep < this.totalSteps) {
            document.getElementById(`step-${this.currentStep}`).classList.remove('active');
            document.getElementById(`step-${this.currentStep}-indicator`).classList.replace('active', 'completed');
            
            this.currentStep++;
            
            document.getElementById(`step-${this.currentStep}`).classList.add('active');
            document.getElementById(`step-${this.currentStep}-indicator`).classList.add('active');
            
            this.updateButtons();
        }
    }

    prevStep() {
        if (this.currentStep > 1) {
            document.getElementById(`step-${this.currentStep}`).classList.remove('active');
            document.getElementById(`step-${this.currentStep}-indicator`).classList.remove('active');
            
            this.currentStep--;
            
            document.getElementById(`step-${this.currentStep}`).classList.add('active');
            document.getElementById(`step-${this.currentStep}-indicator`).classList.replace('completed', 'active');
            
            this.updateButtons();
        }
    }

    updateButtons() {
        const btnBack = document.getElementById('btn-back');
        const btnNext = document.getElementById('btn-next');
        const btnSubmit = document.getElementById('btn-submit');

        btnBack.style.display = this.currentStep === 1 ? 'none' : 'block';
        
        if (this.currentStep === this.totalSteps) {
            btnNext.style.display = 'none';
            btnSubmit.style.display = 'block';
        } else {
            btnNext.style.display = 'block';
            btnSubmit.style.display = 'none';
        }
    }

    async submit() {
        const btn = document.getElementById('btn-submit');
        btn.disabled = true;
        btn.textContent = 'Creating...';

        const data = {
            name: document.getElementById('comm-name').value,
            description: document.getElementById('comm-desc').value,
            icon: document.getElementById('comm-icon').value || '🏛️',
            groups: Array.from(this.selectedGroups)
        };

        try {
            const res = await api.post('/communities', data);
            notify('Community created successfully!', 'success');
            setTimeout(() => {
                window.location.href = `community.html?id=${res._id}`;
            }, 1500);
        } catch (err) {
            notify(err.message, 'error');
            btn.disabled = false;
            btn.textContent = 'Create Community';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new CreateCommunityApp();
});
