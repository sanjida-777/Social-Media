import os
import eventlet
eventlet.monkey_patch()
from datetime import datetime, timezone
from flask import Flask, redirect, url_for
from flask_login import LoginManager
from flask_bcrypt import Bcrypt
from models import db
from models.user import User
from config import config
import sub.socket_events as socket_events
import sub.app_config as app_config

# Import routes
from routes.auth_routes import auth
from routes.feed_routes import feed
from routes.profile_routes import profile
from routes.message_routes import messages
from routes.friendship_routes import friendship
from routes.api_routes import api
from routes.err_routers import bp as err_bp

def create_app(config_name='default'):
    """Create and configure the Flask application."""
    app = Flask(__name__)
    app.config.from_object(config[config_name])

    # Ensure upload directories exist
    os.makedirs(os.path.join(app.static_folder, 'img', 'profile_pics'), exist_ok=True)
    os.makedirs(os.path.join(app.static_folder, 'img', 'post_images'), exist_ok=True)

    # Initialize extensions
    db.init_app(app)
    bcrypt = Bcrypt(app)
    login_manager = LoginManager(app)
    login_manager.login_view = 'auth.login'
    login_manager.login_message_category = 'info'

    # Initialize SocketIO
    socketio = socket_events.init_app(app)

    @login_manager.user_loader
    def load_user(user_id):
        # Use Session.get() instead of Query.get() to avoid SQLAlchemy deprecation warning
        return db.session.get(User, int(user_id))

    # Register blueprints
    app.register_blueprint(auth, url_prefix='/auth')
    app.register_blueprint(feed)
    app.register_blueprint(profile, url_prefix='/profile')
    app.register_blueprint(messages, url_prefix='/messages')
    app.register_blueprint(friendship, url_prefix='/friendship')
    app.register_blueprint(api)
    app.register_blueprint(err_bp, url_prefix='/error')

    # Register error handlers
    @app.errorhandler(404)
    def page_not_found(_):
        return redirect(url_for('err.handle_404'))

    @app.errorhandler(403)
    def forbidden(_):
        return redirect(url_for('err.handle_403'))

    @app.errorhandler(405)
    def method_not_allowed(_):
        return redirect(url_for('err.handle_405'))

    @app.errorhandler(500)
    def server_error(_):
        return redirect(url_for('err.handle_500'))

    # Root route redirects to feed
    @app.route('/')
    def index():
        return redirect(url_for('feed.index'))

    # Create database tables
    with app.app_context():
        db.create_all()

    # Add template context processors
    @app.context_processor
    def inject_now():
        return {'now': datetime.now(timezone.utc)}

    # Initialize application with JSON configuration
    app_config.init_app(app)

    return app

if __name__ == '__main__':
    app = create_app()
    # Use standard Flask run method for testing
    app.run(debug=True, port=5000)
