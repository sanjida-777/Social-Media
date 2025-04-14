"""
Application configuration module for SocialLite.
Initializes the application with configuration from config.json.
"""

from flask import Flask, g
from utils.config_utils import load_config

def init_app(app):
    """
    Initialize the application with configuration
    
    Args:
        app (Flask): The Flask application instance
    """
    # Load configuration before request
    @app.before_request
    def before_request():
        # Load configuration if not already loaded
        if not hasattr(g, 'config'):
            g.config = load_config()
    
    # Make configuration available to templates
    @app.context_processor
    def inject_config():
        return {'config': getattr(g, 'config', load_config())}
    
    # Serve config.json for client-side access
    @app.route('/config.json')
    def serve_config():
        from flask import jsonify
        config = load_config()
        
        # Filter out sensitive information for client-side
        client_config = {
            'site': config.get('site', {}),
            'app': {
                'defaultTheme': config.get('app', {}).get('defaultTheme', 'dark'),
                'dataSaver': config.get('app', {}).get('dataSaver', {'enabled': False}),
                'feed': config.get('app', {}).get('feed', {}),
                'stories': config.get('app', {}).get('stories', {})
            },
            'features': config.get('features', {}),
            'paths': {
                'uploads': config.get('paths', {}).get('uploads', {})
            },
            'performance': config.get('performance', {}),
            'development': {
                'debug': config.get('development', {}).get('debug', False)
            }
        }
        
        return jsonify(client_config)
