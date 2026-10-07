"use strict";
(() => {
  const API_URL = "/api/admin/reservations";
  const container = document.getElementById("reservations-clients-view");

  let state = null;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[c]);
  }

  function formatDate(iso) {
    try {
      return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  function formatReservationDate(dateStr) {
    if (!dateStr) return "";
    try {
      return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(dateStr + "T00:00:00"));
    } catch {
      return dateStr;
    }
  }

  async function apiList() {
    const headers = await window.adminAuth.authHeader();
    const res = await fetch(API_URL, { headers });
    if (!res.ok) throw new Error("Échec du chargement.");
    const json = await res.json();
    return json.items || [];
  }

  async function apiSetStatus(id, status) {
    const headers = await window.adminAuth.authHeader();
    const res = await fetch(API_URL, {
      method: "PATCH",
      headers: Object.assign({ "Content-Type": "application/json" }, headers),
      body: JSON.stringify({ id, status }),
    });
    if (!res.ok) throw new Error("Échec de la mise à jour.");
    try {
      return await res.json();
    } catch {
      return {};
    }
  }

  // Message affiché après un changement de statut (surtout : l'e-mail au client).
  function noticeFor(status, emailResult) {
    if (status !== "confirmee") return "";
    if (emailResult === "envoye") return "✓ Réservation confirmée, e-mail de confirmation envoyé au client.";
    if (emailResult === "pas_d_email") return "Réservation confirmée. Ce client n'a pas laissé d'e-mail : pensez à le prévenir par téléphone.";
    if (emailResult === "non_configure") return "Réservation confirmée. L'envoi d'e-mails aux clients n'est pas encore activé : pensez à prévenir le client par téléphone.";
    if (emailResult === "echec") return "Réservation confirmée, mais l'e-mail n'a pas pu être envoyé : prévenez le client par téléphone.";
    return "";
  }

  async function apiDelete(id) {
    const headers = await window.adminAuth.authHeader();
    const res = await fetch(API_URL + "?id=" + encodeURIComponent(id), {
      method: "DELETE",
      headers,
    });
    if (!res.ok) throw new Error("Échec de la suppression.");
  }

  const FILTERS = [
    { key: "all", label: "Toutes" },
    { key: "nouveau", label: "Nouvelles" },
    { key: "confirmee", label: "Confirmées" },
    { key: "annulee", label: "Annulées" },
  ];

  const STATUS_LABELS = { nouveau: "Nouvelle", confirmee: "Confirmée", annulee: "Annulée" };

  function actionsHtml(r) {
    const status = r.status || "nouveau";
    const btns = [];
    if (status !== "confirmee") btns.push('<button type="button" class="rec-btn rec-btn-primary" data-set-status="' + esc(r.id) + '" data-status="confirmee">Confirmer</button>');
    if (status !== "annulee") btns.push('<button type="button" class="rec-btn rec-btn-danger" data-set-status="' + esc(r.id) + '" data-status="annulee">Annuler</button>');
    if (status !== "nouveau") btns.push('<button type="button" class="rec-btn" data-set-status="' + esc(r.id) + '" data-status="nouveau">Remettre en nouvelle</button>');
    btns.push('<button type="button" class="rec-btn rec-btn-danger" data-delete="' + esc(r.id) + '">Supprimer</button>');
    return '<div class="rec-actions">' + btns.join("") + "</div>";
  }

  function infoRow(label, value) {
    if (!value) return "";
    return '<div class="rec-info-row"><span class="rec-info-label">' + esc(label) + '</span><span class="rec-info-value">' + value + "</span></div>";
  }

  function cardHtml(r) {
    const status = r.status || "nouveau";
    const when = r.reservation_date
      ? esc(formatReservationDate(r.reservation_date)) + (r.reservation_time ? " · " + esc(r.reservation_time) : "")
      : "";
    return (
      '<div class="rec-card" data-resa-id="' + esc(r.id) + '">' +
      '<div class="rec-card-head">' +
      '<div><div class="rec-card-title">' + esc(r.name) + '</div><div class="rec-card-date">Reçue le ' + esc(formatDate(r.created_at)) + "</div></div>" +
      '<span class="rec-status is-' + esc(status) + '">' + esc(STATUS_LABELS[status] || status) + "</span>" +
      "</div>" +
      '<div class="rec-info-grid">' +
      infoRow("Téléphone", esc(r.phone)) +
      infoRow("E-mail", r.email ? esc(r.email) : "") +
      infoRow("Réservation", when) +
      infoRow("Couverts", r.party_size ? esc(r.party_size) : "") +
      "</div>" +
      (r.message ? '<p class="rec-note">' + esc(r.message) + "</p>" : "") +
      actionsHtml(r) +
      "</div>"
    );
  }

  function render() {
    if (state.screen === "loading") {
      container.innerHTML = '<div class="editor-loading">Chargement…</div>';
      return;
    }
    if (state.screen === "error") {
      container.innerHTML =
        '<button type="button" class="back-btn" id="rc-back-error">‹ Retour</button>' +
        '<div class="login-error">' + esc(state.error) + "</div>";
      document.getElementById("rc-back-error").addEventListener("click", () => window.adminShowDashboard());
      return;
    }

    const filtered = state.filter === "all" ? state.items : state.items.filter((r) => (r.status || "nouveau") === state.filter);

    container.innerHTML =
      '<button type="button" class="back-btn" id="rc-back">‹ Retour</button>' +
      "<h1>Réservations reçues</h1>" +
      '<p class="dashboard-note">Toutes les demandes de réservation envoyées depuis le site.</p>' +
      (state.notice ? '<div class="rec-notice" style="background:#e7f1ed;border-left:4px solid #1f5d4c;padding:10px 14px;margin:0 0 12px;border-radius:4px;font-size:14px">' + esc(state.notice) + "</div>" : "") +
      '<div class="rec-toolbar"><div class="rec-filter">' +
      FILTERS.map((f) => '<button type="button" class="rec-filter-btn' + (state.filter === f.key ? " is-active" : "") + '" data-filter="' + f.key + '">' + esc(f.label) + "</button>").join("") +
      "</div></div>" +
      (filtered.length
        ? '<div class="rec-list">' + filtered.map(cardHtml).join("") + "</div>"
        : '<div class="rec-empty">Aucune réservation pour l\'instant.</div>');

    document.getElementById("rc-back").addEventListener("click", () => window.adminShowDashboard());

    container.querySelectorAll("[data-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.filter = btn.dataset.filter;
        render();
      });
    });

    container.querySelectorAll("[data-set-status]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.setStatus;
        const status = btn.dataset.status;
        btn.disabled = true;
        try {
          const result = await apiSetStatus(id, status);
          state.notice = noticeFor(status, result && result.email);
          const r = state.items.find((x) => x.id === id);
          if (r) r.status = status;
          render();
          if (window.refreshAdminAlerts) window.refreshAdminAlerts();
        } catch (err) {
          btn.disabled = false;
          alert(err.message);
        }
      });
    });

    container.querySelectorAll("[data-delete]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("Supprimer définitivement cette réservation ?")) return;
        const id = btn.dataset.delete;
        btn.disabled = true;
        try {
          await apiDelete(id);
          state.items = state.items.filter((r) => r.id !== id);
          render();
          if (window.refreshAdminAlerts) window.refreshAdminAlerts();
        } catch (err) {
          btn.disabled = false;
          alert(err.message);
        }
      });
    });
  }

  window.ReservationsClientsEditor = {
    async open() {
      state = { screen: "loading", items: [], filter: "all" };
      render();
      try {
        state.items = await apiList();
        state.screen = "ready";
      } catch (err) {
        state.screen = "error";
        state.error = err.message;
      }
      render();
    },
    async reload() {
      if (!state || state.screen !== "ready") return;
      try {
        state.items = await apiList();
        render();
      } catch {}
    },
  };
})();
