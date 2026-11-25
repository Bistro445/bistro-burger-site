// API protégée (comptes admin) : envoie à un administrateur un lien pour choisir son mot de passe,
// dans un e-mail en français aux couleurs du restaurant (Resend), au lieu de l'e-mail anglais de Supabase.
// Le lien est généré par Supabase (type « recovery », valable 1 h, à usage unique) et mène à /admin/,
// où l'écran « Choisissez votre mot de passe » s'affiche obligatoirement.
// POST { email, note?, preview? } — preview: true renvoie l'e-mail sans rien générer ni envoyer.
// Avantage : pas de limite Supabase de 2 e-mails par heure. Si Resend n'est pas configuré,
// on se rabat sur l'envoi Supabase classique.
const { createClient } = require("@supabase/supabase-js");
const { sendEmail, isConfigured } = require("../_lib/mailer");
const { adminPasswordLink } = require("../_lib/emailTemplates");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE_URL = (process.env.SITE_URL || "https://bistroburgergardanne.com").replace(/\/+$/, "");

module.exports = async (req, res) => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) { res.status(500).json({ error: "Configuration serveur manquante." }); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Méthode non autorisée." }); return; }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) { res.status(401).json({ error: "Non authentifié." }); return; }
  const { data: who, error: authError } = await supabase.auth.getUser(token);
  if (authError || !who || !who.user) { res.status(401).json({ error: "Non authentifié." }); return; }

  const body = req.body || {};
  const email = String(body.email || "").trim().toLowerCase();
  const note = String(body.note || "").trim().slice(0, 600);
  if (!email) { res.status(400).json({ error: "Adresse manquante." }); return; }

  // Uniquement pour un compte admin existant.
  const list = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (list.error) { res.status(500).json({ error: list.error.message }); return; }
  if (!(list.data.users || []).some((u) => String(u.email || "").toLowerCase() === email)) {
    res.status(404).json({ error: "Aucun compte admin avec cette adresse." });
    return;
  }

  if (body.preview === true) {
    const m = adminPasswordLink(email, SITE_URL + "/admin/", note);
    res.status(200).json({ ok: true, preview: true, subject: m.subject, html: m.html, text: m.text });
    return;
  }

  if (!isConfigured()) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: SITE_URL + "/admin/" });
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.status(200).json({ ok: true, via: "supabase" });
    return;
  }

  const gen = await supabase.auth.admin.generateLink({ type: "recovery", email, options: { redirectTo: SITE_URL + "/admin/" } });
  const link = gen && gen.data && gen.data.properties && gen.data.properties.action_link;
  if (gen.error || !link) { res.status(500).json({ error: (gen.error && gen.error.message) || "Lien non généré." }); return; }

  const m = adminPasswordLink(email, link, note);
  const r = await sendEmail({ to: email, subject: m.subject, html: m.html, text: m.text });
  if (r.status !== "envoye") { res.status(502).json({ error: "L'e-mail n'a pas pu partir" + (r.detail ? " : " + r.detail : ".") }); return; }
  res.status(200).json({ ok: true, via: "resend" });
};
