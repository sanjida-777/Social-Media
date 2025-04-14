// Messages JavaScript functionality

// Cache for messages to reduce API calls
const messageCache = {
    conversations: {},
    addMessage: function(conversationId, message) {
        if (!this.conversations[conversationId]) {
            this.conversations[conversationId] = [];
        }
        // Check if message already exists by ID or client_message_id
        const exists = this.conversations[conversationId].some(m =>
            m.id === message.id ||
            (m.client_message_id && message.client_message_id &&
             m.client_message_id === message.client_message_id));
        if (!exists) {
            this.conversations[conversationId].push(message);
            return true; // Message was added
        }
        return false; // Message already existed
    },
    getMessages: function(conversationId) {
        return this.conversations[conversationId] || [];
    },
    updateMessage: function(messageId, updates) {
        // Update message in all conversations
        Object.keys(this.conversations).forEach(convId => {
            const messages = this.conversations[convId];
            const index = messages.findIndex(m => m.id === messageId);
            if (index !== -1) {
                this.conversations[convId][index] = { ...messages[index], ...updates };
            }
        });
    },
    clear: function() {
        this.conversations = {};
    }
};

// Network status tracking
let isOnline = navigator.onLine;
window.addEventListener('online', () => {
    isOnline = true;
    document.body.classList.remove('offline');
    syncOfflineMessages();
});
window.addEventListener('offline', () => {
    isOnline = false;
    document.body.classList.add('offline');
});

// Queue for offline messages
const offlineQueue = {
    messages: JSON.parse(localStorage.getItem('offlineMessages') || '[]'),
    add: function(message) {
        this.messages.push(message);
        this.save();
    },
    remove: function(clientMessageId) {
        this.messages = this.messages.filter(m => m.client_message_id !== clientMessageId);
        this.save();
    },
    save: function() {
        localStorage.setItem('offlineMessages', JSON.stringify(this.messages));
    },
    clear: function() {
        this.messages = [];
        localStorage.removeItem('offlineMessages');
    }
};

// Sync offline messages when back online
function syncOfflineMessages() {
    if (offlineQueue.messages.length > 0 && isOnline) {
        const messagesToSync = [...offlineQueue.messages];
        messagesToSync.forEach(message => {
            sendMessage(message.recipient, message.content, message.client_message_id)
                .then(() => {
                    offlineQueue.remove(message.client_message_id);
                })
                .catch(error => {
                    console.error('Error syncing offline message:', error);
                });
        });
    }
}

// Send a message via API
async function sendMessage(recipient, content, clientMessageId) {
    if (!isOnline) {
        // Store message for later sync
        offlineQueue.add({
            recipient,
            content,
            client_message_id: clientMessageId,
            timestamp: new Date().toISOString()
        });

        // Return a mock message for UI display
        return {
            id: 'offline-' + clientMessageId,
            content,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            read: false,
            delivered: false,
            edited: false,
            deleted: false,
            sender_id: currentUserId, // This should be set globally
            recipient_id: 0, // Placeholder
            client_message_id: clientMessageId,
            offline: true
        };
    }

    try {
        // Create URL for API call
        const apiUrl = `/messages/api/messages/${recipient}`;

        // Check if this call is already in progress
        if (apiCallTracker.isCallInProgress(apiUrl + '-post-' + clientMessageId)) {
            throw new Error('Message send already in progress');
        }

        // Track this API call
        apiCallTracker.trackCall(apiUrl + '-post-' + clientMessageId);

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                content,
                client_message_id: clientMessageId
            }),
        });

        if (!response.ok) {
            throw new Error('Failed to send message');
        }

        const result = await response.json();

        // Clear API call tracking
        apiCallTracker.clearCall(apiUrl + '-post-' + clientMessageId);

        return result;
    } catch (error) {
        console.error('Error sending message:', error);
        throw error;
    } finally {
        // Ensure API call tracking is cleared even on error
        const apiUrl = `/messages/api/messages/${recipient}`;
        apiCallTracker.clearCall(apiUrl + '-post-' + clientMessageId);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Set current user ID from the page
    window.currentUserId = document.querySelector('meta[name="user-id"]')?.content;

    // Scroll to bottom of conversation
    const conversationContainer = document.querySelector('.conversation');

    if (conversationContainer) {
        conversationContainer.scrollTop = conversationContainer.scrollHeight;

        // Auto-resize message input as user types
        const messageInput = document.querySelector('textarea[name="content"]');

        if (messageInput) {
            messageInput.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = (this.scrollHeight) + 'px';

                // Keep the conversation scrolled to the bottom as the input grows
                conversationContainer.scrollTop = conversationContainer.scrollHeight;

                // Show typing indicator (in a real app, this would notify the other user)
                const typingIndicator = document.querySelector('.typing-indicator');
                if (typingIndicator) {
                    typingIndicator.classList.remove('d-none');
                    clearTimeout(window.typingTimeout);
                    window.typingTimeout = setTimeout(() => {
                        typingIndicator.classList.add('d-none');
                    }, 2000);
                }
            });

            // Focus the input field when the page loads
            messageInput.focus();
        }

        // Setup message form with offline support
        const messageForm = document.getElementById('message-form');
        if (messageForm) {
            // Add debounce to prevent multiple rapid submissions
            let isSubmitting = false;
            messageForm.addEventListener('submit', async function(e) {
                // Prevent multiple submissions
                if (isSubmitting) {
                    e.preventDefault();
                    return;
                }
                isSubmitting = true;
                e.preventDefault();

                const messageInput = document.getElementById('message-input');
                const content = messageInput.value.trim();
                if (!content) return;

                const recipient = document.querySelector('input[name="recipient"]').value;
                // Always generate a new UUID for each message
                const clientMessageId = generateUUID();
                // Update the hidden field value
                const clientMessageIdField = document.querySelector('input[name="client_message_id"]');
                if (clientMessageIdField) {
                    clientMessageIdField.value = clientMessageId;
                }

                // Disable form while sending
                messageInput.disabled = true;
                document.getElementById('send-button').disabled = true;

                try {
                    // Send message (handles both online and offline)
                    const message = await sendMessage(recipient, content, clientMessageId);

                    // Clear input
                    messageInput.value = '';
                    messageInput.style.height = 'auto';

                    // Add to cache and update UI
                    // We always show the message we just sent, even if it's a duplicate
                    messageCache.addMessage(recipient, message);
                    appendMessageToUI(message);

                    // Update the last message ID in the sync state
                    if (window.messageSyncState) {
                        window.messageSyncState.lastMessageId = message.id;
                        window.messageSyncState.lastPollTime = Date.now();

                        // Trigger a sync to get any other messages that might have been sent
                        // This helps with conversations where both users are actively typing
                        setTimeout(() => {
                            syncMessages();
                        }, 1000); // Wait 1 second before syncing to allow server processing
                    }

                    // Scroll to bottom
                    conversationContainer.scrollTop = conversationContainer.scrollHeight;
                } catch (error) {
                    console.error('Error sending message:', error);
                    alert('Failed to send message. Please try again.');
                } finally {
                    // Re-enable form after a short delay
                    setTimeout(() => {
                        messageInput.disabled = false;
                        document.getElementById('send-button').disabled = false;
                        messageInput.focus();
                        isSubmitting = false;

                        // Clear API call tracking
                        const apiUrl = `/messages/api/messages/${recipient}`;
                        apiCallTracker.clearCall(apiUrl + '-post-' + clientMessageId);
                    }, 500); // 500ms delay to prevent accidental double-clicks
                }
            });
        }
    }

    // Username autocomplete for new message
    const recipientInput = document.querySelector('input[name="recipient"]');

    if (recipientInput) {
        let debounceTimeout;
        recipientInput.addEventListener('input', function() {
            clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(() => {
                // In a real app, this would make an AJAX call to search for users
                console.log('Searching for user:', this.value);
            }, 300);
        });
    }

    // Delete message confirmation
    document.addEventListener('click', function(e) {
        if (e.target.closest('.dropdown-item.text-danger')) {
            if (!confirm('Are you sure you want to delete this message?')) {
                e.preventDefault();
            }
        }
    });

    // Setup polling for new messages (only once)
    setupMessagePolling();

    // Sync any offline messages
    if (isOnline) {
        syncOfflineMessages();
    }
});

// Setup message synchronization
function setupMessagePolling() {
    // If already set up, don't set up again
    if (window.messageSyncState) return;

    const conversationContainer = document.querySelector('.conversation');
    if (!conversationContainer) return;

    const recipientInput = document.querySelector('input[name="recipient"]');
    if (!recipientInput) return;

    const recipient = recipientInput.value;
    if (!recipient) return;

    // Get the last message ID
    let lastMessageId = getLastMessageId();

    // Store the polling state
    window.messageSyncState = {
        lastPollTime: Date.now(),
        isPolling: false,
        recipient: recipient,
        lastMessageId: lastMessageId,
        pollingInterval: null,
        messageCount: document.querySelectorAll('.message').length
    };

    // Initial sync to get any messages that might have been sent while offline
    syncMessages();

    // Set up a more efficient background sync (every 10 seconds)
    window.messageSyncState.pollingInterval = setInterval(() => {
        // Only sync if we haven't synced recently and the page is visible
        if (document.visibilityState === 'visible' &&
            Date.now() - window.messageSyncState.lastPollTime > 8000) {
            syncMessages();
        }
    }, 10000);

    // Add event listener for visibility change to sync when tab becomes visible
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            // Clear all API call tracking when tab becomes visible
            apiCallTracker.clearAllCalls();
            // Sync messages when the tab becomes visible
            syncMessages();
        }
    });

    // Clean up interval when leaving the page
    window.addEventListener('beforeunload', () => {
        if (window.messageSyncState && window.messageSyncState.pollingInterval) {
            clearInterval(window.messageSyncState.pollingInterval);
        }
    });
}

// Track API calls to prevent duplicates
const apiCallTracker = {
    calls: {},
    isCallInProgress: function(url) {
        return this.calls[url] && (Date.now() - this.calls[url]) < 5000; // 5 second threshold
    },
    trackCall: function(url) {
        this.calls[url] = Date.now();
    },
    clearCall: function(url) {
        delete this.calls[url];
    },
    clearAllCalls: function() {
        this.calls = {};
    }
};

// Function to sync messages
function syncMessages() {
    // If already polling or offline, skip
    if (!window.messageSyncState || window.messageSyncState.isPolling || !isOnline) return;

    const recipient = window.messageSyncState.recipient;
    const lastMessageId = window.messageSyncState.lastMessageId;
    const conversationContainer = document.querySelector('.conversation');

    if (!conversationContainer) return;

    // Set polling state
    window.messageSyncState.isPolling = true;
    window.messageSyncState.lastPollTime = Date.now();

    // Create URL for API call
    const apiUrl = `/messages/api/messages/${recipient}?since_id=${lastMessageId}`;

    // Check if this call is already in progress
    if (apiCallTracker.isCallInProgress(apiUrl)) {
        window.messageSyncState.isPolling = false;
        return;
    }

    // Track this API call
    apiCallTracker.trackCall(apiUrl);

    // Use AbortController to be able to cancel the fetch if it takes too long
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    fetch(apiUrl, { signal: controller.signal })
        .then(response => {
            if (!response.ok) throw new Error('Failed to fetch messages');
            return response.json();
        })
        .then(messages => {
            clearTimeout(timeoutId);

            if (messages.length > 0) {
                // Sort messages by created_at to ensure correct order
                messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

                // Update the UI with new messages
                messages.forEach(message => {
                    // Add to cache and only update UI if message is new
                    if (messageCache.addMessage(recipient, message)) {
                        // Update UI only for new messages
                        appendMessageToUI(message);

                        // Update read status for received messages
                        if (message.sender_id != window.currentUserId && !message.read) {
                            updateMessageStatus(message.id, 'read');
                        }
                    }
                });

                // Update the last message ID to the most recent message
                const latestMessage = messages.reduce((latest, msg) => {
                    return new Date(msg.created_at) > new Date(latest.created_at) ? msg : latest;
                }, messages[0]);

                window.messageSyncState.lastMessageId = latestMessage.id;

                // Scroll to bottom if we were already at the bottom or if this is our message
                const isAtBottom = conversationContainer.scrollHeight - conversationContainer.scrollTop <= conversationContainer.clientHeight + 100;
                const hasNewOwnMessages = messages.some(m => m.sender_id == window.currentUserId);

                if (isAtBottom || hasNewOwnMessages) {
                    conversationContainer.scrollTop = conversationContainer.scrollHeight;
                }
            }
        })
        .catch(error => {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                console.log('Fetch aborted due to timeout');
            } else {
                console.error('Error fetching messages:', error);
            }
        })
        .finally(() => {
            // Reset polling state
            window.messageSyncState.isPolling = false;

            // Clear API call tracking
            apiCallTracker.clearCall(apiUrl);
        });
}

// Function to update message status (read/delivered)
function updateMessageStatus(messageId, status) {
    if (!messageId || !status || !isOnline) return;

    const apiUrl = `/messages/api/messages/${messageId}/status`;

    // Check if this call is already in progress
    if (apiCallTracker.isCallInProgress(apiUrl + status)) return;

    // Track this API call
    apiCallTracker.trackCall(apiUrl + status);

    fetch(apiUrl, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: status })
    })
    .then(response => {
        if (!response.ok) throw new Error(`Failed to update message ${status} status`);
        return response.json();
    })
    .then(message => {
        // Update message in cache
        messageCache.updateMessage(messageId, { [status]: true, [`${status}_at`]: message[`${status}_at`] });

        // Update UI if needed
        const messageElement = document.querySelector(`.message[data-message-id="${messageId}"]`);
        if (messageElement) {
            if (status === 'read') {
                messageElement.classList.add('message-read');
            }
        }
    })
    .catch(error => {
        console.error(`Error updating message ${status} status:`, error);
    })
    .finally(() => {
        // Clear API call tracking
        apiCallTracker.clearCall(apiUrl + status);
    });
}

// Get the ID of the last message in the conversation
function getLastMessageId() {
    const messages = document.querySelectorAll('.message');
    if (messages.length === 0) return 0;

    const lastMessage = messages[messages.length - 1];
    return lastMessage.dataset.messageId;
}

// Append a message to the UI
function appendMessageToUI(message) {
    const conversationContainer = document.querySelector('.conversation');
    if (!conversationContainer) return;

    // Check if message already exists in the DOM by ID or client_message_id
    if (document.querySelector(`.message[data-message-id="${message.id}"]`)) {
        return;
    }

    // Also check for offline messages that might have been sent with a client_message_id
    if (message.client_message_id &&
        document.querySelector(`.message[data-client-id="${message.client_message_id}"]`)) {
        return;
    }

    const isCurrentUser = message.sender_id == window.currentUserId;
    const messageClass = isCurrentUser ? 'message-sent' : 'message-received';
    const deletedClass = message.deleted ? 'message-deleted' : '';
    const editedClass = message.edited ? 'message-edited' : '';
    const offlineClass = message.offline ? 'message-offline' : '';

    // Create message element
    const messageElement = document.createElement('div');
    messageElement.className = `message ${messageClass} ${offlineClass}`;
    messageElement.dataset.messageId = message.id;

    // Add client_message_id as data attribute if available
    if (message.client_message_id) {
        messageElement.dataset.clientId = message.client_message_id;
    }

    // Create message content
    let messageHTML = `
        <div class="message-content ${deletedClass} ${editedClass}">
            ${message.content}
            <div class="message-time">
                ${new Date(message.created_at).toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true })} |
                ${new Date(message.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric' })}
    `;

    // Add edited indicator
    if (message.edited) {
        messageHTML += `<span class="text-muted ms-1">(edited)</span>`;
    }

    // Add offline indicator
    if (message.offline) {
        messageHTML += `<span class="text-warning ms-1" title="Waiting to be sent"><i class="fas fa-clock"></i></span>`;
    }

    // Add read/delivered indicators for sent messages
    if (isCurrentUser && !message.offline) {
        if (message.read) {
            messageHTML += `<span class="text-primary ms-1" title="Read"><i class="fas fa-check-double"></i></span>`;
        } else if (message.delivered) {
            messageHTML += `<span class="text-primary ms-1" title="Delivered"><i class="fas fa-check"></i></span>`;
        }

        // Add message actions dropdown for current user's messages
        if (!message.deleted) {
            messageHTML += `
                <div class="message-actions dropdown">
                    <button class="btn btn-sm dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end">
                        <li>
                            <a class="dropdown-item edit-message" href="/messages/message/${message.id}/edit" data-message-id="${message.id}">
                                <i class="fas fa-edit me-2"></i> Edit
                            </a>
                        </li>
                        <li>
                            <form action="/messages/message/${message.id}/delete" method="POST">
                                <button type="submit" class="dropdown-item text-danger delete-message" data-message-id="${message.id}">
                                    <i class="fas fa-trash-alt me-2"></i> Delete
                                </button>
                            </form>
                        </li>
                    </ul>
                </div>
            `;
        }
    }

    messageHTML += `
            </div>
        </div>
    `;

    messageElement.innerHTML = messageHTML;
    conversationContainer.appendChild(messageElement);

    // Mark message as delivered if it's received
    if (!isCurrentUser && !message.delivered && !message.offline) {
        fetch(`/messages/api/messages/${message.id}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: 'delivered' }),
        }).catch(error => console.error('Error marking message as delivered:', error));
    }
}

// Generate a UUID for client message ID
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
