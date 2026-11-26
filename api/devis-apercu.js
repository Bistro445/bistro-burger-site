// Ouvre l'aperçu privé de la page « Devis traiteur » dans ce navigateur (voir api/_lib/devisAccess.js).
// POST avec la session admin (en-tête Authorization: Bearer <jeton Supabase>) → cookie d'aperçu de 30 jours.
// Appelé par la petite page /devis-traiteur/apercu (server.js).
const { createClient } = require("@supabase/supabase-js");
const { setPreviewCookie, previewToken } = require("./_lib/devisAccess");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.status(405).json({ error: "Méthode non autorisée." }); return; }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !previewToken()) { res.status(500).json({ error: "Configuration serveur manquante." }); return; }
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) { res.status(401).json({ error: "Connectez-vous d'abord à l'espace admin." }); return; }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data || !data.user) { res.status(401).json({ error: "Session admin expirée : ouvrez l'espace admin, puis revenez sur ce lien." }); return; }
  setPreviewCookie(req, res);
  res.status(200).json({ ok: true });
};
