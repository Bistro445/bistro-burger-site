"use strict";
// Rubrique admin « Devis traiteur » : devis créés depuis la page /devis-traiteur.
// Liste filtrable (statut, recherche), tri par date d'événement, fiche avec lien vers le devis,
// changement de statut, notes internes, historique, renvoi au client et export CSV.
(() => {
  const API_URL = "/api/admin/devis";
  const container = document.getElementById("devis-view");
  if (!container) return;
  let state = null;

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const fmtWhen = (iso) => { try { return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)); } catch { return iso; } };
  const fmtDay = (d) => { if (!d) return ""; try { return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(d + "T12:00:00")); } catch { return d; } };
  const eur = (n) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(n) || 0);
  const TYPES = { particulier: "Particulier", entreprise: "Entreprise", association: "Association" };
  const STATUTS = [
    ["nouveau", "Nouveau"], ["envoye", "Envoyé"], ["accepte", "Le client souhaite valider"], ["refuse", "Refusé"],
    ["expire", "Expiré"], ["realise", "Réalisé"], ["facture", "Facturé"],
  ];
  const LABEL = Object.fromEntries(STATUTS);
  const FILTERS = [
    ["all", "Tous"], ["atraiter", "À traiter"], ["accepte", "Souhaitent valider"], ["realise", "Réalisés"], ["clos", "Refusés / expirés"],
  ];
  const MAIL_LABEL = { envoye: "✓ envoyé", non_configure: "non envoyé (envoi non configuré)", echec: "⚠ échec de l'envoi", aucun_destinataire: "⚠ aucun destinataire" };

  async function api(method, payload) {
    const headers = await window.adminAuth.authHeader();
    const opts = { method, headers: Object.assign({}, headers) };
    if (payload) { opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(payload); }
    const res = await fetch(API_URL, opts);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Échec de l'opération.");
    return json;
  }

  function matches(d) {
    const s = d.statut_affiche || d.statut;
    if (state.filter === "atraiter" && !(s === "nouveau" || s === "envoye")) return false;
    if (state.filter === "accepte" && s !== "accepte") return false;
    if (state.filter === "realise" && !(s === "realise" || s === "facture")) return false;
    if (state.filter === "clos" && !(s === "refuse" || s === "expire")) return false;
    const q = state.q.trim().toLowerCase();
    if (q && ![d.numero, d.nom, d.societe, d.email, d.telephone].some((v) => String(v || "").toLowerCase().indexOf(q) > -1)) return false;
    return true;
  }

  function row(label, value) { return value ? '<div class="rec-info-row"><span class="rec-info-label">' + esc(label) + '</span><span class="rec-info-value">' + value + "</span></div>" : ""; }
  function histHtml(d) {
    const h = Array.isArray(d.historique) ? d.historique : [];
    if (!h.length) return "";
    return '<details class="dm-hist"><summary>Historique (' + h.length + ")</summary><ol>" +
      h.map((e) => "<li><span>" + esc(fmtWhen(e.at)) + "</span> " + esc(e.quoi) + (e.par ? " <em>· " + esc(e.par) + "</em>" : "") + "</li>").join("") + "</ol></details>";
  }
  function statusClass(s) { return s === "accepte" || s === "realise" || s === "facture" ? "is-confirmee" : s === "refuse" || s === "expire" ? "is-annulee" : "is-nouveau"; }

  function card(d) {
    const s = d.statut_affiche || d.statut;
    const lignes = (d.contenu && d.contenu.lignes) || [];
    const tel = d.telephone ? '<a href="tel:' + esc(String(d.telephone).replace(/[^\d+]/g, "")) + '">' + esc(d.telephone) + "</a>" : "";
    const mail = d.email ? '<a href="mailto:' + esc(d.email) + '">' + esc(d.email) + "</a>" : "";
    const remise = d.mode === "livraison" ? "Livraison · " + esc([d.adresse, [d.code_postal, d.ville || d.commune].filter(Boolean).join(" ")].filter(Boolean).join(", ")) : "Retrait à la brasserie";
    return '<div class="rec-card">' +
      '<div class="rec-card-head"><div><div class="rec-card-title">' + esc(d.numero) + " · " + esc(d.nom) + (d.societe ? " (" + esc(d.societe) + ")" : "") + "</div>" +
      '<div class="rec-card-date">Créé le ' + esc(fmtWhen(d.created_at)) + " · valable jusqu'au " + esc(fmtDay(d.valide_jusqu)) + "</div></div>" +
      '<span class="rec-status ' + statusClass(s) + '">' + esc(LABEL[s] || s) + "</span></div>" +
      '<div class="rec-info-grid">' +
      row("Événement", "<b>" + esc(fmtDay(d.date_evenement)) + (d.heure ? " à " + esc(d.heure) : "") + "</b>") +
      row("Convives", esc(d.convives)) + row("Remise", remise) +
      row("Total", "<b>" + esc(eur(d.total_ttc)) + " TTC</b> · " + esc(eur(d.total_ht)) + " HT · acompte " + esc(eur(d.acompte))) +
      row("Client", esc(TYPES[d.type_client] || d.type_client || "") + (d.siret ? " · SIRET " + esc(d.siret) : "")) +
      row("Téléphone", tel) + row("E-mail", mail) +
      row("Devis au client", esc(MAIL_LABEL[d.email_client] || d.email_client || "")) +
      row("Copie restaurant", esc(MAIL_LABEL[d.email_restaurant] || d.email_restaurant || "")) +
      row("Lien ouvert", d.ouvertures ? esc(d.ouvertures) + " fois (dernière : " + esc(fmtWhen(d.derniere_ouverture)) + ")" : "") +
      row("Offres traiteur", d.offres ? "Accepte de recevoir les offres" : "") +
      "</div>" +
      '<ul class="dv-admin-lines">' + lignes.map((l) => "<li><b>" + esc(l.name) + " × " + esc(l.qty) + "</b> · " + esc(eur(l.ht)) + " HT" + ((l.detail || []).length ? "<br><span>" + l.detail.map(esc).join(" · ") + "</span>" : "") + "</li>").join("") + "</ul>" +
      (d.remarques ? '<p class="rec-note">' + esc(d.remarques) + "</p>" : "") +
      '<div class="dm-notes"><label for="dv-note-' + esc(d.id) + '">Notes internes <span>(visibles seulement dans l\'admin)</span></label>' +
      '<textarea id="dv-note-' + esc(d.id) + '" rows="2" maxlength="4000" placeholder="Ex. : appelé le 26/11, acompte reçu…">' + esc(d.notes || "") + "</textarea>" +
      '<button type="button" class="rec-btn" data-note="' + esc(d.id) + '">Enregistrer la note</button></div>' +
      histHtml(d) +
      '<div class="rec-actions">' +
      '<a class="rec-btn rec-btn-primary" href="' + esc(d.url) + '" target="_blank" rel="noopener" style="text-decoration:none">Voir le devis</a>' +
      '<button type="button" class="rec-btn" data-resend="' + esc(d.id) + '">Renvoyer au client</button>' +
      '<label class="dv-admin-status">Statut <select data-statut="' + esc(d.id) + '">' +
      STATUTS.map((o) => '<option value="' + o[0] + '"' + (o[0] === d.statut ? " selected" : "") + ">" + esc(o[1]) + "</option>").join("") +
      "</select></label></div></div>";
  }

  function statsHtml(items) {
    const month = new Date().toISOString().slice(0, 7);
    const ofMonth = items.filter((d) => String(d.created_at).slice(0, 7) === month);
    const acc = items.filter((d) => ["accepte", "realise", "facture"].indexOf(d.statut) > -1).length;
    const total = items.reduce((t, d) => t + (Number(d.total_ttc) || 0), 0);
    return '<div class="rec-card"><div class="rec-info-grid">' +
      row("Devis ce mois-ci", "<b>" + ofMonth.length + "</b> · " + esc(eur(ofMonth.reduce((t, d) => t + (Number(d.total_ttc) || 0), 0))) + " TTC") +
      row("Devis au total", "<b>" + items.length + "</b>") +
      row("Panier moyen", items.length ? esc(eur(total / items.length)) + " TTC" : "") +
      row("Souhaitent valider ou réalisés", items.length ? "<b>" + acc + "</b> (" + Math.round((acc / items.length) * 100) + " %)" : "") +
      "</div></div>";
  }

  function exportCsv() {
    const cols = [["numero", "N°"], ["created_at", "Créé le"], ["statut", "Statut"], ["nom", "Nom"], ["societe", "Société"], ["type_client", "Type"], ["telephone", "Téléphone"], ["email", "E-mail"],
      ["date_evenement", "Date événement"], ["heure", "Heure"], ["convives", "Convives"], ["mode", "Remise"], ["commune", "Commune"], ["total_ht", "Total HT"], ["total_ttc", "Total TTC"], ["acompte", "Acompte"]];
    const q = (v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
    const lines = [cols.map((c) => q(c[1])).join(";")].concat(state.items.filter(matches).map((d) => cols.map((c) => q(c[0] === "statut" ? LABEL[d.statut_affiche || d.statut] : d[c[0]])).join(";")));
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "devis-traiteur-" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function render() {
    if (state.screen === "loading") { container.innerHTML = '<div class="editor-loading">Chargement…</div>'; return; }
    if (state.screen === "error") {
      container.innerHTML = '<button type="button" class="back-btn" id="dv-back">‹ Retour</button><div class="login-error">' + esc(state.error) + "</div>";
      document.getElementById("dv-back").addEventListener("click", () => window.adminShowDashboard());
      return;
    }
    let items = state.items.filter(matches);
    if (state.sort === "event") items = items.slice().sort((a, b) => String(a.date_evenement || "").localeCompare(String(b.date_evenement || "")));
    container.innerHTML =
      '<button type="button" class="back-btn" id="dv-back">‹ Retour</button>' +
      "<h1>Devis traiteur</h1>" +
      '<p class="dashboard-note">Les devis créés par les clients sur la page « Devis traiteur ». Vous recevez aussi chaque devis par e-mail. Aucun devis n\'est validé sans votre échange avec le client, puis l\'acompte.</p>' +
      (state.setupRequired ? '<div class="login-error" style="margin-bottom:14px">La rubrique n\'est pas encore activée : il faut exécuter une fois le fichier <b>scripts/devis.sql</b> dans Supabase (SQL Editor).</div>' : "") +
      statsHtml(state.items) +
      '<div class="rec-toolbar" style="margin-top:14px; flex-wrap:wrap; gap:10px;"><div class="rec-filter">' +
      FILTERS.map((f) => '<button type="button" class="rec-filter-btn' + (state.filter === f[0] ? " is-active" : "") + '" data-filter="' + f[0] + '">' + f[1] + "</button>").join("") +
      "</div>" +
      '<input type="search" id="dv-q" class="dv-admin-search" placeholder="Rechercher : nom, société, n°…" value="' + esc(state.q) + '">' +
      '<button type="button" class="rec-btn" id="dv-sort">' + (state.sort === "event" ? "Trier par date de création" : "Trier par date d'événement") + "</button>" +
      '<button type="button" class="rec-btn" id="dv-csv">Exporter (CSV)</button></div>' +
      (items.length ? '<div class="rec-list">' + items.map(card).join("") + "</div>" : '<div class="rec-empty">Aucun devis pour l\'instant.</div>');

    document.getElementById("dv-back").addEventListener("click", () => window.adminShowDashboard());
    container.querySelectorAll("[data-filter]").forEach((b) => b.addEventListener("click", () => { state.filter = b.dataset.filter; render(); }));
    const q = document.getElementById("dv-q");
    q.addEventListener("input", () => { state.q = q.value; const pos = q.selectionStart; render(); const nq = document.getElementById("dv-q"); nq.focus(); try { nq.setSelectionRange(pos, pos); } catch {} });
    document.getElementById("dv-sort").addEventListener("click", () => { state.sort = state.sort === "event" ? "created" : "event"; render(); });
    document.getElementById("dv-csv").addEventListener("click", exportCsv);
    const find = (id) => state.items.find((x) => String(x.id) === String(id));
    container.querySelectorAll("[data-statut]").forEach((sel) => sel.addEventListener("change", async () => {
      sel.disabled = true;
      try {
        const r = await api("PATCH", { id: Number(sel.dataset.statut), statut: sel.value });
        const d = find(sel.dataset.statut);
        if (d) Object.assign(d, { statut: r.statut, statut_affiche: r.statut, historique: r.historique });
        render();
      } catch (err) { sel.disabled = false; alert(err.message); }
    }));
    container.querySelectorAll("[data-resend]").forEach((b) => b.addEventListener("click", async () => {
      b.disabled = true; b.textContent = "Envoi…";
      try {
        const r = await api("PATCH", { id: Number(b.dataset.resend), action: "renvoyer" });
        const d = find(b.dataset.resend);
        if (d) Object.assign(d, { statut: r.statut, statut_affiche: r.statut, historique: r.historique, email_client: r.email_client });
        render();
      } catch (err) { b.disabled = false; b.textContent = "Renvoyer au client"; alert(err.message); }
    }));
    container.querySelectorAll("[data-note]").forEach((b) => b.addEventListener("click", async () => {
      const id = b.dataset.note, ta = document.getElementById("dv-note-" + id);
      b.disabled = true; b.textContent = "Enregistrement…";
      try {
        const r = await api("PATCH", { id: Number(id), notes: ta.value });
        const d = find(id);
        if (d) Object.assign(d, { notes: r.notes, historique: r.historique });
        render();
      } catch (err) { b.disabled = false; b.textContent = "Enregistrer la note"; alert(err.message); }
    }));
  }

  window.DevisEditor = {
    async open() {
      state = { screen: "loading", items: [], filter: "all", q: "", sort: "created", setupRequired: false };
      render();
      try {
        const json = await api("GET");
        state.items = json.items || [];
        state.setupRequired = !!json.setupRequired;
        state.screen = "ready";
      } catch (err) { state.screen = "error"; state.error = err.message; }
      render();
    },
  };
})();
