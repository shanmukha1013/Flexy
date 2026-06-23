// sell.js - Multi-step Auction Wizard

class SellApp {
    constructor() {
        this.currentUser = JSON.parse(localStorage.getItem('flexy_user') || 'null');
        this.currentStep = 1;
        this.totalSteps = 4;
        this.images = [];
        this.auctionType = 'Standard';
        
        this.init();
    }

    init() {
        if (!this.currentUser) {
            window.location.href = 'login.html';
            return;
        }
        window.sellApp = this;
    }

    handleFileUpload(event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const grid = document.getElementById('photo-preview-grid');
        
        for (let file of files) {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.images.push(e.target.result);
                const div = document.createElement('div');
                div.className = 'photo-preview';
                div.style.backgroundImage = `url('${e.target.result}')`;
                
                // Add delete button overlay
                const delBtn = document.createElement('div');
                delBtn.innerHTML = '×';
                delBtn.style.cssText = 'position: absolute; top: -5px; right: -5px; background: var(--danger); color: white; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; font-weight: bold; font-size: 12px;';
                delBtn.onclick = (e) => {
                    e.stopPropagation();
                    const idx = this.images.indexOf(reader.result);
                    if (idx > -1) this.images.splice(idx, 1);
                    div.remove();
                };
                
                div.appendChild(delBtn);
                grid.appendChild(div);
            };
            reader.readAsDataURL(file);
        }
    }

    selectType(type) {
        this.auctionType = type;
        document.querySelectorAll('.auction-type-card').forEach(card => card.classList.remove('selected'));
        const target = Array.from(document.querySelectorAll('.auction-type-card')).find(c => c.textContent.includes(type));
        if (target) target.classList.add('selected');

        const reserveGroup = document.getElementById('reserve-price-group');
        const durationGroup = document.getElementById('duration-group');
        
        if (type === 'Reserve') {
            reserveGroup.style.display = 'block';
        } else {
            reserveGroup.style.display = 'none';
        }
        
        if (type === 'Flash') {
            document.getElementById('duration').value = "1";
        }
    }

    validateStep1() {
        if (this.images.length === 0) {
            notify('Please upload at least one photo.', 'warning');
            return false;
        }
        if (!document.getElementById('title').value) {
            notify('Title is required', 'warning');
            return false;
        }
        if (!document.getElementById('category').value) {
            notify('Category is required', 'warning');
            return false;
        }
        if (!document.getElementById('description').value) {
            notify('Description is required', 'warning');
            return false;
        }
        return true;
    }

    validateStep2() {
        // All fields are optional but we can add validation here if needed
        return true;
    }

    validateStep3() {
        const startingBid = document.getElementById('startingBid').value;
        if (!startingBid || startingBid < 1) {
            notify('Valid starting bid is required', 'warning');
            return false;
        }
        
        if (this.auctionType === 'Reserve') {
            const reserve = document.getElementById('reservePrice').value;
            if (!reserve || Number(reserve) <= Number(startingBid)) {
                notify('Reserve price must be higher than starting bid', 'warning');
                return false;
            }
        }
        return true;
    }

    updateReview() {
        document.getElementById('review-image').style.backgroundImage = `url('${this.images[0]}')`;
        document.getElementById('review-title').textContent = document.getElementById('title').value;
        document.getElementById('review-category').textContent = document.getElementById('category').value;
        document.getElementById('review-condition').textContent = document.getElementById('condition').value || 'Not specified';
        document.getElementById('review-rarity').textContent = document.getElementById('rarity').value || 'Not specified';
        document.getElementById('review-type').textContent = this.auctionType;
        document.getElementById('review-bid').textContent = document.getElementById('startingBid').value;
    }

    nextStep() {
        if (this.currentStep === 1 && !this.validateStep1()) return;
        if (this.currentStep === 2 && !this.validateStep2()) return;
        if (this.currentStep === 3) {
            if (!this.validateStep3()) return;
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

    async submitAuction() {
        const btn = document.getElementById('btn-submit');
        btn.textContent = 'Launching...';
        btn.disabled = true;

        const data = {
            title: document.getElementById('title').value,
            description: document.getElementById('description').value,
            category: document.getElementById('category').value,
            images: this.images,
            origin: document.getElementById('origin').value,
            year: document.getElementById('year').value,
            condition: document.getElementById('condition').value,
            rarity: document.getElementById('rarity').value,
            estimatedValue: document.getElementById('estimatedValue').value,
            authenticityDocs: document.getElementById('authenticityDocs').value,
            auctionType: this.auctionType,
            sellerId: this.currentUser.id || this.currentUser._id,
            startingBid: document.getElementById('startingBid').value,
            reservePrice: document.getElementById('reservePrice').value,
            durationHours: Number(document.getElementById('duration').value) * 24
        };

        try {
            const res = await api.post('/auctions', data);
            notify('Auction launched successfully!', 'success');
            setTimeout(() => {
                window.location.href = `item.html?id=${res._id}`;
            }, 1500);
        } catch (err) {
            notify(err.message, 'error');
            btn.textContent = 'Launch Auction';
            btn.disabled = false;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new SellApp();
});