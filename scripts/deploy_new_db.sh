#!/bin/bash
# Deploy new database to PythonAnywhere and clear cache
# Location-agnostic - can be run from anywhere

set -e  # Exit on any error

# Get the directory where this script lives
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# Get the project root (one level up from scripts/)
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Configuration
PYTHONANYWHERE_USER="edmondscafe"
DB_FILE="$PROJECT_ROOT/database/cafe_reports.db"
REMOTE_DB_PATH="/home/$PYTHONANYWHERE_USER/cafe-analytics/database/"

echo "📤 Uploading database to PythonAnywhere..."

# Check if database file exists
if [ ! -f "$DB_FILE" ]; then
    echo "❌ Error: Database file not found at $DB_FILE"
    exit 1
fi

# Upload database
scp "$DB_FILE" "$PYTHONANYWHERE_USER@ssh.pythonanywhere.com:$REMOTE_DB_PATH"

if [ $? -eq 0 ]; then
    echo "✓ Database uploaded successfully"
    echo ""
    echo "🔄 Reloading web app..."
    ssh $PYTHONANYWHERE_USER@ssh.pythonanywhere.com "touch /var/www/${PYTHONANYWHERE_USER}_pythonanywhere_com_wsgi.py"
    echo "✓ Web app reloaded"
    echo ""
    echo "🧹 Clearing cache..."
    curl -s -u "$CAFE_ADMIN_CREDS" -X POST https://$PYTHONANYWHERE_USER.pythonanywhere.com/api/admin/clear-cache > /dev/null
    echo "✓ Cache cleared"
    echo ""
    echo "✅ Done! New data is live at https://$PYTHONANYWHERE_USER.pythonanywhere.com"
else
    echo "❌ Database upload failed"
    exit 1
fi
