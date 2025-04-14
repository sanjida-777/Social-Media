from flask import flash, redirect, url_for
from flask_login import current_user
from models.post import Post, Like
from models.comment import Comment
from utils.db_utils import commit_to_db, delete_from_db
import os
from flask import current_app

def get_posts(page=1, per_page=10):
    """Get paginated posts for the feed."""
    return Post.query.order_by(Post.created_at.desc()).paginate(page=page, per_page=per_page)

def create_post_handler(form):
    """Handle post creation."""
    if form.validate_on_submit():
        post = Post(content=form.content.data, author=current_user)
        
        # Handle image upload if provided
        if form.image.data:
            # Save the image
            image_file = save_post_image(form.image.data)
            post.image = image_file
        
        commit_to_db(post)
        flash('Your post has been created!', 'success')
        return redirect(url_for('feed.index'))
    
    return None  # Form validation failed

def update_post_handler(post_id, form):
    """Handle post update."""
    post = Post.query.get_or_404(post_id)
    
    # Check if the current user is the author of the post
    if post.author != current_user:
        flash('You do not have permission to edit this post.', 'danger')
        return redirect(url_for('feed.index'))
    
    if form.validate_on_submit():
        post.content = form.content.data
        
        # Handle image update if provided
        if form.image.data:
            # Delete old image if it exists
            if post.image:
                delete_post_image(post.image)
            
            # Save the new image
            image_file = save_post_image(form.image.data)
            post.image = image_file
        
        commit_to_db()
        flash('Your post has been updated!', 'success')
        return redirect(url_for('feed.index'))
    elif request.method == 'GET':
        # Pre-populate form with current post data
        form.content.data = post.content
    
    return None  # Form validation failed

def delete_post_handler(post_id):
    """Handle post deletion."""
    post = Post.query.get_or_404(post_id)
    
    # Check if the current user is the author of the post
    if post.author != current_user:
        flash('You do not have permission to delete this post.', 'danger')
        return redirect(url_for('feed.index'))
    
    # Delete post image if it exists
    if post.image:
        delete_post_image(post.image)
    
    delete_from_db(post)
    flash('Your post has been deleted!', 'success')
    return redirect(url_for('feed.index'))

def create_comment_handler(post_id, form):
    """Handle comment creation."""
    post = Post.query.get_or_404(post_id)
    
    if form.validate_on_submit():
        comment = Comment(
            content=form.content.data,
            post=post,
            author=current_user
        )
        commit_to_db(comment)
        flash('Your comment has been added!', 'success')
        return redirect(url_for('feed.view_post', post_id=post_id))
    
    return None  # Form validation failed

def like_post_handler(post_id):
    """Handle post like/unlike."""
    post = Post.query.get_or_404(post_id)
    
    # Check if the user already liked the post
    like = Like.query.filter_by(user_id=current_user.id, post_id=post_id).first()
    
    if like:
        # Unlike the post
        delete_from_db(like)
        flash('Post unliked!', 'info')
    else:
        # Like the post
        like = Like(user_id=current_user.id, post_id=post_id)
        commit_to_db(like)
        flash('Post liked!', 'success')
    
    return redirect(url_for('feed.view_post', post_id=post_id))

def save_post_image(form_image):
    """Save post image with a random name."""
    import secrets
    random_hex = secrets.token_hex(8)
    _, f_ext = os.path.splitext(form_image.filename)
    image_fn = random_hex + f_ext
    image_path = os.path.join(current_app.root_path, 'static/img/post_images', image_fn)
    
    # Save the image
    form_image.save(image_path)
    
    return image_fn

def delete_post_image(image_filename):
    """Delete post image from the filesystem."""
    image_path = os.path.join(current_app.root_path, 'static/img/post_images', image_filename)
    if os.path.exists(image_path):
        os.remove(image_path)
