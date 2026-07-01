

let socket;
let currentChatPartnerId = null;
let currentChatPartnerName = null;
let currentUserId = null;
let currentUserRole = null;

// --- DOM Elements ---
const conversationsList = document.getElementById('conversations-list');
const chatArea = document.querySelector('.chat-area');
const chatHeader = document.querySelector('.chat-header');
const chatMessages = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const sendMessageBtn = document.getElementById('send-message-btn');
const noChatSelectedMessage = document.getElementById('no-chat-selected');
const chatLoadingSpinner = document.getElementById('chat-loading-spinner');
const chatErrorMessage = document.getElementById('chat-error-message');


// --- Utility Functions ---

/**
 * Displays a message in the chat area.
 */
function addMessageToUI(message, isOwnMessage) {
    if (!chatMessages) return;
    
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message', isOwnMessage ? 'sent' : 'received');

    const senderName = (isOwnMessage ? 'You' : currentChatPartnerName);
    const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    messageElement.innerHTML = `
        <div class="message-bubble">
            <span class="message-text">${escapeHtml(message.message)}</span>
            <span class="message-info">${senderName} - ${time}</span>
        </div>
    `;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function displayChatError(message) {
    if (chatErrorMessage) {
        chatErrorMessage.textContent = message;
        chatErrorMessage.style.display = 'block';
    }
    if (chatLoadingSpinner) {
        chatLoadingSpinner.style.display = 'none';
    }
    if (chatMessages) {
        chatMessages.innerHTML = '';
    }
}

function hideChatError() {
    if (chatErrorMessage) {
        chatErrorMessage.style.display = 'none';
        chatErrorMessage.textContent = '';
    }
}

/**
 * Redirects to login if not authenticated or session expired.
 */
function handleAuthRedirect() {
    alert('Session expired or unauthorized. Please log in again.');
    localStorage.removeItem('token');
    window.location.href = '/auth/login.html';
}

/**
 * Escape HTML to prevent XSS attacks
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// --- Check for vendor redirect ---
function checkVendorRedirect() {
    const selectedVendorId = sessionStorage.getItem('selectedVendorId');
    const selectedVendorName = sessionStorage.getItem('selectedVendorName');

    console.log('Checking vendor redirect:', selectedVendorId, selectedVendorName);

    if (selectedVendorId && selectedVendorName) {
        console.log('Opening conversation with vendor:', selectedVendorName);
        
        // Wait a bit for conversations to load
        setTimeout(() => {
            // Try to find existing conversation
            const conversationItem = document.querySelector(`.conversation-item[data-partner-id="${selectedVendorId}"]`);

            if (conversationItem) {
                console.log('Found existing conversation, opening it');
                conversationItem.click();
            } else {
                console.log('No existing conversation, starting new one');
                startNewConversation(selectedVendorId, selectedVendorName);
            }

            // Clear session storage
            sessionStorage.removeItem('selectedVendorId');
            sessionStorage.removeItem('selectedVendorName');
        }, 1000);
    }
}

/**
 * Start a new conversation with a vendor
 */
function startNewConversation(vendorId, vendorName) {
    console.log('Starting new conversation with:', vendorName);
    
    currentChatPartnerId = vendorId;
    currentChatPartnerName = vendorName;

    // Update UI
    if (noChatSelectedMessage) {
        noChatSelectedMessage.style.display = 'none';
    }
    
    if (chatHeader) {
        const headerTitle = chatHeader.querySelector('h2');
        if (headerTitle) headerTitle.textContent = `Chat with ${vendorName}`;
    }

    // Clear and setup chat area
    if (chatMessages) {
        chatMessages.innerHTML = `
            <div style="
    text-align: center; 
    padding: 40px; 
    color: #999; 
    font-family: 'Cormorant Garamond', serif;
    font-size: 1.1em;
">
    <i class="fas fa-comments fa-3x" style="
        display: block; 
        margin-bottom: 15px; 
        color: #007bff;
        font-size: 3em;
    "></i>
    <p style="
        margin-top: 15px; 
        color: #000000; 
        font-weight: 400;
        line-height: 1.6;
    ">Start a conversation with <strong style="color: #F9CA24; font-weight: 600;">${vendorName}</strong></p>
    <p style="
        font-size: 0.9em; 
        color: #666666; 
        margin-top: 10px;
        line-height: 1.4;
    ">Send your first message below to begin chatting!</p>
</div>
        `;
    }

    // Enable input
    if (messageInput) {
        messageInput.disabled = false;
        messageInput.placeholder = 'Type your message...';
        messageInput.focus();
    }
    
    if (sendMessageBtn) {
        sendMessageBtn.disabled = false;
    }

    // Scroll to show the input area
    if (chatMessages) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

// --- Socket.IO & Chat Core Logic ---

/**
 * Initializes the Socket.IO connection and listeners.
 */
function initSocketConnection() {
    const token = localStorage.getItem('token');
    if (!token) {
        handleAuthRedirect();
        return;
    }

    try {
        const decodedToken = JSON.parse(atob(token.split('.')[1]));
        currentUserId = decodedToken.id;
        currentUserRole = decodedToken.role;
        console.log('Current user:', currentUserId, currentUserRole);
    } catch (e) {
        console.error("Failed to decode token:", e);
        handleAuthRedirect();
        return;
    }

    // Check if io is available
    if (typeof io === 'undefined') {
        console.error('Socket.IO not loaded. Make sure /socket.io/socket.io.js is included before chat.js');
        displayChatError('Chat server not available. Please refresh the page.');
        return;
    }

    socket = io({
        auth: {
            token: token
        }
    });

    socket.on('connect', () => {
        console.log('Connected to Socket.IO server');
        fetchConversations();
        
        // Check for vendor redirect after connection
        setTimeout(() => {
            checkVendorRedirect();
        }, 500);
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from Socket.IO server');
    });

    socket.on('connect_error', (error) => {
        console.error('Socket.IO connection error:', error.message);
        if (error.message === 'Authentication error') {
            handleAuthRedirect();
        }
        displayChatError(`Failed to connect to chat: ${error.message}. Please try again later.`);
    });

    socket.on('receiveMessage', (message) => {
        console.log('Received message:', message);
        // Only add messages relevant to current conversation
        if (message.senderId === currentChatPartnerId || message.receiverId === currentChatPartnerId) {
            addMessageToUI(message, message.senderId === currentUserId);
        }
        updateConversationListOnNewMessage(message);
    });

    socket.on('newMessageNotification', (data) => {
        console.log('New message notification:', data);
        fetchConversations();
    });
}

/**
 * Fetches the list of conversations for the current user.
 */
async function fetchConversations() {
    if (!conversationsList) {
        console.error('conversations-list element not found');
        return;
    }
    
    conversationsList.innerHTML = '<li class="loading-item"><i class="fas fa-spinner fa-spin"></i> Loading conversations...</li>';
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const response = await fetch('/api/messages/conversations', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.status === 401 || response.status === 403) {
            handleAuthRedirect();
            return;
        }
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Conversations loaded:', data.conversations);
        renderConversations(data.conversations);

    } catch (error) {
        console.error('Error fetching conversations:', error);
        conversationsList.innerHTML = `<li class="error-item">Failed to load conversations: ${error.message}</li>`;
    }
}

/**
 * Renders the list of conversations in the sidebar.
 */
function renderConversations(conversations) {
    if (!conversationsList) return;
    
    conversationsList.innerHTML = '';
    if (conversations.length === 0) {
        conversationsList.innerHTML = `
            <li class="no-conversations-item">
                <i class="fas fa-inbox" style="font-size:2em; color:#ccc; margin-bottom:10px; display:block;"></i>
                <p>No active conversations.</p>
                <p style="font-size:0.9em; color:#999;">Find a vendor to start chatting!</p>
            </li>
        `;
        return;
    }

    conversations.forEach(conv => {
        const listItem = document.createElement('li');
        listItem.classList.add('conversation-item');
        if (conv.partnerId === currentChatPartnerId) {
            listItem.classList.add('active');
        }
        listItem.dataset.partnerId = conv.partnerId;
        listItem.dataset.partnerName = conv.partnerName;

        const lastMessageTime = conv.lastMessageTimestamp ? new Date(conv.lastMessageTimestamp).toLocaleDateString() : '';

        listItem.innerHTML = `
            <div class="partner-name">${conv.partnerName}</div>
            <div class="last-message">${conv.lastMessage || 'Start a conversation'}</div>
            <div class="last-message-time">${lastMessageTime}</div>
        `;
        conversationsList.appendChild(listItem);

        listItem.addEventListener('click', () => openConversation(conv.partnerId, conv.partnerName));
    });
}

/**
 * Updates a conversation item in the list after a new message.
 */
function updateConversationListOnNewMessage(message) {
    if (!conversationsList) return;
    
    const partnerId = message.senderId === currentUserId ? message.receiverId : message.senderId;
    const listItem = document.querySelector(`.conversation-item[data-partner-id="${partnerId}"]`);

    if (listItem) {
        conversationsList.prepend(listItem);
        const lastMsgEl = listItem.querySelector('.last-message');
        const lastTimeEl = listItem.querySelector('.last-message-time');
        if (lastMsgEl) lastMsgEl.textContent = message.message;
        if (lastTimeEl) lastTimeEl.textContent = new Date(message.timestamp).toLocaleDateString();
        
        if (partnerId !== currentChatPartnerId) {
            listItem.classList.add('unread');
        }
    } else {
        fetchConversations();
    }
}

/**
 * Opens a specific chat conversation, loads history, and sets up header.
 */
async function openConversation(partnerId, partnerName) {
    if (currentChatPartnerId === partnerId) return;

    console.log('Opening conversation with:', partnerName);

    document.querySelectorAll('.conversation-item').forEach(item => item.classList.remove('active', 'unread'));

    currentChatPartnerId = partnerId;
    currentChatPartnerName = partnerName;

    const activeConvItem = document.querySelector(`.conversation-item[data-partner-id="${partnerId}"]`);
    if (activeConvItem) {
        activeConvItem.classList.add('active');
        activeConvItem.classList.remove('unread');
    }

    if (chatHeader) {
        const headerTitle = chatHeader.querySelector('h2');
        if (headerTitle) headerTitle.textContent = `Chat with ${partnerName}`;
    }
    
    if (noChatSelectedMessage) noChatSelectedMessage.style.display = 'none';
    if (chatMessages) chatMessages.innerHTML = '';
    if (messageInput) {
        messageInput.value = '';
        messageInput.disabled = false;
        messageInput.placeholder = 'Type your message...';
    }
    if (sendMessageBtn) {
        sendMessageBtn.disabled = false;
    }

    hideChatError();
    if (chatLoadingSpinner) chatLoadingSpinner.style.display = 'block';
    if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;

    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const response = await fetch(`/api/messages/${partnerId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.status === 401 || response.status === 403) {
            handleAuthRedirect();
            return;
        }
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Chat history loaded:', data.messages.length, 'messages');
        data.messages.forEach(msg => addMessageToUI(msg, msg.senderId === currentUserId));

    } catch (error) {
        console.error('Error fetching chat history:', error);
        displayChatError(`Failed to load chat history: ${error.message}`);
    } finally {
        if (chatLoadingSpinner) chatLoadingSpinner.style.display = 'none';
        if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
        if (messageInput) messageInput.focus();
    }
}

/**
 * Sends a message via Socket.IO.
 * FIXED: Removed duplicate message addition - now only adds via receiveMessage event
 */
function sendMessage() {
    if (!messageInput) return;
    
    const message = messageInput.value.trim();
    
    console.log('Attempting to send message:', message, 'to:', currentChatPartnerId);
    
    if (!message) {
        console.log('Empty message, not sending');
        return;
    }
    
    if (!currentChatPartnerId) {
        alert('Please select a conversation to send a message.');
        return;
    }
    
    if (!socket || !socket.connected) {
        alert('Not connected to chat server. Please refresh the page.');
        return;
    }
    
    const messageData = {
        receiverId: currentChatPartnerId,
        message: message,
        timestamp: new Date().toISOString()
    };
    
    console.log('Sending message via socket:', messageData);
    
    socket.emit('sendMessage', messageData, (response) => {
        if (response && response.status === 'ok') {
            console.log('Message sent confirmed by server.');
            if (messageInput) {
                messageInput.value = '';
                messageInput.style.height = 'auto';
            }
            // REMOVED: Don't add message here - it will be added via receiveMessage event
            // The server will emit receiveMessage to both sender and receiver
        } else {
            console.error('Failed to send message:', response ? response.message : 'No response');
            alert(`Failed to send message: ${response ? response.message : 'Unknown error'}`);
        }
    });
}

// --- Event Listeners ---
function setupEventListeners() {
    if (!sendMessageBtn || !messageInput) {
        console.error('Message input or send button not found');
        return;
    }

    sendMessageBtn.addEventListener('click', (e) => {
        e.preventDefault();
        sendMessage();
    });

    // Auto-resize textarea as user types
    messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 100) + 'px';
    });
    
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
}

// --- Initialization on Page Load ---
document.addEventListener('DOMContentLoaded', () => {
    console.log('Chat page loaded');
    
    // Keep chat area visible, just show the "no chat selected" message
    if (noChatSelectedMessage) {
        noChatSelectedMessage.style.display = 'block';
    }
    
    // Disable input until a conversation is selected
    if (messageInput) {
        messageInput.disabled = true;
        messageInput.placeholder = 'Select a conversation to start messaging...';
    }
    if (sendMessageBtn) {
        sendMessageBtn.disabled = true;
    }

    // Setup event listeners
    setupEventListeners();

    // Initialize socket connection
    initSocketConnection();
});