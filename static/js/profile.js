// Profile JavaScript functionality

document.addEventListener('DOMContentLoaded', function() {
    // Image gallery functionality
    const galleryImages = document.querySelectorAll('.photos-grid img');
    
    if (galleryImages.length) {
        galleryImages.forEach(function(image) {
            image.addEventListener('click', function() {
                // Could implement a lightbox gallery here
                const imageUrl = this.getAttribute('src');
                console.log('Image clicked:', imageUrl);
            });
        });
    }
    
    // Follow/Unfollow functionality could be added here
    const followButton = document.querySelector('.follow-btn');
    
    if (followButton) {
        followButton.addEventListener('click', function() {
            const isFollowing = this.classList.contains('btn-primary');
            
            if (isFollowing) {
                this.classList.remove('btn-primary');
                this.classList.add('btn-outline-primary');
                this.innerHTML = '<i class="fas fa-user-plus me-1"></i> Follow';
            } else {
                this.classList.remove('btn-outline-primary');
                this.classList.add('btn-primary');
                this.innerHTML = '<i class="fas fa-user-check me-1"></i> Following';
            }
            
            // Would need AJAX call to server to update follow status
        });
    }
});
