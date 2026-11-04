// API protégée pour l'espace admin : nombre de consultations de chaque article du blog.
// Réservée aux comptes admin (session Supabase) : ces chiffres ne sont jamais visibles du public.
const { createClient } = require("@supabase/supabase-js");
const blogViews = require("../../lib/blogViews");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

module.exports = async (req, res) => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    res.status(500).json({ error: "Configuration serveur manquante." });
    return;
  }
  if (req.method !== "GET") {
    res.status(405).json({ error: "Méthode non autorisée." });
    return;
  }

  const user = await requireUser(req);
  if (!user) {
    res.status(401).json({ error: "Non authentifié." });
    return;
  }

  const result = await blogViews.readAll();
  res.setHeader("Cache-Control", "no-store");
  if (result.error) {
    res.status(500).json({ error: result.error });
    return;
  }
  res.status(200).json({ views: result.views, setupRequired: !!result.setupRequired });
};
