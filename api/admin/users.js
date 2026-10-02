// API protégée : liste des comptes administrateurs (e-mail, dates, statut).
// Ne renvoie jamais de mot de passe : Supabase ne conserve que des empreintes chiffrées.
const { createClient } = require("@supabase/supabase-js");

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

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const users = (data.users || [])
    .map((u) => ({
      id: u.id,
      email: u.email || "",
      created_at: u.created_at || null,
      last_sign_in_at: u.last_sign_in_at || null,
      invited_at: u.invited_at || null,
      confirmed: !!(u.email_confirmed_at || u.confirmed_at),
      avatar_url: (u.user_metadata && u.user_metadata.avatar_url) || null,
    }))
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));

  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ users });
};
