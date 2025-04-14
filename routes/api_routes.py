from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user
from models.user import User
from models.message import Message
from utils.db_utils import commit_to_db

api = Blueprint('api', __name__, url_prefix='/api')

@api.route('/users/get_id', methods=['GET'])
@login_required
def get_user_id():
    """Get user ID from username"""
    username = request.args.get('username')
    if not username:
        return jsonify({'error': 'Username is required'}), 400
    
    user = User.query.filter_by(username=username).first()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    return jsonify({'user_id': user.id, 'username': user.username})

@api.route('/users/get_username', methods=['GET'])
@login_required
def get_username():
    """Get username from user ID"""
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({'error': 'User ID is required'}), 400
    
    try:
        user_id = int(user_id)
    except ValueError:
        return jsonify({'error': 'Invalid user ID'}), 400
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    return jsonify({'username': user.username, 'user_id': user.id})

@api.route('/users/search', methods=['GET'])
@login_required
def search_users():
    """Search for users by username or name"""
    query = request.args.get('q', '')
    if not query or len(query) < 2:
        return jsonify({'users': []}), 200
    
    # Search for users
    users = User.query.filter(
        (User.username.ilike(f'%{query}%') | 
         User.first_name.ilike(f'%{query}%') | 
         User.last_name.ilike(f'%{query}%')) &
        (User.id != current_user.id)  # Exclude current user
    ).limit(10).all()
    
    # Format results
    results = []
    for user in users:
        results.append({
            'id': user.id,
            'username': user.username,
            'name': f"{user.first_name} {user.last_name}",
            'profile_pic': user.profile_pic
        })
    
    return jsonify({'users': results}), 200

@api.route('/messages/<int:message_id>/read', methods=['POST'])
@login_required
def mark_message_read(message_id):
    """Mark a message as read"""
    message = Message.query.get(message_id)
    if not message:
        return jsonify({'error': 'Message not found'}), 404
    
    # Only recipient can mark as read
    if message.recipient_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    # Mark as read if not already
    if not message.read:
        message.mark_as_read()
        commit_to_db()
    
    return jsonify({
        'success': True,
        'message_id': message.id,
        'read': message.read,
        'read_at': message.read_at.isoformat() if message.read_at else None
    }), 200

@api.route('/messages/<int:message_id>/delivered', methods=['POST'])
@login_required
def mark_message_delivered(message_id):
    """Mark a message as delivered"""
    message = Message.query.get(message_id)
    if not message:
        return jsonify({'error': 'Message not found'}), 404
    
    # Only recipient can mark as delivered
    if message.recipient_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    # Mark as delivered if not already
    if not message.delivered:
        message.mark_as_delivered()
        commit_to_db()
    
    return jsonify({
        'success': True,
        'message_id': message.id,
        'delivered': message.delivered,
        'delivered_at': message.delivered_at.isoformat() if message.delivered_at else None
    }), 200

@api.route('/messages/check_spam', methods=['POST'])
@login_required
def check_message_spam():
    """Check if a message is spam"""
    content = request.json.get('content')
    if not content:
        return jsonify({'error': 'Message content is required'}), 400
    
    # Create temporary message for spam check
    temp_message = Message(
        content=content,
        sender_id=current_user.id,
        recipient_id=0  # Placeholder
    )
    
    # Check for spam
    is_spam = temp_message.check_for_spam()
    
    return jsonify({
        'is_spam': is_spam,
        'spam_score': temp_message.spam_score,
        'content': content
    }), 200
