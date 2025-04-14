from flask import Blueprint, redirect, url_for, render_template

bp = Blueprint('err', __name__)

@bp.route("/404")
def handle_404():
    pass

@bp.route("/403")
def handle_403():
    pass

@bp.route("/405")
def handle_405():
    pass