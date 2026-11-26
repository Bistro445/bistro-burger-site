// API protégée pour l'espace admin : devis traiteur (table `devis`, scripts/devis.sql).
// Réservée aux comptes admin (session Supabase).
// GET : { items, setupRequired } — les devis non acceptés dont la validité est passée sont signalés « expire ».
// PATCH { id, statut } : change le statut — PATCH { id, notes } : notes internes —
// PATCH { id, action: "renvoyer" } : renvoie le devis par e-mail au client.
// Chaque changement est ajouté à l'historique du devis (qui, quoi, quand).
const { createClient } = require("@supabase/supabase-js");
const { sendEmail } = require("../_lib/mailer");
const { clientDevis } = require("../_lib/emailTemplates");
const { devisAttachment } = require("../../lib/pdfDevis");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ALERT_EMAIL = process.env.ALERT_EMAIL || "brasserie.zone.avon@gmail.com";
const SITE_URL = (process.env.SITE_URL || "https://bistroburgergardanne.com").replace(/\/+$/, "");

const STATUTS = {
  nouveau: "Nouveau", envoye: "Envoyé", accepte: "Le client souhaite valider", refuse: "Refusé",
  expire: "Expiré", realise: "Réalisé", facture: "Facturé",
};

function isSetupError(error) {
  const text = String((error && (error.code || "")) + " " + (error && error.message ? error.message : ""));
  return /42P01|42883|PGRST20[25]|does not exist|schema cache|Could not find/i.test(text);
}
function parisToday() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date()); }

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
    const cur = await supabase.from("devis").select("*").eq("id", body.id).single();
    if (cur.error) { res.status(500).json({ error: cur.error.message }); return; }
    const d = cur.data;
    const historique = Array.isArray(d.historique) ? d.historique.slice() : [];
    const now = new Date().toISOString();
    const patch = { maj_le: now };
    let emailClient;

    if (typeof body.notes === "string") {
      patch.notes = body.notes.trim().slice(0, 4000) || null;
      historique.push({ at: now, quoi: patch.notes ? "Note interne modifiée" : "Note interne effacée", par: userEmail });
    } else if (body.action === "renvoyer") {
      const url = SITE_URL + "/devis-traiteur/d/" + d.token;
      const m = clientDevis(d, url);
      const pdf = devisAttachment(d);
      const r = await sendEmail({ to: d.email, subject: m.subject, html: m.html, text: m.text, replyTo: ALERT_EMAIL, attachments: pdf ? [pdf] : undefined });
      emailClient = r.status;
      patch.email_client = r.status;
      if (r.status === "envoye" && d.statut === "nouveau") patch.statut = "envoye";
      historique.push({ at: now, quoi: r.status === "envoye" ? "Devis renvoyé au client (" + d.email + ")" : "Renvoi au client NON effectué : " + (r.detail || r.status), par: userEmail });
    } else {
      if (!STATUTS[body.statut]) { res.status(400).json({ error: "Statut inconnu." }); return; }
      patch.statut = body.statut;
      patch.traite_par = userEmail;
      historique.push({ at: now, quoi: "Statut : " + STATUTS[body.statut], par: userEmail });
    }
    patch.historique = historique;
    const { error } = await supabase.from("devis").update(patch).eq("id", d.id);
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.status(200).json({ ok: true, historique, notes: patch.notes, statut: patch.statut || d.statut, email_client: emailClient });
    return;
  }
  if (req.method !== "GET") { res.status(405).json({ error: "Méthode non autorisée." }); return; }

  const list = await supabase.from("devis").select("*").order("created_at", { ascending: false }).limit(500);
  if (list.error) {
    if (isSetupError(list.error)) { res.status(200).json({ items: [], setupRequired: true }); return; }
    res.status(500).json({ error: list.error.message });
    return;
  }
  const today = parisToday();
  const items = (list.data || []).map((d) => {
    const expire = d.valide_jusqu && d.valide_jusqu < today && (d.statut === "nouveau" || d.statut === "envoye");
    return Object.assign({}, d, { statut_affiche: expire ? "expire" : d.statut, url: "/devis-traiteur/d/" + d.token });
  });
  res.status(200).json({ items, setupRequired: false });
};
