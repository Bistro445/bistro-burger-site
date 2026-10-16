"use strict";
// Serveur du site Bistro Burger : sert les pages statiques (public/), monte
// automatiquement chaque fonction du dossier api/ comme route (api/orders.js
// -> /api/orders, api/seo/index.js -> /api/seo) et fournit en mémoire les
// fichiers de données générés depuis Supabase.
const path = require("path");
const fs = require("fs");
const express = require("express");
const compression = require("compression");
const siteData = require("./lib/siteDataStore");
const { buildConfigFiles } = require("./lib/siteData");
const blogSeo = require("./lib/blogSeo");
const aiSeo = require("./lib/aiSeo");

const PUBLIC_DIR = path.join(__dirname, "public");
// Les pages HTML du site sont hors de public/ : Hostinger sert directement le contenu de public/
// sans passer par ce serveur, ce qui contournerait le mode maintenance.
const PAGES_DIR = path.join(__dirname, "pages");
const API_DIR = path.join(__dirname, "api");
const PORT = process.env.PORT || 3000;

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(compression());

// Mode maintenance (désactivé par défaut) : si la variable d'environnement MAINTENANCE_MODE vaut "true",
// les visiteurs voient une page "site en maintenance" (code 503,
// non indexée). /admin, /app, /seo et /api restent accessibles. Le propriétaire
// valide le vrai site via /preview/<PREVIEW_KEY> (cookie de 30 jours).
const MAINTENANCE = process.env.MAINTENANCE_MODE === "true";
const PREVIEW_KEY = process.env.PREVIEW_KEY || "7406d42b821ef2f161a6c36ba810d6d0beb5";
const MAINTENANCE_HTML = require("./lib/maintenancePage");

app.use((req, res, next) => {
  if (MAINTENANCE) res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  if (req.secure) res.setHeader("Strict-Transport-Security", "max-age=31536000");
  next();
});

// Une seule adresse pour le site : « www. » est redirigé (301) vers le domaine sans « www »,
// pour éviter que Google voie deux copies du même site.
const SITE_HOST = (() => {
  try { return new URL(process.env.SITE_URL || "https://bistroburgergardanne.com").hostname.replace(/^www\./, ""); }
  catch { return "bistroburgergardanne.com"; }
})();
app.use((req, res, next) => {
  if (req.hostname === "www." + SITE_HOST) return res.redirect(301, "https://" + SITE_HOST + req.originalUrl);
  next();
});

app.use(express.json({ limit: "2mb" }));

if (MAINTENANCE) {
  const hasPreviewCookie = (req) => {
    const m = /(?:^|;\s*)bb_preview=([^;]+)/.exec(req.headers.cookie || "");
    return !!m && decodeURIComponent(m[1]) === PREVIEW_KEY;
  };
  app.get("/preview/:key", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (req.params.key === "off") {
      res.clearCookie("bb_preview", { path: "/" });
      return res.redirect("/");
    }
    if (req.params.key !== PREVIEW_KEY) return res.status(404).type("text/plain").send("Not found");
    res.cookie("bb_preview", PREVIEW_KEY, { httpOnly: true, sameSite: "lax", secure: !!req.secure, path: "/", maxAge: 30 * 24 * 3600 * 1000 });
    return res.redirect("/");
  });
  const OPEN_PREFIXES = /^\/(api|admin|app|seo)(\/|$)/;
  const OPEN_PATHS = new Set(["/healthz", "/robots.txt", "/assets/logo-cream-sm.png"]);
  app.use((req, res, next) => {
    if (OPEN_PREFIXES.test(req.path) || OPEN_PATHS.has(req.path) || hasPreviewCookie(req)) return next();
    res.status(503).set({ "Retry-After": "86400", "Cache-Control": "no-store" }).type("html").send(MAINTENANCE_HTML);
  });
}

/* ---------------------------- Fonctions API ---------------------------- */

function collectApiRoutes(dir, prefix) {
  const routes = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith("_")) continue; // _lib : code partagé, pas une route
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      routes.push(...collectApiRoutes(full, prefix + "/" + entry.name));
    } else if (entry.name.endsWith(".js")) {
      const base = entry.name.slice(0, -3);
      routes.push({ route: base === "index" ? prefix : prefix + "/" + base, file: full });
    }
  }
  return routes;
}

for (const { route, file } of collectApiRoutes(API_DIR, "/api")) {
  const handler = require(file);
  app.all(route, (req, res) => {
    Promise.resolve(handler(req, res)).catch((err) => {
      console.error("[" + route + "] " + (err && err.stack ? err.stack : err));
      if (!res.headersSent) res.status(500).json({ error: "Erreur serveur." });
    });
  });
  console.log("Route API : " + route);
}

app.use("/api", (req, res) => res.status(404).json({ error: "Route introuvable." }));

/* ------------------- Fichiers générés (données du site) ------------------- */

function serveGenerated(pick, fallback) {
  return async (req, res, next) => {
    try {
      const content = pick(await siteData.getFiles());
      if (content == null) return next(); // rien de généré : on laisse le fichier statique éventuel répondre
      res.setHeader("Cache-Control", "no-cache");
      return res.type(fallback.type).send(content);
    } catch (err) {
      // Supabase injoignable et rien en mémoire : le site retombe sur son contenu de secours.
      if (fallback.body == null) return next();
      res.setHeader("Cache-Control", "no-store");
      return res.type(fallback.type).send(fallback.body);
    }
  };
}

const JS = { type: "application/javascript", body: "window.SITE_DATA = {};\n" };
app.get("/data.generated.js", serveGenerated((f) => f.dataJs, JS));
// La configuration publique ne dépend que des variables d'environnement (pas de Supabase).
function serveConfig(pick) {
  return (req, res, next) => {
    const content = pick(buildConfigFiles(process.env));
    if (content == null) return next();
    res.setHeader("Cache-Control", "no-cache");
    return res.type("application/javascript").send(content);
  };
}
app.get("/admin/config.generated.js", serveConfig((f) => f.adminConfigJs));
app.get("/app/config.generated.js", serveConfig((f) => f.appConfigJs));
if (MAINTENANCE) {
  app.get("/robots.txt", (req, res) => res.type("text/plain").send("User-agent: *\nAllow: /\n"));
  app.get("/sitemap.xml", (req, res) => res.status(404).type("text/plain").send("Not found"));
}
app.get("/sitemap.xml", serveGenerated((f) => f.sitemapXml, { type: "application/xml", body: null }));

/* ------------------------------ Pages statiques ------------------------------ */

const PROCESS_STARTED_AT = new Date().toISOString();
app.get("/healthz", (req, res) =>
  res.json({
    ok: true,
    processStartedAt: PROCESS_STARTED_AT,
    lastDataRefresh: siteData.getLastBuildAt(),
    lastDataError: siteData.getLastError() ? siteData.getLastError().message : null,
  })
);

// Page d'accueil : les horaires des données structurées Google (JSON-LD) sont
// générés à partir des horaires enregistrés dans l'admin.
const BBHours = require("./public/hours.js");
const HOME_HTML_PATH = path.join(PAGES_DIR, "index.html");
const HOURS_LD_RE = /"openingHoursSpecification":\s*\[[\s\S]*?\n\s*\],/;
// /llms.txt : résumé du restaurant pour les IA (horaires et plat du jour toujours à jour).
app.get("/llms.txt", async (req, res) => {
  try {
    const files = await siteData.getFiles();
    res.setHeader("Cache-Control", "no-cache");
    res.type("text/plain; charset=utf-8").send(aiSeo.llmsTxt(files.data, process.env.SITE_URL));
  } catch (err) {
    res.status(503).type("text/plain").send("Indisponible");
  }
});

// /index.html est la même page que « / » : redirection définitive (évite un doublon dans Google).
app.get("/index.html", (req, res) => res.redirect(301, "/" + req.url.slice("/index.html".length)));
app.get("/", async (req, res, next) => {
  try {
    const files = await siteData.getFiles();
    const hours = BBHours.normalize(files.data && files.data.horaires);
    const specs = JSON.stringify(BBHours.schemaSpecs(hours), null, 2).replace(/\n/g, "\n  ");
    let html = fs
      .readFileSync(HOME_HTML_PATH, "utf8")
      .replace(HOURS_LD_RE, () => '"openingHoursSpecification": ' + specs + ",")
      // Section « Nos derniers articles » : liens vers les articles visibles dans le code brut.
      .replace("<!--BLOG_LATEST-->", () => blogSeo.homeLatestHtml(files.data));
    // Plat du jour, carte, FAQ et avis écrits dans le code de la page, pour Google et les IA.
    html = aiSeo.enhanceHome(html, files.data);
    res.setHeader("Cache-Control", "no-cache");
    res.type("html").send(html);
  } catch (err) {
    next();
  }
});

// Page « blog » : la liste des articles est injectée dans le code brut (liens internes vers
// chaque article visibles par Google sans JavaScript). /blog redirige vers /blog/.
const BLOG_INDEX_PATH = path.join(PAGES_DIR, "blog", "index.html");
app.get("/blog", (req, res, next) => (req.originalUrl.split("?")[0] === "/blog" ? res.redirect(301, "/blog/") : next()));
app.get(["/blog/", "/blog/index.html"], async (req, res, next) => {
  try {
    const files = await siteData.getFiles();
    const html = blogSeo.renderBlogIndexHtml(fs.readFileSync(BLOG_INDEX_PATH, "utf8"), files.data);
    res.setHeader("Cache-Control", "no-cache");
    return res.type("html").send(html);
  } catch (err) {
    next();
  }
});

// La carte vit sur l'accueil (section #carte). Il n'y a pas de page /carte : si Google ou un lien la connaît,
// redirection définitive vers l'accueil.
app.get(["/carte", "/carte.html", "/carte/"], (req, res) => res.redirect(301, "/"));

app.use("/assets", express.static(path.join(PUBLIC_DIR, "assets"), { maxAge: "1d", dotfiles: "ignore" }));
app.use(express.static(PAGES_DIR, { dotfiles: "ignore" }));
app.use(
  express.static(PUBLIC_DIR, {
    dotfiles: "ignore",
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".webmanifest")) res.type("application/manifest+json");
    },
  })
);

// Articles de blog : /blog/mon-article -> modèle unique (équivalent de la réécriture Vercel).
// Le serveur y injecte le titre, la description, la canonique et le texte de l'article pour
// que Google les lise dans le code brut (voir lib/blogSeo.js). Si les données ne sont pas
// disponibles, on retombe sur le modèle seul (le JavaScript remplit alors la page).
const ARTICLE_TEMPLATE_PATH = path.join(PAGES_DIR, "blog", "article.html");
const articleCache = new Map(); // slug -> { sig, html } : l'article n'est recalculé que s'il change
app.get("/blog/:slug", async (req, res) => {
  try {
    const slug = decodeURIComponent(req.params.slug).replace(/\.html$/i, "");
    const files = await siteData.getFiles();
    const { known, post } = blogSeo.findPost(files.data, slug);
    if (known && !post) {
      const target = blogSeo.LEGACY_SLUGS[slug];
      if (target && blogSeo.findPost(files.data, target).post) return res.redirect(301, "/blog/" + target + ".html");
      return res.status(404).sendFile(path.join(PAGES_DIR, "404.html"));
    }
    if (!post) return res.sendFile(ARTICLE_TEMPLATE_PATH);
    const sig = JSON.stringify([post.title, post.seoTitle, post.seoDesc, post.excerpt, post.img, post.date, post.body]);
    let cached = articleCache.get(slug);
    if (!cached || cached.sig !== sig) {
      cached = { sig, html: blogSeo.renderArticleHtml(fs.readFileSync(ARTICLE_TEMPLATE_PATH, "utf8"), post, process.env.SITE_URL) };
      if (articleCache.size > 200) articleCache.clear();
      articleCache.set(slug, cached);
    }
    res.setHeader("Cache-Control", "no-cache");
    return res.type("html").send(cached.html);
  } catch (err) {
    return res.sendFile(ARTICLE_TEMPLATE_PATH);
  }
});

app.use((req, res) => {
  res.status(404).sendFile(path.join(PAGES_DIR, "404.html"));
});

app.use((err, req, res, next) => {
  if (err && err.type === "entity.parse.failed") return res.status(400).json({ error: "Corps de requête invalide." });
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "Erreur serveur." });
});

// Préchauffe les données au démarrage, sans bloquer le démarrage si Supabase est indisponible.
siteData.getFiles().then(
  (f) => console.log("Données du site chargées : " + f.keys.join(", ")),
  (err) => console.warn("Données du site non chargées au démarrage : " + err.message)
);

if (require.main === module) {
  app.listen(PORT, () => console.log("Bistro Burger : serveur démarré sur le port " + PORT));
  // Relit les données toutes les 5 minutes pour que les modifications faites
  // directement dans Supabase (hors /admin) finissent par apparaître. En cas
  // d'échec, les dernières données valides restent servies.
  setInterval(() => { siteData.refresh().catch(() => {}); }, 5 * 60 * 1000).unref();
}

module.exports = app;
