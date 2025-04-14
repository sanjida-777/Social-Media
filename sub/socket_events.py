from flask_socketio import SocketIO, emit, join_room, leave_room
from flask import request
from flask_login import current_user
from models.message import Message
from models.user import User
from models.friendship import Friendship
from utils.db_utils import commit_to_db
from datetime import datetime, timezone

# Initialize SocketIO
socketio = SocketIO()

# Store online users and their socket IDs
online_users = {}
# Store typing status
typing_users = {}
# Store user activity timestamps
user_activity = {}

def init_app(app):
    """Initialize SocketIO with the Flask app"""
    socketio.init_app(app, cors_allowed_origins="*", async_mode='eventlet')
    return socketio

@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    if current_user.is_authenticated:
        user_id = current_user.id
        # Add user to online users
        if user_id not in online_users:
            online_users[user_id] = []

        # Add current session ID to user's sessions
        online_users[user_id].append(request.sid)

        # Update user's last activity and online status in database
        current_user.is_online = True
        current_user.last_seen = datetime.now(timezone.utc)
        commit_to_db()

        # Update user's last activity in memory
        user_activity[user_id] = datetime.now(timezone.utc)

        # Get user's friends to notify them
        friends = get_user_friends(user_id)

        # Broadcast user online status to friends
        for friend_id in friends:
            emit('user_status', {
                'user_id': user_id,
                'status': 'online',
                'last_seen': current_user.last_seen.isoformat() if current_user.last_seen else None
            }, room=f'user_{friend_id}')

        # Join user's personal room for direct messages
        join_room(f'user_{user_id}')

        # Join rooms for all active conversations
        active_conversations = get_user_active_conversations(user_id)
        for conversation in active_conversations:
            other_user_id = conversation['other_user_id']
            room = f'conversation_{min(user_id, other_user_id)}_{max(user_id, other_user_id)}'
            join_room(room)

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    if current_user.is_authenticated:
        user_id = current_user.id

        # Remove session ID from user's sessions
        if user_id in online_users and request.sid in online_users[user_id]:
            online_users[user_id].remove(request.sid)

            # If no more active sessions, user is offline
            if not online_users[user_id]:
                del online_users[user_id]

                # Update user's online status and last seen in database
                current_user.is_online = False
                current_user.last_seen = datetime.now(timezone.utc)
                commit_to_db()

                # Get user's friends to notify them
                friends = get_user_friends(user_id)

                # Broadcast user offline status to friends
                for friend_id in friends:
                    emit('user_status', {
                        'user_id': user_id,
                        'status': 'offline',
                        'last_seen': current_user.last_seen.isoformat() if current_user.last_seen else None
                    }, room=f'user_{friend_id}')

                # Clear typing status
                if user_id in typing_users:
                    for recipient_id in typing_users[user_id]:
                        emit('typing_status', {
                            'user_id': user_id,
                            'status': False
                        }, room=f'user_{recipient_id}')
                    del typing_users[user_id]

@socketio.on('join_conversation')
def handle_join_conversation(data):
    """Join a conversation room"""
    if current_user.is_authenticated:
        user_id = current_user.id
        other_user_id = data.get('user_id')

        # Create a unique room name for this conversation (sorted user IDs)
        room = f'conversation_{min(user_id, other_user_id)}_{max(user_id, other_user_id)}'
        join_room(room)

        # Update user's last activity
        user_activity[user_id] = datetime.now(timezone.utc)

        # Notify the other user that this user has joined the conversation
        emit('conversation_status', {
            'user_id': user_id,
            'status': 'joined'
        }, room=f'user_{other_user_id}')

@socketio.on('leave_conversation')
def handle_leave_conversation(data):
    """Leave a conversation room"""
    if current_user.is_authenticated:
        user_id = current_user.id
        other_user_id = data.get('user_id')

        # Create a unique room name for this conversation
        room = f'conversation_{min(user_id, other_user_id)}_{max(user_id, other_user_id)}'
        leave_room(room)

        # Clear typing status
        if user_id in typing_users and other_user_id in typing_users[user_id]:
            del typing_users[user_id][other_user_id]

            # Notify the other user that this user is no longer typing
            emit('typing_status', {
                'user_id': user_id,
                'status': False
            }, room=f'user_{other_user_id}')

@socketio.on('send_message')
def handle_send_message(data):
    """Handle sending a message"""
    if current_user.is_authenticated:
        user_id = current_user.id
        recipient_id = data.get('recipient_id')
        content = data.get('content')
        client_message_id = data.get('client_message_id')

        if not recipient_id or not content:
            return {'error': 'Missing required fields'}

        # Update user's last activity
        user_activity[user_id] = datetime.now(timezone.utc)

        # Clear typing status
        if user_id in typing_users and recipient_id in typing_users[user_id]:
            del typing_users[user_id][recipient_id]

        try:
            # Get recipient user
            recipient = User.query.get(recipient_id)
            if not recipient:
                return {'error': 'Recipient not found'}

            # Create new message
            message = Message(
                content=content,
                sender=current_user,
                recipient=recipient,
                client_message_id=client_message_id
            )

            # Save to database
            commit_to_db(message)

            # Prepare message data for sending
            message_data = {
                'id': message.id,
                'content': message.content,
                'sender_id': message.sender_id,
                'recipient_id': message.recipient_id,
                'created_at': message.created_at.isoformat(),
                'updated_at': message.updated_at.isoformat(),
                'read': False,
                'delivered': False,
                'client_message_id': message.client_message_id
            }

            # Create a unique room name for this conversation
            room = f'conversation_{min(user_id, recipient_id)}_{max(user_id, recipient_id)}'

            # Send to the conversation room
            emit('new_message', message_data, room=room)

            # Also send to recipient's personal room (for notifications)
            emit('new_message', message_data, room=f'user_{recipient_id}')

            # Mark as delivered if recipient is online
            if recipient_id in online_users and online_users[recipient_id]:
                message.mark_as_delivered()
                commit_to_db()

                # Send delivery receipt
                delivery_data = {
                    'message_id': message.id,
                    'delivered_at': message.delivered_at.isoformat() if message.delivered_at else None
                }
                emit('message_delivered', delivery_data, room=f'user_{user_id}')

            return {'success': True, 'message': message_data}

        except Exception as e:
            print(f"Error sending message: {str(e)}")
            return {'error': 'Failed to send message'}

@socketio.on('typing')
def handle_typing(data):
    """Handle typing indicator"""
    if current_user.is_authenticated:
        user_id = current_user.id
        recipient_id = data.get('recipient_id')
        is_typing = data.get('typing', False)

        if not recipient_id:
            return {'error': 'Missing recipient_id'}

        # Update user's last activity
        user_activity[user_id] = datetime.now(timezone.utc)

        # Initialize typing status for this user if not exists
        if user_id not in typing_users:
            typing_users[user_id] = {}

        # Update typing status
        if is_typing:
            typing_users[user_id][recipient_id] = datetime.now(timezone.utc)
        elif recipient_id in typing_users[user_id]:
            del typing_users[user_id][recipient_id]

        # Send typing status to recipient
        emit('typing_status', {
            'user_id': user_id,
            'status': is_typing
        }, room=f'user_{recipient_id}')

        return {'success': True}

@socketio.on('read_message')
def handle_read_message(data):
    """Handle message read receipt"""
    if current_user.is_authenticated:
        user_id = current_user.id
        message_id = data.get('message_id')

        if not message_id:
            return {'error': 'Missing message_id'}

        # Update user's last activity
        user_activity[user_id] = datetime.now(timezone.utc)

        try:
            # Get message
            message = Message.query.get(message_id)
            if not message:
                return {'error': 'Message not found'}

            # Only recipient can mark message as read
            if message.recipient_id != user_id:
                return {'error': 'Unauthorized'}

            # Mark as read
            if not message.read:
                message.mark_as_read()
                commit_to_db()

                # Send read receipt to sender
                read_data = {
                    'message_id': message.id,
                    'read_at': message.read_at.isoformat() if message.read_at else None
                }
                emit('message_read', read_data, room=f'user_{message.sender_id}')

            return {'success': True}

        except Exception as e:
            print(f"Error marking message as read: {str(e)}")
            return {'error': 'Failed to mark message as read'}

@socketio.on('get_online_status')
def handle_get_online_status(data):
    """Get online status of users"""
    if current_user.is_authenticated:
        user_ids = data.get('user_ids', [])

        if not user_ids:
            return {'error': 'Missing user_ids'}

        # Get online status for each user
        status = {}
        for user_id in user_ids:
            status[user_id] = user_id in online_users and bool(online_users[user_id])

        return {'success': True, 'status': status}

# Helper functions for user relationships
def get_user_friends(user_id):
    """Get list of user's friend IDs"""
    try:
        # Get friendships where user is either user_id or friend_id
        friendships1 = Friendship.query.filter_by(user_id=user_id).all()
        friendships2 = Friendship.query.filter_by(friend_id=user_id).all()

        # Extract friend IDs
        friend_ids = [f.friend_id for f in friendships1] + [f.user_id for f in friendships2]

        return friend_ids
    except Exception as e:
        print(f"Error getting user friends: {str(e)}")
        return []

def get_user_active_conversations(user_id):
    """Get user's active conversations"""
    # Get recent messages sent by or to the user
    sent_messages = Message.query.filter_by(sender_id=user_id).order_by(Message.created_at.desc()).limit(20).all()
    received_messages = Message.query.filter_by(recipient_id=user_id).order_by(Message.created_at.desc()).limit(20).all()

    # Combine and sort by most recent
    all_messages = sent_messages + received_messages
    all_messages.sort(key=lambda x: x.created_at, reverse=True)

    # Extract unique conversation partners
    conversations = []
    conversation_partners = set()

    for message in all_messages:
        other_user_id = message.recipient_id if message.sender_id == user_id else message.sender_id

        if other_user_id not in conversation_partners:
            conversation_partners.add(other_user_id)
            conversations.append({
                'other_user_id': other_user_id,
                'last_message': message
            })

    return conversations

# Periodic task to clean up inactive typing indicators
def cleanup_typing_indicators():
    """Remove typing indicators for inactive users"""
    now = datetime.now(timezone.utc)
    for user_id in list(typing_users.keys()):
        for recipient_id in list(typing_users[user_id].keys()):
            # If typing status is older than 10 seconds, remove it
            if (now - typing_users[user_id][recipient_id]).total_seconds() > 10:
                del typing_users[user_id][recipient_id]

                # Notify the recipient that the user is no longer typing
                emit('typing_status', {
                    'user_id': user_id,
                    'status': False
                }, room=f'user_{recipient_id}')
