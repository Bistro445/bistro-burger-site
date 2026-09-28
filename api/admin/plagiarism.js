// API protégée pour l'espace admin : vérifie si des passages d'un article
// se retrouvent mot pour mot ailleurs sur le web, via l'API Google Custom
// Search (recherche par phrase exacte). Limité à quelques phrases par
// vérification pour rester dans le palier gratuit de l'API Google.
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_CSE_API_KEY = process.env.GOOGLE_CSE_API_KEY;
const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID;
const SITE_HOST = new URL(process.env.SITE_URL || "https://bistroburgergardanne.com").host;

const MAX_SENTENCES = 6;
const MIN_WORDS = 9;
const TIMEOUT_MS = 8000;

async function requireUser(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

function splitSentences(text) {
  return String(text || "")
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function pickCandidates(sentences) {
  return sentences
    .filter((s) => s.split(/\s+/).length >= MIN_WORDS)
    .sort((a, b) => b.length - a.length)
    .slice(0, MAX_SENTENCES);
}

async function searchSentence(sentence) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const url =
      "https://www.googleapis.com/customsearch/v1?key=" + encodeURIComponent(GOOGLE_CSE_API_KEY) +
      "&cx=" + encodeURIComponent(GOOGLE_CSE_ID) +
      "&q=" + encodeURIComponent('"' + sentence + '"');
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      const reason = errJson.error && errJson.error.errors && errJson.error.errors[0] && errJson.error.errors[0].reason;
      return { sentence, error: reason === "dailyLimitExceeded" || reason === "rateLimitExceeded" ? "quota" : "error" };
    }
    const json = await res.json();
    const items = Array.isArray(json.items) ? json.items : [];
    const matches = items
      .filter((it) => {
        try { return new URL(it.link).host !== SITE_HOST; } catch { return false; }
      })
      .slice(0, 3)
      .map((it) => ({ title: it.title || it.link, link: it.link, snippet: it.snippet || "" }));
    return { sentence, matches };
  } catch (err) {
    clearTimeout(timeout);
    return { sentence, error: err.name === "AbortError" ? "timeout" : "error" };
  }
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Méthode non autorisée." });
    return;
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    res.status(500).json({ error: "Configuration serveur manquante." });
    return;
  }
  const user = await requireUser(req);
  if (!user) {
    res.status(401).json({ error: "Non authentifié." });
    return;
  }
  if (!GOOGLE_CSE_API_KEY || !GOOGLE_CSE_ID) {
    res.status(503).json({ error: "La vérification de plagiat n'est pas encore activée. Contactez la personne qui gère le site." });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      res.status(400).json({ error: "Corps de requête invalide." });
      return;
    }
  }
  const text = String((body || {}).text || "").slice(0, 20000);
  const candidates = pickCandidates(splitSentences(text));

  if (!candidates.length) {
    res.status(200).json({ checked: 0, total: 0, flagged: [] });
    return;
  }

  const results = await Promise.all(candidates.map(searchSentence));
  const quotaHit = results.some((r) => r.error === "quota");
  if (quotaHit && results.every((r) => r.error)) {
    res.status(429).json({ error: "Quota quotidien de recherches atteint. Réessayez demain." });
    return;
  }

  const flagged = results.filter((r) => r.matches && r.matches.length);
  res.status(200).json({
    checked: results.filter((r) => !r.error).length,
    total: candidates.length,
    flagged: flagged.map((r) => ({ sentence: r.sentence, matches: r.matches })),
    quotaHit,
  });
};
