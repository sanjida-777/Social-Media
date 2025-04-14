// Theme Switcher JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Theme switching functionality
    const themeToggleBtn = document.getElementById('theme-toggle');
    const htmlElement = document.documentElement;
    
    // Function to set theme
    function setTheme(themeName) {
        if (themeName === 'dark') {
            document.body.classList.add('dark-theme');
            if (themeToggleBtn) {
                themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
                themeToggleBtn.setAttribute('title', 'Switch to Light Mode');
            }
        } else {
            document.body.classList.remove('dark-theme');
            if (themeToggleBtn) {
                themeToggleBtn.innerHTML = '<i class="fas fa-moon"></i>';
                themeToggleBtn.setAttribute('title', 'Switch to Dark Mode');
            }
        }
        // Save theme preference to localStorage
        localStorage.setItem('theme', themeName);
    }
    
    // Toggle theme function
    function toggleTheme() {
        if (document.body.classList.contains('dark-theme')) {
            setTheme('light');
        } else {
            setTheme('dark');
        }
    }
    
    // Add event listener to theme toggle button
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', toggleTheme);
    }
    
    // Check for saved theme preference or use default (dark)
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
});
