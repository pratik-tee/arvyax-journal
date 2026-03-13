require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const journalRoutes = require("./routes/journal");
const { initDB } = require("./db/database");

const app = express();
const PORT = process.env.PORT || 5000;

// CORS — allow localhost dev + any Vercel deployment URL
const allowedOrigins = [
  "http://localhost:3000",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, Postman) or matching origins
      if (!origin || allowedOrigins.some((o) => origin.startsWith(o)) || origin.endsWith(".vercel.app")) {
        callback(null, true);
      } else {
        callback(new Error("CORS not allowed: " + origin));
      }
    },
    credentials: true,
  })
);

app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests, please try again later." },
});
app.use("/api/", limiter);

const llmLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "LLM rate limit exceeded. Please wait a minute." },
});
app.use("/api/journal/analyze", llmLimiter);

app.use("/api/journal", journalRoutes);

app.get("/health", (req, res) =>
  res.json({ status: "ok", timestamp: new Date().toISOString() })
);

app.use((req, res) => res.status(404).json({ error: "Route not found" }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error", message: err.message });
});

initDB();
app.listen(PORT, () => console.log(`🌿 ArvyaX Journal API running on port ${PORT}`));
