// Construit, à partir de Supabase, les fichiers de données du site (contenu,
// configuration publique admin/app, sitemap). Utilisé par le serveur Express
// (en mémoire, rafraîchi après chaque modification dans l'admin) et par
// scripts/generate-data.js (écriture sur disque).
const { createClient } = require("@supabase/supabase-js");

const DEFAULT_ORIGIN = "https://bistroburgergardanne.com";

const STATIC_PAGES = [
  { path: "/", freq: "weekly", prio: "1.0" },
  { path: "/blog/index.html", freq: "weekly", prio: "0.8" },
  { path: "/mentions-legales.html", freq: "yearly", prio: "0.2" },
  { path: "/confidentialite.html", freq: "yearly", prio: "0.2" },
  { path: "/cgv.html", freq: "yearly", prio: "0.2" },
];

function buildSitemap(blog, origin) {
  const urls = STATIC_PAGES.map((p) => ({ loc: origin + p.path, freq: p.freq, prio: p.prio }));
  blog.posts
    .filter((p) => p && p.slug && p.published !== false)
    .forEach((p) =>
      urls.push({ loc: origin + "/blog/" + encodeURIComponent(p.slug) + ".html", freq: "monthly", prio: "0.6", lastmod: p.date })
    );
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls
      .map(
        (u) =>
          "  <url>\n    <loc>" + u.loc + "</loc>\n" +
          (u.lastmod ? "    <lastmod>" + u.lastmod + "</lastmod>\n" : "") +
          "    <changefreq>" + u.freq + "</changefreq>\n    <priority>" + u.prio + "</priority>\n  </url>"
      )
      .join("\n") +
    "\n</urlset>\n"
  );
}

// Configuration publique de l'admin et de l'appli : ne dépend que des variables
// d'environnement, donc disponible même si Supabase est momentanément injoignable.
function buildConfigFiles(env = process.env) {
  const { SUPABASE_URL, SUPABASE_ANON_KEY, VAPID_PUBLIC_KEY } = env;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn("[siteData] SUPABASE_URL ou SUPABASE_ANON_KEY absente — /admin et /app ne pourront pas se connecter.");
    return { adminConfigJs: null, appConfigJs: null };
  }
  return {
    adminConfigJs: "window.SUPABASE_CONFIG = " + JSON.stringify({ url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY }, null, 2) + ";\n",
    appConfigJs:
      "window.SUPABASE_CONFIG = " +
      JSON.stringify({ url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, vapidPublicKey: VAPID_PUBLIC_KEY || null }, null, 2) +
      ";\n",
  };
}

async function buildSiteFiles(env = process.env) {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RECAPTCHA_SITE_KEY } = env;
  const origin = env.SITE_URL || DEFAULT_ORIGIN;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définies (variables d'environnement de l'hébergeur)."
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data, error } = await supabase.from("site_content").select("key, value");
  if (error) throw new Error("Échec de la récupération du contenu Supabase : " + error.message);

  const siteData = {};
  for (const row of data || []) siteData[row.key] = row.value;
  if (RECAPTCHA_SITE_KEY) siteData.recaptchaSiteKey = RECAPTCHA_SITE_KEY;

  const required = ["burgers", "cartes", "plat_du_jour", "offres", "reservation_settings"];
  const missing = required.filter((k) => !(k in siteData));
  if (missing.length) {
    console.warn("[siteData] Clés absentes dans site_content (contenu de secours utilisé) : " + missing.join(", "));
  }

  const files = {
    dataJs: "window.SITE_DATA = " + JSON.stringify(siteData, null, 2) + ";\n",
    ...buildConfigFiles(env),
    sitemapXml: null,
    keys: Object.keys(siteData),
  };

  try {
    const blog = siteData.blog;
    if (blog && Array.isArray(blog.posts)) files.sitemapXml = buildSitemap(blog, origin);
  } catch (err) {
    console.warn("[siteData] Sitemap non régénéré : " + err.message);
  }

  return files;
}

module.exports = { buildSiteFiles, buildConfigFiles };
