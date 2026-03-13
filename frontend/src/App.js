import React, { useState, useEffect, useCallback } from "react";
import { api } from "./api/journal";
import "./App.css";

const AMBIENCES = ["forest", "ocean", "mountain", "desert", "rain", "city"];
const AMBIENCE_ICONS = {
  forest: "🌲",
  ocean: "🌊",
  mountain: "⛰️",
  desert: "🏜️",
  rain: "🌧️",
  city: "🏙️",
};
const EMOTION_COLORS = {
  calm: "#4ade80",
  happy: "#facc15",
  anxious: "#f87171",
  sad: "#60a5fa",
  energized: "#fb923c",
  reflective: "#a78bfa",
  grateful: "#34d399",
  stressed: "#f43f5e",
  peaceful: "#67e8f9",
  excited: "#fbbf24",
};

const DEFAULT_USER = "user_001";

export default function App() {
  const [userId] = useState(DEFAULT_USER);
  const [activeTab, setActiveTab] = useState("write");
  const [entries, setEntries] = useState([]);
  const [insights, setInsights] = useState(null);
  const [form, setForm] = useState({ ambience: "forest", text: "" });
  const [loading, setLoading] = useState({ submit: false, analyze: false, insights: false });
  const [analysisResult, setAnalysisResult] = useState(null);
  const [notification, setNotification] = useState(null);
  const [analyzingEntryId, setAnalyzingEntryId] = useState(null);

  const showNotif = (msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const fetchEntries = useCallback(async () => {
    try {
      const data = await api.getEntries(userId);
      setEntries(data.entries);
    } catch (err) {
      console.error(err);
    }
  }, [userId]);

  const fetchInsights = useCallback(async () => {
    setLoading((l) => ({ ...l, insights: true }));
    try {
      const data = await api.getInsights(userId);
      setInsights(data);
    } catch (err) {
      showNotif("Failed to load insights", "error");
    } finally {
      setLoading((l) => ({ ...l, insights: false }));
    }
  }, [userId]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  useEffect(() => {
    if (activeTab === "insights") fetchInsights();
  }, [activeTab, fetchInsights]);

  const handleSubmit = async () => {
    if (!form.text.trim()) return showNotif("Please write something first", "error");
    setLoading((l) => ({ ...l, submit: true }));
    try {
      await api.createEntry(userId, form.ambience, form.text);
      showNotif("Entry saved! ✨");
      setForm({ ambience: "forest", text: "" });
      fetchEntries();
    } catch (err) {
      showNotif(err.message, "error");
    } finally {
      setLoading((l) => ({ ...l, submit: false }));
    }
  };

  const handleAnalyze = async (text, entryId) => {
    setLoading((l) => ({ ...l, analyze: true }));
    setAnalysisResult(null);
    setAnalyzingEntryId(entryId || null);
    try {
      const result = await api.analyzeText(text, entryId);
      setAnalysisResult(result);
      if (entryId) fetchEntries(); // refresh to show updated emotion
    } catch (err) {
      showNotif(err.message, "error");
    } finally {
      setLoading((l) => ({ ...l, analyze: false }));
      setAnalyzingEntryId(null);
    }
  };

  return (
    <div className="app">
      {/* Notification */}
      {notification && (
        <div className={`notif notif--${notification.type}`}>{notification.msg}</div>
      )}

      {/* Header */}
      <header className="header">
        <div className="header__logo">
          <span className="header__leaf">🌿</span>
          <span>ArvyaX Journal</span>
        </div>
        <div className="header__user">👤 {userId}</div>
      </header>

      {/* Tabs */}
      <nav className="tabs">
        {["write", "entries", "insights"].map((tab) => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? "tab--active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "write" && "✏️ Write"}
            {tab === "entries" && `📖 Entries (${entries.length})`}
            {tab === "insights" && "📊 Insights"}
          </button>
        ))}
      </nav>

      <main className="main">
        {/* ── WRITE TAB ── */}
        {activeTab === "write" && (
          <div className="panel">
            <h2 className="panel__title">New Journal Entry</h2>

            {/* Ambience selector */}
            <div className="field">
              <label className="label">Nature Ambience</label>
              <div className="ambience-grid">
                {AMBIENCES.map((a) => (
                  <button
                    key={a}
                    className={`ambience-btn ${form.ambience === a ? "ambience-btn--active" : ""}`}
                    onClick={() => setForm((f) => ({ ...f, ambience: a }))}
                  >
                    {AMBIENCE_ICONS[a]} {a}
                  </button>
                ))}
              </div>
            </div>

            {/* Text area */}
            <div className="field">
              <label className="label">How are you feeling?</label>
              <textarea
                className="textarea"
                rows={6}
                placeholder="Write about your experience during this session…"
                value={form.text}
                onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
              />
              <div className="char-count">{form.text.length} characters</div>
            </div>

            <div className="btn-row">
              <button className="btn btn--primary" onClick={handleSubmit} disabled={loading.submit}>
                {loading.submit ? "Saving…" : "💾 Save Entry"}
              </button>
              <button
                className="btn btn--secondary"
                onClick={() => handleAnalyze(form.text, null)}
                disabled={loading.analyze || !form.text.trim()}
              >
                {loading.analyze ? "Analyzing…" : "🔍 Analyze Emotions"}
              </button>
            </div>

            {/* Analysis result for current text */}
            {analysisResult && !analyzingEntryId && (
              <AnalysisCard result={analysisResult} />
            )}
          </div>
        )}

        {/* ── ENTRIES TAB ── */}
        {activeTab === "entries" && (
          <div className="panel">
            <h2 className="panel__title">My Journal Entries</h2>
            {entries.length === 0 ? (
              <div className="empty">No entries yet. Start writing! ✨</div>
            ) : (
              <div className="entries-list">
                {entries.map((entry) => (
                  <EntryCard
                    key={entry.id}
                    entry={entry}
                    onAnalyze={handleAnalyze}
                    isAnalyzing={analyzingEntryId === entry.id && loading.analyze}
                    analysisResult={analyzingEntryId === entry.id ? analysisResult : null}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── INSIGHTS TAB ── */}
        {activeTab === "insights" && (
          <div className="panel">
            <h2 className="panel__title">Your Mental Wellness Insights</h2>
            {loading.insights ? (
              <div className="loading">Loading insights…</div>
            ) : insights ? (
              <InsightsView insights={insights} />
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}

// ── Entry Card ──────────────────────────────
function EntryCard({ entry, onAnalyze, isAnalyzing, analysisResult }) {
  const [expanded, setExpanded] = useState(false);
  const emotionColor = EMOTION_COLORS[entry.emotion] || "#94a3b8";

  return (
    <div className="entry-card">
      <div className="entry-card__header" onClick={() => setExpanded(!expanded)}>
        <div className="entry-card__left">
          <span className="entry-ambience">{AMBIENCE_ICONS[entry.ambience]} {entry.ambience}</span>
          <span className="entry-date">{new Date(entry.createdAt).toLocaleDateString()}</span>
        </div>
        <div className="entry-card__right">
          {entry.emotion && (
            <span className="emotion-badge" style={{ backgroundColor: emotionColor + "33", color: emotionColor }}>
              {entry.emotion}
            </span>
          )}
          <span className="expand-icon">{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {expanded && (
        <div className="entry-card__body">
          <p className="entry-text">{entry.text}</p>

          {entry.summary && (
            <div className="entry-summary">
              <strong>Summary:</strong> {entry.summary}
            </div>
          )}

          {entry.keywords && (
            <div className="keywords">
              {entry.keywords.map((kw) => (
                <span key={kw} className="keyword">{kw}</span>
              ))}
            </div>
          )}

          <button
            className="btn btn--sm"
            onClick={() => onAnalyze(entry.text, entry.id)}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? "Analyzing…" : "🔍 Re-analyze"}
          </button>

          {analysisResult && <AnalysisCard result={analysisResult} compact />}
        </div>
      )}
    </div>
  );
}

// ── Analysis Result Card ─────────────────────
function AnalysisCard({ result, compact }) {
  const color = EMOTION_COLORS[result.emotion] || "#94a3b8";
  return (
    <div className={`analysis-card ${compact ? "analysis-card--compact" : ""}`} style={{ borderColor: color }}>
      <div className="analysis-emotion" style={{ color }}>
        Emotion: <strong>{result.emotion}</strong>
        {result.cached && <span className="cached-badge">cached</span>}
      </div>
      <p className="analysis-summary">{result.summary}</p>
      <div className="keywords">
        {result.keywords?.map((kw) => (
          <span key={kw} className="keyword">{kw}</span>
        ))}
      </div>
    </div>
  );
}

// ── Insights View ────────────────────────────
function InsightsView({ insights }) {
  const topEmotionColor = EMOTION_COLORS[insights.topEmotion] || "#94a3b8";

  return (
    <div className="insights">
      <div className="stats-grid">
        <StatCard label="Total Entries" value={insights.totalEntries} icon="📝" />
        <StatCard label="Entries (7 days)" value={insights.entriesLast7Days} icon="📅" />
        <StatCard
          label="Top Emotion"
          value={insights.topEmotion || "—"}
          icon="💭"
          color={topEmotionColor}
        />
        <StatCard label="Fav Ambience" value={insights.mostUsedAmbience ? `${AMBIENCE_ICONS[insights.mostUsedAmbience]} ${insights.mostUsedAmbience}` : "—"} icon="🌿" />
      </div>

      {insights.recentKeywords.length > 0 && (
        <div className="insight-section">
          <h3>Recent Keywords</h3>
          <div className="keywords">
            {insights.recentKeywords.map((kw) => (
              <span key={kw} className="keyword keyword--lg">{kw}</span>
            ))}
          </div>
        </div>
      )}

      {Object.keys(insights.emotionBreakdown).length > 0 && (
        <div className="insight-section">
          <h3>Emotion Breakdown</h3>
          <div className="breakdown">
            {Object.entries(insights.emotionBreakdown)
              .sort((a, b) => b[1] - a[1])
              .map(([emotion, count]) => {
                const total = Object.values(insights.emotionBreakdown).reduce((a, b) => a + b, 0);
                const pct = Math.round((count / total) * 100);
                const color = EMOTION_COLORS[emotion] || "#94a3b8";
                return (
                  <div key={emotion} className="breakdown-row">
                    <span className="breakdown-label" style={{ color }}>{emotion}</span>
                    <div className="breakdown-bar-wrap">
                      <div className="breakdown-bar" style={{ width: `${pct}%`, backgroundColor: color }} />
                    </div>
                    <span className="breakdown-count">{count}</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {Object.keys(insights.ambienceBreakdown).length > 0 && (
        <div className="insight-section">
          <h3>Ambience Usage</h3>
          <div className="ambience-stats">
            {Object.entries(insights.ambienceBreakdown)
              .sort((a, b) => b[1] - a[1])
              .map(([ambience, count]) => (
                <div key={ambience} className="ambience-stat">
                  <span>{AMBIENCE_ICONS[ambience]}</span>
                  <span>{ambience}</span>
                  <span className="ambience-count">{count}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color }) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div className="stat-value" style={color ? { color } : {}}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
