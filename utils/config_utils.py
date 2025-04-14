"""
Configuration utilities for the SocialLite application.
Loads and provides access to application configuration.
"""

import os
import json
from flask import current_app

def load_config():
    """
    Load the application configuration from config.json

    Returns:
        dict: The configuration dictionary
    """
    config_path = os.path.join(current_app.root_path, 'config.json')

    try:
        with open(config_path, 'r') as config_file:
            config = json.load(config_file)
        return config
    except (FileNotFoundError, json.JSONDecodeError) as e:
        current_app.logger.error(f"Error loading configuration: {str(e)}")
        return get_default_config()

def get_default_config():
    """
    Get a default configuration in case loading fails

    Returns:
        dict: Default configuration dictionary
    """
    return {
        "site": {
            "name": "SocialLite",
            "tagline": "A lightweight social experience",
            "description": "A responsive and lightweight social media platform",
            "version": "1.0.0",
            "logo": {
                "main": "/static/img/logo.svg",
                "favicon": "/static/img/favicon.ico",
                "touchIcon": "/static/img/touch-icon.png"
            },
            "url": "https://sociallite.example.com",
            "language": "en",
            "themeColor": "#1877f2"
        },
        "app": {
            "defaultTheme": "dark",
            "dataSaver": {
                "enabled": False
            }
        }
    }

def get_config_value(config, path, default=None):
    """
    Get a configuration value by path

    Args:
        config (dict): The configuration dictionary
        path (str): Dot notation path to the configuration value
        default: Default value if path doesn't exist

    Returns:
        The configuration value or default value
    """
    keys = path.split('.')
    value = config

    for key in keys:
        if not isinstance(value, dict) or key not in value:
            return default
        value = value[key]

    return value
