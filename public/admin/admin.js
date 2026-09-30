"use strict";

/* Utilitaire partagé : brouillons auto-sauvegardés en localStorage pour   */
/* les formulaires admin (burgers, burger du moment...). Indépendant de   */
/* la config Supabase pour rester disponible même si celle-ci est absente. */
window.AdminDrafts = (() => {
  const PREFIX = "bb-admin-draft:";
  function save(key, data) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify({ data, savedAt: Date.now() }));
    } catch {}
  }
  function load(key) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || !("data" in parsed)) return null;
      return parsed;
    } catch {
      return null;
    }
  }
  function clear(key) {
    try { localStorage.removeItem(PREFIX + key); } catch {}
  }
  function timeAgo(ts) {
    const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (s < 5) return "à l'instant";
    if (s < 60) return "il y a " + s + " s";
    const m = Math.floor(s / 60);
    if (m < 60) return "il y a " + m + " min";
    const h = Math.floor(m / 60);
    if (h < 24) return "il y a " + h + " h";
    const d = Math.floor(h / 24);
    return "il y a " + d + " j";
  }
  return { save, load, clear, timeAgo };
})();

(() => {
  const cfg = window.SUPABASE_CONFIG;
  const errorBox = document.getElementById("login-error");

  if (!cfg || !cfg.url || !cfg.anonKey) {
    errorBox.hidden = false;
    errorBox.textContent = "Configuration manquante. Contactez la personne qui gère le site.";
    return;
  }

  const supabase = window.supabase.createClient(cfg.url, cfg.anonKey);

  window.adminAuth = {
    supabase,
    async authHeader() {
      const { data } = await supabase.auth.getSession();
      const token = data.session && data.session.access_token;
      return token ? { Authorization: "Bearer " + token } : {};
    },
  };

  const loginScreen = document.getElementById("login-screen");
  const appShell = document.getElementById("app-shell");
  const pageTitle = document.getElementById("page-title");
  const userEmailEl = document.getElementById("user-email");
  const userAvatarEl = document.getElementById("user-avatar");
  const dashboardFirstnameEl = document.getElementById("dashboard-firstname");
  const ppAvatarEl = document.getElementById("pp-avatar");
  const ppNameEl = document.getElementById("pp-name");
  const ppEmailEl = document.getElementById("pp-email");
  const loginForm = document.getElementById("login-form");
  const loginSubmit = document.getElementById("login-submit");
  const logoutBtnPanel = document.getElementById("logout-btn-panel");

  const sidebar = document.getElementById("app-sidebar");
  const sidebarBackdrop = document.getElementById("sidebar-backdrop");
  const hamburgerBtn = document.getElementById("hamburger-btn");
  const sidebarCollapseBtn = document.getElementById("sidebar-collapse-btn");

  try {
    if (localStorage.getItem("bb-admin-sidebar-collapsed") === "1") {
      sidebar.classList.add("is-collapsed");
    }
  } catch {}

  sidebarCollapseBtn.addEventListener("click", () => {
    const collapsed = sidebar.classList.toggle("is-collapsed");
    try {
      localStorage.setItem("bb-admin-sidebar-collapsed", collapsed ? "1" : "0");
    } catch {}
  });

  // Une entrée par section : editor est optionnel (le tableau de bord n'en a pas).
  const SECTIONS = [
    { key: "dashboard", title: "Accueil" },
    { key: "burgers", title: "Les burgers", editor: () => window.BurgersEditor },
    { key: "burgerdumoment", title: "Burger du moment", editor: () => window.BurgerDuMomentEditor },
    { key: "carte", title: "La carte", editor: () => window.CarteEditor },
    { key: "platdujour", title: "Plat du jour", editor: () => window.PlatDuJourEditor },
    { key: "offres", title: "Offres", editor: () => window.OffresEditor },
    { key: "reservations", title: "Réservations", editor: () => window.ReservationsEditor },
    { key: "popup", title: "Pop-up promo", editor: () => window.PopupEditor },
    { key: "annonces", title: "Annonces", editor: () => window.AnnoncesEditor },
    { key: "blog", title: "Blog", editor: () => window.BlogEditor },
    { key: "commandes", title: "Commandes", editor: () => window.CommandesEditor },
    { key: "reservations-clients", title: "Réservations reçues", editor: () => window.ReservationsClientsEditor },
  ];

  SECTIONS.forEach((s) => {
    s.viewEl = document.getElementById(s.key + "-view");
    s.navEl = document.getElementById("nav-" + s.key);
    s.cardEl = document.getElementById("nav-" + s.key + "-card");
  });

  function closeSidebar() {
    sidebar.classList.remove("is-open");
    sidebarBackdrop.classList.remove("is-visible");
  }

  hamburgerBtn.addEventListener("click", () => {
    sidebar.classList.toggle("is-open");
    sidebarBackdrop.classList.toggle("is-visible");
  });
  sidebarBackdrop.addEventListener("click", closeSidebar);

  let lastSectionKey = "dashboard";

  function showSection(key) {
    SECTIONS.forEach((s) => {
      if (s.viewEl) s.viewEl.hidden = s.key !== key;
      if (s.navEl) s.navEl.classList.toggle("is-active", s.key === key);
    });
    const active = SECTIONS.find((s) => s.key === key);
    pageTitle.textContent = (active && active.title) || "";
    closeSidebar();
    window.scrollTo(0, 0);
    lastSectionKey = key;
  }
  window.adminShowDashboard = () => showSection("dashboard");

  SECTIONS.forEach((s) => {
    const open = () => {
      showSection(s.key);
      if (s.editor) s.editor().open();
    };
    if (s.navEl) s.navEl.addEventListener("click", open);
    if (s.cardEl) s.cardEl.addEventListener("click", open);
  });

  // Après une reconnexion (ex : session expirée en plein milieu d'une
  // modification), on revient à la section où on était plutôt que de forcer
  // le tableau de bord — la bannière "brouillon non enregistré" de chaque
  // éditeur reprend alors la main pour proposer de restaurer le travail en cours.
  function reopenLastSection() {
    const s = SECTIONS.find((s) => s.key === lastSectionKey);
    if (!s || s.key === "dashboard") { showSection("dashboard"); return; }
    showSection(s.key);
    if (s.editor) s.editor().open();
  }

  function renderAvatarInto(el, user) {
    el.innerHTML = "";
    const url = user.user_metadata && user.user_metadata.avatar_url;
    if (url) {
      const img = document.createElement("img");
      img.src = url;
      img.alt = "";
      img.style.cssText = "width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;";
      el.appendChild(img);
    } else {
      el.textContent = user.email.charAt(0).toUpperCase();
    }
  }

  let alertsInterval = null;
  let lastKnownAlertTotal = null;
  let audioCtx = null;

  function ensureAudioContext() {
    if (!audioCtx) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch {}
    }
    return audioCtx;
  }

  function playNotificationSound() {
    const ctx = ensureAudioContext();
    if (!ctx) return;
    try {
      if (ctx.state === "suspended") ctx.resume();
      const now = ctx.currentTime;
      [880, 1318.51].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, now + i * 0.13);
        gain.gain.linearRampToValueAtTime(0.22, now + i * 0.13 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.13 + 0.45);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + i * 0.13);
        osc.stop(now + i * 0.13 + 0.45);
      });
    } catch {}
  }

  function setAlertBadge(key, count) {
    [document.getElementById("badge-" + key), document.getElementById("card-badge-" + key)].forEach((el) => {
      if (!el) return;
      el.textContent = count > 99 ? "99+" : String(count);
      el.hidden = count <= 0;
    });
  }

  document.addEventListener("click", () => ensureAudioContext(), { once: true });

  const notifBellBtn = document.getElementById("notif-bell-btn");
  const notifBellBadge = document.getElementById("notif-bell-badge");
  const notifBellPanel = document.getElementById("notif-bell-panel");
  const notifBellBackdrop = document.getElementById("notif-bell-backdrop");
  const notifRowBadgeCommandes = document.getElementById("notif-row-badge-commandes");
  const notifRowBadgeReservations = document.getElementById("notif-row-badge-reservations");
  const notifBellEmpty = document.getElementById("notif-bell-empty");

  function openNotifBell() {
    notifBellPanel.classList.add("is-open");
    notifBellBackdrop.classList.add("is-visible");
  }
  function closeNotifBell() {
    notifBellPanel.classList.remove("is-open");
    notifBellBackdrop.classList.remove("is-visible");
  }
  notifBellBtn.addEventListener("click", () => {
    if (notifBellPanel.classList.contains("is-open")) closeNotifBell();
    else openNotifBell();
  });
  notifBellBackdrop.addEventListener("click", closeNotifBell);
  document.getElementById("notif-bell-row-commandes").addEventListener("click", () => {
    closeNotifBell();
    const navEl = document.getElementById("nav-commandes");
    if (navEl) navEl.click();
  });
  document.getElementById("notif-bell-row-reservations").addEventListener("click", () => {
    closeNotifBell();
    const navEl = document.getElementById("nav-reservations-clients");
    if (navEl) navEl.click();
  });

  async function refreshAdminAlerts() {
    try {
      const headers = await window.adminAuth.authHeader();
      const res = await fetch("/api/admin/alerts", { headers });
      if (!res.ok) return;
      const json = await res.json();
      const newOrders = json.newOrders || 0;
      const newReservations = json.newReservations || 0;
      const total = newOrders + newReservations;

      setAlertBadge("commandes", newOrders);
      setAlertBadge("reservations-clients", newReservations);

      notifBellBadge.textContent = total > 99 ? "99+" : String(total);
      notifBellBadge.hidden = total <= 0;
      notifRowBadgeCommandes.textContent = newOrders > 99 ? "99+" : String(newOrders);
      notifRowBadgeCommandes.hidden = newOrders <= 0;
      notifRowBadgeReservations.textContent = newReservations > 99 ? "99+" : String(newReservations);
      notifRowBadgeReservations.hidden = newReservations <= 0;
      notifBellEmpty.hidden = total > 0;

      if (lastKnownAlertTotal !== null && total > lastKnownAlertTotal) {
        playNotificationSound();
        notifBellBtn.classList.remove("has-alert");
        void notifBellBtn.offsetWidth;
        notifBellBtn.classList.add("has-alert");
      }
      lastKnownAlertTotal = total;

      const commandesView = document.getElementById("commandes-view");
      if (commandesView && !commandesView.hidden && window.CommandesEditor && window.CommandesEditor.reload) {
        window.CommandesEditor.reload();
      }
      const reservationsClientsView = document.getElementById("reservations-clients-view");
      if (reservationsClientsView && !reservationsClientsView.hidden && window.ReservationsClientsEditor && window.ReservationsClientsEditor.reload) {
        window.ReservationsClientsEditor.reload();
      }
    } catch {}
  }
  window.refreshAdminAlerts = refreshAdminAlerts;

  const presenceStack = document.getElementById("presence-stack");
  let presenceChannel = null;

  function renderPresenceAvatar(entry) {
    const el = document.createElement("span");
    el.className = "presence-avatar";
    el.title = entry.email || "";
    if (entry.avatar_url) {
      const img = document.createElement("img");
      img.src = entry.avatar_url;
      img.alt = "";
      el.appendChild(img);
    } else {
      el.textContent = (entry.email || "?").charAt(0).toUpperCase();
    }
    return el;
  }

  function renderPresence(state) {
    presenceStack.innerHTML = "";
    Object.values(state).forEach((entries) => {
      const entry = entries[0];
      if (entry) presenceStack.appendChild(renderPresenceAvatar(entry));
    });
  }

  function startPresence(session) {
    if (presenceChannel) return;
    presenceChannel = supabase.channel("admin-presence", {
      config: { presence: { key: session.user.id } },
    });
    presenceChannel
      .on("presence", { event: "sync" }, () => {
        renderPresence(presenceChannel.presenceState());
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presenceChannel.track({
            email: session.user.email,
            avatar_url: (session.user.user_metadata && session.user.user_metadata.avatar_url) || null,
          });
        }
      });
  }

  function stopPresence() {
    if (presenceChannel) {
      supabase.removeChannel(presenceChannel);
      presenceChannel = null;
    }
    presenceStack.innerHTML = "";
  }

  function showLoggedIn(session) {
    const email = session.user.email;
    const firstname = email.split("@")[0];
    userEmailEl.textContent = email;
    renderAvatarInto(userAvatarEl, session.user);
    dashboardFirstnameEl.textContent = firstname;
    ppNameEl.textContent = firstname;
    ppEmailEl.textContent = email;
    renderAvatarInto(ppAvatarEl, session.user);
    const wasLoggedOut = appShell.hidden;
    loginScreen.hidden = true;
    appShell.hidden = false;
    if (wasLoggedOut) {
      // Vraie (re)connexion : on restaure la section où on était avant la
      // coupure plutôt que de toujours revenir au tableau de bord, pour que
      // la bannière "brouillon non enregistré" reprenne la main si une
      // modification était en cours au moment de la coupure.
      reopenLastSection();
    }
    // Un simple rafraîchissement de jeton en arrière-plan (session déjà
    // active, ex. toutes les heures) ne doit jamais faire bouger l'écran :
    // onAuthStateChange rappelle showLoggedIn() à chaque TOKEN_REFRESHED,
    // et avant ce correctif ça ramenait systématiquement au tableau de bord
    // en pleine rédaction d'un article.
    refreshAdminAlerts();
    if (!alertsInterval) alertsInterval = setInterval(refreshAdminAlerts, 60000);
    startPresence(session);
  }

  function showLoggedOut() {
    loginScreen.hidden = false;
    appShell.hidden = true;
    if (alertsInterval) {
      clearInterval(alertsInterval);
      alertsInterval = null;
    }
    stopPresence();
  }

  supabase.auth.getSession().then(({ data }) => {
    if (data.session) showLoggedIn(data.session);
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    if (session) showLoggedIn(session);
    else showLoggedOut();
  });

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    ensureAudioContext();
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
      errorBox.textContent = "E-mail ou mot de passe incorrect.";
    }
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

  async function doLogout() {
    await supabase.auth.signOut();
  }
  logoutBtnPanel.addEventListener("click", doLogout);

  const profileTrigger = document.getElementById("profile-trigger");
  const profilePanel = document.getElementById("profile-panel");
  const profilePanelBackdrop = document.getElementById("profile-panel-backdrop");
  const profilePanelClose = document.getElementById("profile-panel-close");

  function openProfilePanel() {
    profilePanel.classList.add("is-open");
    profilePanelBackdrop.classList.add("is-visible");
  }
  function closeProfilePanel() {
    profilePanel.classList.remove("is-open");
    profilePanelBackdrop.classList.remove("is-visible");
  }
  profileTrigger.addEventListener("click", openProfilePanel);
  profilePanelClose.addEventListener("click", closeProfilePanel);
  profilePanelBackdrop.addEventListener("click", closeProfilePanel);

  function wireExpandableRow(rowId, formId) {
    const row = document.getElementById(rowId);
    const form = document.getElementById(formId);
    row.addEventListener("click", () => {
      form.hidden = !form.hidden;
      row.classList.toggle("is-open", !form.hidden);
    });
  }
  wireExpandableRow("pp-password-toggle", "password-form");
  wireExpandableRow("pp-invite-toggle", "invite-form");

  const inviteForm = document.getElementById("invite-form");
  const inviteSubmit = document.getElementById("invite-submit");
  const inviteSuccess = document.getElementById("invite-success");
  const inviteError = document.getElementById("invite-error");

  inviteForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    inviteSuccess.hidden = true;
    inviteError.hidden = true;
    inviteSubmit.disabled = true;
    inviteSubmit.textContent = "Envoi…";

    const email = document.getElementById("invite-email").value.trim();

    try {
      const headers = await window.adminAuth.authHeader();
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

  const passwordForm = document.getElementById("password-form");
  const passwordSubmit = document.getElementById("password-submit");
  const passwordSuccess = document.getElementById("password-success");
  const passwordError = document.getElementById("password-error");

  passwordForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    passwordSuccess.hidden = true;
    passwordError.hidden = true;
    passwordSubmit.disabled = true;
    passwordSubmit.textContent = "Enregistrement…";

    const newPassword = document.getElementById("new-password").value;
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    passwordSubmit.disabled = false;
    passwordSubmit.textContent = "Enregistrer le mot de passe";

    if (error) {
      passwordError.hidden = false;
      passwordError.textContent = "Échec de l'enregistrement : " + error.message;
    } else {
      passwordSuccess.hidden = false;
      passwordForm.reset();
    }
  });

  const AVATAR_BUCKET = "site-images";
  const AVATAR_EXT_BY_TYPE = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  const MAX_AVATAR_BYTES = 4 * 1024 * 1024;

  const ppAvatarEdit = document.getElementById("pp-avatar-edit");
  const ppAvatarFile = document.getElementById("pp-avatar-file");
  const ppAvatarError = document.getElementById("pp-avatar-error");

  ppAvatarEdit.addEventListener("click", () => ppAvatarFile.click());
  ppAvatarFile.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    ppAvatarError.hidden = true;
    ppAvatarEdit.disabled = true;
    try {
      const ext = AVATAR_EXT_BY_TYPE[file.type];
      if (!ext) throw new Error("Format non pris en charge. Utilisez JPG, PNG, WebP ou GIF.");
      if (file.size > MAX_AVATAR_BYTES) throw new Error("Image trop lourde (4 Mo maximum).");

      const path = "avatars/" + crypto.randomUUID() + "." + ext;
      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw new Error(uploadError.message);

      const { data: publicData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
      const { data: updateData, error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: publicData.publicUrl },
      });
      if (updateError) throw new Error(updateError.message);

      renderAvatarInto(ppAvatarEl, updateData.user);
      renderAvatarInto(userAvatarEl, updateData.user);
    } catch (err) {
      ppAvatarError.hidden = false;
      ppAvatarError.textContent = err.message;
    } finally {
      ppAvatarEdit.disabled = false;
      ppAvatarFile.value = "";
    }
  });

  const EYE_OPEN =
    '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"></path><circle cx="12" cy="12" r="3"></circle>';
  const EYE_CLOSED =
    '<path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a20.3 20.3 0 0 1 5.06-5.94M9.9 4.24A10.4 10.4 0 0 1 12 4c7 0 11 8 11 8a20.3 20.3 0 0 1-3.66 4.94M14.12 14.12a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';

  document.querySelectorAll(".field-toggle").forEach((btn) => {
    const input = document.getElementById(btn.dataset.toggleFor);
    const svg = btn.querySelector("svg");
    btn.addEventListener("click", () => {
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      svg.innerHTML = show ? EYE_CLOSED : EYE_OPEN;
      btn.classList.toggle("is-visible", show);
      btn.setAttribute("aria-label", show ? "Masquer le mot de passe" : "Afficher le mot de passe");
    });
  });
})();
