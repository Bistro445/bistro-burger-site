"use strict";
(() => {
  const cfg = window.SUPABASE_CONFIG;
  const errorBox = document.getElementById("login-error");

  if (!cfg || !cfg.url || !cfg.anonKey) {
    errorBox.hidden = false;
    errorBox.textContent = "Configuration manquante. Contactez la personne qui gère le site.";
    return;
  }

  const supabase = window.supabase.createClient(cfg.url, cfg.anonKey);

  async function authHeader() {
    const { data } = await supabase.auth.getSession();
    const token = data.session && data.session.access_token;
    return token ? { Authorization: "Bearer " + token } : {};
  }

  const loginScreen = document.getElementById("login-screen");
  const appView = document.getElementById("app-view");
  const loginForm = document.getElementById("login-form");
  const loginSubmit = document.getElementById("login-submit");
  const logoutBtn = document.getElementById("logout-btn");
  const greetingNameEl = document.getElementById("greeting-name");

  function setGreetingName(session) {
    if (!greetingNameEl) return;
    const email = session && session.user && session.user.email;
    const local = (email || "").split("@")[0];
    const name = local ? local.charAt(0).toUpperCase() + local.slice(1) : "";
    greetingNameEl.textContent = name ? ", " + name : "";
  }

  function showLoggedIn(session) {
    loginScreen.hidden = true;
    appView.hidden = false;
    setGreetingName(session);
    Reservations.open();
    if (!Reservations.pollTimer) {
      Reservations.pollTimer = setInterval(() => Reservations.reload(), 45000);
    }
    Push.init();
  }

  function showLoggedOut() {
    loginScreen.hidden = false;
    appView.hidden = true;
    if (Reservations.pollTimer) {
      clearInterval(Reservations.pollTimer);
      Reservations.pollTimer = null;
    }
  }

  supabase.auth.getSession().then(({ data }) => {
    if (data.session) showLoggedIn(data.session);
  });
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session) showLoggedIn(session);
    else showLoggedOut();
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data && event.data.type === "new-reservation") {
        Reservations.reload();
      }
    });
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    Sound.unlock();
    errorBox.hidden = true;
    loginSubmit.disabled = true;
    loginSubmit.textContent = "Connexion…";
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    loginSubmit.disabled = false;
    loginSubmit.textContent = "Se connecter";
    if (error) {
      errorBox.hidden = false;
      const code = error.code || "";
      const status = error.status || 0;
      errorBox.textContent =
        code === "email_not_confirmed"
          ? "Ce compte n'est pas encore activé : ouvrez le lien d'invitation reçu par e-mail, ou cliquez sur « Mot de passe oublié ? »."
          : status === 429 || /rate_limit/.test(code)
          ? "Trop de tentatives. Patientez quelques minutes avant de réessayer."
          : code === "invalid_credentials" || status === 400
          ? "E-mail ou mot de passe incorrect. Si vous l'avez oublié, cliquez sur « Mot de passe oublié ? »."
          : "Connexion impossible pour le moment. Vérifiez votre connexion internet et réessayez.";
    }
  });

  logoutBtn.addEventListener("click", () => {
    Push.unsubscribe();
    // Cet appareil seulement (par défaut Supabase déconnecte tous les appareils du compte).
    supabase.auth.signOut({ scope: "local" });
  });

  const forgotPasswordLink = document.getElementById("forgot-password-link");
  const forgotPasswordForm = document.getElementById("forgot-password-form");
  const forgotBackLink = document.getElementById("forgot-back-link");
  const forgotSubmit = document.getElementById("forgot-submit");
  const forgotSuccess = document.getElementById("forgot-success");
  const forgotError = document.getElementById("forgot-error");
  const forgotEmailInput = document.getElementById("forgot-email");

  forgotPasswordLink.addEventListener("click", () => {
    forgotEmailInput.value = document.getElementById("email").value.trim();
    loginForm.hidden = true;
    errorBox.hidden = true;
    forgotSuccess.hidden = true;
    forgotError.hidden = true;
    forgotPasswordForm.hidden = false;
  });
  forgotBackLink.addEventListener("click", () => {
    forgotPasswordForm.hidden = true;
    loginForm.hidden = false;
  });
  forgotPasswordForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    forgotSuccess.hidden = true;
    forgotError.hidden = true;
    forgotSubmit.disabled = true;
    forgotSubmit.textContent = "Envoi…";
    const email = forgotEmailInput.value.trim();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/admin/",
    });
    forgotSubmit.disabled = false;
    forgotSubmit.textContent = "Envoyer le lien";
    if (error) {
      forgotError.hidden = false;
      forgotError.textContent = "Échec de l'envoi : " + error.message;
    } else {
      forgotSuccess.hidden = false;
    }
  });

  /* ------------------------------------------------------------------ */
  /* Inviter un administrateur                                           */
  /* ------------------------------------------------------------------ */
  const inviteToggleBtn = document.getElementById("invite-toggle-btn");
  const inviteBackdrop = document.getElementById("invite-backdrop");
  const invitePopover = document.getElementById("invite-popover");
  const inviteForm = document.getElementById("invite-form");
  const inviteSubmit = document.getElementById("invite-submit");
  const inviteSuccess = document.getElementById("invite-success");
  const inviteError = document.getElementById("invite-error");

  function openInvitePopover() {
    inviteBackdrop.hidden = false;
    invitePopover.hidden = false;
  }
  function closeInvitePopover() {
    inviteBackdrop.hidden = true;
    invitePopover.hidden = true;
  }
  inviteToggleBtn.addEventListener("click", () => {
    if (invitePopover.hidden) openInvitePopover();
    else closeInvitePopover();
  });
  inviteBackdrop.addEventListener("click", closeInvitePopover);

  inviteForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    inviteSuccess.hidden = true;
    inviteError.hidden = true;
    inviteSubmit.disabled = true;
    inviteSubmit.textContent = "Envoi…";

    const email = document.getElementById("invite-email").value.trim();

    try {
      const headers = await authHeader();
      const res = await fetch("/api/admin/invite", {
        method: "POST",
        headers: Object.assign({ "Content-Type": "application/json" }, headers),
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Échec de l'envoi.");
      inviteSuccess.hidden = false;
      inviteForm.reset();
    } catch (err) {
      inviteError.hidden = false;
      inviteError.textContent = err.message;
    } finally {
      inviteSubmit.disabled = false;
      inviteSubmit.textContent = "Envoyer l'invitation";
    }
  });

  /* ------------------------------------------------------------------ */
  /* Sonnerie de notification (synthétisée, sans fichier audio)          */
  /* ------------------------------------------------------------------ */
  const Sound = (() => {
    let ctx = null;
    function ensureCtx() {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      if (!ctx) ctx = new AudioCtx();
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      return ctx;
    }
    function tone(c, freq, startTime, duration, peak) {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(peak, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      osc.connect(gain).connect(c.destination);
      osc.start(startTime);
      osc.stop(startTime + duration + 0.05);
    }
    return {
      unlock() {
        ensureCtx();
      },
      play() {
        const c = ensureCtx();
        if (!c) return;
        const now = c.currentTime;
        tone(c, 880, now, 0.16, 0.2);
        tone(c, 1174.66, now + 0.14, 0.24, 0.18);
      },
    };
  })();

  document.addEventListener("click", () => Sound.unlock(), { once: true, capture: true });

  /* ------------------------------------------------------------------ */
  /* Boîte de dialogue de confirmation générique                         */
  /* ------------------------------------------------------------------ */
  const Confirm = (() => {
    const backdrop = document.getElementById("confirm-backdrop");
    const modal = document.getElementById("confirm-modal");
    const titleEl = document.getElementById("confirm-modal-title");
    const textEl = document.getElementById("confirm-modal-text");
    const cancelBtn = document.getElementById("confirm-modal-cancel");
    const confirmBtn = document.getElementById("confirm-modal-confirm");
    let resolvePromise = null;

    function close(result) {
      backdrop.hidden = true;
      modal.hidden = true;
      if (resolvePromise) {
        resolvePromise(result);
        resolvePromise = null;
      }
    }
    cancelBtn.addEventListener("click", () => close(false));
    backdrop.addEventListener("click", () => close(false));
    confirmBtn.addEventListener("click", () => close(true));

    return {
      ask(title, text) {
        titleEl.textContent = title;
        textEl.textContent = text;
        backdrop.hidden = false;
        modal.hidden = false;
        return new Promise((resolve) => {
          resolvePromise = resolve;
        });
      },
    };
  })();

  /* ------------------------------------------------------------------ */
  /* Liste des réservations (confirmer / annuler)                        */
  /* ------------------------------------------------------------------ */
  const Reservations = (() => {
    const API_URL = "/api/admin/reservations";
    const root = document.getElementById("reservations-root");
    let state = null;

    function esc(s) {
      return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
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
      const headers = await authHeader();
      const res = await fetch(API_URL, { headers });
      if (!res.ok) throw new Error("Échec du chargement.");
      const json = await res.json();
      return json.items || [];
    }
    async function apiSetStatus(id, status) {
      const headers = await authHeader();
      const res = await fetch(API_URL, {
        method: "PATCH",
        headers: Object.assign({ "Content-Type": "application/json" }, headers),
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error("Échec de la mise à jour.");
    }

    const FILTERS = [
      { key: "nouveau", label: "En attente" },
      { key: "confirmee", label: "Confirmées" },
      { key: "annulee", label: "Annulées" },
      { key: "all", label: "Toutes" },
    ];
    const STATUS_LABELS = { nouveau: "Nouvelle", confirmee: "Confirmée", annulee: "Annulée" };

    function actionsHtml(r) {
      const status = r.status || "nouveau";
      const btns = [];
      if (status !== "confirmee") btns.push('<button type="button" class="rec-btn rec-btn-primary" data-set-status="' + esc(r.id) + '" data-status="confirmee">Confirmer</button>');
      if (status !== "annulee") btns.push('<button type="button" class="rec-btn rec-btn-danger" data-set-status="' + esc(r.id) + '" data-status="annulee">Annuler</button>');
      if (status !== "nouveau") btns.push('<button type="button" class="rec-btn" data-set-status="' + esc(r.id) + '" data-status="nouveau">Remettre en attente</button>');
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

    function ymd(d) {
      return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    }
    function todayStr() {
      return ymd(new Date());
    }
    function tomorrowStr() {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return ymd(d);
    }
    function formatDisplayDate(iso) {
      try {
        const s = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(new Date(iso + "T00:00:00"));
        return s.charAt(0).toUpperCase() + s.slice(1);
      } catch {
        return iso;
      }
    }
    function calendarHtml() {
      const y = state.calYear;
      const m = state.calMonth;
      const first = new Date(y, m, 1);
      const startOffset = (first.getDay() + 6) % 7;
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      const today = todayStr();
      const selected = state.dateFilter || "";
      const monthLabel = first.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
      const monthLabelCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

      let cells = "";
      for (let i = 0; i < startOffset; i++) cells += "<span></span>";
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = y + "-" + String(m + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
        const cls = ["pdj-cal-day"];
        if (dateStr === selected) cls.push("is-selected");
        if (dateStr === today) cls.push("is-today");
        cells += '<button type="button" class="' + cls.join(" ") + '" data-cal-day="' + dateStr + '">' + d + "</button>";
      }

      return (
        '<div class="pdj-cal">' +
        '<div class="pdj-cal-head">' +
        '<button type="button" class="pdj-cal-nav" id="rec-cal-prev" aria-label="Mois précédent">‹</button>' +
        '<span class="pdj-cal-month">' + esc(monthLabelCap) + "</span>" +
        '<button type="button" class="pdj-cal-nav" id="rec-cal-next" aria-label="Mois suivant">›</button>' +
        "</div>" +
        '<div class="pdj-cal-grid">' +
        ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => '<span class="pdj-cal-dow">' + d + "</span>").join("") +
        cells +
        "</div>" +
        (selected
          ? '<div class="pdj-cal-selected-box"><span class="pdj-cal-selected-check">✓</span>' + esc(formatDisplayDate(selected)) + "</div>"
          : '<div class="pdj-cal-selected-box is-empty">Choisissez une date ci-dessous</div>') +
        "</div>"
      );
    }

    function render() {
      if (state.screen === "loading") {
        root.innerHTML = '<div class="editor-loading">Chargement…</div>';
        return;
      }
      if (state.screen === "error") {
        root.innerHTML = '<div class="login-error">' + esc(state.error) + "</div>";
        return;
      }
      const filtered = state.items
        .filter((r) => state.filter === "all" || (r.status || "nouveau") === state.filter)
        .filter((r) => !state.dateFilter || r.reservation_date === state.dateFilter);

      const today = todayStr();
      const tomorrow = tomorrowStr();
      const emptyMessage = state.dateFilter
        ? "Aucune réservation à cette date."
        : "Aucune réservation ici pour l'instant.";

      root.innerHTML =
        '<div class="rec-toolbar">' +
        '<div class="rec-filter">' +
        FILTERS.map((f) => '<button type="button" class="rec-filter-btn' + (state.filter === f.key ? " is-active" : "") + '" data-filter="' + f.key + '">' + esc(f.label) + "</button>").join("") +
        "</div>" +
        '<div class="rec-date-filter">' +
        '<button type="button" class="rec-filter-btn' + (state.dateFilter === today ? " is-active" : "") + '" data-date-quick="' + today + '">Aujourd\'hui</button>' +
        '<button type="button" class="rec-filter-btn' + (state.dateFilter === tomorrow ? " is-active" : "") + '" data-date-quick="' + tomorrow + '">Demain</button>' +
        '<button type="button" class="rec-filter-btn' + (state.showCalendar ? " is-active" : "") + '" id="rec-cal-toggle">Calendrier</button>' +
        (state.dateFilter ? '<button type="button" class="rec-date-clear" id="rec-date-clear" aria-label="Effacer le filtre de date">×</button>' : "") +
        "</div>" +
        "</div>" +
        (state.showCalendar ? calendarHtml() : "") +
        (filtered.length
          ? '<div class="rec-list">' + filtered.map(cardHtml).join("") + "</div>"
          : '<div class="rec-empty">' + esc(emptyMessage) + "</div>");

      root.querySelectorAll("[data-filter]").forEach((btn) => {
        btn.addEventListener("click", () => { state.filter = btn.dataset.filter; render(); });
      });
      root.querySelectorAll("[data-date-quick]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const date = btn.dataset.dateQuick;
          state.dateFilter = state.dateFilter === date ? null : date;
          render();
        });
      });
      const calToggle = document.getElementById("rec-cal-toggle");
      if (calToggle) {
        calToggle.addEventListener("click", () => {
          state.showCalendar = !state.showCalendar;
          render();
        });
      }
      const calPrev = document.getElementById("rec-cal-prev");
      if (calPrev) {
        calPrev.addEventListener("click", () => {
          state.calMonth -= 1;
          if (state.calMonth < 0) {
            state.calMonth = 11;
            state.calYear -= 1;
          }
          render();
        });
      }
      const calNext = document.getElementById("rec-cal-next");
      if (calNext) {
        calNext.addEventListener("click", () => {
          state.calMonth += 1;
          if (state.calMonth > 11) {
            state.calMonth = 0;
            state.calYear += 1;
          }
          render();
        });
      }
      root.querySelectorAll("[data-cal-day]").forEach((btn) => {
        btn.addEventListener("click", () => {
          state.dateFilter = btn.dataset.calDay;
          state.showCalendar = false;
          render();
        });
      });
      const dateClear = document.getElementById("rec-date-clear");
      if (dateClear) {
        dateClear.addEventListener("click", () => {
          state.dateFilter = null;
          render();
        });
      }
      root.querySelectorAll("[data-set-status]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const id = btn.dataset.setStatus;
          const status = btn.dataset.status;
          if (status === "annulee") {
            const r = state.items.find((x) => x.id === id);
            const ok = await Confirm.ask(
              "Annuler cette réservation ?",
              (r ? r.name + " — " : "") + "Cette action peut être annulée en remettant la réservation en attente si besoin."
            );
            if (!ok) return;
          }
          btn.disabled = true;
          try {
            await apiSetStatus(id, status);
            const r = state.items.find((x) => x.id === id);
            if (r) r.status = status;
            render();
            renderStats();
          } catch (err) {
            btn.disabled = false;
            alert(err.message);
          }
        });
      });
    }

    function startOfWeek(d) {
      const day = (d.getDay() + 6) % 7; // lundi = 0
      const monday = new Date(d);
      monday.setDate(d.getDate() - day);
      monday.setHours(0, 0, 0, 0);
      return monday;
    }
    function renderStats() {
      if (!state || !state.items) return;
      const pendingEl = document.getElementById("stat-pending-value");
      const todayEl = document.getElementById("stat-today-value");
      const weekEl = document.getElementById("stat-week-value");
      if (!pendingEl || !todayEl || !weekEl) return;

      const now = new Date();
      const monday = startOfWeek(now);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      const pending = state.items.filter((r) => (r.status || "nouveau") === "nouveau").length;
      const todayCount = state.items.filter((r) => r.reservation_date === ymd(now)).length;
      const weekCount = state.items.filter((r) => {
        if (!r.reservation_date) return false;
        const d = new Date(r.reservation_date + "T00:00:00");
        return d >= monday && d <= sunday;
      }).length;

      pendingEl.textContent = pending;
      todayEl.textContent = todayCount;
      weekEl.textContent = weekCount;
    }

    return {
      pollTimer: null,
      async open() {
        const now = new Date();
        state = {
          screen: "loading",
          items: [],
          filter: "nouveau",
          dateFilter: null,
          showCalendar: false,
          calYear: now.getFullYear(),
          calMonth: now.getMonth(),
          seenIds: new Set(),
        };
        render();
        try {
          state.items = await apiList();
          state.items.forEach((r) => state.seenIds.add(r.id));
          state.screen = "ready";
        } catch (err) {
          state.screen = "error";
          state.error = err.message;
        }
        render();
        renderStats();
      },
      async reload() {
        if (!state || state.screen !== "ready") return;
        try {
          const items = await apiList();
          const newPending = items.filter((r) => !state.seenIds.has(r.id) && (r.status || "nouveau") === "nouveau");
          items.forEach((r) => state.seenIds.add(r.id));
          state.items = items;
          render();
          renderStats();
          if (newPending.length) {
            Sound.play();
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
          }
        } catch {}
      },
    };
  })();

  /* ------------------------------------------------------------------ */
  /* Notifications push                                                  */
  /* ------------------------------------------------------------------ */
  const Push = (() => {
    const banner = document.getElementById("push-banner");
    const bannerText = document.getElementById("push-banner-text");
    const enableBtn = document.getElementById("push-enable-btn");
    const iosBanner = document.getElementById("ios-banner");

    function urlBase64ToUint8Array(base64String) {
      const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
      const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
      const rawData = atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
      return outputArray;
    }

    function isStandalone() {
      return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    }
    function isIOS() {
      return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    }

    async function subscribeToPush() {
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(cfg.vapidPublicKey),
        });
      }
      const headers = await authHeader();
      await fetch("/api/app/subscribe", {
        method: "POST",
        headers: Object.assign({ "Content-Type": "application/json" }, headers),
        body: JSON.stringify(subscription),
      });
      banner.hidden = true;
    }

    async function unsubscribe() {
      try {
        if (!("serviceWorker" in navigator)) return;
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) await subscription.unsubscribe();
      } catch {}
    }

    return {
      unsubscribe,
      async init() {
        if (!cfg.vapidPublicKey) return; // notifications push pas encore configurées côté serveur
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

        if (isIOS() && !isStandalone()) {
          iosBanner.hidden = false;
          return;
        }

        try {
          const registration = await navigator.serviceWorker.register("sw.js");
          await navigator.serviceWorker.ready;
          const existing = await registration.pushManager.getSubscription();
          if (existing) {
            const headers = await authHeader();
            fetch("/api/app/subscribe", {
              method: "POST",
              headers: Object.assign({ "Content-Type": "application/json" }, headers),
              body: JSON.stringify(existing),
            }).catch(() => {});
            return;
          }
          if (Notification.permission === "denied") return;
          bannerText.textContent = "Activez les notifications pour être prévenu dès qu'une réservation arrive.";
          banner.hidden = false;
          enableBtn.addEventListener("click", async () => {
            enableBtn.disabled = true;
            try {
              const perm = await Notification.requestPermission();
              if (perm !== "granted") {
                bannerText.textContent = "Notifications refusées. Vous pouvez les autoriser plus tard dans les réglages du téléphone.";
                return;
              }
              await subscribeToPush();
            } catch (err) {
              bannerText.textContent = "Échec de l'activation des notifications.";
            } finally {
              enableBtn.disabled = false;
            }
          }, { once: true });
        } catch {}
      },
    };
  })();
})();
