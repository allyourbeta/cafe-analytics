#!/bin/bash
# Deploy frontend to PythonAnywhere with automatic backup
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
BACKUP_DIR="/home/$PYTHONANYWHERE_USER/cafe-analytics/frontend/dist-backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

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

# Test the build locally (optional but recommended)
echo "💡 Tip: Before deploying, test locally with:"
echo "   cd backend && python app.py"
echo "   Then visit http://localhost:5500"
echo ""
read -p "Continue with deployment? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled"
    exit 0
fi

echo "📦 Creating backup on PythonAnywhere..."

# Create backup directory if it doesn't exist
ssh "$PYTHONANYWHERE_USER@ssh.pythonanywhere.com" "mkdir -p $BACKUP_DIR"

# Backup current dist folder (if it exists)
ssh "$PYTHONANYWHERE_USER@ssh.pythonanywhere.com" \
    "if [ -d $REMOTE_DIST_PATH ]; then cp -r $REMOTE_DIST_PATH $BACKUP_DIR/dist-backup-$TIMESTAMP; echo '✓ Backup created: dist-backup-$TIMESTAMP'; else echo '⚠️  No existing dist to backup (first deployment?)'; fi"

# Clean up old backups (keep last 5)
ssh "$PYTHONANYWHERE_USER@ssh.pythonanywhere.com" \
    "cd $BACKUP_DIR && ls -t | tail -n +6 | xargs -r rm -rf && echo '✓ Old backups cleaned up (keeping last 5)'"

echo ""
echo "📤 Uploading to PythonAnywhere..."

# Create dist directory if it doesn't exist on remote
ssh "$PYTHONANYWHERE_USER@ssh.pythonanywhere.com" "mkdir -p $REMOTE_DIST_PATH"

# Upload the entire dist directory
scp -r "$FRONTEND_DIR/dist/"* "$PYTHONANYWHERE_USER@ssh.pythonanywhere.com:$REMOTE_DIST_PATH/"

if [ $? -eq 0 ]; then
    echo "✓ Upload successful"
    echo ""
    echo "🔄 IMPORTANT: Go to PythonAnywhere Web tab and click 'Reload' button"
    echo "   Then press Enter here to continue with health check..."
    read -r
    
    echo ""
    echo "🏥 Running health check..."
    
    # Test if the site is responding
    if curl -f -s "https://$PYTHONANYWHERE_USER.pythonanywhere.com/api/health" > /dev/null 2>&1; then
        echo "✅ Health check PASSED - API is responding"
    else
        echo "⚠️  Health check FAILED - API not responding"
        echo "   Check: https://$PYTHONANYWHERE_USER.pythonanywhere.com/api/health"
        echo ""
        echo "   This could mean:"
        echo "   - You forgot to click Reload in PythonAnywhere"
        echo "   - The backend needs to be deployed too"
        echo "   - There's an actual issue with the deployment"
    fi
    
    # Test if frontend is loading
    echo ""
    if curl -f -s "https://$PYTHONANYWHERE_USER.pythonanywhere.com/" > /dev/null 2>&1; then
        echo "✅ Frontend check PASSED - site is loading"
    else
        echo "⚠️  Frontend check FAILED - site not loading"
    fi
    
    echo ""
    echo "✅ Frontend deployment complete!"
    echo "🌐 Visit: https://$PYTHONANYWHERE_USER.pythonanywhere.com"
    echo ""
    echo "📋 Rollback instructions (if needed):"
    echo "   ssh $PYTHONANYWHERE_USER@ssh.pythonanywhere.com"
    echo "   cd ~/cafe-analytics/frontend"
    echo "   rm -rf dist"
    echo "   cp -r dist-backups/dist-backup-$TIMESTAMP dist"
    echo "   # Then reload in PythonAnywhere Web tab"
    echo ""
    echo "💾 Backup saved as: dist-backup-$TIMESTAMP"
else
    echo "❌ Upload failed"
    exit 1
fi
