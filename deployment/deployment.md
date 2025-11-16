# FINAL FIX - Works Both Locally AND on PythonAnywhere

## The Real Problem

The import `from labor_utils import ...` works locally but fails on PythonAnywhere because the **WSGI file** isn't configured correctly.

## The Solution

1. **Keep the absolute import in app.py** (works locally)
2. **Fix the WSGI configuration** on PythonAnywhere (makes it work there too)

---

## Step 1: Deploy the Code

### On Your Laptop:
```bash
cd cafe-analytics

# Use the FINAL version (back to absolute import)
cp app_FINAL.py backend/app.py

# Deploy
git add backend/app.py
git commit -m "Optimize queries with NullCache, fix imports"
git push origin main
```

---

## Step 2: Fix WSGI File on PythonAnywhere

### On PythonAnywhere:

1. Go to **Web** tab
2. Click on **WSGI configuration file** link (near the top)
3. **DELETE EVERYTHING** in that file
4. **PASTE THIS EXACT CODE:**

```python
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
```

5. Click **Save**
6. Go back to **Web** tab
7. Click **Reload**

---

## Step 3: Pull the Code

In PythonAnywhere Bash console:
```bash
cd ~/cafe-analytics
git pull origin main
```

Then **reload web app** again.

---

## Why This Works

**The key difference is in the WSGI file:**

**OLD (broken):**
```python
backend_dir = '/home/edmondscafe/cafe-analytics/backend'
sys.path.insert(0, backend_dir)

from backend.app import app as application  # ← Tries to import as package
```

**NEW (works):**
```python
backend_dir = '/home/edmondscafe/cafe-analytics/backend'
sys.path.insert(0, backend_dir)

from app import app as application  # ← Imports from backend directory
```

When you add `backend/` to sys.path and then import `app`, Python can find `labor_utils.py` in the same directory!

---

## What You're Deploying

✅ Optimized queries (16,800 → 1)
✅ Cache disabled (NullCache - no disk writes)
✅ Absolute imports (works locally and on PA)

---

## Test It Works Locally First

Before deploying, test on your laptop:

```bash
cd cafe-analytics/backend
python3 app.py
```

Should start without errors. If that works, deploy to PythonAnywhere!

---

## If It Still Doesn't Work

Check the error log to see what the actual error is:
```bash
tail -50 /var/log/edmondscafe.pythonanywhere.com.error.log
```

Most likely it will be a different issue (not the import anymore).
