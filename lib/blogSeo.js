"use strict";
// Référencement des articles de blog : le modèle pages/blog/article.html est commun à
// tous les articles et se remplit en JavaScript. Google lit d'abord le code brut :
// sans ce module, il voyait pour chaque article le même titre générique et une balise
// canonique pointant vers la page « blog » (donc des doublons non indexés).
// Ici le serveur y injecte, pour chaque article, son vrai titre, sa description, sa
// balise canonique, ses données structurées et son texte (en texte simple, échappé).
// Le JavaScript du site remplace ensuite ce texte par la version complète mise en forme.

const DEFAULT_ORIGIN = "https://bistroburgergardanne.com";

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

function decodeEntities(s) {
  return String(s)
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&");
}

// Texte brut de l'article, sous forme de blocs : "## Titre" pour un intertitre, sinon un paragraphe.
function bodyToBlocks(body) {
  // Un article réel fait quelques milliers de caractères : on plafonne pour borner le coût.
  let s = String(body || "").slice(0, 60000).replace(/\r/g, "");
  const isHtml = /<(p|h[2-4]|ul|ol|blockquote|img|strong|em|a|br)[\s>\/]/i.test(s);
  if (isHtml) {
    // Les quantificateurs sont bornés ({0,n}) : un texte mal formé (milliers de balises
    // jamais fermées) ne doit pas pouvoir ralentir le serveur.
    s = s
      .replace(/<(script|style)[\s\S]{0,5000}?<\/\1>/gi, "")
      .replace(/<h[2-4][^>]{0,300}>([\s\S]{0,3000}?)<\/h[2-4]>/gi, (m, t) => "\n\n## " + t.replace(/<[^>]{0,500}>/g, "").trim() + "\n\n")
      .replace(/<br\s{0,10}\/?>/gi, "\n")
      .replace(/<li[^>]{0,300}>/gi, "• ")
      .replace(/<\/(p|li|blockquote|ul|ol|div)>/gi, "\n\n")
      .replace(/<[^>]{0,500}>/g, "");
    s = decodeEntities(s);
  } else {
    s = s.replace(/\*\*(.+?)\*\*/g, "$1");
  }
  return s
    .split(/\n{2,}/)
    .map((b) => b.replace(/[ \t]+/g, " ").replace(/ ?\n ?/g, "\n").trim())
    .filter(Boolean);
}

function blocksToHtml(blocks) {
  return blocks
    .map((b) => (b.startsWith("## ") ? "<h2>" + esc(b.slice(3)) + "</h2>" : "<p>" + esc(b).replace(/\n/g, "<br>") + "</p>"))
    .join("");
}

function blocksToPlainText(blocks) {
  return blocks.map((b) => (b.startsWith("## ") ? b.slice(3) : b)).join("\n\n");
}

function findPost(data, slug) {
  const blog = data && data.blog;
  if (!blog || !Array.isArray(blog.posts)) return { known: false, post: null };
  const post = blog.posts.find((p) => p && p.published !== false && p.slug === slug) || null;
  return { known: true, post };
}

function replaceOnce(html, re, replacement) {
  return re.test(html) ? html.replace(re, () => replacement) : html;
}

function renderArticleHtml(template, post, origin) {
  origin = origin || DEFAULT_ORIGIN;
  const url = origin + "/blog/" + post.slug + ".html";
  const imgAbs = post.img
    ? /^https?:\/\//.test(post.img) ? post.img : origin + "/" + String(post.img).replace(/^\//, "")
    : origin + "/assets/hero-burger.webp";
  const desc = post.seoDesc || post.excerpt || post.title;
  const pageTitle = post.seoTitle || post.title + " — Blog Bistro Burger";
  const blocks = bodyToBlocks(post.body);

  const ld = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    headline: post.seoTitle || post.title,
    description: desc,
    image: imgAbs,
    datePublished: post.date,
    dateModified: post.date,
    inLanguage: "fr-FR",
    author: { "@type": "Organization", name: "Bistro Burger" },
    publisher: { "@type": "Organization", name: "Bistro Burger", logo: { "@type": "ImageObject", url: origin + "/icon-512.png" } },
  };
  if (blocks.length) ld.articleBody = blocksToPlainText(blocks).slice(0, 5000);
  // "<" échappé pour qu'aucune balise ne puisse sortir du bloc JSON.
  const ldJson = JSON.stringify(ld).replace(/</g, "\\u003c");

  let html = String(template);
  html = replaceOnce(html, /<title>[\s\S]*?<\/title>/i, "<title>" + esc(pageTitle) + "</title>");
  html = replaceOnce(html, /<meta name="description" content="[^"]*">/i, '<meta name="description" content="' + esc(desc) + '">');
  html = replaceOnce(html, /<link rel="canonical" href="[^"]*">/i, '<link rel="canonical" href="' + esc(url) + '">');
  html = replaceOnce(html, /<meta property="og:title" content="[^"]*">/i, '<meta property="og:title" content="' + esc(pageTitle) + '">');
  html = replaceOnce(html, /<meta property="og:description" content="[^"]*">/i, '<meta property="og:description" content="' + esc(desc) + '">');
  html = replaceOnce(html, /<meta property="og:url" content="[^"]*">/i, '<meta property="og:url" content="' + esc(url) + '">');
  html = replaceOnce(html, /<meta property="og:image" content="[^"]*">/i, '<meta property="og:image" content="' + esc(imgAbs) + '">');
  html = html.replace(/<\/head>/i, () => '<script type="application/ld+json" data-ssr="1">' + ldJson + "</script></head>");
  html = replaceOnce(
    html,
    /<div id="article-root"><p class="article-body">Chargement…<\/p><\/div>/,
    '<div id="article-root"><h1 class="article-title">' + esc(post.title) + '</h1><div class="article-body">' + blocksToHtml(blocks) + "</div></div>"
  );
  return html;
}

module.exports = { findPost, renderArticleHtml, bodyToBlocks };
