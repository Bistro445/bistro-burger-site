"use strict";
(() => {
  const container = document.getElementById("administrateurs-view");
  if (!container) return;

  const state = { users: null, error: "", loading: false, messages: {}, meId: null };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[c]);
  }

  function formatDate(iso) {
    if (!iso) return "";
    try {
      return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  function onlineIds() {
    return new Set(Object.keys(window.adminPresenceState || {}));
  }

  function statusLine(u, online) {
    if (online) return '<span style="color:#1B7F5F; font-weight:600;">● En ligne maintenant</span>';
    if (u.last_sign_in_at) return "Dernière connexion : " + esc(formatDate(u.last_sign_in_at));
    if (u.invited_at && !u.confirmed) return "Invitation envoyée, pas encore acceptée";
    return "Jamais connecté";
  }

  function avatar(u) {
    const base = "width:42px; height:42px; border-radius:50%; flex:none; display:flex; align-items:center; justify-content:center; background:var(--green-700,#12574C); color:#fff; font-weight:700; overflow:hidden;";
    if (u.avatar_url) return '<span style="' + base + '"><img src="' + esc(u.avatar_url) + '" alt="" style="width:100%;height:100%;object-fit:cover;"></span>';
    return '<span style="' + base + '">' + esc((u.email || "?").charAt(0).toUpperCase()) + "</span>";
  }

  function render() {
    const online = onlineIds();
    let body;
    if (state.loading && !state.users) {
      body = "<p>Chargement…</p>";
    } else if (state.error) {
      body = '<div class="login-error">' + esc(state.error) + "</div>";
    } else {
      const users = state.users || [];
      const onlineCount = users.filter((u) => online.has(u.id)).length;
      body =
        '<p style="margin:0 0 16px;">' + users.length + " compte" + (users.length > 1 ? "s" : "") +
        " · " + onlineCount + " en ligne</p>" +
        users.map((u) => {
          const msg = state.messages[u.id];
          return (
            '<div style="display:flex; align-items:flex-start; gap:14px; padding:16px 0; border-top:1px solid rgba(0,0,0,.08);">' +
              avatar(u) +
              '<div style="flex:1; min-width:0;">' +
                '<div style="font-weight:600; word-break:break-all;">' + esc(u.email) + "</div>" +
                '<div style="font-size:14px; margin-top:2px;">' + statusLine(u, online.has(u.id)) + "</div>" +
                '<div style="font-size:13px; opacity:.7; margin-top:2px;">Compte créé le ' + esc(formatDate(u.created_at)) + "</div>" +
                '<button type="button" class="btn-primary" data-reset="' + esc(u.id) + '" style="margin-top:10px; width:auto; padding:9px 14px; font-size:14px;">Envoyer un lien de réinitialisation du mot de passe</button>' +
                (u.id !== state.meId ? '<button type="button" data-delete="' + esc(u.id) + '" style="margin:10px 0 0 8px; padding:9px 14px; font-size:14px; border:1px solid #B5362B; color:#B5362B; background:#fff; border-radius:10px; cursor:pointer;">Supprimer ce compte</button>' : '<span style="display:inline-block; margin:10px 0 0 8px; font-size:13px; opacity:.7;">(votre compte)</span>') +
                (msg ? '<div style="font-size:13px; margin-top:8px;">' + esc(msg) + "</div>" : "") +
              "</div>" +
            "</div>"
          );
        }).join("");
    }

    container.innerHTML =
      "<h1>Administrateurs</h1>" +
      '<div style="background:rgba(18,87,76,.08); border-radius:12px; padding:14px 16px; font-size:14px; line-height:1.5; margin-bottom:18px;">' +
        "Les mots de passe ne sont jamais visibles, pas même pour nous : ils sont chiffrés. " +
        "Si quelqu'un a oublié le sien, envoyez-lui un lien de réinitialisation ci-dessous. " +
        "Tous les comptes ont les mêmes droits." +
      "</div>" +
      body +
      '<div style="margin-top:18px;"><button type="button" class="btn-primary" id="adm-refresh" style="width:auto; padding:9px 14px; font-size:14px;">Actualiser</button></div>';
  }

  async function load() {
    state.loading = true;
    state.error = "";
    render();
    try {
      const sess = await window.adminAuth.supabase.auth.getSession();
      state.meId = (sess.data.session && sess.data.session.user.id) || null;
    } catch {}
    try {
      const headers = await window.adminAuth.authHeader();
      const res = await fetch("/api/admin/users", { headers });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Échec du chargement.");
      state.users = json.users || [];
    } catch (err) {
      state.error = err.message || "Échec du chargement.";
    }
    state.loading = false;
    render();
  }

  container.addEventListener("click", async (e) => {
    if (e.target.closest("#adm-refresh")) { load(); return; }
    const delBtn = e.target.closest("[data-delete]");
    if (delBtn) {
      const target = (state.users || []).find((u) => u.id === delBtn.getAttribute("data-delete"));
      if (!target) return;
      if (!window.confirm("Supprimer définitivement le compte " + target.email + " ?\n\nCette personne ne pourra plus se connecter. Cette action est irréversible.")) return;
      delBtn.disabled = true;
      state.messages[target.id] = "Suppression…";
      render();
      try {
        const headers = await window.adminAuth.authHeader();
        const res = await fetch("/api/admin/users?id=" + encodeURIComponent(target.id), { method: "DELETE", headers });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || "Échec de la suppression.");
        await load();
      } catch (err) {
        state.messages[target.id] = err.message || "Échec de la suppression.";
        render();
      }
      return;
    }
    const btn = e.target.closest("[data-reset]");
    if (!btn) return;
    const user = (state.users || []).find((u) => u.id === btn.getAttribute("data-reset"));
    if (!user) return;
    btn.disabled = true;
    state.messages[user.id] = "Envoi…";
    render();
    const { error } = await window.adminAuth.supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: window.location.origin + "/admin/",
    });
    state.messages[user.id] = error
      ? "Échec de l'envoi : " + error.message
      : "Lien envoyé à " + user.email + ". Il n'est utilisable qu'une fois.";
    render();
  });

  window.addEventListener("admin-presence", () => {
    if (!container.hidden && state.users) render();
  });

  window.AdministrateursEditor = { open: load };
})();
