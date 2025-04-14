from models import db

def commit_to_db(obj=None):
    """Add object to database and commit."""
    if obj:
        db.session.add(obj)
    db.session.commit()

def delete_from_db(obj):
    """Delete object from database and commit."""
    db.session.delete(obj)
    db.session.commit()
