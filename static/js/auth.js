// Authentication JavaScript functionality

document.addEventListener('DOMContentLoaded', function() {
    // Preview profile picture before upload
    const profilePictureInput = document.querySelector('input[type="file"]');
    
    if (profilePictureInput) {
        profilePictureInput.addEventListener('change', function() {
            const file = this.files[0];
            if (file) {
                const reader = new FileReader();
                const profilePicture = document.querySelector('.profile-pic');
                
                reader.addEventListener('load', function() {
                    profilePicture.setAttribute('src', this.result);
                });
                
                reader.readAsDataURL(file);
            }
        });
    }
    
    // Password strength indicator (could be expanded)
    const passwordInput = document.querySelector('input[name="password"]');
    
    if (passwordInput) {
        passwordInput.addEventListener('input', function() {
            // Simple password strength check
            const password = this.value;
            let strength = 0;
            
            if (password.length >= 8) strength += 1;
            if (password.match(/[a-z]/)) strength += 1;
            if (password.match(/[A-Z]/)) strength += 1;
            if (password.match(/[0-9]/)) strength += 1;
            if (password.match(/[^a-zA-Z0-9]/)) strength += 1;
            
            // Could add visual indicator here
        });
    }
});
