"use strict";
// Compteur de consultations des articles du blog.
// Les chiffres sont stockés dans la table Supabase `blog_views` (voir scripts/blog-views.sql), fermée
// au public : seul le serveur (clé de service) la lit, et seuls les comptes admin les voient
// (api/admin/blog-views.js). Ne jamais mettre ces chiffres dans `site_content` : cette table est
// recopiée dans le fichier public data.generated.js.
const { createClient } = require("@supabase/supabase-js");

const DEDUPE_MS = 30 * 60 * 1000; // une même personne n'est comptée qu'une fois par article et par demi-heure
const BOT_RE = /bot|crawl|spider|slurp|facebookexternalhit|preview|headless|lighthouse|pagespeed|gtmetrix|curl|wget|python|axios|node-fetch|go-http|java\/|uptime|monitor|pingdom/i;

const seen = new Map(); // "ip|slug" -> horodatage de la dernière consultation comptée
let client = null;
let warned = false;

function db() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

function warnOnce(message) {
  if (warned) return;
  warned = true;
  console.warn("[blogViews] " + message);
}

// La table (ou la fonction) n'existe pas encore : le script SQL n'a pas été exécuté.
function isSetupError(error) {
  const text = String((error && (error.code || "")) + " " + (error && error.message ? error.message : ""));
  return /42P01|42883|PGRST20[25]|does not exist|schema cache|Could not find/i.test(text);
}

// Enregistre une consultation (sans attendre : la page ne doit jamais être ralentie ni cassée par le compteur).
function track(req, slug) {
  try {
    if (!slug || req.method !== "GET") return;
    const ua = String(req.headers["user-agent"] || "");
    if (!ua || BOT_RE.test(ua)) return; // robots (Google, Bing, aperçus de liens, outils de test) : non comptés
    const purpose = String(req.headers["purpose"] || req.headers["sec-purpose"] || "");
    if (/prefetch|prerender/i.test(purpose)) return; // pré-chargement du navigateur : pas une vraie visite
    const now = Date.now();
    const key = (req.ip || "") + "|" + slug;
    const last = seen.get(key);
    if (last && now - last < DEDUPE_MS) return;
    seen.set(key, now);
    if (seen.size > 5000) {
      for (const [k, t] of seen) if (now - t > DEDUPE_MS) seen.delete(k);
      if (seen.size > 5000) seen.clear();
    }
    const supabase = db();
    if (!supabase) return;
    Promise.resolve(supabase.rpc("increment_blog_view", { p_slug: String(slug).slice(0, 200) }))
      .then((res) => {
        if (res && res.error) warnOnce(isSetupError(res.error) ? "compteur non activé (exécuter scripts/blog-views.sql dans Supabase)" : "échec : " + res.error.message);
      })
      .catch(() => {});
  } catch (err) {
    // Le compteur ne doit jamais empêcher l'affichage d'un article.
  }
}

// Lecture pour l'admin : { views: { slug: nombre }, setupRequired: bool }.
async function readAll() {
  const supabase = db();
  if (!supabase) return { views: {}, setupRequired: false, error: "Configuration serveur manquante." };
  const { data, error } = await supabase.from("blog_views").select("slug, views");
  if (error) {
    if (isSetupError(error)) return { views: {}, setupRequired: true };
    return { views: {}, setupRequired: false, error: error.message };
  }
  const views = {};
  for (const row of data || []) views[row.slug] = Number(row.views) || 0;
  return { views, setupRequired: false };
}

module.exports = { track, readAll, isSetupError };
