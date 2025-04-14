import os
import secrets
from PIL import Image
from flask import current_app

def save_profile_picture(form_picture):
    """Save user profile picture with a random name."""
    random_hex = secrets.token_hex(8)
    _, f_ext = os.path.splitext(form_picture.filename)
    picture_fn = random_hex + f_ext
    picture_path = os.path.join(current_app.root_path, 'static/img/profile_pics', picture_fn)
    
    # Resize image to save space and improve load time
    output_size = (150, 150)
    i = Image.open(form_picture)
    i.thumbnail(output_size)
    i.save(picture_path)
    
    return picture_fn
