from datetime import datetime, timezone
from models import db

class Message(db.Model):
    """Message model for storing user messages."""
    __tablename__ = 'messages'

    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    read = db.Column(db.Boolean, default=False, nullable=False)
    read_at = db.Column(db.DateTime, nullable=True)
    delivered = db.Column(db.Boolean, default=False, nullable=False)
    delivered_at = db.Column(db.DateTime, nullable=True)
    edited = db.Column(db.Boolean, default=False, nullable=False)
    deleted = db.Column(db.Boolean, default=False, nullable=False)
    sender_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    recipient_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    client_message_id = db.Column(db.String(100), nullable=True)  # For client-side message tracking

    def __repr__(self):
        return f"Message('{self.content[:20]}...', '{self.created_at}')"

    def mark_as_read(self):
        """Mark the message as read."""
        self.read = True
        self.read_at = datetime.now(timezone.utc)

    def mark_as_delivered(self):
        """Mark the message as delivered."""
        self.delivered = True
        self.delivered_at = datetime.now(timezone.utc)

    def mark_as_edited(self):
        """Mark the message as edited."""
        self.edited = True
        self.updated_at = datetime.now(timezone.utc)

    def mark_as_deleted(self):
        """Mark the message as deleted."""
        self.deleted = True
        self.content = "This message was deleted"
        self.updated_at = datetime.now(timezone.utc)

    def to_dict(self):
        """Convert message to dictionary for API responses."""
        return {
            'id': self.id,
            'content': self.content if not self.deleted else "This message was deleted",
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'read': self.read,
            'read_at': self.read_at.isoformat() if self.read_at else None,
            'delivered': self.delivered,
            'delivered_at': self.delivered_at.isoformat() if self.delivered_at else None,
            'edited': self.edited,
            'deleted': self.deleted,
            'sender_id': self.sender_id,
            'recipient_id': self.recipient_id,
            'client_message_id': self.client_message_id
        }
