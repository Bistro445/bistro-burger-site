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

// Anciennes adresses d'articles que Google connaît encore : elles redirigent (301) vers la bonne.
// Ajouter une ligne ici quand on renomme l'adresse d'un article déjà publié.
const LEGACY_SLUGS = {
  "regarder-om-gardanne": "regarder-om-a-gardanne",
};

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

/* ---------------- Liens vers les articles (maillage interne) ---------------- */
// Google doit voir les liens vers les articles dans le code brut de l'accueil et de la
// page « blog » (sinon ils n'apparaissent qu'après exécution du JavaScript).

function publishedPosts(data) {
  const blog = data && data.blog;
  if (!blog || !Array.isArray(blog.posts)) return [];
  return blog.posts
    .filter((p) => p && p.published !== false && p.slug && p.title)
    .slice()
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
}

function frDate(iso) {
  try {
    return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso + "T00:00:00"));
  } catch {
    return String(iso || "");
  }
}

function readMinutes(post) {
  return Math.max(1, Math.round(String(post.body || "").replace(/<[^>]{0,500}>/g, " ").split(/\s+/).filter(Boolean).length / 200));
}

function imgUrl(img) {
  if (!img) return "";
  return /^https?:\/\//.test(img) ? img : "/" + String(img).replace(/^\//, "");
}

// Liste simple de tous les articles, placée dans #blog-sections (le JavaScript du site la remplace par les cartes).
function blogIndexListHtml(data) {
  const posts = publishedPosts(data);
  if (!posts.length) return "";
  return (
    "<ul>" +
    posts
      .map((p) => '<li><a href="/blog/' + esc(p.slug) + '.html"><strong>' + esc(p.title) + "</strong></a>" + (p.excerpt ? " — " + esc(p.excerpt) : "") + "</li>")
      .join("") +
    "</ul>"
  );
}

function renderBlogIndexHtml(template, data) {
  const list = blogIndexListHtml(data);
  if (!list) return String(template);
  return String(template).replace(/<div id="blog-sections"><\/div>/, () => '<div id="blog-sections">' + list + "</div>");
}

// Section « Nos derniers articles » de la page d'accueil (3 articles récents).
function homeLatestHtml(data) {
  const posts = publishedPosts(data).slice(0, 3);
  if (!posts.length) return "";
  const cards = posts
    .map((p) =>
      '<a class="blog-post" href="/blog/' + esc(p.slug) + '.html">' +
      (p.img
        ? '<div class="blog-post-img"><img loading="lazy" decoding="async" src="' + esc(imgUrl(p.img)) + '" alt="' + esc(p.imgAlt || p.title) + '"></div>'
        : "") +
      (p.category ? '<span class="blog-cat blog-cat-soft">' + esc(p.category) + "</span>" : "") +
      "<h3>" + esc(p.title) + "</h3>" +
      (p.excerpt ? "<p>" + esc(p.excerpt) + "</p>" : "") +
      '<div class="blog-meta">' + esc(frDate(p.date)) + " &bull; " + readMinutes(p) + " min de lecture</div></a>"
    )
    .join("");
  return (
    '<section id="blog-apercu" style="background:linear-gradient(180deg,var(--surface-alt),var(--cream-400)); padding:90px 24px 100px;">' +
    '<div style="max-width:1240px; margin:0 auto;">' +
    '<h2 class="blog-section-title" style="margin-top:0;">Nos derniers articles</h2>' +
    '<p style="max-width:640px; font-size:16px; line-height:1.6; color:#3F3F3B; margin:-12px 0 36px;">Nos conseils, nos nouveautés et les coulisses du Bistro Burger, à Gardanne.</p>' +
    '<div class="blog-grid">' + cards + "</div>" +
    '<p style="margin:40px 0 0; text-align:center;"><a href="/blog/index.html" style="font-family:var(--font-heading); font-weight:700; font-size:16px; color:var(--green-700); text-decoration:underline; text-underline-offset:4px;">Voir tous les articles du blog</a></p>' +
    "</div></section>"
  );
}

module.exports = { findPost, renderArticleHtml, bodyToBlocks, renderBlogIndexHtml, homeLatestHtml, LEGACY_SLUGS };
