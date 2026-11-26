"use strict";
// Page du devis traiteur, ouverte par son lien unique : /devis-traiteur/d/<jeton>.
// Document A4 aux couleurs du restaurant : à l'écran (boutons « Imprimer / PDF » et « Je souhaite valider »)
// et à l'impression (mise en page dédiée, sans boutons). Le jeton est long et aléatoire : impossible à deviner.
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SOCIETE = {
  nom: "Bistro Burger",
  raison: "Brasserie Zone Avon, SARL au capital de 200 €",
  adresse: "ZAC Avon, Bretelle de la Plaine, 13120 Gardanne",
  telephone: "04 65 84 89 18",
  email: "brasserie.zone.avon@gmail.com",
  site: "bistroburgergardanne.com",
  siret: "981 082 969 00016",
  tva: "FR35981082969",
};
const TYPES = { particulier: "Particulier", entreprise: "Entreprise", association: "Association" };
const STATUTS = {
  nouveau: "Nouveau", envoye: "Envoyé", accepte: "Le client souhaite valider", refuse: "Refusé",
  expire: "Expiré", realise: "Réalisé", facture: "Facturé",
};

const money = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const eur = (n) => money.format(Math.round((Number(n) || 0) * 100) / 100);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
function dateFr(ymd, withDay) {
  if (!ymd) return "";
  const d = new Date(String(ymd).slice(0, 10) + "T12:00:00Z");
  if (Number.isNaN(d.getTime())) return String(ymd);
  const opts = withDay ? { weekday: "long", day: "numeric", month: "long", year: "numeric" } : { day: "numeric", month: "long", year: "numeric" };
  const t = new Intl.DateTimeFormat("fr-FR", Object.assign({ timeZone: "Europe/Paris" }, opts)).format(d);
  return t.charAt(0).toUpperCase() + t.slice(1);
}
function today() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date()); }

function renderDevis(d) {
  const c = d.contenu || {}, t = c.totaux || {}, lignes = c.lignes || [];
  const expired = d.valide_jusqu && d.valide_jusqu < today() && (d.statut === "nouveau" || d.statut === "envoye");
  const statut = expired ? "expire" : d.statut;
  const canAccept = statut === "nouveau" || statut === "envoye";
  const hasEx = lignes.some((l) => l.ex) || (t.livraison && t.livraison.ex);
  const remise = d.mode === "livraison"
    ? "Livraison" + (d.adresse ? " : " + d.adresse + ", " + (d.code_postal || "") + " " + (d.ville || d.commune || "") : d.commune ? " à " + d.commune : "")
    : "Retrait à la brasserie";

  const rows = lignes.map((l) =>
    "<tr><td><strong>" + esc(l.name) + "</strong>" + (l.ex ? ' <span class="ex">prix d\'exemple</span>' : "") +
    ((l.detail || []).length ? '<div class="det">' + l.detail.map(esc).join("<br>") + "</div>" : "") + "</td>" +
    '<td class="n">' + esc(l.qty) + '</td><td class="n">' + eur(l.pu) + '</td><td class="n">' + eur(l.ht) + '</td><td class="n">' + esc(l.tva) + " %" + (l.tvaMix ? "*" : "") + "</td></tr>"
  ).join("");

  const tot = [];
  if (t.remise) tot.push(["Remise (" + (t.codePromo || "") + ")", "− " + eur(t.remise) + " HT"]);
  if (t.livraison) tot.push([t.livraison.label, t.livraison.note || eur(t.livraison.ht) + " HT" + (t.livraison.ex ? " (exemple)" : "")]);
  tot.push(["Total HT", eur(d.total_ht)]);
  (t.tva || []).filter((r) => r.base).forEach((r) => tot.push(["TVA " + r.rate + " % (sur " + eur(r.base) + ")", eur(r.tva)]));
  const totHtml = tot.map((r) => "<tr><td>" + esc(r[0]) + '</td><td class="n">' + esc(r[1]) + "</td></tr>").join("") +
    '<tr class="ttc"><td>Total TTC</td><td class="n">' + eur(d.total_ttc) + "</td></tr>" +
    (d.convives ? '<tr class="pp"><td>Soit par personne</td><td class="n">' + eur(t.parPersonneHt) + " HT · " + eur(t.parPersonneTtc) + " TTC</td></tr>" : "") +
    '<tr class="acompte"><td>Acompte à la commande (' + esc(t.acomptePct || 40) + ' %)</td><td class="n">' + eur(d.acompte) + " TTC</td></tr>";

  const acceptBlock = canAccept
    ? '<div class="accept" id="valider"><div><strong>Votre devis vous convient ?</strong><p>Prévenez le gérant : il vous contacte pour faire le point. Rien n\'est validé avant cet échange, puis le règlement de l\'acompte (' + eur(d.acompte) + ' TTC) au restaurant, par virement ou carte bancaire.</p></div>' +
      '<button type="button" class="btn btn-main" id="accept-btn">Je souhaite valider ce devis</button><p class="msg" id="accept-msg" aria-live="polite"></p></div>'
    : '<div class="accept is-state" id="valider"><strong>' + esc(statut === "accepte" ? "Votre demande de validation a bien été transmise." : statut === "expire" ? "Ce devis a expiré." : "Statut du devis : " + (STATUTS[statut] || statut)) + "</strong>" +
      "<p>" + (statut === "accepte" ? "Le gérant vous contacte pour faire le point. La commande sera confirmée après le règlement de l'acompte (" + eur(d.acompte) + " TTC)." : "Pour toute question, appelez-nous au " + SOCIETE.telephone + ".") + "</p></div>";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Devis ${esc(d.numero)} | Bistro Burger</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Rubik:wght@500;600;700;800&family=Geologica:wght@400;500&display=swap">
<style>
  :root { --vert:#12574C; --vert9:#0E463D; --creme:#EDE0D3; --creme4:#F4ECE2; --terre:#B5651D; --texte:#1d252c; --gris:#5f6b74; --ligne:#e4dacd; }
  * { box-sizing:border-box; }
  body { margin:0; background:#e9e2d8; color:var(--texte); font-family:Geologica, Arial, sans-serif; font-size:14px; line-height:1.5; }
  .bar { position:sticky; top:0; z-index:5; background:var(--vert9); color:var(--creme); padding:12px max(16px, env(safe-area-inset-left)); display:flex; gap:10px; align-items:center; justify-content:center; flex-wrap:wrap; }
  .bar span { font-size:13px; opacity:.85; }
  .btn { font-family:Rubik, Arial, sans-serif; font-weight:600; font-size:14.5px; border-radius:10px; padding:11px 18px; border:2px solid var(--creme); background:transparent; color:var(--creme); cursor:pointer; text-decoration:none; }
  .btn-main { background:var(--terre); border-color:var(--terre); color:#fff; }
  .btn:disabled { opacity:.6; cursor:default; }
  .page { max-width:210mm; margin:24px auto 48px; background:#fff; box-shadow:0 8px 30px rgba(14,70,61,.15); }
  .head { background:var(--vert); color:var(--creme); padding:26px 30px; display:flex; justify-content:space-between; gap:20px; flex-wrap:wrap; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .head img { height:52px; width:auto; display:block; }
  .head .who { font-size:12px; line-height:1.6; opacity:.92; margin-top:10px; }
  .head .num { text-align:right; }
  .head .num .k { font-family:Rubik, Arial, sans-serif; font-size:12px; letter-spacing:2px; text-transform:uppercase; opacity:.8; }
  .head .num .v { font-family:Rubik, Arial, sans-serif; font-size:26px; font-weight:700; }
  .head .num .d { font-size:12.5px; opacity:.92; }
  .body { padding:24px 30px 30px; }
  .cols { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  .box { background:var(--creme4); border-radius:10px; padding:14px 16px; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .box h2 { font-family:Rubik, Arial, sans-serif; font-size:12px; letter-spacing:1.6px; text-transform:uppercase; color:var(--vert); margin:0 0 6px; }
  .box p { margin:0; }
  table.l { width:100%; border-collapse:collapse; margin-top:22px; }
  table.l th { font-family:Rubik, Arial, sans-serif; font-size:11.5px; letter-spacing:1px; text-transform:uppercase; color:var(--gris); text-align:left; border-bottom:2px solid var(--vert); padding:8px 6px; }
  table.l td { border-bottom:1px solid var(--ligne); padding:10px 6px; vertical-align:top; }
  .n { text-align:right; white-space:nowrap; }
  table.l th.n { text-align:right; }
  .det { color:var(--gris); font-size:12.5px; margin-top:3px; }
  .ex { display:inline-block; font-size:10.5px; color:var(--terre); border:1px solid var(--terre); border-radius:10px; padding:0 6px; margin-left:4px; }
  .totals { display:flex; justify-content:flex-end; margin-top:14px; }
  .totals table { min-width:320px; border-collapse:collapse; }
  .totals td { padding:5px 6px; }
  .totals .ttc td { font-family:Rubik, Arial, sans-serif; font-size:18px; font-weight:700; color:var(--vert9); border-top:2px solid var(--vert); padding-top:9px; }
  .totals .pp td, .totals .acompte td { color:var(--gris); font-size:13px; }
  .totals .acompte td { color:var(--terre); font-weight:600; }
  .notes { margin-top:22px; font-size:12.5px; color:var(--gris); }
  .notes h2 { font-family:Rubik, Arial, sans-serif; font-size:12px; letter-spacing:1.6px; text-transform:uppercase; color:var(--vert); margin:0 0 6px; }
  .notes ul { margin:0; padding-left:18px; }
  .sign { margin-top:22px; display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  .sign div { border:1px dashed #b9ada0; border-radius:10px; padding:12px 14px; min-height:96px; font-size:12.5px; color:var(--gris); }
  .foot { border-top:1px solid var(--ligne); padding:12px 30px 18px; font-size:11px; color:var(--gris); text-align:center; }
  .foot a { color:var(--vert); }
  .accept { max-width:210mm; margin:0 auto 24px; background:#fff; border-left:5px solid var(--terre); padding:18px 22px; display:grid; gap:12px; }
  .accept p { margin:4px 0 0; color:var(--gris); }
  .accept .btn-main { justify-self:start; }
  .accept .msg { margin:0; font-weight:600; color:var(--vert); }
  .preview { max-width:210mm; margin:0 auto; background:#fff3e2; color:#7a4a12; padding:10px 16px; font-size:13px; text-align:center; }
  @media (max-width:640px) {
    .page { margin:0 0 24px; }
    .head, .body { padding-left:16px; padding-right:16px; }
    .cols, .sign { grid-template-columns:1fr; }
    .head .num { text-align:left; }
    .tbl { overflow-x:auto; }
    .totals table { min-width:0; width:100%; }
    .accept { margin:0 0 24px; }
  }
  @page { size:A4; margin:12mm; }
  @media print {
    body { background:#fff; font-size:12px; }
    .bar, .accept, .preview { display:none !important; }
    .page { margin:0; box-shadow:none; max-width:none; }
    tr, .box, .sign { break-inside:avoid; }
  }
</style>
</head>
<body>
<div class="bar">
  <span>Devis ${esc(d.numero)}</span>
  <a class="btn" href="/devis-traiteur/d/${esc(d.token)}/pdf">Télécharger le PDF</a>
  ${canAccept ? '<a class="btn btn-main" href="#valider">Je souhaite valider ce devis</a>' : ""}
</div>
${hasEx ? '<div class="preview">Certains prix de ce devis sont des exemples : la carte traiteur définitive est en cours de finalisation.</div>' : ""}
<main class="page">
  <header class="head">
    <div>
      <img src="/assets/logo-cream-sm.png" alt="Bistro Burger">
      <div class="who">${esc(SOCIETE.adresse)}<br>${esc(SOCIETE.telephone)} · ${esc(SOCIETE.email)}<br>${esc(SOCIETE.site)}</div>
    </div>
    <div class="num">
      <div class="k">Devis traiteur</div>
      <div class="v">${esc(d.numero)}</div>
      <div class="d">Émis le ${esc(dateFr(String(d.created_at || "").slice(0, 10)))}<br>Valable jusqu'au ${esc(dateFr(d.valide_jusqu))}</div>
    </div>
  </header>
  <div class="body">
    <div class="cols">
      <div class="box">
        <h2>Client</h2>
        <p><strong>${esc(d.nom)}</strong>${d.societe ? "<br>" + esc(d.societe) : ""}${d.siret ? "<br>SIRET " + esc(d.siret) : ""}<br>${esc(TYPES[d.type_client] || "")}<br>${esc(d.telephone)}<br>${esc(d.email)}${d.facturation ? "<br><br>Facturation : " + esc(d.facturation) : ""}</p>
      </div>
      <div class="box">
        <h2>Événement</h2>
        <p><strong>${esc(dateFr(d.date_evenement, true))}${d.heure ? " à " + esc(d.heure) : ""}</strong><br>${esc(d.convives)} convive${d.convives > 1 ? "s" : ""}<br>${esc(remise)}</p>
      </div>
    </div>
    <div class="tbl">
    <table class="l">
      <thead><tr><th>Désignation</th><th class="n">Qté</th><th class="n">PU HT</th><th class="n">Total HT</th><th class="n">TVA</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    </div>
    ${lignes.some((l) => l.tvaMix) ? '<p class="det">* Ligne comprenant des options à un autre taux de TVA (détail dans les totaux).</p>' : ""}
    <div class="totals"><table>${totHtml}</table></div>
    ${d.remarques ? '<div class="notes"><h2>Remarques</h2><p>' + esc(d.remarques).replace(/\n/g, "<br>") + "</p></div>" : ""}
    <div class="notes">
      <h2>Conditions</h2>
      <ul>
        <li>Aucun devis n'est validé sans un échange préalable avec le gérant.</li>
        <li>La commande est confirmée par le règlement d'un acompte de ${esc(t.acomptePct || 40)} % (${eur(d.acompte)} TTC), par virement bancaire ou carte bancaire au restaurant. Le solde est réglé à la livraison ou au retrait.</li>
        <li>Commande au moins 96 h avant l'événement. Devis valable jusqu'au ${esc(dateFr(d.valide_jusqu))}, sous réserve de disponibilité à la date demandée.</li>
        <li>Liste des allergènes sur demande. Photos non contractuelles. Conditions d'annulation et de modification : voir nos <a href="/cgv.html">conditions générales de vente</a>.</li>
      </ul>
    </div>
    <div class="sign">
      <div>Date :</div>
      <div>Signature du client, précédée de la mention « Bon pour accord » :</div>
    </div>
  </div>
  <footer class="foot">${esc(SOCIETE.nom)} · ${esc(SOCIETE.raison)} · SIRET ${esc(SOCIETE.siret)} · TVA ${esc(SOCIETE.tva)}<br>${esc(SOCIETE.adresse)} · ${esc(SOCIETE.telephone)} · <a href="/cgv.html">CGV</a></footer>
</main>
${acceptBlock}
<script>
(function () {
  var p = document.getElementById("print-btn");
  if (p) p.addEventListener("click", function () { window.print(); });
  var b = document.getElementById("accept-btn"), m = document.getElementById("accept-msg");
  if (!b) return;
  b.addEventListener("click", function () {
    b.disabled = true; b.textContent = "Envoi…";
    fetch("/api/devis", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "accept", token: ${JSON.stringify(d.token)} }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (r) {
        if (!r.ok || !r.j.ok) { b.disabled = false; b.textContent = "Je souhaite valider ce devis"; m.textContent = r.j.error || "L'envoi n'a pas abouti. Appelez-nous au ${SOCIETE.telephone}."; return; }
        b.textContent = "Demande envoyée";
        m.textContent = "C'est noté : le gérant est prévenu et vous contacte pour faire le point.";
      })
      .catch(function () { b.disabled = false; b.textContent = "Je souhaite valider ce devis"; m.textContent = "Connexion impossible. Réessayez ou appelez-nous au ${SOCIETE.telephone}."; });
  });
})();
</script>
</body>
</html>`;
}

// Route /devis-traiteur/d/:token (server.js).
async function handle(req, res, notFound) {
  const token = String(req.params.token || "");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Cache-Control", "no-store");
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token) || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return notFound();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data, error } = await supabase.from("devis").select("*").eq("token", token).maybeSingle();
  if (error || !data) return notFound();
  // Trace dans l'admin : nombre d'ouvertures du lien (première ouverture ajoutée à l'historique).
  try {
    const patch = { ouvertures: (Number(data.ouvertures) || 0) + 1, derniere_ouverture: new Date().toISOString() };
    if (!data.ouvertures) patch.historique = (Array.isArray(data.historique) ? data.historique : []).concat([{ at: patch.derniere_ouverture, quoi: "Lien du devis ouvert pour la première fois" }]);
    await supabase.from("devis").update(patch).eq("id", data.id);
  } catch {}
  res.type("html").send(renderDevis(data));
}

// Route /devis-traiteur/d/:token/pdf : le même devis en fichier PDF (lib/pdfDevis.js).
async function handlePdf(req, res, notFound) {
  const token = String(req.params.token || "");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Cache-Control", "no-store");
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token) || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return notFound();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data, error } = await supabase.from("devis").select("*").eq("token", token).maybeSingle();
  if (error || !data) return notFound();
  const att = require("./pdfDevis").devisAttachment(data);
  if (!att) return notFound();
  res.setHeader("Content-Disposition", 'attachment; filename="' + att.filename + '"');
  res.type("application/pdf").send(Buffer.from(att.content, "base64"));
}

module.exports = { renderDevis, handle, handlePdf, STATUTS };
