// Utilitaire partagé : envoie une notification push à tous les téléphones
// abonnés (table push_subscriptions). Best-effort, ne bloque jamais
// l'enregistrement principal en base. No-op tant que les clés VAPID ne sont
// pas configurées (mêmes conventions que api/_lib/notify.js).
const webpush = require("web-push");

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_CONTACT_EMAIL = process.env.VAPID_CONTACT_EMAIL || "brasserie.zone.avon@gmail.com";

let configured = false;
function ensureConfigured() {
  if (configured || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return configured;
  webpush.setVapidDetails("mailto:" + VAPID_CONTACT_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  configured = true;
  return true;
}

async function notifyPush(supabase, { title, body, url }) {
  if (!ensureConfigured()) return;

  const { data, error } = await supabase.from("push_subscriptions").select("*");
  if (error || !data || !data.length) return;

  const payload = JSON.stringify({ title, body, url });

  await Promise.all(
    data.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        );
      } catch (err) {
        const code = err && err.statusCode;
        if (code === 404 || code === 410) {
          try {
            await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          } catch {}
        }
      }
    })
  );
}

module.exports = { notifyPush };
