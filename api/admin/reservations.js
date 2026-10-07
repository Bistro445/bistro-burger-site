// API protégée pour l'espace admin : consultation et suivi des demandes
// de réservation enregistrées depuis le site public.
const { createClient } = require("@supabase/supabase-js");
const { sendReservationConfirmed } = require("../_lib/customerMail");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ALLOWED_STATUSES = ["nouveau", "confirmee", "annulee"];

async function requireUser(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

module.exports = async (req, res) => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    res.status(500).json({ error: "Configuration serveur manquante." });
    return;
  }

  const user = await requireUser(req);
  if (!user) {
    res.status(401).json({ error: "Non authentifié." });
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("reservations")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(200).json({ items: data || [] });
    return;
  }

  if (req.method === "PATCH") {
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        res.status(400).json({ error: "Corps de requête invalide." });
        return;
      }
    }
    const { id, status } = body || {};
    if (!id || !ALLOWED_STATUSES.includes(status)) {
      res.status(400).json({ error: "Identifiant ou statut invalide." });
      return;
    }

    // Lit l'ancien statut pour n'envoyer l'e-mail qu'au passage à « confirmée ».
    const { data: before, error: readError } = await supabase
      .from("reservations")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (readError) {
      res.status(500).json({ error: readError.message });
      return;
    }

    const { error } = await supabase.from("reservations").update({ status }).eq("id", id);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    let email = "non_concerne";
    let emailDetail = "";
    if (status === "confirmee" && before && (before.status || "nouveau") !== "confirmee") {
      const result = await sendReservationConfirmed(before);
      email = result.status;
      emailDetail = result.detail || "";
    }
    res.status(200).json({ ok: true, email, emailDetail });
    return;
  }

  if (req.method === "DELETE") {
    const id = req.query.id;
    if (!id) {
      res.status(400).json({ error: "Identifiant manquant." });
      return;
    }
    const { error } = await supabase.from("reservations").delete().eq("id", id);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ error: "Méthode non autorisée." });
};
