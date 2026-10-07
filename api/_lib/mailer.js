// Envoi d'e-mails via Resend (service d'envoi). Utilisé pour l'e-mail de confirmation
// au client et pour les alertes envoyées au restaurant. Ne lève jamais d'erreur :
// renvoie { status, detail } avec status = "envoye" | "non_configure" | "echec".
// La clé API n'apparaît jamais dans les messages renvoyés.
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL;

function clean(v) {
  // Retire espaces, retours à la ligne et guillemets collés par erreur autour d'une valeur.
  return String(v || "").trim().replace(/^["']|["']$/g, "");
}

function isConfigured() {
  return Boolean(clean(RESEND_API_KEY) && clean(RESEND_FROM_EMAIL));
}

async function sendEmail({ to, subject, html, text, replyTo, fromName }) {
  if (!isConfigured()) return { status: "non_configure" };

  const payload = {
    from: (fromName || "Bistro Burger") + " <" + clean(RESEND_FROM_EMAIL) + ">",
    to,
    subject,
    html,
    text,
  };
  if (replyTo) payload.reply_to = replyTo;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: "Bearer " + clean(RESEND_API_KEY),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (res.ok) return { status: "envoye" };
    let msg = "";
    try {
      const j = await res.json();
      msg = [j && j.name, j && j.message].filter(Boolean).join(" : ");
    } catch {}
    const detail = "Resend a répondu " + res.status + (msg ? " (" + msg + ")" : "");
    console.error("[mailer] " + detail);
    return { status: "echec", detail };
  } catch (e) {
    const detail = e && e.name === "AbortError" ? "Resend n'a pas répondu à temps" : "Erreur réseau : " + (e && e.message ? e.message : "inconnue");
    console.error("[mailer] " + detail);
    return { status: "echec", detail };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { sendEmail, isConfigured };
