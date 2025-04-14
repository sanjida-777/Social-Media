import uuid
from datetime import datetime, timezone
from flask import flash, redirect, url_for, request, jsonify
from flask_login import current_user
from models.user import User
from models.message import Message
from utils.db_utils import commit_to_db, delete_from_db

def get_received_messages(page=1, per_page=10):
    """Get paginated received messages for the current user, grouped by sender."""
    from sqlalchemy import func
    from sqlalchemy.orm import aliased

    # Use a subquery to get the most recent message from each sender
    subq = Message.query.filter_by(recipient=current_user)\
        .with_entities(
            Message.sender_id,
            func.max(Message.created_at).label('max_date')
        ).group_by(Message.sender_id).subquery()

    # Join the subquery with the messages table to get the actual messages
    messages = Message.query.join(
        subq,
        (Message.sender_id == subq.c.sender_id) &
        (Message.created_at == subq.c.max_date)
    ).filter(Message.recipient == current_user)\
        .order_by(Message.created_at.desc())\
        .paginate(page=page, per_page=per_page)

    return messages

def get_sent_messages(page=1, per_page=10):
    """Get paginated sent messages for the current user, grouped by recipient."""
    from sqlalchemy import func

    # Use a subquery to get the most recent message to each recipient
    subq = Message.query.filter_by(sender=current_user)\
        .with_entities(
            Message.recipient_id,
            func.max(Message.created_at).label('max_date')
        ).group_by(Message.recipient_id).subquery()

    # Join the subquery with the messages table to get the actual messages
    messages = Message.query.join(
        subq,
        (Message.recipient_id == subq.c.recipient_id) &
        (Message.created_at == subq.c.max_date)
    ).filter(Message.sender == current_user)\
        .order_by(Message.created_at.desc())\
        .paginate(page=page, per_page=per_page)

    return messages

def get_conversation(username, page=1, per_page=20):
    """Get paginated conversation with a specific user."""
    user = User.query.filter_by(username=username).first_or_404()

    # Get messages between current user and the specified user
    messages = Message.query.filter(
        ((Message.sender_id == current_user.id) & (Message.recipient_id == user.id)) |
        ((Message.sender_id == user.id) & (Message.recipient_id == current_user.id))
    ).order_by(Message.created_at.asc()).paginate(page=page, per_page=per_page)

    # Mark unread messages as read
    unread_messages = Message.query.filter_by(
        sender_id=user.id,
        recipient_id=current_user.id,
        read=False
    ).all()

    for message in unread_messages:
        message.mark_as_read()

    # Mark undelivered messages as delivered
    undelivered_messages = Message.query.filter_by(
        sender_id=user.id,
        recipient_id=current_user.id,
        delivered=False
    ).all()

    for message in undelivered_messages:
        message.mark_as_delivered()

    if unread_messages or undelivered_messages:
        commit_to_db()

    return messages, user

def send_message_handler(form, client_message_id=None):
    """Handle sending a message."""
    if form.validate_on_submit():
        recipient = User.query.filter_by(username=form.recipient.data).first()

        if not recipient:
            flash('User not found.', 'danger')
            return redirect(url_for('messages.new_message'))

        # Generate a client message ID if not provided
        if not client_message_id:
            client_message_id = str(uuid.uuid4())

        message = Message(
            content=form.content.data,
            sender=current_user,
            recipient=recipient,
            client_message_id=client_message_id
        )

        commit_to_db(message)
        flash('Your message has been sent!', 'success')
        return redirect(url_for('messages.conversation', username=recipient.username))

    return None  # Form validation failed

def delete_message_handler(message_id):
    """Handle message deletion."""
    message = Message.query.get_or_404(message_id)

    # Check if the current user is the sender of the message
    if message.sender != current_user:
        flash('You can only delete messages you sent.', 'danger')
        return redirect(url_for('messages.inbox'))

    # Soft delete the message
    message.mark_as_deleted()
    commit_to_db()
    flash('Message deleted!', 'success')

    # Redirect to appropriate page
    if request.referrer and 'conversation' in request.referrer:
        username = request.referrer.split('/')[-1]
        return redirect(url_for('messages.conversation', username=username))
    else:
        return redirect(url_for('messages.inbox'))

def edit_message_handler(message_id, new_content):
    """Handle message editing."""
    message = Message.query.get_or_404(message_id)

    # Check if the current user is the sender of the message
    if message.sender != current_user:
        flash('You can only edit messages you sent.', 'danger')
        return redirect(url_for('messages.inbox'))

    # Update the message content and mark as edited
    message.content = new_content
    message.mark_as_edited()
    commit_to_db()

    flash('Message updated!', 'success')

    # Redirect to appropriate page
    if request.referrer and 'conversation' in request.referrer:
        username = request.referrer.split('/')[-1]
        return redirect(url_for('messages.conversation', username=username))
    else:
        return redirect(url_for('messages.inbox'))

# API Handlers for AJAX requests
def get_messages_api(username, since_id=None, limit=50):
    """Get messages for API."""
    user = User.query.filter_by(username=username).first_or_404()

    # Base query
    query = Message.query.filter(
        ((Message.sender_id == current_user.id) & (Message.recipient_id == user.id)) |
        ((Message.sender_id == user.id) & (Message.recipient_id == current_user.id))
    ).order_by(Message.created_at.desc())

    # If since_id is provided, get only newer messages
    if since_id:
        last_message = Message.query.get(since_id)
        if last_message:
            query = query.filter(Message.created_at > last_message.created_at)

    # Limit the number of messages
    messages = query.limit(limit).all()

    # Mark messages as read and delivered
    unread_messages = [m for m in messages if m.recipient_id == current_user.id and not m.read]
    undelivered_messages = [m for m in messages if m.recipient_id == current_user.id and not m.delivered]

    for message in unread_messages:
        message.mark_as_read()

    for message in undelivered_messages:
        message.mark_as_delivered()

    if unread_messages or undelivered_messages:
        commit_to_db()

    # Convert to dict for JSON response
    return [message.to_dict() for message in messages]

def send_message_api(recipient_username, content, client_message_id=None):
    """Send a message via API."""
    recipient = User.query.filter_by(username=recipient_username).first()

    if not recipient:
        return {'error': 'User not found'}, 404

    # Generate a client message ID if not provided
    if not client_message_id:
        client_message_id = str(uuid.uuid4())

    message = Message(
        content=content,
        sender=current_user,
        recipient=recipient,
        client_message_id=client_message_id,
        delivered=False
    )

    commit_to_db(message)

    return message.to_dict(), 201

def update_message_status_api(message_id, status):
    """Update message status via API."""
    message = Message.query.get_or_404(message_id)

    # Verify the current user is either the sender or recipient
    if message.sender != current_user and message.recipient != current_user:
        return {'error': 'Unauthorized'}, 403

    # Update status based on request
    if status == 'read' and message.recipient == current_user and not message.read:
        message.mark_as_read()
        commit_to_db()
    elif status == 'delivered' and message.recipient == current_user and not message.delivered:
        message.mark_as_delivered()
        commit_to_db()

    return message.to_dict()
