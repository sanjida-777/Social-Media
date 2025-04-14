from datetime import datetime, timezone
from flask_login import UserMixin
from models import db
from sqlalchemy.ext.associationproxy import association_proxy

# Import these at the bottom to avoid circular imports
from models.friendship import FriendRequest, Friendship, Follow

class User(db.Model, UserMixin):
    """User model for storing user related details."""
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(60), nullable=False)
    first_name = db.Column(db.String(50), nullable=False)
    last_name = db.Column(db.String(50), nullable=False)
    profile_image = db.Column(db.String(20), nullable=False, default='default.jpg')
    bio = db.Column(db.Text, nullable=True)
    date_of_birth = db.Column(db.Date, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Messaging and status fields
    is_online = db.Column(db.Boolean, default=False, nullable=False)
    last_login = db.Column(db.DateTime, nullable=True)
    last_seen = db.Column(db.DateTime, nullable=True)
    status_message = db.Column(db.String(100), nullable=True)
    typing_to = db.Column(db.Integer, nullable=True)  # User ID of who this user is typing to

    # Relationships
    posts = db.relationship('Post', backref='author', lazy=True, cascade='all, delete-orphan')
    comments = db.relationship('Comment', backref='author', lazy=True, cascade='all, delete-orphan')
    sent_messages = db.relationship('Message',
                                   foreign_keys='Message.sender_id',
                                   backref='sender',
                                   lazy=True,
                                   cascade='all, delete-orphan')
    received_messages = db.relationship('Message',
                                       foreign_keys='Message.recipient_id',
                                       backref='recipient',
                                       lazy=True,
                                       cascade='all, delete-orphan')

    # Friend request relationships
    sent_friend_requests = db.relationship('FriendRequest',
                                         foreign_keys='FriendRequest.sender_id',
                                         backref='sender',
                                         lazy=True,
                                         cascade='all, delete-orphan')
    received_friend_requests = db.relationship('FriendRequest',
                                             foreign_keys='FriendRequest.recipient_id',
                                             backref='recipient',
                                             lazy=True,
                                             cascade='all, delete-orphan')

    # Friendship relationships
    friendships = db.relationship('Friendship',
                                 foreign_keys='Friendship.user_id',
                                 backref='user',
                                 lazy=True,
                                 cascade='all, delete-orphan')
    friended_by = db.relationship('Friendship',
                                 foreign_keys='Friendship.friend_id',
                                 backref='friend',
                                 lazy=True,
                                 cascade='all, delete-orphan')

    # Follow relationships
    following = db.relationship('Follow',
                               foreign_keys='Follow.follower_id',
                               backref='follower',
                               lazy=True,
                               cascade='all, delete-orphan')
    followers = db.relationship('Follow',
                               foreign_keys='Follow.followed_id',
                               backref='followed',
                               lazy=True,
                               cascade='all, delete-orphan')

    # Association proxies for easier access
    friends = association_proxy('friendships', 'friend')
    followed_users = association_proxy('following', 'followed')
    follower_users = association_proxy('followers', 'follower')

    def __repr__(self):
        return f"User('{self.username}', '{self.email}')"

    def is_friends_with(self, user_id):
        """Check if the user is friends with another user."""
        return Friendship.query.filter(
            ((Friendship.user_id == self.id) & (Friendship.friend_id == user_id)) |
            ((Friendship.user_id == user_id) & (Friendship.friend_id == self.id))
        ).first() is not None

    def has_pending_friend_request_from(self, user_id):
        """Check if the user has a pending friend request from another user."""
        return FriendRequest.query.filter_by(
            sender_id=user_id, recipient_id=self.id, status='pending'
        ).first() is not None

    def has_pending_friend_request_to(self, user_id):
        """Check if the user has sent a pending friend request to another user."""
        return FriendRequest.query.filter_by(
            sender_id=self.id, recipient_id=user_id, status='pending'
        ).first() is not None

    def is_following(self, user_id):
        """Check if the user is following another user."""
        return Follow.query.filter_by(
            follower_id=self.id, followed_id=user_id
        ).first() is not None

    def is_followed_by(self, user_id):
        """Check if the user is followed by another user."""
        return Follow.query.filter_by(
            follower_id=user_id, followed_id=self.id
        ).first() is not None
