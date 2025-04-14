from flask import abort
from models.user import User
from models.post import Post

def get_user_profile(username):
    """Get user profile by username."""
    user = User.query.filter_by(username=username).first_or_404()
    return user

def get_user_posts(username, page=1, per_page=5):
    """Get paginated posts for a specific user."""
    user = User.query.filter_by(username=username).first_or_404()
    return Post.query.filter_by(author=user)\
        .order_by(Post.created_at.desc())\
        .paginate(page=page, per_page=per_page)
