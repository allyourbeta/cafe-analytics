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
REMOTE_WSGI_PATH="/var/www/${PYTHONANYWHERE_USER}_pythonanywhere_com_wsgi.py"
RELOAD_WAIT_SECONDS=8
SITE_URL="https://$PYTHONANYWHERE_USER.pythonanywhere.com"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Printed on both success and failure — you need it most when a deploy goes bad.
print_rollback_instructions() {
    echo ""
    echo "📋 Rollback instructions (if needed):"
    echo "   ssh $PYTHONANYWHERE_USER@ssh.pythonanywhere.com"
    echo "   cd ~/cafe-analytics/frontend"
    echo "   rm -rf dist"
    echo "   cp -r dist-backups/dist-backup-$TIMESTAMP dist"
    echo "   touch $REMOTE_WSGI_PATH"
    echo ""
    echo "💾 Backup saved as: dist-backup-$TIMESTAMP"
}

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
    echo "🔄 Reloading web app..."

    # Clicking "Reload" in the PythonAnywhere Web tab just updates the mtime on
    # the WSGI file; the platform watches that file and restarts the worker.
    # Touching it over SSH does the same thing without leaving the terminal.
    ssh "$PYTHONANYWHERE_USER@ssh.pythonanywhere.com" "touch $REMOTE_WSGI_PATH"

    # The worker restarts asynchronously, so the first request after a touch can
    # still hit the old process. Give it a moment before health-checking.
    echo "   Waiting ${RELOAD_WAIT_SECONDS}s for the worker to restart..."
    sleep "$RELOAD_WAIT_SECONDS"

    echo ""
    echo "🏥 Running health check..."

    # The site sits behind PythonAnywhere's Web-tab password protection, so an
    # unauthenticated request gets 401 from the proxy and never reaches Flask.
    # --netrc makes curl read credentials from ~/.netrc (chmod 600), keeping the
    # password out of this script, out of git, and out of shell history.
    # Expected ~/.netrc entry:
    #     machine edmondscafe.pythonanywhere.com
    #     login <basic-auth-username>
    #     password <basic-auth-password>
    CURL_OPTS=(--fail --silent --show-error --netrc --max-time 20)

    checks_failed=0

    # API check. --fail turns any 4xx/5xx into a non-zero exit, so a 401 here
    # means the credentials are wrong, not that the app is down.
    if curl "${CURL_OPTS[@]}" "$SITE_URL/api/health" > /dev/null; then
        echo "✅ API check PASSED"
    else
        echo "❌ API check FAILED - $SITE_URL/api/health"
        checks_failed=1
    fi

    # Frontend check.
    if curl "${CURL_OPTS[@]}" "$SITE_URL/" > /dev/null; then
        echo "✅ Frontend check PASSED"
    else
        echo "❌ Frontend check FAILED - $SITE_URL"
        checks_failed=1
    fi

    echo ""
    if [ "$checks_failed" -ne 0 ]; then
        echo "❌ Deployment uploaded but health checks FAILED."
        echo ""
        echo "   Possible causes:"
        echo "   - 401: missing or wrong credentials in ~/.netrc"
        echo "   - 502: worker still restarting; retry in a few seconds"
        echo "   - Backend code needs deploying too"
        echo ""
        print_rollback_instructions
        exit 1
    fi

    echo "✅ Frontend deployment complete!"
    echo "🌐 Visit: $SITE_URL"
    print_rollback_instructions
else
    echo "❌ Upload failed"
    exit 1
fi
