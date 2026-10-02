"use strict";
(() => {
  const API_URL = "/api/admin/content";
  const container = document.getElementById("horaires-view");
  if (!container || !window.BBHours) return;

  const H = window.BBHours;
  const LABELS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

  let rows = null; // un objet par jour : { open, a1, b1, second, a2, b2 }
  let message = "";
  let messageIsError = false;
  let busy = false;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[c]);
  }

  function fromData(data) {
    const norm = H.normalize(data);
    return H.DAYS.map((d) => {
      const r = norm.days[d];
      return {
        open: r.length > 0,
        a1: r[0] ? r[0][0] : "09:00",
        b1: r[0] ? r[0][1] : "14:00",
        second: r.length > 1,
        a2: r[1] ? r[1][0] : "17:30",
        b2: r[1] ? r[1][1] : "21:30",
      };
    });
  }

  function toData() {
    const days = {};
    H.DAYS.forEach((d, i) => {
      const r = rows[i];
      const ranges = [];
      if (r.open) {
        ranges.push([r.a1, r.b1]);
        if (r.second) ranges.push([r.a2, r.b2]);
      }
      days[d] = ranges;
    });
    return { days };
  }

  // Renvoie un message d'erreur en français, ou "" si tout est cohérent.
  function validate() {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.open) continue;
      const a1 = H.toMinutes(r.a1), b1 = H.toMinutes(r.b1);
      if (a1 === null || b1 === null || a1 >= b1) return LABELS[i] + " : l'heure d'ouverture doit être avant l'heure de fermeture.";
      if (r.second) {
        const a2 = H.toMinutes(r.a2), b2 = H.toMinutes(r.b2);
        if (a2 === null || b2 === null || a2 >= b2) return LABELS[i] + " : la deuxième plage est incorrecte (ouverture avant fermeture).";
        if (a2 < b1) return LABELS[i] + " : la deuxième plage doit commencer après la fin de la première.";
      }
    }
    return "";
  }

  function previewHtml() {
    const lines = H.longLines(H.normalize(toData()));
    return lines.map((l) => "<div>" + esc(l) + "</div>").join("");
  }

  function timeInput(i, field, value, disabled) {
    return '<input type="time" class="field" data-i="' + i + '" data-f="' + field + '" value="' + esc(value) + '"' +
      (disabled ? " disabled" : "") + ' style="width:auto; min-width:118px; padding:8px 10px;">';
  }

  function render() {
    if (!rows) {
      container.innerHTML = "<h1>Horaires d'ouverture</h1><p>Chargement…</p>";
      return;
    }
    const rowsHtml = rows.map((r, i) => {
      return (
        '<div style="padding:14px 0; border-top:1px solid rgba(0,0,0,.08);">' +
          '<div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">' +
            '<strong style="min-width:92px;">' + LABELS[i] + "</strong>" +
            '<label style="display:flex; align-items:center; gap:6px; cursor:pointer;">' +
              '<input type="checkbox" data-i="' + i + '" data-f="open"' + (r.open ? " checked" : "") + "> Ouvert" +
            "</label>" +
            (r.open ? "" : '<span style="opacity:.7;">Fermé</span>') +
          "</div>" +
          (r.open
            ? '<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-top:10px; margin-left:104px;">' +
                "<span>de</span>" + timeInput(i, "a1", r.a1) + "<span>à</span>" + timeInput(i, "b1", r.b1) +
              "</div>" +
              '<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-top:10px; margin-left:104px;">' +
                '<label style="display:flex; align-items:center; gap:6px; cursor:pointer;">' +
                  '<input type="checkbox" data-i="' + i + '" data-f="second"' + (r.second ? " checked" : "") + "> Deuxième plage (ex : le soir)" +
                "</label>" +
                (r.second
                  ? "<span>de</span>" + timeInput(i, "a2", r.a2) + "<span>à</span>" + timeInput(i, "b2", r.b2)
                  : "") +
              "</div>"
            : "") +
        "</div>"
      );
    }).join("");

    container.innerHTML =
      "<h1>Horaires d'ouverture</h1>" +
      '<p class="dashboard-note" style="margin-bottom:16px;">Ces horaires s\'affichent sur le site (accueil, pied de page, questions fréquentes), sont transmis à Google, et décident des créneaux proposés dans le formulaire de réservation.</p>' +
      rowsHtml +
      '<div style="margin-top:20px; padding:14px 16px; border-radius:12px; background:rgba(18,87,76,.08);">' +
        '<div style="font-weight:600; margin-bottom:6px;">Aperçu sur le site</div>' + '<div id="hr-preview" style="line-height:1.6;">' + previewHtml() + "</div>" +
      "</div>" +
      '<div style="margin-top:18px; display:flex; align-items:center; gap:14px; flex-wrap:wrap;">' +
        '<button type="button" class="btn-primary" id="hr-save" style="width:auto; padding:11px 20px;"' + (busy ? " disabled" : "") + ">" + (busy ? "Enregistrement…" : "Enregistrer les horaires") + "</button>" +
        '<button type="button" id="hr-reset" style="padding:10px 14px; border:1px solid rgba(0,0,0,.2); background:#fff; border-radius:10px; cursor:pointer;">Remettre les horaires par défaut</button>' +
      "</div>" +
      (message
        ? '<div style="margin-top:14px; font-size:14px; color:' + (messageIsError ? "#B5362B" : "#1B7F5F") + ';">' + esc(message) + "</div>"
        : "");
  }

  async function load() {
    rows = null;
    message = "";
    render();
    try {
      const headers = await window.adminAuth.authHeader();
      const res = await fetch(API_URL + "?key=horaires", { headers });
      if (!res.ok) throw new Error("Échec du chargement.");
      const json = await res.json();
      rows = fromData(json.value);
    } catch (err) {
      rows = fromData(null);
      message = err.message || "Échec du chargement.";
      messageIsError = true;
    }
    render();
  }

  async function save() {
    const err = validate();
    if (err) {
      message = err;
      messageIsError = true;
      render();
      return;
    }
    busy = true;
    message = "";
    render();
    try {
      const headers = await window.adminAuth.authHeader();
      const res = await fetch(API_URL, {
        method: "PUT",
        headers: Object.assign({ "Content-Type": "application/json" }, headers),
        body: JSON.stringify({ key: "horaires", value: toData() }),
      });
      if (!res.ok) throw new Error("Échec de l'enregistrement.");
      const json = await res.json().catch(() => ({}));
      if (json.deployTriggered === false) {
        throw new Error("Enregistré, mais la mise à jour du site a échoué. Contactez la personne qui gère le site.");
      }
      message = "Horaires enregistrés. Le site est mis à jour.";
      messageIsError = false;
    } catch (e) {
      message = e.message || "Échec de l'enregistrement.";
      messageIsError = true;
    }
    busy = false;
    render();
  }

  container.addEventListener("change", (e) => {
    const el = e.target;
    const i = el.getAttribute && el.getAttribute("data-i");
    const f = el.getAttribute && el.getAttribute("data-f");
    if (i === null || f === null || !rows) return;
    const r = rows[Number(i)];
    if (f === "open" || f === "second") r[f] = el.checked;
    else r[f] = el.value;
    message = "";
    render();
  });

  container.addEventListener("click", (e) => {
    if (e.target.closest("#hr-save")) save();
    else if (e.target.closest("#hr-reset")) {
      rows = fromData(null);
      message = "Horaires par défaut remis. Pensez à enregistrer.";
      messageIsError = false;
      render();
    }
  });

  window.HorairesEditor = { open: load };
})();
