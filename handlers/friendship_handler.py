from flask import flash, redirect, url_for
from flask_login import current_user
from models.user import User
from models.friendship import FriendRequest, Friendship, Follow
from utils.db_utils import commit_to_db, delete_from_db

def send_friend_request_handler(username):
    """Handle sending a friend request."""
    user = User.query.filter_by(username=username).first_or_404()
    
    # Check if the user is trying to send a request to themselves
    if user.id == current_user.id:
        flash('You cannot send a friend request to yourself.', 'danger')
        return redirect(url_for('profile.view', username=username))
    
    # Check if they are already friends
    if current_user.is_friends_with(user.id):
        flash('You are already friends with this user.', 'info')
        return redirect(url_for('profile.view', username=username))
    
    # Check if there's already a pending request from the current user
    if current_user.has_pending_friend_request_to(user.id):
        flash('You already have a pending friend request to this user.', 'info')
        return redirect(url_for('profile.view', username=username))
    
    # Check if there's already a pending request from the other user
    if current_user.has_pending_friend_request_from(user.id):
        # Accept the request instead of creating a new one
        return accept_friend_request_handler(username)
    
    # Create a new friend request
    friend_request = FriendRequest(
        sender_id=current_user.id,
        recipient_id=user.id,
        status='pending'
    )
    
    commit_to_db(friend_request)
    flash(f'Friend request sent to {user.first_name} {user.last_name}.', 'success')
    return redirect(url_for('profile.view', username=username))

def accept_friend_request_handler(username):
    """Handle accepting a friend request."""
    user = User.query.filter_by(username=username).first_or_404()
    
    # Find the friend request
    friend_request = FriendRequest.query.filter_by(
        sender_id=user.id,
        recipient_id=current_user.id,
        status='pending'
    ).first_or_404()
    
    # Update the request status
    friend_request.status = 'accepted'
    
    # Create friendship records (bidirectional)
    friendship1 = Friendship(user_id=current_user.id, friend_id=user.id)
    friendship2 = Friendship(user_id=user.id, friend_id=current_user.id)
    
    commit_to_db(friend_request)
    commit_to_db(friendship1)
    commit_to_db(friendship2)
    
    flash(f'You are now friends with {user.first_name} {user.last_name}.', 'success')
    return redirect(url_for('profile.view', username=username))

def reject_friend_request_handler(username):
    """Handle rejecting a friend request."""
    user = User.query.filter_by(username=username).first_or_404()
    
    # Find the friend request
    friend_request = FriendRequest.query.filter_by(
        sender_id=user.id,
        recipient_id=current_user.id,
        status='pending'
    ).first_or_404()
    
    # Update the request status
    friend_request.status = 'rejected'
    commit_to_db(friend_request)
    
    flash(f'Friend request from {user.first_name} {user.last_name} rejected.', 'info')
    return redirect(url_for('profile.view', username=username))

def cancel_friend_request_handler(username):
    """Handle canceling a sent friend request."""
    user = User.query.filter_by(username=username).first_or_404()
    
    # Find the friend request
    friend_request = FriendRequest.query.filter_by(
        sender_id=current_user.id,
        recipient_id=user.id,
        status='pending'
    ).first_or_404()
    
    # Delete the request
    delete_from_db(friend_request)
    
    flash(f'Friend request to {user.first_name} {user.last_name} canceled.', 'info')
    return redirect(url_for('profile.view', username=username))

def unfriend_handler(username):
    """Handle unfriending a user."""
    user = User.query.filter_by(username=username).first_or_404()
    
    # Find and delete friendship records (both directions)
    friendship1 = Friendship.query.filter_by(user_id=current_user.id, friend_id=user.id).first()
    friendship2 = Friendship.query.filter_by(user_id=user.id, friend_id=current_user.id).first()
    
    if friendship1:
        delete_from_db(friendship1)
    
    if friendship2:
        delete_from_db(friendship2)
    
    flash(f'You are no longer friends with {user.first_name} {user.last_name}.', 'info')
    return redirect(url_for('profile.view', username=username))

def follow_user_handler(username):
    """Handle following a user."""
    user = User.query.filter_by(username=username).first_or_404()
    
    # Check if the user is trying to follow themselves
    if user.id == current_user.id:
        flash('You cannot follow yourself.', 'danger')
        return redirect(url_for('profile.view', username=username))
    
    # Check if already following
    if current_user.is_following(user.id):
        flash('You are already following this user.', 'info')
        return redirect(url_for('profile.view', username=username))
    
    # Create a new follow relationship
    follow = Follow(follower_id=current_user.id, followed_id=user.id)
    commit_to_db(follow)
    
    flash(f'You are now following {user.first_name} {user.last_name}.', 'success')
    return redirect(url_for('profile.view', username=username))

def unfollow_user_handler(username):
    """Handle unfollowing a user."""
    user = User.query.filter_by(username=username).first_or_404()
    
    # Find and delete the follow relationship
    follow = Follow.query.filter_by(follower_id=current_user.id, followed_id=user.id).first_or_404()
    delete_from_db(follow)
    
    flash(f'You have unfollowed {user.first_name} {user.last_name}.', 'info')
    return redirect(url_for('profile.view', username=username))

def get_friend_requests(page=1, per_page=10):
    """Get paginated friend requests for the current user."""
    return FriendRequest.query.filter_by(recipient_id=current_user.id, status='pending')\
        .order_by(FriendRequest.created_at.desc())\
        .paginate(page=page, per_page=per_page)

def get_friends(user_id, page=1, per_page=10):
    """Get paginated friends for a user."""
    user = User.query.get_or_404(user_id)
    
    # Get all friendship records where the user is either user_id or friend_id
    friendships = Friendship.query.filter(
        (Friendship.user_id == user_id)
    ).order_by(Friendship.created_at.desc())\
    .paginate(page=page, per_page=per_page)
    
    return friendships

def get_followers(user_id, page=1, per_page=10):
    """Get paginated followers for a user."""
    user = User.query.get_or_404(user_id)
    
    return Follow.query.filter_by(followed_id=user_id)\
        .order_by(Follow.created_at.desc())\
        .paginate(page=page, per_page=per_page)

def get_following(user_id, page=1, per_page=10):
    """Get paginated users that a user is following."""
    user = User.query.get_or_404(user_id)
    
    return Follow.query.filter_by(follower_id=user_id)\
        .order_by(Follow.created_at.desc())\
        .paginate(page=page, per_page=per_page)
