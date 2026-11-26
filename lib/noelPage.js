"use strict";
// Page « Noël au Bistro » : contenu modifiable depuis l'admin (rubrique « Page Noël », clé site_content « noel »).
// noel = {
//   visible: true|false,                 // false : la page répond « introuvable » (à masquer début janvier)
//   textes: { fetes_prix: "45", ... },   // remplacent les cases [à compléter] marquées data-noel="…"
//   docs: { "menu-fetes": { url, nom, taille, maj }, ... }  // PDF déposés dans Supabase Storage (site-docs)
// }
// Les PDF gardent une adresse fixe (/noel/menu-de-fetes.pdf…) : on remplace le fichier, le lien ne change pas.

// Clé du document → nom de fichier public (adresse fixe, partagée dans les stories).
const DOCS = {
  "menu-fetes": "menu-de-fetes.pdf",
  "listing-traiteur": "listing-traiteur-noel.pdf",
  "emporter": "menu-noel-a-emporter.pdf",
  "buffet": "buffet-du-lendemain.pdf",
};

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function isVisible(noel) {
  return !(noel && noel.visible === false);
}

// Remplace chaque case <span class="nl-todo" data-noel="clé">[…]</span> par le texte saisi dans l'admin
// (les cases vides restent affichées « à compléter »). Ajoute le prix du menu de fêtes aux données Google.
function render(html, noel) {
  const textes = (noel && noel.textes) || {};
  let out = html.replace(/<span class="nl-todo" data-noel="([a-z_]+)">[^<]*<\/span>/g, (m, key) => {
    const v = String(textes[key] == null ? "" : textes[key]).trim();
    if (!v) return m;
    return '<span data-noel="' + key + '">' + esc(v).replace(/\r?\n/g, "<br>") + "</span>";
  });
  const prix = parseFloat(String(textes.fetes_prix || "").replace(",", "."));
  if (prix > 0) {
    const offer = ',"offers":{"@type":"Offer","price":"' + prix.toFixed(2) + '","priceCurrency":"EUR","availability":"https://schema.org/InStock","url":"https://bistroburgergardanne.com/noel#fetes"}';
    out = out.replace(/("@type":"Event","name":"Menu de fêtes au Bistro Burger"[^\n]*?"organizer":\{[^}]*\})/g, "$1" + offer);
  }
  return out;
}

// Adresse fixe /noel/<fichier>.pdf → fichier actuel dans Supabase Storage (null si pas encore déposé).
function docTarget(file, noel) {
  const key = Object.keys(DOCS).find((k) => DOCS[k] === file);
  const d = key && noel && noel.docs && noel.docs[key];
  if (!d || !d.url) return null;
  return d.url + (d.maj ? (d.url.indexOf("?") > -1 ? "&" : "?") + "v=" + encodeURIComponent(d.maj) : "");
}

module.exports = { DOCS, isVisible, render, docTarget };
