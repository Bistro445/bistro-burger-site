"use strict";
/* Page « Devis traiteur ».
   Le parcours fonctionne dans le navigateur (choix, règles, calcul en direct, saisie gardée si on recharge).
   Le catalogue et les calculs sont dans devis-catalogue.js, partagé avec le serveur : à la validation,
   le serveur refait tout le calcul, numérote et enregistre le devis, puis l'envoie par e-mail (api/devis.js). */
(function () {
  if (!document.getElementById("dv-col")) return;
  var D = window.BBDevis;
  if (!D) return;

  /* ------------------------------------------------------------------ */
  /* Réglages et catalogue (devis-catalogue.js)                          */
  /* ------------------------------------------------------------------ */
  var CONFIG = D.CONFIG, FAMILIES = D.FAMILIES, PIECES = D.PIECES, FORMULAS = D.FORMULAS, BY_ID = D.BY_ID, DIETS = D.DIETS;
  function tagsHtml(t) { return (t || "").split(" ").filter(Boolean).map(function (x) { return '<span class="dv-tag" title="' + D.TAG_LABEL[x] + '">' + x + "</span>"; }).join(""); }

  /* ------------------------------------------------------------------ */
  /* Outils                                                              */
  /* ------------------------------------------------------------------ */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var eur = D.eur, int = D.int, plural = D.plural, sum = D.sum, pad2 = D.pad2, parseYmd = D.parseYmd, fmtTime = D.fmtTime, unitLabel = D.unitLabel;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function uid() { return "l" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function ymd(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
  function fmtDate(s) { var d = parseYmd(s); return d ? d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : ""; }

  /* ------------------------------------------------------------------ */
  /* Horaires (même source que le site : hours.js + données de l'admin)  */
  /* ------------------------------------------------------------------ */
  var HOURS = null;
  try { HOURS = window.BBHours ? window.BBHours.normalize((window.SITE_DATA || {}).horaires) : null; } catch (e) { HOURS = null; }
  function slotsFor(dateStr) { return D.slotsFor(dateStr, HOURS); }
  function slotDate(dateStr, min) { var d = parseYmd(dateStr); d.setHours(Math.floor(min / 60), min % 60, 0, 0); return d; }
  function minDate() { return new Date(Date.now() + CONFIG.delayHours * 3600 * 1000); }
  function slotOk(dateStr, min) { return slotDate(dateStr, min) >= minDate(); }
  function dayAvailable(dateStr) { return slotsFor(dateStr).some(function (s) { return slotOk(dateStr, s.min); }); }

  /* ------------------------------------------------------------------ */
  /* État (gardé dans le navigateur si on recharge la page)              */
  /* ------------------------------------------------------------------ */
  var KEY = "bbDevisTraiteur.v1";
  var state = { step: 1, fam: FAMILIES[0].id, event: { date: "", time: null, guests: 0, mode: "", commune: "" }, lines: [], units: {}, promo: "", contact: {}, calMonth: null };
  try { var saved = JSON.parse(localStorage.getItem(KEY) || "null"); if (saved && typeof saved === "object") state = Object.assign(state, saved, { event: Object.assign(state.event, saved.event || {}) }); } catch (e) { /* stockage indisponible : on repart de zéro */ }
  state.lines = (state.lines || []).filter(function (l) { return BY_ID[l.fid]; });
  Object.keys(state.units || {}).forEach(function (id) { if (!BY_ID[id]) delete state.units[id]; });
  if (!FAMILIES.some(function (f) { return f.id === state.fam; })) state.fam = FAMILIES[0].id;
  if (state.promo && !CONFIG.promo[state.promo]) state.promo = "";
  if (state.step === 3) state.step = 2;
  var draft = null; // formule en cours de composition
  var startedAt = Date.now(); // anti-robots : délai minimum avant l'envoi
  var sending = false;
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* rien */ } }

  /* ------------------------------------------------------------------ */
  /* Calculs (devis-catalogue.js)                                        */
  /* ------------------------------------------------------------------ */
  var linePrice = D.linePrice, lineErrors = D.lineErrors, lineDetail = D.lineDetail;
  function communeInfo() { return D.communeInfo(state); }
  function deliveryLine() { return D.deliveryLine(state); }
  function unitItems() { return D.unitItems(state); }
  function totals() { return D.totals(state); }

  /* ------------------------------------------------------------------ */
  /* Contrôles par étape                                                 */
  /* ------------------------------------------------------------------ */
  function eventErrors() {
    var ev = state.event, errs = [];
    if (!ev.date) errs.push("Choisissez la date de votre événement.");
    else if (!dayAvailable(ev.date)) errs.push("Cette date n'est plus disponible : commande au moins " + CONFIG.delayHours + " h à l'avance, les jours d'ouverture.");
    if (ev.date && ev.time == null) errs.push("Choisissez l'heure de livraison ou de retrait.");
    else if (ev.date && ev.time != null && !slotOk(ev.date, ev.time)) errs.push("Ce créneau est trop proche : il faut commander au moins " + CONFIG.delayHours + " h à l'avance.");
    if (int(ev.guests) < 1) errs.push("Indiquez le nombre de convives.");
    if (!ev.mode) errs.push("Choisissez livraison ou retrait à la brasserie.");
    if (ev.mode === "livraison" && !ev.commune) errs.push("Choisissez la commune de livraison.");
    return errs;
  }
  function orderErrors() { return D.orderErrors(state); }
  function showAlerts(id, list, kind) {
    var box = document.getElementById(id); if (!box) return;
    box.innerHTML = (list || []).map(function (m) { return '<div class="dv-alert' + (kind ? " is-" + kind : "") + '">' + esc(m) + "</div>"; }).join("");
  }

  /* ------------------------------------------------------------------ */
  /* Navigation entre les étapes                                         */
  /* ------------------------------------------------------------------ */
  function goTo(n, opts) {
    opts = opts || {};
    // Les produits se consultent librement ; l'événement (date, heure, convives, remise) est exigé pour le récapitulatif.
    if (n >= 4) { var ee = eventErrors(); if (ee.length) { n = 1; showAlerts("dv-alerts-1", ["Pour continuer, complétez d'abord votre événement :"].concat(ee)); } }
    if (n === 3 && !draft) n = 2;
    if (n === 5) { var oe = orderErrors(); if (oe.length) { n = state.lines.length || unitItems().length ? 4 : 2; showAlerts(n === 4 ? "dv-alerts-4" : "dv-alerts-2", oe); } }
    state.step = n; save();
    $$(".dv-panel").forEach(function (p) { p.hidden = String(p.getAttribute("data-panel")) !== String(n); });
    renderAll();
    closeSheet();
    if (!opts.noScroll) { var top = $("#dv-steps").getBoundingClientRect().top + window.pageYOffset - 84; window.scrollTo({ top: top, behavior: "smooth" }); }
  }

  /* ------------------------------------------------------------------ */
  /* Rendu : étapes                                                      */
  /* ------------------------------------------------------------------ */
  function renderSteps() {
    var hasItems = state.lines.length || unitItems().length;
    var done = { 1: !eventErrors().length, 2: hasItems, 3: state.lines.length > 0, 4: hasItems && state.step > 4, 5: false };
    $$("#dv-steps button").forEach(function (b) {
      var n = +b.getAttribute("data-goto");
      b.classList.toggle("is-current", n === state.step);
      b.classList.toggle("is-done", !!done[n] && n !== state.step);
      if (n === state.step) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
    });
  }

  /* Étape 1 : calendrier, créneaux, convives, mode */
  function renderCalendar() {
    var box = $("#dv-cal"), today = new Date(), first = new Date(today.getFullYear(), today.getMonth(), 1);
    if (!state.calMonth) { var md = minDate(); state.calMonth = ymd(new Date(md.getFullYear(), md.getMonth(), 1)); }
    var cm = parseYmd(state.calMonth), last = new Date(first.getFullYear(), first.getMonth() + CONFIG.monthsAhead, 1);
    var title = cm.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    var html = '<div class="dv-cal-head"><button type="button" class="dv-cal-nav" data-cal="-1" aria-label="Mois précédent"' + (cm <= first ? " disabled" : "") + '>‹</button>' +
      '<div class="dv-cal-title" aria-live="polite">' + esc(title) + '</div>' +
      '<button type="button" class="dv-cal-nav" data-cal="1" aria-label="Mois suivant"' + (cm >= last ? " disabled" : "") + '>›</button></div><div class="dv-cal-grid">';
    ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"].forEach(function (d) { html += '<div class="dv-cal-dow">' + d + "</div>"; });
    var lead = (cm.getDay() + 6) % 7, days = new Date(cm.getFullYear(), cm.getMonth() + 1, 0).getDate();
    for (var i = 0; i < lead; i++) html += '<div class="dv-cal-empty"></div>';
    for (var d = 1; d <= days; d++) {
      var ds = ymd(new Date(cm.getFullYear(), cm.getMonth(), d)), ok = dayAvailable(ds), sel = ds === state.event.date;
      html += '<button type="button" class="dv-cal-day' + (sel ? " is-selected" : "") + '" data-date="' + ds + '"' + (ok ? "" : " disabled") +
        ' aria-label="' + esc(fmtDate(ds)) + (ok ? "" : " (indisponible)") + '"' + (sel ? ' aria-pressed="true"' : "") + ">" + d + "</button>";
    }
    box.innerHTML = html + "</div>";
  }
  function renderTimes() {
    var box = $("#dv-times"), ev = state.event;
    if (!ev.date) { box.innerHTML = '<p class="dv-hint">Choisissez d\'abord une date.</p>'; return; }
    var slots = slotsFor(ev.date), html = "", lastGroup = -1;
    if (!slots.length) { box.innerHTML = '<p class="dv-hint">Le restaurant est fermé ce jour-là.</p>'; return; }
    slots.forEach(function (s) {
      if (s.group !== lastGroup) { html += '<div class="dv-chip-group">' + (s.min < 15 * 60 ? "Midi" : "Soir") + "</div>"; lastGroup = s.group; }
      var ok = slotOk(ev.date, s.min), sel = ev.time === s.min;
      html += '<button type="button" class="dv-chip' + (sel ? " is-selected" : "") + '" data-time="' + s.min + '"' + (ok ? "" : " disabled") + (sel ? ' aria-pressed="true"' : "") + ">" + fmtTime(s.min) + "</button>";
    });
    box.innerHTML = html;
  }
  function renderEventFields() {
    var ev = state.event, g = $("#dv-guests");
    if (document.activeElement !== g) g.value = ev.guests ? ev.guests : "";
    $$('input[name="dv-mode"]').forEach(function (r) { r.checked = r.value === ev.mode; });
    $("#dv-commune-wrap").hidden = ev.mode !== "livraison";
    $("#dv-commune").value = ev.commune || "";
    var hint = "", ci = communeInfo();
    if (ci && !ci.inZone) hint = "Cette commune est hors de notre zone habituelle : votre devis sera enregistré et nous vous recontacterons pour la livraison.";
    else if (ci) hint = int(ev.guests) >= CONFIG.freeDeliveryFrom ? "Livraison offerte : vous êtes au moins " + CONFIG.freeDeliveryFrom + "." : "Livraison offerte dès " + CONFIG.freeDeliveryFrom + " personnes. En dessous : " + (CONFIG.deliveryFee.toConfirm ? "frais confirmés par le restaurant lors de l'échange avec le gérant." : eur(CONFIG.deliveryFee.ht) + " HT" + (CONFIG.deliveryFee.ex ? " (montant d'exemple)" : "") + ".");
    $("#dv-delivery-hint").textContent = hint;
  }

  /* Étape 2 : onglets, formules, suppléments */
  function renderTabs() {
    $("#dv-tabs").innerHTML = FAMILIES.map(function (f) {
      var on = f.id === state.fam;
      return '<button type="button" class="tab' + (on ? " active" : "") + '" role="tab" aria-selected="' + on + '" data-fam="' + f.id + '">' + esc(f.label) + "</button>";
    }).join("");
    var fam = FAMILIES.filter(function (f) { return f.id === state.fam; })[0];
    $("#dv-fam-intro").textContent = fam ? fam.intro : "";
  }
  function qtyHtml(attr, value, label) {
    return '<span class="dv-qty"><button type="button" class="dv-qty-btn" ' + attr + ' data-step="-1" aria-label="Retirer : ' + esc(label) + '">−</button>' +
      '<input class="dv-input dv-qty-input" type="number" inputmode="numeric" min="0" value="' + int(value) + '" ' + attr + ' aria-label="Quantité : ' + esc(label) + '">' +
      '<button type="button" class="dv-qty-btn" ' + attr + ' data-step="1" aria-label="Ajouter : ' + esc(label) + '">+</button></span>';
  }
  function priceTag(f) {
    return eur(f.price) + " HT <small>/ " + esc(f.unit) + "</small>";
  }
  function renderFormulas() {
    var list = FORMULAS.filter(function (f) { return f.fam === state.fam; });
    var box = $("#dv-formulas");
    if (state.fam === "boissons") {
      box.className = "dv-extras-list";
      box.innerHTML = list.map(function (f) { return unitRow(f); }).join("");
      return;
    }
    box.className = "dv-formulas";
    box.innerHTML = list.map(function (f) {
      var inDevis = state.lines.filter(function (l) { return l.fid === f.id; }).length;
      var tag = f.ex ? '<span class="dv-formula-tag"><span class="dv-badge-ex">Prix d\'exemple</span></span>'
        : f.badge ? '<span class="dv-formula-tag"><span class="badge badge-cream">' + esc(f.badge) + "</span></span>" : "";
      var foot = f.type === "unit"
        ? '<div style="display:flex; justify-content:center;">' + qtyHtml('data-unit="' + f.id + '"', (state.units || {})[f.id], f.name).replace(/dv-qty-btn/g, "dv-qty-btn") + "</div>"
        : '<button type="button" class="btn btn-cream" data-compose="' + f.id + '">' + (inDevis ? "Composer à nouveau" : "Composer") + "</button>" +
          (inDevis ? '<div class="dv-formula-count">Déjà dans votre devis : ' + inDevis + " fois</div>" : "");
      return '<article class="dv-formula">' +
        '<div class="dv-formula-img">' + (f.img ? '<img src="' + f.img + '" alt="" loading="lazy" decoding="async">' : "") + tag + "</div>" +
        '<div class="dv-formula-body"><div class="dv-formula-name">' + esc(f.name) + "</div>" + (f.sub ? '<div class="dv-formula-sub">' + esc(f.sub) + "</div>" : "") +
        '<div class="dv-formula-desc">' + esc(f.desc || "") + "</div>" +
        '<div class="dv-formula-price">' + priceTag(f) + (f.serves ? " <small>· " + esc(f.serves) + "</small>" : "") + "</div>" +
        (f.min > 1 ? '<div class="dv-formula-min">Minimum ' + plural(f.min, unitLabel(f, 1), unitLabel(f, 2)) + (f.exMin || f.ex ? " (exemple)" : "") + "</div>" : "") +
        (f.priceNote ? '<div class="dv-formula-min">' + esc(f.priceNote) + "</div>" : "") +
        "</div>" + foot + "</article>";
    }).join("");
    // Sur fond vert, les compteurs prennent la couleur crème
    $$(".dv-formula .dv-qty-input", box).forEach(function (i) { i.style.background = "rgba(14,70,61,.35)"; i.style.color = "var(--color-secondary)"; i.style.borderColor = "rgba(237,224,211,.35)"; });
    $$(".dv-formula .dv-qty-btn", box).forEach(function (b) { b.style.background = "var(--color-secondary)"; b.style.borderColor = "var(--color-secondary)"; b.style.color = "var(--color-primary)"; });
  }
  function unitRow(f) {
    return '<div class="dv-row"><div><div class="dv-row-name">' + esc(f.name) + (f.ex ? ' <span class="dv-badge-ex">Exemple</span>' : "") + '</div><div class="dv-row-sub">' +
      eur(f.price) + " HT / " + esc(f.unit) + (f.tva === 20 ? " · TVA 20 %" : "") + "</div></div>" + qtyHtml('data-unit="' + f.id + '"', (state.units || {})[f.id], f.name) + "</div>";
  }
  function renderExtras() {
    var extras = FORMULAS.filter(function (f) { return f.fam === "extras"; });
    $(".dv-extras").hidden = !extras.length;
    $("#dv-extras").innerHTML = extras.map(unitRow).join("");
  }

  /* Étape 3 : composition */
  function newDraft(fid) {
    var f = BY_ID[fid], g = int(state.event.guests);
    var qty = f.type === "unit" ? 1 : Math.max(f.min || 1, g || 0);
    return { uid: null, fid: fid, qty: qty, dist: {}, chef: true, sel: { sal: [], suc: [] }, options: {}, diet: { veg: 0, vegan: 0, gf: 0 }, notes: "" };
  }
  function openComposer(fid, lineUid) {
    if (lineUid) { var l = state.lines.filter(function (x) { return x.uid === lineUid; })[0]; if (!l) return; draft = JSON.parse(JSON.stringify(l)); }
    else draft = newDraft(fid);
    goTo(3);
  }
  function countBadge(n, want) { return '<span class="dv-count' + (n === want ? " is-ok" : "") + '">' + n + " / " + want + "</span>"; }
  function renderComposer() {
    var box = $("#dv-composer");
    if (!draft) { box.innerHTML = ""; return; }
    var f = BY_ID[draft.fid], qty = int(draft.qty), unitWord = f.type === "cocktail" ? "personnes" : unitLabel(f, 2);
    var h = '<div class="dv-comp-head">' + (f.img ? '<div class="dv-comp-img"><img src="' + f.img + '" alt=""></div>' : "") +
      '<div><span class="dv-kicker">Étape 3 sur 5 · ' + esc(FAMILIES.filter(function (x) { return x.id === f.fam; })[0].label) + "</span>" +
      '<h2 id="dv-t3">' + esc(f.name) + '</h2><p class="dv-muted">' + esc(f.desc || "") + " " + eur(f.price) + " HT / " + esc(f.unit) + (f.ex ? ' <span class="dv-badge-ex">Prix d\'exemple</span>' : "") + "</p></div></div>";

    // Quantité
    h += '<div class="dv-comp-section"><div class="dv-comp-section-head"><h3>' + (f.type === "cocktail" ? "Nombre de personnes" : "Nombre de " + esc(unitWord)) + "</h3>" +
      (f.min > 1 ? '<span class="dv-hint">Minimum ' + f.min + (f.ex || f.exMin ? " (exemple)" : "") + "</span>" : "") + "</div>" +
      '<div style="margin-top:12px; display:flex; align-items:center; gap:14px; flex-wrap:wrap;">' + qtyHtml('data-d="qty"', qty, "quantité").replace("dv-qty", "dv-qty dv-qty-lg") +
      (int(state.event.guests) && qty !== int(state.event.guests) ? '<button type="button" class="dv-link" data-d-set-guests>Mettre ' + int(state.event.guests) + " (vos convives)</button>" : "") + "</div></div>";

    // Choix par catégorie (lunch boxes)
    if (f.type === "menu") f.slots.forEach(function (s) {
      var dist = draft.dist[s.key] || {}, n = sum(dist);
      h += '<div class="dv-comp-section"><div class="dv-comp-section-head"><h3>' + esc(s.label) + "</h3>" + countBadge(n, qty) + "</div>" +
        '<p class="dv-hint">Répartissez les ' + qty + " " + esc(unitWord) + " entre les choix.</p>";
      s.choices.forEach(function (c, i) {
        h += '<div class="dv-pick"><span class="dv-pick-name">' + esc(c) + '</span><span class="dv-pick-side">' +
          (qty ? '<button type="button" class="dv-link dv-all" data-d-all="dist|' + s.key + "|" + i + '">Tout</button>' : "") +
          qtyHtml('data-d="dist|' + s.key + "|" + i + '"', dist[i], s.label + " " + c) + "</span></div>";
      });
      h += "</div>";
    });

    // Pièces (cocktail)
    if (f.type === "cocktail") {
      draft.sel = draft.sel || { sal: [], suc: [] };
      h += '<div class="dv-comp-section"><h3>Votre sélection de bouchées</h3><div class="dv-toggle-row dv-seg">' +
        '<label><input type="radio" name="dv-chef" value="1"' + (draft.chef ? " checked" : "") + '><span>Laissez-nous faire</span></label>' +
        '<label><input type="radio" name="dv-chef" value="0"' + (!draft.chef ? " checked" : "") + "><span>Je compose ma sélection</span></label></div>";
      if (draft.chef) h += '<p class="dv-hint">Le chef compose une sélection variée de ' + f.sal + " pièces salées" + (f.suc ? " et " + f.suc + " sucrées" : "") + " par personne, soit " + f.sal * qty + (f.suc ? " + " + f.suc * qty : "") + " pièces pour " + qty + " personne" + (qty > 1 ? "s" : "") + ".</p>";
      else h += '<p class="dv-hint">Choisissez ' + f.sal + " bouchées salées" + (f.suc ? " et " + f.suc + " sucrées" : "") + " différentes : chaque convive en reçoit une de chaque. Nous équilibrons les quantités pour vous.</p>";
      h += "</div>";
      if (!draft.chef) [["sal", "Les pièces salées", f.sal], ["suc", "Les pièces sucrées", f.suc]].forEach(function (g) {
        if (!g[2]) return;
        var chosen = draft.sel[g[0]] = draft.sel[g[0]] || [], full = chosen.length >= g[2];
        h += '<div class="dv-comp-section"><div class="dv-comp-section-head"><h3>' + g[1] + "</h3>" + countBadge(chosen.length, g[2]) + "</div>";
        var groups = D.piecesFor(g[0], state.event.date);
        groups.forEach(function (grp) {
          if (groups.length > 1) h += '<div class="dv-piece-group' + (grp.noel ? " is-noel" : "") + '">' + esc(grp.group) + (grp.note ? " <span>" + esc(grp.note) + "</span>" : "") + "</div>";
          h += '<div class="dv-pieces">';
          grp.items.forEach(function (it) {
            var on = chosen.indexOf(it[0]) > -1;
            h += '<label class="dv-piece' + (on ? " is-on" : "") + (!on && full ? " is-off" : "") + '"><input type="checkbox" data-piece="' + g[0] + '" value="' + esc(it[0]) + '"' + (on ? " checked" : "") + (!on && full ? " disabled" : "") + ">" +
              '<span class="dv-check-box" aria-hidden="true"></span><span class="dv-piece-name">' + esc(it[0]) + "</span>" + tagsHtml(it[1]) + "</label>";
          });
          h += "</div>";
        });
        h += "</div>";
      });
    }

    // Options (plateaux)
    if (f.type === "base" && f.options && f.options.length) {
      h += '<div class="dv-comp-section"><h3>Options</h3><p class="dv-hint">En supplément, une par plateau au plus.</p>';
      f.options.forEach(function (o) {
        h += '<div class="dv-pick"><span class="dv-pick-name">' + esc(o.name) + ' <span class="dv-opt">+' + eur(o.price) + " HT" + ((o.tva || f.tva) === 20 ? " · TVA 20 %" : "") + "</span></span>" +
          qtyHtml('data-d="opt|' + o.id + '"', draft.options[o.id], o.name) + "</div>";
      });
      h += "</div>";
    }

    // Régimes et remarques (toujours proposés)
    if (f.type !== "unit") {
      h += '<div class="dv-comp-section"><h3>Régimes particuliers</h3><p class="dv-hint">Sans supplément. Indiquez combien de ' + esc(unitWord) + " sont concernées.</p>";
      DIETS.forEach(function (d) { h += '<div class="dv-pick"><span class="dv-pick-name">Dont ' + d.label.toLowerCase() + "</span>" + qtyHtml('data-d="diet|' + d.key + '"', draft.diet[d.key], d.label) + "</div>"; });
      h += '<div class="dv-block"><label class="dv-label" for="dv-notes">Allergies ou remarques pour cette formule <span class="dv-opt">(facultatif)</span></label>' +
        '<textarea id="dv-notes" class="dv-input" rows="2" maxlength="500" data-d-notes>' + esc(draft.notes) + "</textarea></div></div>";
    }

    var lp = linePrice(draft), errs = lineErrors(draft);
    h += '<div class="dv-comp-total"><div><span>Total de cette formule</span><br><strong>' + eur(lp.ht) + ' HT</strong></div>' +
      '<button type="button" class="btn btn-gradient" data-d-add>' + (draft.uid ? "Enregistrer les modifications" : "Ajouter au devis") + "</button></div>";
    h += '<div class="dv-alerts" id="dv-alerts-3" aria-live="polite">' + (draft._tried ? errs.map(function (e) { return '<div class="dv-alert">' + esc(e) + "</div>"; }).join("") : "") + "</div>";
    box.innerHTML = h;
  }
  function draftSet(path, val) {
    var p = path.split("|"), v = Math.max(0, int(val));
    if (p[0] === "qty") draft.qty = v;
    else if (p[0] === "dist") { draft.dist[p[1]] = draft.dist[p[1]] || {}; draft.dist[p[1]][p[2]] = v; }
    else if (p[0] === "pieces") { draft.pieces[p[1]] = draft.pieces[p[1]] || {}; draft.pieces[p[1]][p[2]] = v; }
    else if (p[0] === "opt") draft.options[p[1]] = v;
    else if (p[0] === "diet") draft.diet[p[1]] = v;
  }
  function draftGet(path) {
    var p = path.split("|");
    if (p[0] === "qty") return int(draft.qty);
    if (p[0] === "dist") return int((draft.dist[p[1]] || {})[p[2]]);
    if (p[0] === "pieces") return int((draft.pieces[p[1]] || {})[p[2]]);
    if (p[0] === "opt") return int(draft.options[p[1]]);
    if (p[0] === "diet") return int(draft.diet[p[1]]);
    return 0;
  }
  function addDraft() {
    draft._tried = true;
    var errs = lineErrors(draft);
    if (errs.length) { renderComposer(); renderBar(); var a = $("#dv-alerts-3"); if (a) a.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    var clean = JSON.parse(JSON.stringify(draft)); delete clean._tried;
    var f = BY_ID[clean.fid], msg;
    if (clean.uid) { state.lines = state.lines.map(function (l) { return l.uid === clean.uid ? clean : l; }); msg = "« " + f.name + " » a été mis à jour."; }
    else { clean.uid = uid(); state.lines.push(clean); msg = "« " + f.name + " » a été ajouté à votre devis."; }
    draft = null; save();
    goTo(clean.uid && msg.indexOf("mis à jour") > -1 ? 4 : 2);
    showAlerts(state.step === 4 ? "dv-alerts-4" : "dv-alerts-2", [msg], "ok");
  }

  /* Étape 4 : récapitulatif */
  function totalsHtml(t, big) {
    var h = "";
    if (t.discount) h += '<div class="dv-tot-row"><span>Remise (' + esc(state.promo) + ")</span><strong>− " + eur(t.discount) + " HT</strong></div>";
    if (t.delivery) h += '<div class="dv-tot-row"><span>' + esc(t.delivery.label) + "</span><strong>" + (t.delivery.note ? esc(t.delivery.note) : eur(t.delivery.ht) + " HT" + (t.delivery.ex ? " (ex.)" : "")) + "</strong></div>";
    h += '<div class="dv-tot-row"><span>Total HT</span><strong>' + eur(t.ht) + "</strong></div>";
    t.rates.forEach(function (r) { if (r.base) h += '<div class="dv-tot-row"><span>TVA ' + r.rate + " %</span><strong>" + eur(r.tva) + "</strong></div>"; });
    h += '<div class="dv-tot-row is-ttc"><span>Total TTC</span><strong>' + eur(t.ttc) + "</strong></div>";
    if (int(state.event.guests) && t.ttc) h += '<div class="dv-tot-row is-pp"><span>Par personne</span><strong>' + eur(t.perPersonHt) + " HT · " + eur(t.perPersonTtc) + " TTC</strong></div>";
    if (t.ttc) h += '<div class="dv-tot-row is-pp"><span>Acompte à la commande (' + CONFIG.depositPct + " %)</span><strong>" + eur(t.ttc * CONFIG.depositPct / 100) + " TTC</strong></div>";
    return h;
  }
  function renderRecap() {
    var box = $("#dv-recap"), t = totals(), units = unitItems();
    if (!state.lines.length && !units.length) { box.innerHTML = '<div class="dv-empty">Votre devis est vide pour l\'instant.<br><button type="button" class="dv-link" data-next="2">Choisir des formules</button></div>'; return; }
    var h = "";
    state.lines.forEach(function (l) {
      var f = BY_ID[l.fid], lp = linePrice(l), errs = lineErrors(l);
      h += '<div class="dv-recap-line"><div><div class="dv-recap-name">' + esc(f.name) + "</div>" +
        '<div class="dv-recap-detail">' + lineDetail(l).map(esc).join("<br>") + "</div>" +
        (errs.length ? '<div class="dv-alert" style="margin-top:8px;">' + errs.map(esc).join("<br>") + "</div>" : "") +
        '<div class="dv-recap-actions" style="margin-top:8px;"><button type="button" class="dv-link" data-edit="' + l.uid + '">Modifier</button><button type="button" class="dv-link is-danger" data-del="' + l.uid + '">Supprimer</button></div></div>' +
        '<div class="dv-recap-price">' + eur(lp.ht) + " HT<small>" + int(l.qty) + " × " + eur(f.price) + " · TVA " + f.tva + " %</small></div></div>";
    });
    units.forEach(function (u) {
      h += '<div class="dv-recap-line"><div><div class="dv-recap-name">' + esc(u.f.name) + '</div><div class="dv-recap-actions" style="margin-top:8px;">' + qtyHtml('data-unit="' + u.f.id + '"', u.qty, u.f.name) +
        '<button type="button" class="dv-link is-danger" data-unit-del="' + u.f.id + '">Supprimer</button></div></div>' +
        '<div class="dv-recap-price">' + eur(u.ht) + " HT<small>" + u.qty + " × " + eur(u.f.price) + " · TVA " + u.tva + " %</small></div></div>";
    });
    h += '<div class="dv-recap-totals">' + totalsHtml(t) + "</div>";
    box.innerHTML = h;
    $("#dv-promo").value = state.promo || "";
    $(".dv-promo").hidden = !Object.keys(CONFIG.promo).length;
  }

  /* Colonne « Votre devis » et barre du bas */
  function renderSummary() {
    var ev = state.event, t = totals(), parts = [];
    if (ev.date) parts.push("<strong>" + esc(fmtDate(ev.date)) + "</strong>" + (ev.time != null ? " à " + fmtTime(ev.time) : ""));
    if (int(ev.guests)) parts.push(plural(int(ev.guests), "convive", "convives"));
    if (ev.mode) parts.push(ev.mode === "livraison" ? "Livraison" + (ev.commune ? " à " + esc(ev.commune) : "") : "Retrait à la brasserie");
    $("#dv-sum-event").innerHTML = parts.join("<br>");
    var lines = state.lines.map(function (l) { var f = BY_ID[l.fid]; return '<div class="dv-sum-line"><span>' + esc(f.name) + " × " + int(l.qty) + "</span><span>" + eur(linePrice(l).ht) + " HT</span></div>"; })
      .concat(unitItems().map(function (u) { return '<div class="dv-sum-line"><span>' + esc(u.f.name) + " × " + u.qty + "</span><span>" + eur(u.ht) + " HT</span></div>"; }));
    $("#dv-sum-lines").innerHTML = lines.length ? lines.join("") : '<p class="dv-sum-empty">Aucune formule pour l\'instant.</p>';
    $("#dv-sum-totals").innerHTML = totalsHtml(t);
    $(".dv-sum-cta").hidden = state.step === 5;
  }
  var BAR_CTA = { 1: "Continuer", 2: "Récapitulatif", 3: "Ajouter", 4: "Coordonnées", 5: "Recevoir" };
  function renderBar() {
    var t = totals();
    $("#dv-bar-total").textContent = eur(t.ttc);
    $("#dv-bar-sub").textContent = t.count ? plural(t.count, "ligne", "lignes") + (int(state.event.guests) ? " · " + eur(t.perPersonTtc) + " / pers." : "") + " · voir le détail" : "Voir le détail";
    $("#dv-bar-cta").textContent = BAR_CTA[state.step] || "Continuer";
    $("#dv-bar-cta").hidden = state.step === 5 && !$("#dv-done").hidden;
  }
  function openSheet() { $("#dv-summary").scrollTop = 0; $("#dv-summary").classList.add("is-open"); $("#dv-sheet-shade").hidden = false; $("#dv-bar-open").setAttribute("aria-expanded", "true"); }
  function closeSheet() { $("#dv-summary").classList.remove("is-open"); $("#dv-sheet-shade").hidden = true; $("#dv-bar-open").setAttribute("aria-expanded", "false"); }

  /* Étape 5 : coordonnées */
  function fillContact() {
    var c = state.contact || {}, form = $("#dv-contact");
    $$('input[name="type"]', form).forEach(function (r) { r.checked = r.value === c.type; });
    ["nom", "societe", "siret", "tel", "email", "email2", "adresse", "cp", "facturation", "remarques"].forEach(function (k) { var el = form.elements[k]; if (el && c[k] != null && document.activeElement !== el) el.value = c[k]; });
    $("#c-fact-same").checked = c.factSame !== false;
    $("#c-rgpd").checked = !!c.rgpd; $("#c-offres").checked = !!c.offres;
  }
  function renderContact() {
    var c = state.contact || {}, ev = state.event, isCo = c.type === "entreprise";
    $$("[data-company]").forEach(function (el) { el.hidden = !isCo; });
    $("#dv-delivery-fields").hidden = ev.mode !== "livraison";
    // Commune de la zone : reprise de l'étape 1 (non modifiable). « Autre commune » : le client l'écrit lui-même.
    var horsZone = ev.commune === "Autre commune", ville = $("#c-ville");
    ville.readOnly = !horsZone;
    ville.placeholder = horsZone ? "Votre commune" : "";
    if (!horsZone) ville.value = ev.commune || "";
    else if (document.activeElement !== ville) ville.value = c.ville || "";
    if (ev.mode === "livraison" && !$("#c-cp").value) { var cm = CONFIG.communes.filter(function (x) { return x.name === ev.commune; })[0]; if (cm) $("#c-cp").value = cm.cp; }
    $("#dv-fact-wrap").hidden = $("#c-fact-same").checked;
    $("#c-rem-count").textContent = ($("#c-rem").value || "").length;
  }
  function readContact() {
    var form = $("#dv-contact"), c = {};
    var t = $('input[name="type"]:checked', form); c.type = t ? t.value : "";
    ["nom", "societe", "siret", "tel", "email", "email2", "adresse", "cp", "facturation", "remarques"].forEach(function (k) { c[k] = (form.elements[k].value || "").trim(); });
    c.ville = ($("#c-ville").value || "").trim();
    c.factSame = $("#c-fact-same").checked; c.rgpd = $("#c-rgpd").checked; c.offres = $("#c-offres").checked;
    state.contact = c; save(); return c;
  }
  function contactErrors(c) { return D.contactErrors(c, state.event); }

  // Envoi au serveur : il refait le calcul, numérote, enregistre et envoie les e-mails.
  function submitContact() {
    if (sending) return;
    var c = readContact(), r = contactErrors(c), form = $("#dv-contact");
    $$(".dv-input", form).forEach(function (el) { el.classList.toggle("is-invalid", r.bad.indexOf(el.name) > -1); el.setAttribute("aria-invalid", r.bad.indexOf(el.name) > -1 ? "true" : "false"); });
    var all = eventErrors().concat(orderErrors());
    if (all.length) { showAlerts("dv-alerts-5", ["Votre devis n'est pas complet :"].concat(all)); return; }
    if (r.errs.length) { showAlerts("dv-alerts-5", r.errs); var first = form.querySelector(".is-invalid"); if (first) first.focus(); return; }
    showAlerts("dv-alerts-5", [], "");
    var btn = form.querySelector('button[type="submit"]'), label = btn ? btn.textContent : "";
    sending = true;
    if (btn) { btn.disabled = true; btn.textContent = "Envoi en cours…"; }
    var payload = {
      event: state.event, lines: state.lines, units: state.units, promo: state.promo, contact: c,
      website: (form.elements.website && form.elements.website.value) || "", elapsed: Date.now() - startedAt,
    };
    fetch("/api/devis", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify(payload) })
      .then(function (res) { return res.json().catch(function () { return {}; }).then(function (j) { return { ok: res.ok, j: j }; }); })
      .then(function (r2) {
        sending = false;
        if (btn) { btn.disabled = false; btn.textContent = label; }
        if (!r2.ok || !r2.j.ok) {
          var errs = r2.j.errors && r2.j.errors.length ? r2.j.errors : [r2.j.error || "L'envoi n'a pas abouti. Réessayez ou appelez-nous au 04 65 84 89 18."];
          showAlerts("dv-alerts-5", errs); return;
        }
        showDone(c, r2.j);
      })
      .catch(function () {
        sending = false;
        if (btn) { btn.disabled = false; btn.textContent = label; }
        showAlerts("dv-alerts-5", ["Connexion impossible. Vérifiez votre connexion internet puis réessayez, ou appelez-nous au 04 65 84 89 18."]);
      });
  }

  function showDone(c, res) {
    var ev = state.event;
    $("#dv-contact-wrap").hidden = true;
    var done = $("#dv-done"); done.hidden = false;
    var mailOk = res.emailClient === "envoye";
    done.innerHTML = '<div class="dv-done"><div class="dv-done-mark" aria-hidden="true">✓</div>' +
      "<h2>Merci " + esc(String(c.nom || "").split(" ")[0]) + ", votre devis est prêt</h2>" +
      '<div class="dv-done-num">' + esc(res.numero) + "</div>" +
      '<p class="dv-muted">' + esc(fmtDate(ev.date)) + " à " + fmtTime(ev.time) + " · " + plural(int(ev.guests), "convive", "convives") + " · Total " + eur(res.totalTtc) + " TTC</p>" +
      '<ul class="dv-done-list">' +
      (mailOk ? "<li>Votre devis vient d'être envoyé à <strong>" + esc(c.email) + "</strong> (pensez à regarder dans les courriers indésirables).</li>"
        : "<li>Votre devis est enregistré. L'e-mail n'a pas pu partir pour l'instant : gardez le lien ci-dessous, le restaurant vous recontacte.</li>") +
      "<li>Le restaurant en a reçu une copie.</li>" +
      "<li><strong>Aucun devis n'est validé sans un échange préalable avec le gérant</strong> : il vous contacte pour faire le point sur votre événement.</li>" +
      "<li>Après cet échange, un acompte de " + CONFIG.depositPct + " % (" + eur(res.acompte) + " TTC) confirme la commande, à régler au restaurant par virement ou carte bancaire.</li></ul>" +
      '<div class="dv-done-actions">' +
      '<a class="btn btn-primary" href="' + esc(res.url) + '" target="_blank" rel="noopener">Voir, télécharger ou imprimer mon devis</a>' +
      '<button type="button" class="btn btn-gradient" id="dv-accept" data-token="' + esc(res.token) + '">Je souhaite valider ce devis</button></div>' +
      '<div class="dv-alerts" id="dv-alerts-done" aria-live="polite"></div>' +
      '<button type="button" class="dv-link" id="dv-new" style="margin-top:12px;">Faire un nouveau devis</button></div>';
    // Le devis est envoyé : la saisie suivante repart de zéro.
    try { localStorage.removeItem(KEY); } catch (err) { /* rien */ }
    $("#dv-bar").hidden = true;
    done.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function acceptDevis(b) {
    b.disabled = true; b.textContent = "Envoi…";
    fetch("/api/devis", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "accept", token: b.getAttribute("data-token") }) })
      .then(function (res) { return res.json().catch(function () { return {}; }).then(function (j) { return { ok: res.ok, j: j }; }); })
      .then(function (r) {
        if (!r.ok || !r.j.ok) { b.disabled = false; b.textContent = "Je souhaite valider ce devis"; showAlerts("dv-alerts-done", [r.j.error || "L'envoi n'a pas abouti. Appelez-nous au 04 65 84 89 18."]); return; }
        b.textContent = "Demande de validation envoyée";
        showAlerts("dv-alerts-done", ["C'est noté : le gérant est prévenu et vous contacte pour faire le point. Votre commande sera confirmée après le règlement de l'acompte (" + CONFIG.depositPct + " %) au restaurant, par virement ou carte bancaire."], "ok");
      })
      .catch(function () { b.disabled = false; b.textContent = "Je souhaite valider ce devis"; showAlerts("dv-alerts-done", ["Connexion impossible. Réessayez ou appelez-nous au 04 65 84 89 18."]); });
  }

  /* ------------------------------------------------------------------ */
  /* Rendu global                                                        */
  /* ------------------------------------------------------------------ */
  function renderAll() {
    renderSteps();
    if (state.step === 1) { renderCalendar(); renderTimes(); renderEventFields(); }
    if (state.step === 2) { renderTabs(); renderFormulas(); renderExtras(); }
    if (state.step === 3) renderComposer();
    if (state.step === 4) renderRecap();
    if (state.step === 5) renderContact();
    renderSummary(); renderBar();
  }

  /* ------------------------------------------------------------------ */
  /* Événements                                                          */
  /* ------------------------------------------------------------------ */
  // Communes
  $("#dv-commune").innerHTML = '<option value="">Choisir la commune</option>' + CONFIG.communes.map(function (c) { return '<option value="' + esc(c.name) + '">' + esc(c.name) + "</option>"; }).join("") + '<option value="Autre commune">Autre commune</option>';
  $$("[data-delay-label]").forEach(function (el) { el.textContent = CONFIG.delayHours + " h"; });

  function bumpQty(input, step) { input.value = Math.max(0, int(input.value) + step); input.dispatchEvent(new Event("change", { bubbles: true })); }

  document.addEventListener("click", function (e) {
    var b = e.target.closest("button, [data-next]"); if (!b) return;
    // Compteurs + / −
    if (b.classList.contains("dv-qty-btn")) {
      var input = b.parentNode.querySelector("input");
      if (input) bumpQty(input, +b.getAttribute("data-step"));
      return;
    }
    if (b.hasAttribute("data-goto")) { var n = +b.getAttribute("data-goto"); if (n === 3 && !draft) n = 2; goTo(n); return; }
    if (b.hasAttribute("data-next")) { goTo(+b.getAttribute("data-next")); return; }
    if (b.hasAttribute("data-cal")) { var cm = parseYmd(state.calMonth); state.calMonth = ymd(new Date(cm.getFullYear(), cm.getMonth() + +b.getAttribute("data-cal"), 1)); save(); renderCalendar(); return; }
    if (b.hasAttribute("data-date")) { state.event.date = b.getAttribute("data-date"); if (state.event.time != null && !slotsFor(state.event.date).some(function (s) { return s.min === state.event.time && slotOk(state.event.date, s.min); })) state.event.time = null; save(); renderCalendar(); renderTimes(); renderSteps(); renderSummary(); showAlerts("dv-alerts-1", []); return; }
    if (b.hasAttribute("data-time")) { state.event.time = +b.getAttribute("data-time"); save(); renderTimes(); renderSteps(); renderSummary(); return; }
    if (b.hasAttribute("data-fam")) { state.fam = b.getAttribute("data-fam"); save(); renderTabs(); renderFormulas(); return; }
    if (b.hasAttribute("data-compose")) { openComposer(b.getAttribute("data-compose")); return; }
    if (b.hasAttribute("data-d-add")) { addDraft(); return; }
    if (b.hasAttribute("data-d-set-guests")) { draft.qty = int(state.event.guests); renderComposer(); renderBar(); return; }
    if (b.hasAttribute("data-d-all")) { var p = b.getAttribute("data-d-all").split("|"); draft.dist[p[1]] = {}; draft.dist[p[1]][p[2]] = int(draft.qty); renderComposer(); return; }
    if (b.hasAttribute("data-edit")) { openComposer(null, b.getAttribute("data-edit")); return; }
    if (b.hasAttribute("data-del")) { var id = b.getAttribute("data-del"); state.lines = state.lines.filter(function (l) { return l.uid !== id; }); save(); renderAll(); return; }
    if (b.hasAttribute("data-unit-del")) { delete state.units[b.getAttribute("data-unit-del")]; save(); renderAll(); return; }
    if (b.id === "dv-promo-btn") {
      var code = ($("#dv-promo").value || "").trim().toUpperCase();
      if (!code) { state.promo = ""; $("#dv-promo-msg").textContent = ""; }
      else if (CONFIG.promo[code]) { state.promo = code; $("#dv-promo-msg").textContent = "Code appliqué : −" + CONFIG.promo[code].pct + " % sur les produits" + (CONFIG.promo[code].ex ? " (code d'exemple)" : "") + "."; }
      else { state.promo = ""; $("#dv-promo-msg").textContent = "Ce code n'est pas valable."; }
      save(); renderAll(); return;
    }
    if (b.id === "dv-reset") {
      if (!window.confirm("Effacer toute votre saisie et recommencer ?")) return;
      try { localStorage.removeItem(KEY); } catch (err) { /* rien */ }
      window.location.reload(); return;
    }
    if (b.id === "dv-bar-open") { if ($("#dv-summary").classList.contains("is-open")) closeSheet(); else openSheet(); return; }
    if (b.id === "dv-sum-close") { closeSheet(); return; }
    if (b.id === "dv-bar-cta") {
      var s = state.step;
      if (s === 1) goTo(2); else if (s === 2) goTo(4); else if (s === 3) addDraft(); else if (s === 4) goTo(5);
      else if (s === 5) { if (typeof $("#dv-contact").requestSubmit === "function") $("#dv-contact").requestSubmit(); else submitContact(); }
      return;
    }
    if (b.id === "dv-accept") { acceptDevis(b); return; }
    if (b.id === "dv-new") { try { localStorage.removeItem(KEY); } catch (err) { /* rien */ } window.location.reload(); return; }
  });
  $("#dv-sheet-shade").addEventListener("click", closeSheet);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeSheet(); });

  document.addEventListener("change", function (e) {
    var el = e.target;
    if (el.id === "dv-guests") { state.event.guests = Math.min(999, int(el.value)); el.value = state.event.guests || ""; save(); renderEventFields(); renderSteps(); renderSummary(); renderBar(); return; }
    if (el.name === "dv-mode") { state.event.mode = el.value; if (el.value !== "livraison") state.event.commune = ""; save(); renderEventFields(); renderSteps(); renderSummary(); renderBar(); return; }
    if (el.id === "dv-commune") { state.event.commune = el.value; save(); renderEventFields(); renderSteps(); renderSummary(); renderBar(); return; }
    if (el.hasAttribute("data-unit")) { var id = el.getAttribute("data-unit"), v = int(el.value); state.units = state.units || {}; if (v) state.units[id] = v; else delete state.units[id]; save(); if (state.step === 4) renderRecap(); else if (state.step === 2) { renderFormulas(); renderExtras(); } renderSteps(); renderSummary(); renderBar(); return; }
    if (draft && el.hasAttribute("data-d")) { draftSet(el.getAttribute("data-d"), el.value); renderComposer(); renderBar(); return; }
    if (draft && el.name === "dv-chef") { draft.chef = el.value === "1"; renderComposer(); return; }
    if (draft && el.hasAttribute("data-piece")) {
      var k = el.getAttribute("data-piece"), list = (draft.sel = draft.sel || { sal: [], suc: [] })[k] = draft.sel[k] || [];
      var pos = list.indexOf(el.value);
      if (el.checked && pos < 0) list.push(el.value); else if (!el.checked && pos > -1) list.splice(pos, 1);
      var y = window.pageYOffset; renderComposer(); window.scrollTo(0, y); return;
    }
    if (el.closest && el.closest("#dv-contact")) { readContact(); renderContact(); return; }
  });
  document.addEventListener("input", function (e) {
    var el = e.target;
    if (draft && el.hasAttribute("data-d-notes")) { draft.notes = el.value; return; }
    if (el.id === "c-rem") { $("#c-rem-count").textContent = el.value.length; }
    if (el.closest && el.closest("#dv-contact")) { readContact(); }
  });
  $("#dv-contact").addEventListener("submit", function (e) { e.preventDefault(); submitContact(); });

  // Démarrage
  fillContact();
  $$(".dv-panel").forEach(function (p) { p.hidden = String(p.getAttribute("data-panel")) !== String(state.step); });
  renderAll();
})();
