// WebSocket client for real-time messaging

// Initialize socket connection
let socket;
let typingTimeout;
let isConnected = false;
let reconnectAttempts = 0;
let maxReconnectAttempts = 5;
let reconnectInterval = 3000; // 3 seconds

// User status tracking
const userStatus = {};

// Initialize socket connection
function initSocket() {
    // Check if socket.io is loaded
    if (typeof io === 'undefined') {
        console.error('Socket.IO not loaded');
        return;
    }

    // Create socket connection
    socket = io({
        transports: ['polling'], // Use only polling, no WebSockets
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5
    });

    // Connection events
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);

    // Message events
    socket.on('new_message', handleNewMessage);
    socket.on('message_delivered', handleMessageDelivered);
    socket.on('message_read', handleMessageRead);

    // Typing events
    socket.on('typing_status', handleTypingStatus);

    // User status events
    socket.on('user_status', handleUserStatus);

    // Conversation events
    socket.on('conversation_status', handleConversationStatus);
}

// Handle socket connection
function handleConnect() {
    console.log('Connected to WebSocket server');
    isConnected = true;
    reconnectAttempts = 0;

    // Join conversation if on message page
    const recipientInput = document.querySelector('input[name="recipient"]');
    if (recipientInput && recipientInput.value) {
        joinConversation(recipientInput.value);
    }

    // Update UI to show connected status
    document.body.classList.remove('socket-disconnected');
    document.body.classList.add('socket-connected');

    // Show connection status
    showConnectionStatus(true);
}

// Handle socket disconnection
function handleDisconnect() {
    console.log('Disconnected from WebSocket server');
    isConnected = false;

    // Update UI to show disconnected status
    document.body.classList.remove('socket-connected');
    document.body.classList.add('socket-disconnected');

    // Show connection status
    showConnectionStatus(false);

    // Attempt to reconnect
    if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        setTimeout(() => {
            if (!isConnected) {
                console.log(`Attempting to reconnect (${reconnectAttempts}/${maxReconnectAttempts})...`);
                socket.connect();
            }
        }, reconnectInterval);
    }
}

// Handle connection errors
function handleConnectError(error) {
    console.error('Connection error:', error);

    // Show error message
    showConnectionStatus(false, 'Connection error. Please check your internet connection.');
}

// Join a conversation
function joinConversation(username) {
    if (!isConnected || !username) return;

    // Get user ID from username
    getUserIdFromUsername(username)
        .then(userId => {
            if (userId) {
                socket.emit('join_conversation', { user_id: userId });
                console.log(`Joined conversation with ${username} (ID: ${userId})`);
            }
        })
        .catch(error => {
            console.error('Error getting user ID:', error);
        });
}

// Leave a conversation
function leaveConversation(username) {
    if (!isConnected || !username) return;

    // Get user ID from username
    getUserIdFromUsername(username)
        .then(userId => {
            if (userId) {
                socket.emit('leave_conversation', { user_id: userId });
                console.log(`Left conversation with ${username} (ID: ${userId})`);
            }
        })
        .catch(error => {
            console.error('Error getting user ID:', error);
        });
}

// Send a message via WebSocket
function sendMessageViaSocket(recipientUsername, content, clientMessageId) {
    if (!isConnected || !recipientUsername || !content) {
        return Promise.reject(new Error('Cannot send message: not connected or missing data'));
    }

    return new Promise((resolve, reject) => {
        // Get user ID from username
        getUserIdFromUsername(recipientUsername)
            .then(recipientId => {
                if (!recipientId) {
                    reject(new Error('Recipient not found'));
                    return;
                }

                // Prepare message data
                const messageData = {
                    recipient_id: recipientId,
                    content: content,
                    client_message_id: clientMessageId
                };

                // Send message via socket
                socket.emit('send_message', messageData, (response) => {
                    if (response && response.error) {
                        reject(new Error(response.error));
                    } else if (response && response.success) {
                        resolve(response.message);
                    } else {
                        reject(new Error('Unknown error sending message'));
                    }
                });
            })
            .catch(error => {
                reject(error);
            });
    });
}

// Handle new message received
function handleNewMessage(message) {
    console.log('New message received:', message);

    // Check if we're in a conversation with this user
    const recipientInput = document.querySelector('input[name="recipient"]');
    const isCurrentConversation = recipientInput &&
        (recipientInput.value === getUsernameFromId(message.sender_id) ||
         recipientInput.value === getUsernameFromId(message.recipient_id));

    if (isCurrentConversation) {
        // Add message to cache and UI
        if (messageCache && typeof messageCache.addMessage === 'function') {
            messageCache.addMessage(recipientInput.value, message);

            // Append to UI if not already there
            if (typeof appendMessageToUI === 'function') {
                appendMessageToUI(message);
            }

            // Mark as read if we're the recipient
            if (message.sender_id !== window.currentUserId && !message.read) {
                markMessageAsRead(message.id);
            }
        }
    } else {
        // Show notification for message from other conversation
        showMessageNotification(message);
    }
}

// Handle message delivered status
function handleMessageDelivered(data) {
    console.log('Message delivered:', data);

    // Update message in cache and UI
    if (messageCache && typeof messageCache.updateMessage === 'function') {
        messageCache.updateMessage(data.message_id, {
            delivered: true,
            delivered_at: data.delivered_at
        });
    }

    // Update UI
    const messageElement = document.querySelector(`.message[data-message-id="${data.message_id}"]`);
    if (messageElement) {
        // Update status indicator
        const timeEl = messageElement.querySelector('.message-time');
        if (timeEl) {
            const statusHTML = `<span class="message-status delivered-status ms-1" title="Delivered ${new Date(data.delivered_at).toLocaleString()}"><i class="fas fa-check"></i></span>`;
            const existingStatus = timeEl.querySelector('.message-status');
            if (existingStatus) {
                existingStatus.outerHTML = statusHTML;
            } else {
                timeEl.innerHTML += statusHTML;
            }
        }
    }
}

// Handle message read status
function handleMessageRead(data) {
    console.log('Message read:', data);

    // Update message in cache and UI
    if (messageCache && typeof messageCache.updateMessage === 'function') {
        messageCache.updateMessage(data.message_id, {
            read: true,
            read_at: data.read_at
        });
    }

    // Update UI
    const messageElement = document.querySelector(`.message[data-message-id="${data.message_id}"]`);
    if (messageElement) {
        // Update status indicator
        const timeEl = messageElement.querySelector('.message-time');
        if (timeEl) {
            const statusHTML = `<span class="message-status read-status ms-1" title="Read ${new Date(data.read_at).toLocaleString()}"><i class="fas fa-check-double"></i></span>`;
            const existingStatus = timeEl.querySelector('.message-status');
            if (existingStatus) {
                existingStatus.outerHTML = statusHTML;
            } else {
                timeEl.innerHTML += statusHTML;
            }
        }
    }
}

// Mark message as read
function markMessageAsRead(messageId) {
    if (!isConnected || !messageId) return;

    socket.emit('read_message', { message_id: messageId }, (response) => {
        if (response && response.error) {
            console.error('Error marking message as read:', response.error);
        }
    });
}

// Handle typing status
function handleTypingStatus(data) {
    console.log('Typing status:', data);

    // Check if we're in a conversation with this user
    const recipientInput = document.querySelector('input[name="recipient"]');
    const isCurrentConversation = recipientInput && recipientInput.value === getUsernameFromId(data.user_id);

    if (isCurrentConversation) {
        // Update typing indicator
        updateTypingIndicator(data.status);
    }
}

// Send typing status
function sendTypingStatus(recipientUsername, isTyping) {
    if (!isConnected || !recipientUsername) return;

    // Get user ID from username
    getUserIdFromUsername(recipientUsername)
        .then(recipientId => {
            if (recipientId) {
                socket.emit('typing', {
                    recipient_id: recipientId,
                    typing: isTyping
                });
            }
        })
        .catch(error => {
            console.error('Error getting user ID:', error);
        });
}

// Update typing indicator in UI
function updateTypingIndicator(isTyping) {
    const typingIndicator = document.querySelector('.typing-indicator');

    if (isTyping) {
        // Create typing indicator if it doesn't exist
        if (!typingIndicator) {
            const indicator = document.createElement('div');
            indicator.className = 'typing-indicator';
            indicator.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div> Typing...';

            // Add to conversation container
            const conversationContainer = document.querySelector('.conversation-container');
            if (conversationContainer) {
                conversationContainer.appendChild(indicator);
            }
        }
    } else {
        // Remove typing indicator
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }
}

// Handle user status updates
function handleUserStatus(data) {
    console.log('User status:', data);

    // Update user status
    userStatus[data.user_id] = data.status;

    // Update UI
    updateUserStatusUI(data.user_id, data.status);
}

// Update user status in UI
function updateUserStatusUI(userId, status) {
    // Update status indicators in conversation header
    const conversationHeader = document.querySelector('.conversation-header');
    if (conversationHeader) {
        const recipientInput = document.querySelector('input[name="recipient"]');
        const isCurrentConversation = recipientInput && recipientInput.value === getUsernameFromId(userId);

        if (isCurrentConversation) {
            // Update status indicator
            let statusIndicator = conversationHeader.querySelector('.user-status-indicator');

            if (!statusIndicator) {
                // Create status indicator
                statusIndicator = document.createElement('span');
                statusIndicator.className = 'user-status-indicator ms-2';
                conversationHeader.querySelector('h5').appendChild(statusIndicator);
            }

            // Update indicator
            statusIndicator.className = `user-status-indicator ms-2 ${status}-status`;
            statusIndicator.setAttribute('title', status === 'online' ? 'Online' : 'Offline');
        }
    }

    // Update status indicators in inbox
    const userItems = document.querySelectorAll(`.list-group-item[data-user-id="${userId}"]`);
    userItems.forEach(item => {
        let statusIndicator = item.querySelector('.user-status-indicator');

        if (!statusIndicator) {
            // Create status indicator
            statusIndicator = document.createElement('span');
            statusIndicator.className = 'user-status-indicator ms-2';
            item.querySelector('.d-flex').appendChild(statusIndicator);
        }

        // Update indicator
        statusIndicator.className = `user-status-indicator ${status}-status`;
        statusIndicator.setAttribute('title', status === 'online' ? 'Online' : 'Offline');
    });
}

// Handle conversation status updates
function handleConversationStatus(data) {
    console.log('Conversation status:', data);

    // Check if user joined the conversation
    if (data.status === 'joined') {
        // Show notification that user has joined
        showSystemMessage(`${getUsernameFromId(data.user_id)} has joined the conversation`);
    }
}

// Show system message in conversation
function showSystemMessage(message) {
    const conversationContainer = document.querySelector('.conversation');
    if (!conversationContainer) return;

    // Create system message element
    const systemMessage = document.createElement('div');
    systemMessage.className = 'system-message';
    systemMessage.textContent = message;

    // Add to conversation
    conversationContainer.appendChild(systemMessage);

    // Scroll to bottom
    conversationContainer.scrollTop = conversationContainer.scrollHeight;
}

// Show connection status
function showConnectionStatus(isConnected, message) {
    // Create or update connection status element
    let statusElement = document.querySelector('.connection-status');

    if (!statusElement) {
        statusElement = document.createElement('div');
        statusElement.className = 'connection-status';
        document.body.appendChild(statusElement);
    }

    // Update status
    if (isConnected) {
        statusElement.className = 'connection-status connected';
        statusElement.textContent = 'Connected';

        // Hide after 3 seconds
        setTimeout(() => {
            statusElement.classList.add('fade-out');
            setTimeout(() => {
                statusElement.remove();
            }, 500);
        }, 3000);
    } else {
        statusElement.className = 'connection-status disconnected';
        statusElement.textContent = message || 'Disconnected';
    }
}

// Show notification for new message
function showMessageNotification(message) {
    // Check if browser supports notifications
    if (!('Notification' in window)) {
        console.log('This browser does not support desktop notifications');
        return;
    }

    // Check if permission is granted
    if (Notification.permission === 'granted') {
        createNotification(message);
    } else if (Notification.permission !== 'denied') {
        // Request permission
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                createNotification(message);
            }
        });
    }
}

// Create notification
function createNotification(message) {
    // Get sender username
    const senderUsername = getUsernameFromId(message.sender_id);

    // Create notification
    const notification = new Notification('New Message', {
        body: `${senderUsername}: ${message.content}`,
        icon: '/static/img/logo.png'
    });

    // Handle notification click
    notification.onclick = function() {
        window.focus();
        window.location.href = `/messages/conversation/${senderUsername}`;
        notification.close();
    };

    // Auto close after 5 seconds
    setTimeout(() => {
        notification.close();
    }, 5000);
}

// Helper function to get user ID from username
function getUserIdFromUsername(username) {
    return new Promise((resolve, reject) => {
        // Check if we have a cached user ID
        const cachedUserId = localStorage.getItem(`user_id_${username}`);
        if (cachedUserId) {
            resolve(parseInt(cachedUserId));
            return;
        }

        // Fetch user ID from server
        fetch(`/api/users/get_id?username=${encodeURIComponent(username)}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to get user ID');
                }
                return response.json();
            })
            .then(data => {
                if (data.user_id) {
                    // Cache user ID
                    localStorage.setItem(`user_id_${username}`, data.user_id);
                    resolve(data.user_id);
                } else {
                    reject(new Error('User not found'));
                }
            })
            .catch(error => {
                console.error('Error getting user ID:', error);
                reject(error);
            });
    });
}

// Helper function to get username from user ID
function getUsernameFromId(userId) {
    // Check localStorage for cached username
    const cachedUsername = localStorage.getItem(`username_${userId}`);
    if (cachedUsername) {
        return cachedUsername;
    }

    // If not found in cache, return placeholder and fetch in background
    fetchUsernameFromId(userId);
    return `User ${userId}`;
}

// Fetch username from user ID and cache it
function fetchUsernameFromId(userId) {
    fetch(`/api/users/get_username?user_id=${userId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to get username');
            }
            return response.json();
        })
        .then(data => {
            if (data.username) {
                // Cache username
                localStorage.setItem(`username_${userId}`, data.username);

                // Update any UI elements showing this user ID
                updateUserDisplayNames(userId, data.username);
            }
        })
        .catch(error => {
            console.error('Error getting username:', error);
        });
}

// Update UI elements with username
function updateUserDisplayNames(userId, username) {
    // Update conversation header
    const conversationHeader = document.querySelector('.conversation-header');
    if (conversationHeader) {
        const recipientInput = document.querySelector('input[name="recipient"]');
        const currentUsername = recipientInput ? recipientInput.value : null;

        if (currentUsername === `User ${userId}`) {
            // Update recipient input
            recipientInput.value = username;

            // Update header title
            const headerTitle = conversationHeader.querySelector('h5');
            if (headerTitle) {
                headerTitle.textContent = username;
            }
        }
    }

    // Update message sender/recipient displays
    document.querySelectorAll(`.user-${userId}-name`).forEach(element => {
        element.textContent = username;
    });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize socket connection
    initSocket();

    // Set up message input for typing indicator
    const messageInput = document.getElementById('message-input');
    if (messageInput) {
        messageInput.addEventListener('input', function() {
            const recipientInput = document.querySelector('input[name="recipient"]');
            if (!recipientInput || !recipientInput.value) return;

            // Clear previous timeout
            clearTimeout(typingTimeout);

            // Send typing status
            sendTypingStatus(recipientInput.value, true);

            // Set timeout to clear typing status
            typingTimeout = setTimeout(() => {
                sendTypingStatus(recipientInput.value, false);
            }, 3000);
        });

        // Clear typing status when focus is lost
        messageInput.addEventListener('blur', function() {
            const recipientInput = document.querySelector('input[name="recipient"]');
            if (!recipientInput || !recipientInput.value) return;

            clearTimeout(typingTimeout);
            sendTypingStatus(recipientInput.value, false);
        });
    }

    // Handle page unload
    window.addEventListener('beforeunload', function() {
        // Leave conversation if on message page
        const recipientInput = document.querySelector('input[name="recipient"]');
        if (recipientInput && recipientInput.value) {
            leaveConversation(recipientInput.value);
        }
    });
});
