"use strict";
(() => {
  const API_URL = "/api/admin/content";
  const container = document.getElementById("reservations-view");

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

  async function apiGet() {
    const headers = await window.adminAuth.authHeader();
    const res = await fetch(API_URL + "?key=reservation_settings", { headers });
    if (!res.ok) throw new Error("Échec du chargement.");
    const json = await res.json();
    return json.value || { heures: [], couverts: [], horaires_text: [] };
  }

  async function apiSave(data) {
    const headers = await window.adminAuth.authHeader();
    const res = await fetch(API_URL, {
      method: "PUT",
      headers: Object.assign({ "Content-Type": "application/json" }, headers),
      body: JSON.stringify({ key: "reservation_settings", value: data }),
    });
    if (!res.ok) throw new Error("Échec de l'enregistrement.");
    const json = await res.json();
    if (json.deployTriggered === false) {
      throw new Error(
        "Enregistré, mais la republication du site a échoué. Contactez la personne qui gère le site."
      );
    }
  }

  const FIELDS = [
    { key: "heures", label: "Créneaux horaires proposés", placeholder: "Ajouter un créneau (ex : 12h30)" },
    { key: "couverts", label: "Nombre de couverts proposé", placeholder: "Ajouter un nombre (ex : 4 personnes)" },
    { key: "horaires_text", label: "Autres lignes affichées sous les horaires (ex : parking). Les horaires se règlent dans « Horaires d'ouverture ».", placeholder: "Ajouter une ligne d'information" },
  ];

  function chipRowHtml(key, values) {
    if (!values.length) return '<p class="dashboard-note">Aucune valeur pour l\'instant.</p>';
    return values
      .map(
        (v, i) =>
          '<span class="r-chip">' +
          esc(v) +
          '<button type="button" class="r-chip-remove" data-remove-key="' + key + '" data-remove-i="' + i + '" aria-label="Retirer">×</button>' +
          "</span>"
      )
      .join("");
  }

  function fieldHtml(field) {
    const values = state.data[field.key] || [];
    return (
      '<label class="r-label">' + esc(field.label) + "</label>" +
      '<div class="r-chip-row">' + chipRowHtml(field.key, values) + "</div>" +
      '<div class="r-chip-add">' +
      '<input class="r-chip-input" id="r-' + field.key + '-input" placeholder="' + esc(field.placeholder) + '">' +
      '<button type="button" class="r-chip-add-btn" data-add-key="' + field.key + '">Ajouter</button>' +
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
        '<button type="button" class="back-btn" id="r-back-menu-error">‹ Retour</button>' +
        '<div class="login-error">' + esc(state.error) + "</div>";
      document.getElementById("r-back-menu-error").addEventListener("click", () => window.adminShowDashboard());
      return;
    }

    container.innerHTML =
      '<button type="button" class="back-btn" id="r-back-menu">‹ Retour</button>' +
      "<h1>Réglages de réservation</h1>" +
      '<p class="dashboard-note">Ajoutez ou retirez des valeurs. L\'ordre est celui affiché sur le site.</p>' +
      FIELDS.map(fieldHtml).join('<hr class="divider">') +
      '<div class="r-actions">' +
      '<button type="button" class="r-btn-back" id="r-cancel"' + (state.saving ? " disabled" : "") + ">Annuler</button>" +
      '<button type="button" class="r-btn-save" id="r-save"' + (state.saving ? " disabled" : "") + ">" +
      (state.saving ? "Enregistrement…" : "Enregistrer") +
      "</button>" +
      "</div>" +
      (state.saveSuccess ? '<div class="password-success">Enregistré.</div>' : "") +
      (state.saveError ? '<div class="login-error">' + esc(state.saveError) + "</div>" : "");

    document.getElementById("r-back-menu").addEventListener("click", () => window.adminShowDashboard());

    container.querySelectorAll("[data-remove-key]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.removeKey;
        const i = Number(btn.dataset.removeI);
        state.data[key].splice(i, 1);
        render();
      });
    });

    function addFromInput(key) {
      const input = document.getElementById("r-" + key + "-input");
      const val = input.value.trim();
      if (!val) return;
      if (!state.data[key]) state.data[key] = [];
      state.data[key].push(val);
      render();
    }

    container.querySelectorAll("[data-add-key]").forEach((btn) => {
      btn.addEventListener("click", () => addFromInput(btn.dataset.addKey));
    });
    FIELDS.forEach((field) => {
      const input = document.getElementById("r-" + field.key + "-input");
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          addFromInput(field.key);
        }
      });
    });

    document.getElementById("r-cancel").addEventListener("click", async () => {
      state.screen = "loading";
      state.saveError = null;
      state.saveSuccess = false;
      render();
      try {
        state.data = await apiGet();
        state.screen = "ready";
      } catch (err) {
        state.screen = "error";
        state.error = err.message;
      }
      render();
    });

    document.getElementById("r-save").addEventListener("click", async () => {
      state.saving = true;
      state.saveError = null;
      state.saveSuccess = false;
      render();
      try {
        await apiSave(state.data);
        state.saveSuccess = true;
      } catch (err) {
        state.saveError = err.message;
      } finally {
        state.saving = false;
        render();
      }
    });
  }

  window.ReservationsEditor = {
    async open() {
      state = { screen: "loading", data: null, saving: false, saveError: null, saveSuccess: false };
      render();
      try {
        state.data = await apiGet();
        state.screen = "ready";
      } catch (err) {
        state.screen = "error";
        state.error = err.message;
      }
      render();
    },
  };
})();
