import sys
import os

# Add your project to the Python path
project_home = '/home/edmondscafe/cafe-analytics'
if project_home not in sys.path:
    sys.path.insert(0, project_home)

# Add backend directory FIRST (this is critical!)
backend_dir = '/home/edmondscafe/cafe-analytics/backend'
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Set database path
os.environ['DATABASE_PATH'] = '/home/edmondscafe/cafe-analytics/database/cafe_reports.db'

# Import the Flask app
from app import app as application
