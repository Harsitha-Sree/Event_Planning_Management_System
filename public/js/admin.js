 
/**
 * Loads an HTML partial into a specified DOM element.
 * @param {string} id - The ID of the element to load the partial into.
 * @param {string} filePath - The path to the HTML partial file.
 */
async function loadPartial(id, filePath) {
    try {
        const response = await fetch(filePath);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const text = await response.text();
        document.getElementById(id).innerHTML = text;
    } catch (error) {
        console.error(`Error loading partial ${filePath}:`, error);
        document.getElementById(id).innerHTML = `<p style="color: red;">Failed to load ${filePath}</p>`;
    }
}

/**
 * Opens a modal.
 * @param {string} modalId - The ID of the modal element.
 */
function openModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
}

/**
 * Closes a modal.
 * @param {string} modalId - The ID of the modal element.
 */
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Global click listener to close modals when clicking outside
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
};

/**
 * Checks if a user is authenticated (has a token). If not, redirects to login.
 * @returns {string|null} The JWT token if found, otherwise null.
 */
function getAuthToken() {
    const token = localStorage.getItem('token');
    if (!token) {
        alert('You are not logged in. Please log in first.');
        window.location.href = '/auth/login.html'; // Redirect to login
        return null;
    }
    return token;
}

/**
 * Handles unauthorized/forbidden responses, clearing token and redirecting.
 * @param {object} response - The fetch API response object.
 * @returns {boolean} True if redirect occurred, false otherwise.
 */
async function handleAuthError(response) {
    if (response.status === 401 || response.status === 403) {
        alert('Unauthorized or Session Expired. Please log in again.');
        localStorage.removeItem('token');
        window.location.href = '/auth/login.html';
        return true;
    }
    return false;
}

// --- DASHBOARD PAGE SPECIFIC LOGIC ---
async function initDashboardPage() {
    const organizerCountEl = document.getElementById('organizer-count');
    const vendorCountEl = document.getElementById('vendor-count');
    const eventCountEl = document.getElementById('event-count');
    const loadingSpinnerEl = document.getElementById('loading-spinner');
    const errorMessageDisplayEl = document.getElementById('error-message-display');

    async function fetchDashboardStats() {
        loadingSpinnerEl.style.display = 'block';
        errorMessageDisplayEl.style.display = 'none';
        errorMessageDisplayEl.textContent = '';

        const token = getAuthToken();
        if (!token) return;

        try {
            const response = await fetch('/api/admin/stats', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (await handleAuthError(response)) return;
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            organizerCountEl.textContent = data.organizerCount;
            vendorCountEl.textContent = data.vendorCount;
            eventCountEl.textContent = data.eventCount;

        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
            errorMessageDisplayEl.textContent = `Failed to load dashboard data: ${error.message}`;
            errorMessageDisplayEl.style.display = 'block';
            organizerCountEl.textContent = '0';
            vendorCountEl.textContent = '0';
            eventCountEl.textContent = '0';
        } finally {
            loadingSpinnerEl.style.display = 'none';
        }
    }

    await fetchDashboardStats();
}


// --- EVENTS PAGE SPECIFIC LOGIC ---
let eventToDeleteId = null;

async function initEventsPage() {
    const eventsGrid = document.getElementById('events-grid');
    const noEventsMessage = document.getElementById('no-events-message');
    const loadingSpinner = document.getElementById('loading-spinner');

    const filterEventName = document.getElementById('filter-event-name');
    const filterOrganizerName = document.getElementById('filter-organizer-name');
    const filterDate = document.getElementById('filter-date');
    const filterRsvpStatus = document.getElementById('filter-rsvp-status');
    const applyFiltersBtn = document.getElementById('apply-filters-btn');
    const resetFiltersBtn = document.getElementById('reset-filters-btn');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');

    async function fetchEvents(filters = {}) {
        loadingSpinner.style.display = 'flex';
        eventsGrid.innerHTML = '';
        noEventsMessage.style.display = 'none';

        const token = getAuthToken();
        if (!token) return;

        const queryParams = new URLSearchParams(filters).toString();
        try {
            const response = await fetch(`/api/admin/events?${queryParams}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (await handleAuthError(response)) return;
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            renderEvents(data.events);

        } catch (error) {
            console.error('Error fetching events:', error);
            eventsGrid.innerHTML = `<p class="error-message">Failed to load events: ${error.message}</p>`;
        } finally {
            loadingSpinner.style.display = 'none';
        }
    }

    function renderEvents(events) {
        eventsGrid.innerHTML = '';
        if (events.length === 0) {
            noEventsMessage.style.display = 'block';
            return;
        }
        noEventsMessage.style.display = 'none';

        events.forEach(event => {
            const eventCard = document.createElement('div');
            eventCard.classList.add('event-card');
            eventCard.innerHTML = `
                <img src="${event.eventPhoto || '../images/event-placeholder.jpg'}" alt="${event.eventName}">
                <div class="event-card-content">
                    <h3>${event.eventName}</h3>
                    <p><strong>Organizer:</strong> ${event.organizerId ? event.organizerId.fullName : 'N/A'}</p>
                    <p><strong>Date:</strong> ${new Date(event.date).toLocaleDateString()} at ${event.time}</p>
                    <p><strong>Venue:</strong> ${event.venueName || event.venueLocation?.address || 'Not specified'}</p>
                    <p><strong>RSVP:</strong> ${event.rsvpSummary?.accepted || 0} Accepted / ${event.rsvpSummary?.pending || 0} Pending / ${event.rsvpSummary?.rejected || 0} Rejected</p>
                </div>
                <div class="card-actions">
                    <button class="view-btn" data-event-id="${event._id}"><i class="fas fa-eye"></i> View</button>
                    <button class="delete-btn" data-event-id="${event._id}" data-event-name="${event.eventName}"><i class="fas fa-trash-alt"></i> Delete</button>
                </div>
            `;
            eventsGrid.appendChild(eventCard);
        });

        document.querySelectorAll('.view-btn').forEach(button => {
            button.addEventListener('click', (e) => showEventDetails(e.target.dataset.eventId));
        });
        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', (e) => confirmDeleteEvent(e.target.dataset.eventId, e.target.dataset.eventName));
        });
    }

    async function showEventDetails(eventId) {
        const token = getAuthToken();
        if (!token) return;

        try {
            const response = await fetch(`/api/admin/events/${eventId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (await handleAuthError(response)) return;
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to fetch event details');
            }
            const event = await response.json();

            document.getElementById('modal-event-name').textContent = event.eventName;
            document.getElementById('modal-event-photo').src = event.eventPhoto || '../images/event-placeholder.jpg';
            document.getElementById('modal-organizer-name').textContent = event.organizerId ? event.organizerId.fullName : 'N/A';
            document.getElementById('modal-organizer-email').textContent = event.organizerId ? event.organizerId.email : 'N/A';
            document.getElementById('modal-event-date-time').textContent = `${new Date(event.date).toLocaleDateString()} at ${event.time}`;
            document.getElementById('modal-event-venue').textContent = event.venueName || event.venueLocation?.address || 'Not specified';
            document.getElementById('modal-created-at').textContent = new Date(event.createdAt).toLocaleDateString();

            document.getElementById('modal-rsvp-accepted').textContent = event.rsvpSummary?.accepted || 0;
            document.getElementById('modal-rsvp-pending').textContent = event.rsvpSummary?.pending || 0;
            document.getElementById('modal-rsvp-rejected').textContent = event.rsvpSummary?.rejected || 0;

            const invitedGuestsList = document.getElementById('modal-invited-guests');
            invitedGuestsList.innerHTML = '';
            if (event.invitedGuests && event.invitedGuests.length > 0) {
                event.invitedGuests.forEach(guest => {
                    const li = document.createElement('li');
                    li.textContent = `${guest.inviteeEmail} - Status: ${guest.status}`;
                    invitedGuestsList.appendChild(li);
                });
            } else {
                invitedGuestsList.innerHTML = '<li>No guests invited yet.</li>';
            }

            openModal('event-details-modal');
        } catch (error) {
            console.error('Error fetching event details:', error);
            alert(`Error fetching event details: ${error.message}`);
        }
    }

    function confirmDeleteEvent(eventId, eventName) {
        eventToDeleteId = eventId;
        document.getElementById('delete-event-name').textContent = eventName;
        openModal('delete-confirm-modal');
    }

    async function deleteEvent() {
        if (!eventToDeleteId) return;

        const token = getAuthToken();
        if (!token) return;

        try {
            const response = await fetch(`/api/admin/events/${eventToDeleteId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (await handleAuthError(response)) return;
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to delete event');
            }

            alert('Event deleted successfully!');
            closeModal('delete-confirm-modal');
            fetchEvents();
        } catch (error) {
            console.error('Error deleting event:', error);
            alert(`Error deleting event: ${error.message}`);
        } finally {
            eventToDeleteId = null;
        }
    }

    function applyFilters() {
        const filters = {};
        const eventName = filterEventName.value.trim();
        const organizerName = filterOrganizerName.value.trim();
        const date = filterDate.value;
        const rsvpStatus = filterRsvpStatus.value;

        if (eventName) filters.eventName = eventName;
        if (organizerName) filters.organizerName = organizerName;
        if (date) filters.date = date;
        if (rsvpStatus) filters.rsvpStatus = rsvpStatus;

        fetchEvents(filters);
    }

    function resetFilters() {
        filterEventName.value = '';
        filterOrganizerName.value = '';
        filterDate.value = '';
        filterRsvpStatus.value = '';
        fetchEvents();
    }

    // Attach event listeners for filters and modals
    applyFiltersBtn.addEventListener('click', applyFilters);
    resetFiltersBtn.addEventListener('click', resetFilters);
    confirmDeleteBtn.addEventListener('click', deleteEvent);

    await fetchEvents(); // Initial load
}


// --- ORGANIZERS PAGE SPECIFIC LOGIC ---
let organizerToActOnId = null;

async function initOrganizersPage() {
    const organizersTableBody = document.getElementById('organizers-table-body');
    const noOrganizersMessage = document.getElementById('no-organizers-message');
    const loadingSpinner = document.getElementById('loading-spinner');

    const filterOrganizerName = document.getElementById('filter-organizer-name');
    const filterOrganizerEmail = document.getElementById('filter-organizer-email');
    const filterStatus = document.getElementById('filter-status');
    const applyFiltersBtn = document.getElementById('apply-filters-btn');
    const resetFiltersBtn = document.getElementById('reset-filters-btn');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const confirmSuspendBtn = document.getElementById('confirm-suspend-btn');

    async function fetchOrganizers(filters = {}) {
        loadingSpinner.style.display = 'flex';
        organizersTableBody.innerHTML = '';
        noOrganizersMessage.style.display = 'none';

        const token = getAuthToken();
        if (!token) return;

        const queryParams = new URLSearchParams(filters).toString();
        try {
            const response = await fetch(`/api/admin/organizers?${queryParams}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (await handleAuthError(response)) return;
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            renderOrganizers(data.organizers);

        } catch (error) {
            console.error('Error fetching organizers:', error);
            organizersTableBody.innerHTML = `<tr><td colspan="6" class="error-message">Failed to load organizers: ${error.message}</td></tr>`;
        } finally {
            loadingSpinner.style.display = 'none';
        }
    }

    function renderOrganizers(organizers) {
        organizersTableBody.innerHTML = '';
        if (organizers.length === 0) {
            noOrganizersMessage.style.display = 'block';
            return;
        }
        noOrganizersMessage.style.display = 'none';

        organizers.forEach(organizer => {
            const row = document.createElement('tr');
            const status = organizer.status ? organizer.status.toLowerCase() : 'active';
            const suspendButtonText = status === 'suspended' ? '<i class="fas fa-check-circle"></i> Reactivate' : '<i class="fas fa-ban"></i> Suspend';
            const suspendButtonClass = status === 'suspended' ? 'reactivate-btn' : '';

            row.innerHTML = `
                <td>${organizer.fullName}</td>
                <td>${organizer.email}</td>
                <td>${new Date(organizer.createdAt).toLocaleDateString()}</td>
                <td>${organizer.eventsCount || 0}</td>
                <td><span class="status-badge ${status}">${organizer.status || 'Active'}</span></td>
                <td class="actions-column">
                    <button class="view-btn" data-id="${organizer._id}"><i class="fas fa-eye"></i> View</button>
                    <button class="suspend-btn ${suspendButtonClass}" data-id="${organizer._id}" data-status="${status}">${suspendButtonText}</button>
                    <button class="delete-btn" data-id="${organizer._id}" data-name="${organizer.fullName}" data-email="${organizer.email}"><i class="fas fa-trash-alt"></i> Delete</button>
                </td>
            `;
            organizersTableBody.appendChild(row);
        });

        document.querySelectorAll('.view-btn').forEach(button => {
            button.addEventListener('click', (e) => showOrganizerDetails(e.target.dataset.id));
        });
        document.querySelectorAll('.suspend-btn').forEach(button => {
            button.addEventListener('click', (e) => confirmSuspendReactivate(e.target.dataset.id, e.target.dataset.status));
        });
        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', (e) => confirmDeleteOrganizer(e.target.dataset.id, e.target.dataset.name, e.target.dataset.email));
        });
    }

    async function showOrganizerDetails(organizerId) {
        const token = getAuthToken();
        if (!token) return;

        try {
            const response = await fetch(`/api/admin/organizers/${organizerId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (await handleAuthError(response)) return;
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to fetch organizer details');
            }
            const organizer = await response.json();

            document.getElementById('modal-organizer-full-name').textContent = organizer.fullName;
            document.getElementById('modal-organizer-email-detail').textContent = organizer.email;
            document.getElementById('modal-organizer-registered-on').textContent = new Date(organizer.createdAt).toLocaleDateString();
            document.getElementById('modal-organizer-status').textContent = organizer.status || 'Active';

            const eventsList = document.getElementById('modal-organizer-events-list');
            eventsList.innerHTML = '';
            if (organizer.events && organizer.events.length > 0) {
                organizer.events.forEach(event => {
                    const li = document.createElement('li');
                    li.textContent = `${event.eventName} on ${new Date(event.date).toLocaleDateString()} (RSVP: ${event.rsvpSummary?.accepted || 0} A / ${event.rsvpSummary?.pending || 0} P / ${event.rsvpSummary?.rejected || 0} R)`;
                    eventsList.appendChild(li);
                });
            } else {
                eventsList.innerHTML = '<li>No events created yet by this organizer.</li>';
            }

            openModal('organizer-details-modal');
        } catch (error) {
            console.error('Error fetching organizer details:', error);
            alert(`Error fetching organizer details: ${error.message}`);
        }
    }

    function confirmSuspendReactivate(organizerId, currentStatus) {
        organizerToActOnId = organizerId;
        const messageElement = document.getElementById('suspend-action-message');
        const confirmButton = document.getElementById('confirm-suspend-btn');

        if (currentStatus === 'suspended') {
            messageElement.innerHTML = `Are you sure you want to <strong>reactivate</strong> this organizer's account?`;
            confirmButton.textContent = 'Reactivate';
            confirmButton.classList.remove('btn-warning');
            confirmButton.classList.add('btn-success');
            confirmButton.onclick = () => updateOrganizerStatus('active');
        } else {
            messageElement.innerHTML = `Are you sure you want to <strong>suspend</strong> this organizer's account? They will lose access.`;
            confirmButton.textContent = 'Suspend';
            confirmButton.classList.remove('btn-success');
            confirmButton.classList.add('btn-warning');
            confirmButton.onclick = () => updateOrganizerStatus('suspended');
        }
        openModal('suspend-confirm-modal');
    }

    async function updateOrganizerStatus(newStatus) {
        if (!organizerToActOnId) return;

        const token = getAuthToken();
        if (!token) return;

        try {
            const response = await fetch(`/api/admin/organizers/status/${organizerToActOnId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (await handleAuthError(response)) return;
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Failed to ${newStatus} organizer`);
            }

            alert(`Organizer account ${newStatus}d successfully!`);
            closeModal('suspend-confirm-modal');
            fetchOrganizers();
        } catch (error) {
            console.error(`Error updating organizer status to ${newStatus}:`, error);
            alert(`Error: ${error.message}`);
        } finally {
            organizerToActOnId = null;
        }
    }

    function confirmDeleteOrganizer(organizerId, organizerName, organizerEmail) {
        organizerToActOnId = organizerId;
        document.getElementById('delete-organizer-name').textContent = organizerName;
        document.getElementById('delete-organizer-email').textContent = organizerEmail;
        openModal('delete-confirm-modal');
    }

    async function deleteOrganizer() {
        if (!organizerToActOnId) return;

        const token = getAuthToken();
        if (!token) return;

        try {
            const response = await fetch(`/api/admin/organizers/${organizerToActOnId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (await handleAuthError(response)) return;
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to delete organizer');
            }

            alert('Organizer deleted successfully!');
            closeModal('delete-confirm-modal');
            fetchOrganizers();
        } catch (error) {
            console.error('Error deleting organizer:', error);
            alert(`Error deleting organizer: ${error.message}`);
        } finally {
            organizerToActOnId = null;
        }
    }

    function applyFilters() {
        const filters = {};
        const name = filterOrganizerName.value.trim();
        const email = filterOrganizerEmail.value.trim();
        const status = filterStatus.value;

        if (name) filters.fullName = name;
        if (email) filters.email = email;
        if (status) filters.status = status;

        fetchOrganizers(filters);
    }

    function resetFilters() {
        filterOrganizerName.value = '';
        filterOrganizerEmail.value = '';
        filterStatus.value = '';
        fetchOrganizers();
    }

    // Attach event listeners
    applyFiltersBtn.addEventListener('click', applyFilters);
    resetFiltersBtn.addEventListener('click', resetFilters);
    confirmDeleteBtn.addEventListener('click', deleteOrganizer);
    // confirmSuspendBtn onclick is set dynamically in confirmSuspendReactivate

    await fetchOrganizers(); // Initial load
}


// --- VENDORS PAGE SPECIFIC LOGIC ---
let vendorToActOnId = null;

async function initVendorsPage() {
    const vendorsTableBody = document.getElementById('vendors-table-body');
    const noVendorsMessage = document.getElementById('no-vendors-message');
    const loadingSpinner = document.getElementById('loading-spinner');

    const filterVendorName = document.getElementById('filter-vendor-name');
    const filterVendorCategory = document.getElementById('filter-vendor-category');
    const filterApprovalStatus = document.getElementById('filter-approval-status');
    const applyFiltersBtn = document.getElementById('apply-filters-btn');
    const resetFiltersBtn = document.getElementById('reset-filters-btn');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const confirmApproveBtn = document.getElementById('confirm-approve-btn'); // For approve/disapprove modal

    async function fetchVendors(filters = {}) {
        loadingSpinner.style.display = 'flex';
        vendorsTableBody.innerHTML = '';
        noVendorsMessage.style.display = 'none';

        const token = getAuthToken();
        if (!token) return;

        const queryParams = new URLSearchParams(filters).toString();
        try {
            const response = await fetch(`/api/admin/vendors?${queryParams}`, {
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
            vendorsTableBody.innerHTML = `<tr><td colspan="7" class="error-message">Failed to load vendors: ${error.message}</td></tr>`;
        } finally {
            loadingSpinner.style.display = 'none';
        }
    }

    function renderVendors(vendors) {
        vendorsTableBody.innerHTML = '';
        if (vendors.length === 0) {
            noVendorsMessage.style.display = 'block';
            return;
        }
        noVendorsMessage.style.display = 'none';

        vendors.forEach(vendor => {
            const row = document.createElement('tr');
            const approvalStatus = vendor.isApproved ? 'Approved' : 'Pending';
            const statusClass = vendor.isApproved ? 'approved' : 'pending';
            const approveButtonText = vendor.isApproved ? '<i class="fas fa-times-circle"></i> Disapprove' : '<i class="fas fa-check-circle"></i> Approve';
            const approveButtonClass = vendor.isApproved ? 'disapprove-btn' : 'approve-btn';

            row.innerHTML = `
                <td>${vendor.companyName}</td>
                <td>${vendor.category || 'N/A'}</td>
                <td>${vendor.location || 'N/A'}</td>
                <td>${vendor.contactNumber || 'N/A'}</td>
                <td>${new Date(vendor.createdAt).toLocaleDateString()}</td>
                <td><span class="status-badge ${statusClass}">${approvalStatus}</span></td>
                <td class="actions-column">
                    <button class="view-btn" data-id="${vendor._id}"><i class="fas fa-eye"></i> View</button>
                    <button class="${approveButtonClass}" data-id="${vendor._id}" data-approved="${vendor.isApproved}">${approveButtonText}</button>
                    <button class="delete-btn" data-id="${vendor._id}" data-name="${vendor.companyName}" data-email="${vendor.userId ? vendor.userId.email : 'N/A'}"><i class="fas fa-trash-alt"></i> Delete</button>
                </td>
            `;
            vendorsTableBody.appendChild(row);
        });

        document.querySelectorAll('.view-btn').forEach(button => {
            button.addEventListener('click', (e) => showVendorDetails(e.target.dataset.id));
        });
        document.querySelectorAll('.approve-btn, .disapprove-btn').forEach(button => {
            button.addEventListener('click', (e) => confirmApproveDisapprove(e.target.dataset.id, e.target.dataset.approved === 'true'));
        });
        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', (e) => confirmDeleteVendor(e.target.dataset.id, e.target.dataset.name, e.target.dataset.email));
        });
    }

    async function showVendorDetails(vendorId) {
        const token = getAuthToken();
        if (!token) return;

        try {
            const response = await fetch(`/api/admin/vendors/${vendorId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (await handleAuthError(response)) return;
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to fetch vendor details');
            }
            const vendor = await response.json();

            document.getElementById('modal-vendor-company-name').textContent = vendor.companyName;
            document.getElementById('modal-vendor-photo').src = vendor.photo || '../images/default-profile.jpg';
            document.getElementById('modal-vendor-category').textContent = vendor.category || 'N/A';
            document.getElementById('modal-vendor-location').textContent = vendor.location || 'N/A';
            document.getElementById('modal-vendor-email').textContent = vendor.userId ? vendor.userId.email : 'N/A';
            document.getElementById('modal-vendor-contact').textContent = vendor.contactNumber || 'N/A';
            document.getElementById('modal-vendor-registered-on').textContent = new Date(vendor.createdAt).toLocaleDateString();
            document.getElementById('modal-vendor-status').textContent = vendor.isApproved ? 'Approved' : 'Pending';
            document.getElementById('modal-vendor-description').textContent = vendor.description || 'No description provided.';

            const servicesList = document.getElementById('modal-vendor-services-list');
            servicesList.innerHTML = '';
            if (vendor.services && vendor.services.length > 0) {
                vendor.services.forEach(service => {
                    const li = document.createElement('li');
                    li.classList.add('service-item');
                    li.innerHTML = `
                        <img src="${service.photo || '../images/service-placeholder.jpg'}" alt="${service.name}">
                        <span>${service.name}</span>
                    `;
                    servicesList.appendChild(li);
                });
            } else {
                servicesList.innerHTML = '<li>No services listed by this vendor.</li>';
            }

            openModal('vendor-details-modal');
        } catch (error) {
            console.error('Error fetching vendor details:', error);
            alert(`Error fetching vendor details: ${error.message}`);
        }
    }

    function confirmApproveDisapprove(vendorId, isCurrentlyApproved) {
        vendorToActOnId = vendorId;
        const messageElement = document.getElementById('approve-action-message');
        const confirmButton = document.getElementById('confirm-approve-btn');

        if (isCurrentlyApproved) {
            messageElement.innerHTML = `Are you sure you want to <strong>disapprove</strong> this vendor's profile? They will no longer be visible to organizers.`;
            confirmButton.textContent = 'Disapprove';
            confirmButton.classList.remove('btn-primary');
            confirmButton.classList.add('btn-warning');
            confirmButton.onclick = () => updateVendorApprovalStatus(false);
        } else {
            messageElement.innerHTML = `Are you sure you want to <strong>approve</strong> this vendor's profile? It will become visible to organizers.`;
            confirmButton.textContent = 'Approve';
            confirmButton.classList.remove('btn-warning');
            confirmButton.classList.add('btn-primary');
            confirmButton.onclick = () => updateVendorApprovalStatus(true);
        }
        openModal('approve-confirm-modal');
    }

    async function updateVendorApprovalStatus(isApproved) {
        if (!vendorToActOnId) return;

        const token = getAuthToken();
        if (!token) return;

        try {
            const response = await fetch(`/api/admin/vendors/approve/${vendorToActOnId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ isApproved })
            });

            if (await handleAuthError(response)) return;
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Failed to update vendor approval status`);
            }

            alert(`Vendor profile ${isApproved ? 'approved' : 'disapproved'} successfully!`);
            closeModal('approve-confirm-modal');
            fetchVendors();
        } catch (error) {
            console.error('Error updating vendor approval status:', error);
            alert(`Error: ${error.message}`);
        } finally {
            vendorToActOnId = null;
        }
    }

    function confirmDeleteVendor(vendorId, companyName, vendorEmail) {
        vendorToActOnId = vendorId;
        document.getElementById('delete-vendor-company-name').textContent = companyName;
        document.getElementById('delete-vendor-email').textContent = vendorEmail;
        openModal('delete-confirm-modal');
    }

    async function deleteVendor() {
        if (!vendorToActOnId) return;

        const token = getAuthToken();
        if (!token) return;

        try {
            const response = await fetch(`/api/admin/vendors/${vendorToActOnId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (await handleAuthError(response)) return;
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to delete vendor');
            }

            alert('Vendor deleted successfully!');
            closeModal('delete-confirm-modal');
            fetchVendors();
        } catch (error) {
            console.error('Error deleting vendor:', error);
            alert(`Error deleting vendor: ${error.message}`);
        } finally {
            vendorToActOnId = null;
        }
    }

    // Attach event listeners
    applyFiltersBtn.addEventListener('click', applyFilters);
    resetFiltersBtn.addEventListener('click', resetFilters);
    confirmDeleteBtn.addEventListener('click', deleteVendor);

    await fetchVendors(); // Initial load
}


// --- MAIN INITIALIZATION LOGIC (RUNS ON DOMContentLoaded) ---
document.addEventListener('DOMContentLoaded', async () => {
    // Load common partials
    await loadPartial('navbar-placeholder', '../partials/navbar.html');
    await loadPartial('sidebar-placeholder', '../partials/sidebar.html');
    await loadPartial('footer-placeholder', '../partials/footer.html');

    // Set active link in sidebar (important after sidebar is loaded)
    const currentPath = window.location.pathname.split('/').pop();
    const sidebarLinks = document.querySelectorAll('#sidebar-placeholder a');
    sidebarLinks.forEach(link => {
        if (link.getAttribute('href').endsWith(currentPath)) {
            link.classList.add('active');
        }
    });

    // Determine which admin page is loaded and initialize its specific logic
    if (currentPath === 'dashboard.html') {
        await initDashboardPage();
    } else if (currentPath === 'events.html') {
        await initEventsPage();
    } else if (currentPath === 'organizers.html') {
        await initOrganizersPage();
    } else if (currentPath === 'vendors.html') {
        await initVendorsPage();
    }
});