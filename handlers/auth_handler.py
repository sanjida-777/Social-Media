from flask import flash, redirect, url_for, request
from flask_login import login_user, current_user, logout_user
from flask_bcrypt import Bcrypt
from datetime import datetime, timezone
from models.user import User
from utils.db_utils import commit_to_db
from utils.auth_utils import save_profile_picture

bcrypt = Bcrypt()

def register_handler(form):
    """Handle user registration."""
    if form.validate_on_submit():
        # Hash the password
        hashed_password = bcrypt.generate_password_hash(form.password.data).decode('utf-8')

        # Create new user
        user = User(
            username=form.username.data,
            email=form.email.data,
            password=hashed_password,
            first_name=form.first_name.data,
            last_name=form.last_name.data
        )

        # Save to database
        commit_to_db(user)

        flash('Your account has been created! You can now log in.', 'success')
        return redirect(url_for('auth.login'))

    return None  # Form validation failed

def login_handler(form):
    """Handle user login."""
    if form.validate_on_submit():
        user = User.query.filter_by(email=form.email.data).first()

        # Check if user exists and password is correct
        if user and bcrypt.check_password_hash(user.password, form.password.data):
            # Log the user in
            login_user(user, remember=form.remember.data)

            # Update last login timestamp
            user.last_login = datetime.now()
            commit_to_db()

            # Update online status
            user.is_online = True
            commit_to_db()

            # Redirect to the page the user was trying to access
            next_page = request.args.get('next')

            # If no specific page requested, check for unread messages
            if not next_page:
                from models.message import Message
                unread_count = Message.query.filter_by(recipient_id=user.id, read=False).count()

                # If there are unread messages, redirect to inbox
                if unread_count > 0:
                    flash(f'You have {unread_count} unread messages', 'info')
                    return redirect(url_for('messages.inbox'))
                else:
                    return redirect(url_for('feed.index'))

            return redirect(next_page)
        else:
            flash('Login unsuccessful. Please check email and password.', 'danger')

    return None  # Form validation failed

def logout_handler():
    """Handle user logout."""
    if current_user.is_authenticated:
        # Update user's online status and last seen
        current_user.is_online = False
        current_user.last_seen = datetime.now()
        commit_to_db()

    logout_user()
    flash('You have been logged out.', 'info')
    return redirect(url_for('auth.login'))

def update_profile_handler(form):
    """Handle user profile update."""
    if form.validate_on_submit():
        # Update profile picture if provided
        if form.picture.data:
            picture_file = save_profile_picture(form.picture.data)
            current_user.profile_image = picture_file

        # Update user information
        current_user.username = form.username.data
        current_user.email = form.email.data
        current_user.first_name = form.first_name.data
        current_user.last_name = form.last_name.data
        current_user.bio = form.bio.data

        # Save changes
        commit_to_db()

        flash('Your profile has been updated!', 'success')
        return redirect(url_for('profile.view', username=current_user.username))

    # Pre-populate form with current user data
    elif request.method == 'GET':
        form.username.data = current_user.username
        form.email.data = current_user.email
        form.first_name.data = current_user.first_name
        form.last_name.data = current_user.last_name
        form.bio.data = current_user.bio

    return None  # Form validation failed
