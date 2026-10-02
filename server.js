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

const PUBLIC_DIR = path.join(__dirname, "public");
const API_DIR = path.join(__dirname, "api");
const PORT = process.env.PORT || 3000;

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(compression());

// Site masqué aux moteurs de recherche tant que la variable d'environnement
// ALLOW_INDEXING n'est pas "true". On n'interdit pas l'exploration dans
// robots.txt : Google doit pouvoir lire cet en-tête pour retirer les pages déjà indexées.
const HIDE_FROM_SEARCH = process.env.ALLOW_INDEXING !== "true";

app.use((req, res, next) => {
  if (HIDE_FROM_SEARCH) res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  if (req.secure) res.setHeader("Strict-Transport-Security", "max-age=31536000");
  next();
});

app.use(express.json({ limit: "2mb" }));

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
if (HIDE_FROM_SEARCH) {
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

app.use("/assets", express.static(path.join(PUBLIC_DIR, "assets"), { maxAge: "1d", dotfiles: "ignore" }));
app.use(
  express.static(PUBLIC_DIR, {
    dotfiles: "ignore",
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".webmanifest")) res.type("application/manifest+json");
    },
  })
);

// Articles de blog : /blog/mon-article -> modèle unique (équivalent de la réécriture Vercel).
app.get("/blog/:slug", (req, res) => res.sendFile(path.join(PUBLIC_DIR, "blog", "article.html")));

app.use((req, res) => {
  res.status(404).sendFile(path.join(PUBLIC_DIR, "404.html"));
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
