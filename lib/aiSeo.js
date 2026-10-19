"use strict";
// Rendre l'accueil lisible par Google ET par les IA (ChatGPT, Claude, Gemini, Perplexity…).
// Beaucoup de robots n'exécutent pas le JavaScript : ils ne voyaient donc ni le plat du jour,
// ni la carte, ni la FAQ, ni les avis. Ici le serveur écrit ces contenus dans le code de la page
// (en texte simple, échappé). Le JavaScript du site les remplace ensuite par la version mise en
// forme : les visiteurs ne voient aucune différence, les robots lisent les vrais contenus.
const content = require("../public/site-content.js");
const BBHours = require("../public/hours.js");
const blogSeo = require("./blogSeo");

const DEFAULT_ORIGIN = "https://bistroburgergardanne.com";

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

function isPlaceholder(s) {
  return /à confirmer/i.test(String(s || ""));
}

function frDateLong(iso) {
  try {
    const s = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(new Date(iso + "T00:00:00"));
    return s.charAt(0).toUpperCase() + s.slice(1);
  } catch {
    return String(iso || "");
  }
}

function nl2br(s) {
  return esc(s).replace(/\n/g, "<br>");
}

/* ------------------------- 1. Plat du jour ------------------------- */

// Remplace le plat du jour « de secours » écrit dans la page (périmé) par celui de l'admin.
function patchPlatDuJour(html, data) {
  const d = data && data.plat_du_jour;
  const plat = d && d.plat;
  if (!plat || !plat.title) return html;
  const meta = plat.date ? frDateLong(plat.date) + (plat.horaire ? " · " + plat.horaire : "") : plat.meta || plat.horaire || "";
  const setText = (re, text) => {
    html = html.replace(re, (m, a, b) => (text ? a + esc(text) + b : m));
  };
  setText(/(<span id="pdj-meta"[^>]*>)[^<]*(<\/span>)/, meta);
  setText(/(<h3 id="pdj-title"[^>]*>)[^<]*(<\/h3>)/, plat.title);
  setText(/(<span id="pdj-price"[^>]*>)[^<]*(<\/span>)/, plat.price);
  if (plat.description) {
    html = html.replace(/<p id="pdj-desc" hidden( [^>]*>)[^<]*(<\/p>)/, (m, a, b) => '<p id="pdj-desc"' + a + esc(plat.description) + b);
  }
  const sug = Array.isArray(d.suggestions) ? d.suggestions[0] : d.suggestion;
  if (sug) {
    setText(/(<h3 id="sug-title"[^>]*>)[^<]*(<\/h3>)/, sug.title);
    setText(/(<p id="sug-desc"[^>]*>)[^<]*(<\/p>)/, sug.description);
    setText(/(<span id="sug-price"[^>]*>)[^<]*(<\/span>)/, sug.price);
  }
  return html;
}

/* ------------------------------ 2. Carte ------------------------------ */

function burgersHtml(data) {
  const fams = Array.isArray(data && data.burgers) ? data.burgers : [];
  if (!fams.length) return "";
  return (
    "<div>" +
    fams
      .map((fam) => {
        const items = (fam.items || []).filter((b) => b && b.name);
        if (!items.length) return "";
        return (
          "<h3>" + esc(fam.title || "Nos burgers") + "</h3><ul>" +
          items
            .map((b) => {
              const prix = [];
              if (b.sur && !isPlaceholder(b.sur)) prix.push("sur place " + esc(b.sur));
              if (b.emp && !isPlaceholder(b.emp)) prix.push("à emporter " + esc(b.emp));
              return "<li><strong>" + esc(b.name) + "</strong>" + (b.desc ? " : " + esc(b.desc) : "") + (prix.length ? " (" + prix.join(", ") + ")" : "") + "</li>";
            })
            .join("") +
          "</ul>"
        );
      })
      .join("") +
    "</div>"
  );
}

function carteHtml(data) {
  const cartes = data && data.cartes;
  if (!cartes || typeof cartes !== "object") return "";
  let out = "";
  for (const mode of Object.keys(cartes)) {
    const tabs = cartes[mode];
    if (!tabs || typeof tabs !== "object") continue;
    out += "<h3>Carte " + esc(String(mode).toLowerCase()) + "</h3>";
    for (const tab of Object.keys(tabs)) {
      const groups = Array.isArray(tabs[tab]) ? tabs[tab] : [];
      for (const g of groups) {
        const items = (g.items || []).filter((it) => it && it.name && !isPlaceholder(it.price) && !isPlaceholder(it.desc));
        if (!items.length) continue;
        out += "<h4>" + esc(tab) + (g.title ? " : " + esc(g.title) : "") + (g.price && !isPlaceholder(g.price) ? " (" + esc(g.price) + ")" : "") + "</h4>";
        if (g.note && !isPlaceholder(g.note)) out += "<p>" + esc(g.note) + "</p>";
        out +=
          "<ul>" +
          items
            .map((it) => "<li><strong>" + esc(it.name) + "</strong>" + (it.desc && !isPlaceholder(it.desc) ? " : " + esc(it.desc) : "") + (it.price && !isPlaceholder(it.price) ? " — " + esc(it.price) : "") + "</li>")
            .join("") +
          "</ul>";
      }
    }
  }
  return out ? "<div>" + out + "</div>" : "";
}

/* ------------------------------ 3. FAQ ------------------------------ */

function faqItems(data) {
  const hours = BBHours.normalize(data && data.horaires);
  return content.faq.map((f) => (f.q === "Quels sont vos horaires ?" ? { q: f.q, a: BBHours.faqText(hours) } : f));
}

function faqHtml(data) {
  return "<div>" + faqItems(data).map((f) => "<h3>" + esc(f.q) + "</h3><p>" + nl2br(f.a) + "</p>").join("") + "</div>";
}

// Données structurées FAQPage : uniquement les réponses définitives (pas celles marquées « à confirmer »).
function faqJsonLd(data) {
  const entries = faqItems(data)
    .filter((f) => !isPlaceholder(f.a))
    .map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: String(f.a).replace(/\n+/g, " ").trim() } }));
  if (!entries.length) return "";
  const json = JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: entries }).replace(/</g, "\\u003c");
  return '<script type="application/ld+json" data-ssr="faq">' + json + "</script>";
}

/* ------------------------------ 4. Avis ------------------------------ */

function reviewsHtml() {
  return (
    "<div>" +
    content.reviews
      .map((r) => "<figure><blockquote>" + esc(r.text) + "</blockquote><figcaption>" + esc(r.name) + " — " + esc(r.meta) + "</figcaption></figure>")
      .join("") +
    "</div>"
  );
}

/* --------------------- Assemblage pour la page d'accueil --------------------- */

function fillContainer(html, openTagRe, inner) {
  if (!inner) return html;
  return html.replace(openTagRe, (m, open) => open + inner + "</div>");
}

function enhanceHome(html, data) {
  let out = patchPlatDuJour(html, data);
  out = fillContainer(out, /(<div data-burger-track id="burger-track"[^>]*>)<\/div>/, burgersHtml(data));
  out = fillContainer(out, /(<div id="carte-groups"[^>]*>)<\/div>/, carteHtml(data));
  out = fillContainer(out, /(<div id="faq-list"[^>]*>)<\/div>/, faqHtml(data));
  out = fillContainer(out, /(<div id="reviews-grid"[^>]*>)<\/div>/, reviewsHtml());
  const ld = faqJsonLd(data);
  if (ld) out = out.replace(/<\/head>/i, () => ld + "</head>");
  return out;
}

/* ----------------------------- 5. llms.txt ----------------------------- */

// Résumé du restaurant à l'intention des IA : uniquement des faits vérifiés, horaires toujours à jour.
function llmsTxt(data, origin) {
  origin = origin || DEFAULT_ORIGIN;
  const hours = BBHours.normalize(data && data.horaires);
  const lines = [];
  lines.push("# Bistro Burger, restaurant à Gardanne (ZAC Avon)");
  lines.push("");
  lines.push("> Restaurant de burgers faits maison, plat du jour du lundi au vendredi et produits frais, dans la ZAC Avon à Gardanne (Bouches-du-Rhône). Réservation en ligne ou par téléphone.");
  lines.push("");
  lines.push("## Informations pratiques");
  lines.push("- Nom : Bistro Burger");
  lines.push("- Adresse : ZAC Avon, Bretelle de la Plaine, 13120 Gardanne, France");
  lines.push("- Téléphone : 04 65 84 89 18");
  lines.push("- Site officiel : " + origin + "/");
  lines.push("- Situation : ZAC Avon, entre Aix-en-Provence et Marseille");
  lines.push("- Services : sur place, à emporter, petit-déjeuner dès 9h en semaine, déjeuner, dîner du mardi au vendredi, service traiteur (repas d'entreprise, réunions, séminaires, événements)");
  lines.push("- Commande et livraison : par téléphone (04 65 84 89 18) pour une livraison par notre équipe ou à emporter ; également sur Uber Eats : https://www.ubereats.com/fr/store/bistro-burger/GhyJ8Z0PUdGdunxL5RmtEQ");
  lines.push("- Parking : gratuit, directement devant le restaurant");
  lines.push("- Avis : noté 5/5 par plus de 200 clients sur Google");
  lines.push("- Horaires :");
  BBHours.longLines(hours).forEach((l) => lines.push("  - " + l));
  const plat = data && data.plat_du_jour && data.plat_du_jour.plat;
  if (plat && plat.title) {
    lines.push("- Plat du jour (" + (plat.date ? frDateLong(plat.date) : "aujourd'hui") + ") : " + plat.title + (plat.price ? ", " + plat.price : ""));
  }
  lines.push("");
  lines.push("## Pages principales");
  lines.push("- [Accueil, carte, plat du jour, réservation](" + origin + "/)");
  lines.push("- [Service traiteur : plats faits maison à emporter pour repas d'entreprise, réunions et événements](" + origin + "/traiteur)");
  lines.push("- [Blog](" + origin + "/blog/index.html)");
  const posts = data && data.blog && Array.isArray(data.blog.posts) ? data.blog.posts.filter((p) => p && p.published !== false && p.slug && p.title && !blogSeo.MOVED_SLUGS[p.slug]) : [];
  posts.forEach((p) => lines.push("- [" + String(p.title).replace(/[\[\]]/g, "") + "](" + origin + "/blog/" + p.slug + ".html)" + (p.excerpt ? " : " + String(p.excerpt).replace(/\s+/g, " ").trim() : "")));
  lines.push("");
  lines.push("## Contact et réseaux");
  lines.push("- Instagram : https://www.instagram.com/bistroburger_gardanne/");
  lines.push("- Facebook : https://www.facebook.com/p/Bistro-Burger-Gardanne-61558024659752/");
  lines.push("");
  return lines.join("\n");
}

module.exports = { enhanceHome, llmsTxt, patchPlatDuJour, burgersHtml, carteHtml, faqHtml, faqJsonLd, reviewsHtml, isPlaceholder };
