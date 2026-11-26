// Accès à la page « Devis traiteur » pendant la phase d'aperçu.
// Tant que DEVIS_PUBLIC n'est pas "true" dans Hostinger, /devis-traiteur répond « page introuvable »
// à tout le monde, sauf aux navigateurs passés par /devis-traiteur/apercu avec une session admin
// (api/devis-apercu.js pose alors un cookie de 30 jours). L'envoi des devis (api/devis.js) applique la même règle.
// Le cookie est une signature calculée avec la clé serveur Supabase : aucune clé n'est écrite dans le code
// (le dépôt GitHub est public).
// Pour ouvrir la page aux clients : DEVIS_PUBLIC=true (puis retirer le bandeau « Aperçu » et le noindex).
const crypto = require("crypto");

const DEVIS_PUBLIC = process.env.DEVIS_PUBLIC === "true";
const COOKIE = "bb_devis_apercu";
const MAX_AGE_MS = 30 * 24 * 3600 * 1000;

function previewToken() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return null;
  return crypto.createHmac("sha256", secret).update("devis-traiteur-apercu-v1").digest("base64url");
}

function hasPreview(req) {
  if (DEVIS_PUBLIC) return true;
  const expected = previewToken();
  if (!expected) return false;
  const m = new RegExp("(?:^|;\\s*)" + COOKIE + "=([^;]+)").exec((req && req.headers && req.headers.cookie) || "");
  if (!m) return false;
  const got = Buffer.from(decodeURIComponent(m[1]));
  const want = Buffer.from(expected);
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

function setPreviewCookie(req, res) {
  res.cookie(COOKIE, previewToken(), { httpOnly: true, sameSite: "lax", secure: !!req.secure, path: "/", maxAge: MAX_AGE_MS });
}

module.exports = { DEVIS_PUBLIC, COOKIE, hasPreview, setPreviewCookie, previewToken };
