/**
 * SocialLite - Configuration Loader
 * Loads and provides access to application configuration
 */

// Global configuration object
let appConfig = null;

/**
 * Load the application configuration
 * @returns {Promise} Promise that resolves with the configuration object
 */
async function loadConfig() {
    if (appConfig !== null) {
        return appConfig;
    }

    try {
        const response = await fetch('/config.json');
        if (!response.ok) {
            throw new Error(`Failed to load configuration: ${response.status} ${response.statusText}`);
        }
        
        appConfig = await response.json();
        
        // Apply initial configuration settings
        applyInitialConfig(appConfig);
        
        return appConfig;
    } catch (error) {
        console.error('Error loading configuration:', error);
        // Fallback to default configuration
        return getDefaultConfig();
    }
}

/**
 * Apply initial configuration settings
 * @param {Object} config - The configuration object
 */
function applyInitialConfig(config) {
    // Set document title
    document.title = config.site.name;
    
    // Set theme
    if (config.app.defaultTheme === 'light') {
        document.body.classList.add('light-mode');
    }
    
    // Set favicon
    setFavicon(config.site.logo.favicon);
    
    // Set theme color for mobile browsers
    setThemeColor(config.site.themeColor);
    
    // Initialize data saver if enabled by default
    if (config.app.dataSaver.enabled) {
        localStorage.setItem('dataSaver', 'true');
        document.body.classList.add('data-saver');
    }
    
    // Log configuration loaded in development mode
    if (config.development.debug) {
        console.log('Configuration loaded:', config);
    }
}

/**
 * Set the favicon
 * @param {string} faviconPath - Path to the favicon
 */
function setFavicon(faviconPath) {
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
    }
    link.href = faviconPath;
    
    // Also set Apple touch icon
    let touchIcon = document.querySelector("link[rel~='apple-touch-icon']");
    if (!touchIcon) {
        touchIcon = document.createElement('link');
        touchIcon.rel = 'apple-touch-icon';
        document.head.appendChild(touchIcon);
    }
    touchIcon.href = appConfig.site.logo.touchIcon;
}

/**
 * Set theme color for mobile browsers
 * @param {string} color - The theme color
 */
function setThemeColor(color) {
    let meta = document.querySelector("meta[name='theme-color']");
    if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'theme-color';
        document.head.appendChild(meta);
    }
    meta.content = color;
}

/**
 * Get a default configuration in case loading fails
 * @returns {Object} Default configuration object
 */
function getDefaultConfig() {
    return {
        site: {
            name: "SocialLite",
            tagline: "A lightweight social experience",
            logo: {
                favicon: "/static/img/favicon.ico"
            },
            themeColor: "#1877f2"
        },
        app: {
            defaultTheme: "dark",
            dataSaver: {
                enabled: false
            }
        },
        development: {
            debug: false
        }
    };
}

/**
 * Get a configuration value by path
 * @param {string} path - Dot notation path to the configuration value
 * @param {*} defaultValue - Default value if path doesn't exist
 * @returns {*} The configuration value or default value
 */
function getConfig(path, defaultValue = null) {
    if (!appConfig) {
        console.warn('Configuration not loaded yet. Call loadConfig() first.');
        return defaultValue;
    }
    
    const keys = path.split('.');
    let value = appConfig;
    
    for (const key of keys) {
        if (value === undefined || value === null || !Object.prototype.hasOwnProperty.call(value, key)) {
            return defaultValue;
        }
        value = value[key];
    }
    
    return value;
}

/**
 * Initialize the configuration when the DOM is loaded
 */
document.addEventListener('DOMContentLoaded', function() {
    loadConfig().then(config => {
        // Dispatch event when configuration is loaded
        const event = new CustomEvent('config-loaded', { detail: config });
        document.dispatchEvent(event);
    });
});

// Export functions for use in other modules
window.SocialLiteConfig = {
    loadConfig,
    getConfig
};
