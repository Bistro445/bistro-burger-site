"use strict";
/* Page « Noël au Bistro ».
   - Formulaire : envoyé à /api/demande (e-mail au restaurant + accusé de réception au client).
   - Suivi : chaque élément [data-track] est compté par /api/track (chiffres dans l'admin).
   - Textes et PDF : saisis dans l'admin, rubrique « Page Noël » (voir lib/noelPage.js). Un PDF s'active dès qu'il
     est déposé ; son adresse /noel/<fichier>.pdf ne change jamais. Tant qu'il manque : « bientôt disponible ». */
(function () {
  var form = document.getElementById("nl-form");
  if (!form) return;

  // Sur l'ordinateur de travail (maquette locale), les envois partent vers le vrai serveur ; les clics ne sont pas comptés.
  var LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var API = LOCAL ? "https://bistroburgergardanne.com" : "";
  var openedAt = Date.now();

  /* ------------------------------------------------------------------ */
  /* Suivi des clics                                                     */
  /* ------------------------------------------------------------------ */
  function track(name) {
    if (LOCAL || !name) return;
    try {
      var payload = JSON.stringify({ page: "noel", event: name });
      if (navigator.sendBeacon) navigator.sendBeacon("/api/track", new Blob([payload], { type: "application/json" }));
      else fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true });
    } catch (e) { /* le suivi ne doit jamais gêner le visiteur */ }
  }
  track("page-vue");
  document.addEventListener("click", function (e) {
    var el = e.target.closest && e.target.closest("[data-track]");
    if (el && !el.classList.contains("nl-soon")) track(el.getAttribute("data-track"));
  });

  /* ------------------------------------------------------------------ */
  /* Documents téléchargeables                                           */
  /* ------------------------------------------------------------------ */
  // Contenu saisi dans l'admin (rubrique « Page Noël ») : textes des cases à compléter et PDF déposés.
  // Le serveur l'écrit déjà dans la page ; ce rattrapage sert à la maquette locale.
  var NOEL = (window.SITE_DATA || {}).noel || {};
  var TEXTES = NOEL.textes || {};
  Array.prototype.forEach.call(document.querySelectorAll(".nl-todo[data-noel]"), function (el) {
    var v = String(TEXTES[el.getAttribute("data-noel")] || "").trim();
    if (!v) return;
    el.textContent = "";
    v.split(/\r?\n/).forEach(function (line, i) { if (i) el.appendChild(document.createElement("br")); el.appendChild(document.createTextNode(line)); });
    el.classList.remove("nl-todo");
  });

  // Adresses fixes des PDF (le serveur renvoie vers le fichier actuel) : les liens partagés restent bons.
  var DOCS = {
    "complet": "/noel/noel-2026-offres-et-carte-traiteur.pdf",
    "offres": "/noel/noel-2026-nos-offres.pdf",
    "menu-fetes": "/noel/menu-de-fetes.pdf",
    "listing-traiteur": "/noel/listing-traiteur-noel.pdf",
    "emporter": "/noel/menu-noel-a-emporter.pdf",
    "buffet": "/noel/buffet-du-lendemain.pdf",
  };
  var DEPOSES = NOEL.docs || {};
  // Le texte d'origine est mémorisé : la mention « bientôt » s'ajoute ou s'enlève sans jamais s'empiler.
  function setDoc(key, ok) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-doc="' + key + '"]'), function (a) {
      var target = a.querySelector(".nl-doc-sub") || a;
      if (target.getAttribute("data-label") == null) target.setAttribute("data-label", target.textContent);
      var label = target.getAttribute("data-label");
      if (ok) {
        a.href = LOCAL ? DEPOSES[key].url : DOCS[key];
        a.target = "_blank";
        a.rel = "noopener";
        a.classList.remove("nl-soon");
        a.removeAttribute("aria-disabled");
        a.removeAttribute("title");
        target.textContent = label;
        return;
      }
      a.removeAttribute("href");
      a.classList.add("nl-soon");
      a.setAttribute("aria-disabled", "true");
      a.title = "Bientôt disponible";
      target.textContent = label + (target === a ? " · bientôt" : " · bientôt disponible");
    });
  }
  Object.keys(DOCS).forEach(function (key) { setDoc(key, !!(DEPOSES[key] && DEPOSES[key].url)); });

  /* ------------------------------------------------------------------ */
  /* Boutons « Demander… » : pré-remplit la prestation du formulaire     */
  /* ------------------------------------------------------------------ */
  var sel = document.getElementById("f-prestation");
  Array.prototype.forEach.call(document.querySelectorAll("[data-offre]"), function (b) {
    b.addEventListener("click", function () {
      var v = b.getAttribute("data-offre");
      Array.prototype.forEach.call(sel.options, function (o) { if (o.text === v) sel.value = o.value || o.text; });
    });
  });

  /* Société visible seulement pour une entreprise ou une association */
  function syncType() {
    var t = form.querySelector('input[name="type"]:checked');
    document.getElementById("f-societe-wrap").hidden = !t || t.value === "particulier";
  }
  Array.prototype.forEach.call(form.querySelectorAll('input[name="type"]'), function (r) { r.addEventListener("change", syncType); });
  syncType();

  /* Date minimale : aujourd'hui */
  (function () { var d = new Date(), p = function (n) { return (n < 10 ? "0" : "") + n; }; form.elements.date.min = d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()); })();

  /* ------------------------------------------------------------------ */
  /* Envoi                                                               */
  /* ------------------------------------------------------------------ */
  function esc(s) { return String(s || "").replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var box = document.getElementById("nl-alerts");
  function showErrors(list) { box.innerHTML = list.map(function (m) { return '<div class="nl-alert">' + esc(m) + "</div>"; }).join(""); }
  var sending = false;

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (sending) return;
    var f = form.elements, errs = [], bad = [];
    function req(ok, name, msg) { if (!ok) { errs.push(msg); if (name) bad.push(name); } }
    var type = (form.querySelector('input[name="type"]:checked') || {}).value || "particulier";
    req(f.prestation.value, "prestation", "Choisissez la prestation qui vous intéresse.");
    req(f.date.value, "date", "Indiquez la date souhaitée.");
    req(parseInt(f.personnes.value, 10) > 0, "personnes", "Indiquez le nombre de personnes.");
    if (type !== "particulier") req(f.societe.value.trim(), "societe", "Indiquez le nom de votre entreprise ou association.");
    req(f.nom.value.trim(), "nom", "Indiquez votre nom et prénom.");
    var tel = f.tel.value.replace(/[\s.\-()]/g, "");
    req(/^0[1-9]\d{8}$/.test(tel) || /^\+\d{8,15}$/.test(tel), "tel", "Indiquez un numéro de téléphone valide.");
    req(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.value.trim()), "email", "Indiquez une adresse e-mail valide.");
    req(f.rgpd.checked, null, "Cochez la case d'accord pour que nous puissions vous répondre.");
    Array.prototype.forEach.call(form.querySelectorAll("input,select,textarea"), function (el) {
      el.classList.toggle("is-invalid", bad.indexOf(el.name) > -1);
      el.setAttribute("aria-invalid", bad.indexOf(el.name) > -1 ? "true" : "false");
    });
    showErrors(errs);
    if (errs.length) { var first = form.querySelector(".is-invalid"); if (first) first.focus(); return; }

    var data = {
      source: "noel",
      prestation: f.prestation.value,
      date: f.date.value,
      personnes: parseInt(f.personnes.value, 10),
      type: type,
      societe: type === "particulier" ? "" : f.societe.value.trim(),
      nom: f.nom.value.trim(),
      telephone: f.tel.value.trim(),
      email: f.email.value.trim(),
      message: f.message.value.trim(),
      consentement: f.rgpd.checked,
      website: f.website ? f.website.value : "",
      elapsed: Date.now() - openedAt,
    };
    var btn = form.querySelector(".nl-submit"), label = btn.textContent;
    sending = true; btn.disabled = true; btn.textContent = "Envoi en cours…";

    fetch(API + "/api/demande", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.j.error || "L'envoi n'a pas abouti.");
        track("form-envoye");
        form.hidden = true;
        var done = document.getElementById("nl-done");
        done.hidden = false;
        var jour = new Date(data.date + "T12:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
        done.innerHTML = "<h3>Merci " + esc(data.nom.split(" ")[0]) + ", votre demande est bien envoyée !</h3>" +
          "<p>" + esc(data.prestation) + " · " + esc(jour) + " · " + data.personnes + " personne" + (data.personnes > 1 ? "s" : "") + "</p>" +
          "<p>Le gérant vous recontacte rapidement pour en parler" + (res.j.ack === "envoye" ? ". Un e-mail de confirmation vient de partir à " + esc(data.email) + "." : ".") + "</p>" +
          '<p>Une question en attendant ? <a href="tel:+33465848918">04 65 84 89 18</a></p>';
        done.scrollIntoView({ behavior: "smooth", block: "center" });
      })
      .catch(function (err) {
        showErrors([(err && err.message ? err.message : "L'envoi n'a pas abouti.") + " Vous pouvez aussi nous appeler au 04 65 84 89 18."]);
      })
      .then(function () { sending = false; btn.disabled = false; btn.textContent = label; });
  });

  /* ------------------------------------------------------------------ */
  /* Accès rapide : met en évidence l'offre affichée à l'écran           */
  /* ------------------------------------------------------------------ */
  var quick = Array.prototype.slice.call(document.querySelectorAll(".nl-quick a"));
  if (quick.length && "IntersectionObserver" in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        quick.forEach(function (a) {
          var on = a.getAttribute("href") === "#" + en.target.id;
          a.classList.toggle("is-active", on);
          if (on) a.parentNode.scrollTo({ left: a.offsetLeft - 20, behavior: "smooth" });
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    quick.forEach(function (a) { var t = document.querySelector(a.getAttribute("href")); if (t) spy.observe(t); });
  }

  /* ------------------------------------------------------------------ */
  /* Barre d'actions sur téléphone                                       */
  /* ------------------------------------------------------------------ */
  var bar = document.getElementById("nl-bar"), hero = document.querySelector(".nl-hero"), formSec = document.getElementById("demande");
  if (bar && hero && formSec && "IntersectionObserver" in window) {
    var heroVisible = true, formVisible = false;
    var upd = function () { bar.classList.toggle("is-visible", !heroVisible && !formVisible); };
    new IntersectionObserver(function (en) { heroVisible = en[0].isIntersecting; upd(); }).observe(hero);
    new IntersectionObserver(function (en) { formVisible = en[0].isIntersecting; upd(); }, { threshold: 0.05 }).observe(formSec);
  }
})();
