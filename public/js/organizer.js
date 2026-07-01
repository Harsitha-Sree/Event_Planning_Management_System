
let currentEventIdForInvite = null;
let currentEventNameForInvite = null;
let currentRsvpEventId = null;

// --- INITIAL SETUP (RUNS ONCE) ---
document.addEventListener('DOMContentLoaded', () => {
    setupEventDateInput();
    setupImagePreview();
    setupAddEventButton();
    initializePage();
});

// --- SETUP FUNCTIONS ---
function setupEventDateInput() {
    const eventDateInput = document.getElementById('event-date');
    if (!eventDateInput) return;
    
    const today = new Date().toISOString().split('T')[0];
    eventDateInput.setAttribute('min', today);
    
    if (!eventDateInput.value) {
        eventDateInput.value = today;
    }
    
    eventDateInput.addEventListener('input', (e) => {
        const selectedDate = new Date(e.target.value);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (selectedDate < today) {
            e.target.setCustomValidity('Event date cannot be in the past');
        } else {
            e.target.setCustomValidity('');
        }
    });
}

function setupImagePreview() {
    const eventPhotoInput = document.getElementById('event-photo');
    const eventPhotoPreview = document.getElementById('event-photo-preview');
    
    if (!eventPhotoInput || !eventPhotoPreview) return;
    
    eventPhotoInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                eventPhotoPreview.src = e.target.result;
                eventPhotoPreview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        } else {
            eventPhotoPreview.src = '#';
            eventPhotoPreview.style.display = 'none';
        }
    });
}

function setupAddEventButton() {
    const addEventBtn = document.getElementById('add-event-btn');
    if (!addEventBtn) return;
    
    addEventBtn.addEventListener('click', () => {
        const form = document.getElementById('add-event-form');
        const preview = document.getElementById('event-photo-preview');
        
        if (form) form.reset();
        if (preview) {
            preview.src = '#';
            preview.style.display = 'none';
        }
        
        const dateInput = document.getElementById('event-date');
        if (dateInput && !dateInput.value) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }
        
        openModal('create-event-modal');
    });
}

// --- PAGE INITIALIZATION ---
async function initializePage() {
    // Load common partials first
    await loadPartial('navbar-placeholder', '../partials/navbar.html');
    await loadPartial('sidebar-placeholder', '../partials/sidebar.html');
    await loadPartial('footer-placeholder', '../partials/footer.html');
    
    // Set active link in sidebar
    const currentPath = window.location.pathname.split('/').pop();
    const sidebarLinks = document.querySelectorAll('#sidebar-placeholder a');
    sidebarLinks.forEach(link => {
        if (link.getAttribute('href').endsWith(currentPath)) {
            link.classList.add('active');
        }
    });
    
    // Initialize page-specific logic
    if (currentPath === 'dashboard.html') {
        await initOrganizerDashboardPage();
    } else if (currentPath === 'events.html') {
        await initOrganizerEventsPage();
    } else if (currentPath === 'vendors.html') {
        await initOrganizerFindVendorsPage();
    }
}

// ========================================
// DASHBOARD PAGE
// ========================================
async function initOrganizerDashboardPage() {
    console.log('Initializing Organizer Dashboard Page...');
    
    const totalEventsEl = document.getElementById('total-events-count');
    const pendingRsvpsEl = document.getElementById('pending-rsvps-count');
    const vendorsContactedEl = document.getElementById('vendors-contacted-count');
    const loadingSpinnerEl = document.getElementById('loading-spinner');
    const errorMessageEl = document.getElementById('error-message');
    
    if (loadingSpinnerEl) loadingSpinnerEl.style.display = 'block';
    if (errorMessageEl) {
        errorMessageEl.style.display = 'none';
        errorMessageEl.textContent = '';
    }
    
    const token = getAuthToken();
    if (!token) return;
    
    try {
        const response = await fetch('/api/organizer/stats', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (await handleAuthError(response)) return;
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        if (totalEventsEl) totalEventsEl.textContent = data.totalEvents;
        if (pendingRsvpsEl) pendingRsvpsEl.textContent = data.pendingRsvps;
        if (vendorsContactedEl) vendorsContactedEl.textContent = data.vendorsContacted;
        
    } catch (error) {
        console.error('Error fetching organizer dashboard stats:', error);
        if (errorMessageEl) {
            errorMessageEl.textContent = `Failed to load dashboard data: ${error.message}`;
            errorMessageEl.style.display = 'block';
        }
        if (totalEventsEl) totalEventsEl.textContent = '0';
        if (pendingRsvpsEl) pendingRsvpsEl.textContent = '0';
        if (vendorsContactedEl) vendorsContactedEl.textContent = '0';
    } finally {
        if (loadingSpinnerEl) loadingSpinnerEl.style.display = 'none';
    }
}

// ========================================
// EVENTS PAGE
// ========================================
async function initOrganizerEventsPage() {
    console.log('Initializing Organizer Events Page...');
    
    setupMockMap();
    setupEventForm();
    setupInviteModal();
    await fetchOrganizerEvents();
}

function setupMockMap() {
    const mockMapBtn = document.getElementById('mock-map-select-btn');
    if (!mockMapBtn) return;
    
    mockMapBtn.addEventListener('click', () => {
        const lat = (Math.random() * 180 - 90).toFixed(6);
        const lng = (Math.random() * 360 - 180).toFixed(6);
        
        const venueInput = document.getElementById('venue');
        const venueLatInput = document.getElementById('venue-lat');
        const venueLngInput = document.getElementById('venue-lng');
        
        if (venueInput) venueInput.value = `Mock Venue, Lat: ${lat}, Lng: ${lng}`;
        if (venueLatInput) venueLatInput.value = lat;
        if (venueLngInput) venueLngInput.value = lng;
        
        alert('Venue selected on mock map! (Lat: ' + lat + ', Lng: ' + lng + ')');
    });
}

function setupEventForm() {
    const addEventForm = document.getElementById('add-event-form');
    if (!addEventForm) return;
    
    addEventForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const createEventBtn = document.getElementById('create-event-button');
        if (createEventBtn) {
            createEventBtn.disabled = true;
            createEventBtn.textContent = 'Creating...';
        }
        
        const token = getAuthToken();
        if (!token) {
            if (createEventBtn) {
                createEventBtn.disabled = false;
                createEventBtn.textContent = 'Create Event';
            }
            return;
        }
        
        const formData = new FormData();
        formData.append('eventName', document.getElementById('event-name').value.trim());
        formData.append('date', document.getElementById('event-date').value);
        formData.append('time', document.getElementById('event-time').value);
        formData.append('venueName', document.getElementById('venue').value.trim());
        formData.append('venueLat', document.getElementById('venue-lat').value);
        formData.append('venueLng', document.getElementById('venue-lng').value);
        
        const eventPhoto = document.getElementById('event-photo').files[0];
        if (eventPhoto) {
            formData.append('eventPhoto', eventPhoto);
        }
        
        try {
            const response = await fetch('/api/events/create', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            
            if (await handleAuthError(response)) {
                if (createEventBtn) {
                    createEventBtn.disabled = false;
                    createEventBtn.textContent = 'Create Event';
                }
                return;
            }
            
            const errorData = await response.json();
            
            if (!response.ok) {
                throw new Error(errorData.message || errorData.error || 'Failed to create event');
            }
            
            showGlobalMessage('Event created successfully!', 'success');
            addEventForm.reset();
            closeModal('create-event-modal');
            fetchOrganizerEvents();
            
        } catch (error) {
            console.error('Error creating event:', error);
            showGlobalMessage(`Error creating event: ${error.message}`, 'error');
        } finally {
            if (createEventBtn) {
                createEventBtn.disabled = false;
                createEventBtn.textContent = 'Create Event';
            }
        }
    });
}

async function fetchOrganizerEvents() {
    const eventsGrid = document.getElementById('events-grid');
    const noEventsMessage = document.getElementById('no-events-message');
    const loadingSpinner = document.getElementById('loading-spinner');
    
    if (!eventsGrid) return;
    
    if (loadingSpinner) loadingSpinner.style.display = 'flex';
    eventsGrid.innerHTML = '';
    if (noEventsMessage) noEventsMessage.style.display = 'none';
    
    const token = getAuthToken();
    if (!token) return;
    
    try {
        const response = await fetch('/api/organizer/events', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (await handleAuthError(response)) return;
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        renderOrganizerEvents(data.events);
        
    } catch (error) {
        console.error('Error fetching organizer events:', error);
        eventsGrid.innerHTML = `<p class="error-message">Failed to load events: ${error.message}</p>`;
    } finally {
        if (loadingSpinner) loadingSpinner.style.display = 'none';
    }
}

function renderOrganizerEvents(events) {
    const eventsGrid = document.getElementById('events-grid');
    const noEventsMessage = document.getElementById('no-events-message');
    
    if (!eventsGrid) return;
    
    eventsGrid.innerHTML = '';
    
    if (events.length === 0) {
        if (noEventsMessage) noEventsMessage.style.display = 'block';
        return;
    }
    
    if (noEventsMessage) noEventsMessage.style.display = 'none';
    
    events.forEach(event => {
        const eventCard = document.createElement('div');
        eventCard.classList.add('event-card');
        
        eventCard.innerHTML = `
            <img src="${event.eventPhoto || '../images/event-placeholder.jpg'}" alt="${event.eventName}">
            <div class="event-card-content">
                <h3>${event.eventName}</h3>
                <p><strong>Date:</strong> ${new Date(event.date).toLocaleDateString()} at ${event.time}</p>
                <p><strong>Venue:</strong> ${event.venueName || event.venueLocation?.address || 'Not specified'}</p>
                <p class="rsvp-summary">
                    <strong>RSVP:</strong>
                    <span class="accepted-count">${event.rsvpSummary?.accepted || 0} Accepted</span> /
                    <span class="pending-count">${event.rsvpSummary?.pending || 0} Pending</span> /
                    <span class="rejected-count">${event.rsvpSummary?.rejected || 0} Rejected</span>
                </p>
            </div>
            <div class="card-actions">
                <button class="invite-btn btn-secondary" data-event-id="${event._id}" data-event-name="${event.eventName}">
                    <i class="fas fa-paper-plane"></i> Invite
                </button>
                <button class="manage-rsvp-btn btn-info" data-event-id="${event._id}" data-event-name="${event.eventName}">
                    <i class="fas fa-users"></i> Manage RSVPs
                </button>
            </div>
        `;
        
        eventsGrid.appendChild(eventCard);
    });
    
    // Attach event listeners
    document.querySelectorAll('.invite-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const btn = e.target.closest('.invite-btn');
            showInviteModal(btn.dataset.eventId, btn.dataset.eventName);
        });
    });
    
    document.querySelectorAll('.manage-rsvp-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const btn = e.target.closest('.manage-rsvp-btn');
            openManageRsvpModal(btn.dataset.eventId, btn.dataset.eventName);
        });
    });
}

// ========================================
// INVITE MODAL
// ========================================
function setupInviteModal() {
    const sendInviteBtn = document.getElementById('send-invite-btn');
    if (!sendInviteBtn) return;
    
    sendInviteBtn.addEventListener('click', handleSendInvite);
    
    // Close button handlers
    const closeButtons = document.querySelectorAll('#invite-modal .close-button, #invite-modal .btn-secondary');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            setTimeout(() => {
                currentEventIdForInvite = null;
                currentEventNameForInvite = null;
            }, 300);
        });
    });
    
    // Backdrop click handler
    const inviteModal = document.getElementById('invite-modal');
    if (inviteModal) {
        inviteModal.addEventListener('click', (e) => {
            if (e.target === inviteModal) {
                closeModal('invite-modal');
                setTimeout(() => {
                    currentEventIdForInvite = null;
                    currentEventNameForInvite = null;
                }, 300);
            }
        });
    }
}

function showInviteModal(eventId, eventName) {
    console.log('showInviteModal called with:', { eventId, eventName });
    
    if (!eventId || !eventName) {
        console.error('Missing event data:', { eventId, eventName });
        showGlobalMessage('Error: Unable to load event information. Please try again.', 'error');
        return;
    }
    
    currentEventIdForInvite = eventId;
    currentEventNameForInvite = eventName;
    
    const inviteEventNameSpan = document.getElementById('invite-event-name');
    const inviteEmailInput = document.getElementById('invitee-email');
    
    if (inviteEventNameSpan) {
        inviteEventNameSpan.textContent = eventName;
    }
    
    if (inviteEmailInput) {
        inviteEmailInput.value = '';
        setTimeout(() => inviteEmailInput.focus(), 100);
    }
    
    openModal('invite-modal');
}

async function handleSendInvite() {
    const inviteEmailInput = document.getElementById('invitee-email');
    const sendInviteBtn = document.getElementById('send-invite-btn');
    
    const email = inviteEmailInput.value.trim();
    
    // Validation
    if (!email) {
        showGlobalMessage('Please enter an email address to invite.', 'warning');
        inviteEmailInput.focus();
        return;
    }
    
    if (!currentEventIdForInvite || !currentEventNameForInvite) {
        console.error('No event selected:', {
            eventId: currentEventIdForInvite,
            eventName: currentEventNameForInvite
        });
        showGlobalMessage('Error: No event selected. Please close this window and try again.', 'error');
        closeModal('invite-modal');
        return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showGlobalMessage('Please enter a valid email address.', 'warning');
        inviteEmailInput.focus();
        return;
    }
    
    // Disable button
    sendInviteBtn.disabled = true;
    const originalButtonText = sendInviteBtn.innerHTML;
    sendInviteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    
    const token = getAuthToken();
    if (!token) {
        sendInviteBtn.disabled = false;
        sendInviteBtn.innerHTML = originalButtonText;
        return;
    }
    
    try {
        const response = await fetch(`/api/events/${currentEventIdForInvite}/invite`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ inviteeEmail: email })
        });
        
        if (await handleAuthError(response)) {
            sendInviteBtn.disabled = false;
            sendInviteBtn.innerHTML = originalButtonText;
            return;
        }
        
        const responseData = await response.json();
        
        if (!response.ok) {
            if (response.status === 409) {
                showGlobalMessage(`⚠️ ${email} has already been invited to "${currentEventNameForInvite}".`, 'warning');
                inviteEmailInput.value = '';
                inviteEmailInput.focus();
                sendInviteBtn.disabled = false;
                sendInviteBtn.innerHTML = originalButtonText;
                return;
            }
            throw new Error(responseData.message || responseData.error || 'Failed to send invitation');
        }
        
        showGlobalMessage(`✓ Invitation sent successfully to ${email}!`, 'success');
        inviteEmailInput.value = '';
        fetchOrganizerEvents();
        
        setTimeout(() => closeModal('invite-modal'), 1500);
        setTimeout(() => {
            currentEventIdForInvite = null;
            currentEventNameForInvite = null;
        }, 1800);
        
    } catch (error) {
        console.error('Error sending invitation:', error);
        showGlobalMessage(`❌ Error: ${error.message}`, 'error');
        setTimeout(() => closeModal('invite-modal'), 2000);
    } finally {
        sendInviteBtn.disabled = false;
        sendInviteBtn.innerHTML = originalButtonText;
    }
}

// ========================================
// RSVP MANAGEMENT MODAL
// ========================================
async function openManageRsvpModal(eventId, eventName) {
    console.log('=== Opening Manage RSVP Modal ===');
    console.log('Event ID:', eventId);
    console.log('Event Name:', eventName);
    
    if (!eventId) {
        showGlobalMessage('Error: Invalid event ID', 'error');
        return;
    }
    
    currentRsvpEventId = eventId;
    
    const eventNameElement = document.getElementById('rsvp-event-name');
    if (eventNameElement) {
        eventNameElement.textContent = eventName;
    }
    
    openModal('manage-rsvp-modal');
    
    setTimeout(() => loadEventRsvps(eventId), 100);
}

async function loadEventRsvps(eventId) {
    console.log('=== Loading Event RSVPs ===');
    console.log('Event ID:', eventId);
    
    const rsvpListContainer = document.getElementById('rsvp-list-container');
    const rsvpLoading = document.getElementById('rsvp-loading');
    
    if (!rsvpListContainer) {
        console.error('RSVP list container not found in DOM');
        return;
    }
    
    if (rsvpLoading) rsvpLoading.style.display = 'block';
    rsvpListContainer.innerHTML = '';
    
    const token = getAuthToken();
    if (!token) {
        console.error('No auth token found');
        if (rsvpLoading) rsvpLoading.style.display = 'none';
        rsvpListContainer.innerHTML = `
            <div class="no-rsvps-message">
                <i class="fas fa-exclamation-circle" style="font-size: 2em; color: #dc3545; margin-bottom: 10px;"></i>
                <p>Authentication required. Please log in again.</p>
            </div>
        `;
        return;
    }
    
    const apiUrl = `/api/events/${eventId}/invitations`;
    console.log('Fetching from URL:', apiUrl);
    
    try {
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('Response status:', response.status);
        
        if (await handleAuthError(response)) {
            if (rsvpLoading) rsvpLoading.style.display = 'none';
            return;
        }
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Response error:', errorText);
            
            let errorMessage;
            try {
                const errorData = JSON.parse(errorText);
                errorMessage = errorData.message || errorData.error || 'Unknown error';
            } catch (e) {
                errorMessage = errorText || `HTTP ${response.status}`;
            }
            
            throw new Error(errorMessage);
        }
        
        const data = await response.json();
        console.log('RSVPs loaded successfully:', data);
        console.log('Number of invitations:', data.invitations?.length || 0);
        
        renderRsvpList(data.invitations || []);
        
    } catch (error) {
        console.error('=== Error loading RSVPs ===');
        console.error('Error:', error);
        
        rsvpListContainer.innerHTML = `
            <div class="no-rsvps-message">
                <i class="fas fa-exclamation-circle" style="font-size: 2em; color: #dc3545; margin-bottom: 10px;"></i>
                <p style="color: #dc3545; font-weight: bold;">Failed to load RSVPs</p>
                <p style="font-size: 0.9em; color: #666; margin-top: 10px;">${error.message}</p>
                <button onclick="loadEventRsvps('${eventId}')" class="btn-secondary" style="margin-top: 15px;">
                    <i class="fas fa-redo"></i> Retry
                </button>
            </div>
        `;
        
        showGlobalMessage(`Failed to load RSVPs: ${error.message}`, 'error');
    } finally {
        if (rsvpLoading) rsvpLoading.style.display = 'none';
    }
}

function renderRsvpList(invitations) {
    console.log('=== Rendering RSVP List ===');
    console.log('Number of invitations:', invitations.length);
    
    const rsvpListContainer = document.getElementById('rsvp-list-container');
    
    if (!rsvpListContainer) {
        console.error('RSVP list container not found');
        return;
    }
    
    if (invitations.length === 0) {
        rsvpListContainer.innerHTML = `
            <div class="no-rsvps-message">
                <i class="fas fa-inbox" style="font-size: 2em; color: #999; margin-bottom: 10px;"></i>
                <p>No invitations sent yet.</p>
                <p style="font-size: 0.9em; color: #666; margin-top: 10px;">
                    Start by clicking the "Invite" button on your event card.
                </p>
            </div>
        `;
        return;
    }
    
    rsvpListContainer.innerHTML = invitations.map(inv => `
        <div class="rsvp-item" data-invitation-id="${inv._id}">
            <div class="rsvp-item-info">
                <div class="rsvp-item-email">
                    <i class="fas fa-user"></i> ${inv.inviteeEmail}
                </div>
                <div class="rsvp-item-status">
                    <span class="status-badge ${inv.status}">${capitalizeFirst(inv.status)}</span>
                    <small style="color: #999; margin-left: 10px;">
                        <i class="far fa-clock"></i> Invited: ${new Date(inv.createdAt).toLocaleDateString()}
                    </small>
                </div>
            </div>
            <div class="rsvp-item-actions">
                <select id="status-select-${inv._id}" class="status-select">
                    <option value="pending" ${inv.status === 'pending' ? 'selected' : ''}>Pending</option>
                    <option value="accepted" ${inv.status === 'accepted' ? 'selected' : ''}>Accepted</option>
                    <option value="rejected" ${inv.status === 'rejected' ? 'selected' : ''}>Rejected</option>
                </select>
                <button onclick="updateRsvpStatus('${inv._id}', '${currentRsvpEventId}')" class="update-status-btn">
                    <i class="fas fa-check"></i> Update
                </button>
            </div>
        </div>
    `).join('');
    
    console.log('RSVP list rendered successfully');
}

async function updateRsvpStatus(invitationId, eventId) {
    console.log('=== Updating RSVP Status ===');
    console.log('Invitation ID:', invitationId);
    console.log('Event ID:', eventId);
    
    const selectElement = document.getElementById(`status-select-${invitationId}`);
    if (!selectElement) {
        console.error('Select element not found');
        showGlobalMessage('Error: Status dropdown not found', 'error');
        return;
    }
    
    const newStatus = selectElement.value;
    console.log('New status:', newStatus);
    
    const updateBtn = event.target.closest('button');
    
    updateBtn.disabled = true;
    updateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
    
    const token = getAuthToken();
    if (!token) {
        console.error('No auth token');
        updateBtn.disabled = false;
        updateBtn.innerHTML = '<i class="fas fa-check"></i> Update';
        return;
    }
    
    try {
        const apiUrl = `/api/events/${eventId}/invitations/${invitationId}/status`;
        console.log('Update URL:', apiUrl);
        
        const response = await fetch(apiUrl, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status: newStatus })
        });
        
        console.log('Update response status:', response.status);
        
        if (await handleAuthError(response)) {
            updateBtn.disabled = false;
            updateBtn.innerHTML = '<i class="fas fa-check"></i> Update';
            return;
        }
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to update status');
        }
        
        const result = await response.json();
        console.log('Status updated successfully:', result);
        
        showGlobalMessage(`✓ RSVP status updated to ${newStatus}!`, 'success');
        
        await loadEventRsvps(eventId);
        fetchOrganizerEvents();
        
    } catch (error) {
        console.error('Error updating RSVP status:', error);
        showGlobalMessage(`❌ Error: ${error.message}`, 'error');
        updateBtn.disabled = false;
        updateBtn.innerHTML = '<i class="fas fa-check"></i> Update';
    }
}

function capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// ========================================
// VENDORS PAGE
// ========================================
async function initOrganizerFindVendorsPage() {
    console.log('Initializing Organizer Find Vendors Page...');
    
    const filterCategory = document.getElementById('filter-category');
    const filterLocation = document.getElementById('filter-location');
    const applyFiltersBtn = document.getElementById('apply-filters-btn');
    const resetFiltersBtn = document.getElementById('reset-filters-btn');
    
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', () => {
            const filters = {};
            if (filterCategory && filterCategory.value.trim()) {
                filters.category = filterCategory.value.trim();
            }
            if (filterLocation && filterLocation.value.trim()) {
                filters.location = filterLocation.value.trim();
            }
            fetchVendors(filters);
        });
    }
    
    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', () => {
            if (filterCategory) filterCategory.value = '';
            if (filterLocation) filterLocation.value = '';
            fetchVendors();
        });
    }
    
    fetchVendors();
}

async function fetchVendors(filters = {}) {
    const vendorsGrid = document.getElementById('vendors-grid');
    const noVendorsMessage = document.getElementById('no-vendors-message');
    const loadingSpinner = document.getElementById('loading-spinner');
    
    if (!vendorsGrid) return;
    
    if (loadingSpinner) loadingSpinner.style.display = 'flex';
    vendorsGrid.innerHTML = '';
    if (noVendorsMessage) noVendorsMessage.style.display = 'none';
    
    const token = getAuthToken();
    if (!token) return;
    
    const queryParams = new URLSearchParams(filters).toString();
    
    try {
        const response = await fetch(`/api/organizer/vendors?${queryParams}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (await handleAuthError(response)) return;
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        renderVendors(data.vendors);
        
    } catch (error) {
        console.error('Error fetching vendors:', error);
        vendorsGrid.innerHTML = `<p class="error-message">Failed to load vendors: ${error.message}</p>`;
    } finally {
        if (loadingSpinner) loadingSpinner.style.display = 'none';
    }
}

function renderVendors(vendors) {
    const vendorsGrid = document.getElementById('vendors-grid');
    const noVendorsMessage = document.getElementById('no-vendors-message');
    
    if (!vendorsGrid) return;
    
    vendorsGrid.innerHTML = '';
    
    if (vendors.length === 0) {
        if (noVendorsMessage) noVendorsMessage.style.display = 'block';
        return;
    }
    
    if (noVendorsMessage) noVendorsMessage.style.display = 'none';
    
    vendors.forEach(vendor => {
        const vendorCard = document.createElement('div');
        vendorCard.classList.add('vendor-card');
        vendorCard.innerHTML = `
            <img src="${vendor.photo || '../images/default-profile.jpg'}" alt="${vendor.companyName}">
            <div class="vendor-card-content">
                <h3>${vendor.companyName}</h3>
                <p><strong>Category:</strong> ${vendor.category || 'N/A'}</p>
                <p><strong>Location:</strong> ${vendor.location || 'N/A'}</p>
                <p><strong>Contact:</strong> ${vendor.contactNumber || 'N/A'}</p>
            </div>
            <div class="card-actions">
                <button class="message-vendor-btn btn-primary" data-vendor-id="${vendor._id}" data-vendor-name="${vendor.companyName}">
                    <i class="fas fa-comment-dots"></i> Message Vendor
                </button>
            </div>
        `;
        vendorsGrid.appendChild(vendorCard);
    });
    
    // Attach event listeners for Message Vendor buttons
    document.querySelectorAll('.message-vendor-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const vendorId = e.target.closest('button').dataset.vendorId;
            const vendorName = e.target.closest('button').dataset.vendorName;
            messageVendor(vendorId, vendorName);
        });
    });
}

function messageVendor(vendorId, vendorName) {
    console.log('Message vendor clicked:', vendorId, vendorName);
    
    // Store vendor info in sessionStorage
    sessionStorage.setItem('selectedVendorId', vendorId);
    sessionStorage.setItem('selectedVendorName', vendorName);
    
    // Redirect to messages page
    window.location.href = 'messages.html';
}

