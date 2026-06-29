// sell.js - Sell Item Functionality

class Sell {
    constructor() {
        this.currentStep = 1;
        this.itemData = {
            title: '',
            category: '',
            condition: '',
            description: '',
            price: 0,
            priceType: 'fixed',
            location: '',
            shippingOptions: {
                pickup: false,
                delivery: false,
                shippable: false
            },
            images: [],
            auctionSettings: {
                startingBid: 0,
                bidIncrement: 50,
                duration: 3 // days
            }
        };
        this.init();
    }

    init() {
        // Check authentication
        this.checkAuth();
        
        // Load user
        this.loadUser();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Initialize form
        this.initForm();
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
            
            // Set default location from user profile if available
            if (!this.itemData.location && this.currentUser.phone) {
                // Simple location based on phone area code
                const areaCode = this.currentUser.phone.substring(0, 3);
                const cities = {
                    '911': 'Delhi',
                    '912': 'Mumbai',
                    '913': 'Kolkata',
                    '914': 'Chennai',
                    '915': 'Bangalore',
                    '916': 'Hyderabad',
                    '917': 'Pune',
                    '918': 'Ahmedabad'
                };
                this.itemData.location = cities[areaCode] || 'Your City';
            }
        }
    }

    setupEventListeners() {
        // Step navigation
        this.setupStepNavigation();
        
        // Form inputs
        this.setupFormInputs();
        
        // Photo upload
        this.setupPhotoUpload();
        
        // Price type change
        this.setupPriceTypeToggle();
        
        // Form submission
        const sellForm = document.getElementById('sell-form');
        if (sellForm) {
            sellForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.publishItem();
            });
        }
        
        // Save draft button
        const saveDraftBtn = document.querySelector('[onclick="saveDraft()"]');
        if (saveDraftBtn) {
            saveDraftBtn.addEventListener('click', () => this.saveDraft());
        }
    }

    setupStepNavigation() {
        // Next step buttons
        document.querySelectorAll('[onclick^="nextStep"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const match = e.target.closest('[onclick]').getAttribute('onclick').match(/nextStep\((\d+)\)/);
                if (match) {
                    const step = parseInt(match[1]);
                    this.nextStep(step);
                }
            });
        });
        
        // Previous step buttons
        document.querySelectorAll('[onclick^="prevStep"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const match = e.target.closest('[onclick]').getAttribute('onclick').match(/prevStep\((\d+)\)/);
                if (match) {
                    const step = parseInt(match[1]);
                    this.prevStep(step);
                }
            });
        });
    }

    setupFormInputs() {
        // Title input
        const titleInput = document.getElementById('item-title');
        if (titleInput) {
            titleInput.addEventListener('input', (e) => {
                this.itemData.title = e.target.value;
                this.updateReview();
            });
        }
        
        // Category select
        const categorySelect = document.getElementById('item-category');
        if (categorySelect) {
            categorySelect.addEventListener('change', (e) => {
                this.itemData.category = e.target.value;
                this.updateReview();
            });
        }
        
        // Condition radios
        document.querySelectorAll('input[name="condition"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.itemData.condition = e.target.value;
                this.updateReview();
            });
        });
        
        // Description textarea
        const descriptionTextarea = document.getElementById('item-description');
        if (descriptionTextarea) {
            descriptionTextarea.addEventListener('input', (e) => {
                this.itemData.description = e.target.value;
                this.updateReview();
            });
        }
        
        // Price input
        const priceInput = document.getElementById('item-price');
        if (priceInput) {
            priceInput.addEventListener('input', (e) => {
                this.itemData.price = parseInt(e.target.value) || 0;
                this.updateReview();
            });
        }
        
        // Price type radios
        document.querySelectorAll('input[name="price-type"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.itemData.priceType = e.target.value;
                this.updateReview();
                this.toggleAuctionSettings();
            });
        });
        
        // Location input
        const locationInput = document.getElementById('item-location');
        if (locationInput) {
            locationInput.addEventListener('input', (e) => {
                this.itemData.location = e.target.value;
                this.updateReview();
            });
        }
        
        // Shipping options
        document.querySelectorAll('.shipping-option input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const option = e.target.id.replace('shipping-', '');
                this.itemData.shippingOptions[option] = e.target.checked;
            });
        });
        
        // Auction settings
        const startingBid = document.getElementById('starting-bid');
        if (startingBid) {
            startingBid.addEventListener('input', (e) => {
                this.itemData.auctionSettings.startingBid = parseInt(e.target.value) || 0;
            });
        }
        
        const bidIncrement = document.getElementById('bid-increment');
        if (bidIncrement) {
            bidIncrement.addEventListener('change', (e) => {
                this.itemData.auctionSettings.bidIncrement = parseInt(e.target.value) || 50;
            });
        }
        
        const auctionDuration = document.getElementById('auction-duration');
        if (auctionDuration) {
            auctionDuration.addEventListener('change', (e) => {
                this.itemData.auctionSettings.duration = parseInt(e.target.value) || 3;
            });
        }
    }

    setupPhotoUpload() {
        const dropzone = document.getElementById('photo-dropzone');
        const fileInput = document.getElementById('photo-upload');
        const preview = document.getElementById('photo-preview');
        
        if (dropzone && fileInput) {
            // Click to upload
            dropzone.addEventListener('click', () => {
                fileInput.click();
            });
            
            // Drag and drop
            dropzone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropzone.style.borderColor = 'var(--primary)';
                dropzone.style.background = 'var(--surface)';
            });
            
            dropzone.addEventListener('dragleave', () => {
                dropzone.style.borderColor = '';
                dropzone.style.background = '';
            });
            
            dropzone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropzone.style.borderColor = '';
                dropzone.style.background = '';
                
                const files = e.dataTransfer.files;
                this.handleFiles(files);
            });
            
            // File input change
            fileInput.addEventListener('change', (e) => {
                const files = e.target.files;
                this.handleFiles(files);
            });
        }
    }

    setupPriceTypeToggle() {
        const auctionRadios = document.querySelectorAll('input[name="price-type"][value="auction"]');
        auctionRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.toggleAuctionSettings();
            });
        });
    }

    initForm() {
        // Load draft if exists
        this.loadDraft();

        // Load edit item if present
        const editStr = localStorage.getItem('flexy_edit_item');
        if (editStr) {
            try {
                const editItem = JSON.parse(editStr);
                this.itemData = Object.assign({}, this.itemData, editItem);
                this.editItemId = editItem.id;
                this.showNotification('Editing existing item - changes will update the listing', 'info');
                // Pre-fill form fields will be handled by loadDraft-like updates
                const titleInput = document.getElementById('item-title'); if (titleInput) titleInput.value = this.itemData.title || '';
                const categorySelect = document.getElementById('item-category'); if (categorySelect) categorySelect.value = this.itemData.category || '';
                if (this.itemData.condition) {
                    const conditionRadio = document.querySelector(`input[name="condition"][value="${this.itemData.condition}"]`);
                    if (conditionRadio) conditionRadio.checked = true;
                }
                const descriptionTextarea = document.getElementById('item-description'); if (descriptionTextarea) descriptionTextarea.value = this.itemData.description || '';
                const priceInput = document.getElementById('item-price'); if (priceInput) priceInput.value = this.itemData.price || 0;
                if (this.itemData.priceType) {
                    const priceTypeRadio = document.querySelector(`input[name="price-type"][value="${this.itemData.priceType}"]`);
                    if (priceTypeRadio) priceTypeRadio.checked = true;
                }
                const locationInput = document.getElementById('item-location'); if (locationInput) locationInput.value = this.itemData.location || '';
                this.updatePhotoPreview();
            } catch (e) {
                console.error('Invalid edit item data');
            }
            // Remove edit slot so it doesn't persist if user cancels
            localStorage.removeItem('flexy_edit_item');
        }
        
        // Show first step
        this.showStep(1);
    }

    showStep(step) {
        // Hide all steps
        document.querySelectorAll('.form-step').forEach(stepEl => {
            stepEl.classList.remove('active');
        });
        
        // Show current step
        const currentStep = document.getElementById(`step-${step}`);
        if (currentStep) {
            currentStep.classList.add('active');
        }
        
        // Update step indicator
        document.querySelectorAll('.step').forEach(stepEl => {
            stepEl.classList.remove('active');
            if (parseInt(stepEl.dataset.step) === step) {
                stepEl.classList.add('active');
            }
        });
        
        this.currentStep = step;
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    nextStep(targetStep) {
        // Validate current step before proceeding
        if (!this.validateStep(this.currentStep)) {
            return;
        }
        
        this.showStep(targetStep);
        
        // If going to review step, update review
        if (targetStep === 4) {
            this.updateReview();
        }
    }

    prevStep(targetStep) {
        this.showStep(targetStep);
    }

    validateStep(step) {
        switch(step) {
            case 1: // Basic details
                if (!this.itemData.title || this.itemData.title.length < 10) {
                    this.showNotification('Please enter a descriptive title (min 10 characters)', 'error');
                    return false;
                }
                if (!this.itemData.category) {
                    this.showNotification('Please select a category', 'error');
                    return false;
                }
                if (!this.itemData.condition) {
                    this.showNotification('Please select item condition', 'error');
                    return false;
                }
                if (!this.itemData.description || this.itemData.description.length < 50) {
                    this.showNotification('Please enter a detailed description (min 50 characters)', 'error');
                    return false;
                }
                return true;
                
            case 2: // Photos
                if (this.itemData.images.length === 0) {
                    this.showNotification('Please add at least one photo', 'error');
                    return false;
                }
                return true;
                
            case 3: // Pricing
                if (!this.itemData.price || this.itemData.price < 1) {
                    this.showNotification('Please enter a valid price', 'error');
                    return false;
                }
                if (!this.itemData.location) {
                    this.showNotification('Please enter your location', 'error');
                    return false;
                }
                return true;
                
            default:
                return true;
        }
    }

    async handleFiles(files) {
        const preview = document.getElementById('photo-preview');
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            // Check file type
            if (!file.type.startsWith('image/')) {
                this.showNotification('Please upload only image files', 'error');
                continue;
            }

            // Check max images
            if (this.itemData.images.length >= 10) {
                this.showNotification('Maximum 10 photos allowed', 'error');
                break;
            }

            try {
                // Compress image
                let dataUrl = await utils.compressImage(file, 1400, 0.8);
                // Approximate size check (bytes)
                const approxBytes = Math.ceil((dataUrl.length - (dataUrl.indexOf(',') + 1)) * 3 / 4);
                if (approxBytes > 5 * 1024 * 1024) {
                    // try lower quality
                    dataUrl = await utils.compressImage(file, 1200, 0.7);
                }
                // If still large, warn and skip
                const finalBytes = Math.ceil((dataUrl.length - (dataUrl.indexOf(',') + 1)) * 3 / 4);
                if (finalBytes > 6 * 1024 * 1024) { this.showNotification('Image too large after compression', 'error'); continue; }

                this.itemData.images.push(dataUrl);
                this.updatePhotoPreview();
            } catch (e) {
                console.error('image compression failed', e);
                this.showNotification('Image processing failed', 'error');
            }
        }
    }

    movePhoto(index, dir) {
        const to = index + dir;
        if (to < 0 || to >= this.itemData.images.length) return;
        const imgs = this.itemData.images;
        const [m] = imgs.splice(index, 1);
        imgs.splice(to, 0, m);
        this.updatePhotoPreview();
    }

    updatePhotoPreview() {
        const preview = document.getElementById('photo-preview');
        if (!preview) return;
        
        preview.innerHTML = this.itemData.images.map((image, index) => `
            <div class="photo-preview-item" data-index="${index}" draggable="true">
                <img src="${image}" alt="Item photo ${index + 1}">
                <div class="photo-controls">
                    <button class="btn btn-sm" onclick="sell.movePhoto(${index}, -1)" title="Move left">◀</button>
                    <button class="btn btn-sm" onclick="sell.movePhoto(${index}, 1)" title="Move right">▶</button>
                </div>
                <button class="remove-photo" onclick="sell.removePhoto(${index})">
                    ×
                </button>
            </div>
        `).join('');
        
        // Show/hint for adding more photos
        if (this.itemData.images.length < 10) {
            preview.innerHTML += `
                <div class="photo-preview-item add-more" onclick="document.getElementById('photo-upload').click()">
                    <div class="add-more-icon">+</div>
                    <div class="add-more-text">Add More</div>
                </div>
            `;
        }

        // attach drag handlers
        preview.querySelectorAll('.photo-preview-item[draggable="true"]').forEach(el => {
            el.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', el.dataset.index);
                el.classList.add('dragging');
            });
            el.addEventListener('dragend', () => el.classList.remove('dragging'));
            el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('drag-over'); });
            el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
            el.addEventListener('drop', (e) => {
                e.preventDefault(); el.classList.remove('drag-over');
                const src = parseInt(e.dataTransfer.getData('text/plain'));
                const tgt = parseInt(el.dataset.index);
                if (!isNaN(src) && !isNaN(tgt)) {
                    const imgs = this.itemData.images;
                    const [m] = imgs.splice(src, 1);
                    imgs.splice(tgt, 0, m);
                    this.updatePhotoPreview();
                }
            });
        });
    }

    updatePhotoPreview() {
        const preview = document.getElementById('photo-preview');
        if (!preview) return;
        
        preview.innerHTML = this.itemData.images.map((image, index) => `
            <div class="photo-preview-item">
                <img src="${image}" alt="Item photo ${index + 1}">
                <button class="remove-photo" onclick="sell.removePhoto(${index})">
                    ×
                </button>
            </div>
        `).join('');
        
        // Show/hint for adding more photos
        if (this.itemData.images.length > 0) {
            preview.innerHTML += `
                <div class="photo-preview-item add-more" onclick="document.getElementById('photo-upload').click()">
                    <div class="add-more-icon">+</div>
                    <div class="add-more-text">Add More</div>
                </div>
            `;
        }
    }

    removePhoto(index) {
        this.itemData.images.splice(index, 1);
        this.updatePhotoPreview();
    }

    toggleAuctionSettings() {
        const auctionSettings = document.getElementById('auction-settings');
        if (auctionSettings) {
            auctionSettings.style.display = this.itemData.priceType === 'auction' ? 'block' : 'none';
        }
    }

    updateReview() {
        // Update review section with current data
        document.getElementById('review-title').textContent = this.itemData.title || '-';
        document.getElementById('review-category').textContent = this.getCategoryName(this.itemData.category) || '-';
        document.getElementById('review-condition').textContent = this.formatCondition(this.itemData.condition) || '-';
        document.getElementById('review-price').textContent = this.itemData.price ? `₹${this.formatPrice(this.itemData.price)} (${this.itemData.priceType})` : '-';
        document.getElementById('review-location').textContent = this.itemData.location || '-';
        document.getElementById('review-description').textContent = this.itemData.description ? 
            (this.itemData.description.length > 100 ? this.itemData.description.substring(0, 100) + '...' : this.itemData.description) : '-';
    }

    getCategoryName(categoryId) {
        const categories = {
            'electronics': 'Electronics',
            'fashion': 'Fashion',
            'home': 'Home & Garden',
            'sports': 'Sports & Outdoors',
            'vehicles': 'Vehicles',
            'books': 'Books & Media',
            'other': 'Other'
        };
        return categories[categoryId] || categoryId;
    }

    formatCondition(condition) {
        const conditions = {
            'new': 'New',
            'like-new': 'Like New',
            'good': 'Good',
            'fair': 'Fair'
        };
        return conditions[condition] || condition;
    }

    formatPrice(price) {
        return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    saveDraft() {
        // Save to localStorage
        localStorage.setItem('flexy_item_draft', JSON.stringify(this.itemData));
        this.showNotification('Draft saved successfully', 'success');
    }

    loadDraft() {
        const draft = localStorage.getItem('flexy_item_draft');
        if (draft) {
            this.itemData = JSON.parse(draft);
            
            // Update form fields
            const titleInput = document.getElementById('item-title');
            if (titleInput) titleInput.value = this.itemData.title;
            
            const categorySelect = document.getElementById('item-category');
            if (categorySelect) categorySelect.value = this.itemData.category;
            
            // Set condition radio
            if (this.itemData.condition) {
                const conditionRadio = document.querySelector(`input[name="condition"][value="${this.itemData.condition}"]`);
                if (conditionRadio) conditionRadio.checked = true;
            }
            
            const descriptionTextarea = document.getElementById('item-description');
            if (descriptionTextarea) descriptionTextarea.value = this.itemData.description;
            
            const priceInput = document.getElementById('item-price');
            if (priceInput) priceInput.value = this.itemData.price;
            
            // Set price type radio
            if (this.itemData.priceType) {
                const priceTypeRadio = document.querySelector(`input[name="price-type"][value="${this.itemData.priceType}"]`);
                if (priceTypeRadio) priceTypeRadio.checked = true;
            }
            
            const locationInput = document.getElementById('item-location');
            if (locationInput) locationInput.value = this.itemData.location;
            
            // Set shipping checkboxes
            Object.keys(this.itemData.shippingOptions || {}).forEach(option => {
                const checkbox = document.getElementById(`shipping-${option}`);
                if (checkbox) checkbox.checked = this.itemData.shippingOptions[option];
            });
            
            // Update photo preview
            this.updatePhotoPreview();
            this.toggleAuctionSettings();
            
            this.showNotification('Draft loaded', 'info');
        }
    }

    publishItem() {
        // Validate all steps
        for (let i = 1; i <= 3; i++) {
            if (!this.validateStep(i)) {
                this.showStep(i);
                return;
            }
        }
        
        // Check terms agreement
        const termsCheckbox = document.getElementById('agree-terms');
        if (!termsCheckbox || !termsCheckbox.checked) {
            this.showNotification('Please agree to the Terms of Service', 'error');
            return;
        }
        
        // Show loading
        const publishBtn = document.querySelector('#step-4 button[type="submit"]');
        const publishText = document.getElementById('publish-text');
        const publishLoading = document.getElementById('publish-loading');
        
        if (publishBtn && publishText && publishLoading) {
            publishText.style.display = 'none';
            publishLoading.style.display = 'block';
            publishBtn.disabled = true;
        }
        
        // Simulate API call
        setTimeout(() => {
            this.saveItem();
            
            // Hide loading
            if (publishBtn && publishText && publishLoading) {
                publishText.style.display = 'block';
                publishLoading.style.display = 'none';
                publishBtn.disabled = false;
            }
            
            this.showNotification(this.editItemId ? 'Item updated successfully!' : 'Item published successfully!', 'success');
            
            // Clear draft and edit slot
            localStorage.removeItem('flexy_item_draft');
            localStorage.removeItem('flexy_edit_item');
            
            // Redirect to home after 1 second
            setTimeout(() => {
                window.location.href = 'home.html';
            }, 1000);
        }, 2000);
    }

    saveItem() {
        // Create item object
        const now = Date.now();
        
        const itemPayload = {
            title: this.itemData.title,
            description: this.itemData.description,
            price: this.itemData.price,
            originalPrice: this.itemData.price,
            category: this.itemData.category,
            condition: this.itemData.condition,
            sellerId: this.currentUser?.id || 'unknown',
            sellerName: this.currentUser?.name || 'Unknown Seller',
            sellerRating: 0.0,
            location: this.itemData.location,
            images: this.itemData.images,
            // keep existing bids/time if updating
            timeRemaining: this.itemData.priceType === 'auction' ? this.itemData.auctionSettings.duration * 86400 : 604800,
            featured: this.editItemId ? undefined : (Math.random() > 0.5),
            tags: this.extractTags(this.itemData.description),
            shippingOptions: this.itemData.shippingOptions,
            priceType: this.itemData.priceType,
            auctionSettings: this.itemData.priceType === 'auction' ? this.itemData.auctionSettings : null,
            expired: false,
            sold: false
        };
        
        // Load existing items
        const existingItems = JSON.parse(localStorage.getItem('flexy_items') || '[]');
        
        if (this.editItemId) {
            // Update the existing item
            const idx = existingItems.findIndex(i => i.id === this.editItemId);
            if (idx !== -1) {
                const orig = existingItems[idx];
                existingItems[idx] = Object.assign({}, orig, itemPayload);
            }
        } else {
            // Create new item
            const itemId = 'item_' + Date.now();
            const newItem = Object.assign({ id: itemId, createdAt: now }, itemPayload);
            existingItems.push(newItem);

            // Update user stats
            if (this.currentUser) {
                const userStats = JSON.parse(localStorage.getItem('flexy_user_stats_' + this.currentUser.id) || '{}');
                userStats.itemsListed = (userStats.itemsListed || 0) + 1;
                localStorage.setItem('flexy_user_stats_' + this.currentUser.id, JSON.stringify(userStats));
                
                // Update current user in localStorage
                this.currentUser.stats = userStats;
                localStorage.setItem('flexy_user', JSON.stringify(this.currentUser));
            }
        }
        
        // Save updated items
        localStorage.setItem('flexy_items', JSON.stringify(existingItems));
    }

    extractTags(description) {
        const words = description.toLowerCase().split(/\s+/);
        const commonTags = ['new', 'used', 'excellent', 'good', 'perfect', 'brand', 'genuine', 'original', 'authentic'];
        const tags = [];
        
        words.forEach(word => {
            if (commonTags.includes(word) && !tags.includes(word)) {
                tags.push(word);
            }
        });
        
        return tags.slice(0, 5); // Limit to 5 tags
    }

    showNotification(message, type = 'info') {
        notify(message, type);
    }
}

// Initialize sell
const sell = new Sell();

// Global functions for HTML onclick handlers
function nextStep(step) {
    sell.nextStep(step);
}

function prevStep(step) {
    sell.prevStep(step);
}

function saveDraft() {
    sell.saveDraft();
}