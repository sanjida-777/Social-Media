from flask import Blueprint, redirect, url_for, render_template

bp = Blueprint('err', __name__)

@bp.route("/404")
def handle_404():
    return render_template('errors/404.html'), 404

@bp.route("/403")
def handle_403():
    return render_template('errors/403.html'), 403

@bp.route("/405")
def handle_405():
    return render_template('errors/405.html'), 405

@bp.route("/500")
def handle_500():
    return render_template('errors/500.html'), 500