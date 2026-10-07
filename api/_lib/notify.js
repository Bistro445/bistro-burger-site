// Utilitaire partagé : notifie par e-mail tous les comptes admin (Supabase Auth)
// qu'une nouvelle commande ou réservation vient d'arriver. Best-effort, ne bloque
// jamais l'enregistrement principal en base (chaque échec est avalé silencieusement).
//
// Si un modèle d'e-mail soigné est fourni (`mail` = { subject, html, text, replyTo })
// et que Resend est configuré, l'alerte part par Resend. Sinon (ou si l'envoi échoue),
// on garde l'ancien système (formsubmit.co) pour ne jamais perdre une alerte.
const { sendEmail, isConfigured } = require("./mailer");

const SITE_URL = process.env.SITE_URL || "https://bistroburgergardanne.com";

async function getAdminEmails(supabase) {
  try {
    const { data, error } = await supabase.auth.admin.listUsers();
    if (error || !data || !data.users) return [];
    return [...new Set(data.users.map((u) => u.email).filter(Boolean))];
  } catch {
    return [];
  }
}

async function sendViaFormsubmit(email, subject, fields) {
  try {
    const params = new URLSearchParams();
    params.set("_subject", subject);
    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        params.set(key, String(value));
      }
    });
    await fetch("https://formsubmit.co/ajax/" + encodeURIComponent(email), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: SITE_URL + "/",
        Origin: SITE_URL,
      },
      body: params,
    });
  } catch {}
}

async function notifyAdmins(supabase, fallbackEmail, subject, fields, mail) {
  let emails = await getAdminEmails(supabase);
  if (!emails.length && fallbackEmail) emails = [fallbackEmail];

  await Promise.all(
    emails.map(async (email) => {
      if (mail && isConfigured()) {
        const result = await sendEmail({
          to: email,
          subject: mail.subject || subject,
          html: mail.html,
          text: mail.text,
          replyTo: mail.replyTo,
          fromName: "Bistro Burger (alertes)",
        });
        if (result.status === "envoye") return;
      }
      await sendViaFormsubmit(email, subject, fields);
    })
  );
}

module.exports = { notifyAdmins };
