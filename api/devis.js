// API publique du « Devis traiteur » (page /devis-traiteur).
// POST { event, lines, units, promo, contact, website, elapsed } : crée le devis.
//   1. filtre les robots (champ piège, délai minimum, 5 devis par adresse IP et par heure) ;
//   2. refait TOUT le calcul côté serveur avec public/devis-catalogue.js (les prix du navigateur sont ignorés) ;
//   3. contrôle les règles : délai de 96 h, jours d'ouverture, minimums, composition, coordonnées ;
//   4. numérote (DEV-2026-0001), enregistre dans la table `devis` (scripts/devis.sql) avec un lien unique ;
//   5. envoie le devis au client et une copie au restaurant (comptes admin), plus une notification mobile.
// POST { action: "accept", token } : le client « souhaite valider » son devis → statut « accepte »,
//   le restaurant est prévenu (rien n'est validé avant l'échange avec le gérant et l'acompte).
// Pendant l'aperçu, la création n'est possible qu'avec le cookie du lien secret (api/_lib/devisAccess.js).
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const D = require("../public/devis-catalogue.js");
const BBHours = require("../public/hours.js");
const siteData = require("../lib/siteDataStore");
const { hasPreview } = require("./_lib/devisAccess");
const { notifyAdmins } = require("./_lib/notify");
const { notifyPush } = require("./_lib/push");
const { sendEmail } = require("./_lib/mailer");
const { clientDevis, adminDevis } = require("./_lib/emailTemplates");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ALERT_EMAIL = process.env.ALERT_EMAIL || "brasserie.zone.avon@gmail.com";
const SITE_URL = (process.env.SITE_URL || "https://bistroburgergardanne.com").replace(/\/+$/, "");
const TEL = "04 65 84 89 18";

// Limite : 5 devis par adresse IP et par heure.
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
function isSetupError(error) {
  const text = String((error && (error.code || "")) + " " + (error && error.message ? error.message : ""));
  return /42P01|42883|PGRST20[25]|does not exist|schema cache|Could not find/i.test(text);
}

// Heure de Paris → instant précis (le serveur tourne en UTC).
function parisInstant(ymd, minutes) {
  const [y, m, d] = ymd.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60);
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(guess));
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return guess - (asUtc - guess);
}
function parisToday() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date()); }
function addDays(ymd, n) {
  const d = new Date(ymd + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function openingHours() {
  try {
    const files = await siteData.getFiles();
    return BBHours.normalize(files.data && files.data.horaires);
  } catch {
    return null; // horaires indisponibles : seul le délai minimum est contrôlé
  }
}

function eventErrors(ev, hours) {
  const errs = [];
  if (!ev.date) errs.push("Choisissez la date de votre événement.");
  if (ev.time == null) errs.push("Choisissez l'heure de livraison ou de retrait.");
  if (ev.date && ev.time != null) {
    const when = parisInstant(ev.date, ev.time);
    // 30 minutes de tolérance pour le temps passé à remplir le formulaire.
    if (when < Date.now() + D.CONFIG.delayHours * 3600 * 1000 - 30 * 60 * 1000) {
      errs.push("Ce créneau est trop proche : il faut commander au moins " + D.CONFIG.delayHours + " h à l'avance. Choisissez une autre date à l'étape 1.");
    } else if (hours && hours.days && !D.slotsFor(ev.date, hours).some((s) => s.min === ev.time)) {
      errs.push("Le restaurant n'est pas ouvert à ce créneau. Choisissez un autre horaire à l'étape 1.");
    }
  }
  if (!(ev.guests >= 1)) errs.push("Indiquez le nombre de convives.");
  if (!ev.mode) errs.push("Choisissez livraison ou retrait à la brasserie.");
  if (ev.mode === "livraison" && !ev.commune) errs.push("Choisissez la commune de livraison.");
  return errs;
}

function cleanContact(c, ev) {
  c = c || {};
  const out = {
    type: ["entreprise", "particulier", "association"].indexOf(c.type) > -1 ? c.type : "",
    nom: str(c.nom, 120), societe: str(c.societe, 160), siret: str(c.siret, 20),
    tel: str(c.tel, 30), email: str(c.email, 160).toLowerCase(), email2: str(c.email2, 160).toLowerCase(),
    adresse: str(c.adresse, 200), cp: str(c.cp, 5), ville: str(c.ville, 80),
    factSame: c.factSame !== false, facturation: str(c.facturation, 400), remarques: str(c.remarques, 1000),
    rgpd: c.rgpd === true, offres: c.offres === true,
  };
  if (out.type !== "entreprise") { out.societe = out.type === "association" ? out.societe : ""; out.siret = ""; }
  if (ev.mode !== "livraison") { out.adresse = ""; out.cp = ""; out.ville = ""; }
  else if (ev.commune !== "Autre commune") out.ville = ev.commune;
  if (out.factSame) out.facturation = "";
  return out;
}

function supa() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

async function accept(req, res, body) {
  const token = str(body.token, 80);
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) { res.status(400).json({ error: "Lien de devis invalide." }); return; }
  const supabase = supa();
  const { data: d, error } = await supabase.from("devis").select("*").eq("token", token).maybeSingle();
  if (error || !d) { res.status(404).json({ error: "Devis introuvable. Appelez-nous au " + TEL + "." }); return; }
  if (d.statut === "accepte") { res.status(200).json({ ok: true, deja: true }); return; }
  if (d.statut !== "nouveau" && d.statut !== "envoye") { res.status(409).json({ error: "Ce devis ne peut plus être validé en ligne. Appelez-nous au " + TEL + "." }); return; }
  if (d.valide_jusqu && d.valide_jusqu < parisToday()) { res.status(409).json({ error: "Ce devis a expiré. Appelez-nous au " + TEL + " pour en établir un nouveau." }); return; }

  const now = new Date().toISOString();
  const historique = (Array.isArray(d.historique) ? d.historique : []).concat([{ at: now, quoi: "Le client a cliqué sur « Je souhaite valider ce devis »" }]);
  const url = SITE_URL + "/devis-traiteur/d/" + d.token;
  let alerte = [];
  try {
    alerte = (await notifyAdmins(supabase, ALERT_EMAIL, "Devis " + d.numero + " : le client souhaite valider", {
      devis: d.numero, nom: d.nom, téléphone: d.telephone, email: d.email, total: d.total_ttc + " € TTC", lien: url,
    }, adminDevis(d, url, true))) || [];
  } catch (e) { console.error("[devis] alerte acceptation : " + (e && e.message)); }
  historique.push({ at: new Date().toISOString(), quoi: alerte.length ? "Restaurant prévenu (" + alerte.map((a) => a.to).join(", ") + ")" : "Restaurant : aucun destinataire pour l'alerte" });
  try { await notifyPush(supabase, { title: "Devis à valider", body: d.numero + " — " + d.nom, url: "/admin/" }); } catch {}

  const up = await supabase.from("devis").update({ statut: "accepte", accepte_le: now, historique }).eq("id", d.id);
  if (up.error) { res.status(500).json({ error: "L'envoi n'a pas abouti. Appelez-nous au " + TEL + "." }); return; }
  res.status(200).json({ ok: true });
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.status(405).json({ error: "Méthode non autorisée." }); return; }
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { res.status(400).json({ error: "Corps de requête invalide." }); return; } }
  body = body || {};
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) { res.status(500).json({ error: "Configuration serveur manquante." }); return; }

  if (body.action === "accept") return accept(req, res, body);

  // Pendant l'aperçu : seules les personnes passées par le lien secret peuvent créer un devis.
  if (!hasPreview(req)) { res.status(404).json({ error: "Route introuvable." }); return; }

  // Robots : champ piège rempli ou envoi trop rapide → réponse vide, rien n'est fait.
  if (str(body.website) || (Number(body.elapsed) > 0 && Number(body.elapsed) < 5000)) { res.status(200).json({ ok: false, error: "Envoi refusé. Réessayez dans un instant." }); return; }

  const state = D.sanitize(body);
  const ev = state.event;
  const contact = cleanContact(body.contact, ev);
  const hours = await openingHours();
  const errors = eventErrors(ev, hours)
    .concat(D.orderErrors(state))
    .concat(D.contactErrors(Object.assign({}, contact, { tel: contact.tel, email2: contact.email2 }), ev).errs);
  if (errors.length) { res.status(400).json({ error: errors[0], errors }); return; }

  if (rateLimited(req.ip || "?")) { res.status(429).json({ error: "Vous avez déjà envoyé plusieurs devis. Appelez-nous au " + TEL + "." }); return; }

  // Calcul officiel (serveur).
  const t = D.totals(state);
  const r2 = D.round2;
  const lignes = D.devisLines(state);
  const totaux = {
    remise: r2(t.discount), codePromo: state.promo || null,
    livraison: t.delivery ? { label: t.delivery.label, ht: r2(t.delivery.ht), note: t.delivery.note || null, ex: !!t.delivery.ex } : null,
    tva: t.rates.map((r) => ({ rate: r.rate, base: r2(r.base), tva: r2(r.tva) })),
    parPersonneHt: r2(t.perPersonHt), parPersonneTtc: r2(t.perPersonTtc), acomptePct: D.CONFIG.depositPct,
  };

  const supabase = supa();
  const num = await supabase.rpc("next_devis_numero");
  if (num.error || !num.data) {
    console.error("[devis] numérotation : " + (num.error && num.error.message));
    res.status(503).json({ error: isSetupError(num.error) ? "Le service de devis n'est pas encore activé. Appelez-nous au " + TEL + "." : "Enregistrement impossible pour le moment. Réessayez ou appelez-nous au " + TEL + "." });
    return;
  }
  const numero = String(num.data);
  const token = crypto.randomBytes(24).toString("base64url");
  const now = new Date().toISOString();
  const historique = [{ at: now, quoi: "Devis créé depuis la page devis traiteur" }];

  const row = {
    created_at: now, numero, token, statut: "nouveau", valide_jusqu: addDays(parisToday(), D.CONFIG.validityDays),
    type_client: contact.type, nom: contact.nom, societe: contact.societe || null, siret: contact.siret ? contact.siret.replace(/\s/g, "") : null,
    telephone: contact.tel, email: contact.email, adresse: contact.adresse || null, code_postal: contact.cp || null, ville: contact.ville || null,
    facturation: contact.facturation || null, remarques: contact.remarques || null, consentement: contact.rgpd, offres: contact.offres,
    date_evenement: ev.date, heure: D.fmtTime(ev.time), convives: ev.guests, mode: ev.mode, commune: ev.commune || null,
    contenu: { lignes, totaux }, saisie: { event: ev, lines: state.lines, units: state.units, promo: state.promo },
    total_ht: r2(t.ht), total_tva: r2(t.tva), total_ttc: r2(t.ttc), acompte: r2(t.deposit),
    historique,
  };
  const ins = await supabase.from("devis").insert(row).select("id").single();
  if (ins.error) {
    console.error("[devis] enregistrement : " + ins.error.message);
    res.status(503).json({ error: "Enregistrement impossible pour le moment. Réessayez ou appelez-nous au " + TEL + "." });
    return;
  }
  const id = ins.data.id;
  const url = SITE_URL + "/devis-traiteur/d/" + token;

  // E-mail au client, devis PDF en pièce jointe
  const pdf = devisAttachment(row);
  const cm = clientDevis(row, url);
  const sent = await sendEmail({ to: row.email, subject: cm.subject, html: cm.html, text: cm.text, replyTo: ALERT_EMAIL, attachments: pdf ? [pdf] : undefined });
  historique.push({
    at: new Date().toISOString(),
    quoi: sent.status === "envoye" ? "Devis envoyé au client (" + row.email + ")" + (pdf ? " avec le PDF" : " (sans PDF : création impossible)")
      : sent.status === "non_configure" ? "Devis NON envoyé au client : envoi d'e-mails non configuré"
      : "Devis NON envoyé au client : " + (sent.detail || "échec de l'envoi"),
  });

  // Copie au restaurant
  let alerte = [];
  try {
    alerte = (await notifyAdmins(supabase, ALERT_EMAIL, "Nouveau devis " + numero, {
      devis: numero, nom: row.nom, société: row.societe, téléphone: row.telephone, email: row.email,
      date: row.date_evenement + " " + row.heure, convives: row.convives, total: row.total_ttc + " € TTC", lien: url,
    }, Object.assign(adminDevis(row, url, false), { attachments: pdf ? [pdf] : undefined }))) || [];
  } catch (e) { console.error("[devis] alerte : " + (e && e.message)); }
  historique.push({ at: new Date().toISOString(), quoi: alerte.length ? "Copie envoyée au restaurant (" + alerte.map((a) => a.to + (a.via === "formsubmit" ? " · secours" : "")).join(", ") + ")" : "Copie au restaurant : aucun destinataire" });
  try { await notifyPush(supabase, { title: "Nouveau devis traiteur", body: numero + " — " + row.nom + " (" + row.convives + " pers.)", url: "/admin/" }); } catch {}

  try {
    await supabase.from("devis").update({
      historique, statut: sent.status === "envoye" ? "envoye" : "nouveau",
      email_client: sent.status, email_restaurant: alerte.length ? "envoye" : "aucun_destinataire",
    }).eq("id", id);
  } catch {}

  res.status(200).json({ ok: true, numero, token, url: "/devis-traiteur/d/" + token, totalTtc: row.total_ttc, acompte: row.acompte, emailClient: sent.status });
};
