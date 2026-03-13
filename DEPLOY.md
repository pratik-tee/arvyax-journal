# 🚀 Deployment Guide — ArvyaX Journal

Deploy in ~10 minutes:
- **Backend** → Railway (free tier, Node.js + persistent SQLite)
- **Frontend** → Vercel (free tier, React)

---

## Step 1: Push to GitHub

Create a new GitHub repo and push this project:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/arvyax-journal.git
git push -u origin main
```

---

## Step 2: Deploy Backend on Railway

1. Go to **https://railway.app** → Sign in with GitHub
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select your repo → choose the **`backend`** folder as root directory
   - In Railway: Settings → Source → **Root Directory** → type `backend`
4. Add Environment Variables (Settings → Variables):
   ```
   ANTHROPIC_API_KEY = sk-ant-xxxxx   ← your actual key
   PORT              = 5000
   NODE_ENV          = production
   ```
5. Add a **Volume** for SQLite persistence:
   - Go to your service → **"Add Volume"**
   - Mount path: `/app/data`
   - Set env var: `DB_PATH = /app/data/journal.db`
6. Railway will auto-deploy. Copy the **public URL** (e.g. `https://arvyax-journal-production.up.railway.app`)

**Test it:**
```
curl https://YOUR-RAILWAY-URL.up.railway.app/health
→ {"status":"ok","timestamp":"..."}
```

---

## Step 3: Deploy Frontend on Vercel

1. Go to **https://vercel.com** → Sign in with GitHub
2. Click **"Add New Project"** → Import your GitHub repo
3. Set **Root Directory** to `frontend`
4. Add Environment Variable:
   ```
   REACT_APP_API_URL = https://YOUR-RAILWAY-URL.up.railway.app/api
   ```
   _(Replace with your actual Railway URL from Step 2)_
5. Click **Deploy** → Vercel builds and gives you a live URL like:
   `https://arvyax-journal.vercel.app`

---

## Step 4: Update CORS on Railway

Go back to Railway → add one more env var:
```
FRONTEND_URL = https://arvyax-journal.vercel.app
```
Then redeploy (Railway auto-redeploys on env changes).

---

## ✅ Final Checklist

| Item | Done? |
|---|---|
| `https://your-app.vercel.app` loads the UI | ☐ |
| Can write and save a journal entry | ☐ |
| Analyze button returns real emotion data | ☐ |
| Insights tab shows stats | ☐ |
| `/health` endpoint returns OK | ☐ |

---

## Troubleshooting

**CORS error in browser console:**
- Make sure `FRONTEND_URL` on Railway matches your exact Vercel URL (no trailing slash)

**"Failed to analyze" error:**
- Check Railway logs → verify `ANTHROPIC_API_KEY` is set correctly

**SQLite errors on Railway:**
- Make sure you added the Volume at `/app/data` and set `DB_PATH=/app/data/journal.db`

**Build fails on Vercel:**
- Make sure Root Directory is set to `frontend` (not the repo root)
