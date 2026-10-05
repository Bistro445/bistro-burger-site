// API publique : enregistre une demande de réservation dans Supabase
// pour qu'elle soit consultable depuis l'espace admin.
const { createClient } = require("@supabase/supabase-js");
const { notifyAdmins } = require("./_lib/notify");
const { notifyPush } = require("./_lib/push");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL;
const ALERT_EMAIL = process.env.ALERT_EMAIL || "brasserie.zone.avon@gmail.com";

function isValidPhone(raw) {
  const cleaned = String(raw || "").replace(/[\s.\-()]/g, "");
  return /^(0[1-9]\d{8}|\+33[1-9]\d{8}|0033[1-9]\d{8})$/.test(cleaned);
}

function isValidEmail(raw) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(raw || ""));
}

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

// N'envoie rien tant que RESEND_API_KEY et RESEND_FROM_EMAIL (nécessite un nom
// de domaine vérifié) ne sont pas configurés — best-effort, ne bloque jamais
// l'enregistrement de la réservation en base.
async function sendCustomerConfirmationEmail(row) {
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL || !row.email) return;
  try {
    const details = [];
    if (row.reservation_date) details.push("le " + row.reservation_date);
    if (row.reservation_time) details.push("à " + row.reservation_time);
    if (row.party_size) details.push("(" + row.party_size + ")");
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + RESEND_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Bistro Burger <" + RESEND_FROM_EMAIL + ">",
        to: row.email,
        subject: "Votre demande de réservation — Bistro Burger",
        html:
          "<p>Bonjour " + escapeHtml(row.name) + ",</p>" +
          "<p>Nous avons bien reçu votre demande de réservation" +
          (details.length ? " " + escapeHtml(details.join(" ")) : "") +
          ". Notre équipe vous recontacte pour confirmer.</p>" +
          "<p>À bientôt,<br>Bistro Burger — Gardanne</p>",
      }),
    });
  } catch {}
}

async function verifyRecaptcha(token) {
  if (!RECAPTCHA_SECRET_KEY) return true; // captcha non configuré : ne bloque pas les réservations
  if (!token) return false;
  try {
    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: RECAPTCHA_SECRET_KEY, response: token }),
    });
    const json = await res.json();
    return !!json.success;
  } catch {
    return false;
  }
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Méthode non autorisée." });
    return;
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    res.status(500).json({ error: "Configuration serveur manquante." });
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
  body = body || {};

  const name = String(body.name || "").trim();
  const phone = String(body.phone || "").trim();
  if (!name || !phone) {
    res.status(400).json({ error: "Nom et téléphone requis." });
    return;
  }
  if (!isValidPhone(phone)) {
    res.status(400).json({ error: "Numéro de téléphone invalide." });
    return;
  }
  const email = body.email ? String(body.email).trim() : "";
  if (email && !isValidEmail(email)) {
    res.status(400).json({ error: "Adresse e-mail invalide." });
    return;
  }

  const recaptchaOk = await verifyRecaptcha(body.recaptchaToken);
  if (!recaptchaOk) {
    res.status(400).json({ error: "Vérification anti-robot invalide." });
    return;
  }

  const row = {
    name,
    phone,
    email: email || null,
    reservation_date: body.date || null,
    reservation_time: body.time ? String(body.time).trim() : null,
    party_size: body.partySize ? String(body.partySize).trim() : null,
    message: body.message ? String(body.message).trim() : null,
  };

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { error } = await supabase.from("reservations").insert(row);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  await notifyAdmins(supabase, ALERT_EMAIL, "Nouvelle réservation — Bistro Burger", {
    nom: row.name,
    téléphone: row.phone,
    email: row.email,
    date: row.reservation_date,
    heure: row.reservation_time,
    couverts: row.party_size,
    message: row.message,
  });
  await sendCustomerConfirmationEmail(row);

  const whenParts = [];
  if (row.reservation_date) whenParts.push(row.reservation_date);
  if (row.reservation_time) whenParts.push(row.reservation_time);
  await notifyPush(supabase, {
    title: "Nouvelle réservation",
    body: row.name + (whenParts.length ? " — " + whenParts.join(" à ") : "") + (row.party_size ? " (" + row.party_size + ")" : ""),
    url: "/app/",
  });

  res.status(200).json({ ok: true });
};
