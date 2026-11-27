// Mode test des formulaires (devis traiteur, page Noël), réservé à un compte admin connecté.
// Envoyer { test: true } avec l'en-tête « Authorization: Bearer <jeton de session admin> » :
//   - la copie « restaurant » part UNIQUEMENT vers l'adresse de l'admin qui teste (pas aux autres comptes admin) ;
//   - aucune notification sur les téléphones ;
//   - le devis reçoit un numéro « TEST-… » (le compteur DEV-AAAA-NNNN n'avance pas).
// Sans jeton admin valide, { test: true } est refusé : un visiteur ne peut pas couper les alertes du restaurant.
const { createClient } = require("@supabase/supabase-js");
const { sendEmail } = require("./mailer");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Renvoie l'e-mail de l'admin qui teste, null si ce n'est pas un test, false si le test est refusé.
async function testerEmail(req, body) {
  if (!body || body.test !== true) return null;
  const auth = (req.headers && req.headers.authorization) || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return false;
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { data, error } = await sb.auth.getUser(token);
    return !error && data && data.user && data.user.email ? data.user.email : false;
  } catch {
    return false;
  }
}

// Envoie l'alerte « restaurant » au seul testeur (même modèle d'e-mail, objet préfixé « [TEST] »).
async function alertTester(email, mail) {
  const r = await sendEmail({
    to: email, subject: "[TEST] " + mail.subject, html: mail.html, text: mail.text,
    replyTo: mail.replyTo, attachments: mail.attachments, fromName: "Bistro Burger (alertes)",
  });
  return r.status === "envoye" ? [{ to: email, via: "resend" }] : [];
}

module.exports = { testerEmail, alertTester };
