from datetime import datetime, timezone
from models import db
import re

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

    # Message status tracking
    sent = db.Column(db.Boolean, default=True, nullable=False)
    sent_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    failed = db.Column(db.Boolean, default=False, nullable=False)
    failure_reason = db.Column(db.String(255), nullable=True)

    # Spam detection
    is_spam = db.Column(db.Boolean, default=False, nullable=False)
    spam_score = db.Column(db.Float, default=0.0, nullable=False)

    # Attachment fields
    attachment_filename = db.Column(db.String(255), nullable=True)
    attachment_type = db.Column(db.String(20), nullable=True)  # image, pdf, document, file

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

    def mark_as_deleted(self, hard_delete=False):
        """Mark the message as deleted.

        Args:
            hard_delete (bool): If True, completely remove message content and attachments
        """
        self.deleted = True

        if hard_delete:
            # Hard delete - remove all content and attachments
            self.content = ""

            # Delete attachment if exists
            if self.attachment_filename:
                self.delete_attachment()
                self.attachment_filename = None
                self.attachment_type = None
        else:
            # Soft delete - just mark as deleted
            self.content = "This message was deleted"

        self.updated_at = datetime.now(timezone.utc)

    def delete_attachment(self):
        """Delete the message attachment file if it exists."""
        if self.attachment_filename:
            try:
                import os
                from flask import current_app
                file_path = os.path.join(current_app.root_path, 'static', 'uploads', 'message_attachments', self.attachment_filename)
                if os.path.exists(file_path):
                    os.remove(file_path)
                    return True
            except Exception as e:
                print(f"Error deleting attachment: {str(e)}")
        return False

    def check_for_spam(self):
        """Basic spam detection for messages."""
        spam_score = 0.0
        content = self.content.lower()

        # Check for common spam patterns
        spam_patterns = [
            r'\b(viagra|cialis|buy now|click here|free money|lottery|won|winner|\$\$\$)\b',
            r'\b(\d{3,})\s*-?\s*(\d{3,})\s*-?\s*(\d{4,})',  # Phone numbers
            r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',  # Email addresses
            r'(https?://|www\.)\S+',  # URLs
            r'\b(cash|money|loan|credit|debt|investment)\b.*\b(fast|quick|easy|guaranteed|instant)\b'
        ]

        # Check each pattern
        for pattern in spam_patterns:
            matches = re.findall(pattern, content)
            if matches:
                spam_score += 0.2 * len(matches)

        # Check for excessive capitalization
        caps_ratio = sum(1 for c in self.content if c.isupper()) / max(len(self.content), 1)
        if caps_ratio > 0.5 and len(self.content) > 10:
            spam_score += 0.3

        # Check for excessive punctuation
        punct_count = sum(1 for c in self.content if c in '!?*$%#@')
        if punct_count > 5:
            spam_score += 0.2

        # Update spam score and flag
        self.spam_score = min(spam_score, 1.0)  # Cap at 1.0
        self.is_spam = spam_score > 0.5  # Flag as spam if score > 0.5

        return self.is_spam

    def mark_as_failed(self, reason=None):
        """Mark the message as failed to send."""
        self.failed = True
        self.failure_reason = reason

    def to_dict(self):
        """Convert message to dictionary for API responses."""
        # For deleted messages, handle content appropriately
        if self.deleted:
            if not self.content:  # Hard deleted (empty content)
                display_content = "This message was deleted"
            else:  # Soft deleted (content is already "This message was deleted")
                display_content = self.content
        else:
            display_content = self.content

        return {
            'id': self.id,
            'content': display_content,
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
            'client_message_id': self.client_message_id,
            'sent': self.sent,
            'sent_at': self.sent_at.isoformat() if self.sent_at else None,
            'failed': self.failed,
            'failure_reason': self.failure_reason,
            'is_spam': self.is_spam,
            'spam_score': self.spam_score,
            'attachment_filename': self.attachment_filename if not (self.deleted and not self.content) else None,
            'attachment_type': self.attachment_type if not (self.deleted and not self.content) else None,
            'has_attachment': bool(self.attachment_filename) and not (self.deleted and not self.content)
        }
