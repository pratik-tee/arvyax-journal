const NodeCache = require("node-cache");
const crypto = require("crypto");

const analysisCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });

function getCacheKey(text) {
  return crypto.createHash("sha256").update(text.trim().toLowerCase()).digest("hex").slice(0, 16);
}

async function analyzeEmotion(text) {
  const cacheKey = getCacheKey(text);
  const cached = analysisCache.get(cacheKey);
  if (cached) {
    console.log("📦 Cache hit for analysis");
    return { ...cached, cached: true };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const prompt = `You are an empathetic mental wellness analyst. Analyze the following journal entry and respond ONLY with a valid JSON object — no markdown, no explanation, no extra text.

Journal entry: "${text}"

Respond with exactly this JSON structure:
{
  "emotion": "<single primary emotion: calm | happy | anxious | sad | energized | reflective | grateful | stressed | peaceful | excited>",
  "keywords": ["<keyword1>", "<keyword2>", "<keyword3>"],
  "summary": "<one sentence summarizing the user's mental state and experience>"
}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 300 },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || "Gemini API error");
  }

  const data = await response.json();
  const raw = data.candidates[0].content.parts[0].text.trim();
  const jsonStr = raw.replace(/^```json?\s*/i, "").replace(/\s*```$/, "").trim();
  const result = JSON.parse(jsonStr);

  if (!result.emotion || !Array.isArray(result.keywords) || !result.summary) {
    throw new Error("Invalid LLM response structure");
  }

  analysisCache.set(cacheKey, result);
  return { ...result, cached: false };
}

async function analyzeEmotionStream(text, onChunk) {
  const result = await analyzeEmotion(text);
  onChunk(JSON.stringify(result));
  return result;
}

module.exports = { analyzeEmotion, analyzeEmotionStream };
