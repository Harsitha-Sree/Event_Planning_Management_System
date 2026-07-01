 
// This file contains global helper functions and common logic used across the entire frontend.

/**
 * Loads an HTML partial into a specified DOM element.
 * Useful for injecting reusable headers, sidebars, footers, etc.
 * @param {string} id - The ID of the element to load the partial into.
 * @param {string} filePath - The relative path to the HTML partial file (e.g., '../partials/navbar.html').
 */
async function loadPartial(id, filePath) {
    const element = document.getElementById(id);
    if (!element) {
        console.warn(`Element with ID '${id}' not found for partial '${filePath}'.`);
        return;
    }
    try {
        const response = await fetch(filePath);
        if (!response.ok) {
            console.error(`HTTP error! status: ${response.status} for partial: ${filePath}`);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const text = await response.text();
        element.innerHTML = text;

        // After loading a partial, if it contains an active link, highlight it
        // This is generic enough for navbar/sidebar
        const currentPath = window.location.pathname.split('/').pop();
        const partialLinks = element.querySelectorAll('a');
        partialLinks.forEach(link => {
            if (link.getAttribute('href') && link.getAttribute('href').endsWith(currentPath)) {
                link.classList.add('active');
            }
        });

    } catch (error) {
        console.error(`Error loading partial ${filePath}:`, error);
        element.innerHTML = `<p style="color: red;">Failed to load ${filePath}</p>`;
    }
}

/**
 * Opens a modal. Assumes modals have `display: none` by default and uses `display: flex` to center.
 * @param {string} modalId - The ID of the modal element (e.g., 'event-details-modal').
 */
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
    } else {
        console.warn(`Modal with ID '${modalId}' not found.`);
    }
}

/**
 * Closes a modal.
 * @param {string} modalId - The ID of the modal element.
 */
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    } else {
        console.warn(`Modal with ID '${modalId}' not found.`);
    }
}

// Global click listener to close modals when clicking outside of modal content.
// This needs to be attached once.
window.addEventListener('click', function(event) {
    // Check if the clicked element is a modal backdrop (has class 'modal')
    // and not the content itself, which means it doesn't contain 'modal-content'
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
});

/**
 * Retrieves the JWT token from localStorage.
 * If no token is found, or if an auth error occurs, it redirects to the login page.
 * @returns {string|null} The JWT token if found, otherwise null (and redirects).
 */
function getAuthToken() {
    const token = localStorage.getItem('token');
    if (!token) {
        console.warn('No authentication token found. Redirecting to login.');
        alert('You are not logged in. Please log in first.');
        window.location.href = '/auth/login.html';
        return null;
    }
    return token;
}

/**
 * Handles common authentication errors (401 Unauthorized, 403 Forbidden).
 * Clears the token and redirects to the login page.
 * @param {object} response - The fetch API response object.
 * @returns {boolean} True if a redirect occurred due to auth error, false otherwise.
 */
async function handleAuthError(response) {
    if (response.status === 401 || response.status === 403) {
        console.error(`Authentication error (${response.status}). Redirecting to login.`);
        alert('Your session has expired or you are unauthorized. Please log in again.');
        localStorage.removeItem('token');
        window.location.href = '/auth/login.html';
        return true;
    }
    return false;
}

/**
 * Helper to parse JWT token for user ID and role (client-side, for display purposes only).
 * This should NOT be used for server-side authorization as client-side tokens can be tampered with.
 * @param {string} token - The JWT token.
 * @returns {object|null} Decoded token payload (id, role) or null if invalid.
 */
function decodeJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error("Failed to decode JWT token:", e);
        return null;
    }
}

// Global message display functions (can be used on any page)
const globalMessageDisplay = document.getElementById('global-message-display'); // Assuming a global message div in layout

/**
 * Displays a global success/error message.
 * Assumes a div with id="global-message-display" in the main layout (e.g., in navbar.html or index.html).
 * @param {string} message - The message text.
 * @param {'success'|'error'} type - The type of message.
 * @param {number} duration - How long to show the message in milliseconds (default 5000).
 */
// Replace your showGlobalMessage function in main.js with this:

function showGlobalMessage(message, type = 'info') {
    let container = document.getElementById('global-message-container');
    
    // Create container if it doesn't exist
    if (!container) {
        container = document.createElement('div');
        container.id = 'global-message-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 10px;
            max-width: 400px;
        `;
        document.body.appendChild(container);
    }

    // Create message element
    const messageEl = document.createElement('div');
    messageEl.className = `global-message ${type}`;
    
    // Base styles
    const baseStyles = `
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        display: flex;
        align-items: center;
        gap: 12px;
        animation: slideIn 0.3s ease-out;
        position: relative;
        font-size: 0.95em;
        line-height: 1.4;
    `;
    
    // Type-specific styles
    const typeStyles = {
        success: 'background-color: #d4edda; color: #155724; border-left: 4px solid #28a745;',
        error: 'background-color: #f8d7da; color: #721c24; border-left: 4px solid #dc3545;',
        warning: 'background-color: #fff3cd; color: #856404; border-left: 4px solid #ffc107;',
        info: 'background-color: #d1ecf1; color: #0c5460; border-left: 4px solid #17a2b8;'
    };
    
    messageEl.style.cssText = baseStyles + (typeStyles[type] || typeStyles.info);
    
    // Choose icon based on type
    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };
    
    messageEl.innerHTML = `
        <span style="font-size: 1.3em; flex-shrink: 0;">${icons[type] || icons.info}</span>
        <span style="flex-grow: 1;">${message}</span>
        <button class="global-message-close" style="background: none; border: none; font-size: 1.2em; cursor: pointer; opacity: 0.6; padding: 0; width: 20px; height: 20px;" aria-label="Close">×</button>
    `;
    
    // Add animation styles if not already added
    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(400px); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(400px); opacity: 0; }
            }
            .global-message.removing {
                animation: slideOut 0.3s ease-out forwards;
            }
            .global-message-close:hover {
                opacity: 1 !important;
            }
            @media (max-width: 768px) {
                #global-message-container {
                    right: 10px !important;
                    left: 10px !important;
                    max-width: none !important;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Add to container
    container.appendChild(messageEl);
    
    // Add close button functionality
    const closeBtn = messageEl.querySelector('.global-message-close');
    closeBtn.addEventListener('click', () => removeMessage(messageEl));
    
    // Auto-remove after duration (longer for errors)
    const duration = type === 'error' ? 7000 : 5000;
    setTimeout(() => removeMessage(messageEl), duration);
}

function removeMessage(messageEl) {
    if (!messageEl || !messageEl.parentNode) return;
    
    messageEl.classList.add('removing');
    setTimeout(() => {
        if (messageEl.parentNode) {
            messageEl.parentNode.removeChild(messageEl);
        }
    }, 300);
}