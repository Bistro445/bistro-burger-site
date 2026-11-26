"use strict";
// Rubrique admin « Page Noël » : prix et textes de la page /noel, PDF à télécharger, page visible ou masquée.
// Enregistré dans site_content (clé « noel ») ; les PDF vont dans Supabase Storage (espace « site-docs »,
// voir scripts/noel-docs.sql) à un emplacement fixe : remplacer un PDF ne change pas son lien public.
(() => {
  const API_URL = "/api/admin/content";
  const KEY = "noel";
  const BUCKET = "site-docs";
  const MAX_BYTES = 5 * 1024 * 1024; // refus au-delà de 5 Mo
  const WARN_BYTES = 2 * 1024 * 1024; // le cahier des charges demande des PDF de moins de 2 Mo
  const container = document.getElementById("noel-view");
  if (!container) return;

  // Les textes modifiables de la page (attribut data-noel de pages/noel.html). Case vide = texte d'origine de la page.
  const GROUPS = [
    { title: "Menu de fêtes · 16 et 17 décembre", fields: [
      { key: "fetes_prix", label: "Prix par personne (en €)", hint: "Juste le nombre, ex. : 50", short: true },
    ] },
    { title: "Repas de groupe (dès 10 personnes)", fields: [
      { key: "groupe_prix", label: "Prix par personne (en €)", hint: "Juste le nombre, ex. : 35", short: true },
      { key: "groupe_quand", label: "Quand", hint: "Ex. : Sur réservation, entre le 14 et le 31 décembre 2026" },
    ] },
    { title: "Privatisation · arbre de Noël", fields: [
      { key: "arbre_apresmidi", label: "Horaires de l'après-midi", hint: "Ex. : du lundi au vendredi de 15 h à 18 h" },
      { key: "arbre_soiree", label: "Horaires de la soirée", hint: "Ex. : de 19 h à 1 h" },
      { key: "arbre_capacite", label: "Capacité (personnes)", hint: "Ex. : 30 à 40", short: true },
    ] },
    { title: "Traiteur en entreprise", fields: [
      { key: "traiteur_zone", label: "Communes livrées", hint: "Ex. : Gardanne, Bouc-Bel-Air, Simiane…" },
      { key: "traiteur_delai", label: "Délai de commande", hint: "Ex. : 72 h", short: true },
    ] },
    { title: "Noël à emporter ou livré", fields: [
      { key: "emporter_retrait", label: "Retrait au restaurant", hint: "Ex. : le 24 décembre, de l'ouverture jusqu'à 15 h" },
      { key: "emporter_livraison", label: "Livraison", hint: "Ex. : le 24 décembre au matin" },
      { key: "emporter_prix", label: "Prix", hint: "Texte complet, ex. : Selon la formule choisie" },
      { key: "emporter_date_limite", label: "Commander avant le", hint: "Ex. : 19 décembre", short: true },
    ] },
    { title: "Buffet du lendemain", fields: [
      { key: "buffet_delai", label: "Délai de commande", hint: "Ex. : 3 jours", short: true },
      { key: "buffet_prix", label: "Prix", hint: "Texte complet, ex. : Selon la formule choisie" },
    ] },
  ];
  const DOCS = [
    { key: "offres", file: "noel-2026-nos-offres.pdf", label: "Nos offres de Noël (les 8 fiches)" },
    { key: "menu-fetes", file: "menu-de-fetes.pdf", label: "Menu de fêtes" },
    { key: "listing-traiteur", file: "listing-traiteur-noel.pdf", label: "Carte traiteur d'hiver" },
    { key: "emporter", file: "menu-noel-a-emporter.pdf", label: "Noël à emporter ou livré" },
    { key: "buffet", file: "buffet-du-lendemain.pdf", label: "Buffet du lendemain" },
  ];

  let state = null;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const fmtWhen = (iso) => { try { return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)); } catch { return iso; } };
  const fmtSize = (n) => (n >= 1024 * 1024 ? (n / 1024 / 1024).toFixed(1).replace(".", ",") + " Mo" : Math.round(n / 1024) + " Ko");

  async function apiGet() {
    const headers = await window.adminAuth.authHeader();
    const res = await fetch(API_URL + "?key=" + KEY, { headers });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Échec du chargement.");
    const v = json.value || {};
    return { visible: v.visible !== false, textes: v.textes || {}, docs: v.docs || {} };
  }
  async function apiSave(value) {
    const headers = await window.adminAuth.authHeader();
    const res = await fetch(API_URL, { method: "PUT", headers: Object.assign({ "Content-Type": "application/json" }, headers), body: JSON.stringify({ key: KEY, value }) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Échec de l'enregistrement.");
    if (json.deployTriggered === false) throw new Error("Enregistré, mais le site n'a pas pu être mis à jour tout de suite : il le sera dans les 5 minutes.");
  }

  function readForm() {
    const textes = {};
    GROUPS.forEach((g) => g.fields.forEach((f) => { const el = document.getElementById("nl-f-" + f.key); if (el) textes[f.key] = el.value.trim(); }));
    state.data.textes = textes;
    state.data.visible = document.getElementById("nl-visible").checked;
  }

  async function uploadDoc(doc, file) {
    readForm();
    state.docMsg = {}; state.docErr = {};
    if (!file) return;
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) { state.docErr[doc.key] = "Ce fichier n'est pas un PDF."; render(); return; }
    if (file.size > MAX_BYTES) { state.docErr[doc.key] = "PDF trop lourd (" + fmtSize(file.size) + ") : 5 Mo maximum. Réduisez-le avant de le déposer."; render(); return; }
    state.uploading = doc.key; render();
    try {
      const path = "noel/" + doc.file;
      const { error } = await window.adminAuth.supabase.storage.from(BUCKET).upload(path, file, { contentType: "application/pdf", upsert: true, cacheControl: "300" });
      if (error) throw new Error(error.message);
      const { data } = window.adminAuth.supabase.storage.from(BUCKET).getPublicUrl(path);
      state.data.docs[doc.key] = { url: data.publicUrl, nom: file.name, taille: file.size, maj: new Date().toISOString() };
      await apiSave(state.data);
      state.docMsg[doc.key] = "PDF en ligne." + (file.size > WARN_BYTES ? " Attention : il pèse " + fmtSize(file.size) + ", plus de 2 Mo (lent à ouvrir sur téléphone)." : "");
    } catch (err) {
      state.docErr[doc.key] = "Échec du dépôt : " + err.message;
    } finally {
      state.uploading = null; render();
    }
  }

  async function removeDoc(doc) {
    readForm();
    state.docMsg = {}; state.docErr = {};
    delete state.data.docs[doc.key];
    try { await apiSave(state.data); state.docMsg[doc.key] = "Retiré de la page (le lien affichera « bientôt disponible »)."; }
    catch (err) { state.docErr[doc.key] = err.message; }
    render();
  }

  function render() {
    if (state.screen === "loading") { container.innerHTML = '<div class="editor-loading">Chargement…</div>'; return; }
    if (state.screen === "error") {
      container.innerHTML = '<button type="button" class="back-btn" id="nl-back">‹ Retour</button><div class="login-error">' + esc(state.error) + "</div>";
      document.getElementById("nl-back").addEventListener("click", () => window.adminShowDashboard());
      return;
    }
    const d = state.data;
    const filled = GROUPS.reduce((n, g) => n + g.fields.filter((f) => String(d.textes[f.key] || "").trim()).length, 0);
    const total = GROUPS.reduce((n, g) => n + g.fields.length, 0);
    container.innerHTML =
      '<button type="button" class="back-btn" id="nl-back">‹ Retour</button>' +
      "<h1>Page Noël</h1>" +
      '<p class="dashboard-note">Les prix, horaires et menus de la page « Noël au Bistro », et les PDF que les clients téléchargent. ' +
      "Une case laissée vide garde le texte d'origine de la page (" + filled + " / " + total + " personnalisées).</p>" +
      '<form id="nl-form-admin">' +
      '<label class="nl-adm-check"><input type="checkbox" id="nl-visible"' + (d.visible ? " checked" : "") + "> Page visible sur le site <span>(décochez début janvier pour la masquer ; elle reste prête pour Noël 2027)</span></label>" +
      GROUPS.map((g) =>
        '<fieldset class="nl-adm-group"><legend>' + esc(g.title) + "</legend>" +
        g.fields.map((f) => {
          const v = d.textes[f.key] || "";
          return '<label class="field-label" for="nl-f-' + f.key + '">' + esc(f.label) + "</label>" +
            (f.area
              ? '<textarea class="field" id="nl-f-' + f.key + '" rows="4" placeholder="' + esc(f.hint || "Une ligne par élément") + '">' + esc(v) + "</textarea>"
              : '<input class="field' + (f.short ? " nl-adm-short" : "") + '" id="nl-f-' + f.key + '" value="' + esc(v) + '" placeholder="' + esc(f.hint || "") + '">');
        }).join("") + "</fieldset>"
      ).join("") +
      '<button type="submit" class="btn-primary"' + (state.saving ? " disabled" : "") + ">" + (state.saving ? "Enregistrement…" : "Enregistrer les textes") + "</button>" +
      (state.saveSuccess ? '<div class="password-success">Enregistré : la page est à jour.</div>' : "") +
      (state.saveError ? '<div class="login-error">' + esc(state.saveError) + "</div>" : "") +
      "</form>" +
      '<h2 style="font-size:18px;margin:28px 0 6px">Documents à télécharger (PDF)</h2>' +
      '<p class="dashboard-note">Moins de 2 Mo, lisibles sur téléphone. Déposer un nouveau PDF remplace l\'ancien : le lien partagé (stories, e-mails) reste le même.</p>' +
      '<div class="nl-adm-docs">' + DOCS.map((doc) => {
        const cur = d.docs[doc.key];
        const busy = state.uploading === doc.key;
        return '<div class="rec-card nl-adm-doc"><div class="rec-card-title">' + esc(doc.label) + "</div>" +
          '<div class="rec-card-date">Lien public : bistroburgergardanne.com/noel/' + esc(doc.file) + "</div>" +
          (cur
            ? '<p class="nl-adm-doc-cur">En ligne : <a href="' + esc(cur.url) + '" target="_blank" rel="noopener">' + esc(cur.nom || doc.file) + "</a> · " + esc(fmtSize(cur.taille || 0)) + " · déposé le " + esc(fmtWhen(cur.maj)) + "</p>"
            : '<p class="nl-adm-doc-cur is-empty">Pas encore déposé : la page affiche « bientôt disponible ».</p>') +
          '<div class="rec-actions"><label class="rec-btn rec-btn-primary nl-adm-pick">' + (busy ? "Dépôt en cours…" : cur ? "Remplacer le PDF" : "Déposer le PDF") +
          '<input type="file" accept="application/pdf,.pdf" data-doc="' + doc.key + '" hidden' + (busy ? " disabled" : "") + "></label>" +
          (cur ? '<button type="button" class="rec-btn" data-remove="' + doc.key + '">Retirer</button>' : "") + "</div>" +
          (state.docMsg[doc.key] ? '<div class="password-success">' + esc(state.docMsg[doc.key]) + "</div>" : "") +
          (state.docErr[doc.key] ? '<div class="login-error">' + esc(state.docErr[doc.key]) + "</div>" : "") +
          "</div>";
      }).join("") + "</div>";

    document.getElementById("nl-back").addEventListener("click", () => window.adminShowDashboard());
    document.getElementById("nl-form-admin").addEventListener("submit", async (e) => {
      e.preventDefault();
      readForm();
      state.saving = true; state.saveError = null; state.saveSuccess = false; render();
      try { await apiSave(state.data); state.saveSuccess = true; }
      catch (err) { state.saveError = err.message; }
      finally { state.saving = false; render(); }
    });
    container.querySelectorAll("input[type=file][data-doc]").forEach((inp) => inp.addEventListener("change", () => {
      const doc = DOCS.find((x) => x.key === inp.dataset.doc);
      uploadDoc(doc, inp.files && inp.files[0]);
    }));
    container.querySelectorAll("[data-remove]").forEach((b) => b.addEventListener("click", () => removeDoc(DOCS.find((x) => x.key === b.dataset.remove))));
  }

  window.NoelEditor = {
    async open() {
      state = { screen: "loading", data: null, saving: false, saveError: null, saveSuccess: false, uploading: null, docMsg: {}, docErr: {} };
      render();
      try { state.data = await apiGet(); state.screen = "ready"; }
      catch (err) { state.screen = "error"; state.error = err.message; }
      render();
    },
  };
})();
