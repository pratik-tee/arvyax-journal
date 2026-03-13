# 🌿 ArvyaX AI-Assisted Journal System

A full-stack journaling application where users write about immersive nature sessions, get AI-powered emotion analysis, and track their mental wellness over time.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd arvyax-journal
```

### 2. Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
npm install
npm start
```

Backend runs on **http://localhost:5000**

### 3. Frontend Setup

```bash
cd frontend
npm install
npm start
```

Frontend runs on **http://localhost:3000**

---

## 🐳 Docker (Recommended)

```bash
# Copy and configure env
cp backend/.env.example .env
# Edit .env: set ANTHROPIC_API_KEY

docker-compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

---

## 📡 API Reference

### Create Journal Entry
```
POST /api/journal
Content-Type: application/json

{
  "userId": "user_001",
  "ambience": "forest",
  "text": "I felt calm today after listening to the rain."
}
```

### Get All Entries for User
```
GET /api/journal/:userId
GET /api/journal/user_001?limit=20&offset=0
```

### Analyze Emotion (LLM)
```
POST /api/journal/analyze
Content-Type: application/json

{
  "text": "I felt calm today after listening to the rain",
  "entryId": 1   // optional: saves result back to entry
}

Response:
{
  "emotion": "calm",
  "keywords": ["rain", "nature", "peace"],
  "summary": "User experienced relaxation during the forest session",
  "cached": false
}
```

### Get User Insights
```
GET /api/journal/insights/:userId

Response:
{
  "totalEntries": 8,
  "topEmotion": "calm",
  "mostUsedAmbience": "forest",
  "recentKeywords": ["focus", "nature", "rain"],
  "emotionBreakdown": { "calm": 5, "happy": 2, "reflective": 1 },
  "ambienceBreakdown": { "forest": 4, "ocean": 2, "mountain": 2 },
  "entriesLast7Days": 3
}
```

### Streaming Analysis (Bonus)
```
POST /api/journal/analyze
{ "text": "...", "stream": true }

Returns: text/event-stream with SSE chunks
```

---

## 🏗️ Project Structure

```
arvyax-journal/
├── backend/
│   ├── src/
│   │   ├── index.js          # Express app, middleware, server
│   │   ├── routes/journal.js # All API routes
│   │   ├── db/database.js    # SQLite initialization
│   │   └── services/
│   │       └── llmService.js # Anthropic + in-memory cache
│   ├── .env.example
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.js            # Main React app
│   │   ├── App.css           # Styles
│   │   └── api/journal.js    # API client
│   ├── public/
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── docker-compose.yml
├── README.md
└── ARCHITECTURE.md
```

---

## ✅ Implemented Features

| Feature | Status |
|---|---|
| POST /api/journal | ✅ |
| GET /api/journal/:userId | ✅ |
| POST /api/journal/analyze | ✅ Real LLM (Claude) |
| GET /api/journal/insights/:userId | ✅ |
| React frontend (write, view, analyze, insights) | ✅ |
| SQLite database | ✅ |
| Streaming LLM response | ✅ Bonus |
| Analysis result caching | ✅ Bonus |
| Rate limiting | ✅ Bonus |
| Docker setup | ✅ Bonus |

---

## 🔑 Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | Backend port | `5000` |
| `ANTHROPIC_API_KEY` | Your Anthropic API key | required |
| `FRONTEND_URL` | CORS origin | `http://localhost:3000` |
| `DB_PATH` | SQLite file path | `./journal.db` |
