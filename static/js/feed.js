// Feed JavaScript functionality

document.addEventListener('DOMContentLoaded', function() {
    // Preview post image before upload
    const postImageInput = document.querySelector('input[name="image"]');
    
    if (postImageInput) {
        postImageInput.addEventListener('change', function() {
            const file = this.files[0];
            if (file) {
                // Could add image preview functionality here
                console.log('Image selected:', file.name);
            }
        });
    }
    
    // Auto-resize textarea as user types
    const textareas = document.querySelectorAll('textarea');
    
    textareas.forEach(function(textarea) {
        textarea.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
        });
    });
    
    // Like button animation
    const likeButtons = document.querySelectorAll('button[type="submit"] i.fa-thumbs-up');
    
    likeButtons.forEach(function(button) {
        button.addEventListener('click', function() {
            this.classList.add('animate__animated', 'animate__heartBeat');
            
            setTimeout(() => {
                this.classList.remove('animate__animated', 'animate__heartBeat');
            }, 1000);
        });
    });
});
