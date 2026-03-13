# ARCHITECTURE.md — ArvyaX Journal System

## System Overview

```
┌─────────────────┐       ┌──────────────────────────────────────┐
│   React Frontend│──────▶│         Express.js Backend           │
│  (port 3000)    │◀──────│         (port 5000)                  │
└─────────────────┘       │                                      │
                          │  ┌─────────────┐  ┌──────────────┐  │
                          │  │ Rate Limiter│  │  In-Memory   │  │
                          │  │ (per route) │  │  Cache       │  │
                          │  └─────────────┘  └──────────────┘  │
                          │                                      │
                          │  ┌─────────────┐  ┌──────────────┐  │
                          │  │  SQLite DB  │  │ Anthropic    │  │
                          │  │ (WAL mode)  │  │ Claude API   │  │
                          │  └─────────────┘  └──────────────┘  │
                          └──────────────────────────────────────┘
```

---

## 1. How Would You Scale This to 100k Users?

### Current bottlenecks at scale
- SQLite is single-writer, unsuitable beyond ~10k concurrent users
- In-process Node.js cache is lost on restart; not shared across instances
- Single server = no horizontal scaling

### Scaling strategy

**Database: SQLite → PostgreSQL**
- Replace `better-sqlite3` with `pg` + connection pooling via `pg-pool`
- Add read replicas for GET-heavy endpoints (`/journal/:userId`, `/insights/:userId`)
- Partition `journal_entries` table by `user_id` hash for large-scale reads

**Caching: NodeCache → Redis**
```
Analysis cache:  Redis SET with 1hr TTL  (SHA-256 key of text)
Session cache:   Redis for JWT/session tokens
Insights cache:  Redis with 10min TTL per userId (invalidate on new entry)
```

**Horizontal scaling**
```
                  ┌──────────────┐
   Users ────────▶│ Load Balancer│ (AWS ALB / Nginx)
                  └──────┬───────┘
              ┌──────────┼──────────┐
         ┌────▼───┐ ┌────▼───┐ ┌───▼────┐
         │Node #1 │ │Node #2 │ │Node #3 │  ← stateless instances
         └────┬───┘ └────┬───┘ └───┬────┘
              └──────────▼──────────┘
                     ┌───────┐
                     │ Redis │  ← shared cache
                     └───┬───┘
                     ┌───▼───┐
                     │  PG   │  ← primary + replicas
                     └───────┘
```

**Other scaling steps**
- Use a job queue (BullMQ + Redis) to process LLM analysis asynchronously — decouple write from analyze
- CDN (CloudFront) for frontend static assets
- Rate limit at API Gateway level, not application level
- Add `userId` auth with JWT to prevent cross-user data leaks

---

## 2. How Would You Reduce LLM Cost?

### Strategy 1: Aggressive caching (already implemented)
- Hash journal text with SHA-256 → use as cache key
- Identical or near-identical text hits cache, zero LLM cost
- Extend to semantic similarity matching (embed text → cosine similarity threshold 0.92+)

### Strategy 2: Cheaper models for simple text
```
Text length < 100 chars  → claude-haiku-3 (~20x cheaper than Sonnet)
Text length 100–500      → claude-haiku-3
Text length > 500        → claude-sonnet (more nuance needed)
```

### Strategy 3: Batch processing
- Don't analyze on every save. Queue analysis jobs, batch them:
  - Process analysis jobs in batches of 10 every 30 seconds
  - Use Anthropic's Batch API (50% cost reduction)

### Strategy 4: Reduce token count
- Strip whitespace, truncate entries beyond 800 tokens
- Use a tightly constrained system prompt (already done — JSON-only response)
- Set max_tokens=250 (down from 1000+)

### Strategy 5: User-driven analysis
- Only run LLM when user explicitly clicks "Analyze" (already implemented)
- Don't auto-analyze on save — let user decide

---

## 3. How Would You Cache Repeated Analysis?

### Current implementation (in-memory)
```javascript
// SHA-256 hash of trimmed lowercase text → 16-char key
const cacheKey = crypto.createHash('sha256')
  .update(text.trim().toLowerCase()).digest('hex').slice(0, 16);

const cached = analysisCache.get(cacheKey); // NodeCache, 1hr TTL
if (cached) return { ...cached, cached: true };
```

### Production-grade caching with Redis

```javascript
// 1. Exact match cache (text hash → result)
const exactKey = `analysis:exact:${sha256(text)}`;
const exact = await redis.get(exactKey);
if (exact) return JSON.parse(exact);

// 2. Semantic cache (optional, higher hit rate)
const embedding = await embedText(text); // OpenAI/Cohere embeddings
const similar = await vectorDB.findSimilar(embedding, threshold=0.92);
if (similar) return similar.result;

// 3. Store result
await redis.setEx(exactKey, 3600, JSON.stringify(result)); // 1hr TTL
```

### Cache invalidation strategy
- Entries: 1-hour TTL (stale analysis acceptable)
- Insights: 10-minute TTL per userId, invalidated on new entry creation
- Never cache if `text.length < 10` (too short, too variable)

### Cache hit rate estimation
- Users often write similar entries on the same ambience ("I felt calm")
- Expect ~30–40% hit rate for repeated users
- With semantic caching: up to 60% hit rate

---

## 4. How Would You Protect Sensitive Journal Data?

Journal entries contain deeply personal mental health information. Security must be treated seriously.

### Authentication & Authorization
```
- JWT tokens with short expiry (15min access + 7day refresh)
- Every /api/journal route validates that req.userId === token.sub
- No user can read another user's entries — enforced at DB query level
- Add userId to every SQL WHERE clause (already done in this implementation)
```

### Encryption at rest
```
Option A (simple):  Enable SQLite encryption with SQLCipher
Option B (cloud):   Use PostgreSQL with AWS RDS encryption (AES-256)
Option C (field):   Encrypt the `text` column with AES-256-GCM before storing:

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  // Store: iv + authTag + encrypted
```

### Encryption in transit
- HTTPS everywhere (TLS 1.2+), enforced via nginx / load balancer
- HSTS headers to prevent downgrade attacks

### LLM data privacy
- Do NOT send userId or personally identifying information to the LLM
- Only send the journal text (already implemented — no PII in prompt)
- Consider self-hosted open-source LLM (Ollama + Llama 3) for fully private processing

### API Security
- Rate limiting per IP and per userId (already implemented)
- Input sanitization — text length limits enforced
- No raw SQL string interpolation — parameterized queries only (already implemented)
- API keys stored in environment variables, never in source code

### Compliance considerations
- Mental health data may qualify as sensitive health data under GDPR / HIPAA
- Implement right-to-erasure: `DELETE FROM journal_entries WHERE user_id = ?`
- Log access patterns, not content, for audit trails
- Data retention policy: auto-delete entries older than configurable period

---

## Data Model

```sql
journal_entries (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL,           -- user identifier
  ambience    TEXT NOT NULL,           -- forest | ocean | mountain | ...
  text        TEXT NOT NULL,           -- raw journal text
  emotion     TEXT,                    -- LLM result: primary emotion
  keywords    TEXT,                    -- LLM result: JSON array of strings
  summary     TEXT,                    -- LLM result: one-sentence summary
  analyzed_at TEXT,                    -- ISO timestamp of last analysis
  created_at  TEXT NOT NULL            -- ISO timestamp of creation
)

Indexes:
  idx_user_id        → fast user-scoped queries
  idx_created_at     → fast time-range queries
  idx_user_emotion   → fast emotion aggregation for insights
```

---

## Technology Choices

| Layer | Choice | Reason |
|---|---|---|
| Backend | Node.js + Express | Fast iteration, async I/O for LLM calls |
| Database | SQLite (WAL) | Zero-config, production-ready for this scale |
| LLM | Anthropic Claude Sonnet | Reliable JSON output, best instruction-following |
| Cache | node-cache (in-process) | Zero deps for prototype; swap Redis in production |
| Frontend | React (CRA) | Simple, fast, meets requirements |
| Container | Docker + Compose | Reproducible environment, easy deployment |

---

## Future Improvements

1. **WebSocket support** — push analysis results to frontend as they complete
2. **Semantic search** — find similar journal entries by mood/keywords
3. **Trend visualization** — emotion timeline chart with recharts
4. **Multi-user auth** — proper login system with JWT
5. **Export** — download all entries as PDF/CSV
6. **Offline mode** — PWA with service worker, sync when online
