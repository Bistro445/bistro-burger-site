// API protégée pour l'espace admin : demandes reçues par les formulaires (page Noël, puis devis)
// et compteur de clics des pages suivies. Réservée aux comptes admin (session Supabase).
// GET : { items, stats, setupRequired } — PATCH { id, statut } : « nouveau » ou « traite ».
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function isSetupError(error) {
  const text = String((error && (error.code || "")) + " " + (error && error.message ? error.message : ""));
  return /42P01|42883|PGRST20[25]|does not exist|schema cache|Could not find/i.test(text);
}

module.exports = async (req, res) => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) { res.status(500).json({ error: "Configuration serveur manquante." }); return; }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) { res.status(401).json({ error: "Non authentifié." }); return; }
  const { data: who, error: authError } = await supabase.auth.getUser(token);
  if (authError || !who || !who.user) { res.status(401).json({ error: "Non authentifié." }); return; }
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "PATCH") {
    const body = req.body || {};
    const statut = body.statut === "traite" ? "traite" : "nouveau";
    const { error } = await supabase.from("demandes").update({ statut }).eq("id", body.id);
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.status(200).json({ ok: true });
    return;
  }
  if (req.method !== "GET") { res.status(405).json({ error: "Méthode non autorisée." }); return; }

  const list = await supabase.from("demandes").select("*").order("created_at", { ascending: false }).limit(300);
  if (list.error) {
    if (isSetupError(list.error)) { res.status(200).json({ items: [], stats: {}, setupRequired: true }); return; }
    res.status(500).json({ error: list.error.message });
    return;
  }
  const ev = await supabase.from("page_events").select("page, event, count");
  const stats = {};
  for (const row of (ev.data || [])) {
    stats[row.page] = stats[row.page] || {};
    stats[row.page][row.event] = (stats[row.page][row.event] || 0) + (Number(row.count) || 0);
  }
  res.status(200).json({ items: list.data || [], stats, setupRequired: false });
};
