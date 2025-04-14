from models import db

def commit_to_db(obj=None):
    """Add object to database and commit.

    Args:
        obj: Optional object to add to the session before committing.

    Returns:
        bool: True if commit was successful, False otherwise.
    """
    try:
        if obj:
            db.session.add(obj)
        db.session.commit()
        return True
    except Exception as e:
        db.session.rollback()
        print(f"Error committing to database: {str(e)}")
        return False

def delete_from_db(obj):
    """Delete object from database and commit.

    Args:
        obj: Object to delete from the session.

    Returns:
        bool: True if delete was successful, False otherwise.
    """
    try:
        db.session.delete(obj)
        db.session.commit()
        return True
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting from database: {str(e)}")
        return False
