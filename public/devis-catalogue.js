"use strict";
/* Catalogue et calculs du « Devis traiteur », partagés entre la page (navigateur) et le serveur
   (api/devis.js). Le serveur refait TOUS les calculs avec ce même fichier au moment de la validation :
   un prix modifié dans le navigateur n'a donc aucun effet sur le devis enregistré.
   Les formules marquées « ex: true » ont des prix d'EXEMPLE, à remplacer par la carte définitive. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.BBDevis = api;
})(typeof self !== "undefined" ? self : this, function () {

  /* ------------------------------------------------------------------ */
  /* Réglages (seront modifiables dans l'admin)                          */
  /* ------------------------------------------------------------------ */
  var CONFIG = {
    delayHours: 96,              // délai minimum de commande (décision du restaurant, 25/11/2026)
    slotStep: 30,                // créneaux toutes les 30 min
    freeDeliveryFrom: 15,        // livraison offerte dès 15 personnes
    // Frais sous 15 personnes : pas encore fixés par le restaurant → « à confirmer » (0 € dans le total).
    // Quand le montant est connu : { ht: <montant>, tva: 10 }.
    deliveryFee: { ht: 0, tva: 10, toConfirm: true },
    // false : seules les formules aux prix réels de la carte « Cocktail & bouchées » sont proposées
    // (les formules marquées ex: true restent ici, masquées, jusqu'à ce que leurs vrais prix soient connus).
    showExamples: false,
    validityDays: 30,
    depositPct: 40,              // acompte demandé pour valider le devis (cahier des charges)
    monthsAhead: 6,
    communes: [
      { name: "Gardanne", cp: "13120" }, { name: "Biver", cp: "13120" }, { name: "Mimet", cp: "13105" },
      { name: "Simiane-Collongue", cp: "13109" }, { name: "Meyreuil", cp: "13590" }, { name: "Fuveau", cp: "13710" },
    ],
    promo: {}, // codes promo : { CODE: { pct: 10 } } (aucun pour l'instant)
  };

  /* ------------------------------------------------------------------ */
  /* Catalogue                                                           */
  /* ------------------------------------------------------------------ */
  var ALL_FAMILIES = [
    { id: "cocktail", label: "Cocktail & bouchées", intro: "Des buffets à partager, généreux et faits à la brasserie, pour vos réunions, séminaires et afterworks. Prix par personne, pièces au choix dans la carte des bouchées : composez votre sélection, ou laissez-nous faire." },
    { id: "partage", label: "Plateaux à partager", intro: "En supplément de toutes les formules. Prix par plateau : 1 plateau pour 8 à 10 personnes." },
    { id: "lunch", label: "Lunch boxes", ex: true, intro: "Une box individuelle par convive : vous répartissez les choix entre vos invités." },
    { id: "plateaux", label: "Plateaux", ex: true, intro: "Un plateau repas par convive : une base, puis des options si vous le souhaitez." },
    { id: "boissons", label: "Boissons", ex: true, intro: "À l'unité, en complément de vos formules." },
  ];
  var DRINKS_BOX = ["Eau minérale 50 cl", "Soda 33 cl", "Jus de fruits 25 cl"];
  var DESSERTS = ["Cookie maison", "Brownie maison", "Salade de fruits frais"];
  // Carte des bouchées d'hiver (source : BB-Carte-Cocktail-Traiteur-Hiver-26.pdf). Pictos : V végétarien, VG vegan, SG sans gluten.
  // Groupes « noel: true » : les bouchées de Noël, au choix dans toutes les formules sans supplément, en DÉCEMBRE seulement
  // (proposées si l'événement tombe en décembre ; refusées par le serveur sinon).
  var PIECES = {
    sal: [
      { group: "Les bouchées de Noël", note: "En décembre, au choix sans supplément", noel: true, items: [
        ["Mini burger de Noël : bœuf, comté & confit d'oignons"], ["Toast pain d'épices, chèvre & miel", "V"], ["Blini saumon fumé, crème à l'aneth"],
        ["Feuilleté de boudin blanc & pommes"], ["Pique magret fumé & clémentine", "SG"]] },
      { group: "Signatures BB", note: "Sur notre mini bun, sauce maison", items: [
        ["Mini burger bœuf, cheddar, sauce maison"], ["Mini burger poulet croustillant"], ["Mini burger veggie, galette légumes & pois chiches", "V"],
        ["Mini burger chèvre, miel & roquette", "V"], ["Mini burger effiloché de bœuf ou pulled pork"], ["Mini croque jambon-comté (option truffe)"], ["Mini hot-dog, sauce maison"]] },
      { group: "Toasts & tartines", note: "Sur le pain de notre boulanger", items: [
        ["Toast saumon gravlax, crème citronnée"], ["Toast rillettes de poulet ou de thon"], ["Bruschetta champignons & persillade", "VG"], ["Tartine chèvre, poire & noix", "V"],
        ["Toast tapenade ou anchoïade"], ["Tartine poireaux fondants & comté", "V"], ["Mini club sandwich"]] },
      { group: "Brochettes & piques", items: [
        ["Mozzarella, tomate confite & pesto", "V SG"], ["Poulet mariné", "SG"], ["Bœuf mariné, sauce BB"], ["Boulette de bœuf, sauce tomate"], ["Crevette ail & citron", "SG"], ["Légumes d'hiver rôtis", "VG SG"]] },
      { group: "Verrines & cuillères", items: [
        ["Velouté butternut & éclats de châtaigne", "VG SG"], ["Houmous & bâtonnets de crudités", "VG SG"], ["Houmous de betterave & graines", "VG SG"], ["Guacamole & crevette", "SG"],
        ["Quinoa, butternut rôti & grenade", "VG SG"], ["Mousseline de thon & guacamole"], ["Crevette, sauce chimichurri"]] },
      { group: "Wraps & roulés", items: [
        ["Wrap poulet & crudités"], ["Wrap poulet curry"], ["Wrap veggie", "V"], ["Roulés de tortilla saumon & fromage frais"], ["Pain suédois saumon & cream cheese"]] },
    ],
    suc: [
      { group: "Les bouchées de Noël", note: "En décembre, au choix sans supplément", noel: true, items: [
        ["Mini bûche chocolat-praliné"], ["Verrine crème de marrons & chantilly", "SG"], ["Truffes au chocolat maison", "SG"], ["Sablés de Noël à la cannelle"], ["Mendiants, clin d'œil aux 13 desserts", "SG"]] },
      { group: "Les pièces sucrées", items: [
        ["Brownie carré"], ["Mini cookie maison"], ["Mini pain perdu"], ["Mini panna cotta"], ["Mini tiramisu"], ["Mini mousse au chocolat"], ["Mini tropézienne"], ["Brochette de fruits d'hiver", "VG SG"]] },
    ],
  };
  // Les bouchées de Noël ne se commandent que pour un événement en décembre (date au format AAAA-MM-JJ).
  function isDecember(dateStr) { return /^\d{4}-12-\d{2}$/.test(String(dateStr || "")); }
  function piecesFor(kind, dateStr) { return PIECES[kind].filter(function (g) { return !g.noel || isDecember(dateStr); }); }
  var TAG_LABEL = { V: "Végétarien", VG: "Vegan", SG: "Sans gluten" };

  var ALL_FORMULAS = [
    { id: "lb-bistro", fam: "lunch", type: "menu", name: "Lunch box Bistro", desc: "Entrée, plat, dessert et boisson.", price: 16.5, tva: 10, unit: "box", min: 6, ex: true, img: "/assets/bande-5.jpg",
      slots: [
        { key: "entree", label: "Entrée", choices: ["Salade César", "Taboulé maison", "Velouté du moment"] },
        { key: "plat", label: "Plat", choices: ["Burger Smash", "Burger Cow-Boy", "Bowl poulet grillé", "Burger végétarien"] },
        { key: "dessert", label: "Dessert", choices: DESSERTS },
        { key: "boisson", label: "Boisson", choices: DRINKS_BOX },
      ] },
    { id: "lb-bowl", fam: "lunch", type: "menu", name: "Lunch box Bowl", desc: "Un bowl complet, un dessert et une boisson.", price: 14.5, tva: 10, unit: "box", min: 6, ex: true, img: "/assets/bande-1.webp",
      slots: [
        { key: "plat", label: "Bowl", choices: ["Bowl poulet grillé", "Bowl saumon", "Bowl falafels (végétarien)"] },
        { key: "dessert", label: "Dessert", choices: DESSERTS },
        { key: "boisson", label: "Boisson", choices: DRINKS_BOX },
      ] },

    { id: "pl-reveil", fam: "plateaux", type: "base", name: "Réveil", desc: "Viennoiseries, jus de fruits pressé et boisson chaude.", price: 9.5, tva: 10, unit: "plateau", min: 6, ex: true, img: "/assets/matin.webp",
      options: [{ id: "fruits", name: "Salade de fruits frais", price: 2.5 }, { id: "yaourt", name: "Yaourt et granola maison", price: 3 }] },
    { id: "pl-sliders", fam: "plateaux", type: "base", name: "Signature Sliders", desc: "Trio de mini-burgers maison, frites maison et sauce.", price: 19, tva: 10, unit: "plateau", min: 6, ex: true, img: "/assets/big-bb.jpg",
      options: [{ id: "slider", name: "Mini-burger supplémentaire", price: 4.5 }, { id: "dessert", name: "Dessert maison", price: 3.5 }] },
    { id: "pl-bowls", fam: "plateaux", type: "base", name: "Bowls & Grazing", desc: "Bowl complet, crudités et sauces à partager.", price: 17, tva: 10, unit: "plateau", min: 6, ex: true, img: "/assets/bande-3.webp",
      options: [{ id: "proteine", name: "Protéine en plus", price: 3 }, { id: "dessert", name: "Dessert maison", price: 3.5 }] },
    { id: "pl-cocktail", fam: "plateaux", type: "base", name: "Cocktail Dînatoire", desc: "Assortiment salé et sucré, façon apéritif dînatoire.", price: 22, tva: 10, unit: "plateau", min: 6, ex: true, img: "/assets/bande-4.webp",
      options: [{ id: "fromages", name: "Assiette de fromages", price: 4 }] },
    { id: "pl-comex", fam: "plateaux", type: "base", name: "Comex / Premium", desc: "Plateau complet : entrée, plat, fromage et dessert.", price: 29, tva: 10, unit: "plateau", min: 4, ex: true, img: "/assets/bande-6.jpg",
      options: [{ id: "vin", name: "Verre de vin", price: 4.5, tva: 20 }, { id: "cafe", name: "Café ou thé", price: 1.8 }] },
    { id: "pl-sucre", fam: "plateaux", type: "base", name: "Sucré & Café", desc: "Pâtisseries maison et boisson chaude.", price: 8, tva: 10, unit: "plateau", min: 6, ex: true, img: "/assets/bande-2.webp",
      options: [{ id: "jus", name: "Jus de fruits", price: 2 }] },

    // Formules cocktail et plateaux à partager : carte « Cocktail & bouchées » d'hiver 2026 (prix HT, cahier des charges).
    // Photos : celles de la carte (public/assets/traiteur/), extraites du PDF le 26/11/2026.
    { id: "co-aperitif", fam: "cocktail", type: "cocktail", name: "L'Apéritif", desc: "6 pièces salées par personne, 100 % salé.", price: 13, tva: 10, unit: "personne", sal: 6, suc: 0, min: 1, img: "/assets/traiteur/cocktail-verrines.jpg" },
    { id: "co-cocktail", fam: "cocktail", type: "cocktail", name: "Le Cocktail", desc: "8 pièces salées et 2 pièces sucrées par personne.", price: 20, tva: 10, unit: "personne", sal: 8, suc: 2, min: 1, badge: "Le plus demandé", img: "/assets/traiteur/cocktail-mini-burgers.jpg" },
    { id: "co-dinatoire", fam: "cocktail", type: "cocktail", name: "Le Dînatoire", desc: "10 pièces salées et 2 pièces sucrées par personne.", price: 23, tva: 10, unit: "personne", sal: 10, suc: 2, min: 1, img: "/assets/traiteur/cocktail-sandwichs.jpg" },

    { id: "pa-charcuterie", fam: "partage", type: "unit", name: "Plateau de charcuterie", sub: "La planche du bistrot", desc: "Une généreuse sélection de charcuteries, servie avec le pain de notre boulanger et nos pickles maison.", price: 40, tva: 10, unit: "plateau", min: 1, serves: "8 à 10 pers.", img: "/assets/traiteur/plateau-charcuterie.jpg" },
    { id: "pa-fromages", fam: "partage", type: "unit", name: "Plateau de fromages", sub: "Le plateau du fromager", desc: "Un assortiment de fromages affinés aux caractères variés, avec le pain de notre boulanger et des garnitures de saison.", price: 40, tva: 10, unit: "plateau", min: 1, serves: "8 à 10 pers.", img: "/assets/traiteur/plateau-fromages.jpg" },
    { id: "pa-crudites", fam: "partage", type: "unit", name: "Plateau crudités & dips", sub: "Le jardin méditerranéen", desc: "Légumes croquants de saison à tremper dans quatre dips maison : anchoïade, tapenade, houmous et tzatziki.", price: 25, tva: 10, unit: "plateau", min: 1, serves: "8 à 10 pers.", img: "/assets/traiteur/plateau-crudites.jpg" },

    { id: "bo-eau", fam: "boissons", type: "unit", name: "Eau minérale 1,5 L", price: 2.5, tva: 10, unit: "bouteille", ex: true },
    { id: "bo-gaz", fam: "boissons", type: "unit", name: "Eau gazeuse 1 L", price: 2.8, tva: 10, unit: "bouteille", ex: true },
    { id: "bo-soda", fam: "boissons", type: "unit", name: "Soda 33 cl", price: 2.2, tva: 10, unit: "canette", ex: true },
    { id: "bo-jus", fam: "boissons", type: "unit", name: "Jus de fruits 1 L", price: 4.5, tva: 10, unit: "bouteille", ex: true },
    { id: "bo-cafe", fam: "boissons", type: "unit", name: "Thermos de café (10 tasses)", price: 15, tva: 10, unit: "thermos", ex: true },
    { id: "bo-biere", fam: "boissons", type: "unit", name: "Bière 33 cl", price: 3.5, tva: 20, unit: "bouteille", ex: true },
    { id: "bo-vin", fam: "boissons", type: "unit", name: "Vin rouge ou rosé 75 cl", price: 16, tva: 20, unit: "bouteille", ex: true },

    { id: "ex-pain", fam: "extras", type: "unit", name: "Pain individuel", price: 0.5, tva: 10, unit: "pièce", ex: true },
    { id: "ex-couverts", fam: "extras", type: "unit", name: "Kit couverts et serviette", price: 0.8, tva: 10, unit: "kit", ex: true },
    { id: "ex-nappe", fam: "extras", type: "unit", name: "Nappe en tissu", price: 6, tva: 10, unit: "nappe", ex: true },
    { id: "ex-service", fam: "extras", type: "unit", name: "Service sur place (serveur)", price: 30, tva: 20, unit: "heure", ex: true },
  ];
  // Formules proposées : sans les prix d'exemple tant que CONFIG.showExamples vaut false.
  var FAMILIES = ALL_FAMILIES.filter(function (f) { return CONFIG.showExamples || !f.ex; });
  var FORMULAS = ALL_FORMULAS.filter(function (f) { return CONFIG.showExamples || !f.ex; });
  var BY_ID = {};
  FORMULAS.forEach(function (f) { BY_ID[f.id] = f; });
  var DIETS = [{ key: "veg", label: "Végétarien" }, { key: "vegan", label: "Vegan" }, { key: "gf", label: "Sans gluten" }];

  /* ------------------------------------------------------------------ */
  /* Outils                                                              */
  /* ------------------------------------------------------------------ */
  var money = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
  function round2(n) { return Math.round((n || 0) * 100) / 100; }
  function eur(n) { return money.format(round2(n)); }
  function int(v) { var n = parseInt(v, 10); return isNaN(n) || n < 0 ? 0 : n; }
  function plural(n, one, many) { return n + " " + (n > 1 ? many : one); }
  function sum(obj) { var t = 0; for (var k in obj) t += int(obj[k]); return t; }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function parseYmd(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ""); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  function fmtTime(min) { return Math.floor(min / 60) + "h" + pad2(min % 60); }
  function unitLabel(f, n) { var u = f.unit || "unité"; return n > 1 ? u.replace(/^(\S+)/, function (w) { return /[sx]$/.test(w) ? w : /eau$/.test(w) ? w + "x" : w + "s"; }) : u; }

  // Créneaux d'un jour selon les horaires d'ouverture (hours.js normalisé).
  var DAY_KEYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  function toMin(t) { var m = /^(\d{1,2}):(\d{2})$/.exec(String(t || "")); return m ? +m[1] * 60 + +m[2] : null; }
  function slotsFor(dateStr, hours) {
    var d = parseYmd(dateStr); if (!d || !hours || !hours.days) return [];
    var ranges = hours.days[DAY_KEYS[d.getDay()]] || [];
    var out = [];
    ranges.forEach(function (r, gi) {
      var a = toMin(r[0]), b = toMin(r[1]); if (a == null || b == null) return;
      for (var m = a; m <= b - CONFIG.slotStep; m += CONFIG.slotStep) out.push({ min: m, group: gi });
    });
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* Calculs (state = { event, lines, units, promo })                    */
  /* ------------------------------------------------------------------ */
  function linePrice(l) {
    var f = BY_ID[l.fid], qty = int(l.qty), parts = [];
    parts.push({ ht: qty * f.price, tva: f.tva });
    if (f.type === "base") (f.options || []).forEach(function (o) { var q = int((l.options || {})[o.id]); if (q) parts.push({ ht: q * o.price, tva: o.tva || f.tva }); });
    var ht = parts.reduce(function (t, p) { return t + p.ht; }, 0);
    return { ht: ht, parts: parts };
  }
  function lineErrors(l) {
    var f = BY_ID[l.fid], qty = int(l.qty), errs = [];
    if (qty < 1) errs.push("Indiquez une quantité.");
    else if (f.min && qty < f.min) errs.push("Minimum " + plural(f.min, unitLabel(f, 1), unitLabel(f, 2)) + " pour « " + f.name + " ».");
    if (f.type === "menu") f.slots.forEach(function (s) {
      var n = sum((l.dist || {})[s.key]);
      if (n !== qty) errs.push(s.label + " : " + n + " choisi" + (n > 1 ? "s" : "") + " sur " + qty + ".");
    });
    if (f.type === "cocktail" && !l.chef) {
      // La formule fixe le nombre de pièces par personne : le client choisit autant de bouchées différentes
      var sel = l.sel || {}, ns = (sel.sal || []).length, nu = (sel.suc || []).length;
      if (ns !== f.sal) errs.push("Pièces salées : " + ns + " choisie" + (ns > 1 ? "s" : "") + " sur " + f.sal + ".");
      if (f.suc && nu !== f.suc) errs.push("Pièces sucrées : " + nu + " choisie" + (nu > 1 ? "s" : "") + " sur " + f.suc + ".");
    }
    if (f.type === "base") (f.options || []).forEach(function (o) { if (int((l.options || {})[o.id]) > qty) errs.push(o.name + " : au plus " + qty + " (un par plateau)."); });
    var nd = sum(l.diet); if (nd > qty) errs.push("Régimes particuliers : " + nd + " indiqués pour " + qty + " " + unitLabel(f, qty) + ".");
    return errs;
  }
  function communeInfo(state) {
    var ev = state.event || {}; if (ev.mode !== "livraison" || !ev.commune) return null;
    var inZone = CONFIG.communes.some(function (c) { return c.name === ev.commune; });
    return { inZone: inZone };
  }
  function deliveryLine(state) {
    var ci = communeInfo(state); if (!ci) return null;
    if (!ci.inZone) return { label: "Livraison hors zone", ht: 0, tva: CONFIG.deliveryFee.tva, note: "nous consulter" };
    if (int(state.event.guests) >= CONFIG.freeDeliveryFrom) return { label: "Livraison", ht: 0, tva: CONFIG.deliveryFee.tva, note: "offerte" };
    if (CONFIG.deliveryFee.toConfirm) return { label: "Livraison (moins de " + CONFIG.freeDeliveryFrom + " pers.)", ht: 0, tva: CONFIG.deliveryFee.tva, note: "frais à confirmer" };
    return { label: "Livraison", ht: CONFIG.deliveryFee.ht, tva: CONFIG.deliveryFee.tva, ex: CONFIG.deliveryFee.ex };
  }
  function unitItems(state) {
    var units = state.units || {};
    return Object.keys(units).filter(function (id) { return BY_ID[id] && BY_ID[id].type === "unit" && int(units[id]) > 0; })
      .map(function (id) { var f = BY_ID[id], q = int(units[id]); return { f: f, qty: q, ht: q * f.price, tva: f.tva }; });
  }
  function totals(state) {
    var byTva = {}, productsHt = 0;
    function add(ht, tva) { byTva[tva] = (byTva[tva] || 0) + ht; }
    (state.lines || []).forEach(function (l) { linePrice(l).parts.forEach(function (p) { add(p.ht, p.tva); productsHt += p.ht; }); });
    unitItems(state).forEach(function (u) { add(u.ht, u.tva); productsHt += u.ht; });
    var promo = CONFIG.promo[state.promo] || null, discount = 0;
    if (promo && productsHt > 0) {
      discount = productsHt * promo.pct / 100;
      for (var k in byTva) byTva[k] -= byTva[k] * promo.pct / 100; // remise répartie au prorata des taux
    }
    var dl = deliveryLine(state); if (dl && dl.ht) add(dl.ht, dl.tva);
    var ht = 0, tvaTot = 0, rates = [];
    Object.keys(byTva).sort().forEach(function (r) { var base = byTva[r], t = base * Number(r) / 100; ht += base; tvaTot += t; rates.push({ rate: Number(r), base: base, tva: t }); });
    var guests = int((state.event || {}).guests), ttc = ht + tvaTot;
    return { productsHt: productsHt, discount: discount, promo: promo, delivery: dl, ht: ht, tva: tvaTot, ttc: ttc, rates: rates,
      perPersonHt: guests ? ht / guests : 0, perPersonTtc: guests ? ttc / guests : 0, deposit: ttc * CONFIG.depositPct / 100,
      count: (state.lines || []).length + unitItems(state).length };
  }
  function orderErrors(state) {
    var errs = [];
    if (!(state.lines || []).length && !unitItems(state).length) errs.push("Ajoutez au moins une formule à votre devis.");
    (state.lines || []).forEach(function (l) { lineErrors(l).forEach(function (e) { errs.push(e); }); });
    // Bouchées de Noël choisies alors que l'événement n'est pas en décembre
    if (!isDecember((state.event || {}).date)) (state.lines || []).forEach(function (l) {
      var f = BY_ID[l.fid], sel = l.sel || {}; if (!f || f.type !== "cocktail" || l.chef) return;
      var noel = [];
      ["sal", "suc"].forEach(function (k) { PIECES[k].forEach(function (g) { if (g.noel) g.items.forEach(function (it) { if ((sel[k] || []).indexOf(it[0]) > -1) noel.push(it[0]); }); }); });
      if (noel.length) errs.push("Les bouchées de Noël ne sont proposées qu'en décembre : remplacez « " + noel.join(" », « ") + " » dans « " + f.name + " ».");
    });
    return errs;
  }

  // Détail lisible d'une ligne (récapitulatif, devis, e-mails).
  var DIET_PL = { veg: ["végétarien", "végétariens"], vegan: ["vegan", "vegans"], gf: ["sans gluten", "sans gluten"] };
  function lineDetail(l) {
    var f = BY_ID[l.fid], bits = [], qty = int(l.qty);
    if (f.type === "menu") f.slots.forEach(function (s) {
      var d = (l.dist || {})[s.key] || {}, parts = [];
      s.choices.forEach(function (c, i) { if (int(d[i])) parts.push(int(d[i]) + " × " + c); });
      if (parts.length) bits.push(s.label + " : " + parts.join(", "));
    });
    if (f.type === "cocktail") {
      if (l.chef) bits.push("Sélection du chef : " + f.sal + " pièces salées" + (f.suc ? " et " + f.suc + " sucrées" : "") + " par personne (" + (f.sal + f.suc) * qty + " pièces)");
      else {
        var sel = l.sel || {};
        if ((sel.sal || []).length) bits.push("Salées : " + sel.sal.join(", "));
        if ((sel.suc || []).length) bits.push("Sucrées : " + sel.suc.join(", "));
        bits.push((f.sal + f.suc) * qty + " pièces au total");
      }
    }
    if (f.type === "base") (f.options || []).forEach(function (o) { var q = int((l.options || {})[o.id]); if (q) bits.push("Option " + o.name + " : " + q + " × " + eur(o.price) + " HT"); });
    var dd = DIETS.filter(function (d) { return int((l.diet || {})[d.key]); }).map(function (d) { var n = int(l.diet[d.key]); return n + " " + DIET_PL[d.key][n > 1 ? 1 : 0]; });
    if (dd.length) bits.push("Dont " + dd.join(", "));
    if (l.notes) bits.push("Remarque : " + l.notes);
    return bits;
  }

  /* Coordonnées : mêmes contrôles sur la page et sur le serveur. */
  function contactErrors(c, ev) {
    var errs = [], bad = [];
    c = c || {}; ev = ev || {};
    function s(v) { return String(v == null ? "" : v).trim(); }
    function req(cond, field, msg) { if (!cond) { errs.push(msg); if (field) bad.push(field); } }
    req(c.type === "entreprise" || c.type === "particulier" || c.type === "association", null, "Indiquez si vous êtes une entreprise, un particulier ou une association.");
    req(s(c.nom), "nom", "Indiquez votre nom et prénom.");
    if (c.type === "entreprise") req(s(c.societe), "societe", "Indiquez le nom de votre société.");
    var siret = s(c.siret).replace(/\s/g, ""); if (c.type === "entreprise" && siret) req(/^\d{14}$/.test(siret), "siret", "Le SIRET doit compter 14 chiffres.");
    var tel = s(c.tel).replace(/[\s.\-()]/g, ""); req(/^0[1-9]\d{8}$/.test(tel) || /^\+\d{8,15}$/.test(tel), "tel", "Indiquez un numéro de téléphone valide.");
    req(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s(c.email)), "email", "Indiquez une adresse e-mail valide.");
    if (s(c.email)) req(s(c.email).toLowerCase() === s(c.email2).toLowerCase(), "email2", "Les deux adresses e-mail ne sont pas identiques.");
    if (ev.mode === "livraison") { req(s(c.adresse), "adresse", "Indiquez l'adresse de livraison."); req(/^\d{5}$/.test(s(c.cp)), "cp", "Indiquez un code postal à 5 chiffres."); if (ev.commune === "Autre commune") req(s(c.ville), "ville", "Indiquez votre commune."); }
    if (c.factSame === false) req(s(c.facturation), "facturation", "Indiquez l'adresse de facturation.");
    req(c.rgpd === true, null, "Cochez la case d'accord pour que nous puissions établir votre devis.");
    return { errs: errs, bad: bad };
  }

  /* Nettoyage des choix envoyés par le navigateur (côté serveur) : on ne garde que ce qui existe au catalogue. */
  function sanitize(input) {
    input = input || {};
    var ev = input.event || {};
    var allPieces = { sal: [], suc: [] };
    ["sal", "suc"].forEach(function (k) { piecesFor(k, ev.date).forEach(function (g) { g.items.forEach(function (it) { allPieces[k].push(it[0]); }); }); });
    var out = {
      event: {
        date: /^\d{4}-\d{2}-\d{2}$/.test(String(ev.date || "")) ? ev.date : "",
        time: ev.time == null || ev.time === "" ? null : Math.min(24 * 60, int(ev.time)),
        guests: Math.min(999, int(ev.guests)),
        mode: ev.mode === "livraison" || ev.mode === "retrait" ? ev.mode : "",
        commune: String(ev.commune || "").slice(0, 80),
      },
      lines: [], units: {},
      promo: CONFIG.promo[String(input.promo || "").toUpperCase()] ? String(input.promo).toUpperCase() : "",
    };
    if (out.event.mode !== "livraison") out.event.commune = "";
    (Array.isArray(input.lines) ? input.lines : []).slice(0, 40).forEach(function (l) {
      var f = l && BY_ID[l.fid]; if (!f || f.type === "unit") return;
      var c = { fid: f.id, qty: Math.min(9999, int(l.qty)), dist: {}, chef: f.type === "cocktail" ? l.chef !== false : false, sel: { sal: [], suc: [] }, options: {}, diet: {}, notes: String(l.notes || "").slice(0, 500) };
      if (f.type === "menu") f.slots.forEach(function (s) {
        var src = (l.dist || {})[s.key] || {}, d = {};
        s.choices.forEach(function (ch, i) { var n = int(src[i]); if (n) d[i] = Math.min(9999, n); });
        c.dist[s.key] = d;
      });
      if (f.type === "cocktail" && !c.chef) ["sal", "suc"].forEach(function (k) {
        var seen = {};
        ((l.sel || {})[k] || []).forEach(function (p) { if (allPieces[k].indexOf(p) > -1 && !seen[p]) { seen[p] = 1; c.sel[k].push(p); } });
      });
      if (f.type === "base") (f.options || []).forEach(function (o) { var n = int((l.options || {})[o.id]); if (n) c.options[o.id] = Math.min(9999, n); });
      DIETS.forEach(function (d) { var n = int((l.diet || {})[d.key]); if (n) c.diet[d.key] = Math.min(9999, n); });
      out.lines.push(c);
    });
    var units = input.units || {};
    Object.keys(units).slice(0, 60).forEach(function (id) { var f = BY_ID[id], n = int(units[id]); if (f && f.type === "unit" && n) out.units[id] = Math.min(999, n); });
    return out;
  }

  /* Lignes détaillées du devis (document, e-mails, admin), montants arrondis au centime. */
  function devisLines(state) {
    var rows = [];
    (state.lines || []).forEach(function (l) {
      var f = BY_ID[l.fid], lp = linePrice(l);
      rows.push({ name: f.name, detail: lineDetail(l), qty: int(l.qty), unit: unitLabel(f, int(l.qty)), pu: f.price, ht: round2(lp.ht), tva: f.tva, ex: !!f.ex,
        tvaMix: lp.parts.some(function (p) { return p.tva !== f.tva; }) });
    });
    unitItems(state).forEach(function (u) {
      rows.push({ name: u.f.name, detail: u.f.serves ? ["Pour " + u.f.serves] : [], qty: u.qty, unit: unitLabel(u.f, u.qty), pu: u.f.price, ht: round2(u.ht), tva: u.tva, ex: !!u.f.ex });
    });
    return rows;
  }

  return {
    CONFIG: CONFIG, FAMILIES: FAMILIES, PIECES: PIECES, TAG_LABEL: TAG_LABEL, FORMULAS: FORMULAS, BY_ID: BY_ID, DIETS: DIETS,
    isDecember: isDecember, piecesFor: piecesFor,
    eur: eur, round2: round2, int: int, plural: plural, sum: sum, pad2: pad2, parseYmd: parseYmd, fmtTime: fmtTime, unitLabel: unitLabel,
    slotsFor: slotsFor, linePrice: linePrice, lineErrors: lineErrors, communeInfo: communeInfo, deliveryLine: deliveryLine,
    unitItems: unitItems, totals: totals, orderErrors: orderErrors, lineDetail: lineDetail, contactErrors: contactErrors,
    sanitize: sanitize, devisLines: devisLines,
  };
});
