// E-mail envoyé au CLIENT quand le restaurant confirme sa réservation (bouton
// « Confirmer » de l'admin). Utilise Resend via mailer.js ; le modèle de message est
// dans emailTemplates.js. N'envoie rien tant que RESEND_API_KEY et RESEND_FROM_EMAIL
// (adresse d'un domaine vérifié chez Resend) ne sont pas définies dans Hostinger.
const { sendEmail, isConfigured } = require("./mailer");
const { clientReservationConfirmed } = require("./emailTemplates");

// Adresse qui reçoit les réponses des clients (par défaut : celle du restaurant).
const REPLY_TO = process.env.RESEND_REPLY_TO || process.env.ALERT_EMAIL || "brasserie.zone.avon@gmail.com";

// Renvoie { status, detail } avec status = "envoye" | "non_configure" |
// "pas_d_email" | "echec" (detail = raison de l'échec, jamais la clé).
async function sendReservationConfirmed(row) {
  if (!row || !row.email) return { status: "pas_d_email" };
  if (!isConfigured()) return { status: "non_configure" };
  const { subject, html, text } = clientReservationConfirmed(row);
  return sendEmail({ to: row.email, subject, html, text, replyTo: REPLY_TO, fromName: "Bistro Burger" });
}

module.exports = { sendReservationConfirmed };
