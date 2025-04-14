/**
 * SocialLite - Lightweight Social Media App
 * Main JavaScript file for common functionality
 */

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initTheme();
    initDataSaver();
    initOfflineDetection();
    initLazyLoading();
    initTouchFeedback();
});

/**
 * Initialize theme (dark/light mode)
 */
function initTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;
    
    if (!themeToggle) return;
    
    // Check if user has a theme preference stored
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        body.classList.add('light-mode');
        themeToggle.checked = false;
    }
    
    themeToggle.addEventListener('change', function() {
        if (this.checked) {
            body.classList.remove('light-mode');
            localStorage.setItem('theme', 'dark');
        } else {
            body.classList.add('light-mode');
            localStorage.setItem('theme', 'light');
        }
    });
}

/**
 * Initialize data saver mode
 */
function initDataSaver() {
    const dataSaverToggle = document.getElementById('data-saver-toggle');
    
    if (!dataSaverToggle) return;
    
    // Check if user has data saver preference stored
    const savedDataSaver = localStorage.getItem('dataSaver');
    if (savedDataSaver === 'true') {
        dataSaverToggle.checked = true;
        document.body.classList.add('data-saver');
        
        // Apply data saver to images
        applyDataSaverToImages();
    }
    
    dataSaverToggle.addEventListener('change', function() {
        if (this.checked) {
            localStorage.setItem('dataSaver', 'true');
            document.body.classList.add('data-saver');
            applyDataSaverToImages();
        } else {
            localStorage.setItem('dataSaver', 'false');
            document.body.classList.remove('data-saver');
            // Could reload images in higher quality, but that would use more data
        }
    });
}

/**
 * Apply data saver mode to images
 */
function applyDataSaverToImages() {
    // Find all images from unsplash (our sample images)
    const images = document.querySelectorAll('img[src*="unsplash"]');
    
    images.forEach(img => {
        const src = img.src;
        // Reduce image quality by requesting smaller sizes
        if (src.includes('600x400')) {
            img.src = src.replace('600x400', '300x200');
        } else if (src.includes('300x600')) {
            img.src = src.replace('300x600', '150x300');
        }
    });
}

/**
 * Initialize offline detection
 */
function initOfflineDetection() {
    const offlineIndicator = document.getElementById('offline-indicator');
    
    if (!offlineIndicator) return;
    
    // Check initial connection status
    if (!navigator.onLine) {
        offlineIndicator.style.display = 'block';
    }
    
    // Listen for online/offline events
    window.addEventListener('online', function() {
        offlineIndicator.style.display = 'none';
        
        // Notify user they're back online
        showToast('You are back online!');
        
        // Sync any pending actions
        syncPendingActions();
    });
    
    window.addEventListener('offline', function() {
        offlineIndicator.style.display = 'block';
        
        // Notify user they're offline
        showToast('You are offline. Some features may be unavailable.');
    });
}

/**
 * Initialize lazy loading for images
 */
function initLazyLoading() {
    // Check if the browser supports IntersectionObserver
    if ('IntersectionObserver' in window) {
        const lazyImages = document.querySelectorAll('img[loading="lazy"]');
        
        const imageObserver = new IntersectionObserver(function(entries, observer) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src || img.src;
                    img.classList.add('fade-in');
                    imageObserver.unobserve(img);
                }
            });
        });
        
        lazyImages.forEach(function(image) {
            imageObserver.observe(image);
        });
    }
}

/**
 * Initialize touch feedback for buttons
 */
function initTouchFeedback() {
    const buttons = document.querySelectorAll('button, .navbar-action, .navbar-tab, .post-action');
    
    buttons.forEach(button => {
        button.addEventListener('touchstart', function() {
            this.style.opacity = '0.7';
        });
        
        button.addEventListener('touchend', function() {
            this.style.opacity = '1';
        });
    });
}

/**
 * Show a toast notification
 * @param {string} message - The message to display
 * @param {number} duration - Duration in milliseconds
 */
function showToast(message, duration = 3000) {
    // Check if a toast container already exists
    let toastContainer = document.querySelector('.toast-container');
    
    // If not, create one
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        toastContainer.style.position = 'fixed';
        toastContainer.style.bottom = '20px';
        toastContainer.style.left = '50%';
        toastContainer.style.transform = 'translateX(-50%)';
        toastContainer.style.zIndex = '9999';
        document.body.appendChild(toastContainer);
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'toast fade-in';
    toast.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    toast.style.color = 'white';
    toast.style.padding = '10px 20px';
    toast.style.borderRadius = '20px';
    toast.style.marginBottom = '10px';
    toast.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';
    toast.style.textAlign = 'center';
    toast.textContent = message;
    
    // Add toast to container
    toastContainer.appendChild(toast);
    
    // Remove toast after duration
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            toast.remove();
            
            // Remove container if empty
            if (toastContainer.children.length === 0) {
                toastContainer.remove();
            }
        }, 300);
    }, duration);
}

/**
 * Sync pending actions that were made while offline
 */
function syncPendingActions() {
    // Check if there are any pending actions in localStorage
    const pendingActions = JSON.parse(localStorage.getItem('pendingActions') || '[]');
    
    if (pendingActions.length === 0) return;
    
    showToast(`Syncing ${pendingActions.length} pending actions...`);
    
    // Process each pending action
    pendingActions.forEach((action, index) => {
        // Simulate API call
        setTimeout(() => {
            console.log(`Synced action: ${action.type}`);
            
            // If this is the last action, clear pending actions and notify user
            if (index === pendingActions.length - 1) {
                localStorage.removeItem('pendingActions');
                showToast('All pending actions have been synced!');
            }
        }, 500 * index);
    });
}

/**
 * Add a pending action to be synced when back online
 * @param {Object} action - The action to be synced
 */
function addPendingAction(action) {
    const pendingActions = JSON.parse(localStorage.getItem('pendingActions') || '[]');
    pendingActions.push(action);
    localStorage.setItem('pendingActions', JSON.stringify(pendingActions));
}

/**
 * Handle like action on a post
 * @param {HTMLElement} button - The like button element
 * @param {string} postId - The ID of the post
 */
function handleLike(button, postId) {
    // Toggle active state
    const isLiked = button.classList.toggle('active');
    
    // Update UI
    const likeCount = button.querySelector('span');
    let count = parseInt(likeCount.textContent);
    
    if (isLiked) {
        count++;
        button.style.color = 'var(--accent-color)';
    } else {
        count--;
        button.style.color = 'var(--text-secondary)';
    }
    
    likeCount.textContent = count;
    
    // If offline, add to pending actions
    if (!navigator.onLine) {
        addPendingAction({
            type: 'like',
            postId: postId,
            action: isLiked ? 'add' : 'remove',
            timestamp: new Date().toISOString()
        });
        
        showToast('You are offline. This action will be synced when you are back online.');
        return;
    }
    
    // If online, send to server (simulated)
    console.log(`Post ${postId} ${isLiked ? 'liked' : 'unliked'}`);
}

/**
 * Handle comment submission
 * @param {HTMLElement} form - The comment form element
 * @param {string} postId - The ID of the post
 */
function handleComment(form, postId) {
    const input = form.querySelector('input');
    const comment = input.value.trim();
    
    if (!comment) return;
    
    // Clear input
    input.value = '';
    
    // Create comment element
    const commentElement = document.createElement('div');
    commentElement.className = 'comment';
    
    commentElement.innerHTML = `
        <div class="comment-avatar">
            <img src="/static/img/profile_pics/default.jpg" alt="Your avatar">
        </div>
        <div class="comment-bubble">
            <div class="comment-author">You</div>
            <div class="comment-text">${comment}</div>
        </div>
    `;
    
    // Add comment to UI
    const commentsContainer = form.parentElement.querySelector('.comments-container');
    commentsContainer.appendChild(commentElement);
    
    // If offline, add to pending actions
    if (!navigator.onLine) {
        addPendingAction({
            type: 'comment',
            postId: postId,
            content: comment,
            timestamp: new Date().toISOString()
        });
        
        showToast('You are offline. This comment will be synced when you are back online.');
        return;
    }
    
    // If online, send to server (simulated)
    console.log(`Comment added to post ${postId}: ${comment}`);
}

/**
 * Handle share action
 * @param {string} postId - The ID of the post
 */
function handleShare(postId) {
    // Check if Web Share API is supported
    if (navigator.share) {
        navigator.share({
            title: 'Check out this post on SocialLite',
            text: 'I found this interesting post on SocialLite!',
            url: window.location.origin + '/post/' + postId
        })
        .then(() => console.log('Shared successfully'))
        .catch((error) => console.log('Error sharing:', error));
    } else {
        // Fallback for browsers that don't support Web Share API
        showToast('Share link copied to clipboard!');
        
        // Copy link to clipboard
        const dummyInput = document.createElement('input');
        document.body.appendChild(dummyInput);
        dummyInput.value = window.location.origin + '/post/' + postId;
        dummyInput.select();
        document.execCommand('copy');
        document.body.removeChild(dummyInput);
    }
}
