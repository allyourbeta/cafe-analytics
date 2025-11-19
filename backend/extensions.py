"""Flask extensions initialized here to avoid circular imports."""
from flask_caching import Cache

# Create cache instance (will be initialized with app later)
cache = Cache()
