from datetime import datetime, timezone
from models import db

class FriendRequest(db.Model):
    """Model for friend requests between users."""
    __tablename__ = 'friend_requests'

    id = db.Column(db.Integer, primary_key=True)
    sender_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    recipient_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    status = db.Column(db.String(20), default='pending', nullable=False)  # pending, accepted, rejected
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Ensure a user can't send multiple requests to the same recipient
    __table_args__ = (db.UniqueConstraint('sender_id', 'recipient_id', name='unique_friend_request'),)

    def __repr__(self):
        return f"FriendRequest(sender_id={self.sender_id}, recipient_id={self.recipient_id}, status='{self.status}')"


class Friendship(db.Model):
    """Model for friendships between users."""
    __tablename__ = 'friendships'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    friend_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    # Ensure a user can't be friends with the same person twice
    __table_args__ = (db.UniqueConstraint('user_id', 'friend_id', name='unique_friendship'),)

    def __repr__(self):
        return f"Friendship(user_id={self.user_id}, friend_id={self.friend_id})"


class Follow(db.Model):
    """Model for follow relationships between users."""
    __tablename__ = 'follows'

    id = db.Column(db.Integer, primary_key=True)
    follower_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    followed_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    # Ensure a user can't follow the same person twice
    __table_args__ = (db.UniqueConstraint('follower_id', 'followed_id', name='unique_follow'),)

    def __repr__(self):
        return f"Follow(follower_id={self.follower_id}, followed_id={self.followed_id})"
