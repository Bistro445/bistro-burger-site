"use strict";
(() => {
  /* ---------------------------------------------------------------- */
  /* Data — burgers & carte viennent de data.generated.js (Supabase),  */
  /* généré au build. Repli vide sur les pages qui ne le chargent pas. */
  /* ---------------------------------------------------------------- */
  const SITE_DATA = window.SITE_DATA || {};
  let openUpsell = null;
  let openCart = null;
  let closeCart = null;
  let addToCart = null;
  let updateCartBadge = null;
  let cart = [];
  const BURGERS = SITE_DATA.burgers || [
    { title: "Les originaux", items: [
      { name: "Classique", desc: "Bun's², iceberg, tomate, steak, double cheddar, compotée d'oignons maison, sauce de notre enfance", sur: "16 €", emp: "13 €" },
      { name: "Smash", desc: "Bun's², steak smashé, double cheddar, oignons rouges, cornichon, smashed sauce", sur: "16 €", emp: "13 €" },
      { name: "Black Peppers", desc: "Bun's², steak, roquette, tomate, cheddar poivré, compotée d'oignons maison, oignons frits, lard fumé, sauce au poivre", sur: "16 €", emp: "15 €" },
      { name: "Cow-Boy", desc: "Bun's², tenders de poulet, double cheddar, coleslaw maison, cornichon", sur: "16 €", emp: "13 €" },
      { name: "Fisher", desc: "Bun's², iceberg, tomate, dos de cabillaud pané, double cheddar, sauce tartare maison", sur: "19 €", emp: "16 €" }
    ] },
    { title: "Les effilochés", items: [
      { name: "Pull-Pork", desc: "Bun's², effiloché de porc maison confit à la bière, double cheddar, coleslaw maison, sauce barbecue", sur: "18 €", emp: "15 €" },
      { name: "Pull-Beef", desc: "Bun's², effiloché de bœuf bourguignon, roquette, tomate, compotée d'oignons maison, emmental", sur: "19 €", emp: "16 €" },
      { name: "Pull-Duck", desc: "Bun's², roquette, tomate, effiloché de canard confit à l'échalote, chèvre, sauce moutarde miel", sur: "20 €", emp: "17 €", img: "assets/pulled-duck.jpg" }
    ] },
    { title: "Les signatures BB", items: [
      { name: "Le Poulpe", desc: "Pain roll, tentacule de poulpe, légumes rôtis, persillade, salade, sauce mayo sriracha, cheddar épicé", sur: "21 €", emp: "18 €" },
      { name: "Le Cam", desc: "Bun's², steak smashé, double cheddar, oignon rouge, galette de camembert pané maison, smashed sauce", sur: "18 €", emp: "15 €", img: "assets/le-cam.jpg" },
      { name: "Le Big BB", desc: "Bun's², iceberg, galette de bleu d'Auvergne pané, double steak, double cheddar, tomate, compotée d'oignons maison, sauce enfance", sur: "22 €", emp: "19 €", img: "assets/big-bb.jpg" }
    ] }
  ];

  const BURGER_DU_MOMENT = SITE_DATA.burger_du_moment && Array.isArray(SITE_DATA.burger_du_moment.items) ? SITE_DATA.burger_du_moment.items : [];

  const CARTES = SITE_DATA.cartes || {
    "Sur place": {
      "Apéro": [
        { title: "À partager", items: [
          { name: "Mini-Burger", desc: "Par 4", price: "10 €" },
          { name: "Chili Cheese maison", desc: "Par 4", price: "6 €" },
          { name: "Stick de mozzarella", desc: "Par 6", price: "6 €" },
          { name: "Tenders de poulet", desc: "Par 6", price: "6 €" },
          { name: "Panisses artisanales", desc: "Par 7", price: "7 €" },
          { name: "Camembert pané", desc: "Par 6", price: "6 €" },
          { name: "Onion Rings", desc: "Par 6", price: "6 €" },
          { name: "Planche mixte apéro", desc: "Un peu de tout", price: "40 €" }
        ] }
      ],
      "Nos plats": [
        { title: "Nos viandes", note: "Servies avec frites maison ou légumes du moment, et salade.", items: [
          { name: "Entrecôte grillée", desc: "", price: "24 €" },
          { name: "Côtelettes d'agneau aux herbes", desc: "", price: "24 €" },
          { name: "Steak tartare", desc: "", price: "20 €" }
        ] },
        { title: "Nos poissons & pâtes", items: [
          { name: "Fish & Chips", desc: "Frites maison, salade verte et sauce tartare maison", price: "19 €" },
          { name: "Ravioles artisanales chèvre & figue", desc: "Crème de chèvre au miel infusée au romarin, brisures de noix torréfiées", price: "19 €" }
        ] },
        { title: "Nos salades", items: [
          { name: "Salade César", desc: "Iceberg, tomates cerises, oignons rouges, grana padano, tenders de poulet, croûtons, œuf dur, sauce césar maison", price: "17 €" },
          { name: "Salade de chèvre chaud", desc: "Mesclun, tomates cerises, oignons rouges, lardons grillés, toasts de cabécou, noix, vinaigrette maison", price: "17 €" }
        ] }
      ],
      "Menu enfant": [
        { title: "Menu enfant", price: "12,90 €", note: "Un plat, une boisson et un dessert.", items: [
          { name: "Cheeseburger", desc: "Servi avec des frites maison ou légumes du moment", price: "" },
          { name: "Tenders de poulet", desc: "Servi avec des frites maison ou légumes du moment", price: "" },
          { name: "Steak haché", desc: "Servi avec des frites maison ou légumes du moment", price: "" }
        ] },
        { title: "Boisson", items: [
          { name: "Sirop Monin", desc: "Fraise, grenadine, menthe, orgeat, pêche, pac citron, gambetta", price: "" }
        ] },
        { title: "Dessert", items: [
          { name: "Une boule de glace", desc: "Fraise, vanille, chocolat", price: "" }
        ] }
      ],
      "Dessert": [
        { title: "Nos desserts", items: [
          { name: "Assiette de fromages", desc: "", price: "4 €" },
          { name: "Tiramisu du moment", desc: "", price: "4 €" },
          { name: "Mousse au chocolat", desc: "", price: "3,50 €" },
          { name: "Tarte du moment", desc: "", price: "3 €" },
          { name: "Pana cotta", desc: "", price: "2,50 €" },
          { name: "Crème brûlée", desc: "", price: "à confirmer" }
        ] },
        { title: "Nos glaces", items: [
          { name: "Coco glacée", desc: "", price: "4,50 €" },
          { name: "Citron givré", desc: "", price: "4 €" },
          { name: "San Pellegrino 1 L", desc: "", price: "4 €" },
          { name: "Vittel 1 L", desc: "", price: "à confirmer" }
        ] }
      ],
      "Notre cave": [
        { title: "Vins rouges", note: "De 25 € à 39 € la bouteille · appellations et tarifs à confirmer.", items: [
          { name: "Cuvée Pommandre", desc: "AOP Côtes de Provence", price: "25 €" },
          { name: "Le « S »", desc: "AOP Ventoux", price: "à confirmer" },
          { name: "Enfant Terrible", desc: "IGP Méditerranée", price: "à confirmer" },
          { name: "Page Vignelaure", desc: "", price: "à confirmer" },
          { name: "Les Bories", desc: "", price: "à confirmer" }
        ] },
        { title: "Vins blancs", note: "Appellations et tarifs à confirmer.", items: [
          { name: "Cuvée Pommandre", desc: "AOP Côtes de Provence", price: "25 €" },
          { name: "Le « S »", desc: "AOP Ventoux", price: "à confirmer" },
          { name: "Enfant Terrible", desc: "IGP Méditerranée (2023)", price: "à confirmer" },
          { name: "Page Vignelaure", desc: "", price: "à confirmer" },
          { name: "Les Bories", desc: "", price: "à confirmer" }
        ] },
        { title: "Vins rosés", note: "Appellations et tarifs à confirmer.", items: [
          { name: "Cuvée Pommandre", desc: "AOP Côtes de Provence", price: "27 €" },
          { name: "Domaine des Masques, Essentielle", desc: "", price: "à confirmer" },
          { name: "Patrimonio Dos Teddi", desc: "", price: "à confirmer" },
          { name: "Roche Redonne", desc: "AOP Bandol (2023) · bio", price: "39 €" },
          { name: "Bargemone", desc: "AOP Côtes de Provence", price: "à confirmer" }
        ] }
      ]
    },
    "À emporter": {
      "Menus & suppléments": [
        { title: "Menu BB", note: "Burger + 3 € = menu frites classique + boisson. Burger + 5 € = menu frites du BB + boisson.", items: [
          { name: "Frites gorgonzola & noix", desc: "", price: "" },
          { name: "Frites Saint-Marcellin & lard grillé", desc: "", price: "" },
          { name: "Frites cheddar bacon", desc: "", price: "" }
        ] },
        { title: "Suppléments viandes", items: [
          { name: "Double steak ou double poulet", desc: "", price: "4 €" },
          { name: "Triple steak ou triple poulet", desc: "", price: "8 €" },
          { name: "Lard", desc: "", price: "1,50 €" },
          { name: "Bacon", desc: "", price: "1,50 €" }
        ] },
        { title: "Suppléments fromages", items: [
          { name: "Cheddar maturé, épicé ou poivré", desc: "", price: "1,50 €" },
          { name: "Chèvre", desc: "", price: "1,50 €" },
          { name: "Fourme d'Ambert", desc: "", price: "2 €" },
          { name: "Saint-Marcellin", desc: "", price: "3 €" },
          { name: "Bleu d'Auvergne pané maison", desc: "", price: "3,50 €" },
          { name: "Camembert pané maison", desc: "", price: "4 €" }
        ] },
        { title: "Légumes & sauces", items: [
          { name: "Légumes", desc: "Oignons rouges, oignons frits, compotée d'oignons maison, coleslaw maison, tomate, cornichon, roquette, iceberg, galette de pommes de terre", price: "1,50 €" },
          { name: "Sauces", desc: "Sauce de notre enfance, smashed sauce, tartare, moutarde miel, gorgonzola, mayo sriracha, Saint-Marcellin", price: "0,30 €" }
        ] }
      ],
      "Menu étudiant": [
        { title: "Menu étudiant", price: "11,90 €", note: "Sur présentation de la carte étudiante, un menu par carte.", items: [
          { name: "Burger Smash", desc: "", price: "" },
          { name: "Frites maison", desc: "", price: "" },
          { name: "Boisson 33 cl", desc: "", price: "" }
        ] }
      ],
      "Petites faims": [
        { title: "À partager", note: "Nos frites peuvent aussi être intégrées à un menu.", items: [
          { name: "Frites bleu d'Auvergne & noix", desc: "", price: "6 €" },
          { name: "Frites Saint-Marcellin & lard", desc: "", price: "6 €" },
          { name: "Frites cheddar bacon", desc: "", price: "6 €" }
        ] },
        { title: "Tapas", items: [
          { name: "Mini burger x4", desc: "", price: "10 €" },
          { name: "Panisse x6", desc: "", price: "6 €" },
          { name: "Tenders x4", desc: "", price: "6 €" },
          { name: "Camembert pané x4", desc: "", price: "6 €" },
          { name: "Saint-Marcellin pané x2", desc: "", price: "4 €" },
          { name: "Chilli cheese x6", desc: "", price: "6 €" },
          { name: "Stick de mozzarella x6", desc: "", price: "6 €" }
        ] }
      ],
      "Dessert": [
        { title: "Nos desserts", price: "6 €", note: "Tous nos desserts sont faits maison. Demandez les créations du moment, elles changent au fil des saisons.", items: [
          { name: "Tiramisu", desc: "", price: "" },
          { name: "Mousse au chocolat", desc: "", price: "" },
          { name: "Tarte du moment", desc: "", price: "" },
          { name: "Pana cotta", desc: "", price: "" },
          { name: "Brownie", desc: "", price: "" },
          { name: "Dessert du moment", desc: "", price: "" }
        ] },
        { title: "Menu enfant", price: "11,90 €", note: "Au choix, servi avec frites maison ou légumes du moment, et une boisson 33 cl. Le mardi soir et le mercredi midi, le menu enfant est offert pour tout achat d'un menu adulte.", items: [
          { name: "Cheeseburger", desc: "", price: "" },
          { name: "Tenders de poulet", desc: "", price: "" },
          { name: "Steak haché", desc: "", price: "" }
        ] }
      ]
    }
  };

  const PLAT_DU_JOUR = SITE_DATA.plat_du_jour || {
    plat: { label: "Plat du jour", meta: "Jeudi 7 août · servi de 12h à 14h", title: "Brochette de magret de canard aux abricots marinée, boulgour aux légumes croquants", price: "14,50 €" },
    suggestions: [{ label: "Suggestion du jour", title: "Burger du boucher, sauce poivre", description: "La suggestion que le chef ajoute à la carte, selon le marché du matin. Servie avec frites maison et salade.", price: "16,90 €" }],
  };

  const OFFRES = SITE_DATA.offres || [
    { tag: "Menu étudiant", price: "11,90 €", title: "Burger smash, frites maison, boisson 33 cl", description: "Offre valable uniquement sur présentation de la carte étudiante, un menu par carte.", img: "assets/menu-etudiant.jpg" },
    { tag: "Menu enfant", price: "11,90 €", title: "Cheeseburger, tenders de poulet ou steak haché, boisson 33 cl", description: "Le mardi soir et le mercredi midi, le menu enfant est offert pour tout achat d'un menu adulte. Valable également pour tout repas sur place.", img: "assets/menu-enfant.jpg" },
    { tag: "Carte de fidélité", price: "", title: "1 case = 15 € d'achat", description: "10 cases complètes = 15 € offerts\n• Offres cumulables\n• Carte nominative\nPassez récupérer votre carte au comptoir.", img: "assets/carte-fidelite.jpg" },
    { tag: "Carte cadeau", price: "", title: "Scannez le QR code en salle pour gagner des lots", description: "Tentez votre chance, gagnez, et venez récupérer vos cadeaux sur place.", img: "assets/carte-cadeau.jpg" },
  ];

  const ANNONCES = SITE_DATA.annonces && SITE_DATA.annonces.length ? SITE_DATA.annonces : [
    "Livraison à Gardanne et communes voisines",
    "Plat du jour du lundi au vendredi, 12h–14h",
    "Burgers faits maison · produits frais",
    "Diffusion des matchs de l'OM en direct",
  ];

  const RESERVATION_SETTINGS = SITE_DATA.reservation_settings || {
    heures: ["12h00", "12h30", "13h00", "13h30", "14h00", "17h30", "18h00", "18h30", "19h00", "19h30", "20h00", "20h30", "21h00"],
    couverts: ["2 personnes", "3 personnes", "4 personnes", "5 personnes", "6 personnes"],
    horaires_text: ["Lundi · 9h00–14h00", "Du mardi au vendredi · 9h00–14h00 et 17h30–21h30", "Fermé le samedi et le dimanche", "Parking gratuit devant le restaurant"],
  };

  const GRADS = ["ph-1", "ph-2", "ph-3"];

  const REVIEWS = [
    { initials: "EC", name: "Eleonore C.", meta: "Avis Google · 5/5", text: "Tout était nickel. Service agréable et serviable, nourriture super, prix corrects et une déco douce." },
    { initials: "AB", name: "Arno BRS", meta: "Avis Google · 5/5", text: "En passant par là, un arrêt déjeuner et une belle surprise : cuisine très bonne et copieuse, service rapide et souriant." },
    { initials: "YG", name: "Yannick Gonzalez", meta: "Avis Google · 5/5", text: "Une équipe super agréable, on mange super bien, les burgers sont top. On y passe un bon moment en famille ou entre amis." },
    { initials: "JK", name: "Les jardins de Kerellec", meta: "Avis Google · 5/5", text: "Accueil au top, cuisine maîtrisée et avec du goût au rendez-vous. Nous recommandons vivement." },
    { initials: "CO", name: "Corinne", meta: "Avis Google · 5/5", text: "Une belle décoration, un accueil chaleureux et un service de qualité. Les burgers sont vraiment excellents." },
    { initials: "SG", name: "Sandrine G.", meta: "Avis Google · 5/5", text: "Plat du jour et burger, tout était excellent : cuisiné avec des produits frais, et ça se sent. Le personnel est souriant." }
  ];

  const FAQ = [
    { q: "Proposez-vous des options végétariennes ?", a: "Oui. Le Jardinier est disponible toute l'année, et un burger végétarien du moment change chaque mois. Nos frites sont cuites dans un bain séparé." },
    { q: "Quels sont les allergènes présents dans vos burgers ?", a: "La présence d'allergènes dépend de la composition de chaque burger, de son pain, de ses sauces et de certains produits utilisés dans sa préparation. Les principaux allergènes identifiés dans notre carte peuvent notamment inclure le gluten, le lait, l'œuf, le poisson, la moutarde et les mollusques. Pour connaître précisément les allergènes d'un burger, consultez le détail ci-dessous ou demandez confirmation à notre équipe avant de commander. Si vous avez une allergie ou une intolérance alimentaire, signalez-la impérativement au personnel." },
    { q: "Quel est le détail des allergènes par burger ?", a: "Classique — Identifiés : gluten, lait. À confirmer : composition du bun's, sauce origan.\n\nSmash — Identifiés : gluten, lait. À confirmer : composition du bun's, smashed sauce, cornichons.\n\nBlack Peppers — Identifiés : gluten, lait. À confirmer : composition du bun's, oignons frits, sauce au poivre, lard fumé.\n\nCow-Boy — Identifiés : gluten, lait. À confirmer : œuf et/ou moutarde possibles selon les tenders et le coleslaw, composition du bun's.\n\nFisher — Identifiés : gluten, poisson, lait. À confirmer : œuf et/ou moutarde possibles dans la panure et la sauce tartare, composition du bun's.\n\nPull-Pork — Identifiés : gluten, lait. À confirmer : allergènes de la bière et de la sauce barbecue, œuf et/ou moutarde possibles dans le coleslaw, composition du bun's.\n\nPull-Beef — Identifiés : gluten, lait. À confirmer : allergènes éventuels de la préparation bourguignonne, composition du bun's.\n\nPull-Duck — Identifiés : gluten, moutarde. À confirmer : composition exacte de la sauce moutarde miel, éventuels lait/œuf selon la recette, composition du bun's.\n\nLe Poulpe — Identifiés : gluten, mollusques, œuf, lait. À confirmer : composition exacte du pain, sauce mayo sriracha, éventuels autres allergènes de la sauce.\n\nLe Cam — Identifiés : gluten, lait. À confirmer : œuf possible dans la panure, composition de la smashed sauce, composition du bun's.\n\nLe Big BB — Identifiés : gluten, lait. À confirmer : œuf possible dans la panure, composition de la sauce enfant, composition du bun's." },
    { q: "Quels sont vos horaires ?", a: "Le lundi, de 9h00 à 14h00. Du mardi au vendredi, de 9h00 à 14h00 et de 17h30 à 21h30. Nous sommes fermés le samedi et le dimanche." },
    { q: "Faut-il réserver ?", a: "Ce n'est pas obligatoire, mais c'est plus sûr le vendredi soir. Pour les groupes de plus de dix personnes, appelez-nous au 04 65 84 89 18." },
    { q: "Livrez-vous à domicile ?", a: "Oui, sur Gardanne et les communes limitrophes. Zone et délais à confirmer avec la plateforme de commande." },
    { q: "Y a-t-il un parking ?", a: "Un parking gratuit se trouve directement devant le restaurant, dans la ZAC Avon. Aucun horodateur, aucune limite de durée." }
  ];

  const DEFAULT_BLOG = {
    categories: ["Brasserie", "Traiteur", "Annonce"],
    posts: [
      { slug: "la-terrasse-est-ouverte-tout-lete", img: "assets/blog-terrasse.jpg", date: "2026-08-02", category: "Brasserie", published: true, title: "La terrasse est ouverte tout l'été", excerpt: "Douze couverts supplémentaires à l'ombre, dès 19h et jusqu'à la fermeture.", body: "La terrasse est installée pour toute la saison, côté ombre, à l'écart du passage. Douze couverts de plus chaque soir, ouverts dès 19h et jusqu'à la fermeture. Sur les créneaux du vendredi et du samedi elle part vite : réservez si vous y tenez, en précisant votre préférence au moment de la demande." },
      { slug: "un-nouveau-pain-livre-chaque-matin", img: "assets/blog-pain.jpg", date: "2026-07-24", category: "Brasserie", published: true, title: "Un nouveau pain, livré chaque matin", excerpt: "Nous travaillons désormais avec une boulangerie de Gardanne pour tous nos buns.", body: "Nos buns sont désormais façonnés par une boulangerie de Gardanne et livrés chaque matin. Le pain tient mieux à la cuisson, la mie reste moelleuse jusqu'à la dernière bouchée, et le circuit se raccourcit à quelques rues. Le changement concerne toute la carte, sur place comme à emporter." },
      { slug: "le-plat-du-jour-sur-instagram", img: "assets/blog-instagram.jpg", date: "2026-07-10", category: "Annonce", published: true, title: "Le plat du jour, maintenant sur Instagram", excerpt: "Retrouvez chaque matin l'ardoise du jour sur @bistroburger_gardanne.", body: "Chaque matin, l'ardoise du jour est publiée sur notre compte Instagram avant le service de midi. Plat, accompagnement et prix : de quoi décider avant de sortir du bureau.\n\nSuivez @bistroburger_gardanne pour la recevoir dans votre fil." }
    ]
  };
  const BLOG = SITE_DATA.blog && Array.isArray(SITE_DATA.blog.posts) ? SITE_DATA.blog : DEFAULT_BLOG;
  const POSTS = BLOG.posts
    .filter((p) => p && p.published !== false && p.slug)
    .slice()
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  const BLOG_CATEGORIES = Array.isArray(BLOG.categories) && BLOG.categories.length ? BLOG.categories : Array.from(new Set(POSTS.map((p) => p.category).filter(Boolean)));

  /* ---------------------------------------------------------------- */
  /* State                                                             */
  /* ---------------------------------------------------------------- */
  const state = { mode: "Sur place", tab: "Apéro", reviewPage: 0, faqOpen: 0, postOpen: -1 };

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const el = (tag, attrs, html) => {
    const n = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === "style") n.style.cssText = attrs[k];
      else if (k === "class") n.className = attrs[k];
      else n.setAttribute(k, attrs[k]);
    }
    if (html !== undefined) n.innerHTML = html;
    return n;
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const stripEuro = (s) => String(s || "").replace(/€/g, "").replace(/\s+/g, " ").trim();
  // PostgreSQL (jsonb) ne garantit pas l'ordre des clés d'un objet une fois stocké :
  // l'ordre des catégories de la carte est donc mémorisé explicitement dans _order
  // plutôt que déduit de Object.keys(), qui peut revenir dans un ordre différent.
  function orderedCategoryNames(catsObj) {
    const order = Array.isArray(catsObj._order) ? catsObj._order.filter((n) => Object.prototype.hasOwnProperty.call(catsObj, n)) : [];
    const rest = Object.keys(catsObj).filter((n) => n !== "_order" && !order.includes(n));
    return order.concat(rest);
  }
  function parsePriceToNumber(str) {
    if (!str) return 0;
    const cleaned = String(str).replace(/[^\d,.\-]/g, "").replace(",", ".");
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  }
  function formatPrice(n) {
    const rounded = Math.round(n * 100) / 100;
    const hasCents = Math.abs(rounded % 1) > 0.001;
    return (hasCents ? rounded.toFixed(2).replace(".", ",") : String(rounded)) + " €";
  }

  /* ---------------------------------------------------------------- */
  /* Smooth-scroll to a section (accounts for the fixed header)        */
  /* ---------------------------------------------------------------- */
  function jump(id) {
    const target = document.getElementById(id);
    if (!target) {
      const home = document.body.getAttribute("data-home") || "index.html";
      window.location.href = home + "#" + id;
      return;
    }
    const header = document.querySelector("header");
    const offset = (header ? header.offsetHeight : 70) + 4;
    window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - offset, behavior: "smooth" });
  }
  document.addEventListener("click", (e) => {
    const goEl = e.target.closest("[data-go]");
    if (goEl) {
      const target = goEl.getAttribute("data-go");
      jump(target === "commander" ? "contact" : target);
      return;
    }
    const cartOpenEl = e.target.closest(".cart-open-trigger");
    if (cartOpenEl && openCart) {
      openCart();
      return;
    }
    const addEl = e.target.closest("[data-cart-add]");
    if (addEl && addToCart) {
      addToCart(addEl.getAttribute("data-cart-add"), addEl.getAttribute("data-cart-price"));
      const original = addEl.textContent;
      addEl.textContent = "Ajouté ✓";
      addEl.disabled = true;
      setTimeout(() => { addEl.textContent = original; addEl.disabled = false; }, 1100);
      return;
    }
  });

  /* ---------------------------------------------------------------- */
  /* Header spacer sync (keeps content clear of the fixed header)      */
  /* ---------------------------------------------------------------- */
  function syncSpacer() {
    const header = document.querySelector("header");
    const spacer = document.getElementById("header-spacer");
    if (header && spacer && state_navOpen() !== true) spacer.style.height = header.offsetHeight + "px";
  }
  function state_navOpen() { return document.getElementById("nav-main").getAttribute("data-open") === "true"; }
  syncSpacer();
  setInterval(syncSpacer, 500);
  window.addEventListener("resize", syncSpacer);

  /* ---------------------------------------------------------------- */
  /* Mobile nav / carte dropdown                                       */
  /* ---------------------------------------------------------------- */
  const navToggle = document.getElementById("nav-toggle");
  const navMain = document.getElementById("nav-main");
  const navActions = document.getElementById("nav-actions");
  const cartToggle = document.getElementById("cart-toggle");
  const navPanel = document.getElementById("nav-panel");
  const navDrop = document.getElementById("nav-drop");

  function setMenuOpen(open) {
    navMain.setAttribute("data-open", open ? "true" : "false");
    navActions.setAttribute("data-open", open ? "true" : "false");
    navToggle.setAttribute("aria-expanded", open ? "true" : "false");
  }
  navToggle.addEventListener("click", () => setMenuOpen(navMain.getAttribute("data-open") !== "true"));
  navMain.addEventListener("click", (e) => {
    if (e.target.closest("a") && !e.target.closest("[data-nav-item]")) setMenuOpen(false);
  });
  cartToggle.addEventListener("click", (e) => {
    e.preventDefault(); e.stopPropagation();
    const open = navPanel.getAttribute("data-open") === "true";
    navPanel.setAttribute("data-open", open ? "false" : "true");
    navDrop.setAttribute("data-open", open ? "false" : "true");
  });
  document.addEventListener("click", (e) => {
    if (!navDrop.contains(e.target)) { navPanel.setAttribute("data-open", "false"); navDrop.setAttribute("data-open", "false"); }
  });
  $$("[data-nav-item][data-go-carte]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.getAttribute("data-go-carte");
      if (document.getElementById("mode-toggle")) {
        state.mode = mode;
        state.tab = orderedCategoryNames(CARTES[mode])[0];
        renderCarte();
      }
      setMenuOpen(false);
      navPanel.setAttribute("data-open", "false"); navDrop.setAttribute("data-open", "false");
      jump("carte");
    });
  });
  $$("[data-nav-item][href^='#']").forEach((a) => a.addEventListener("click", () => setMenuOpen(false)));
  document.querySelector("[data-call]").addEventListener("click", () => { window.location.href = "tel:+33465848918"; });

  /* ---------------------------------------------------------------- */
  /* Marquee ticker (top strip)                                        */
  /* ---------------------------------------------------------------- */
  (function renderMarquee() {
    const track = document.getElementById("marquee-track");
    if (!track) return;
    const items = ANNONCES;
    const span = (text) => `<span style="font-family:var(--font-heading); font-weight:700; font-size:13px; letter-spacing:.16em; text-transform:uppercase; white-space:nowrap;">${esc(text)}</span><span style="color:var(--cream-500); font-size:15px; line-height:1;">✳</span>`;
    let html = "";
    for (let i = 0; i < Math.max(8, items.length * 2); i++) html += span(items[i % items.length]);
    track.innerHTML = html;
  })();

  /* ---------------------------------------------------------------- */
  /* Carrousel d'offres dans le panier                                 */
  /* ---------------------------------------------------------------- */
  (function renderCartOffersCarousel() {
    const carousel = document.getElementById("cart-offers-carousel");
    if (!carousel || !OFFRES.length) return;
    const badgeEl = document.getElementById("cart-offer-badge");
    const titleEl = document.getElementById("cart-offer-title");
    const descEl = document.getElementById("cart-offer-desc");
    const priceEl = document.getElementById("cart-offer-price");
    const imgEl = document.getElementById("cart-offer-img");
    const dotsEl = document.getElementById("cart-offer-dots");
    let index = 0;

    function show(i) {
      index = i;
      const offer = OFFRES[index];
      badgeEl.textContent = offer.tag || "Offre du moment";
      titleEl.textContent = offer.title || "";
      descEl.textContent = offer.description || "";
      priceEl.textContent = offer.price || "";
      if (offer.img) { imgEl.src = offer.img; imgEl.alt = offer.title || offer.tag || ""; }
      dotsEl.querySelectorAll("[data-dot]").forEach((d, di) => {
        d.style.background = di === index ? "var(--cream-500)" : "rgba(237,224,211,.4)";
      });
    }

    dotsEl.innerHTML = OFFRES.map((_, i) =>
      `<button type="button" data-dot="${i}" aria-label="Offre ${i + 1}" style="width:8px; height:8px; padding:0; border:none; border-radius:50%; cursor:pointer;"></button>`
    ).join("");

    let autoTimer = null;
    function startAuto() {
      if (autoTimer) clearInterval(autoTimer);
      if (OFFRES.length < 2) return;
      autoTimer = setInterval(() => show((index + 1) % OFFRES.length), 5000);
    }

    dotsEl.querySelectorAll("[data-dot]").forEach((d) => {
      d.addEventListener("click", () => { show(Number(d.dataset.dot)); startAuto(); });
    });

    show(0);
    startAuto();
  })();

  /* ---------------------------------------------------------------- */
  /* Image en grand (burgers)                                          */
  /* ---------------------------------------------------------------- */
  const lightbox = el("div", {
    role: "dialog", "aria-modal": "true", "aria-label": "Image en grand", tabindex: "-1",
    style: "position:fixed; inset:0; z-index:300; display:none; align-items:center; justify-content:center; padding:32px; background:rgba(14,70,61,.82); backdrop-filter:blur(4px); cursor:zoom-out;",
  }, `<img id="lightbox-img" alt="" style="max-width:min(880px,92vw); max-height:88vh; width:auto; height:auto; border-radius:var(--radius-photo); box-shadow:0 30px 70px rgba(0,0,0,.5); cursor:default;">
      <button type="button" aria-label="Fermer" id="lightbox-close" style="position:absolute; top:18px; right:18px; width:42px; height:42px; border-radius:50%; border:1.5px solid rgba(237,224,211,.55); background:rgba(14,70,61,.5); color:var(--color-secondary); font-size:20px; line-height:1; cursor:pointer; display:flex; align-items:center; justify-content:center;">×</button>`);
  document.body.appendChild(lightbox);
  function openLightbox(src, alt) {
    lightbox.querySelector("#lightbox-img").src = src;
    lightbox.querySelector("#lightbox-img").alt = alt || "";
    lightbox.style.display = "flex";
    document.body.style.overflow = "hidden";
    lightbox.focus();
  }
  function closeLightbox() {
    lightbox.style.display = "none";
    document.body.style.overflow = "";
    lightbox.querySelector("#lightbox-img").src = "";
  }
  lightbox.addEventListener("click", (e) => { if (e.target === lightbox || e.target.id === "lightbox-close") closeLightbox(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && lightbox.style.display === "flex") closeLightbox(); });

  /* ---------------------------------------------------------------- */
  /* Burgers carousel                                                   */
  /* ---------------------------------------------------------------- */
  function renderBurgers() {
    const track = document.getElementById("burger-track");
    if (!track) return;
    const flat = BURGERS.flatMap((fam) => fam.items.map((b) => ({ ...b, noImg: !b.img })));
    flat.sort((a, b) => (a.img ? 0 : 1) - (b.img ? 0 : 1));
    track.innerHTML = "";
    flat.forEach((b) => {
      const card = el("div", { "data-burger-card": "", style: "display:flex; flex-direction:column; gap:11px; padding:18px; border-radius:var(--radius-card); background:#FFFFFF; border:1px solid var(--border-default); box-shadow:0 10px 26px rgba(44,44,42,.1);" });
      const photo = el("div", { "data-b-photo": "", style: "position:relative; aspect-ratio:4/3; border-radius:var(--radius-photo); background:linear-gradient(150deg,#FFFFFF,var(--cream-400)); box-shadow:0 8px 20px rgba(44,44,42,.14); display:flex; align-items:center; justify-content:center; font-family:var(--font-heading); font-weight:600; font-size:10.5px; letter-spacing:.14em; text-transform:uppercase; color:rgba(18,87,76,.45); overflow:hidden;" });
      if (b.img) {
        photo.innerHTML = `<img src="${esc(b.img)}" alt="${esc(b.name)}" style="position:absolute; inset:0; width:100%; height:100%; object-fit:cover; cursor:zoom-in;">
          <span aria-hidden="true" style="position:absolute; z-index:1; bottom:10px; right:10px; width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:rgba(14,70,61,.55); color:#FFFFFF; opacity:0; transition:opacity .2s ease; pointer-events:none;"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg></span>`;
        photo.style.cursor = "zoom-in";
        photo.addEventListener("mouseenter", () => { photo.querySelector("span").style.opacity = "1"; });
        photo.addEventListener("mouseleave", () => { photo.querySelector("span").style.opacity = "0"; });
        photo.addEventListener("click", (e) => { if (e.target.closest("button")) return; openLightbox(b.img, b.name); });
      } else {
        photo.innerHTML = "<span>Photo</span>";
      }
      const tags = el("div", { style: "position:absolute; z-index:2; top:12px; left:12px; right:12px; display:flex; flex-wrap:wrap; gap:7px;" },
        `<span data-b-price style="font-family:var(--font-heading); font-weight:700; font-size:14px; color:var(--color-secondary); background:linear-gradient(115deg,#2E8F7C 0%,var(--green-700) 40%,var(--color-primary) 100%); box-shadow:inset 0 1px 0 rgba(237,224,211,.28), 0 5px 14px rgba(14,70,61,.26); padding:6px 13px; border-radius:var(--radius-badge);">${esc(b.sur)} sur place</span>
         <span data-b-price2 style="font-family:var(--font-heading); font-weight:700; font-size:14px; color:var(--color-primary); background:linear-gradient(115deg,#FFFBF6 0%,var(--cream-500) 45%,#D9C7B3 100%); box-shadow:inset 0 1px 0 rgba(255,255,255,.7), 0 5px 14px rgba(14,70,61,.2); padding:6px 13px; border-radius:var(--radius-badge);">${esc(b.emp)} à emporter</span>`);
      photo.appendChild(tags);
      card.appendChild(photo);
      card.appendChild(el("span", { "data-b-name": "", style: "align-self:flex-start; font-family:var(--font-heading); font-weight:700; font-size:17px; line-height:1.2; color:var(--color-secondary); background:linear-gradient(115deg,#2E8F7C 0%,var(--green-700) 40%,var(--color-primary) 100%); box-shadow:inset 0 1px 0 rgba(237,224,211,.28), 0 5px 14px rgba(14,70,61,.2); padding:7px 15px; border-radius:var(--radius-badge);" }, esc(b.name)));
      card.appendChild(el("p", { "data-b-desc": "", style: "font-size:13.5px; line-height:1.55; color:var(--text-muted); margin:0; flex:1;" }, esc(b.desc)));
      const actions = el("div", { style: "display:flex; flex-wrap:wrap; gap:9px;" });
      const orderBtn = el("button", { type: "button", "data-shine": "", "data-b-order": "", "data-cart-add": b.name, "data-cart-price": b.emp, style: "font-family:var(--font-heading); font-weight:600; font-size:13px; padding:10px 18px; border:none; cursor:pointer; border-radius:var(--radius-badge); color:var(--color-secondary); background:linear-gradient(115deg,#2E8F7C 0%,var(--green-700) 30%,var(--color-primary) 62%,var(--green-900) 100%); box-shadow:inset 0 1px 0 rgba(237,224,211,.3), 0 6px 16px rgba(18,87,76,.26);" }, "Ajouter au panier");
      const reserveBtn = el("button", { type: "button", "data-b-reserve": "", "data-go": "reservation", style: "font-family:var(--font-heading); font-weight:600; font-size:13px; padding:10px 18px; cursor:pointer; border-radius:var(--radius-badge); color:var(--color-primary); background:transparent; border:1.5px solid rgba(18,87,76,.45);" }, "Réserver");
      actions.appendChild(orderBtn); actions.appendChild(reserveBtn);
      card.appendChild(actions);
      track.appendChild(card);
    });
  }
  renderBurgers();

  /* ---------------------------------------------------------------- */
  /* Burger du moment — mis en avant avant la liste des burgers.       */
  /* Ne touche rien si aucun burger actif : le contenu HTML par défaut */
  /* reste affiché (et reste dans le HTML rendu, utile pour le SEO).   */
  /* ---------------------------------------------------------------- */
  (function renderBurgerDuMoment() {
    const active = BURGER_DU_MOMENT.find((b) => b.active);
    if (!active) return;
    const setText = (id, val) => {
      const t = document.getElementById(id);
      if (t && val != null) t.textContent = val;
    };
    setText("bdm-name", active.name);
    setText("bdm-desc", active.description);
    setText("bdm-ingredients", active.ingredients);
    if (active.sur) setText("bdm-price-sur", active.sur + " sur place");
    if (active.emp) setText("bdm-price-emp", active.emp + " à emporter");
    const imgEl = document.getElementById("bdm-img");
    if (imgEl && active.img) {
      imgEl.src = active.img;
      imgEl.alt = active.name ? "Burger du moment : " + active.name : "Burger du moment";
    }
    const allergensEl = document.getElementById("bdm-allergens");
    if (allergensEl) {
      if (active.allergens) {
        allergensEl.textContent = "Allergènes : " + active.allergens;
        allergensEl.hidden = false;
      } else {
        allergensEl.hidden = true;
      }
    }
    const statusEl = document.getElementById("bdm-status");
    if (statusEl) statusEl.hidden = active.available !== false;
  })();

  /* ---------------------------------------------------------------- */
  /* Plat du jour / suggestion                                         */
  /* ---------------------------------------------------------------- */
  let pdjSuggestions = [];
  let pdjSugIndex = 0;
  const pdjSetText = (id, val) => {
    const target = document.getElementById(id);
    if (target && val) target.textContent = val;
  };
  function renderPdjSuggestion() {
    const counterEl = document.getElementById("sug-counter");
    if (!pdjSuggestions.length) return;
    const sug = pdjSuggestions[pdjSugIndex] || {};
    pdjSetText("sug-title", sug.title || "");
    pdjSetText("sug-desc", sug.description || "");
    pdjSetText("sug-price", sug.price || "");
    if (counterEl) counterEl.textContent = (pdjSugIndex + 1) + " / " + pdjSuggestions.length;
  }
  function formatPdjDate(iso) {
    try {
      const s = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(new Date(iso + "T00:00:00"));
      return s.charAt(0).toUpperCase() + s.slice(1);
    } catch {
      return iso;
    }
  }
  function renderPlatDuJour(data) {
    const plat = (data && data.plat) || {};
    pdjSuggestions = Array.isArray(data && data.suggestions)
      ? data.suggestions
      : data && data.suggestion
      ? [data.suggestion]
      : [];
    pdjSugIndex = 0;
    const metaText = plat.date
      ? formatPdjDate(plat.date) + (plat.horaire ? " · " + plat.horaire : "")
      : plat.meta || plat.horaire || "";
    pdjSetText("pdj-meta", metaText);
    pdjSetText("pdj-title", plat.title);
    pdjSetText("pdj-price", plat.price);
    if (!pdjSuggestions.length) return;
    renderPdjSuggestion();
    const navEl = document.getElementById("sug-nav");
    if (navEl) navEl.hidden = pdjSuggestions.length <= 1;
  }
  renderPlatDuJour(PLAT_DU_JOUR);
  (function bindPdjNav() {
    const prevBtn = document.getElementById("sug-prev");
    const nextBtn = document.getElementById("sug-next");
    if (prevBtn) prevBtn.addEventListener("click", () => { if (!pdjSuggestions.length) return; pdjSugIndex = (pdjSugIndex - 1 + pdjSuggestions.length) % pdjSuggestions.length; renderPdjSuggestion(); });
    if (nextBtn) nextBtn.addEventListener("click", () => { if (!pdjSuggestions.length) return; pdjSugIndex = (pdjSugIndex + 1) % pdjSuggestions.length; renderPdjSuggestion(); });
  })();
  /* Rafraîchit plat du jour / suggestions en tâche de fond, sans attendre */
  /* le prochain déploiement complet du site (jusqu'à 60s sinon).          */
  fetch("/api/plat-du-jour")
    .then((r) => (r.ok ? r.json() : null))
    .then((json) => { if (json && json.value) renderPlatDuJour(json.value); })
    .catch(() => {});

  /* ---------------------------------------------------------------- */
  /* Offres du moment                                                   */
  /* ---------------------------------------------------------------- */
  function renderOffres() {
    const grid = document.getElementById("offers-grid");
    if (!grid) return;
    grid.innerHTML = "";
    OFFRES.forEach((offer) => {
      const card = el("div", { "data-offer": "light", class: "offer-card", style: "background:linear-gradient(180deg,#FFFFFF,var(--cream-400)); border:1px solid var(--border-default); border-radius:var(--radius-card); overflow:hidden; display:flex; flex-direction:column;" });
      const visual = el("div", { "data-offer-visual": "", style: "aspect-ratio:16/10; overflow:hidden; position:relative;" },
        offer.img ? '<img src="' + esc(offer.img) + '" alt="' + esc(offer.title || offer.tag || "") + '" style="width:100%; height:100%; object-fit:cover; display:block;">' : "");
      card.appendChild(visual);
      const body = el("div", { style: "padding:22px 22px 26px; display:flex; flex-direction:column; flex:1;" });
      const head = el("div", { style: "display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;" });
      head.appendChild(el("span", { "data-offer-tag": "", style: "font-family:var(--font-heading); font-weight:700; font-size:11px; letter-spacing:.14em; text-transform:uppercase; padding:6px 13px; border-radius:var(--radius-badge);" }, esc(offer.tag || "")));
      if (offer.price) head.appendChild(el("span", { "data-offer-price": "", style: "font-family:var(--font-heading); font-weight:700; font-size:17px;" }, esc(offer.price)));
      body.appendChild(head);
      body.appendChild(el("h3", { style: "font-family:var(--font-heading); font-weight:600; font-size:17.5px; line-height:1.3; margin:16px 0 0;" }, esc(offer.title || "")));
      body.appendChild(el("p", { style: "font-size:13.5px; line-height:1.6; margin:10px 0 0; flex:1; white-space:pre-line;" }, esc(offer.description || "")));
      const isCardOffer = offer.tag === "Carte de fidélité" || offer.tag === "Carte cadeau";
      body.appendChild(el("a", { href: isCardOffer ? "#contact" : "#reservation", class: "btn btn-gradient", "data-shine": "", style: "margin-top:18px; width:100%; text-decoration:none; text-align:center; box-sizing:border-box;" }, isCardOffer ? "Nous rendre visite" : "Réserver"));
      card.appendChild(body);
      grid.appendChild(card);
    });
  }
  renderOffres();

  /* ---------------------------------------------------------------- */
  /* Réglages de réservation (créneaux, couverts, horaires affichés)   */
  /* ---------------------------------------------------------------- */
  function renderReservationSettings() {
    const heureSelect = document.getElementById("reservation-heure-select");
    if (heureSelect && Array.isArray(RESERVATION_SETTINGS.heures) && RESERVATION_SETTINGS.heures.length) {
      heureSelect.innerHTML = RESERVATION_SETTINGS.heures.map((h) => '<option style="color:#2C2C2A;">' + esc(h) + "</option>").join("");
    }
    const couvertsSelect = document.getElementById("reservation-couverts-select");
    if (couvertsSelect && Array.isArray(RESERVATION_SETTINGS.couverts) && RESERVATION_SETTINGS.couverts.length) {
      couvertsSelect.innerHTML = RESERVATION_SETTINGS.couverts.map((c) => '<option style="color:#2C2C2A;">' + esc(c) + "</option>").join("");
    }
    const horairesList = document.getElementById("reservation-horaires-list");
    if (horairesList && Array.isArray(RESERVATION_SETTINGS.horaires_text) && RESERVATION_SETTINGS.horaires_text.length) {
      horairesList.innerHTML = RESERVATION_SETTINGS.horaires_text.map((line) => "<div>" + esc(line) + "</div>").join("");
    }
  }
  renderReservationSettings();

  /* ---------------------------------------------------------------- */
  /* Panier (burgers uniquement)                                       */
  /* ---------------------------------------------------------------- */
  const cartBackdrop = document.getElementById("cart-backdrop");
  if (cartBackdrop) {
    const cartBox = document.getElementById("cart-box");
    const cartEmpty = document.getElementById("cart-empty");
    const cartFilled = document.getElementById("cart-filled");
    const cartItemsList = document.getElementById("cart-items-list");
    const cartTotalEl = document.getElementById("cart-total");
    const cartSubtotalEl = document.getElementById("cart-subtotal");
    const cartCountLabel = document.getElementById("cart-count-label");
    const cartBadges = document.querySelectorAll(".cart-badge-el");
    const productGrid = document.getElementById("cart-product-grid");

    function getBurgerImg(name) {
      for (const fam of BURGERS) {
        const found = fam.items.find((it) => it.name === name);
        if (found) return found.img || null;
      }
      return null;
    }

    function getFlatBurgers() {
      const flat = BURGERS.flatMap((fam) => fam.items);
      flat.sort((a, b) => (a.img ? 0 : 1) - (b.img ? 0 : 1));
      return flat;
    }

    function renderProductGrid() {
      if (!productGrid) return;
      productGrid.innerHTML = "";
      getFlatBurgers().forEach((b) => {
        const cartItem = cart.find((it) => it.name === b.name);
        const qty = cartItem ? cartItem.qty : 0;
        const card = document.createElement("div");
        card.className = "cart-product-card";
        card.innerHTML =
          '<div class="cart-product-thumb">' + (b.img ? '<img src="' + esc(b.img) + '" alt="' + esc(b.name) + '">' : "<span>Photo</span>") + "</div>" +
          '<div class="cart-product-info">' +
          '<span class="cart-product-name">' + esc(b.name) + "</span>" +
          (b.desc ? '<span class="cart-product-desc">' + esc(b.desc) + "</span>" : "") +
          '<span class="cart-product-price">' + esc(b.emp) + "</span>" +
          "</div>" +
          '<div class="cart-product-actions">' +
          (qty > 0
            ? '<div class="cart-item-qty"><button type="button" class="cart-item-qty-btn" data-p-minus aria-label="Retirer un">−</button><span class="cart-item-qty-value">' + qty + '</span><button type="button" class="cart-item-qty-btn" data-p-plus aria-label="Ajouter un">+</button></div>'
            : '<button type="button" class="cart-product-add" data-p-add aria-label="Ajouter">+</button>') +
          "</div>";
        const minusBtn = card.querySelector("[data-p-minus]");
        const plusBtn = card.querySelector("[data-p-plus]");
        const addBtn = card.querySelector("[data-p-add]");
        if (minusBtn) minusBtn.addEventListener("click", () => setQty(b.name, qty - 1));
        if (plusBtn) plusBtn.addEventListener("click", () => setQty(b.name, qty + 1));
        if (addBtn) addBtn.addEventListener("click", () => { addToCart(b.name, b.emp); renderCart(); });
        productGrid.appendChild(card);
      });
    }

    function loadCart() {
      try {
        const raw = localStorage.getItem("bb-cart-v1");
        cart = raw ? JSON.parse(raw) : [];
      } catch {
        cart = [];
      }
    }
    function saveCart() {
      try { localStorage.setItem("bb-cart-v1", JSON.stringify(cart)); } catch {}
    }
    function cartTotal() {
      return cart.reduce((sum, it) => sum + it.price * it.qty, 0);
    }
    function cartCount() {
      return cart.reduce((sum, it) => sum + it.qty, 0);
    }
    updateCartBadge = function () {
      const count = cartCount();
      cartBadges.forEach((badge) => {
        badge.textContent = String(count);
        badge.style.display = count > 0 ? "flex" : "none";
      });
    };
    function setQty(name, qty) {
      const item = cart.find((it) => it.name === name);
      if (!item) return;
      if (qty <= 0) {
        cart = cart.filter((it) => it.name !== name);
      } else {
        item.qty = qty;
      }
      saveCart();
      updateCartBadge();
      renderCart();
    }

    addToCart = function (name, priceStr) {
      const price = parsePriceToNumber(priceStr);
      const existing = cart.find((it) => it.name === name);
      if (existing) existing.qty += 1;
      else cart.push({ name, price, qty: 1 });
      saveCart();
      updateCartBadge();
    };

    function renderCart() {
      renderProductGrid();
      if (!cart.length) {
        cartEmpty.hidden = false;
        cartFilled.hidden = true;
        return;
      }
      cartEmpty.hidden = true;
      cartFilled.hidden = false;
      cartItemsList.innerHTML = "";
      cart.forEach((it) => {
        const img = getBurgerImg(it.name);
        const row = document.createElement("div");
        row.className = "cart-item-row";
        row.innerHTML =
          '<div class="cart-item-thumb">' + (img ? '<img src="' + esc(img) + '" alt="' + esc(it.name) + '">' : "<span>Photo</span>") + "</div>" +
          '<div class="cart-item-info">' +
          '<span class="cart-item-name">' + esc(it.name) + "</span>" +
          '<span class="cart-item-price">' + esc(formatPrice(it.price)) + " l'unité</span>" +
          "</div>" +
          '<div class="cart-item-right">' +
          '<span class="cart-item-line-total">' + esc(formatPrice(it.price * it.qty)) + "</span>" +
          '<div class="cart-item-qty">' +
          '<button type="button" class="cart-item-qty-btn" data-qty-minus aria-label="Retirer un">−</button>' +
          '<span class="cart-item-qty-value">' + it.qty + "</span>" +
          '<button type="button" class="cart-item-qty-btn" data-qty-plus aria-label="Ajouter un">+</button>' +
          "</div>" +
          "</div>";
        row.querySelector("[data-qty-minus]").addEventListener("click", () => setQty(it.name, it.qty - 1));
        row.querySelector("[data-qty-plus]").addEventListener("click", () => setQty(it.name, it.qty + 1));
        cartItemsList.appendChild(row);
      });
      const count = cartCount();
      cartCountLabel.textContent = "Articles (" + count + ")";
      cartSubtotalEl.textContent = formatPrice(cartTotal());
      cartTotalEl.textContent = formatPrice(cartTotal());
    }

    openCart = function () {
      renderCart();
      cartBackdrop.hidden = false;
      cartBox.style.animation = "bbPromoIn .4s cubic-bezier(.22,.9,.3,1) both";
    };
    closeCart = function () {
      cartBackdrop.hidden = true;
    };

    document.getElementById("cart-close").addEventListener("click", closeCart);
    cartBackdrop.addEventListener("click", (e) => { if (e.target === cartBackdrop) closeCart(); });
    document.getElementById("cart-clear").addEventListener("click", () => {
      cart = [];
      saveCart();
      updateCartBadge();
      renderCart();
    });
    document.getElementById("cart-checkout").addEventListener("click", () => {
      if (openUpsell) openUpsell();
    });

    loadCart();
    updateCartBadge();
  }

  const orderContactBackdrop = document.getElementById("order-contact-backdrop");
  if (orderContactBackdrop) {
    const closeOrderContact = () => { orderContactBackdrop.hidden = true; };
    document.getElementById("order-contact-close").addEventListener("click", closeOrderContact);
    orderContactBackdrop.addEventListener("click", (e) => { if (e.target === orderContactBackdrop) closeOrderContact(); });
  }

  (function burgerCarousel() {
    const track = document.getElementById("burger-track");
    if (!track) return;
    function scrollBurgers(dir) {
      const card = track.querySelector("[data-burger-card]");
      const step = card ? card.getBoundingClientRect().width + 22 : track.clientWidth * 0.8;
      const max = track.scrollWidth - track.clientWidth;
      const from = track.scrollLeft;
      const to = Math.max(0, Math.min(max, from + dir * step));
      const t0 = performance.now();
      const tick = (now) => {
        const p = Math.min(1, (now - t0) / 380);
        const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        track.scrollLeft = from + (to - from) * e;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
    $$("[data-burger-arrow]").forEach((btn) => {
      btn.addEventListener("click", () => scrollBurgers(btn.getAttribute("data-dir") === "prev" ? -1 : 1));
    });
  })();

  /* ---------------------------------------------------------------- */
  /* Notre carte: mode toggle, tabs, groups                            */
  /* ---------------------------------------------------------------- */
  function renderCarte() {
    const modeToggle = document.getElementById("mode-toggle");
    if (!modeToggle) return;
    const carte = CARTES[state.mode];
    const tabItems = orderedCategoryNames(carte);
    if (!carte[state.tab]) state.tab = tabItems[0];

    modeToggle.innerHTML = "";
    Object.keys(CARTES).forEach((m) => {
      const on = m === state.mode;
      const btn = el("button", { type: "button", style: "font-family:var(--font-heading); font-weight:600; font-size:14px; padding:11px 22px; border:none; cursor:pointer; white-space:nowrap; border-radius:var(--radius-badge); transition:all .15s ease; " + (on
        ? "background:linear-gradient(115deg,#2E8F7C 0%,var(--green-700) 30%,var(--color-primary) 62%,var(--green-900) 100%); color:var(--color-secondary); box-shadow:inset 0 1px 0 rgba(237,224,211,.3), inset 0 -1px 0 rgba(14,70,61,.5), 0 6px 18px rgba(18,87,76,.28);"
        : "background:transparent; color:var(--text-muted);") }, m === "Sur place" ? "Carte sur place" : "Carte à emporter");
      btn.addEventListener("click", () => { state.mode = m; state.tab = orderedCategoryNames(CARTES[m])[0]; renderCarte(); });
      modeToggle.appendChild(btn);
    });

    const tabsList = document.getElementById("tabs-list");
    tabsList.innerHTML = "";
    tabItems.forEach((t) => {
      const tab = el("button", { type: "button", class: "tab" + (t === state.tab ? " active" : "") }, esc(t));
      tab.addEventListener("click", () => { state.tab = t; renderCarte(); });
      tabsList.appendChild(tab);
    });

    const groups = carte[state.tab];
    const groupsEl = document.getElementById("carte-groups");
    groupsEl.innerHTML = "";
    groups.forEach((group) => {
      const wrap = el("div", {});
      const head = el("div", { style: "display:flex; align-items:center; gap:18px; flex-wrap:wrap;" });
      head.appendChild(el("h3", { style: "font-family:var(--font-heading); font-weight:700; font-size:12.5px; letter-spacing:.16em; text-transform:uppercase; margin:0; color:var(--color-primary); background:linear-gradient(115deg,#FFFBF6 0%,var(--cream-500) 45%,#D9C7B3 100%); box-shadow:inset 0 1px 0 rgba(255,255,255,.7), 0 6px 18px rgba(14,70,61,.3); padding:9px 20px; border-radius:var(--radius-badge);" }, esc(group.title)));
      head.appendChild(el("div", { style: "flex:1; height:1px; background:linear-gradient(90deg,rgba(237,224,211,.45),transparent); min-width:40px;" }));
      if (group.price) head.appendChild(el("span", { style: "font-family:var(--font-heading); font-weight:700; font-size:17px; color:var(--color-primary); background:linear-gradient(115deg,#FFFBF6 0%,var(--cream-500) 45%,#D9C7B3 100%); padding:8px 18px; border-radius:var(--radius-badge);" }, esc(stripEuro(group.price))));
      wrap.appendChild(head);
      if (group.note) wrap.appendChild(el("p", { style: "font-size:13.5px; line-height:1.6; color:rgba(237,224,211,.8); margin:16px 0 0; max-width:640px;" }, esc(group.note)));
      const grid = el("div", { style: "display:grid; grid-template-columns:1fr 1fr; gap:14px 24px; margin-top:24px;" });
      group.items.forEach((item) => {
        const row = el("div", { style: "position:relative; border-radius:var(--radius-photo); padding:20px 22px; background:var(--surface-alt); border:1px solid transparent; box-shadow:0 4px 14px rgba(44,44,42,.08);" });
        const line = el("div", { style: "display:flex; align-items:baseline; gap:12px;" });
        line.appendChild(el("span", { style: "font-family:var(--font-heading); font-weight:700; font-size:17.5px; line-height:1.25; letter-spacing:.01em; text-transform:uppercase; color:var(--color-primary);" }, esc(item.name)));
        line.appendChild(el("span", { style: "flex:1; min-width:16px; border-bottom:2px dotted var(--border-default); transform:translateY(-4px);" }));
        if (item.price) line.appendChild(el("span", { style: "font-family:var(--font-heading); font-weight:700; font-size:15px; color:var(--color-accent); background:rgba(181,101,29,.1); padding:5px 13px; border-radius:var(--radius-badge); white-space:nowrap;" }, esc(stripEuro(item.price))));
        row.appendChild(line);
        row.appendChild(el("div", { style: "font-size:14px; line-height:1.55; color:var(--text-muted); margin-top:9px; min-height:22px;" }, esc(item.desc || "")));
        grid.appendChild(row);
      });
      wrap.appendChild(grid);
      groupsEl.appendChild(wrap);
    });
  }
  renderCarte();

  /* ---------------------------------------------------------------- */
  /* Avis clients (paginated reviews)                                   */
  /* ---------------------------------------------------------------- */
  function renderReviews() {
    const grid = document.getElementById("reviews-grid");
    if (!grid) return;
    const pages = Math.ceil(REVIEWS.length / 2);
    state.reviewPage = ((state.reviewPage % pages) + pages) % pages;
    const slice = REVIEWS.slice(state.reviewPage * 2, state.reviewPage * 2 + 2);
    grid.innerHTML = "";
    slice.forEach((r) => {
      const card = el("div", { class: "card card-padded", style: "background:#FFFFFF; padding:30px;" });
      const head = el("div", { style: "display:flex; align-items:center; gap:14px;" });
      head.appendChild(el("div", { style: "width:46px; height:46px; border-radius:50%; background:linear-gradient(115deg,#2E8F7C 0%,var(--green-700) 30%,var(--color-primary) 62%,var(--green-900) 100%); box-shadow:inset 0 1px 0 rgba(237,224,211,.3), inset 0 -1px 0 rgba(14,70,61,.5), 0 6px 18px rgba(18,87,76,.28); display:flex; align-items:center; justify-content:center; color:var(--color-secondary); font-family:var(--font-heading); font-weight:700; font-size:15px;" }, esc(r.initials)));
      head.appendChild(el("div", {}, `<div style="font-family:var(--font-heading); font-weight:600; font-size:15.5px; color:var(--text-body);">${esc(r.name)}</div><div style="font-size:12.5px; color:var(--text-muted);">${esc(r.meta)}</div>`));
      head.appendChild(el("div", { style: "margin-left:auto; color:var(--color-primary); font-size:15px; letter-spacing:2px;" }, "★★★★★"));
      card.appendChild(head);
      card.appendChild(el("p", { style: "font-size:15px; line-height:1.7; color:var(--text-muted); margin:18px 0 0;" }, esc(r.text)));
      grid.appendChild(card);
    });
    const moreBtn = document.getElementById("reviews-more");
    if (moreBtn) moreBtn.hidden = pages < 2;
    const dots = document.getElementById("reviews-dots");
    dots.innerHTML = "";
    for (let i = 0; i < pages; i++) {
      const on = i === state.reviewPage;
      const dot = el("button", { type: "button", style: "width:" + (on ? "28px" : "9px") + "; height:9px; border-radius:var(--radius-badge); border:none; cursor:pointer; padding:0; transition:all .2s ease; background:" + (on ? "linear-gradient(115deg,#2E8F7C,var(--color-primary))" : "#C9B6A2") });
      dot.addEventListener("click", () => { state.reviewPage = i; renderReviews(); });
      dots.appendChild(dot);
    }
  }
  renderReviews();
  const reviewsMoreBtn = document.getElementById("reviews-more");
  if (reviewsMoreBtn) reviewsMoreBtn.addEventListener("click", () => { state.reviewPage += 1; renderReviews(); });

  /* ---------------------------------------------------------------- */
  /* FAQ accordion                                                      */
  /* ---------------------------------------------------------------- */
  function renderFaq() {
    const list = document.getElementById("faq-list");
    if (!list) return;
    list.innerHTML = "";
    FAQ.forEach((f, i) => {
      const open = state.faqOpen === i;
      const card = el("div", { class: "card", style: "background:#FFFFFF; overflow:hidden;" });
      const btn = el("button", { type: "button", style: "width:100%; display:flex; align-items:center; justify-content:space-between; gap:16px; background:transparent; border:none; padding:20px 24px; cursor:pointer; text-align:left; font-family:var(--font-heading); font-weight:600; font-size:16.5px; color:var(--color-primary);" },
        `<span>${esc(f.q)}</span><span style="font-family:var(--font-heading); font-weight:600; font-size:22px; line-height:1; color:var(--green-700); transition:transform .2s ease; transform:rotate(${open ? "45deg" : "0deg"})">+</span>`);
      btn.addEventListener("click", () => { state.faqOpen = open ? -1 : i; renderFaq(); });
      card.appendChild(btn);
      if (open) card.appendChild(el("div", { style: "padding:0 24px 22px; font-size:15px; line-height:1.7; color:var(--text-muted); white-space:pre-line;" }, esc(f.a)));
      list.appendChild(card);
    });
  }
  renderFaq();

  /* ---------------------------------------------------------------- */
  /* Blog                                                               */
  /* ---------------------------------------------------------------- */
  const blogBase = document.body.getAttribute("data-blog-base") !== null ? document.body.getAttribute("data-blog-base") : "blog/";
  const blogAssetBase = document.body.getAttribute("data-asset-base") !== null ? document.body.getAttribute("data-asset-base") : "";
  const blogImgUrl = (img) => (/^https?:\/\//.test(img) ? img : blogAssetBase + img);
  const blogDate = (iso) => {
    try {
      return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso + "T00:00:00"));
    } catch (e) {
      return iso;
    }
  };

  const readMinutes = (post) => Math.max(1, Math.round(String(post.body || "").split(/\s+/).filter(Boolean).length / 200));
  const blogMeta = (post) => `${esc(blogDate(post.date))} &bull; ${readMinutes(post)} min de lecture`;

  function blogCard(post, i) {
    const card = el("a", { class: "blog-post", href: blogBase + post.slug + ".html" });
    if (post.img) {
      card.appendChild(el("div", { class: "blog-post-img" }, `<img src="${esc(blogImgUrl(post.img))}" alt="${esc(post.imgAlt || post.title)}" loading="lazy">`));
    } else {
      card.appendChild(el("div", { class: "blog-post-img ph " + GRADS[i % 3] }, "Photo — " + esc(post.title)));
    }
    if (post.category) card.appendChild(el("span", { class: "blog-cat blog-cat-soft" }, esc(post.category)));
    card.appendChild(el("h3", {}, esc(post.title)));
    if (post.excerpt) card.appendChild(el("p", {}, esc(post.excerpt)));
    card.appendChild(el("div", { class: "blog-meta" }, blogMeta(post)));
    return card;
  }

  const ARROW_LEFT = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12H4M10 6l-6 6 6 6"></path></svg>';
  const ARROW_RIGHT = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16M14 6l6 6-6 6"></path></svg>';

  function renderBlog() {
    const sections = document.getElementById("blog-sections");
    if (!sections) return;
    const top = document.getElementById("blog-top");
    const featuredEl = document.getElementById("blog-featured");
    const latestEl = document.getElementById("blog-latest");
    const latestList = document.getElementById("blog-latest-list");
    sections.innerHTML = "";
    featuredEl.innerHTML = "";
    latestList.innerHTML = "";

    if (!POSTS.length) {
      top.hidden = true;
      sections.appendChild(el("p", { class: "blog-empty" }, "Les premiers articles arrivent bientôt."));
      return;
    }

    // À la une (grande carte) + liste des derniers articles à droite
    const [featured, ...rest] = POSTS;
    featuredEl.innerHTML =
      `<a class="blog-hero" href="${esc(blogBase + featured.slug)}.html">` +
      (featured.img ? `<img src="${esc(blogImgUrl(featured.img))}" alt="${esc(featured.title)}">` : "") +
      `<div class="blog-hero-shade"></div>` +
      `<div class="blog-hero-content"><span class="blog-hero-label">${esc(featured.category || "À la une")}</span>` +
      `<h2>${esc(featured.title)}</h2><div class="blog-hero-meta">${blogMeta(featured)}</div></div></a>`;

    const latest = rest.slice(0, 4);
    latestEl.hidden = !latest.length;
    top.classList.toggle("is-solo", !latest.length);
    latest.forEach((p, i) => {
      const a = el("a", { class: "blog-latest-item", href: blogBase + p.slug + ".html" });
      a.appendChild(p.img
        ? el("div", { class: "blog-latest-thumb" }, `<img src="${esc(blogImgUrl(p.img))}" alt="" loading="lazy">`)
        : el("div", { class: "blog-latest-thumb ph " + GRADS[i % 3] }, ""));
      a.appendChild(el("div", { class: "blog-latest-body" }, `<strong>${esc(p.title)}</strong><span>${blogMeta(p)}</span>`));
      latestList.appendChild(a);
    });

    // Une section par catégorie, avec flèches de défilement
    const groups = BLOG_CATEGORIES
      .filter((c) => POSTS.some((p) => p.category === c))
      .map((c) => ({ name: c, posts: POSTS.filter((p) => p.category === c) }));
    const others = POSTS.filter((p) => !p.category || !BLOG_CATEGORIES.includes(p.category));
    if (others.length) groups.push({ name: "Autres articles", posts: others });

    groups.forEach((g) => {
      const section = el("div", { class: "blog-cat-section" });
      section.appendChild(el("div", { class: "blog-cat-head" },
        `<h2>${esc(g.name)}</h2><div class="blog-arrows" hidden>` +
        `<button type="button" class="blog-arrow" data-blog-prev aria-label="Précédent">${ARROW_LEFT}</button>` +
        `<button type="button" class="blog-arrow" data-blog-next aria-label="Suivant">${ARROW_RIGHT}</button></div>`));
      const row = el("div", { class: "blog-row" });
      g.posts.forEach((p, i) => row.appendChild(blogCard(p, i)));
      section.appendChild(row);
      sections.appendChild(section);

      const arrows = section.querySelector(".blog-arrows");
      const prev = section.querySelector("[data-blog-prev]");
      const next = section.querySelector("[data-blog-next]");
      const update = () => {
        arrows.hidden = row.scrollWidth <= row.clientWidth + 4;
        prev.disabled = row.scrollLeft <= 2;
        next.disabled = row.scrollLeft + row.clientWidth >= row.scrollWidth - 2;
      };
      const step = () => (row.firstElementChild ? row.firstElementChild.getBoundingClientRect().width + 28 : 300);
      prev.addEventListener("click", () => row.scrollBy({ left: -step(), behavior: "smooth" }));
      next.addEventListener("click", () => row.scrollBy({ left: step(), behavior: "smooth" }));
      row.addEventListener("scroll", update, { passive: true });
      window.addEventListener("resize", update);
      requestAnimationFrame(update);
    });
  }
  renderBlog();

  /* Page article : contenu piloté par le CMS (?slug=… ou /blog/<slug>.html réécrit par Vercel) */
  function sanitizeArticleHtml(html) {
    const ALLOWED = { P: 1, BR: 1, H2: 1, H3: 1, H4: 1, STRONG: 1, B: 1, EM: 1, I: 1, U: 1, A: 1, UL: 1, OL: 1, LI: 1, BLOCKQUOTE: 1, IMG: 1 };
    const DROP = { SCRIPT: 1, STYLE: 1, IFRAME: 1, OBJECT: 1, EMBED: 1, FORM: 1, INPUT: 1, BUTTON: 1, TEXTAREA: 1, SELECT: 1, LINK: 1, META: 1, SVG: 1 };
    const normHref = (raw) => {
      const u = String(raw || "").trim();
      if (!u) return "";
      if (/^(https?:|mailto:|tel:)/i.test(u)) return u;
      if (/^javascript:|^data:|^vbscript:/i.test(u)) return "";
      if (u.charAt(0) === "/" || u.charAt(0) === "#") return u;
      if (/^[^\s\/]+\.[^\s\/]{2,}/.test(u)) return "https://" + u;
      return "";
    };
    const doc = new DOMParser().parseFromString("<body>" + String(html || "") + "</body>", "text/html");
    (function clean(node) {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === 3) return;
        if (child.nodeType !== 1) { child.remove(); return; }
        const tag = child.tagName;
        if (DROP[tag]) { child.remove(); return; }
        clean(child);
        if (!ALLOWED[tag]) { while (child.firstChild) node.insertBefore(child.firstChild, child); child.remove(); return; }
        if (tag === "A") {
          const href = normHref(child.getAttribute("href"));
          Array.from(child.attributes).forEach((a) => child.removeAttribute(a.name));
          if (!href) { while (child.firstChild) node.insertBefore(child.firstChild, child); child.remove(); return; }
          child.setAttribute("href", href);
          if (/^https?:/i.test(href)) { child.setAttribute("target", "_blank"); child.setAttribute("rel", "noopener noreferrer"); }
        } else if (tag === "IMG") {
          const src = String(child.getAttribute("src") || "").trim();
          const alt = child.getAttribute("alt") || "";
          Array.from(child.attributes).forEach((a) => child.removeAttribute(a.name));
          if (!/^https?:\/\//i.test(src)) { child.remove(); return; }
          child.setAttribute("src", src);
          child.setAttribute("alt", alt);
          child.setAttribute("loading", "lazy");
        } else {
          Array.from(child.attributes).forEach((a) => child.removeAttribute(a.name));
        }
      });
    })(doc.body);
    doc.body.querySelectorAll("p").forEach((p) => { if (!p.textContent.trim() && !p.querySelector("img")) p.remove(); });
    return doc.body.innerHTML.trim();
  }

  function articleBodyHtml(text) {
    if (/<(p|h[2-4]|ul|ol|blockquote|img|strong|em|a|br)[\s>\/]/i.test(String(text || ""))) return sanitizeArticleHtml(text);
    const inline = (s) => esc(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
      .replace(/(^|[\s(])@bistroburger_gardanne\b/g, '$1<a href="https://www.instagram.com/bistroburger_gardanne/" target="_blank" rel="noopener">@bistroburger_gardanne</a>');
    return String(text || "").replace(/\r/g, "").split(/\n{2,}/).map((block) => {
      const b = block.trim();
      if (!b) return "";
      if (b.startsWith("## ")) return "<h2>" + inline(b.slice(3)) + "</h2>";
      return "<p>" + inline(b).replace(/\n/g, "<br>") + "</p>";
    }).join("");
  }
  function setMeta(selector, attr, value) {
    const node = document.querySelector(selector);
    if (node) node.setAttribute(attr, value);
  }

  function renderArticle() {
    const root = document.getElementById("article-root");
    if (!root) return;
    let slug = new URLSearchParams(window.location.search).get("slug");
    if (!slug) {
      const m = window.location.pathname.match(/\/([^\/]+?)(?:\.html)?$/);
      slug = m ? decodeURIComponent(m[1]) : "";
    }
    const post = POSTS.find((p) => p.slug === slug);
    if (!post) {
      document.title = "Article introuvable — Blog Bistro Burger";
      root.innerHTML =
        `<a href="index.html" class="footer-link" style="display:block; color:var(--green-700); font-size:14px; font-weight:600;">← Retour au blog</a>` +
        `<h1 class="article-title">Cet article n'existe plus</h1>` +
        `<p class="article-body" style="margin-top:20px;">Il a peut-être été déplacé ou retiré. Retrouvez tous nos articles sur la page du blog.</p>`;
      return;
    }
    const origin = "https://bistroburgergardanne.com";
    const url = origin + "/blog/" + post.slug + ".html";
    const imgAbs = post.img ? (/^https?:\/\//.test(post.img) ? post.img : origin + "/" + post.img) : origin + "/assets/hero-burger.webp";
    const desc = post.seoDesc || post.excerpt || post.title;
    const pageTitle = post.seoTitle || (post.title + " — Blog Bistro Burger");
    document.title = pageTitle;
    setMeta('meta[name="description"]', "content", desc);
    setMeta('link[rel="canonical"]', "href", url);
    setMeta('meta[property="og:title"]', "content", pageTitle);
    setMeta('meta[property="og:description"]', "content", desc);
    setMeta('meta[property="og:url"]', "content", url);
    setMeta('meta[property="og:image"]', "content", imgAbs);
    const ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.textContent = JSON.stringify({
      "@context": "https://schema.org", "@type": "BlogPosting", headline: post.seoTitle || post.title, description: desc, image: imgAbs,
      datePublished: post.date, author: { "@type": "Organization", name: "Bistro Burger" }, publisher: { "@type": "Organization", name: "Bistro Burger" }
    });
    document.head.appendChild(ld);

    root.innerHTML =
      `<a href="index.html" class="footer-link" style="display:block; color:var(--green-700); font-size:14px; font-weight:600;">← Retour au blog</a>` +
      `<div class="article-meta">${post.category ? `<span class="blog-cat">${esc(post.category)}</span>` : ""}<span>Bistro Burger &bull; ${esc(blogDate(post.date))}</span></div>` +
      `<h1 class="article-title">${esc(post.title)}</h1>` +
      (post.img ? `<div class="article-cover"><img src="${esc(blogImgUrl(post.img))}" alt="${esc(post.imgAlt || post.title)}"></div>` : "") +
      `<div class="article-body">${articleBodyHtml(post.body)}</div>` +
      `<div class="article-actions"><button type="button" class="btn btn-primary btn-gradient" data-shine data-go="reservation">Réserver une table</button><button type="button" class="btn btn-outline" data-go="commander">Commander à emporter</button></div>` +
      `<div class="article-newsletter" style="margin-top:36px; padding:28px 26px; border-radius:var(--radius-card); background:linear-gradient(115deg,#2E8F7C 0%,var(--green-700) 30%,var(--color-primary) 62%,var(--green-900) 100%); color:var(--color-secondary); text-align:center;">` +
        `<div style="font-family:var(--font-heading); font-weight:700; font-size:22px; line-height:1.25;">Ne manquez plus nos offres</div>` +
        `<p style="font-size:15px; line-height:1.6; color:rgba(237,224,211,.85); margin:10px auto 0; max-width:460px;">Abonnez-vous à la newsletter : plat du jour, nouveautés de la carte et offres réservées aux abonnés.</p>` +
        `<form id="article-nl-form" style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap; margin-top:18px;">` +
          `<input type="email" name="email" required placeholder="votre@email.fr" aria-label="Votre adresse e-mail" style="flex:1; min-width:220px; max-width:320px; box-sizing:border-box; font-family:var(--font-body); font-size:16px; padding:13px 15px; border-radius:var(--radius-field); background:rgba(14,70,61,.32); border:1px solid rgba(237,224,211,.35); color:var(--color-secondary); outline:none;">` +
          `<button type="submit" class="btn btn-on-green btn-cream" data-shine>S'abonner à la newsletter</button>` +
        `</form>` +
        `<div id="article-nl-msg" hidden style="margin:14px auto 0; max-width:420px; border-radius:var(--radius-button); padding:11px; font-size:14px; background:rgba(237,224,211,.18); border:1px solid rgba(237,224,211,.4);"></div>` +
      `</div>`;

    const articleNlForm = document.getElementById("article-nl-form");
    if (articleNlForm) {
      const nlMsg = document.getElementById("article-nl-msg");
      articleNlForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = articleNlForm.querySelector("button[type=submit]");
        const label = btn.textContent;
        btn.disabled = true;
        btn.textContent = "Envoi…";
        nlMsg.hidden = true;
        try {
          const res = await fetch("/api/newsletter", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: new FormData(articleNlForm).get("email") }),
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(json.error || "Échec de l'inscription.");
          nlMsg.textContent = "Merci, votre inscription est enregistrée.";
          articleNlForm.reset();
        } catch (err) {
          nlMsg.textContent = err.message || "Échec de l'inscription.";
        }
        nlMsg.hidden = false;
        btn.disabled = false;
        btn.textContent = label;
      });
    }

    const related = POSTS.filter((p) => p.slug !== post.slug)
      .sort((a, b) => (b.category === post.category) - (a.category === post.category))
      .slice(0, 3);
    const relatedEl = document.getElementById("article-related");
    if (relatedEl && related.length) {
      relatedEl.hidden = false;
      const grid = relatedEl.querySelector(".blog-grid");
      related.forEach((p, i) => grid.appendChild(blogCard(p, i)));
    }
  }
  renderArticle();

  /* ---------------------------------------------------------------- */
  /* Band of photos (bottom marquee) — bande-5/6 use placeholders       */
  /* Défilement piloté en JS (requestAnimationFrame) plutôt qu'une      */
  /* animation CSS en boucle : évite le blocage/la disparition d'images */
  /* observés sur mobile (dérive du % CSS vs largeur réelle mesurée,    */
  /* et animation qui continue de tourner hors écran / onglet masqué). */
  /* ---------------------------------------------------------------- */
  (function renderBand() {
    const track = document.getElementById("band-track");
    if (!track) return;
    const sequence = [
      { img: "assets/bande-5.jpg", alt: "Cheeseburger et frites maison servis sur assiette" },
      { img: "assets/bande-1.webp", alt: "Bowl de poulet grillé, poivrons confits et riz" },
      { img: "assets/bande-6.jpg", alt: "Poulet mariné en pain pita avec frites maison" },
      { img: "assets/bande-2.webp", alt: "Penne à la crème de champignons et roquette" },
      { img: "assets/bande-4.webp", alt: "Entrecôte, gratin de pommes de terre et salade" },
      { img: "assets/bande-3.webp", alt: "Café, jus d'orange et viennoiserie en salle le matin" }
    ];
    const GAP = 16;

    function group(hidden) {
      const wrap = el("div", { style: "display:flex; gap:" + GAP + "px; padding:0 8px; flex:none;" });
      if (hidden) wrap.setAttribute("aria-hidden", "true");
      sequence.forEach((item) => {
        const card = el("div", { "data-band-card": "", style: "padding:9px; border-radius:18px; background:linear-gradient(135deg,#3AA48E,var(--green-700) 55%,var(--green-900)); box-shadow:0 12px 30px rgba(14,70,61,.3);" });
        const box = el("div", { style: "height:170px; border-radius:12px; overflow:hidden;" });
        box.innerHTML = `<img src="${esc(item.img)}" alt="${esc(item.alt)}" loading="lazy" style="width:100%; height:100%; object-fit:cover; display:block;">`;
        card.appendChild(box);
        wrap.appendChild(card);
      });
      return wrap;
    }

    track.style.animation = "none";
    track.style.display = "flex";
    track.style.gap = GAP + "px";
    track.innerHTML = "";
    const groupA = group(false);
    const groupB = group(true);
    track.appendChild(groupA);
    track.appendChild(groupB);

    let groupSpan = 0;
    function measure() {
      const w = groupA.getBoundingClientRect().width;
      if (w > 0) groupSpan = w + GAP;
    }
    measure();
    let resizeTimer = null;
    window.addEventListener("resize", () => {
      // iOS Safari déclenche "resize" quand la barre d'adresse se rétracte pendant le scroll :
      // on limite les remesures pour ne pas faire varier la vitesse en plein défilement.
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(measure, 200);
    });
    groupA.querySelectorAll("img").forEach((img) => {
      if (!img.complete) img.addEventListener("load", measure, { once: true });
    });

    const DURATION = 20; // secondes pour parcourir une largeur de groupe (même cadence qu'avant)
    let x = 0;
    let lastTs = null;
    let rafId = null;

    function tick(ts) {
      if (lastTs == null) lastTs = ts;
      const dt = Math.min((ts - lastTs) / 1000, 0.25); // ignore les gros écarts (tab remis au premier plan)
      lastTs = ts;
      if (groupSpan > 0) {
        x -= (groupSpan / DURATION) * dt;
        // Modulo (pas juste une soustraction) : reste valide même si groupSpan change
        // en plein vol (ex. une image en lazy-load qui finit de charger et redéclenche measure()),
        // ce qui pouvait faire défiler la bande au-delà du contenu réellement affiché.
        x = x % groupSpan;
        track.style.transform = "translate3d(" + x.toFixed(2) + "px,0,0)";
      }
      rafId = requestAnimationFrame(tick);
    }

    function play() {
      if (rafId != null) return;
      lastTs = null;
      rafId = requestAnimationFrame(tick);
    }
    function pause() {
      if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
    }

    // Reste en mouvement continu tant que l'onglet est actif : seul le passage
    // en arrière-plan met en pause (le va-et-vient hors-écran/à l'écran déclenchait
    // un bug de rendu sur Safari iOS qui faisait disparaître les images).
    track.style.willChange = "transform";
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) pause();
      else play();
    });

    play();
  })();

  /* ---------------------------------------------------------------- */
  /* Reveal-on-scroll                                                   */
  /* ---------------------------------------------------------------- */
  if (!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add("in"); io.unobserve(entry.target); }
      });
    }, { threshold: 0, rootMargin: "0px 0px -8% 0px" });
    document.querySelectorAll("[data-reveal]").forEach((elm) => io.observe(elm));
  } else {
    document.querySelectorAll("[data-reveal]").forEach((elm) => elm.classList.add("in"));
  }

  /* ---------------------------------------------------------------- */
  /* Masque le bouton flottant pendant qu'il recouvrirait le bouton     */
  /* "Réserver ma table" (les deux se superposent sinon en bas d'écran) */
  /* ---------------------------------------------------------------- */
  (function hideFloatingCtaOverForm() {
    const floatingCta = document.getElementById("floating-cta");
    const reservationForm = document.getElementById("reservation-form");
    if (!floatingCta || !reservationForm) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          floatingCta.style.visibility = entry.isIntersecting ? "hidden" : "visible";
          floatingCta.style.opacity = entry.isIntersecting ? "0" : "1";
        });
      },
      { threshold: 0, rootMargin: "0px 0px -90px 0px" }
    );
    io.observe(reservationForm);
  })();

  /* ---------------------------------------------------------------- */
  /* Reservation & newsletter forms (static site — no backend)         */
  /* ---------------------------------------------------------------- */
  (function reservationSubmit() {
    const form = document.getElementById("reservation-form");
    if (!form) return;
    form.setAttribute("novalidate", "novalidate");

    // Toujours repartir de la date du jour : le champ ne doit jamais garder
    // une date obsolète, et le client ne peut pas sélectionner une date passée.
    function formatLocalDate(d) {
      return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    }
    const dateInput = form.querySelector('input[name="date"]');
    const todayStr = formatLocalDate(new Date());
    if (dateInput) {
      dateInput.min = todayStr;
      if (!dateInput.value || dateInput.value < todayStr) dateInput.value = todayStr;
    }

    // Jours d'ouverture : fermé le samedi et le dimanche, le lundi seulement le midi (avant 15h).
    // Si la date sélectionnée est aujourd'hui, retire les créneaux trop proches :
    // il faut au moins 45 minutes d'avance (le temps de préparer la commande),
    // donc quelqu'un qui se connecte à midi ne peut pas réserver pour midi.
    // S'il n'en reste aucun (établissement fermé pour le reste de la journée),
    // on passe au lendemain.
    const MIN_LEAD_MINUTES = 45;
    const heureSelect = document.getElementById("reservation-heure-select");
    function updateAvailableHeures() {
      if (!heureSelect || !dateInput) return;
      const isToday = dateInput.value === todayStr;
      const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
      const minMinutes = nowMinutes + MIN_LEAD_MINUTES;
      const day = new Date(dateInput.value + "T00:00:00").getDay();
      let anyEnabled = false;
      let firstEnabledValue = null;
      Array.from(heureSelect.options).forEach((opt) => {
        const m = (opt.textContent || "").trim().match(/^(\d{1,2})h(\d{2})$/);
        const mins = m ? Number(m[1]) * 60 + Number(m[2]) : null;
        const tooSoon = isToday && mins !== null && mins < minMinutes;
        const closedByDay = day === 0 || day === 6 || (day === 1 && mins !== null && mins >= 15 * 60);
        const unavailable = tooSoon || closedByDay;
        opt.disabled = unavailable;
        opt.hidden = unavailable;
        if (!unavailable) {
          anyEnabled = true;
          if (firstEnabledValue === null) firstEnabledValue = opt.value || opt.textContent;
        }
      });
      if (!anyEnabled) {
        const next = new Date(dateInput.value + "T00:00:00");
        next.setDate(next.getDate() + 1);
        dateInput.value = formatLocalDate(next);
        updateAvailableHeures();
        return;
      }
      const selected = heureSelect.options[heureSelect.selectedIndex];
      if (!selected || selected.disabled) heureSelect.value = firstEnabledValue;
    }
    updateAvailableHeures();
    if (dateInput) dateInput.addEventListener("change", updateAvailableHeures);

    const sentBox = document.getElementById("reservation-sent");
    const errorBox = document.getElementById("reservation-error");
    const sendFailedMessage = errorBox.textContent;

    const recaptchaSiteKey = SITE_DATA.recaptchaSiteKey || "";
    const recaptchaBox = document.getElementById("reservation-recaptcha");
    let recaptchaWidgetId = null;
    if (recaptchaSiteKey && recaptchaBox) {
      recaptchaBox.hidden = false;
      window.__onRecaptchaLoad = function () {
        if (window.grecaptcha && recaptchaBox) {
          recaptchaWidgetId = window.grecaptcha.render(recaptchaBox, { sitekey: recaptchaSiteKey });
        }
      };
      const s = document.createElement("script");
      s.src = "https://www.google.com/recaptcha/api.js?onload=__onRecaptchaLoad&render=explicit";
      s.async = true;
      s.defer = true;
      document.head.appendChild(s);
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      sentBox.hidden = true;
      errorBox.hidden = true;
      if (!form.checkValidity()) {
        errorBox.textContent = "Merci de remplir tous les champs et d'accepter les conditions avant d'envoyer votre demande.";
        errorBox.hidden = false;
        errorBox.scrollIntoView({ behavior: "smooth", block: "center" });
        const firstInvalid = form.querySelector(":invalid");
        if (firstInvalid) firstInvalid.focus();
        return;
      }
      let recaptchaToken = "";
      if (recaptchaSiteKey && window.grecaptcha) {
        recaptchaToken = window.grecaptcha.getResponse(recaptchaWidgetId ?? undefined);
        if (!recaptchaToken) {
          errorBox.textContent = "Merci de valider le contrôle anti-robot avant d'envoyer votre demande.";
          errorBox.hidden = false;
          errorBox.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }
      }
      errorBox.textContent = sendFailedMessage;
      const submitBtn = form.querySelector("button[type=submit]");
      const originalLabel = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = "Envoi en cours…";
      try {
        const data = new FormData(form);
        const res = await fetch("/api/reservations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: data.get("nom"),
            email: data.get("email"),
            phone: data.get("tel"),
            date: data.get("date"),
            time: data.get("heure"),
            partySize: data.get("couverts"),
            recaptchaToken: recaptchaToken || undefined,
          }),
        });
        if (!res.ok) throw new Error("request failed");
        sentBox.hidden = false;
        form.reset();
        sentBox.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch (err) {
        errorBox.hidden = false;
        errorBox.scrollIntoView({ behavior: "smooth", block: "center" });
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalLabel;
        if (recaptchaSiteKey && window.grecaptcha) window.grecaptcha.reset(recaptchaWidgetId ?? undefined);
      }
    });
  })();
  if (document.getElementById("newsletter-form")) {
    const nlForm = document.getElementById("newsletter-form");
    const nlSent = document.getElementById("newsletter-sent");
    const nlError = document.getElementById("newsletter-error");
    nlForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      nlSent.hidden = true;
      nlError.hidden = true;
      const submitBtn = nlForm.querySelector("button[type=submit]");
      const originalLabel = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = "Envoi…";
      try {
        const email = new FormData(nlForm).get("email");
        const res = await fetch("/api/newsletter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || "Échec de l'inscription.");
        nlSent.hidden = false;
        nlForm.reset();
      } catch (err) {
        nlError.textContent = err.message || "L'inscription a échoué. Réessayez, ou appelez-nous directement.";
        nlError.hidden = false;
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalLabel;
      }
    });
  }

  /* ---------------------------------------------------------------- */
  /* Promo popup                                                        */
  /* ---------------------------------------------------------------- */
  const promoBackdrop = document.getElementById("promo-backdrop");
  if (promoBackdrop && OFFRES.length) {
    const PROMO_INDEX_KEY = "bb-promo-offer-index";
    const PROMO_FIRST_DELAY_MS = 110000;
    const PROMO_REPEAT_MS = 110000;

    const promoImgWrapEl = document.getElementById("promo-img-wrap");
    const promoImgEl = document.getElementById("promo-img");
    const promoBadgeEl = document.getElementById("promo-badge");
    const promoTitleEl = document.getElementById("promo-title");
    const promoDescEl = document.getElementById("promo-desc");
    const promoPriceEl = document.getElementById("promo-price");
    const promoReserveEl = document.getElementById("promo-reserve");

    // Les offres "menu" se réservent (table à venir manger sur place) ; les offres
    // "carte" (fidélité, cadeau) sont purement informatives, pas de table à réserver.
    function ctaForOffer(offer) {
      if (offer.tag === "Carte de fidélité" || offer.tag === "Carte cadeau") {
        return { label: "Voir toutes nos offres", go: "offres" };
      }
      return { label: "Réserver", go: "reservation" };
    }

    let currentPromoGo = "reservation";
    function renderPromoOffer(offer) {
      if (promoImgEl && offer.img) {
        promoImgEl.src = offer.img;
        promoImgEl.alt = offer.title || offer.tag || "";
        if (promoImgWrapEl) promoImgWrapEl.hidden = false;
      } else if (promoImgWrapEl) {
        promoImgWrapEl.hidden = true;
      }
      if (promoBadgeEl) promoBadgeEl.textContent = offer.tag || "Offre du moment";
      if (promoTitleEl) promoTitleEl.textContent = offer.title || "";
      if (promoDescEl) promoDescEl.textContent = offer.description || "";
      if (promoPriceEl) promoPriceEl.textContent = offer.price || "";
      const cta = ctaForOffer(offer);
      currentPromoGo = cta.go;
      if (promoReserveEl) promoReserveEl.textContent = cta.label;
    }

    function pickOfferIndex() {
      const now = new Date();
      const day = now.getDay();
      const hour = now.getHours();
      const isTuesdayEvening = day === 2 && hour >= 17;
      const isWednesdayLunch = day === 3 && hour < 14;
      if (isTuesdayEvening || isWednesdayLunch) {
        const childIdx = OFFRES.findIndex((o) => o.tag === "Menu enfant");
        if (childIdx !== -1) return childIdx;
      }
      try {
        const raw = localStorage.getItem(PROMO_INDEX_KEY);
        const stored = raw !== null ? parseInt(raw, 10) : -1;
        const next = Number.isFinite(stored) && stored >= 0 ? (stored + 1) % OFFRES.length : 0;
        localStorage.setItem(PROMO_INDEX_KEY, String(next));
        return next;
      } catch {
        return Math.floor(Math.random() * OFFRES.length);
      }
    }

    function openPromo() {
      renderPromoOffer(OFFRES[pickOfferIndex()] || {});
      promoBackdrop.hidden = false;
      document.getElementById("promo-box").style.animation = "bbPromoIn .55s cubic-bezier(.22,.9,.3,1) both";
    }
    function closePromo() { promoBackdrop.hidden = true; }
    function reservationInView() {
      const form = document.getElementById("reservation-form");
      if (!form) return false;
      const r = form.getBoundingClientRect();
      return r.top < window.innerHeight && r.bottom > 0;
    }
    function otherModalOpen() {
      return ["cart-backdrop", "upsell-backdrop", "order-contact-backdrop"].some((id) => {
        const el = document.getElementById(id);
        return el && !el.hidden;
      });
    }
    function tryOpenPromo() {
      if (reservationInView() || otherModalOpen()) { setTimeout(tryOpenPromo, 2000); return; }
      openPromo();
    }

    let promoCycleStarted = false;
    function startPromoCycle() {
      if (promoCycleStarted) return;
      promoCycleStarted = true;
      tryOpenPromo();
      setInterval(tryOpenPromo, PROMO_REPEAT_MS);
    }

    setTimeout(startPromoCycle, PROMO_FIRST_DELAY_MS);

    function onPromoScroll() {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      const ratio = scrollable > 0 ? (window.scrollY / scrollable) : 1;
      if (ratio >= 0.5) {
        window.removeEventListener("scroll", onPromoScroll);
        startPromoCycle();
      }
    }
    window.addEventListener("scroll", onPromoScroll, { passive: true });

    document.getElementById("promo-close").addEventListener("click", closePromo);
    promoBackdrop.addEventListener("click", (e) => { if (e.target === promoBackdrop) closePromo(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !promoBackdrop.hidden) closePromo(); });
    promoReserveEl.addEventListener("click", () => { closePromo(); jump(currentPromoGo); });
  }

  /* ---------------------------------------------------------------- */
  /* Upsell avant commande (supplément puis boisson)                   */
  /* ---------------------------------------------------------------- */
  const upsellBackdrop = document.getElementById("upsell-backdrop");
  if (upsellBackdrop) {
    function escHtml(s) {
      return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
      })[c]);
    }

    function getUpsellGroup(category, title) {
      const groups = (CARTES["À emporter"] && CARTES["À emporter"][category]) || [];
      const group = groups.find((g) => g.title === title);
      if (!group) return [];
      return [{
        label: null,
        items: group.items.map((it) => {
          const priceStr = it.price || group.price || "";
          return { name: it.name, price: priceStr, priceNum: parsePriceToNumber(priceStr) };
        }),
      }];
    }

    function getUpsellViande() { return getUpsellGroup("Menus & suppléments", "Suppléments viandes"); }
    function getUpsellFromage() { return getUpsellGroup("Menus & suppléments", "Suppléments fromages"); }
    function getUpsellBoissons() { return getUpsellGroup("Desserts & boissons", "Nos boissons"); }
    function getUpsellDesserts() { return getUpsellGroup("Desserts & boissons", "Nos desserts"); }

    const upsellBox = document.getElementById("upsell-box");
    const stepViande = document.getElementById("upsell-step-viande");
    const stepFromage = document.getElementById("upsell-step-fromage");
    const stepBoisson = document.getElementById("upsell-step-boisson");
    const stepDessert = document.getElementById("upsell-step-dessert");
    const stepRecap = document.getElementById("upsell-step-recap");
    const viandeList = document.getElementById("upsell-viande-list");
    const fromageList = document.getElementById("upsell-fromage-list");
    const boissonList = document.getElementById("upsell-boisson-list");
    const dessertList = document.getElementById("upsell-dessert-list");
    const recapItemsEl = document.getElementById("upsell-recap-items");
    const recapTotalEl = document.getElementById("upsell-recap-total");
    const continueBtn = document.getElementById("upsell-recap-continue");
    const boissonNextBtn = document.getElementById("upsell-boisson-next");

    let selectedViandes = [];
    let selectedFromages = [];
    let selectedBoissons = [];
    let selectedDesserts = [];
    let hasDesserts = false;
    let hasBoissons = false;

    function renderItemRows(container, groups, selectedArr) {
      container.innerHTML = "";
      groups.forEach((group) => {
        if (group.label) {
          const label = document.createElement("div");
          label.className = "upsell-group-label";
          label.textContent = group.label;
          container.appendChild(label);
        }
        group.items.forEach((item) => {
          const row = document.createElement("button");
          row.type = "button";
          row.className = "upsell-item";
          row.innerHTML =
            '<span class="upsell-item-name">' + escHtml(item.name) + "</span>" +
            '<span class="upsell-item-price">' + escHtml(item.price) + "</span>" +
            '<span class="upsell-item-check">+</span>';
          row.addEventListener("click", () => {
            const idx = selectedArr.findIndex((s) => s.name === item.name);
            if (idx === -1) {
              selectedArr.push({ name: item.name, priceNum: item.priceNum });
              row.classList.add("is-selected");
              row.querySelector(".upsell-item-check").textContent = "✓";
            } else {
              selectedArr.splice(idx, 1);
              row.classList.remove("is-selected");
              row.querySelector(".upsell-item-check").textContent = "+";
            }
          });
          container.appendChild(row);
        });
      });
    }

    function showStep(step) {
      stepViande.hidden = step !== "viande";
      stepFromage.hidden = step !== "fromage";
      stepBoisson.hidden = step !== "boisson";
      stepDessert.hidden = step !== "dessert";
      stepRecap.hidden = step !== "recap";
    }

    function closeUpsell() {
      upsellBackdrop.hidden = true;
    }

    function buildOrderItemsForApi() {
      const items = cart.map((it) => ({ name: it.name, qty: it.qty, price: it.price }));
      [].concat(selectedViandes, selectedFromages).forEach((s) => items.push({ name: "Supplément : " + s.name, qty: 1, price: s.priceNum }));
      selectedBoissons.forEach((s) => items.push({ name: "Boisson : " + s.name, qty: 1, price: s.priceNum }));
      selectedDesserts.forEach((s) => items.push({ name: "Dessert : " + s.name, qty: 1, price: s.priceNum }));
      return items;
    }

    function showRecap() {
      recapItemsEl.innerHTML = "";
      let total = 0;

      cart.forEach((it) => {
        total += it.price * it.qty;
        const row = document.createElement("div");
        row.style.cssText = "display:flex; justify-content:space-between; gap:10px;";
        row.innerHTML =
          "<span>" + escHtml(it.qty + " × " + it.name) + "</span>" +
          "<span>" + escHtml(formatPrice(it.price * it.qty)) + "</span>";
        recapItemsEl.appendChild(row);
      });
      [].concat(selectedViandes, selectedFromages).forEach((s) => {
        total += s.priceNum;
        const row = document.createElement("div");
        row.style.cssText = "display:flex; justify-content:space-between; gap:10px;";
        row.innerHTML = "<span>" + escHtml("Supplément : " + s.name) + "</span><span>" + escHtml(formatPrice(s.priceNum)) + "</span>";
        recapItemsEl.appendChild(row);
      });
      selectedBoissons.forEach((s) => {
        total += s.priceNum;
        const row = document.createElement("div");
        row.style.cssText = "display:flex; justify-content:space-between; gap:10px;";
        row.innerHTML = "<span>" + escHtml("Boisson : " + s.name) + "</span><span>" + escHtml(formatPrice(s.priceNum)) + "</span>";
        recapItemsEl.appendChild(row);
      });
      selectedDesserts.forEach((s) => {
        total += s.priceNum;
        const row = document.createElement("div");
        row.style.cssText = "display:flex; justify-content:space-between; gap:10px;";
        row.innerHTML = "<span>" + escHtml("Dessert : " + s.name) + "</span><span>" + escHtml(formatPrice(s.priceNum)) + "</span>";
        recapItemsEl.appendChild(row);
      });

      recapTotalEl.textContent = formatPrice(total);
      showStep("recap");
    }

    function goToDessertOrRecap() {
      if (hasDesserts) showStep("dessert");
      else showRecap();
    }

    function goToBoissonDessertOrRecap() {
      if (hasBoissons) showStep("boisson");
      else goToDessertOrRecap();
    }

    document.getElementById("upsell-close").addEventListener("click", closeUpsell);
    upsellBackdrop.addEventListener("click", (e) => { if (e.target === upsellBackdrop) closeUpsell(); });
    document.getElementById("upsell-viande-next").addEventListener("click", () => showStep("fromage"));
    document.getElementById("upsell-viande-skip").addEventListener("click", () => showStep("fromage"));
    document.getElementById("upsell-fromage-next").addEventListener("click", goToBoissonDessertOrRecap);
    document.getElementById("upsell-fromage-skip").addEventListener("click", goToBoissonDessertOrRecap);
    boissonNextBtn.addEventListener("click", goToDessertOrRecap);
    document.getElementById("upsell-boisson-skip").addEventListener("click", goToDessertOrRecap);
    document.getElementById("upsell-dessert-next").addEventListener("click", showRecap);
    document.getElementById("upsell-dessert-skip").addEventListener("click", showRecap);
    document.getElementById("upsell-recap-close").addEventListener("click", closeUpsell);
    function isValidPhone(raw) {
      const cleaned = raw.replace(/[\s.\-()]/g, "");
      return /^(0[1-9]\d{8}|\+33[1-9]\d{8}|0033[1-9]\d{8})$/.test(cleaned);
    }

    if (continueBtn) {
      continueBtn.addEventListener("click", async () => {
        const nameInput = document.getElementById("upsell-recap-name");
        const phoneInput = document.getElementById("upsell-recap-phone");
        const formError = document.getElementById("upsell-recap-form-error");
        const customerName = nameInput.value.trim();
        const customerPhone = phoneInput.value.trim();
        if (!customerName || !customerPhone) {
          formError.textContent = "Merci d'indiquer votre nom et votre téléphone.";
          formError.hidden = false;
          return;
        }
        if (!isValidPhone(customerPhone)) {
          formError.textContent = "Merci d'indiquer un numéro de téléphone valide (ex : 06 12 34 56 78).";
          formError.hidden = false;
          return;
        }
        formError.hidden = true;

        const originalLabel = continueBtn.textContent;
        continueBtn.disabled = true;
        continueBtn.textContent = "Envoi…";
        let saved = false;
        try {
          const res = await fetch("/api/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              customerName,
              customerPhone,
              items: buildOrderItemsForApi(),
              total: parsePriceToNumber(recapTotalEl.textContent),
            }),
          });
          saved = res.ok;
        } catch {}
        continueBtn.disabled = false;
        continueBtn.textContent = originalLabel;

        cart = [];
        try { localStorage.setItem("bb-cart-v1", "[]"); } catch {}
        if (updateCartBadge) updateCartBadge();
        closeUpsell();
        if (closeCart) closeCart();
        nameInput.value = "";
        phoneInput.value = "";
        const orderContactBackdrop = document.getElementById("order-contact-backdrop");
        const confirmMsg = document.getElementById("order-confirm-message");
        if (confirmMsg) {
          confirmMsg.hidden = false;
          if (saved) {
            confirmMsg.textContent = "✓ Votre commande a été enregistrée, préparez-vous à la recevoir.";
            confirmMsg.style.cssText = "font-family:var(--font-heading); font-weight:600; font-size:14.5px; padding:14px 16px; border-radius:var(--radius-field); margin:0 0 20px; background:rgba(46,143,124,.12); border:1px solid rgba(46,143,124,.4); color:var(--green-700);";
          } else {
            confirmMsg.textContent = "Votre commande n'a pas pu être enregistrée automatiquement : merci de nous appeler pour la confirmer.";
            confirmMsg.style.cssText = "font-family:var(--font-heading); font-weight:600; font-size:14.5px; padding:14px 16px; border-radius:var(--radius-field); margin:0 0 20px; background:rgba(181,101,29,.12); border:1px solid rgba(181,101,29,.4); color:#B5651D;";
          }
        }
        if (orderContactBackdrop) orderContactBackdrop.hidden = false;
      });
    }

    openUpsell = function () {
      selectedViandes = [];
      selectedFromages = [];
      selectedBoissons = [];
      selectedDesserts = [];
      const desserts = getUpsellDesserts();
      const boissons = getUpsellBoissons();
      hasDesserts = desserts.length > 0 && desserts[0].items.length > 0;
      hasBoissons = boissons.length > 0 && boissons[0].items.length > 0;
      boissonNextBtn.textContent = hasDesserts ? "Continuer" : "Voir ma commande";
      renderItemRows(viandeList, getUpsellViande(), selectedViandes);
      renderItemRows(fromageList, getUpsellFromage(), selectedFromages);
      renderItemRows(boissonList, boissons, selectedBoissons);
      renderItemRows(dessertList, desserts, selectedDesserts);
      showStep("viande");
      upsellBackdrop.hidden = false;
      upsellBox.style.animation = "bbPromoIn .4s cubic-bezier(.22,.9,.3,1) both";
    };
  }
})();
