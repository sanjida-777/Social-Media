import os
import sys
import sqlite3
from datetime import datetime, timezone

# Get the database path from the config
from config import Config

def migrate_database():
    """Migrate the database schema to add new columns to the messages and users tables."""
    print("Starting database migration...")

    # Connect to the database
    db_path = Config.SQLALCHEMY_DATABASE_URI.replace('sqlite:///', '')
    print(f"Original database path: {db_path}")

    # Check if the database is in the instance folder (Flask default)
    instance_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'instance', db_path)
    if os.path.exists(instance_path):
        db_path = instance_path
        print(f"Found database in instance folder: {db_path}")
    # If the path is relative, make it absolute
    elif not os.path.isabs(db_path):
        db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), db_path)
        print(f"Absolute database path: {db_path}")

    if not os.path.exists(db_path):
        print(f"Database file not found at {db_path}")
        return False

    print(f"Connected to database at {db_path}")

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Check if the messages table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='messages'")
        if not cursor.fetchone():
            print("Messages table does not exist. No migration needed.")
            return False

        # Get current columns in the messages table
        cursor.execute(f"PRAGMA table_info(messages)")
        columns = [column[1] for column in cursor.fetchall()]
        print(f"Current columns: {columns}")

        # Add missing columns to messages table if they don't exist
        messages_columns_to_add = {
            'updated_at': 'DATETIME',
            'read_at': 'DATETIME',
            'delivered': 'BOOLEAN DEFAULT 0 NOT NULL',
            'delivered_at': 'DATETIME',
            'edited': 'BOOLEAN DEFAULT 0 NOT NULL',
            'deleted': 'BOOLEAN DEFAULT 0 NOT NULL',
            'client_message_id': 'VARCHAR(100)',
            'sent': 'BOOLEAN DEFAULT 1 NOT NULL',
            'sent_at': 'DATETIME',
            'failed': 'BOOLEAN DEFAULT 0 NOT NULL',
            'failure_reason': 'VARCHAR(255)',
            'is_spam': 'BOOLEAN DEFAULT 0 NOT NULL',
            'spam_score': 'FLOAT DEFAULT 0.0',
            'attachment_filename': 'VARCHAR(255)',
            'attachment_type': 'VARCHAR(20)'
        }

        for column, column_type in messages_columns_to_add.items():
            if column not in columns:
                print(f"Adding column {column} to messages table...")
                cursor.execute(f"ALTER TABLE messages ADD COLUMN {column} {column_type}")

        # Set default values for updated_at
        if 'updated_at' in messages_columns_to_add and 'updated_at' not in columns:
            print("Setting default values for updated_at...")
            current_time = datetime.now(timezone.utc).isoformat()
            cursor.execute(f"UPDATE messages SET updated_at = '{current_time}' WHERE updated_at IS NULL")

        # Now check and update the users table
        print("Checking users table...")
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
        if not cursor.fetchone():
            print("Users table does not exist. No migration needed.")
            return False

        # Get current columns in the users table
        cursor.execute(f"PRAGMA table_info(users)")
        user_columns = [column[1] for column in cursor.fetchall()]
        print(f"Current user columns: {user_columns}")

        # Add missing columns to users table if they don't exist
        users_columns_to_add = {
            'is_online': 'BOOLEAN DEFAULT 0 NOT NULL',
            'last_login': 'DATETIME',
            'last_seen': 'DATETIME',
            'status_message': 'VARCHAR(100)',
            'typing_to': 'INTEGER'
        }

        for column, column_type in users_columns_to_add.items():
            if column not in user_columns:
                print(f"Adding column {column} to users table...")
                cursor.execute(f"ALTER TABLE users ADD COLUMN {column} {column_type}")

        # Commit the changes
        conn.commit()
        print("Migration completed successfully!")
        return True

    except sqlite3.Error as e:
        print(f"SQLite error: {e}")
        return False

    finally:
        if conn:
            conn.close()

def create_uploads_directory():
    """Create directory for message attachments."""
    uploads_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static', 'uploads', 'message_attachments')
    if not os.path.exists(uploads_dir):
        print(f"Creating directory: {uploads_dir}")
        os.makedirs(uploads_dir)
        return True
    else:
        print(f"Directory already exists: {uploads_dir}")
        return True

if __name__ == "__main__":
    success = migrate_database()
    dir_success = create_uploads_directory()
    sys.exit(0 if success and dir_success else 1)
