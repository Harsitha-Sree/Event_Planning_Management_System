
async function initVendorDashboardPage() {
    console.log('Initializing Vendor Dashboard Page...');
    const totalMessagesEl = document.getElementById('total-messages-count');
    const eventsInterestedInEl = document.getElementById('events-interested-in-count');
    const profileCompletionEl = document.getElementById('profile-completion-percent');
    const loadingSpinnerEl = document.getElementById('loading-spinner');
    const errorMessageEl = document.getElementById('error-message');

    async function fetchVendorDashboardStats() {
        loadingSpinnerEl.style.display = 'block';
        errorMessageEl.style.display = 'none';
        errorMessageEl.textContent = '';

        const token = getAuthToken();
        if (!token) return;

        try {
            const response = await fetch('/api/vendor/stats', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (await handleAuthError(response)) return;
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            totalMessagesEl.textContent = data.totalMessages;
            eventsInterestedInEl.textContent = data.eventsInterestedIn;
            profileCompletionEl.textContent = data.profileCompletion + '%';

        } catch (error) {
            console.error('Error fetching vendor dashboard stats:', error);
            errorMessageEl.textContent = `Failed to load dashboard data: ${error.message}`;
            errorMessageEl.style.display = 'block';
            totalMessagesEl.textContent = '0';
            eventsInterestedInEl.textContent = '0';
            profileCompletionEl.textContent = '0%';
        } finally {
            loadingSpinnerEl.style.display = 'none';
        }
    }

    await fetchVendorDashboardStats();
}


// --- VENDOR PROFILE PAGE SPECIFIC LOGIC ---
let serviceCounter = 0;

async function initVendorProfilePage() {
    console.log('Initializing Vendor Profile Page...');

    const profileForm = document.getElementById('vendor-profile-form');
    const companyNameInput = document.getElementById('company-name');
    const vendorPhotoInput = document.getElementById('vendor-photo-input');
    const vendorPhotoPreview = document.getElementById('vendor-photo-preview');
    const categoryInput = document.getElementById('category');
    const locationInput = document.getElementById('location');
    const contactNumberInput = document.getElementById('contact-number');
    const descriptionInput = document.getElementById('description');
    const servicesContainer = document.getElementById('services-container');
    const addServiceBtn = document.getElementById('add-service-btn');
    const saveProfileBtn = document.getElementById('save-profile-btn');

    // --- Image Preview Logic ---
    function setupImagePreview(inputElement, previewElement) {
        if (inputElement && previewElement) {
            inputElement.addEventListener('change', (event) => {
                const file = event.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        previewElement.src = e.target.result;
                        previewElement.style.display = 'block';
                    };
                    reader.readAsDataURL(file);
                } else {
                    previewElement.src = '';
                    previewElement.style.display = 'none';
                }
            });
        }
    }

    // Setup for main vendor photo
    setupImagePreview(vendorPhotoInput, vendorPhotoPreview);

    // --- Services Management ---
    function addServiceField(service = { name: '', photo: '' }) {
        const uniqueId = `service-${serviceCounter++}`;
        const serviceDiv = document.createElement('div');
        serviceDiv.classList.add('service-item');
        serviceDiv.innerHTML = `
            <input type="text" id="service-name-${uniqueId}" placeholder="Service Name" value="${service.name}" required>
            <input type="file" id="service-photo-input-${uniqueId}" accept="image/*">
            <label for="service-photo-input-${uniqueId}" class="file-label"><i class="fas fa-camera"></i> Upload Photo</label>
            <img id="service-photo-preview-${uniqueId}" src="${service.photo || ''}" alt="Service Photo" style="${service.photo ? 'display: block;' : 'display: none;'}">
            <button type="button" class="remove-service-btn btn-danger"><i class="fas fa-times-circle"></i></button>
        `;
        servicesContainer.appendChild(serviceDiv);

        // Setup preview for new service photo
        setupImagePreview(document.getElementById(`service-photo-input-${uniqueId}`), document.getElementById(`service-photo-preview-${uniqueId}`));

        // Add remove listener
        serviceDiv.querySelector('.remove-service-btn').addEventListener('click', () => {
            serviceDiv.remove();
        });
    }

    if (addServiceBtn) {
        addServiceBtn.addEventListener('click', () => addServiceField());
    }

    // --- Load Existing Profile Data ---
    async function loadVendorProfile() {
        const token = getAuthToken();
        if (!token) return;

        try {
            const response = await fetch('/api/vendor/profile', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (await handleAuthError(response)) return;
            
            if (response.status === 404) {
                console.log('No profile found. Ready to create a new one.');
                showGlobalMessage('Welcome! Please create your vendor profile.', 'info');
                return;
            }
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to load vendor profile');
            }

            const profile = await response.json();
            
            companyNameInput.value = profile.companyName || '';
            categoryInput.value = profile.category || '';
            locationInput.value = profile.location || '';
            contactNumberInput.value = profile.contactNumber || '';
            descriptionInput.value = profile.description || '';

            if (profile.photo) {
                vendorPhotoPreview.src = profile.photo;
                vendorPhotoPreview.style.display = 'block';
            } else {
                vendorPhotoPreview.style.display = 'none';
            }

            servicesContainer.innerHTML = '';
            if (profile.services && profile.services.length > 0) {
                profile.services.forEach(service => addServiceField(service));
            } else {
                addServiceField();
            }

        } catch (error) {
            console.error('Error loading vendor profile:', error);
            showGlobalMessage(`Error loading profile: ${error.message}`, 'error');
        }
    }

    // --- Form Submission (Save/Update Profile) ---
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            saveProfileBtn.disabled = true;
            saveProfileBtn.textContent = 'Saving...';

            const token = getAuthToken();
            if (!token) {
                saveProfileBtn.disabled = false;
                saveProfileBtn.textContent = 'Save Profile';
                return;
            }

            const formData = new FormData();
            formData.append('companyName', companyNameInput.value);
            formData.append('category', categoryInput.value);
            formData.append('location', locationInput.value);
            formData.append('contactNumber', contactNumberInput.value);
            formData.append('description', descriptionInput.value);

            // Append main vendor photo if selected
            if (vendorPhotoInput.files[0]) {
                formData.append('photo', vendorPhotoInput.files[0]);
            }

            // Collect all services
            const serviceItems = servicesContainer.querySelectorAll('.service-item');
            const servicesArray = [];
            let serviceFileIndex = 0;
            
            serviceItems.forEach((item) => {
                const serviceName = item.querySelector('input[type="text"]').value.trim();
                const servicePhotoInput = item.querySelector('input[type="file"]');
                const servicePhotoPreview = item.querySelector('img');

                if (serviceName) {
                    const serviceObj = { name: serviceName };
                    
                    // If a new photo is selected for this service
                    if (servicePhotoInput.files[0]) {
                        formData.append('serviceFiles', servicePhotoInput.files[0]);
                        serviceObj.newPhotoIndex = serviceFileIndex;
                        serviceFileIndex++;
                    } else if (servicePhotoPreview.src && !servicePhotoPreview.src.startsWith('data:image')) {
                        // Keep existing photo URL
                        serviceObj.photoUrl = servicePhotoPreview.src;
                    }
                    
                    servicesArray.push(serviceObj);
                }
            });

            // Append services array as JSON string
            formData.append('services', JSON.stringify(servicesArray));

            // Debug logs
            console.log('Services array:', servicesArray);
            console.log('FormData entries:');
            for (let [key, value] of formData.entries()) {
                console.log(key, ':', value instanceof File ? `File: ${value.name}` : value);
            }

            try {
                // Try PUT first (update), then POST (create) if 404
                let method = 'PUT';
                let url = '/api/vendor/profile';

                let response = await fetch(url, {
                    method: method,
                    headers: { 
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData
                });

                if (response.status === 404) {
                    method = 'POST';
                    response = await fetch(url, {
                        method: method,
                        headers: { 
                            'Authorization': `Bearer ${token}`
                        },
                        body: formData
                    });
                }

                if (await handleAuthError(response)) {
                    saveProfileBtn.disabled = false;
                    saveProfileBtn.textContent = 'Save Profile';
                    return;
                }
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Failed to save profile');
                }

                const result = await response.json();
                showGlobalMessage('Profile saved successfully!', 'success');
                await loadVendorProfile();
                
            } catch (error) {
                console.error('Error saving profile:', error);
                showGlobalMessage(`Error saving profile: ${error.message}`, 'error');
            } finally {
                saveProfileBtn.disabled = false;
                saveProfileBtn.textContent = 'Save Profile';
            }
        });
    }

    // Initial load of profile data
    await loadVendorProfile();
}


// --- VENDOR MESSAGES PAGE SPECIFIC LOGIC ---
async function initVendorMessagesPage() {
    console.log('Initializing Vendor Messages Page...');
}


// --- MAIN INITIALIZATION LOGIC (RUNS ON DOMContentLoaded) ---
document.addEventListener('DOMContentLoaded', async () => {
    await loadPartial('navbar-placeholder', '../partials/navbar.html');
    await loadPartial('sidebar-placeholder', '../partials/sidebar.html');
    await loadPartial('footer-placeholder', '../partials/footer.html');

    const currentPath = window.location.pathname.split('/').pop();
    const sidebarLinks = document.querySelectorAll('#sidebar-placeholder a');
    sidebarLinks.forEach(link => {
        if (link.getAttribute('href').endsWith(currentPath)) {
            link.classList.add('active');
        }
    });

    if (currentPath === 'dashboard.html') {
        await initVendorDashboardPage();
    } else if (currentPath === 'profile.html') {
        await initVendorProfilePage();
    } else if (currentPath === 'messages.html') {
        await initVendorMessagesPage();
    }
});