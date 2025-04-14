from flask import Blueprint, render_template, request
from flask_login import login_required, current_user
from models.user import User
from handlers.friendship_handler import (
    send_friend_request_handler, accept_friend_request_handler,
    reject_friend_request_handler, cancel_friend_request_handler,
    unfriend_handler, follow_user_handler, unfollow_user_handler,
    get_friend_requests, get_friends, get_followers, get_following
)

# Create Blueprint
friendship = Blueprint('friendship', __name__)

# Friend Request Routes
@friendship.route('/send_request/<string:username>', methods=['POST'])
@login_required
def send_request(username):
    return send_friend_request_handler(username)

@friendship.route('/accept_request/<string:username>', methods=['POST'])
@login_required
def accept_request(username):
    return accept_friend_request_handler(username)

@friendship.route('/reject_request/<string:username>', methods=['POST'])
@login_required
def reject_request(username):
    return reject_friend_request_handler(username)

@friendship.route('/cancel_request/<string:username>', methods=['POST'])
@login_required
def cancel_request(username):
    return cancel_friend_request_handler(username)

@friendship.route('/unfriend/<string:username>', methods=['POST'])
@login_required
def unfriend(username):
    return unfriend_handler(username)

# Follow Routes
@friendship.route('/follow/<string:username>', methods=['POST'])
@login_required
def follow(username):
    return follow_user_handler(username)

@friendship.route('/unfollow/<string:username>', methods=['POST'])
@login_required
def unfollow(username):
    return unfollow_user_handler(username)

# Friend Requests List
@friendship.route('/requests')
@login_required
def friend_requests():
    page = request.args.get('page', 1, type=int)
    requests = get_friend_requests(page=page)
    return render_template('friendship/requests.html', title='Friend Requests', requests=requests)

# Friends List
@friendship.route('/friends/<int:user_id>')
@login_required
def friends(user_id):
    page = request.args.get('page', 1, type=int)
    user = User.query.get_or_404(user_id)
    friendships = get_friends(user_id, page=page)
    return render_template('friendship/friends.html', title=f'{user.username}\'s Friends', 
                          user=user, friendships=friendships)

# Followers List
@friendship.route('/followers/<int:user_id>')
@login_required
def followers(user_id):
    page = request.args.get('page', 1, type=int)
    user = User.query.get_or_404(user_id)
    follows = get_followers(user_id, page=page)
    return render_template('friendship/followers.html', title=f'{user.username}\'s Followers', 
                          user=user, follows=follows)

# Following List
@friendship.route('/following/<int:user_id>')
@login_required
def following(user_id):
    page = request.args.get('page', 1, type=int)
    user = User.query.get_or_404(user_id)
    follows = get_following(user_id, page=page)
    return render_template('friendship/following.html', title=f'People {user.username} Follows', 
                          user=user, follows=follows)
