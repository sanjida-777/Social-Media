// Messages JavaScript functionality

// Cache for messages to reduce API calls
const messageCache = {
    conversations: {},
    addMessage: function(conversationId, message) {
        if (!this.conversations[conversationId]) {
            this.conversations[conversationId] = [];
        }

        // Check if message already exists by ID
        const existingIndex = this.conversations[conversationId].findIndex(m => m.id === message.id);
        if (existingIndex !== -1) {
            // Message already exists, update it
            this.conversations[conversationId][existingIndex] = { ...this.conversations[conversationId][existingIndex], ...message };
            return false; // Message was not added, just updated
        }

        // Check by client_message_id if available
        if (message.client_message_id) {
            const clientIdIndex = this.conversations[conversationId].findIndex(m =>
                m.client_message_id === message.client_message_id);
            if (clientIdIndex !== -1) {
                // Message with this client_id already exists, update it
                this.conversations[conversationId][clientIdIndex] = { ...this.conversations[conversationId][clientIdIndex], ...message };
                return false; // Message was not added, just updated
            }
        }

        // Check for messages with identical content and timestamp (within 2 seconds)
        // This helps prevent duplicates that might have different IDs but are essentially the same message
        const duplicateIndex = this.conversations[conversationId].findIndex(m => {
            // Skip if not from the same sender
            if (m.sender_id != message.sender_id) return false;

            // Check content
            if (m.content !== message.content) return false;

            // Check timestamp (within 2 seconds)
            const mTime = new Date(m.created_at).getTime();
            const newTime = new Date(message.created_at).getTime();
            return Math.abs(mTime - newTime) < 2000;
        });

        if (duplicateIndex !== -1) {
            console.log('Duplicate message detected in cache, updating instead of adding');
            this.conversations[conversationId][duplicateIndex] = { ...this.conversations[conversationId][duplicateIndex], ...message };
            return false; // Message was not added, just updated
        }

        // Add new message
        this.conversations[conversationId].push(message);

        // Sort messages by created_at
        this.conversations[conversationId].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        return true; // Message was added
    },
    getMessages: function(conversationId) {
        return this.conversations[conversationId] || [];
    },
    updateMessage: function(messageId, updates) {
        // Update message in all conversations
        Object.keys(this.conversations).forEach(convId => {
            // First try to find by ID
            const index = this.conversations[convId].findIndex(m => m.id === messageId);
            if (index !== -1) {
                this.conversations[convId][index] = { ...this.conversations[convId][index], ...updates };
                return;
            }

            // If not found by ID, try to find by client_message_id if updates contain it
            if (updates.client_message_id) {
                const clientIdIndex = this.conversations[convId].findIndex(m =>
                    m.client_message_id === updates.client_message_id);
                if (clientIdIndex !== -1) {
                    this.conversations[convId][clientIdIndex] = { ...this.conversations[convId][clientIdIndex], ...updates };
                }
            }
        });
    },
    removeMessage: function(messageId) {
        // Remove message from all conversations
        Object.keys(this.conversations).forEach(convId => {
            this.conversations[convId] = this.conversations[convId].filter(m => m.id !== messageId);
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
    // Check if we already have a message with this client_message_id in the cache
    const existingMessages = messageCache.getMessages(recipient);
    const existingMessage = existingMessages.find(m => m.client_message_id === clientMessageId);

    // Also check for messages with the same content in the last 5 seconds (to prevent duplicates)
    const recentDuplicateContent = existingMessages.find(m => {
        const messageTime = new Date(m.created_at).getTime();
        const currentTime = Date.now();
        const timeDiff = currentTime - messageTime;

        // If message has same content and was created in the last 5 seconds
        return m.content === content &&
               m.sender_id == window.currentUserId &&
               timeDiff < 5000 &&
               !m.offline &&
               !m.pending;
    });

    if (recentDuplicateContent) {
        console.log('Duplicate message content detected within 5 seconds, preventing duplicate');
        return recentDuplicateContent;
    }

    if (existingMessage && existingMessage.id && !existingMessage.offline) {
        console.log('Message with this client_message_id already exists, returning existing message');
        return existingMessage;
    }

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
            console.log('Message send already in progress, waiting...');
            // Wait for a bit and check if the message has been added to the cache
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Check again if the message exists in the cache
            const updatedMessages = messageCache.getMessages(recipient);
            const updatedMessage = updatedMessages.find(m => m.client_message_id === clientMessageId);

            if (updatedMessage && updatedMessage.id && !updatedMessage.offline) {
                return updatedMessage;
            }

            // If still not found, clear the tracking and try again
            apiCallTracker.clearCall(apiUrl + '-post-' + clientMessageId);
        }

        // Track this API call
        apiCallTracker.trackCall(apiUrl + '-post-' + clientMessageId);

        // Use AbortController to be able to cancel the fetch if it takes too long
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                content,
                client_message_id: clientMessageId
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error('Failed to send message');
        }

        const result = await response.json();

        // Clear API call tracking
        apiCallTracker.clearCall(apiUrl + '-post-' + clientMessageId);

        return result;
    } catch (error) {
        console.error('Error sending message:', error);

        // If the error is an abort error, return a pending message
        if (error.name === 'AbortError') {
            return {
                id: 'pending-' + clientMessageId,
                content,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                read: false,
                delivered: false,
                edited: false,
                deleted: false,
                sender_id: currentUserId,
                recipient_id: 0,
                client_message_id: clientMessageId,
                pending: true
            };
        }

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
            // Track last message time to prevent rapid duplicate submissions
            let lastMessageTime = 0;
            let lastMessageContent = '';
            let isSubmitting = false;

            messageForm.addEventListener('submit', async function(e) {
                e.preventDefault();

                // Get message content
                const messageInput = document.getElementById('message-input');
                const content = messageInput.value.trim();
                if (!content) return;

                // Prevent multiple submissions of the same message
                const currentTime = Date.now();
                if (isSubmitting) {
                    console.log('Already submitting a message, preventing duplicate submission');
                    return;
                }

                // Check if this is a duplicate message sent within 2 seconds
                if (content === lastMessageContent && currentTime - lastMessageTime < 2000) {
                    console.log('Duplicate message detected within 2 seconds, preventing submission');
                    messageInput.value = '';
                    return;
                }

                // Set submitting state
                isSubmitting = true;

                // Update last message tracking
                lastMessageContent = content;
                lastMessageTime = currentTime;

                const recipient = document.querySelector('input[name="recipient"]').value;
                // Generate a UUID that includes a timestamp to help with ordering
                const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '');
                const clientMessageId = `${timestamp}-${Math.random().toString(36).substr(2, 9)}`;

                // Update the hidden field value
                const clientMessageIdField = document.querySelector('input[name="client_message_id"]');
                if (clientMessageIdField) {
                    clientMessageIdField.value = clientMessageId;
                }

                // Disable form while sending
                messageInput.disabled = true;
                document.getElementById('send-button').disabled = true;

                try {
                    // Clear input immediately to prevent duplicate submissions
                    const contentToSend = content;
                    messageInput.value = '';
                    messageInput.style.height = 'auto';

                    // Create a temporary message element to show immediately
                    const tempMessageId = 'temp-' + clientMessageId;
                    const tempMessage = {
                        id: tempMessageId,
                        content: contentToSend,
                        created_at: new Date().toISOString(),
                        sender_id: window.currentUserId,
                        client_message_id: clientMessageId,
                        pending: true
                    };

                    // Add the temporary message to the UI
                    messageCache.addMessage(recipient, tempMessage);
                    appendMessageToUI(tempMessage);

                    // Send the actual message
                    const message = await sendMessage(recipient, contentToSend, clientMessageId);

                    // If the message was sent successfully, update or replace the temporary message
                    if (message && message.id && !message.id.startsWith('offline-') && !message.id.startsWith('pending-')) {
                        // Find the temporary message element
                        const tempElement = document.querySelector(`.message[data-message-id="${tempMessageId}"]`);
                        if (tempElement) {
                            // Update the element with the real message ID
                            tempElement.dataset.messageId = message.id;
                            tempElement.classList.remove('message-pending');

                            // Update the status indicator
                            const timeEl = tempElement.querySelector('.message-time');
                            if (timeEl) {
                                const statusHTML = `<span class="message-status sent-status ms-1" title="Sent"><i class="fas fa-paper-plane"></i></span>`;
                                const existingStatus = timeEl.querySelector('.message-status');
                                if (existingStatus) {
                                    existingStatus.outerHTML = statusHTML;
                                } else {
                                    timeEl.innerHTML += statusHTML;
                                }
                            }
                        } else {
                            // If for some reason the temp element is gone, add the real message
                            messageCache.addMessage(recipient, message);
                            appendMessageToUI(message);
                        }

                        // Update the message cache with the real message
                        messageCache.updateMessage(message.id, message);

                        // Update the last message ID in the sync state
                        if (window.messageSyncState) {
                            window.messageSyncState.lastMessageId = message.id;
                            window.messageSyncState.lastPollTime = Date.now();

                            // Trigger a sync after a delay
                            setTimeout(() => {
                                syncMessages();
                            }, 2000);
                        }
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

    // Check for pending messages that need to be resolved
    const pendingMessages = document.querySelectorAll('.message-pending');
    if (pendingMessages.length > 0) {
        // Try to resolve pending messages first
        pendingMessages.forEach(pendingMsg => {
            const clientId = pendingMsg.dataset.clientId;
            if (clientId) {
                // Try to find if this message has been sent successfully
                const existingMessages = messageCache.getMessages(recipient);
                const resolvedMessage = existingMessages.find(m =>
                    m.client_message_id === clientId &&
                    m.id &&
                    !m.id.startsWith('pending-') &&
                    !m.id.startsWith('offline-')
                );

                if (resolvedMessage) {
                    // Replace the pending message with the resolved one
                    pendingMsg.dataset.messageId = resolvedMessage.id;
                    pendingMsg.classList.remove('message-pending');

                    // Update the message content if needed
                    const contentEl = pendingMsg.querySelector('.message-content');
                    if (contentEl) {
                        // Only update status indicators, not the actual content
                        const timeEl = contentEl.querySelector('.message-time');
                        if (timeEl) {
                            // Add appropriate status indicators
                            let statusHTML = '';
                            if (resolvedMessage.read) {
                                statusHTML = `<span class="message-status read-status ms-1" title="Read"><i class="fas fa-check-double"></i></span>`;
                            } else if (resolvedMessage.delivered) {
                                statusHTML = `<span class="message-status delivered-status ms-1" title="Delivered"><i class="fas fa-check"></i></span>`;
                            } else {
                                statusHTML = `<span class="message-status sent-status ms-1" title="Sent"><i class="fas fa-paper-plane"></i></span>`;
                            }

                            // Replace or add status indicator
                            const existingStatus = timeEl.querySelector('.message-status');
                            if (existingStatus) {
                                existingStatus.outerHTML = statusHTML;
                            } else {
                                timeEl.innerHTML += statusHTML;
                            }
                        }
                    }
                }
            }
        });
    }

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

                // Check for messages that might resolve pending messages
                messages.forEach(message => {
                    if (message.client_message_id) {
                        const pendingMsg = document.querySelector(`.message[data-client-id="${message.client_message_id}"]`);
                        if (pendingMsg && pendingMsg.classList.contains('message-pending')) {
                            // Update the pending message with the real message ID
                            pendingMsg.dataset.messageId = message.id;
                            pendingMsg.classList.remove('message-pending');

                            // Update the message in cache
                            messageCache.updateMessage(message.id, message);

                            // Don't add this message to UI again since we've updated the pending one
                            return;
                        }
                    }

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

    // Check for messages with identical content and timestamp (within 1 second)
    // This helps prevent duplicates that might have different IDs but are essentially the same message
    const allMessages = conversationContainer.querySelectorAll('.message');
    for (const existingMsg of allMessages) {
        const contentEl = existingMsg.querySelector('.message-content');
        if (!contentEl) continue;

        // Skip the message time part when comparing content
        const existingContent = contentEl.innerHTML.split('<div class="message-time">')[0].trim();
        const newContent = message.content.trim();

        if (existingContent === newContent) {
            // Check if the messages were sent around the same time
            const timeEl = existingMsg.querySelector('.message-time');
            if (timeEl) {
                const timeText = timeEl.textContent.trim();
                const messageDate = new Date(message.created_at);
                const timeString = messageDate.toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });

                // If the time displayed is the same, it's likely a duplicate
                if (timeText.includes(timeString)) {
                    console.log('Duplicate message content detected with same timestamp, preventing duplicate');
                    return;
                }
            }
        }
    }

    const isCurrentUser = message.sender_id == window.currentUserId;
    const messageClass = isCurrentUser ? 'message-sent' : 'message-received';
    const deletedClass = message.deleted ? 'message-deleted' : '';
    const editedClass = message.edited ? 'message-edited' : '';
    const offlineClass = message.offline ? 'message-offline' : '';
    const pendingClass = message.pending ? 'message-pending' : '';
    const readClass = message.read ? 'message-read' : '';

    // Create message element
    const messageElement = document.createElement('div');
    messageElement.className = `message ${messageClass} ${offlineClass} ${pendingClass} ${readClass}`;
    messageElement.dataset.messageId = message.id;

    // Add client_message_id as data attribute if available
    if (message.client_message_id) {
        messageElement.dataset.clientId = message.client_message_id;
    }

    // Format date for display
    const messageDate = new Date(message.created_at);
    const timeString = messageDate.toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
    const dateString = messageDate.toLocaleString('en-US', { month: 'short', day: 'numeric' });

    // Create message content
    let messageHTML = `
        <div class="message-content ${deletedClass} ${editedClass}">
            ${message.content}
            <div class="message-time">
                ${timeString} | ${dateString}
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
        let statusTitle = '';
        let statusIcon = '';
        let statusClass = '';

        if (message.read) {
            statusTitle = message.read_at ? `Read ${new Date(message.read_at).toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true, month: 'short', day: 'numeric' })}` : 'Read';
            statusIcon = 'fa-check-double';
            statusClass = 'read-status';
        } else if (message.delivered) {
            statusTitle = message.delivered_at ? `Delivered ${new Date(message.delivered_at).toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true, month: 'short', day: 'numeric' })}` : 'Delivered';
            statusIcon = 'fa-check';
            statusClass = 'delivered-status';
        } else {
            statusTitle = 'Sent';
            statusIcon = 'fa-paper-plane';
            statusClass = 'sent-status';
        }

        messageHTML += `<span class="message-status ${statusClass} ms-1" title="${statusTitle}"><i class="fas ${statusIcon}"></i></span>`;

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
        updateMessageStatus(message.id, 'delivered');
    }

    // Mark message as read if it's received and the conversation is visible
    if (!isCurrentUser && !message.read && !message.offline && document.visibilityState === 'visible') {
        updateMessageStatus(message.id, 'read');
    }
}

// Generate a UUID for client message ID
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
