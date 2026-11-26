"use strict";
// Rubrique admin « Demandes » : demandes envoyées par les formulaires du site (page Noël, puis devis)
// et nombre de clics sur les boutons suivis de la page Noël.
(() => {
  const API_URL = "/api/admin/demandes";
  const container = document.getElementById("demandes-view");
  if (!container) return;
  let state = null;

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const fmtWhen = (iso) => { try { return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)); } catch { return iso; } };
  const fmtDay = (d) => { if (!d) return ""; try { return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(new Date(d + "T12:00:00")); } catch { return d; } };
  const TYPES = { particulier: "Particulier", entreprise: "Entreprise", association: "Association" };

  // Libellés lisibles des boutons suivis (data-track de pages/noel.html)
  const LABELS = {
    "hero-reserver": "En-tête · Réserver ma table", "hero-devis": "En-tête · Demander un devis",
    "fetes-reserver": "Menu de fêtes · Réserver", "fetes-pdf": "Menu de fêtes · PDF",
    "groupe-devis": "Repas de groupe · Demander", "privatisation-devis": "Arbre de Noël · Demander",
    "traiteur-devis": "Traiteur · Nous écrire", "traiteur-pdf": "Traiteur · PDF",
    "traiteur-devis-en-ligne": "Traiteur · Devis en ligne",
    "emporter-devis": "À emporter · Commander", "emporter-pdf": "À emporter · PDF",
    "buffet-devis": "Buffet · Commander", "buffet-pdf": "Buffet · PDF",
    "dl-menu-fetes": "Téléchargement · Menu de fêtes", "dl-listing": "Téléchargement · Listing traiteur",
    "dl-emporter": "Téléchargement · À emporter", "dl-buffet": "Téléchargement · Buffet",
    "form-envoye": "Formulaire envoyé", "form-envoi": "Clic sur « Envoyer »",
    "bar-reserver": "Barre téléphone · Réserver", "bar-devis": "Barre téléphone · Devis",
    "infos-tel": "Infos · Téléphone", "infos-instagram": "Infos · Instagram", "infos-itineraire": "Infos · Itinéraire",
    "form-tel": "Formulaire · Téléphone", "form-instagram": "Formulaire · Instagram",
    "pourqui-associations": "Pour qui · Associations", "pourqui-entreprises": "Pour qui · Entreprises",
    "pourqui-commerciaux": "Pour qui · Commerciaux", "pourqui-arbre": "Pour qui · Arbre de Noël",
    "page-vue": "Visites de la page",
  };

  async function apiList() {
    const headers = await window.adminAuth.authHeader();
    const res = await fetch(API_URL, { headers });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Échec du chargement.");
    return json;
  }
  async function apiPatch(payload) {
    const headers = await window.adminAuth.authHeader();
    const res = await fetch(API_URL, { method: "PATCH", headers: Object.assign({ "Content-Type": "application/json" }, headers), body: JSON.stringify(payload) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Échec de la mise à jour.");
    return json;
  }
  const MAIL_LABEL = {
    envoye: "✓ envoyé", non_configure: "non envoyé (envoi non configuré)", echec: "⚠ échec de l'envoi",
    aucun_destinataire: "⚠ aucun destinataire",
  };
  function histHtml(d) {
    const h = Array.isArray(d.historique) ? d.historique : [];
    if (!h.length) return "";
    return '<details class="dm-hist"><summary>Historique (' + h.length + ")</summary><ol>" +
      h.map((e) => "<li><span>" + esc(fmtWhen(e.at)) + "</span> " + esc(e.quoi) + (e.par ? " <em>· " + esc(e.par) + "</em>" : "") + "</li>").join("") +
      "</ol></details>";
  }

  function row(label, value) { return value ? '<div class="rec-info-row"><span class="rec-info-label">' + esc(label) + '</span><span class="rec-info-value">' + value + "</span></div>" : ""; }

  function card(d) {
    const traite = d.statut === "traite";
    const tel = d.telephone ? '<a href="tel:' + esc(String(d.telephone).replace(/[^\d+]/g, "")) + '">' + esc(d.telephone) + "</a>" : "";
    const mail = d.email ? '<a href="mailto:' + esc(d.email) + '">' + esc(d.email) + "</a>" : "";
    return '<div class="rec-card">' +
      '<div class="rec-card-head"><div><div class="rec-card-title">' + esc(d.prestation || "Demande") + '</div><div class="rec-card-date">Reçue le ' + esc(fmtWhen(d.created_at)) + (d.source === "noel" ? " · page Noël" : "") + "</div></div>" +
      '<span class="rec-status ' + (traite ? "is-confirmee" : "is-nouveau") + '">' + (traite ? "Traitée" : "Nouvelle") + "</span></div>" +
      '<div class="rec-info-grid">' +
      row("Nom", esc(d.nom)) + row("Client", esc((TYPES[d.type_client] || d.type_client || "") + (d.societe ? " · " + d.societe : ""))) +
      row("Téléphone", tel) + row("E-mail", mail) + row("Date souhaitée", esc(fmtDay(d.date_souhaitee))) + row("Personnes", esc(d.personnes)) +
      row("Alerte restaurant", esc(MAIL_LABEL[d.email_restaurant] || d.email_restaurant || "")) +
      row("Accusé au client", esc(MAIL_LABEL[d.email_client] || d.email_client || "")) +
      row("Traitée", traite && d.traite_par ? esc(d.traite_par) + (d.traite_le ? " · " + esc(fmtWhen(d.traite_le)) : "") : "") +
      "</div>" +
      (d.message ? '<p class="rec-note">' + esc(d.message) + "</p>" : "") +
      '<div class="dm-notes"><label for="dm-note-' + esc(d.id) + '">Notes internes <span>(visibles seulement dans l\'admin)</span></label>' +
      '<textarea id="dm-note-' + esc(d.id) + '" rows="2" maxlength="4000" placeholder="Ex. : rappelé le 21/11, devis envoyé…">' + esc(d.notes || "") + "</textarea>" +
      '<button type="button" class="rec-btn" data-note="' + esc(d.id) + '">Enregistrer la note</button></div>' +
      histHtml(d) +
      '<div class="rec-actions"><button type="button" class="rec-btn' + (traite ? "" : " rec-btn-primary") + '" data-set="' + esc(d.id) + '" data-statut="' + (traite ? "nouveau" : "traite") + '">' + (traite ? "Remettre en nouvelle" : "Marquer comme traitée") + "</button></div>" +
      "</div>";
  }

  function dailyHtml(daily) {
    if (!daily || !daily.length) return "";
    return '<div class="rec-card" style="overflow-x:auto"><table class="dm-table"><thead><tr><th>Jour</th><th>Visites</th><th>Clics</th><th>Demandes</th></tr></thead><tbody>' +
      daily.map((r) => "<tr><td>" + esc(fmtDay(r.day)) + "</td><td>" + r.visites + "</td><td>" + r.clics + "</td><td>" + r.demandes + "</td></tr>").join("") +
      "</tbody></table></div>";
  }

  function statsHtml(stats) {
    const noel = (stats && stats.noel) || {};
    const keys = Object.keys(noel).sort((a, b) => noel[b] - noel[a]);
    if (!keys.length) return '<div class="rec-empty">Aucun clic enregistré pour l\'instant (la page Noël n\'est pas encore en ligne).</div>';
    return '<div class="rec-card"><div class="rec-info-grid">' +
      keys.map((k) => row(LABELS[k] || k, "<b>" + esc(noel[k]) + "</b>")).join("") +
      "</div></div>";
  }

  function render() {
    if (state.screen === "loading") { container.innerHTML = '<div class="editor-loading">Chargement…</div>'; return; }
    if (state.screen === "error") {
      container.innerHTML = '<button type="button" class="back-btn" id="dm-back">‹ Retour</button><div class="login-error">' + esc(state.error) + "</div>";
      document.getElementById("dm-back").addEventListener("click", () => window.adminShowDashboard());
      return;
    }
    const items = state.filter === "all" ? state.items : state.items.filter((d) => (d.statut || "nouveau") === state.filter);
    container.innerHTML =
      '<button type="button" class="back-btn" id="dm-back">‹ Retour</button>' +
      "<h1>Demandes &amp; suivi Noël</h1>" +
      '<p class="dashboard-note">Les demandes envoyées depuis la page « Noël au Bistro » (vous les recevez aussi par e-mail), et le nombre de clics sur chaque bouton de la page.</p>' +
      (state.setupRequired
        ? '<div class="login-error" style="margin-bottom:14px">L\'historique n\'est pas encore activé : il faut exécuter une fois le fichier <b>scripts/demandes.sql</b> dans Supabase (SQL Editor). En attendant, les demandes arrivent quand même par e-mail.</div>'
        : "") +
      "<h2 style=\"font-size:18px;margin:18px 0 10px\">Demandes reçues</h2>" +
      '<div class="rec-toolbar"><div class="rec-filter">' +
      [["all", "Toutes"], ["nouveau", "Nouvelles"], ["traite", "Traitées"]].map((f) => '<button type="button" class="rec-filter-btn' + (state.filter === f[0] ? " is-active" : "") + '" data-filter="' + f[0] + '">' + f[1] + "</button>").join("") +
      "</div></div>" +
      (items.length ? '<div class="rec-list">' + items.map(card).join("") + "</div>" : '<div class="rec-empty">Aucune demande pour l\'instant.</div>') +
      "<h2 style=\"font-size:18px;margin:26px 0 10px\">Jour par jour (page Noël)</h2>" +
      (dailyHtml(state.daily) || '<div class="rec-empty">Rien pour l\'instant.</div>') +
      "<h2 style=\"font-size:18px;margin:26px 0 10px\">Clics par bouton (total)</h2>" +
      statsHtml(state.stats);

    document.getElementById("dm-back").addEventListener("click", () => window.adminShowDashboard());
    container.querySelectorAll("[data-filter]").forEach((b) => b.addEventListener("click", () => { state.filter = b.dataset.filter; render(); }));
    container.querySelectorAll("[data-set]").forEach((b) => b.addEventListener("click", async () => {
      b.disabled = true;
      try {
        const r = await apiPatch({ id: Number(b.dataset.set), statut: b.dataset.statut });
        const d = state.items.find((x) => String(x.id) === b.dataset.set);
        if (d) Object.assign(d, { statut: b.dataset.statut, historique: r.historique, traite_par: r.traite_par, traite_le: r.traite_le });
        render();
      } catch (err) { b.disabled = false; alert(err.message); }
    }));
    container.querySelectorAll("[data-note]").forEach((b) => b.addEventListener("click", async () => {
      const id = b.dataset.note, ta = document.getElementById("dm-note-" + id);
      b.disabled = true; b.textContent = "Enregistrement…";
      try {
        const r = await apiPatch({ id: Number(id), notes: ta.value });
        const d = state.items.find((x) => String(x.id) === id);
        if (d) Object.assign(d, { notes: r.notes, historique: r.historique });
        render();
      } catch (err) { b.disabled = false; b.textContent = "Enregistrer la note"; alert(err.message); }
    }));
  }

  window.DemandesEditor = {
    async open() {
      state = { screen: "loading", items: [], stats: {}, daily: [], filter: "all", setupRequired: false };
      render();
      try {
        const json = await apiList();
        state.items = json.items || [];
        state.stats = json.stats || {};
        state.daily = json.daily || [];
        state.setupRequired = !!json.setupRequired;
        state.screen = "ready";
      } catch (err) { state.screen = "error"; state.error = err.message; }
      render();
    },
  };
})();
