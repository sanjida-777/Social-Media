import os
import sys
import sqlite3
from datetime import datetime, timezone

# Get the database path from the config
from config import Config

def migrate_database():
    """Migrate the database schema to add new columns to the messages table."""
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

        # Add missing columns if they don't exist
        columns_to_add = {
            'updated_at': 'DATETIME',
            'read_at': 'DATETIME',
            'delivered': 'BOOLEAN DEFAULT 0 NOT NULL',
            'delivered_at': 'DATETIME',
            'edited': 'BOOLEAN DEFAULT 0 NOT NULL',
            'deleted': 'BOOLEAN DEFAULT 0 NOT NULL',
            'client_message_id': 'VARCHAR(100)'
        }

        for column, column_type in columns_to_add.items():
            if column not in columns:
                print(f"Adding column {column} to messages table...")
                cursor.execute(f"ALTER TABLE messages ADD COLUMN {column} {column_type}")

        # Set default values for updated_at
        if 'updated_at' in columns_to_add:
            print("Setting default values for updated_at...")
            current_time = datetime.now(timezone.utc).isoformat()
            cursor.execute(f"UPDATE messages SET updated_at = '{current_time}' WHERE updated_at IS NULL")

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

if __name__ == "__main__":
    success = migrate_database()
    sys.exit(0 if success else 1)
