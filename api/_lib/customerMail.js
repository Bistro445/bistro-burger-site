// E-mail envoyé au CLIENT quand le restaurant confirme sa réservation (bouton
// « Confirmer » de l'admin). Utilise Resend. N'envoie rien tant que RESEND_API_KEY
// et RESEND_FROM_EMAIL (adresse d'un domaine vérifié chez Resend) ne sont pas
// définies dans Hostinger. Ne lève jamais d'erreur : renvoie un statut lisible.
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL;
// Adresse qui reçoit les réponses des clients (par défaut : celle du restaurant).
const REPLY_TO = process.env.RESEND_REPLY_TO || process.env.ALERT_EMAIL || "brasserie.zone.avon@gmail.com";

const RESTAURANT = {
  nom: "Bistro Burger",
  adresse: "ZAC Avon, Bretelle de la Plaine, 13120 Gardanne",
  telephoneAffiche: "04 65 84 89 18",
  telephoneLien: "+33465848918",
};

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

function formatDateFr(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr + "T12:00:00");
    if (Number.isNaN(d.getTime())) return String(dateStr);
    const txt = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(d);
    return txt.charAt(0).toUpperCase() + txt.slice(1);
  } catch {
    return String(dateStr);
  }
}

function buildMessage(row) {
  const date = formatDateFr(row.reservation_date);
  const heure = row.reservation_time ? String(row.reservation_time) : "";
  const couverts = row.party_size ? String(row.party_size) : "";

  const lignes = [];
  if (date) lignes.push(["Date", date]);
  if (heure) lignes.push(["Heure", heure]);
  if (couverts) lignes.push(["Nombre de personnes", couverts]);

  const prenom = row.name ? String(row.name).trim() : "";
  const hello = prenom ? "Bonjour " + prenom + "," : "Bonjour,";

  const texte =
    hello + "\n\n" +
    "Bonne nouvelle : votre réservation chez " + RESTAURANT.nom + " est confirmée.\n\n" +
    lignes.map(([k, v]) => k + " : " + v).join("\n") + (lignes.length ? "\n" : "") +
    "Adresse : " + RESTAURANT.adresse + "\n" +
    "Téléphone : " + RESTAURANT.telephoneAffiche + "\n\n" +
    "Un empêchement ou un changement ? Appelez-nous, ou répondez simplement à cet e-mail.\n\n" +
    "À très bientôt,\nL'équipe " + RESTAURANT.nom + " — Gardanne\n";

  const tableau = lignes.length
    ? '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:14px 0 18px;border-collapse:collapse">' +
      lignes.map(([k, v]) =>
        '<tr><td style="padding:6px 16px 6px 0;color:#5b6670">' + escapeHtml(k) + "</td>" +
        '<td style="padding:6px 0;font-weight:600">' + escapeHtml(v) + "</td></tr>"
      ).join("") +
      "</table>"
    : "";

  const html =
    '<div style="font-family:Segoe UI,Arial,sans-serif;color:#1d252c;max-width:520px;margin:0 auto">' +
    '<div style="background:#1f5d4c;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0;font-size:18px;font-weight:700">' +
    escapeHtml(RESTAURANT.nom) + " — Gardanne</div>" +
    '<div style="border:1px solid #d9dfe3;border-top:none;border-radius:0 0 8px 8px;padding:20px">' +
    "<p>" + escapeHtml(hello) + "</p>" +
    "<p>Bonne nouvelle : <b>votre réservation est confirmée.</b></p>" +
    tableau +
    "<p><b>Adresse</b><br>" + escapeHtml(RESTAURANT.adresse) + "</p>" +
    '<p><b>Téléphone</b><br><a href="tel:' + RESTAURANT.telephoneLien + '" style="color:#1f5d4c">' +
    escapeHtml(RESTAURANT.telephoneAffiche) + "</a></p>" +
    "<p>Un empêchement ou un changement ? Appelez-nous, ou répondez simplement à cet e-mail.</p>" +
    "<p>À très bientôt,<br>L'équipe " + escapeHtml(RESTAURANT.nom) + "</p>" +
    "</div></div>";

  return { subject: "Votre réservation est confirmée — " + RESTAURANT.nom, html, text: texte };
}

// Renvoie "envoye" | "non_configure" | "pas_d_email" | "echec".
async function sendReservationConfirmed(row) {
  if (!row || !row.email) return "pas_d_email";
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) return "non_configure";

  const { subject, html, text } = buildMessage(row);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: "Bearer " + RESEND_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESTAURANT.nom + " <" + RESEND_FROM_EMAIL + ">",
        to: row.email,
        reply_to: REPLY_TO,
        subject,
        html,
        text,
      }),
    });
    return res.ok ? "envoye" : "echec";
  } catch {
    return "echec";
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { sendReservationConfirmed };
