// API publique : compte un clic sur un bouton suivi d'une page (ex. page « Noël au Bistro »).
// Les chiffres vont dans la table `page_events` (scripts/demandes.sql), fermée au public, et ne
// s'affichent que dans l'espace admin. Ne renvoie jamais d'erreur visible : le suivi ne doit
// jamais gêner le visiteur. Les robots et les clics répétés (même bouton, même IP, < 10 s) sont ignorés.
const { createClient } = require("@supabase/supabase-js");

const PAGES = { noel: true };
const BOT_RE = /bot|crawl|spider|slurp|facebookexternalhit|preview|headless|lighthouse|pagespeed|curl|wget|python|axios|node-fetch|go-http|java\//i;
const DEDUPE_MS = 10 * 1000;
const seen = new Map();
let client = null;

function db() {
  if (client) return client;
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  return client;
}

module.exports = async (req, res) => {
  res.status(204);
  if (req.method !== "POST") { res.end(); return; }
  try {
    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
    body = body || {};
    const page = String(body.page || "");
    const event = String(body.event || "");
    const ua = String(req.headers["user-agent"] || "");
    if (!PAGES[page] || !/^[a-z0-9-]{1,40}$/.test(event) || !ua || BOT_RE.test(ua)) { res.end(); return; }
    const now = Date.now();
    const key = (req.ip || "") + "|" + page + "|" + event;
    const last = seen.get(key);
    if (last && now - last < DEDUPE_MS) { res.end(); return; }
    seen.set(key, now);
    if (seen.size > 5000) seen.clear();
    const supabase = db();
    if (supabase) {
      Promise.resolve(supabase.rpc("increment_page_event", { p_page: page, p_event: event })).catch(() => {});
    }
  } catch {}
  res.end();
};
