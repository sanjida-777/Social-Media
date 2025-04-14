import uuid
from flask import Blueprint, render_template, request, redirect, url_for, jsonify, flash
from flask_login import login_required, current_user
from flask_wtf import FlaskForm
from wtforms import StringField, TextAreaField, SubmitField, HiddenField
from wtforms.validators import DataRequired, Length
from handlers.message_handler import (
    get_received_messages, get_sent_messages, get_conversation,
    send_message_handler, delete_message_handler, edit_message_handler,
    get_messages_api, send_message_api, update_message_status_api
)

# Create Blueprint
messages = Blueprint('messages', __name__)

# Form classes
class MessageForm(FlaskForm):
    recipient = StringField('Recipient', validators=[DataRequired()])
    content = TextAreaField('Message', validators=[DataRequired(), Length(min=1, max=500)])
    client_message_id = HiddenField()
    submit = SubmitField('Send')

class EditMessageForm(FlaskForm):
    content = TextAreaField('Message', validators=[DataRequired(), Length(min=1, max=500)])
    submit = SubmitField('Update')

# Routes
@messages.route('/inbox')
@login_required
def inbox():
    page = request.args.get('page', 1, type=int)
    messages = get_received_messages(page=page)
    return render_template('messages/inbox.html', title='Inbox', messages=messages)

@messages.route('/sent')
@login_required
def sent():
    page = request.args.get('page', 1, type=int)
    messages = get_sent_messages(page=page)
    return render_template('messages/sent.html', title='Sent Messages', messages=messages)

@messages.route('/conversation/<string:username>')
@login_required
def conversation(username):
    page = request.args.get('page', 1, type=int)
    messages, user = get_conversation(username, page=page)
    form = MessageForm()
    form.recipient.data = username  # Pre-populate recipient field
    return render_template('messages/conversation.html', title=f'Conversation with {username}',
                          messages=messages, user=user, form=form, uuid4=uuid.uuid4)

@messages.route('/new', methods=['GET', 'POST'])
@login_required
def new_message():
    form = MessageForm()
    result = send_message_handler(form)

    if result:
        return result

    return render_template('messages/new_message.html', title='New Message', form=form)

@messages.route('/message/<int:message_id>/delete', methods=['POST'])
@login_required
def delete_message(message_id):
    return delete_message_handler(message_id)

@messages.route('/message/<int:message_id>/edit', methods=['GET', 'POST'])
@login_required
def edit_message(message_id):
    form = EditMessageForm()

    if form.validate_on_submit():
        return edit_message_handler(message_id, form.content.data)

    # Get the message to pre-populate the form
    from models.message import Message
    message = Message.query.get_or_404(message_id)

    # Check if the current user is the sender of the message
    if message.sender != current_user:
        flash('You can only edit messages you sent.', 'danger')
        return redirect(url_for('messages.inbox'))

    # Pre-populate the form
    form.content.data = message.content

    return render_template('messages/edit_message.html', title='Edit Message', form=form, message=message)

# API Routes
@messages.route('/api/messages/<string:username>', methods=['GET'])
@login_required
def api_get_messages(username):
    since_id = request.args.get('since_id', None, type=int)
    limit = request.args.get('limit', 50, type=int)
    messages = get_messages_api(username, since_id, limit)
    return jsonify(messages)

@messages.route('/api/users/search', methods=['GET'])
@login_required
def api_search_users():
    query = request.args.get('q', '', type=str)
    if not query or len(query) < 2:
        return jsonify([]), 200

    # Import User model
    from models.user import User
    from sqlalchemy import or_

    # Search for users by username, first name, or last name
    users = User.query.filter(
        or_(
            User.username.ilike(f'%{query}%'),
            User.first_name.ilike(f'%{query}%'),
            User.last_name.ilike(f'%{query}%')
        )
    ).filter(User.id != current_user.id).limit(10).all()

    # Convert to dict for JSON response
    result = [{
        'id': user.id,
        'username': user.username,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'profile_image': user.profile_image
    } for user in users]

    return jsonify(result)

@messages.route('/api/messages/<string:username>', methods=['POST'])
@login_required
def api_send_message(username):
    data = request.json
    if not data or 'content' not in data:
        return jsonify({'error': 'Content is required'}), 400

    client_message_id = data.get('client_message_id')
    message, status_code = send_message_api(username, data['content'], client_message_id)
    return jsonify(message), status_code

@messages.route('/api/messages/<int:message_id>/status', methods=['PUT'])
@login_required
def api_update_message_status(message_id):
    data = request.json
    if not data or 'status' not in data:
        return jsonify({'error': 'Status is required'}), 400

    if data['status'] not in ['read', 'delivered']:
        return jsonify({'error': 'Invalid status'}), 400

    result = update_message_status_api(message_id, data['status'])
    if isinstance(result, tuple):
        return jsonify(result[0]), result[1]
    return jsonify(result)
