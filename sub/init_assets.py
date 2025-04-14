"""
Initialize application assets.
Creates necessary directories and default files for the application.
"""

import os
import json
import shutil
from pathlib import Path

def create_directory(path):
    """Create directory if it doesn't exist"""
    if not os.path.exists(path):
        os.makedirs(path)
        print(f"Created directory: {path}")
    else:
        print(f"Directory already exists: {path}")

def create_default_logo():
    """Create default logo SVG file"""
    logo_path = os.path.join('static', 'img', 'logo.svg')
    
    if not os.path.exists(logo_path):
        with open(logo_path, 'w') as f:
            f.write('''<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="40" height="40" rx="8" fill="#1877F2"/>
  <path d="M28 20C28 15.5817 24.4183 12 20 12C15.5817 12 12 15.5817 12 20C12 23.993 14.9229 27.3027 18.75 27.9028V22.3438H16.7188V20H18.75V18.1562C18.75 16.1562 19.9442 15.0625 21.7715 15.0625C22.6442 15.0625 23.5625 15.2188 23.5625 15.2188V17.1875H22.5538C21.56 17.1875 21.25 17.7812 21.25 18.3906V20H23.4688L23.1141 22.3438H21.25V27.9028C25.0771 27.3027 28 23.993 28 20Z" fill="white"/>
</svg>''')
        print(f"Created default logo: {logo_path}")
    else:
        print(f"Logo already exists: {logo_path}")

def create_default_favicon():
    """Create default favicon.ico file"""
    favicon_path = os.path.join('static', 'img', 'favicon.ico')
    
    if not os.path.exists(favicon_path):
        # Create a simple 16x16 blue square as favicon
        try:
            from PIL import Image
            img = Image.new('RGB', (16, 16), color=(24, 119, 242))
            img.save(favicon_path)
            print(f"Created default favicon: {favicon_path}")
        except ImportError:
            print("PIL not installed. Skipping favicon creation.")
    else:
        print(f"Favicon already exists: {favicon_path}")

def create_default_touch_icon():
    """Create default touch icon for mobile devices"""
    touch_icon_path = os.path.join('static', 'img', 'touch-icon.png')
    
    if not os.path.exists(touch_icon_path):
        # Create a simple 180x180 blue square as touch icon
        try:
            from PIL import Image, ImageDraw, ImageFont
            img = Image.new('RGB', (180, 180), color=(24, 119, 242))
            draw = ImageDraw.Draw(img)
            
            # Try to add text "SL" to the icon
            try:
                font = ImageFont.truetype("arial.ttf", 100)
                draw.text((45, 40), "SL", fill=(255, 255, 255), font=font)
            except:
                # If font loading fails, draw a simple circle
                draw.ellipse((45, 45, 135, 135), fill=(255, 255, 255))
            
            img.save(touch_icon_path)
            print(f"Created default touch icon: {touch_icon_path}")
        except ImportError:
            print("PIL not installed. Skipping touch icon creation.")
    else:
        print(f"Touch icon already exists: {touch_icon_path}")

def create_upload_directories():
    """Create directories for user uploads"""
    upload_dirs = [
        os.path.join('static', 'uploads', 'profile_pics'),
        os.path.join('static', 'uploads', 'posts'),
        os.path.join('static', 'uploads', 'stories'),
        os.path.join('static', 'uploads', 'message_attachments')
    ]
    
    for directory in upload_dirs:
        create_directory(directory)

def create_default_profile_image():
    """Create default profile image"""
    default_profile_path = os.path.join('static', 'img', 'profile_pics', 'default.jpg')
    
    if not os.path.exists(default_profile_path):
        try:
            from PIL import Image, ImageDraw
            
            # Create a 200x200 gray image with a white circle
            img = Image.new('RGB', (200, 200), color=(200, 200, 200))
            draw = ImageDraw.Draw(img)
            draw.ellipse((50, 50, 150, 150), fill=(255, 255, 255))
            
            # Draw a simple face
            draw.ellipse((80, 85, 90, 95), fill=(150, 150, 150))  # Left eye
            draw.ellipse((110, 85, 120, 95), fill=(150, 150, 150))  # Right eye
            draw.arc((75, 95, 125, 135), start=0, end=180, fill=(150, 150, 150), width=2)  # Smile
            
            img.save(default_profile_path)
            print(f"Created default profile image: {default_profile_path}")
        except ImportError:
            print("PIL not installed. Skipping default profile image creation.")
            
            # Try to copy a placeholder image if available
            placeholder_path = os.path.join('static', 'img', 'placeholder-profile.jpg')
            if os.path.exists(placeholder_path):
                shutil.copy(placeholder_path, default_profile_path)
                print(f"Copied placeholder profile image to: {default_profile_path}")
    else:
        print(f"Default profile image already exists: {default_profile_path}")

def validate_config():
    """Validate config.json file"""
    config_path = 'config.json'
    
    if os.path.exists(config_path):
        try:
            with open(config_path, 'r') as f:
                config = json.load(f)
            print("Config file is valid JSON.")
            
            # Check for required fields
            required_fields = [
                'site.name', 
                'site.logo.favicon', 
                'site.logo.touchIcon',
                'app.defaultTheme'
            ]
            
            for field in required_fields:
                parts = field.split('.')
                value = config
                for part in parts:
                    if part not in value:
                        print(f"Warning: Missing required field '{field}' in config.json")
                        break
                    value = value[part]
            
            return config
        except json.JSONDecodeError:
            print("Error: config.json is not valid JSON.")
            return None
    else:
        print("Warning: config.json file not found.")
        return None

def main():
    """Main initialization function"""
    print("Initializing SocialLite assets...")
    
    # Create necessary directories
    create_directory(os.path.join('static', 'img'))
    create_directory(os.path.join('static', 'img', 'profile_pics'))
    create_directory(os.path.join('static', 'uploads'))
    
    # Create default assets
    create_default_logo()
    create_default_favicon()
    create_default_touch_icon()
    create_default_profile_image()
    
    # Create upload directories
    create_upload_directories()
    
    # Validate config
    config = validate_config()
    
    print("Asset initialization complete!")

if __name__ == "__main__":
    main()
