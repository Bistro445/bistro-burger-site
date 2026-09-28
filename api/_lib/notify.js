// Utilitaire partagé : notifie par e-mail tous les comptes admin (Supabase Auth)
// qu'une nouvelle commande ou réservation vient d'arriver. Best-effort, ne bloque
// jamais l'enregistrement principal en base (chaque échec est avalé silencieusement).
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

async function notifyAdmins(supabase, fallbackEmail, subject, fields) {
  let emails = await getAdminEmails(supabase);
  if (!emails.length && fallbackEmail) emails = [fallbackEmail];

  await Promise.all(
    emails.map(async (email) => {
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
    })
  );
}

module.exports = { notifyAdmins };
