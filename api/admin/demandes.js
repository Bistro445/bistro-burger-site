// API protégée pour l'espace admin : demandes reçues par les formulaires (page Noël, puis devis)
// et compteur de clics des pages suivies. Réservée aux comptes admin (session Supabase).
// GET : { items, stats, daily, setupRequired }
// PATCH { id, statut } : « nouveau » ou « traite » — PATCH { id, notes } : notes internes.
// Chaque changement est ajouté à l'historique de la demande (qui, quoi, quand).
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
  const userEmail = who.user.email || "un administrateur";
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "PATCH") {
    const body = req.body || {};
    const cur = await supabase.from("demandes").select("historique, notes").eq("id", body.id).single();
    if (cur.error) { res.status(500).json({ error: cur.error.message }); return; }
    const historique = Array.isArray(cur.data.historique) ? cur.data.historique.slice() : [];
    const now = new Date().toISOString();
    const patch = {};
    if (typeof body.notes === "string") {
      patch.notes = body.notes.trim().slice(0, 4000) || null;
      historique.push({ at: now, quoi: patch.notes ? "Note interne modifiée" : "Note interne effacée", par: userEmail });
    } else {
      const statut = body.statut === "traite" ? "traite" : "nouveau";
      patch.statut = statut;
      patch.traite_par = statut === "traite" ? userEmail : null;
      patch.traite_le = statut === "traite" ? now : null;
      historique.push({ at: now, quoi: statut === "traite" ? "Marquée comme traitée" : "Remise en « nouvelle »", par: userEmail });
    }
    patch.historique = historique;
    const { error } = await supabase.from("demandes").update(patch).eq("id", body.id);
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.status(200).json({ ok: true, historique, notes: patch.notes, traite_par: patch.traite_par, traite_le: patch.traite_le });
    return;
  }
  if (req.method !== "GET") { res.status(405).json({ error: "Méthode non autorisée." }); return; }

  const list = await supabase.from("demandes").select("*").order("created_at", { ascending: false }).limit(300);
  if (list.error) {
    if (isSetupError(list.error)) { res.status(200).json({ items: [], stats: {}, daily: [], setupRequired: true }); return; }
    res.status(500).json({ error: list.error.message });
    return;
  }
  const ev = await supabase.from("page_events").select("page, event, day, count").order("day", { ascending: false }).limit(2000);
  const stats = {}, perDay = {};
  for (const row of (ev.data || [])) {
    const n = Number(row.count) || 0;
    stats[row.page] = stats[row.page] || {};
    stats[row.page][row.event] = (stats[row.page][row.event] || 0) + n;
    if (row.page === "noel") {
      perDay[row.day] = perDay[row.day] || { day: row.day, visites: 0, clics: 0, demandes: 0 };
      if (row.event === "page-vue") perDay[row.day].visites += n;
      else if (row.event === "form-envoye") perDay[row.day].demandes += n;
      else perDay[row.day].clics += n;
    }
  }
  const daily = Object.values(perDay).sort((a, b) => (a.day < b.day ? 1 : -1)).slice(0, 31);
  res.status(200).json({ items: list.data || [], stats, daily, setupRequired: false });
};
