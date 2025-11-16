#!/bin/bash
# Deploy new database to PythonAnywhere and clear cache

echo "📤 Uploading database to PythonAnywhere..."
scp database/cafe_reports.db edmondscafe@ssh.pythonanywhere.com:/home/edmondscafe/cafe-analytics/database/

if [ $? -eq 0 ]; then
    echo "✓ Database uploaded successfully"
    echo ""
    echo "🔄 Clearing cache on PythonAnywhere..."
    curl -X POST https://edmondscafe.pythonanywhere.com/api/admin/clear-cache
    echo ""
    echo ""
    echo "✅ Done! New data is live at https://edmondscafe.pythonanywhere.com"
else
    echo "❌ Database upload failed"
    exit 1
fi
