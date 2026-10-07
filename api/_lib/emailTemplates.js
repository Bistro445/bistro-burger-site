// Modèles d'e-mails aux couleurs du restaurant (mise en page en tableaux, compatible
// Gmail, Outlook, Apple Mail et mobile). Chaque fonction renvoie { subject, html, text }.
const SITE_URL = process.env.SITE_URL || "https://bistroburgergardanne.com";

const C = {
  vert900: "#0E463D",
  vert800: "#12574C",
  vert700: "#1B6D5F",
  creme500: "#EDE0D3",
  creme400: "#F4ECE2",
  terre: "#B5651D",
  texte: "#1d252c",
  gris: "#66727c",
  ligne: "#e4dacd",
};

const RESTAURANT = {
  nom: "Bistro Burger",
  adresse: "ZAC Avon, Bretelle de la Plaine, 13120 Gardanne",
  telephoneAffiche: "04 65 84 89 18",
  telephoneLien: "+33465848918",
  carte: "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent("Bistro Burger, ZAC Avon, Bretelle de la Plaine, 13120 Gardanne"),
  logo: SITE_URL + "/assets/logo-cream-sm.png",
};

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

function formatDateFr(dateStr, court) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr + "T12:00:00");
    if (Number.isNaN(d.getTime())) return String(dateStr);
    const opts = court
      ? { weekday: "short", day: "numeric", month: "short" }
      : { weekday: "long", day: "numeric", month: "long", year: "numeric" };
    const txt = new Intl.DateTimeFormat("fr-FR", opts).format(d);
    return txt.charAt(0).toUpperCase() + txt.slice(1);
  } catch {
    return String(dateStr);
  }
}

function bouton(libelle, href, plein) {
  const fond = plein ? C.vert800 : "#ffffff";
  const couleur = plein ? "#ffffff" : C.vert800;
  return (
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-table;margin:4px 6px 4px 0"><tr>' +
    '<td align="center" bgcolor="' + fond + '" style="border-radius:8px;border:2px solid ' + C.vert800 + '">' +
    '<a href="' + esc(href) + '" style="display:inline-block;padding:12px 22px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:' + couleur + ';text-decoration:none">' +
    esc(libelle) + "</a></td></tr></table>"
  );
}

function lignes(items) {
  // items : [[libellé, valeurHtmlDéjàSûre], ...]
  return (
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">' +
    items
      .filter((it) => it && it[1] !== "" && it[1] != null)
      .map(
        (it, i, arr) =>
          "<tr>" +
          '<td style="padding:11px 0;' + (i < arr.length - 1 ? "border-bottom:1px solid " + C.ligne + ";" : "") +
          'font-family:Arial,Helvetica,sans-serif;font-size:13px;color:' + C.gris + ';text-transform:uppercase;letter-spacing:.6px;width:38%;vertical-align:top">' +
          esc(it[0]) + "</td>" +
          '<td style="padding:11px 0;' + (i < arr.length - 1 ? "border-bottom:1px solid " + C.ligne + ";" : "") +
          'font-family:Arial,Helvetica,sans-serif;font-size:16px;color:' + C.texte + ';font-weight:700;vertical-align:top">' +
          it[1] + "</td></tr>"
      )
      .join("") +
    "</table>"
  );
}

// Cadre commun : bandeau vert avec logo, bloc de contenu, pied de page.
function cadre({ preheader, pastille, pastilleCouleur, titre, intro, contenu, pied }) {
  return (
    '<!doctype html><html lang="fr"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="color-scheme" content="light"><title>' + esc(titre) + "</title></head>" +
    '<body style="margin:0;padding:0;background:' + C.creme400 + '">' +
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">' + esc(preheader) + "</div>" +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="' + C.creme400 + '"><tr><td align="center" style="padding:24px 12px">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid ' + C.ligne + '">' +
    // bandeau
    '<tr><td align="center" bgcolor="' + C.vert900 + '" style="padding:26px 20px 22px">' +
    '<img src="' + esc(RESTAURANT.logo) + '" alt="Bistro Burger" height="46" style="display:block;margin:0 auto;border:0;height:46px;width:auto">' +
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:2.4px;color:' + C.creme500 + ';margin-top:10px;text-transform:uppercase">Restaurant &middot; Gardanne</div>' +
    "</td></tr>" +
    // titre
    '<tr><td style="padding:28px 28px 6px">' +
    '<span style="display:inline-block;background:' + pastilleCouleur + ';color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;padding:5px 11px;border-radius:20px">' + esc(pastille) + "</span>" +
    '<h1 style="margin:14px 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:26px;line-height:1.2;color:' + C.vert900 + '">' + titre + "</h1>" +
    (intro ? '<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:' + C.texte + '">' + intro + "</p>" : "") +
    "</td></tr>" +
    // contenu
    '<tr><td style="padding:14px 28px 26px">' + contenu + "</td></tr>" +
    // pied
    '<tr><td bgcolor="' + C.creme400 + '" style="padding:18px 28px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:' + C.gris + '">' +
    pied +
    "</td></tr></table>" +
    "</td></tr></table></body></html>"
  );
}

function pointDe(row) {
  // Résumé court pour les objets d'e-mail : « mar. 13 oct. à 17h30, 2 pers. »
  const parts = [];
  if (row.reservation_date) parts.push(formatDateFr(row.reservation_date, true));
  if (row.reservation_time) parts.push("à " + row.reservation_time);
  return parts.join(" ") + (row.party_size ? ", " + row.party_size : "");
}

// ───────────── E-mail au CLIENT : réservation confirmée ─────────────
function clientReservationConfirmed(row) {
  const prenom = row.name ? String(row.name).trim() : "";
  const date = formatDateFr(row.reservation_date);
  const details = lignes([
    ["Date", esc(date)],
    ["Heure", esc(row.reservation_time || "")],
    ["Personnes", esc(row.party_size || "")],
  ]);

  const contenu =
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="' + C.creme400 + '" style="border-radius:10px"><tr><td style="padding:8px 20px">' +
    details + "</td></tr></table>" +
    '<p style="margin:20px 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:' + C.gris + '">Où nous trouver</p>' +
    '<p style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:' + C.texte + '"><b>' + esc(RESTAURANT.nom) + "</b><br>" + esc(RESTAURANT.adresse) + "<br>Parking gratuit devant le restaurant</p>" +
    bouton("Voir l'itinéraire", RESTAURANT.carte, true) +
    bouton("Nous appeler : " + RESTAURANT.telephoneAffiche, "tel:" + RESTAURANT.telephoneLien, false) +
    '<p style="margin:18px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:' + C.texte + '">Un empêchement ou un changement ? <b>Appelez-nous</b> ou répondez simplement à cet e-mail : nous libérerons votre table.</p>';

  const html = cadre({
    preheader: "Votre table est réservée le " + (date || "") + (row.reservation_time ? " à " + row.reservation_time : "") + ".",
    pastille: "Réservation confirmée",
    pastilleCouleur: C.vert700,
    titre: "À très bientôt" + (prenom ? ", " + esc(prenom) : "") + " !",
    intro: "Bonne nouvelle : <b>votre table est confirmée</b>. Voici le récapitulatif.",
    contenu,
    pied:
      "Vous recevez cet e-mail car une réservation a été demandée avec cette adresse sur " +
      '<a href="' + esc(SITE_URL) + '" style="color:' + C.vert800 + '">bistroburgergardanne.com</a>.<br>' +
      esc(RESTAURANT.nom) + " &middot; " + esc(RESTAURANT.adresse),
  });

  const text =
    (prenom ? "Bonjour " + prenom + "," : "Bonjour,") + "\n\n" +
    "Bonne nouvelle : votre réservation chez " + RESTAURANT.nom + " est confirmée.\n\n" +
    (date ? "Date : " + date + "\n" : "") +
    (row.reservation_time ? "Heure : " + row.reservation_time + "\n" : "") +
    (row.party_size ? "Personnes : " + row.party_size + "\n" : "") +
    "\nAdresse : " + RESTAURANT.adresse + "\nItinéraire : " + RESTAURANT.carte + "\nTéléphone : " + RESTAURANT.telephoneAffiche + "\n\n" +
    "Un empêchement ou un changement ? Appelez-nous, ou répondez simplement à cet e-mail.\n\n" +
    "À très bientôt,\nL'équipe " + RESTAURANT.nom + " — Gardanne\n";

  return { subject: "Votre réservation est confirmée — " + RESTAURANT.nom, html, text };
}

// ───────────── Alerte au RESTAURANT : nouvelle réservation ─────────────
function adminNewReservation(row) {
  const tel = row.phone ? '<a href="tel:' + esc(String(row.phone).replace(/[^\d+]/g, "")) + '" style="color:' + C.vert800 + ';text-decoration:none">' + esc(row.phone) + "</a>" : "";
  const mail = row.email ? '<a href="mailto:' + esc(row.email) + '" style="color:' + C.vert800 + ';text-decoration:none">' + esc(row.email) + "</a>" : "";
  const details = lignes([
    ["Nom", esc(row.name || "")],
    ["Téléphone", tel],
    ["E-mail", mail],
    ["Date", esc(formatDateFr(row.reservation_date))],
    ["Heure", esc(row.reservation_time || "")],
    ["Personnes", esc(row.party_size || "")],
  ]);
  const message = row.message
    ? '<p style="margin:16px 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:' + C.gris + ';text-transform:uppercase;letter-spacing:.6px">Message du client</p>' +
      '<p style="margin:0;padding:12px 14px;background:' + C.creme400 + ';border-left:4px solid ' + C.terre + ';border-radius:4px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:' + C.texte + '">' + esc(row.message).replace(/\n/g, "<br>") + "</p>"
    : "";

  const contenu =
    details + message +
    '<div style="margin-top:22px">' +
    bouton("Confirmer dans l'admin", SITE_URL + "/admin/", true) +
    (row.phone ? bouton("Appeler le client", "tel:" + String(row.phone).replace(/[^\d+]/g, ""), false) : "") +
    "</div>" +
    '<p style="margin:14px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:' + C.gris + '">' +
    (row.email ? "Dès que vous cliquez sur « Confirmer » dans l'admin, le client reçoit automatiquement son e-mail de confirmation." : "Ce client n'a pas laissé d'e-mail : pensez à le prévenir par téléphone.") +
    "</p>";

  const html = cadre({
    preheader: (row.name || "Un client") + " : " + pointDe(row),
    pastille: "Nouvelle réservation",
    pastilleCouleur: C.terre,
    titre: esc(row.name || "Nouvelle demande"),
    intro: "<b>" + esc(pointDe(row)) + "</b>",
    contenu,
    pied:
      "Alerte automatique envoyée par le site <a href=\"" + esc(SITE_URL) + '" style="color:' + C.vert800 + '">bistroburgergardanne.com</a>. ' +
      "Vous pouvez répondre à cet e-mail : la réponse part directement au client.",
  });

  const text =
    "Nouvelle réservation — " + RESTAURANT.nom + "\n\n" +
    "Nom : " + (row.name || "") + "\nTéléphone : " + (row.phone || "") + "\nE-mail : " + (row.email || "") + "\n" +
    "Date : " + formatDateFr(row.reservation_date) + "\nHeure : " + (row.reservation_time || "") + "\nPersonnes : " + (row.party_size || "") + "\n" +
    (row.message ? "Message : " + row.message + "\n" : "") +
    "\nGérer : " + SITE_URL + "/admin/\n";

  return {
    subject: "Nouvelle réservation : " + (row.name || "client") + " — " + pointDe(row),
    html, text,
    replyTo: row.email || undefined,
  };
}

// ───────────── Alerte au RESTAURANT : nouvelle commande ─────────────
function adminNewOrder(row) {
  const items = Array.isArray(row.items) ? row.items : [];
  const liste = items
    .map((it) => '<div style="padding:3px 0">' + esc((it.qty || 1) + " × " + (it.name || "")) + "</div>")
    .join("");
  const tel = row.customer_phone ? '<a href="tel:' + esc(String(row.customer_phone).replace(/[^\d+]/g, "")) + '" style="color:' + C.vert800 + ';text-decoration:none">' + esc(row.customer_phone) + "</a>" : "";
  const details = lignes([
    ["Nom", esc(row.customer_name || "")],
    ["Téléphone", tel],
    ["Articles", liste],
    ["Total", row.total != null ? esc(row.total) + " €" : ""],
  ]);
  const contenu =
    details +
    '<div style="margin-top:22px">' + bouton("Voir dans l'admin", SITE_URL + "/admin/", true) + "</div>";

  const html = cadre({
    preheader: (row.customer_name || "Un client") + " : " + items.map((it) => (it.qty || 1) + "x " + it.name).join(", "),
    pastille: "Nouvelle commande",
    pastilleCouleur: C.terre,
    titre: esc(row.customer_name || "Nouvelle commande"),
    intro: row.total != null ? "Total : <b>" + esc(row.total) + " €</b>" : "",
    contenu,
    pied: "Alerte automatique envoyée par le site " + '<a href="' + esc(SITE_URL) + '" style="color:' + C.vert800 + '">bistroburgergardanne.com</a>.',
  });

  const text =
    "Nouvelle commande — " + RESTAURANT.nom + "\n\nNom : " + (row.customer_name || "") + "\nTéléphone : " + (row.customer_phone || "") + "\n" +
    "Articles : " + items.map((it) => (it.qty || 1) + "x " + it.name).join(", ") + "\nTotal : " + (row.total != null ? row.total + " €" : "") + "\n";

  return { subject: "Nouvelle commande : " + (row.customer_name || "client") + (row.total != null ? " — " + row.total + " €" : ""), html, text };
}

module.exports = { clientReservationConfirmed, adminNewReservation, adminNewOrder, RESTAURANT };
