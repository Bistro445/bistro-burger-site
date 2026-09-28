// API protégée : invite une nouvelle personne à administrer le site.
// Réservée aux utilisateurs déjà connectés à l'espace admin.
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE_URL = process.env.SITE_URL || "https://bistroburgergardanne.com";

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

  if (req.method !== "POST") {
    res.status(405).json({ error: "Méthode non autorisée." });
    return;
  }

  const user = await requireUser(req);
  if (!user) {
    res.status(401).json({ error: "Non authentifié." });
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
  const email = (body && body.email || "").trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "Adresse e-mail invalide." });
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { error } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: SITE_URL + "/admin/",
  });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({ ok: true });
};
