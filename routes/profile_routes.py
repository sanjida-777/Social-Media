from flask import Blueprint, render_template, request
from flask_login import login_required
from handlers.profile_handler import get_user_profile, get_user_posts

# Create Blueprint
profile = Blueprint('profile', __name__)

# Routes
@profile.route('/user/<string:username>')
@login_required
def view(username):
    page = request.args.get('page', 1, type=int)
    user = get_user_profile(username)
    posts = get_user_posts(username, page=page)
    return render_template('profile/view.html', title=f'{user.username}\'s Profile', user=user, posts=posts)
