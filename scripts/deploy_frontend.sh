#!/bin/bash
# Deploy frontend to PythonAnywhere
# Location-agnostic - can be run from anywhere

set -e  # Exit on any error

# Get the directory where this script lives
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# Get the project root (one level up from scripts/)
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Configuration
PYTHONANYWHERE_USER="edmondscafe"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
REMOTE_DIST_PATH="/home/$PYTHONANYWHERE_USER/cafe-analytics/frontend/dist"

echo "🏗️  Building frontend..."

# Check if frontend directory exists
if [ ! -d "$FRONTEND_DIR" ]; then
    echo "❌ Error: Frontend directory not found at $FRONTEND_DIR"
    exit 1
fi

# Navigate to frontend and build
cd "$FRONTEND_DIR"
npm run build

# Check if build succeeded
if [ ! -d "$FRONTEND_DIR/dist" ]; then
    echo "❌ Build failed - dist directory not created"
    exit 1
fi

echo "✓ Build successful"
echo ""
echo "📤 Uploading to PythonAnywhere..."

# Create dist directory if it doesn't exist on remote
ssh "$PYTHONANYWHERE_USER@ssh.pythonanywhere.com" "mkdir -p $REMOTE_DIST_PATH"

# Upload the entire dist directory
scp -r "$FRONTEND_DIR/dist/"* "$PYTHONANYWHERE_USER@ssh.pythonanywhere.com:$REMOTE_DIST_PATH/"

if [ $? -eq 0 ]; then
    echo "✓ Upload successful"
    echo ""
    echo "🔄 Next step:"
    echo "⚠️  Go to PythonAnywhere Web tab and click 'Reload' button"
    echo ""
    echo "✅ Frontend deployment complete!"
    echo "🌐 Check: https://$PYTHONANYWHERE_USER.pythonanywhere.com"
else
    echo "❌ Upload failed"
    exit 1
fi
