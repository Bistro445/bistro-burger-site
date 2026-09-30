"use strict";
(() => {
  const API_URL = "/api/admin/content";
  const SITE_ORIGIN = "https://bistroburgergardanne.com";
  const container = document.getElementById("blog-view");

  let state = null;
  let draftSaveTimer = null;
  let draftTickTimer = null;
  let seoTimer = null;

  function stopDraftTicker() {
    if (draftTickTimer) { clearInterval(draftTickTimer); draftTickTimer = null; }
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[c]);
  }

  const DEFAULT_BLOG = {
    categories: ["Brasserie", "Traiteur", "Annonce"],
    posts: [
      {
        id: "terrasse", slug: "la-terrasse-est-ouverte-tout-lete", img: "assets/blog-terrasse.jpg", date: "2026-08-02", category: "Brasserie", published: true,
        title: "La terrasse est ouverte tout l'été",
        excerpt: "Douze couverts supplémentaires à l'ombre, dès 19h et jusqu'à la fermeture.",
        body: "La terrasse est installée pour toute la saison, côté ombre, à l'écart du passage. Douze couverts de plus chaque soir, ouverts dès 19h et jusqu'à la fermeture. Sur les créneaux du vendredi et du samedi elle part vite : réservez si vous y tenez, en précisant votre préférence au moment de la demande.",
      },
      {
        id: "pain", slug: "un-nouveau-pain-livre-chaque-matin", img: "assets/blog-pain.jpg", date: "2026-07-24", category: "Brasserie", published: true,
        title: "Un nouveau pain, livré chaque matin",
        excerpt: "Nous travaillons désormais avec une boulangerie de Gardanne pour tous nos buns.",
        body: "Nos buns sont désormais façonnés par une boulangerie de Gardanne et livrés chaque matin. Le pain tient mieux à la cuisson, la mie reste moelleuse jusqu'à la dernière bouchée, et le circuit se raccourcit à quelques rues. Le changement concerne toute la carte, sur place comme à emporter.",
      },
      {
        id: "instagram", slug: "le-plat-du-jour-sur-instagram", img: "assets/blog-instagram.jpg", date: "2026-07-10", category: "Annonce", published: true,
        title: "Le plat du jour, maintenant sur Instagram",
        excerpt: "Retrouvez chaque matin l'ardoise du jour sur @bistroburger_gardanne.",
        body: "Chaque matin, l'ardoise du jour est publiée sur notre compte Instagram avant le service de midi. Plat, accompagnement et prix : de quoi décider avant de sortir du bureau.\n\nSuivez @bistroburger_gardanne pour la recevoir dans votre fil.",
      },
    ],
  };

  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  /* ------------------ Nettoyage / conversion du contenu ------------------ */

  function looksLikeHtml(s) {
    return /<(p|h[2-4]|ul|ol|blockquote|img|strong|em|a|br)[\s>\/]/i.test(String(s || ""));
  }

  // Anciens articles saisis en texte simple (## titre, **gras**, lignes vides) -> HTML.
  function legacyToHtml(text) {
    const inline = (s) => esc(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')
      .replace(/(^|[\s(])@bistroburger_gardanne\b/g, '$1<a href="https://www.instagram.com/bistroburger_gardanne/">@bistroburger_gardanne</a>');
    return String(text || "").replace(/\r/g, "").split(/\n{2,}/).map((block) => {
      const b = block.trim();
      if (!b) return "";
      if (b.startsWith("## ")) return "<h2>" + inline(b.slice(3)) + "</h2>";
      return "<p>" + inline(b).replace(/\n/g, "<br>") + "</p>";
    }).join("");
  }

  function bodyToHtml(body) {
    return looksLikeHtml(body) ? sanitizeHtml(body) : legacyToHtml(body);
  }

  const ALLOWED_TAGS = { P: 1, BR: 1, H2: 1, H3: 1, H4: 1, STRONG: 1, B: 1, EM: 1, I: 1, U: 1, A: 1, UL: 1, OL: 1, LI: 1, BLOCKQUOTE: 1, IMG: 1 };
  const DROP_TAGS = { SCRIPT: 1, STYLE: 1, IFRAME: 1, OBJECT: 1, EMBED: 1, FORM: 1, INPUT: 1, BUTTON: 1, TEXTAREA: 1, SELECT: 1, LINK: 1, META: 1, SVG: 1 };

  function normalizeHref(raw) {
    const u = String(raw || "").trim();
    if (!u) return "";
    if (/^(https?:|mailto:|tel:)/i.test(u)) return u;
    if (/^javascript:|^data:|^vbscript:/i.test(u)) return "";
    if (u.charAt(0) === "/" || u.charAt(0) === "#") return u;
    if (/^[^\s\/]+\.[^\s\/]{2,}/.test(u)) return "https://" + u;
    return "";
  }

  // Ne garde que les balises de mise en forme autorisées (protège le site de tout code inattendu).
  function sanitizeHtml(html) {
    const doc = new DOMParser().parseFromString("<body>" + String(html || "") + "</body>", "text/html");
    function clean(node) {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === 3) return;
        if (child.nodeType !== 1) { child.remove(); return; }
        const tag = child.tagName;
        if (DROP_TAGS[tag]) { child.remove(); return; }
        clean(child);
        if (!ALLOWED_TAGS[tag]) {
          while (child.firstChild) node.insertBefore(child.firstChild, child);
          child.remove();
          return;
        }
        if (tag === "A") {
          const href = normalizeHref(child.getAttribute("href"));
          Array.from(child.attributes).forEach((a) => child.removeAttribute(a.name));
          if (!href) {
            while (child.firstChild) node.insertBefore(child.firstChild, child);
            child.remove();
            return;
          }
          child.setAttribute("href", href);
          if (/^https?:/i.test(href)) { child.setAttribute("target", "_blank"); child.setAttribute("rel", "noopener noreferrer"); }
        } else if (tag === "IMG") {
          const src = String(child.getAttribute("src") || "").trim();
          const alt = child.getAttribute("alt") || "";
          Array.from(child.attributes).forEach((a) => child.removeAttribute(a.name));
          if (!/^https?:\/\//i.test(src)) { child.remove(); return; }
          child.setAttribute("src", src);
          child.setAttribute("alt", alt);
        } else {
          Array.from(child.attributes).forEach((a) => child.removeAttribute(a.name));
        }
      });
    }
    clean(doc.body);
    doc.body.querySelectorAll("p").forEach((p) => {
      if (!p.textContent.trim() && !p.querySelector("img")) p.remove();
    });
    return doc.body.innerHTML.trim();
  }

  function htmlToDoc(html) {
    return new DOMParser().parseFromString("<body>" + String(html || "") + "</body>", "text/html");
  }

  function normalize(value) {
    if (!value || !Array.isArray(value.posts)) return clone(DEFAULT_BLOG);
    const posts = value.posts.map((p) => ({
      id: p.id || crypto.randomUUID(),
      slug: p.slug || "",
      title: p.title || "",
      excerpt: p.excerpt || "",
      body: p.body || "",
      category: p.category || "",
      date: p.date || "",
      img: p.img || "",
      imgAlt: p.imgAlt || "",
      seoTitle: p.seoTitle || "",
      seoDesc: p.seoDesc || "",
      keyword: p.keyword || "",
      published: p.published !== false,
    }));
    const categories = Array.isArray(value.categories) && value.categories.length ? value.categories.slice() : clone(DEFAULT_BLOG.categories);
    return { categories, posts };
  }

  async function apiGet() {
    const headers = await window.adminAuth.authHeader();
    const res = await fetch(API_URL + "?key=blog", { headers });
    if (!res.ok) throw new Error("Échec du chargement.");
    const json = await res.json();
    return normalize(json.value);
  }

  async function apiSave(data) {
    const headers = await window.adminAuth.authHeader();
    const res = await fetch(API_URL, {
      method: "PUT",
      headers: Object.assign({ "Content-Type": "application/json" }, headers),
      body: JSON.stringify({ key: "blog", value: data }),
    });
    if (!res.ok) throw new Error("Échec de l'enregistrement.");
    const json = await res.json();
    if (json.deployTriggered === false) {
      throw new Error("Enregistré, mais la republication du site a échoué. Contactez la personne qui gère le site.");
    }
  }

  function todayISO() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function formatDate(iso) {
    try {
      return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso + "T00:00:00"));
    } catch {
      return iso;
    }
  }

  function slugBase(str) {
    return String(str || "")
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);
  }

  function uniqueSlug(wanted, ignoreId) {
    const base = slugBase(wanted) || "article";
    const taken = new Set(state.data.posts.filter((p) => p.id !== ignoreId).map((p) => p.slug));
    let slug = base;
    let n = 2;
    while (taken.has(slug) || slug === "index" || slug === "article") slug = base + "-" + n++;
    return slug;
  }

  /* ---------------------------- Images ---------------------------- */

  const IMAGE_BUCKET = "site-images";
  const EXT_BY_TYPE = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
  const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

  async function uploadFile(file) {
    const ext = EXT_BY_TYPE[file.type];
    if (!ext) throw new Error("Format non pris en charge. Utilisez JPG, PNG, WebP ou GIF.");
    if (file.size > MAX_IMAGE_BYTES) throw new Error("Image trop lourde (8 Mo maximum).");
    const path = crypto.randomUUID() + "." + ext;
    const { error } = await window.adminAuth.supabase.storage
      .from(IMAGE_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw new Error(error.message);
    return window.adminAuth.supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
  }

  function imgSrc(img) {
    if (!img) return "";
    return /^https?:\/\//.test(img) ? img : "../" + img;
  }

  function saveStatusHtml() {
    if (state.saving) return '<div class="password-success">Enregistrement…</div>';
    if (state.saveError) return '<div class="login-error">' + esc(state.saveError) + "</div>";
    if (state.saveSuccess) return '<div class="password-success">Enregistré. La modification apparaîtra sur le site dans environ une minute.</div>';
    return "";
  }

  async function persist(nextScreen) {
    state.saving = true;
    state.saveError = null;
    state.saveSuccess = false;
    state.editIndex = null;
    state.screen = nextScreen;
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
  }

  function render() {
    if (state.screen === "loading") {
      container.innerHTML = '<div class="editor-loading">Chargement…</div>';
      return;
    }
    if (state.screen === "error") {
      container.innerHTML =
        '<button type="button" class="back-btn" id="bl-back-menu">‹ Retour</button>' +
        '<div class="login-error">' + esc(state.error) + "</div>";
      document.getElementById("bl-back-menu").addEventListener("click", () => window.adminShowDashboard());
      return;
    }
    if (state.screen === "edit") renderEdit();
    else renderList();
  }

  /* ---------------------------- Liste ---------------------------- */

  function renderList() {
    state.quill = null;
    const cats = state.data.categories;
    const chips = cats.length
      ? cats.map((c, i) =>
          '<span class="r-chip">' + esc(c) +
          '<button type="button" class="r-chip-remove" data-remove-cat="' + i + '" aria-label="Retirer la catégorie">×</button></span>'
        ).join("")
      : '<p class="dashboard-note">Aucune catégorie.</p>';

    const sorted = state.data.posts
      .map((p, i) => ({ p, i }))
      .sort((a, b) => String(b.p.date).localeCompare(String(a.p.date)));

    const rows = sorted.map(({ p, i }) =>
      '<div class="list-row-wrap">' +
      '<button type="button" class="list-row" data-post="' + i + '">' +
      '<span class="list-row-main">' +
      '<span class="list-row-title">' + esc(p.title || "(Sans titre)") + "</span>" +
      '<span class="list-row-sub">' + esc([p.category || "Sans catégorie", p.date ? formatDate(p.date) : "", p.published ? "Publié" : "Brouillon"].filter(Boolean).join(" · ")) + "</span>" +
      "</span>" +
      '<span class="list-row-arrow">›</span>' +
      "</button></div>"
    ).join("");

    container.innerHTML =
      '<button type="button" class="back-btn" id="bl-back-menu">‹ Retour au menu</button>' +
      "<h1>Blog</h1>" +
      '<p class="dashboard-note">Les articles affichés sur la page Blog du site. Chaque article appartient à une catégorie, et le site affiche une rubrique par catégorie.</p>' +
      '<label class="r-label">Catégories</label>' +
      '<div class="r-chip-row">' + chips + "</div>" +
      '<div class="r-chip-add">' +
      '<input class="r-chip-input" id="bl-cat-input" placeholder="Nouvelle catégorie (ex : Événements)">' +
      '<button type="button" class="r-chip-add-btn" id="bl-cat-add">Ajouter</button>' +
      "</div>" +
      '<hr class="divider">' +
      '<label class="r-label">Articles</label>' +
      '<div class="list">' + (rows || '<p class="dashboard-note">Aucun article pour l\'instant.</p>') + "</div>" +
      '<div style="display:flex; gap:10px; align-items:center;">' +
      '<button type="button" class="btn-secondary" id="bl-add-post">+ Nouvel article</button>' +
      (state.deletedPosts.length > 0
        ? '<button type="button" class="icon-btn icon-btn-restore" id="bl-restore" title="Restaurer les articles supprimés" aria-label="Restaurer les articles supprimés">↺</button>'
        : "") +
      "</div>" +
      saveStatusHtml();

    document.getElementById("bl-back-menu").addEventListener("click", () => window.adminShowDashboard());

    function openEdit(index) {
      state.editIndex = index;
      state.editImgUrl = undefined;
      state.restoredFields = null;
      state.draftChecked = false;
      state.pendingDraft = null;
      state.saveSuccess = false;
      state.saveError = null;
      state.screen = "edit";
      render();
    }
    container.querySelectorAll("[data-post]").forEach((btn) => {
      btn.addEventListener("click", () => openEdit(Number(btn.dataset.post)));
    });
    document.getElementById("bl-add-post").addEventListener("click", () => openEdit(null));

    function addCategory() {
      const input = document.getElementById("bl-cat-input");
      const val = input.value.trim();
      if (!val) return;
      if (state.data.categories.some((c) => c.toLowerCase() === val.toLowerCase())) {
        state.saveError = "Cette catégorie existe déjà.";
        state.saveSuccess = false;
        render();
        return;
      }
      state.data.categories.push(val);
      persist("list");
    }
    document.getElementById("bl-cat-add").addEventListener("click", addCategory);
    document.getElementById("bl-cat-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); addCategory(); }
    });
    container.querySelectorAll("[data-remove-cat]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.dataset.removeCat);
        const name = state.data.categories[i];
        const used = state.data.posts.filter((p) => p.category === name).length;
        if (used > 0) {
          state.saveError = "La catégorie « " + name + " » est utilisée par " + used + " article(s). Changez leur catégorie avant de la retirer.";
          state.saveSuccess = false;
          render();
          return;
        }
        state.data.categories.splice(i, 1);
        persist("list");
      });
    });
    if (state.deletedPosts.length > 0) {
      document.getElementById("bl-restore").addEventListener("click", () => {
        state.deletedPosts.forEach((p) => state.data.posts.push(p));
        state.deletedPosts = [];
        persist("list");
      });
    }
  }

  /* --------------------------- Édition --------------------------- */

  function draftKey() {
    return "blog:" + (state.editIndex === null ? "new" : state.data.posts[state.editIndex].id);
  }

  function getBodyHtml() {
    if (state.quill) return sanitizeHtml(state.quill.root.innerHTML);
    const ta = document.getElementById("bl-body-fallback");
    return ta ? bodyToHtml(ta.value) : "";
  }

  function readEditFields() {
    const val = (id) => { const el = document.getElementById(id); return el ? el.value : ""; };
    return {
      title: val("bl-title"),
      category: val("bl-cat"),
      date: val("bl-date"),
      excerpt: val("bl-excerpt"),
      body: getBodyHtml(),
      published: document.getElementById("bl-published").checked,
      img: state.editImgUrl || "",
      imgAlt: val("bl-imgalt"),
      seoTitle: val("bl-seotitle"),
      seoDesc: val("bl-seodesc"),
      keyword: val("bl-keyword"),
      slug: val("bl-slug"),
    };
  }

  function scheduleDraftSave() {
    if (draftSaveTimer) clearTimeout(draftSaveTimer);
    draftSaveTimer = setTimeout(() => {
      window.AdminDrafts.save(draftKey(), readEditFields());
      const statusEl = document.getElementById("bl-draft-status");
      if (statusEl) statusEl.textContent = "Brouillon enregistré automatiquement — à l'instant";
    }, 300);
  }

  // Filet de sécurité : si l'onglet devient invisible (changement d'onglet,
  // mise en veille, ou l'admin qui repasse en écran de connexion suite à une
  // coupure de session) pendant qu'un article est en cours de modification,
  // on sauvegarde immédiatement le brouillon sans attendre le débounce.
  function flushDraftSave() {
    if (state.screen !== "edit") return;
    if (draftSaveTimer) { clearTimeout(draftSaveTimer); draftSaveTimer = null; }
    window.AdminDrafts.save(draftKey(), readEditFields());
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) flushDraftSave();
  });
  window.addEventListener("pagehide", flushDraftSave);

  function scheduleSeo() {
    if (seoTimer) clearTimeout(seoTimer);
    seoTimer = setTimeout(updateSeo, 250);
  }

  function countClass(len, min, max) {
    if (!len) return "is-warn";
    return len >= min && len <= max ? "is-ok" : "is-warn";
  }

  function truncate(s, n) {
    s = String(s || "");
    return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
  }

  function updateSeo() {
    const panel = document.getElementById("bl-seo");
    if (!panel) return;
    const f = readEditFields();
    const title = (f.seoTitle || f.title).trim();
    const desc = (f.seoDesc || f.excerpt).trim();
    const slug = slugBase(f.slug || f.title) || "mon-article";

    const tc = document.getElementById("bl-seotitle-count");
    tc.textContent = title.length + " / 60 caractères";
    tc.className = "seo-count " + countClass(title.length, 30, 60);
    const dc = document.getElementById("bl-seodesc-count");
    dc.textContent = desc.length + " / 160 caractères";
    dc.className = "seo-count " + countClass(desc.length, 70, 160);

    document.getElementById("bl-prev-url").textContent = "bistroburgergardanne.com › blog › " + slug + ".html";
    document.getElementById("bl-prev-title").textContent = truncate(title || "Titre de l'article", 60) + " — Blog Bistro Burger";
    document.getElementById("bl-prev-desc").textContent = truncate(desc || "La description de l'article apparaîtra ici.", 160);

    const doc = htmlToDoc(f.body);
    const text = doc.body.textContent.replace(/\s+/g, " ").trim();
    const words = text ? text.split(" ").length : 0;
    const links = doc.body.querySelectorAll("a").length;
    const images = Array.from(doc.body.querySelectorAll("img"));
    const missingAlt = images.filter((im) => !(im.getAttribute("alt") || "").trim()).length;
    const firstP = doc.body.querySelector("p");
    const firstText = (firstP ? firstP.textContent : text.slice(0, 300)).toLowerCase();
    const kw = f.keyword.trim().toLowerCase();

    const checks = [];
    const add = (ok, label) => checks.push({ ok, label });
    add(title.length >= 30 && title.length <= 60, "Titre SEO de 30 à 60 caractères (" + title.length + ")");
    add(desc.length >= 70 && desc.length <= 160, "Description de 70 à 160 caractères (" + desc.length + ")");
    add(words >= 300, "Article d'au moins 300 mots (" + words + ")");
    add(links > 0, "Au moins un lien dans le texte");
    add(!!(f.img || images.length), "Au moins une image (couverture ou dans le texte)");
    if (f.img) add(!!f.imgAlt.trim(), "Description (texte alternatif) de l'image de couverture");
    if (images.length) add(missingAlt === 0, "Toutes les images du texte ont une description" + (missingAlt ? " (" + missingAlt + " sans)" : ""));
    if (kw) {
      add(title.toLowerCase().includes(kw), "Le mot-clé est dans le titre");
      add(desc.toLowerCase().includes(kw), "Le mot-clé est dans la description");
      add(slug.includes(slugBase(kw)), "Le mot-clé est dans l'adresse (URL)");
      add(firstText.includes(kw), "Le mot-clé est dans le premier paragraphe");
    } else {
      add(false, "Choisissez un mot-clé principal (ce que vos clients tapent dans Google)");
    }
    const okCount = checks.filter((c) => c.ok).length;
    document.getElementById("bl-seo-score").textContent = okCount + " / " + checks.length;
    document.getElementById("bl-seo-score").className = "seo-score " + (okCount === checks.length ? "is-ok" : okCount >= checks.length * 0.6 ? "is-mid" : "is-warn");
    document.getElementById("bl-seo-checks").innerHTML = checks
      .map((c) => '<li class="seo-check ' + (c.ok ? "is-ok" : "is-warn") + '"><span class="seo-check-mark">' + (c.ok ? "✓" : "!") + "</span>" + esc(c.label) + "</li>")
      .join("");
  }

  async function checkPlagiarism() {
    const btn = document.getElementById("bl-plag-check");
    const out = document.getElementById("bl-plag-result");
    if (!btn || !out) return;
    const text = htmlToDoc(getBodyHtml()).body.textContent.replace(/\s+/g, " ").trim();
    if (text.split(" ").filter(Boolean).length < 20) {
      out.innerHTML = '<p class="login-error">Rédigez au moins quelques phrases avant de vérifier.</p>';
      return;
    }
    btn.disabled = true;
    btn.textContent = "Vérification en cours…";
    out.innerHTML = "";
    try {
      const headers = await window.adminAuth.authHeader();
      const res = await fetch("/api/admin/plagiarism", {
        method: "POST",
        headers: Object.assign({ "Content-Type": "application/json" }, headers),
        body: JSON.stringify({ text }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Échec de la vérification.");
      renderPlagiarism(json, out);
    } catch (err) {
      out.innerHTML = '<p class="login-error">' + esc(err.message) + "</p>";
    } finally {
      btn.disabled = false;
      btn.textContent = "Vérifier le plagiat";
    }
  }

  function renderPlagiarism(result, out) {
    if (!result.total) {
      out.innerHTML = '<p>Aucune phrase assez longue à vérifier pour l\'instant.</p>';
      return;
    }
    const header = "<p>" + result.checked + " phrase(s) vérifiée(s) sur " + result.total + " (les plus longues, pour un résultat fiable).</p>" +
      (result.quotaHit ? '<p class="login-error">Quota quotidien de recherches partiellement atteint : certaines phrases n\'ont pas pu être vérifiées.</p>' : "");
    if (!result.flagged.length) {
      out.innerHTML = header + '<p style="color:var(--green-700); font-weight:600;">✓ Aucune correspondance trouvée ailleurs sur le web.</p>';
      return;
    }
    out.innerHTML = header +
      '<p class="login-error" style="margin-bottom:10px;">' + result.flagged.length + " passage(s) retrouvé(s) mot pour mot ailleurs :</p>" +
      '<ul class="seo-list">' +
      result.flagged.map((f) =>
        "<li style=\"margin-bottom:10px;\"><em>« " + esc(truncate(f.sentence, 160)) + " »</em><br>" +
        f.matches.map((m) => '<a href="' + esc(m.link) + '" target="_blank" rel="noopener">' + esc(m.title) + "</a>").join("<br>") +
        "</li>"
      ).join("") +
      "</ul>";
  }

  async function uploadCover(file) {
    state.restoredFields = readEditFields();
    state.uploadingImg = true;
    state.uploadError = null;
    render();
    try {
      state.editImgUrl = await uploadFile(file);
    } catch (err) {
      state.uploadError = err.message;
    } finally {
      state.uploadingImg = false;
      state.restoredFields = Object.assign({}, state.restoredFields, { img: state.editImgUrl || "" });
      render();
      scheduleDraftSave();
    }
  }

  let altPanelDocClick = null;

  function closeAltPanel() {
    const panel = document.getElementById("bl-alt-panel");
    if (panel) panel.remove();
    if (altPanelDocClick) {
      document.removeEventListener("click", altPanelDocClick);
      altPanelDocClick = null;
    }
  }

  function showAltPanel(imgEl) {
    closeAltPanel();
    const rect = imgEl.getBoundingClientRect();
    const panel = document.createElement("div");
    panel.id = "bl-alt-panel";
    panel.className = "bl-alt-panel";
    panel.style.top = window.scrollY + rect.bottom + 8 + "px";
    panel.style.left = Math.max(12, Math.min(window.scrollX + rect.left, window.scrollX + document.documentElement.clientWidth - 340)) + "px";
    panel.innerHTML =
      '<label class="bl-alt-label" for="bl-alt-input">Décrivez cette image (pour Google et l\'accessibilité)</label>' +
      '<div class="bl-alt-row">' +
      '<input type="text" id="bl-alt-input" class="field" placeholder="ex : Burger maison avec frites sur une planche en bois">' +
      '<button type="button" class="bl-alt-save" id="bl-alt-save">Valider</button>' +
      "</div>";
    document.body.appendChild(panel);
    const input = panel.querySelector("#bl-alt-input");
    input.value = imgEl.getAttribute("alt") || "";
    input.focus();

    function save() {
      const val = input.value.trim();
      imgEl.setAttribute("alt", val);
      closeAltPanel();
      scheduleDraftSave();
      scheduleSeo();
    }
    panel.querySelector("#bl-alt-save").addEventListener("click", save);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); save(); }
      if (e.key === "Escape") { e.preventDefault(); closeAltPanel(); }
    });
    setTimeout(() => {
      altPanelDocClick = (e) => {
        if (!panel.contains(e.target) && e.target !== imgEl) closeAltPanel();
      };
      document.addEventListener("click", altPanelDocClick);
    }, 0);
  }

  function insertImageInEditor() {
    if (!state.quill) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp,image/gif";
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      const range = state.quill.getSelection(true) || { index: state.quill.getLength() };
      const statusEl = document.getElementById("bl-editor-status");
      if (statusEl) statusEl.textContent = "Téléversement de l'image…";
      try {
        const url = await uploadFile(file);
        state.quill.insertEmbed(range.index, "image", url, "user");
        state.quill.setSelection(range.index + 1, 0, "silent");
        if (statusEl) statusEl.textContent = "";
        scheduleDraftSave();
        scheduleSeo();
        const inserted = Array.from(state.quill.root.querySelectorAll("img")).find((im) => im.getAttribute("src") === url);
        if (inserted) showAltPanel(inserted);
      } catch (err) {
        if (statusEl) statusEl.textContent = "";
        window.alert(err.message);
      }
    };
    input.click();
  }

  function initEditor(initialHtml) {
    const host = document.getElementById("bl-editor");
    if (!host) return;
    if (!window.Quill) {
      host.outerHTML = '<textarea class="field" id="bl-body-fallback" rows="14"></textarea>';
      document.getElementById("bl-body-fallback").value = initialHtml;
      return;
    }
    const quill = new window.Quill(host, {
      theme: "snow",
      placeholder: "Écrivez votre article ici…",
      formats: ["header", "bold", "italic", "underline", "link", "list", "blockquote", "image"],
      modules: {
        toolbar: {
          container: [
            [{ header: [2, 3, false] }],
            ["bold", "italic", "underline"],
            [{ list: "ordered" }, { list: "bullet" }],
            ["blockquote", "link", "image"],
            ["clean"],
          ],
          handlers: { image: insertImageInEditor },
        },
      },
    });
    state.quill = quill;
    quill.clipboard.dangerouslyPasteHTML(initialHtml || "");
    quill.history.clear();
    quill.on("text-change", () => {
      scheduleDraftSave();
      scheduleSeo();
    });
    quill.root.addEventListener("click", (e) => {
      const img = e.target.closest("img");
      if (img) showAltPanel(img);
    });
  }

  function renderEdit() {
    const isNew = state.editIndex === null;
    const existing = isNew ? null : state.data.posts[state.editIndex];
    const base = existing || {};
    const post = state.restoredFields ||
      (isNew
        ? { title: "", category: state.data.categories[0] || "", date: todayISO(), excerpt: "", body: "", published: true, img: "", imgAlt: "", seoTitle: "", seoDesc: "", keyword: "", slug: "" }
        : Object.assign({ imgAlt: "", seoTitle: "", seoDesc: "", keyword: "" }, base));
    if (state.editImgUrl === undefined) state.editImgUrl = post.img || "";

    if (!state.draftChecked) {
      state.draftChecked = true;
      state.pendingDraft = window.AdminDrafts.load(draftKey());
    }

    const bodyHtml = bodyToHtml(post.body);
    const imgPreview = state.editImgUrl
      ? '<img class="edit-hero-img" src="' + esc(imgSrc(state.editImgUrl)) + '" alt="">'
      : '<div class="edit-hero-empty">Aucune image</div>';

    const catOptions = state.data.categories
      .map((c) => '<option value="' + esc(c) + '"' + (c === post.category ? " selected" : "") + ">" + esc(c) + "</option>")
      .join("") +
      (post.category && !state.data.categories.includes(post.category)
        ? '<option value="' + esc(post.category) + '" selected>' + esc(post.category) + "</option>"
        : "");

    const slugValue = post.slug || (existing ? existing.slug : "");

    container.innerHTML =
      '<button type="button" class="back-btn" id="bl-back-list">‹ Tous les articles</button>' +
      "<h1>" + (isNew ? "Nouvel article" : "Modifier l'article") + "</h1>" +
      (state.pendingDraft
        ? '<div class="draft-banner">Un brouillon non enregistré existe pour cet article (' + window.AdminDrafts.timeAgo(state.pendingDraft.savedAt) + ").<div class=\"draft-banner-actions\">" +
          '<button type="button" class="draft-banner-btn" id="bl-draft-restore">Restaurer le brouillon</button>' +
          '<button type="button" class="draft-banner-btn draft-banner-btn-ghost" id="bl-draft-ignore">Ignorer</button></div></div>'
        : "") +
      '<div class="edit-hero">' +
      imgPreview +
      '<div class="edit-hero-body">' +
      '<input type="file" id="bl-img-file" accept="image/png,image/jpeg,image/webp,image/gif" hidden' + (state.uploadingImg ? " disabled" : "") + ">" +
      '<button type="button" class="edit-hero-btn" id="bl-img-pick"' + (state.uploadingImg ? " disabled" : "") + ">" +
      (state.uploadingImg ? "Téléversement…" : (state.editImgUrl ? "Modifier" : "Ajouter une image")) + "</button>" +
      (state.editImgUrl && !state.uploadingImg ? '<button type="button" class="edit-hero-remove" id="bl-img-remove">Retirer l\'image</button>' : "") +
      (state.uploadError ? '<div class="login-error">' + esc(state.uploadError) + "</div>" : "") +
      '<p class="edit-hero-hint">Image de couverture (affichée en tête d\'article et dans les listes)<br>Format recommandé : <strong>JPG ou WebP</strong><br>Dimensions recommandées : <strong>1600 × 1000&nbsp;px</strong> (paysage)<br>Poids maximal : 8 Mo</p>' +
      "</div></div>" +
      '<form id="bl-form">' +
      '<label class="field-label" for="bl-title">Titre</label>' +
      '<input class="field" id="bl-title" required value="' + esc(post.title) + '">' +
      '<label class="field-label" for="bl-cat">Catégorie</label>' +
      '<select class="field" id="bl-cat">' + catOptions + "</select>" +
      '<label class="field-label" for="bl-date">Date</label>' +
      '<input class="field" type="date" id="bl-date" required value="' + esc(post.date) + '">' +
      '<label class="field-label" for="bl-excerpt">Résumé (affiché dans la liste)</label>' +
      '<textarea class="field" id="bl-excerpt" rows="2" maxlength="220" placeholder="Une ou deux phrases pour donner envie de lire">' + esc(post.excerpt) + "</textarea>" +
      '<label class="field-label">Contenu de l\'article</label>' +
      '<div class="bl-editor-wrap"><div id="bl-editor"></div></div>' +
      '<p class="dashboard-note" style="margin-top:8px;">Sélectionnez du texte puis utilisez la barre d\'outils : titres, gras, italique, listes, citation, <strong>lien</strong> (icône chaîne) et <strong>image</strong> (icône photo, insérée à l\'endroit du curseur).</p>' +
      '<div id="bl-editor-status" class="dashboard-note"></div>' +

      '<details class="seo-panel" id="bl-seo" open>' +
      '<summary>Référencement Google (SEO) <span class="seo-score" id="bl-seo-score"></span></summary>' +
      '<div class="seo-body">' +
      (isNew
        ? ""
        : '<button type="button" class="edit-hero-btn" id="bl-seo-open" style="margin-bottom:16px;">Analyser avec l\'outil SEO complet ↗</button>') +
      '<label class="field-label" for="bl-keyword">Mot-clé principal</label>' +
      '<input class="field" id="bl-keyword" placeholder="ex : traiteur Gardanne" value="' + esc(post.keyword) + '">' +
      '<p class="dashboard-note" style="margin-top:6px;">L\'expression que vos clients taperaient dans Google pour trouver cet article.</p>' +
      '<label class="field-label" for="bl-seotitle">Titre SEO <span class="seo-count" id="bl-seotitle-count"></span></label>' +
      '<input class="field" id="bl-seotitle" maxlength="90" placeholder="Laissez vide pour reprendre le titre de l\'article" value="' + esc(post.seoTitle) + '">' +
      '<label class="field-label" for="bl-seodesc">Description SEO <span class="seo-count" id="bl-seodesc-count"></span></label>' +
      '<textarea class="field" id="bl-seodesc" rows="3" maxlength="220" placeholder="Laissez vide pour reprendre le résumé">' + esc(post.seoDesc) + "</textarea>" +
      '<label class="field-label" for="bl-slug">Adresse de l\'article (URL)</label>' +
      '<input class="field" id="bl-slug" placeholder="mon-article" value="' + esc(slugValue) + '">' +
      '<p class="dashboard-note" style="margin-top:6px;">' + (isNew ? "Générée automatiquement à partir du titre." : "Ne la modifiez pas après publication : les anciens liens cesseraient de fonctionner.") + "</p>" +
      '<label class="field-label" for="bl-imgalt">Description de l\'image de couverture</label>' +
      '<input class="field" id="bl-imgalt" placeholder="ex : Burger maison et frites sur la terrasse du Bistro Burger" value="' + esc(post.imgAlt) + '">' +
      '<div class="seo-preview-title">Aperçu dans Google</div>' +
      '<div class="seo-preview"><div class="seo-preview-url" id="bl-prev-url"></div><div class="seo-preview-t" id="bl-prev-title"></div><div class="seo-preview-d" id="bl-prev-desc"></div></div>' +
      '<div class="seo-preview-title">Vérifications</div>' +
      '<ul class="seo-checks" id="bl-seo-checks"></ul>' +
      "</div></details>" +

      '<details class="seo-panel" id="bl-plagiarism">' +
      '<summary>Vérificateur de plagiat</summary>' +
      '<div class="seo-body">' +
      '<p class="dashboard-note">Recherche si des passages de cet article se retrouvent mot pour mot ailleurs sur le web (quelques phrases représentatives, pas le texte entier).</p>' +
      '<button type="button" class="edit-hero-btn" id="bl-plag-check">Vérifier le plagiat</button>' +
      '<div id="bl-plag-result" class="dashboard-note" style="margin-top:12px;"></div>' +
      "</div></details>" +

      '<label class="admin-checkbox" style="margin-top:18px;"><input type="checkbox" id="bl-published"' + (post.published ? " checked" : "") + "> Publié (décochez pour garder en brouillon, invisible sur le site)</label>" +
      '<button type="submit" class="btn-primary" id="bl-save"' + (state.saving ? " disabled" : "") + ">" + (state.saving ? "Enregistrement…" : "Enregistrer") + "</button>" +
      (!isNew ? '<button type="button" class="btn-danger" id="bl-delete"' + (state.saving ? " disabled" : "") + ">Supprimer cet article</button>" : "") +
      (state.saveError ? '<div class="login-error">' + esc(state.saveError) + "</div>" : "") +
      '<div id="bl-draft-status" class="dashboard-note" style="margin-top:10px;"></div>' +
      "</form>";

    initEditor(bodyHtml);
    updateSeo();

    const seoOpenBtn = document.getElementById("bl-seo-open");
    if (seoOpenBtn) {
      seoOpenBtn.addEventListener("click", () => {
        const slug = document.getElementById("bl-slug").value.trim() || slugValue;
        const keyword = document.getElementById("bl-keyword").value.trim();
        const url = SITE_ORIGIN + "/blog/" + encodeURIComponent(slug) + ".html";
        let href = "../seo/?page=" + encodeURIComponent(url);
        if (keyword) href += "&kw=" + encodeURIComponent(keyword);
        window.open(href, "_blank", "noopener");
      });
    }

    document.getElementById("bl-plag-check").addEventListener("click", checkPlagiarism);

    let slugTouched = !isNew || !!post.slug;
    document.getElementById("bl-slug").addEventListener("input", () => { slugTouched = true; });
    document.getElementById("bl-title").addEventListener("input", () => {
      if (isNew && !slugTouched) document.getElementById("bl-slug").value = slugBase(document.getElementById("bl-title").value);
    });

    document.getElementById("bl-img-pick").addEventListener("click", () => document.getElementById("bl-img-file").click());
    document.getElementById("bl-img-file").addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) uploadCover(file);
    });
    const removeBtn = document.getElementById("bl-img-remove");
    if (removeBtn) {
      removeBtn.addEventListener("click", () => {
        state.restoredFields = readEditFields();
        state.editImgUrl = "";
        state.restoredFields.img = "";
        render();
        scheduleDraftSave();
      });
    }

    if (state.pendingDraft) {
      document.getElementById("bl-draft-restore").addEventListener("click", () => {
        const d = state.pendingDraft.data;
        state.restoredFields = {
          title: d.title || "", category: d.category || post.category, date: d.date || post.date,
          excerpt: d.excerpt || "", body: d.body || "", published: d.published !== false, img: d.img || "",
          imgAlt: d.imgAlt || "", seoTitle: d.seoTitle || "", seoDesc: d.seoDesc || "", keyword: d.keyword || "", slug: d.slug || "",
        };
        state.editImgUrl = d.img || "";
        state.pendingDraft = null;
        render();
      });
      document.getElementById("bl-draft-ignore").addEventListener("click", () => {
        window.AdminDrafts.clear(draftKey());
        state.pendingDraft = null;
        render();
      });
    }

    const form = document.getElementById("bl-form");
    form.addEventListener("input", () => { scheduleDraftSave(); scheduleSeo(); });
    form.addEventListener("change", () => { scheduleDraftSave(); scheduleSeo(); });

    stopDraftTicker();
    draftTickTimer = setInterval(() => {
      const draft = window.AdminDrafts.load(draftKey());
      const statusEl = document.getElementById("bl-draft-status");
      if (draft && statusEl) statusEl.textContent = "Brouillon enregistré automatiquement — " + window.AdminDrafts.timeAgo(draft.savedAt);
    }, 5000);

    document.getElementById("bl-back-list").addEventListener("click", () => {
      stopDraftTicker();
      state.quill = null;
      state.screen = "list";
      state.saveError = null;
      state.editImgUrl = undefined;
      state.restoredFields = null;
      render();
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = readEditFields();
      const next = {
        id: existing ? existing.id : crypto.randomUUID(),
        slug: uniqueSlug(f.slug || f.title, existing ? existing.id : null),
        title: f.title.trim(),
        category: f.category,
        date: f.date,
        excerpt: f.excerpt.trim(),
        body: f.body,
        img: state.editImgUrl || "",
        imgAlt: f.imgAlt.trim(),
        seoTitle: f.seoTitle.trim(),
        seoDesc: f.seoDesc.trim(),
        keyword: f.keyword.trim(),
        published: f.published,
      };
      const key = draftKey();
      if (isNew) state.data.posts.push(next);
      else state.data.posts[state.editIndex] = next;

      window.AdminDrafts.clear(key);
      stopDraftTicker();
      state.quill = null;
      state.editImgUrl = undefined;
      state.restoredFields = null;
      await persist("list");
    });

    if (!isNew) {
      document.getElementById("bl-delete").addEventListener("click", async () => {
        if (!confirm("Supprimer cet article ? Vous pourrez le restaurer tant que vous restez sur cette page.")) return;
        const key = draftKey();
        state.deletedPosts.push(existing);
        state.data.posts.splice(state.editIndex, 1);
        window.AdminDrafts.clear(key);
        stopDraftTicker();
        state.quill = null;
        state.editImgUrl = undefined;
        state.restoredFields = null;
        await persist("list");
      });
    }
  }

  window.BlogEditor = {
    async open() {
      state = { screen: "loading", data: null, editIndex: null, saving: false, saveError: null, saveSuccess: false, deletedPosts: [], quill: null };
      render();
      try {
        state.data = await apiGet();
        state.screen = "list";
      } catch (err) {
        state.screen = "error";
        state.error = err.message;
      }
      render();
    },
  };
})();
