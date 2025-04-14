from flask import Blueprint, render_template, request, redirect, url_for
from flask_login import login_required, current_user
from flask_wtf import FlaskForm
from wtforms import StringField, TextAreaField, SubmitField
from wtforms.validators import DataRequired, Length
from flask_wtf.file import FileField, FileAllowed
from models.post import Post
from handlers.feed_handler import (
    get_posts, create_post_handler, update_post_handler, 
    delete_post_handler, create_comment_handler, like_post_handler
)

# Create Blueprint
feed = Blueprint('feed', __name__)

# Form classes
class PostForm(FlaskForm):
    content = TextAreaField('Content', validators=[DataRequired(), Length(min=1, max=500)])
    image = FileField('Image', validators=[FileAllowed(['jpg', 'png', 'jpeg'])])
    submit = SubmitField('Post')

class CommentForm(FlaskForm):
    content = TextAreaField('Comment', validators=[DataRequired(), Length(min=1, max=200)])
    submit = SubmitField('Comment')

# Routes
@feed.route('/')
@feed.route('/home')
@login_required
def index():
    page = request.args.get('page', 1, type=int)
    posts = get_posts(page=page, per_page=10)
    form = PostForm()
    return render_template('feed/index.html', title='Home', posts=posts, form=form)

@feed.route('/post/new', methods=['GET', 'POST'])
@login_required
def new_post():
    form = PostForm()
    result = create_post_handler(form)
    
    if result:
        return result
    
    return render_template('feed/create_post.html', title='New Post', form=form, legend='New Post')

@feed.route('/post/<int:post_id>')
@login_required
def view_post(post_id):
    post = Post.query.get_or_404(post_id)
    comment_form = CommentForm()
    return render_template('feed/post.html', title=f'Post by {post.author.username}', post=post, form=comment_form)

@feed.route('/post/<int:post_id>/update', methods=['GET', 'POST'])
@login_required
def update_post(post_id):
    form = PostForm()
    result = update_post_handler(post_id, form)
    
    if result:
        return result
    
    return render_template('feed/create_post.html', title='Update Post', form=form, legend='Update Post')

@feed.route('/post/<int:post_id>/delete', methods=['POST'])
@login_required
def delete_post(post_id):
    return delete_post_handler(post_id)

@feed.route('/post/<int:post_id>/comment', methods=['POST'])
@login_required
def comment_post(post_id):
    form = CommentForm()
    result = create_comment_handler(post_id, form)
    
    if result:
        return result
    
    return redirect(url_for('feed.view_post', post_id=post_id))

@feed.route('/post/<int:post_id>/like', methods=['POST'])
@login_required
def like_post(post_id):
    return like_post_handler(post_id)
