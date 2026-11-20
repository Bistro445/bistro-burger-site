// API publique : demande envoyée depuis un formulaire du site (page « Noël au Bistro », puis devis traiteur).
// 1. contrôle les champs et filtre les robots (champ piège, délai minimum, limite par adresse IP) ;
// 2. enregistre la demande dans la table `demandes` si elle existe (scripts/demandes.sql) ;
// 3. prévient le restaurant par e-mail (comptes admin, ou ALERT_EMAIL) et sur l'application mobile ;
// 4. envoie un accusé de réception au client (si l'envoi d'e-mails Resend est configuré).
// Avec { dryRun: true }, tout est contrôlé mais rien n'est envoyé ni enregistré (tests).
const { createClient } = require("@supabase/supabase-js");
const { notifyAdmins } = require("./_lib/notify");
const { notifyPush } = require("./_lib/push");
const { sendEmail, isConfigured } = require("./_lib/mailer");
const { adminNewDemande, clientDemandeAck } = require("./_lib/emailTemplates");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ALERT_EMAIL = process.env.ALERT_EMAIL || "brasserie.zone.avon@gmail.com";

const SOURCES = { noel: true, devis: true };
const PRESTATIONS = [
  "Menu de fêtes · 16 et 17 décembre",
  "Repas de groupe",
  "Privatisation · arbre de Noël",
  "Traiteur en entreprise",
  "Noël à emporter ou livré",
  "Buffet du lendemain",
  "Devis traiteur",
];
const TYPES = { particulier: true, entreprise: true, association: true };

// Limite : 5 demandes par adresse IP et par heure.
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= MAX_PER_WINDOW) { hits.set(ip, list); return true; }
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 2000) hits.clear();
  return false;
}

function str(v, max) { return String(v == null ? "" : v).trim().slice(0, max || 200); }
function isValidPhone(raw) {
  const c = String(raw || "").replace(/[\s.\-()]/g, "");
  return /^0[1-9]\d{8}$/.test(c) || /^\+\d{8,15}$/.test(c) || /^00\d{8,15}$/.test(c);
}
function isValidEmail(raw) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(raw || "")); }
function isSetupError(error) {
  const text = String((error && (error.code || "")) + " " + (error && error.message ? error.message : ""));
  return /42P01|42883|PGRST20[25]|does not exist|schema cache|Could not find/i.test(text);
}

// Tests depuis la maquette locale (http://localhost:xxxx) : seule origine extérieure autorisée.
function cors(req, res) {
  const origin = String(req.headers.origin || "");
  if (/^http:\/\/localhost:\d{2,5}$/.test(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
}

module.exports = async (req, res) => {
  cors(req, res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Méthode non autorisée." }); return; }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { res.status(400).json({ error: "Corps de requête invalide." }); return; }
  }
  body = body || {};
  const dryRun = body.dryRun === true;

  // Robots : champ piège rempli, ou formulaire envoyé moins de 3 secondes après l'ouverture de la page.
  // On répond « ok » sans rien faire, pour ne pas les aider.
  if (str(body.website) || (Number(body.elapsed) > 0 && Number(body.elapsed) < 3000)) {
    res.status(200).json({ ok: true });
    return;
  }

  const d = {
    source: SOURCES[body.source] ? body.source : "noel",
    prestation: str(body.prestation, 120),
    date: str(body.date, 10),
    personnes: parseInt(body.personnes, 10),
    type: TYPES[body.type] ? body.type : "particulier",
    societe: str(body.societe, 160),
    nom: str(body.nom, 120),
    telephone: str(body.telephone, 30),
    email: str(body.email, 160).toLowerCase(),
    message: str(body.message, 1000),
    consentement: body.consentement === true,
  };

  const errors = [];
  if (PRESTATIONS.indexOf(d.prestation) === -1) errors.push("Choisissez la prestation qui vous intéresse.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date) || Number.isNaN(new Date(d.date + "T12:00:00").getTime())) errors.push("Indiquez la date souhaitée.");
  if (!(d.personnes > 0 && d.personnes <= 1000)) errors.push("Indiquez le nombre de personnes.");
  if (d.type !== "particulier" && !d.societe) errors.push("Indiquez le nom de votre entreprise ou association.");
  if (!d.nom) errors.push("Indiquez votre nom et prénom.");
  if (!isValidPhone(d.telephone)) errors.push("Indiquez un numéro de téléphone valide.");
  if (!isValidEmail(d.email)) errors.push("Indiquez une adresse e-mail valide.");
  if (!d.consentement) errors.push("Cochez la case d'accord pour que nous puissions vous répondre.");
  if (errors.length) { res.status(400).json({ error: errors[0], errors }); return; }

  if (dryRun) {
    const a = adminNewDemande(d), c = clientDemandeAck(d);
    res.status(200).json({ ok: true, dryRun: true, adminSubject: a.subject, clientSubject: c.subject, emailConfigured: isConfigured() });
    return;
  }

  if (rateLimited(req.ip || "?")) {
    res.status(429).json({ error: "Vous avez déjà envoyé plusieurs demandes. Appelez-nous au 04 65 84 89 18." });
    return;
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) { res.status(500).json({ error: "Configuration serveur manquante." }); return; }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  // Historique gardé dans l'admin (« traces ») : chaque étape avec son heure.
  const historique = [{ at: new Date().toISOString(), quoi: "Demande reçue depuis la page " + (d.source === "noel" ? "Noël" : "devis") }];

  // Enregistrement (best-effort : si la table n'existe pas encore, la demande part quand même par e-mail).
  let saved = false, id = null;
  try {
    const { data, error } = await supabase.from("demandes").insert({
      source: d.source, prestation: d.prestation, date_souhaitee: d.date, personnes: d.personnes,
      type_client: d.type, societe: d.societe || null, nom: d.nom, telephone: d.telephone, email: d.email,
      message: d.message || null, consentement: d.consentement, historique,
    }).select("id").single();
    if (!error) { saved = true; id = data && data.id; }
    else if (!isSetupError(error)) console.error("[demande] enregistrement : " + error.message);
  } catch (e) {
    console.error("[demande] enregistrement : " + (e && e.message));
  }

  let alerte = [];
  try {
    alerte = (await notifyAdmins(supabase, ALERT_EMAIL, "Nouvelle demande — Bistro Burger", {
      prestation: d.prestation, date: d.date, personnes: d.personnes, client: d.type, structure: d.societe,
      nom: d.nom, téléphone: d.telephone, email: d.email, message: d.message,
    }, adminNewDemande(d))) || [];
  } catch (e) {
    console.error("[demande] alerte : " + (e && e.message));
  }
  const alerteTxt = alerte.length
    ? "Alerte envoyée au restaurant (" + alerte.map((a) => a.to + (a.via === "formsubmit" ? " · secours" : "")).join(", ") + ")"
    : "Alerte au restaurant : aucun destinataire";
  historique.push({ at: new Date().toISOString(), quoi: alerteTxt });

  try {
    await notifyPush(supabase, {
      title: "Nouvelle demande" + (d.source === "noel" ? " de Noël" : ""),
      body: d.nom + " — " + d.prestation + " (" + d.personnes + " pers.)",
      url: "/admin/",
    });
  } catch {}

  const c = clientDemandeAck(d);
  const r = await sendEmail({ to: d.email, subject: c.subject, html: c.html, text: c.text, replyTo: ALERT_EMAIL });
  const ack = r.status;
  historique.push({
    at: new Date().toISOString(),
    quoi: ack === "envoye" ? "Accusé de réception envoyé au client (" + d.email + ")"
      : ack === "non_configure" ? "Accusé de réception non envoyé : envoi d'e-mails non configuré"
      : "Accusé de réception NON envoyé : " + (r.detail || "échec de l'envoi"),
  });

  if (saved && id != null) {
    try {
      await supabase.from("demandes").update({
        historique,
        email_restaurant: alerte.length ? "envoye" : "aucun_destinataire",
        email_client: ack,
      }).eq("id", id);
    } catch {}
  }

  res.status(200).json({ ok: true, saved, ack });
};
