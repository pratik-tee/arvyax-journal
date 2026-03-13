const express = require("express");
const router = express.Router();
const { getDB } = require("../db/database");
const { analyzeEmotion, analyzeEmotionStream } = require("../services/llmService");

// ─────────────────────────────────────────────
// POST /api/journal
// Create a new journal entry
// ─────────────────────────────────────────────
router.post("/", (req, res) => {
  const { userId, ambience, text } = req.body;

  if (!userId || !ambience || !text) {
    return res.status(400).json({ error: "userId, ambience, and text are required." });
  }

  const validAmbiences = ["forest", "ocean", "mountain", "desert", "rain", "city"];
  if (!validAmbiences.includes(ambience)) {
    return res.status(400).json({ error: `ambience must be one of: ${validAmbiences.join(", ")}` });
  }

  if (text.trim().length < 5) {
    return res.status(400).json({ error: "Journal entry text is too short." });
  }

  try {
    const db = getDB();
    const stmt = db.prepare(
      `INSERT INTO journal_entries (user_id, ambience, text) VALUES (?, ?, ?)`
    );
    const result = stmt.run(userId, ambience, text.trim());

    const entry = db.prepare("SELECT * FROM journal_entries WHERE id = ?").get(result.lastInsertRowid);

    res.status(201).json({
      message: "Journal entry created successfully.",
      entry: formatEntry(entry),
    });
  } catch (err) {
    console.error("DB error:", err);
    res.status(500).json({ error: "Failed to save journal entry." });
  }
});

// ─────────────────────────────────────────────
// GET /api/journal/:userId
// Get all entries for a user
// ─────────────────────────────────────────────
router.get("/:userId", (req, res) => {
  const { userId } = req.params;
  const { limit = 50, offset = 0 } = req.query;

  try {
    const db = getDB();
    const entries = db
      .prepare(
        `SELECT * FROM journal_entries WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`
      )
      .all(userId, parseInt(limit), parseInt(offset));

    const total = db
      .prepare("SELECT COUNT(*) as count FROM journal_entries WHERE user_id = ?")
      .get(userId).count;

    res.json({
      entries: entries.map(formatEntry),
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (err) {
    console.error("DB error:", err);
    res.status(500).json({ error: "Failed to fetch entries." });
  }
});

// ─────────────────────────────────────────────
// POST /api/journal/analyze
// Analyze emotion from text using LLM
// ─────────────────────────────────────────────
router.post("/analyze", async (req, res) => {
  const { text, entryId, stream: useStream } = req.body;

  if (!text || text.trim().length < 5) {
    return res.status(400).json({ error: "text is required and must be at least 5 characters." });
  }

  try {
    // Streaming response (bonus feature)
    if (useStream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const result = await analyzeEmotionStream(text, (chunk) => {
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      });

      // If entryId provided, update the entry in DB
      if (entryId) {
        updateEntryAnalysis(entryId, result);
      }

      res.write(`data: ${JSON.stringify({ done: true, result })}\n\n`);
      return res.end();
    }

    // Standard response
    const result = await analyzeEmotion(text);

    // If entryId provided, update the entry in DB
    if (entryId) {
      updateEntryAnalysis(entryId, result);
    }

    res.json(result);
  } catch (err) {
    console.error("LLM error:", err.message);
    if (err.status === 401) return res.status(401).json({ error: "Invalid API key." });
    if (err.status === 429) return res.status(429).json({ error: "LLM rate limit hit, retry later." });
    res.status(500).json({ error: "Emotion analysis failed.", details: err.message });
  }
});

// ─────────────────────────────────────────────
// GET /api/journal/insights/:userId
// Return aggregated insights for a user
// ─────────────────────────────────────────────
router.get("/insights/:userId", (req, res) => {
  const { userId } = req.params;

  try {
    const db = getDB();

    const totalEntries = db
      .prepare("SELECT COUNT(*) as count FROM journal_entries WHERE user_id = ?")
      .get(userId).count;

    if (totalEntries === 0) {
      return res.json({
        totalEntries: 0,
        topEmotion: null,
        mostUsedAmbience: null,
        recentKeywords: [],
        emotionBreakdown: {},
        ambienceBreakdown: {},
        entriesLast7Days: 0,
      });
    }

    // Top emotion
    const topEmotionRow = db
      .prepare(
        `SELECT emotion, COUNT(*) as count FROM journal_entries
         WHERE user_id = ? AND emotion IS NOT NULL
         GROUP BY emotion ORDER BY count DESC LIMIT 1`
      )
      .get(userId);

    // Most used ambience
    const topAmbienceRow = db
      .prepare(
        `SELECT ambience, COUNT(*) as count FROM journal_entries
         WHERE user_id = ?
         GROUP BY ambience ORDER BY count DESC LIMIT 1`
      )
      .get(userId);

    // All keywords from recent 20 analyzed entries
    const recentEntries = db
      .prepare(
        `SELECT keywords FROM journal_entries
         WHERE user_id = ? AND keywords IS NOT NULL
         ORDER BY created_at DESC LIMIT 20`
      )
      .all(userId);

    const keywordFreq = {};
    recentEntries.forEach((e) => {
      try {
        JSON.parse(e.keywords).forEach((kw) => {
          keywordFreq[kw] = (keywordFreq[kw] || 0) + 1;
        });
      } catch {}
    });
    const recentKeywords = Object.entries(keywordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([kw]) => kw);

    // Emotion breakdown
    const emotionRows = db
      .prepare(
        `SELECT emotion, COUNT(*) as count FROM journal_entries
         WHERE user_id = ? AND emotion IS NOT NULL GROUP BY emotion`
      )
      .all(userId);
    const emotionBreakdown = Object.fromEntries(emotionRows.map((r) => [r.emotion, r.count]));

    // Ambience breakdown
    const ambienceRows = db
      .prepare(
        `SELECT ambience, COUNT(*) as count FROM journal_entries WHERE user_id = ? GROUP BY ambience`
      )
      .all(userId);
    const ambienceBreakdown = Object.fromEntries(ambienceRows.map((r) => [r.ambience, r.count]));

    // Entries in last 7 days
    const entriesLast7Days = db
      .prepare(
        `SELECT COUNT(*) as count FROM journal_entries
         WHERE user_id = ? AND created_at >= datetime('now', '-7 days')`
      )
      .get(userId).count;

    res.json({
      totalEntries,
      topEmotion: topEmotionRow?.emotion || null,
      mostUsedAmbience: topAmbienceRow?.ambience || null,
      recentKeywords,
      emotionBreakdown,
      ambienceBreakdown,
      entriesLast7Days,
    });
  } catch (err) {
    console.error("Insights error:", err);
    res.status(500).json({ error: "Failed to compute insights." });
  }
});

// ─────────────────────────────────────────────
// Helper: update entry with analysis results
// ─────────────────────────────────────────────
function updateEntryAnalysis(entryId, result) {
  try {
    const db = getDB();
    db.prepare(
      `UPDATE journal_entries
       SET emotion = ?, keywords = ?, summary = ?, analyzed_at = datetime('now')
       WHERE id = ?`
    ).run(result.emotion, JSON.stringify(result.keywords), result.summary, entryId);
  } catch (err) {
    console.error("Failed to update entry analysis:", err.message);
  }
}

// ─────────────────────────────────────────────
// Helper: format entry for API response
// ─────────────────────────────────────────────
function formatEntry(entry) {
  return {
    id: entry.id,
    userId: entry.user_id,
    ambience: entry.ambience,
    text: entry.text,
    emotion: entry.emotion || null,
    keywords: entry.keywords ? JSON.parse(entry.keywords) : null,
    summary: entry.summary || null,
    analyzedAt: entry.analyzed_at || null,
    createdAt: entry.created_at,
  };
}

module.exports = router;
