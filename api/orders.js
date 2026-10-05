// API publique : enregistre une commande (panier + upsell) dans Supabase
// pour qu'elle soit consultable depuis l'espace admin. Les prix envoyés par
// le navigateur ne sont jamais utilisés tels quels : ils sont recalculés
// ici à partir de la carte réelle (site_content), pour qu'une requête
// modifiée à la main ne puisse pas changer un prix ou un total.
const { createClient } = require("@supabase/supabase-js");
const { notifyAdmins } = require("./_lib/notify");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ALERT_EMAIL = process.env.ALERT_EMAIL || "brasserie.zone.avon@gmail.com";
const MAX_QTY_PER_ITEM = 30;
const MAX_ITEMS = 60;

// Groupes d'ajouts ("upsell") proposés après le choix du burger, avec leur
// préfixe côté panier — doit rester synchronisé avec buildOrderItemsForApi()
// dans public/script.js.
const UPSELL_GROUPS = [
  { prefix: "Supplément : ", category: "Menus & suppléments", title: "Suppléments viandes" },
  { prefix: "Supplément : ", category: "Menus & suppléments", title: "Suppléments fromages" },
  { prefix: "Boisson : ", category: "Desserts & boissons", title: "Nos boissons" },
  { prefix: "Dessert : ", category: "Desserts & boissons", title: "Nos desserts" },
];

function isValidPhone(raw) {
  const cleaned = String(raw || "").replace(/[\s.\-()]/g, "");
  return /^(0[1-9]\d{8}|\+33[1-9]\d{8}|0033[1-9]\d{8})$/.test(cleaned);
}

function parsePriceToNumber(str) {
  if (!str) return 0;
  const cleaned = String(str).replace(/[^\d,.\-]/g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

// Reconstruit, à partir de la carte réelle, un dictionnaire nom -> prix
// (en euros) pour les burgers à emporter et pour chaque groupe d'ajouts.
function buildCatalog(burgers, cartes) {
  const prices = new Map();

  (Array.isArray(burgers) ? burgers : []).forEach((family) => {
    (Array.isArray(family.items) ? family.items : []).forEach((item) => {
      if (item && item.name) prices.set(item.name, parsePriceToNumber(item.emp));
    });
  });

  const emporter = (cartes && cartes["À emporter"]) || {};
  UPSELL_GROUPS.forEach(({ prefix, category, title }) => {
    const groups = Array.isArray(emporter[category]) ? emporter[category] : [];
    const group = groups.find((g) => g.title === title);
    if (!group) return;
    (Array.isArray(group.items) ? group.items : []).forEach((item) => {
      if (!item || !item.name) return;
      const priceStr = item.price || group.price || "";
      prices.set(prefix + item.name, parsePriceToNumber(priceStr));
    });
  });

  return prices;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Méthode non autorisée." });
    return;
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    res.status(500).json({ error: "Configuration serveur manquante." });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      res.status(400).json({ error: "Corps de requête invalide." });
      return;
    }
  }
  body = body || {};

  const customerName = String(body.customerName || "").trim();
  const customerPhone = String(body.customerPhone || "").trim();
  const rawItems = Array.isArray(body.items) ? body.items : [];

  if (!customerName || !customerPhone || !rawItems.length) {
    res.status(400).json({ error: "Nom, téléphone et articles requis." });
    return;
  }
  if (!isValidPhone(customerPhone)) {
    res.status(400).json({ error: "Numéro de téléphone invalide." });
    return;
  }
  if (rawItems.length > MAX_ITEMS) {
    res.status(400).json({ error: "Trop d'articles dans la commande." });
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: contentRows, error: contentError } = await supabase
    .from("site_content")
    .select("key, value")
    .in("key", ["burgers", "cartes"]);
  if (contentError) {
    res.status(500).json({ error: contentError.message });
    return;
  }
  const burgers = (contentRows.find((r) => r.key === "burgers") || {}).value;
  const cartes = (contentRows.find((r) => r.key === "cartes") || {}).value;
  const catalog = buildCatalog(burgers, cartes);

  const items = [];
  for (const raw of rawItems) {
    const name = String((raw && raw.name) || "").trim();
    const qty = Math.trunc(Number(raw && raw.qty));
    if (!name || !catalog.has(name)) {
      res.status(400).json({ error: "Article inconnu dans la commande : " + (name || "(sans nom)") + "." });
      return;
    }
    if (!Number.isFinite(qty) || qty < 1 || qty > MAX_QTY_PER_ITEM) {
      res.status(400).json({ error: "Quantité invalide pour : " + name + "." });
      return;
    }
    items.push({ name, qty, price: catalog.get(name) });
  }
  const total = Math.round(items.reduce((sum, it) => sum + it.price * it.qty, 0) * 100) / 100;

  const row = {
    customer_name: customerName,
    customer_phone: customerPhone,
    items,
    total,
  };

  const { error } = await supabase.from("orders").insert(row);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  await notifyAdmins(supabase, ALERT_EMAIL, "Nouvelle commande — Bistro Burger", {
    nom: row.customer_name,
    téléphone: row.customer_phone,
    articles: row.items.map((it) => it.qty + "x " + it.name).join(", "),
    total: row.total + " €",
  });

  res.status(200).json({ ok: true });
};
