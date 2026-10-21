"use strict";
(() => {
  const API_URL = "/api/admin/content";
  const container = document.getElementById("burgers-view");

  let state = null;
  let draftSaveTimer = null;
  let draftTickTimer = null;

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

  async function apiGet() {
    const headers = await window.adminAuth.authHeader();
    const res = await fetch(API_URL + "?key=burgers", { headers });
    if (!res.ok) throw new Error("Échec du chargement.");
    const json = await res.json();
    return json.value || [];
  }

  async function apiSave(data) {
    const headers = await window.adminAuth.authHeader();
    const res = await fetch(API_URL, {
      method: "PUT",
      headers: Object.assign({ "Content-Type": "application/json" }, headers),
      body: JSON.stringify({ key: "burgers", value: data }),
    });
    if (!res.ok) throw new Error("Échec de l'enregistrement.");
    const json = await res.json();
    if (json.deployTriggered === false) {
      throw new Error(
        "Enregistré, mais la republication du site a échoué. Contactez la personne qui gère le site."
      );
    }
  }

  function render() {
    if (state.screen === "loading") {
      container.innerHTML = '<div class="editor-loading">Chargement…</div>';
      return;
    }
    if (state.screen === "error") {
      container.innerHTML =
        '<button type="button" class="back-btn" id="b-back-menu">‹ Retour</button>' +
        '<div class="login-error">' + esc(state.error) + "</div>";
      document.getElementById("b-back-menu").addEventListener("click", () => window.adminShowDashboard());
      return;
    }
    if (state.screen === "categories") renderCategories();
    else if (state.screen === "items") renderItems();
    else if (state.screen === "edit") renderEdit();
  }

  function restoreCategories() {
    state.deletedCategories.slice().reverse().forEach((d) => { state.data.splice(Math.min(d.index, state.data.length), 0, d.category); });
    state.deletedCategories = [];
    persist("categories");
  }

  function moveCategoryTo(fromIndex, toIndex) {
    const [moved] = state.data.splice(fromIndex, 1);
    state.data.splice(toIndex, 0, moved);
    persist("categories");
  }

  function renderCategories() {
    const rows = state.data
      .map((cat, i) => {
        const count = cat.items.length;
        return (
          '<div class="list-row-wrap" data-row="' + i + '">' +
          '<span class="drag-handle" draggable="true" data-drag="' + i + '" aria-label="Glisser pour réorganiser">⠿</span>' +
          '<button type="button" class="list-row" data-cat="' + i + '">' +
          '<span class="list-row-main">' +
          '<span class="list-row-title">' + esc(cat.title) + "</span>" +
          '<span class="list-row-sub">' + count + " burger" + (count > 1 ? "s" : "") + "</span>" +
          "</span>" +
          '<span class="list-row-arrow">›</span>' +
          "</button>" +
          "</div>"
        );
      })
      .join("");

    container.innerHTML =
      '<button type="button" class="back-btn" id="b-back-menu">‹ Retour au menu</button>' +
      "<h1>Les burgers</h1>" +
      '<p class="dashboard-note">Catégories de la carte des burgers.</p>' +
      '<div class="list">' + (rows || '<p class="dashboard-note">Aucune catégorie.</p>') + "</div>" +
      '<div style="display:flex; gap:10px; align-items:center;">' +
      '<button type="button" class="btn-secondary" id="b-add-cat">+ Nouvelle catégorie</button>' +
      (state.deletedCategories.length > 0
        ? '<button type="button" class="icon-btn icon-btn-restore" id="b-restore-cats" title="Restaurer les catégories supprimées" aria-label="Restaurer les catégories supprimées">↺</button>'
        : "") +
      "</div>" +
      saveStatusHtml();

    document.getElementById("b-back-menu").addEventListener("click", () => window.adminShowDashboard());
    document.getElementById("b-add-cat").addEventListener("click", addCategory);
    if (state.deletedCategories.length > 0) {
      document.getElementById("b-restore-cats").addEventListener("click", restoreCategories);
    }
    container.querySelectorAll("[data-cat]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.catIndex = Number(btn.dataset.cat);
        state.screen = "items";
        render();
      });
    });
    setupDragAndDrop(moveCategoryTo);
  }

  function restoreItems() {
    const cat = state.data[state.catIndex];
    const restorable = state.deletedItems.filter((d) => d.catIndex === state.catIndex);
    restorable.slice().reverse().forEach((d) => { cat.items.splice(Math.min(d.index, cat.items.length), 0, d.item); });
    state.deletedItems = state.deletedItems.filter((d) => d.catIndex !== state.catIndex);
    persist("items");
  }

  function renderItems() {
    const cat = state.data[state.catIndex];
    const restorableCount = state.deletedItems.filter((d) => d.catIndex === state.catIndex).length;
    const rows = cat.items
      .map((item, i) => {
        const meta = [];
        if (item.sur) meta.push(item.sur + " sur place");
        if (item.emp) meta.push(item.emp + " à emporter");
        return (
          '<div class="list-row-wrap" data-row="' + i + '">' +
          '<span class="drag-handle" draggable="true" data-drag="' + i + '" aria-label="Glisser pour réorganiser">⠿</span>' +
          '<button type="button" class="list-row" data-item="' + i + '">' +
          '<span class="list-row-main">' +
          '<span class="list-row-title">' + esc(item.name) + "</span>" +
          '<span class="list-row-sub">' + esc(meta.join(" · ")) + "</span>" +
          "</span>" +
          '<span class="list-row-arrow">›</span>' +
          "</button>" +
          "</div>"
        );
      })
      .join("");

    container.innerHTML =
      '<button type="button" class="back-btn" id="b-back-cats">‹ Les burgers</button>' +
      '<div class="editor-header-row">' +
      "<h1>" + esc(cat.title) + "</h1>" +
      '<button type="button" class="icon-btn" id="b-rename-cat" aria-label="Renommer la catégorie">✎</button>' +
      (restorableCount > 0
        ? '<button type="button" class="icon-btn icon-btn-restore" id="b-restore-items" title="Restaurer les burgers supprimés" aria-label="Restaurer les burgers supprimés">↺</button>'
        : "") +
      '<button type="button" class="icon-btn icon-btn-danger" id="b-delete-cat" aria-label="Supprimer la catégorie">🗑</button>' +
      "</div>" +
      '<div class="list">' + (rows || '<p class="dashboard-note">Aucun burger dans cette catégorie.</p>') + "</div>" +
      '<button type="button" class="btn-secondary" id="b-add-item">+ Nouveau burger</button>' +
      saveStatusHtml();

    document.getElementById("b-back-cats").addEventListener("click", () => {
      state.screen = "categories";
      render();
    });
    document.getElementById("b-rename-cat").addEventListener("click", renameCategory);
    document.getElementById("b-delete-cat").addEventListener("click", deleteCategory);
    if (restorableCount > 0) {
      document.getElementById("b-restore-items").addEventListener("click", restoreItems);
    }
    document.getElementById("b-add-item").addEventListener("click", () => {
      state.itemIndex = null;
      state.editImgs = undefined;
      state.draftChecked = false;
      state.restoredFields = null;
      state.screen = "edit";
      render();
    });
    container.querySelectorAll("[data-item]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.itemIndex = Number(btn.dataset.item);
        state.editImgs = undefined;
        state.draftChecked = false;
        state.restoredFields = null;
        state.screen = "edit";
        render();
      });
    });
    setupDragAndDrop(moveItemTo);
  }

  function setupDragAndDrop(onMove) {
    const rows = container.querySelectorAll(".list-row-wrap");
    let dragFrom = null;

    rows.forEach((row) => {
      const handle = row.querySelector(".drag-handle");

      handle.addEventListener("dragstart", (e) => {
        dragFrom = Number(row.dataset.row);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(dragFrom));
        row.classList.add("dragging");
      });

      handle.addEventListener("dragend", () => {
        row.classList.remove("dragging");
        rows.forEach((r) => r.classList.remove("drag-over"));
        dragFrom = null;
      });

      row.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (dragFrom === null || Number(row.dataset.row) === dragFrom) return;
        row.classList.add("drag-over");
      });

      row.addEventListener("dragleave", () => {
        row.classList.remove("drag-over");
      });

      row.addEventListener("drop", (e) => {
        e.preventDefault();
        row.classList.remove("drag-over");
        const to = Number(row.dataset.row);
        if (dragFrom === null || to === dragFrom) return;
        onMove(dragFrom, to);
      });
    });
  }

  function moveItemTo(fromIndex, toIndex) {
    const items = state.data[state.catIndex].items;
    const [moved] = items.splice(fromIndex, 1);
    items.splice(toIndex, 0, moved);
    persist("items");
  }

  const IMAGE_BUCKET = "site-images";
  const EXT_BY_TYPE = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

  const MAX_IMAGES = 6;

  // Images d'un burger : la liste `imgs` si elle existe, sinon l'ancienne image unique `img`.
  function itemImages(item) {
    if (item && Array.isArray(item.imgs)) {
      const list = item.imgs.filter(Boolean);
      if (list.length) return list;
    }
    return item && item.img ? [item.img] : [];
  }

  async function uploadOne(file) {
    const ext = EXT_BY_TYPE[file.type];
    if (!ext) throw new Error("« " + file.name + " » : format non pris en charge. Utilisez JPG, PNG, WebP ou GIF.");
    if (file.size > MAX_IMAGE_BYTES) throw new Error("« " + file.name + " » : image trop lourde (8 Mo maximum).");

    const path = crypto.randomUUID() + "." + ext;
    const { error } = await window.adminAuth.supabase.storage
      .from(IMAGE_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw new Error("« " + file.name + " » : " + error.message);

    const { data } = window.adminAuth.supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  async function uploadImages(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const room = MAX_IMAGES - state.editImgs.length;
    const errors = [];
    if (files.length > room) errors.push("Maximum " + MAX_IMAGES + " images par burger : " + (files.length - room) + " image(s) ignorée(s).");
    state.uploadingImg = true;
    state.uploadError = null;
    render();
    for (const file of files.slice(0, Math.max(room, 0))) {
      try {
        state.editImgs.push(await uploadOne(file));
      } catch (err) {
        errors.push(err.message);
      }
    }
    state.uploadError = errors.length ? errors.join(" ") : null;
    state.uploadingImg = false;
    render();
    scheduleDraftSave();
  }

  function moveImage(from, to) {
    if (to < 0 || to >= state.editImgs.length) return;
    const [moved] = state.editImgs.splice(from, 1);
    state.editImgs.splice(to, 0, moved);
    render();
    scheduleDraftSave();
  }

  function burgerDraftKey() {
    return "burger:" + state.catIndex + ":" + (state.itemIndex === null ? "new" : state.itemIndex);
  }

  function readEditFields() {
    return {
      name: document.getElementById("b-name").value,
      desc: document.getElementById("b-desc").value,
      sur: document.getElementById("b-sur").value,
      emp: document.getElementById("b-emp").value,
      imgs: (state.editImgs || []).slice(),
    };
  }

  function scheduleDraftSave() {
    if (draftSaveTimer) clearTimeout(draftSaveTimer);
    draftSaveTimer = setTimeout(() => {
      window.AdminDrafts.save(burgerDraftKey(), readEditFields());
      const statusEl = document.getElementById("b-draft-status");
      if (statusEl) statusEl.textContent = "Brouillon enregistré automatiquement — à l'instant";
    }, 800);
  }

  function renderEdit() {
    const cat = state.data[state.catIndex];
    const isNew = state.itemIndex === null;
    const item = state.restoredFields || (isNew ? { name: "", desc: "", sur: "", emp: "", imgs: [] } : cat.items[state.itemIndex]);
    if (state.editImgs === undefined) state.editImgs = itemImages(item);

    if (!state.draftChecked) {
      state.draftChecked = true;
      state.pendingDraft = window.AdminDrafts.load(burgerDraftKey());
    }

    const imgs = state.editImgs;
    const galleryItems = imgs
      .map((url, i) =>
        '<div class="edit-gallery-item">' +
        '<img src="' + esc(url) + '" alt="Image ' + (i + 1) + '">' +
        (i === 0 ? '<span class="edit-gallery-badge">Principale</span>' : "") +
        '<div class="edit-gallery-actions">' +
        '<button type="button" data-g-left="' + i + '" aria-label="Déplacer vers la gauche"' + (i === 0 ? " disabled" : "") + ">‹</button>" +
        '<button type="button" data-g-right="' + i + '" aria-label="Déplacer vers la droite"' + (i === imgs.length - 1 ? " disabled" : "") + ">›</button>" +
        '<button type="button" data-g-del="' + i + '" aria-label="Retirer cette image">×</button>' +
        "</div></div>")
      .join("");
    const imgPreview =
      imgs.length
        ? '<div class="edit-gallery-grid">' + galleryItems + "</div>"
        : '<div class="edit-hero-empty">Aucune image</div>';

    container.innerHTML =
      '<button type="button" class="back-btn" id="b-back-items">‹ ' + esc(cat.title) + "</button>" +
      "<h1>" + (isNew ? "Nouveau burger" : "Modifier le burger") + "</h1>" +
      (state.pendingDraft
        ? '<div class="draft-banner">Un brouillon non enregistré existe pour ce formulaire (' + window.AdminDrafts.timeAgo(state.pendingDraft.savedAt) + ').' +
          '<div class="draft-banner-actions">' +
          '<button type="button" class="draft-banner-btn" id="b-draft-restore">Restaurer le brouillon</button>' +
          '<button type="button" class="draft-banner-btn draft-banner-btn-ghost" id="b-draft-ignore">Ignorer</button>' +
          "</div></div>"
        : "") +
      '<div class="edit-hero">' +
      imgPreview +
      '<div class="edit-hero-body">' +
      '<input type="file" id="b-img-file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden' + (state.uploadingImg ? " disabled" : "") + ">" +
      '<button type="button" class="edit-hero-btn" id="b-img-pick"' + (state.uploadingImg || imgs.length >= MAX_IMAGES ? " disabled" : "") + ">" +
      (state.uploadingImg ? "Téléversement…" : "Ajouter des images") +
      "</button>" +
      (state.uploadError ? '<div class="login-error">' + esc(state.uploadError) + "</div>" : "") +
      '<p class="edit-hero-hint">Images du burger : ' + imgs.length + " sur " + MAX_IMAGES + " maximum<br>Sur le site, elles <strong>défilent</strong> (carrousel). La première est l'image principale (flèches pour changer l'ordre).<br>Format recommandé : <strong>JPG ou WebP</strong><br>Dimensions recommandées : <strong>1200 × 900&nbsp;px</strong> (format 4:3)<br>Poids maximal : 8 Mo par image</p>" +
      "</div>" +
      "</div>" +
      '<form id="b-item-form">' +
      '<label class="field-label" for="b-name">Nom</label>' +
      '<input class="field" id="b-name" required value="' + esc(item.name) + '">' +
      '<label class="field-label" for="b-desc">Description</label>' +
      '<input class="field" id="b-desc" value="' + esc(item.desc) + '">' +
      '<hr class="divider">' +
      '<label class="field-label" for="b-sur">Prix sur place</label>' +
      '<input class="field" id="b-sur" placeholder="16 €" value="' + esc(item.sur) + '">' +
      '<label class="field-label" for="b-emp">Prix à emporter</label>' +
      '<input class="field" id="b-emp" placeholder="13 €" value="' + esc(item.emp) + '">' +
      '<button type="submit" class="btn-primary" id="b-save"' + (state.saving ? " disabled" : "") + ">" +
      (state.saving ? "Enregistrement…" : "Enregistrer") +
      "</button>" +
      (!isNew
        ? '<button type="button" class="btn-danger" id="b-delete-item"' + (state.saving ? " disabled" : "") + ">Supprimer ce burger</button>"
        : "") +
      (state.saveError ? '<div class="login-error">' + esc(state.saveError) + "</div>" : "") +
      '<div id="b-draft-status" class="dashboard-note" style="margin-top:10px;"></div>' +
      "</form>";

    document.getElementById("b-img-pick").addEventListener("click", () => {
      document.getElementById("b-img-file").click();
    });
    document.getElementById("b-img-file").addEventListener("change", (e) => {
      uploadImages(e.target.files);
    });
    container.querySelectorAll("[data-g-left]").forEach((b) => b.addEventListener("click", () => moveImage(Number(b.dataset.gLeft), Number(b.dataset.gLeft) - 1)));
    container.querySelectorAll("[data-g-right]").forEach((b) => b.addEventListener("click", () => moveImage(Number(b.dataset.gRight), Number(b.dataset.gRight) + 1)));
    container.querySelectorAll("[data-g-del]").forEach((b) => b.addEventListener("click", () => {
      state.editImgs.splice(Number(b.dataset.gDel), 1);
      render();
      scheduleDraftSave();
    }));

    if (state.pendingDraft) {
      document.getElementById("b-draft-restore").addEventListener("click", () => {
        const d = state.pendingDraft.data;
        const draftImgs = Array.isArray(d.imgs) ? d.imgs.filter(Boolean) : d.img ? [d.img] : itemImages(item);
        state.restoredFields = { name: d.name || "", desc: d.desc || "", sur: d.sur || "", emp: d.emp || "", imgs: draftImgs };
        state.editImgs = draftImgs.slice();
        state.pendingDraft = null;
        render();
      });
      document.getElementById("b-draft-ignore").addEventListener("click", () => {
        window.AdminDrafts.clear(burgerDraftKey());
        state.pendingDraft = null;
        render();
      });
    }

    document.getElementById("b-item-form").addEventListener("input", scheduleDraftSave);

    stopDraftTicker();
    draftTickTimer = setInterval(() => {
      const draft = window.AdminDrafts.load(burgerDraftKey());
      const statusEl = document.getElementById("b-draft-status");
      if (draft && statusEl) statusEl.textContent = "Brouillon enregistré automatiquement — " + window.AdminDrafts.timeAgo(draft.savedAt);
    }, 5000);

    document.getElementById("b-back-items").addEventListener("click", () => {
      stopDraftTicker();
      state.screen = "items";
      state.saveError = null;
      state.editImgs = undefined;
      render();
    });

    document.getElementById("b-item-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const newItem = {
        name: document.getElementById("b-name").value.trim(),
        desc: document.getElementById("b-desc").value.trim(),
        sur: document.getElementById("b-sur").value.trim(),
        emp: document.getElementById("b-emp").value.trim(),
      };
      if (state.editImgs.length) {
        newItem.img = state.editImgs[0];
        newItem.imgs = state.editImgs.slice();
      }

      if (isNew) cat.items.push(newItem);
      else cat.items[state.itemIndex] = newItem;

      state.editImgs = undefined;
      window.AdminDrafts.clear(burgerDraftKey());
      stopDraftTicker();
      await persist("items");
    });

    if (!isNew) {
      document.getElementById("b-delete-item").addEventListener("click", async () => {
        if (!confirm("Supprimer ce burger ?")) return;
        state.deletedItems.push({ catIndex: state.catIndex, index: state.itemIndex, item: cat.items[state.itemIndex] });
        cat.items.splice(state.itemIndex, 1);
        window.AdminDrafts.clear(burgerDraftKey());
        stopDraftTicker();
        await persist("items");
      });
    }
  }

  function saveStatusHtml() {
    if (state.saving) return '<div class="password-success">Enregistrement…</div>';
    if (state.saveError) return '<div class="login-error">' + esc(state.saveError) + "</div>";
    return "";
  }

  async function persist(nextScreen) {
    state.saving = true;
    state.saveError = null;
    state.itemIndex = null;
    state.screen = nextScreen;
    render();
    try {
      await apiSave(state.data);
    } catch (err) {
      state.saveError = err.message;
    } finally {
      state.saving = false;
      render();
    }
  }

  function addCategory() {
    const title = prompt("Nom de la nouvelle catégorie :");
    if (!title || !title.trim()) return;
    state.data.push({ title: title.trim(), items: [] });
    persist("categories");
  }

  function renameCategory() {
    const cat = state.data[state.catIndex];
    const title = prompt("Nouveau nom de la catégorie :", cat.title);
    if (!title || !title.trim()) return;
    cat.title = title.trim();
    persist("items");
  }

  function deleteCategory() {
    const cat = state.data[state.catIndex];
    if (!confirm('Supprimer la catégorie "' + cat.title + '" et ses ' + cat.items.length + " burger(s) ?")) return;
    state.deletedCategories.push({ index: state.catIndex, category: cat });
    state.data.splice(state.catIndex, 1);
    persist("categories");
  }

  window.BurgersEditor = {
    async open() {
      state = { screen: "loading", data: [], catIndex: null, itemIndex: null, saving: false, saveError: null, deletedItems: [], deletedCategories: [] };
      render();
      try {
        state.data = await apiGet();
        state.screen = "categories";
      } catch (err) {
        state.screen = "error";
        state.error = err.message;
      }
      render();
    },
  };
})();
