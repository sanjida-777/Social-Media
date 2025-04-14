from PIL import Image, ImageDraw, ImageFont
import os

def create_default_profile_image():
    """Create a default profile image with a blue background and white 'FB' text."""
    # Create a 150x150 image with a blue background (Facebook blue)
    img = Image.new('RGB', (150, 150), color=(66, 103, 178))
    draw = ImageDraw.Draw(img)

    # Try to use a system font, or use default if not available
    try:
        # Try to find a suitable font
        font_size = 60
        font = ImageFont.truetype("arial.ttf", font_size)
    except IOError:
        # If the specific font is not available, use default
        font = ImageFont.load_default()

    # Add text 'FB' in white
    text = "FB"

    # Get text size using the newer Pillow API
    if hasattr(font, 'getbbox'):
        # For newer Pillow versions
        bbox = font.getbbox(text)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
    else:
        # Fallback for older versions
        text_width, text_height = font.getsize(text)

    position = ((150 - text_width) // 2, (150 - text_height) // 2)

    # Draw the text
    draw.text(position, text, fill=(255, 255, 255), font=font)

    # Save the image
    img_path = os.path.join('static', 'img', 'profile_pics', 'default.jpg')
    img.save(img_path)
    print(f"Default profile image created at {img_path}")

if __name__ == "__main__":
    create_default_profile_image()
