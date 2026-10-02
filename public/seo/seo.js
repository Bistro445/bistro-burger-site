"use strict";
(() => {
  /* ===================================================================== */
  /* Connexion (mot de passe propre à l'outil, indépendant du site)        */
  /* ===================================================================== */
  const TOKEN_KEY = "seo-tool-token";
  const loginScreen = document.getElementById("login-screen");
  const appEl = document.getElementById("seo-app");
  const loginError = document.getElementById("login-error");
  const loginChecking = document.getElementById("login-checking");
  const loginSub = document.getElementById("login-sub");
  const loginForm = document.getElementById("login-form");
  let started = false;

  function authHeaders() {
    const t = localStorage.getItem(TOKEN_KEY);
    return t ? { "X-Seo-Token": t } : {};
  }
  function showLoggedIn() {
    loginScreen.hidden = true;
    appEl.hidden = false;
    if (!started) { started = true; init(); }
  }
  function showPasswordForm() {
    loginChecking.hidden = true;
    loginSub.hidden = false;
    loginForm.hidden = false;
    loginScreen.hidden = false;
    appEl.hidden = true;
  }

  async function tryAdminSession() {
    if (!window.supabase || !window.SUPABASE_CONFIG || !window.SUPABASE_CONFIG.url || !window.SUPABASE_CONFIG.anonKey) return false;
    try {
      const client = window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);
      const { data } = await client.auth.getSession();
      const adminToken = data.session && data.session.access_token;
      if (!adminToken) return false;
      const res = await fetch("/api/seo?action=login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + adminToken },
        body: JSON.stringify({}),
      });
      if (!res.ok) return false;
      const json = await res.json();
      localStorage.setItem(TOKEN_KEY, json.token);
      return true;
    } catch (err) {
      return false;
    }
  }

  if (localStorage.getItem(TOKEN_KEY)) {
    // Différé : init() utilise des constantes définies plus bas dans ce fichier.
    Promise.resolve().then(showLoggedIn);
  } else {
    tryAdminSession().then((ok) => { if (ok) showLoggedIn(); else showPasswordForm(); });
  }

  const passwordInput = document.getElementById("password");
  const passwordToggle = document.getElementById("password-toggle");
  passwordToggle.addEventListener("click", () => {
    const show = passwordInput.type === "password";
    passwordInput.type = show ? "text" : "password";
    passwordToggle.setAttribute("aria-pressed", String(show));
    passwordToggle.setAttribute("aria-label", show ? "Masquer le mot de passe" : "Afficher le mot de passe");
    passwordToggle.querySelector(".icon-eye").hidden = show;
    passwordToggle.querySelector(".icon-eye-off").hidden = !show;
    passwordInput.focus();
  });

  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("login-submit");
    loginError.hidden = true;
    btn.disabled = true;
    btn.textContent = "Connexion…";
    try {
      const res = await fetch("/api/seo?action=login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: document.getElementById("password").value }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Échec de la connexion.");
      localStorage.setItem(TOKEN_KEY, json.token);
      document.getElementById("password").value = "";
      showLoggedIn();
    } catch (err) {
      loginError.hidden = false;
      loginError.textContent = err.message;
    } finally {
      btn.disabled = false;
      btn.textContent = "Accéder à l'outil";
    }
  });
  document.getElementById("logout-btn").addEventListener("click", () => {
    localStorage.removeItem(TOKEN_KEY);
    showPasswordForm();
  });

  /* ===================================================================== */
  /* Outils de texte                                                        */
  /* ===================================================================== */
  const STOP = new Set(("le la les un une des du de d l et ou mais donc or ni car que qui quoi dont où ce cet cette ces se sa son ses leur leurs " +
    "mon ma mes ton ta tes notre nos votre vos il elle on nous vous ils elles je tu me te lui y en à au aux avec sans sous sur dans par pour " +
    "vers chez entre comme plus moins très aussi tout tous toute toutes est sont être avoir a ont été fait faire peut peuvent pas ne n s c qu j m t si " +
    "ainsi cela ceci celui celle ceux depuis lors puis alors cette ici là après avant pendant afin quand lorsque bien tres notre votre").split(" "));
  const TRANSITIONS = ["mais", "donc", "car", "ainsi", "alors", "puis", "ensuite", "enfin", "cependant", "pourtant", "toutefois", "en effet", "de plus",
    "par ailleurs", "d'abord", "premièrement", "en revanche", "par exemple", "notamment", "c'est pourquoi", "en outre", "également", "d'ailleurs",
    "finalement", "en conclusion", "tandis que", "parce que", "afin de", "lorsque", "quand", "aussi", "or", "sinon", "ou bien", "de même"];

  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’]/g, "'");
  const wordsOf = (s) => String(s || "").match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || [];
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();

  function syllables(word) {
    const w = norm(word).replace(/[^a-z]/g, "");
    if (!w) return 0;
    let groups = (w.match(/[aeiouy]+/g) || []).length;
    if (groups > 1 && /(e|es|ent)$/.test(w) && !/[aeiouy](e|es|ent)$/.test(w)) groups -= 1;
    return Math.max(1, groups);
  }

  function splitSentences(text) {
    return String(text || "").split(/(?<=[.!?…])\s+/).map(clean).filter((s) => wordsOf(s).length >= 3);
  }

  function truncateAt(text, max) {
    const t = clean(text);
    if (t.length <= max) return t;
    const cut = t.slice(0, max);
    const sentence = cut.match(/^(.+[.!?])\s/);
    if (sentence && sentence[1].length > max * 0.55) return sentence[1];
    return cut.replace(/\s+\S*$/, "").replace(/[,;:\-–]$/, "");
  }

  function keywordIdeas(text) {
    const words = wordsOf(text).map((w) => norm(w).replace(/^['-]+|['-]+$/g, "")).filter(Boolean);
    const single = new Map();
    const pairs = new Map();
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (w.length >= 4 && !STOP.has(w) && !/^\d+$/.test(w)) single.set(w, (single.get(w) || 0) + 1);
      const n = words[i + 1];
      if (n && w.length >= 3 && n.length >= 3 && !STOP.has(w) && !STOP.has(n)) {
        const p = w + " " + n;
        pairs.set(p, (pairs.get(p) || 0) + 1);
      }
    }
    const top = (m, min, n) => Array.from(m.entries()).filter((e) => e[1] >= min).sort((a, b) => b[1] - a[1]).slice(0, n).map((e) => e[0]);
    return top(pairs, 2, 3).concat(top(single, 2, 6)).slice(0, 8);
  }

  /* ===================================================================== */
  /* Moteur d'analyse — fonctionne pour n'importe quel site                 */
  /* ===================================================================== */
  const GROUPS = ["Titre, description et balises", "Contenu et structure", "Images et liens", "Partage et technique", "Lisibilité", "Mot-clé principal"];

  function analyze(doc, ctx) {
    const items = [];
    const kw = norm(ctx.keyword);

    function add(o) {
      const it = Object.assign({ max: 0, pts: 0, where: "code", extra: null, fix: "" }, o);
      if (it.status === "ok") it.pts = it.max;
      else if (it.status === "warn" && o.pts == null) it.pts = Math.round(it.max / 2);
      else if (it.status === "fail" || it.status === "info") it.pts = o.pts == null ? 0 : o.pts;
      if (it.status === "info") it.max = 0;
      items.push(it);
    }

    const title = clean(doc.title);
    const desc = clean((doc.querySelector('meta[name="description"]') || {}).content);
    const h1s = Array.from(doc.querySelectorAll("h1")).map((h) => clean(h.textContent)).filter(Boolean);

    // Détecte automatiquement un article (compatible avec ce site comme avec n'importe quel autre).
    const articleRoot = doc.querySelector(".article-body") || doc.querySelector("article");
    const isArticle = !!articleRoot;
    const cms = ctx.editable ? "cms" : "code";

    let root = articleRoot;
    if (!root) {
      root = doc.body.cloneNode(true);
      root.querySelectorAll("script,style,noscript,header,footer,nav,[hidden],#header-spacer").forEach((e) => e.remove());
    }
    const text = clean(root.textContent);
    const words = wordsOf(text);
    const wordCount = words.length;
    const paragraphs = Array.from(root.querySelectorAll("p")).map((p) => clean(p.textContent)).filter((t) => wordsOf(t).length >= 8);
    const firstPara = paragraphs[0] || text.slice(0, 300);

    // ---- Titre, description, balises
    const baseTitle = h1s[0] || title;
    let titleSuggestion = baseTitle ? truncateAt(baseTitle, 60) : "";
    if (!title) add({ id: "title", group: 0, label: "Titre de la page", max: 10, status: "fail", msg: "La page n'a pas de titre.", fix: "Ajoutez une balise de titre de 30 à 60 caractères qui décrit la page.", where: cms, extra: { kind: "text", label: "Titre proposé", value: titleSuggestion } });
    else if (title.length < 30 || title.length > 60) add({ id: "title", group: 0, label: "Longueur du titre", max: 10, status: "warn", msg: "Le titre fait " + title.length + " caractères (idéal : 30 à 60). Google " + (title.length > 60 ? "risque de le couper" : "le trouve trop court pour bien décrire la page") + ".", fix: "Reformulez le titre pour qu'il fasse entre 30 et 60 caractères.", where: cms, extra: { kind: "text", label: "Titre proposé", value: titleSuggestion } });
    else add({ id: "title", group: 0, label: "Titre de la page", max: 10, status: "ok", msg: "Titre de " + title.length + " caractères : « " + title + " »." });

    let descSuggestion = truncateAt(firstPara, 155);
    if (!desc) add({ id: "desc", group: 0, label: "Description (meta)", max: 10, status: "fail", msg: "Aucune description : Google choisira lui-même un extrait, souvent peu attractif.", fix: "Rédigez une description de 70 à 160 caractères qui donne envie de cliquer.", where: cms, extra: { kind: "text", label: "Description proposée", value: descSuggestion } });
    else if (desc.length < 70 || desc.length > 160) add({ id: "desc", group: 0, label: "Longueur de la description", max: 10, status: "warn", msg: "La description fait " + desc.length + " caractères (idéal : 70 à 160).", fix: "Ajustez-la pour qu'elle tienne entre 70 et 160 caractères.", where: cms, extra: { kind: "text", label: "Description proposée", value: descSuggestion } });
    else add({ id: "desc", group: 0, label: "Description (meta)", max: 10, status: "ok", msg: "Description de " + desc.length + " caractères." });

    if (h1s.length === 0) add({ id: "h1", group: 0, label: "Titre principal (H1)", max: 8, status: "fail", msg: "Aucun titre principal H1 sur la page.", fix: "Ajoutez un seul H1 : c'est le grand titre de la page.", where: cms });
    else if (h1s.length > 1) add({ id: "h1", group: 0, label: "Titre principal (H1)", max: 8, status: "warn", msg: h1s.length + " titres H1 : il en faut un seul.", fix: "Gardez un seul H1 et transformez les autres en H2.", where: "code" });
    else add({ id: "h1", group: 0, label: "Titre principal (H1)", max: 8, status: "ok", msg: "Un seul H1 : « " + h1s[0] + " »." });

    const robots = (doc.querySelector('meta[name="robots"]') || {}).content || "";
    if (/noindex/i.test(robots)) add({ id: "robots", group: 0, label: "Visibilité dans Google", max: 5, status: "fail", msg: "La page demande à Google de ne pas l'indexer (noindex).", fix: "Retirez la balise robots noindex si vous voulez que cette page apparaisse dans Google.", where: "code" });
    else add({ id: "robots", group: 0, label: "Visibilité dans Google", max: 5, status: "ok", msg: "La page peut être indexée." });

    const canon = (doc.querySelector('link[rel="canonical"]') || {}).href || "";
    let canonOk = false;
    if (canon) {
      try {
        const cu = new URL(canon, ctx.url);
        const tu = new URL(ctx.url);
        canonOk = cu.origin === tu.origin && cu.pathname.replace(/\/$/, "") === tu.pathname.replace(/\/$/, "");
      } catch (e) { canonOk = false; }
    }
    if (!canon) add({ id: "canonical", group: 0, label: "Adresse canonique", max: 5, status: "fail", msg: "Pas d'adresse canonique : Google peut hésiter entre plusieurs versions de la page.", fix: "Ajoutez une balise canonical avec l'adresse complète de la page.", where: "code" });
    else if (!canonOk) add({ id: "canonical", group: 0, label: "Adresse canonique", max: 5, status: "warn", msg: "L'adresse canonique (" + canon + ") ne correspond pas exactement à la page analysée.", fix: "Faites pointer la balise canonical vers l'adresse exacte de la page.", where: "code" });
    else add({ id: "canonical", group: 0, label: "Adresse canonique", max: 5, status: "ok", msg: "Adresse canonique correcte." });

    const lang = doc.documentElement.getAttribute("lang");
    const viewport = doc.querySelector('meta[name="viewport"]');
    add({ id: "lang", group: 0, label: "Langue de la page", max: 2, status: lang ? "ok" : "fail", msg: lang ? "Langue déclarée : " + lang + "." : "La langue de la page n'est pas déclarée.", fix: 'Ajoutez lang="fr" (ou la langue concernée) sur la balise html.' });
    add({ id: "viewport", group: 0, label: "Affichage sur mobile", max: 2, status: viewport ? "ok" : "fail", msg: viewport ? "La page est prévue pour les mobiles." : "Pas de balise viewport : la page s'affichera mal sur téléphone.", fix: "Ajoutez la balise meta viewport." });

    // ---- Contenu et structure
    const minWords = isArticle ? 300 : 150;
    if (wordCount >= minWords) add({ id: "words", group: 1, label: "Quantité de texte", max: 8, status: "ok", msg: wordCount + " mots." });
    else if (wordCount >= minWords / 2) add({ id: "words", group: 1, label: "Quantité de texte", max: 8, status: "warn", msg: wordCount + " mots : " + (isArticle ? "un article gagne à en avoir au moins 300" : "prévoyez si possible au moins 150 mots") + ".", fix: isArticle ? "Développez l'article : exemples, détails, conseils pratiques." : "Ajoutez un texte de présentation plus complet sur la page.", where: cms });
    else add({ id: "words", group: 1, label: "Quantité de texte", max: 8, status: "fail", msg: "Seulement " + wordCount + " mots : trop peu pour que Google comprenne bien le sujet.", fix: isArticle ? "Rédigez au moins 300 mots." : "Ajoutez un texte de présentation d'au moins 150 mots.", where: cms });

    const h2s = Array.from(root.querySelectorAll("h2"));
    const heads = Array.from(root.querySelectorAll("h2,h3,h4")).map((h) => +h.tagName[1]);
    let skipped = false;
    for (let i = 0; i < heads.length; i++) { const prev = i ? heads[i - 1] : 2; if (heads[i] > prev + 1) skipped = true; }
    const needH2 = wordCount >= 200 ? 2 : 1;
    if (h2s.length >= needH2 && !skipped) add({ id: "headings", group: 1, label: "Intertitres", max: 6, status: "ok", msg: h2s.length + " intertitre(s) H2 : le texte est bien structuré." });
    else if (h2s.length >= 1) add({ id: "headings", group: 1, label: "Intertitres", max: 6, status: "warn", msg: skipped ? "Des niveaux de titres sont sautés (par exemple un H3 sans H2 avant)." : "Un seul intertitre : ajoutez-en pour découper le texte.", fix: "Utilisez des titres H2 (puis H3 dedans) pour organiser les idées.", where: cms });
    else add({ id: "headings", group: 1, label: "Intertitres", max: 6, status: wordCount >= 150 ? "fail" : "warn", msg: "Aucun intertitre H2 : le texte est un bloc difficile à parcourir.", fix: "Ajoutez des intertitres H2 tous les 2 à 3 paragraphes.", where: cms });

    const longParas = paragraphs.filter((p) => wordsOf(p).length > 130).length;
    add({ id: "paras", group: 1, label: "Longueur des paragraphes", max: 3, status: longParas ? "warn" : "ok", msg: longParas ? longParas + " paragraphe(s) de plus de 130 mots." : "Paragraphes de longueur confortable.", fix: "Coupez les longs paragraphes en blocs de 3 à 5 phrases.", where: cms });

    // ---- Images et liens
    const imgs = Array.from(root.querySelectorAll("img"));
    const noAlt = imgs.filter((im) => !clean(im.getAttribute("alt")));
    const altIdeas = noAlt.slice(0, 5).map((im) => {
      const file = decodeURIComponent((im.getAttribute("src") || "").split("/").pop().split("?")[0]).replace(/\.[a-z0-9]+$/i, "");
      const hex = /^[0-9a-f-]{20,}$/i.test(file);
      return { file: file.slice(0, 40), idea: hex ? "" : file.replace(/[-_]+/g, " ").replace(/\d+/g, "").trim() };
    });
    add({ id: "img-present", group: 2, label: "Présence d'images", max: 3, status: imgs.length ? "ok" : "warn", msg: imgs.length ? imgs.length + " image(s) sur la page." : "Aucune image : une photo rend la page plus attractive et améliore les partages.", fix: "Ajoutez au moins une image qui illustre le sujet.", where: cms });
    if (imgs.length) add({ id: "img-alt", group: 2, label: "Description des images (alt)", max: 6, status: noAlt.length === 0 ? "ok" : noAlt.length === imgs.length ? "fail" : "warn", pts: noAlt.length === 0 ? 6 : Math.round(6 * (imgs.length - noAlt.length) / imgs.length), msg: noAlt.length === 0 ? "Toutes les images sont décrites." : noAlt.length + " image(s) sur " + imgs.length + " sans description : Google et les lecteurs d'écran ne savent pas ce qu'elles montrent.", fix: "Décrivez chaque image en quelques mots (ce qu'on y voit).", where: cms, extra: noAlt.length ? { kind: "alts", items: altIdeas } : null });

    const links = Array.from(root.querySelectorAll("a[href]")).map((a) => {
      const href = a.getAttribute("href") || "";
      let url = null;
      try { url = new URL(href, ctx.url); } catch (e) { /* ignoré */ }
      return { a, href, url, text: clean(a.textContent) || clean(a.getAttribute("aria-label")) || (a.querySelector("img") ? clean(a.querySelector("img").alt) : "") };
    }).filter((l) => l.url && /^https?:$/.test(l.url.protocol) && !l.href.startsWith("#"));
    const pageHost = new URL(ctx.url).host;
    const internal = links.filter((l) => l.url.host === pageHost);
    const external = links.filter((l) => l.url.host !== pageHost);
    add({ id: "links-int", group: 2, label: "Liens internes", max: 4, status: internal.length ? "ok" : "warn", msg: internal.length ? internal.length + " lien(s) vers d'autres pages du même site." : "Aucun lien vers une autre page du site : Google a plus de mal à explorer et à relier vos contenus.", fix: "Ajoutez un lien vers une page ou un article en rapport.", where: cms });
    add({ id: "links-ext", group: 2, label: "Liens externes", max: 2, status: external.length ? "ok" : "warn", msg: external.length ? external.length + " lien(s) vers d'autres sites." : "Aucun lien vers un site de référence (source, partenaire, actualité).", fix: "Citez une source fiable avec un lien.", where: cms });
    const unsafe = external.filter((l) => l.a.getAttribute("target") === "_blank" && !/noopener/i.test(l.a.getAttribute("rel") || ""));
    if (external.length) add({ id: "links-safe", group: 2, label: "Ouverture sécurisée des liens externes", max: 2, status: unsafe.length ? "warn" : "ok", msg: unsafe.length ? unsafe.length + " lien(s) externe(s) sans protection noopener." : "Liens externes correctement protégés.", fix: 'Ajoutez rel="noopener noreferrer" aux liens qui s\'ouvrent dans un nouvel onglet.' });
    const emptyLinks = links.filter((l) => !l.text);
    add({ id: "links-text", group: 2, label: "Texte des liens", max: 2, status: emptyLinks.length ? "warn" : "ok", msg: emptyLinks.length ? emptyLinks.length + " lien(s) sans texte : ils sont invisibles pour Google et les lecteurs d'écran." : "Tous les liens ont un texte.", fix: "Donnez un texte clair (ou un libellé aria-label) à chaque lien." });

    // ---- Partage et technique
    const og = (p) => clean((doc.querySelector('meta[property="' + p + '"]') || {}).content);
    const ogMissing = ["og:title", "og:description", "og:image", "og:url"].filter((p) => !og(p));
    add({ id: "og", group: 3, label: "Aperçu de partage (Facebook, WhatsApp)", max: 6, status: ogMissing.length === 0 ? "ok" : ogMissing.length === 4 ? "fail" : "warn", pts: Math.round(6 * (4 - ogMissing.length) / 4), msg: ogMissing.length === 0 ? "Titre, description, image et adresse de partage présents." : "Balises manquantes : " + ogMissing.join(", ") + ".", fix: "Ajoutez les balises Open Graph manquantes.", where: "code" });
    const tw = (doc.querySelector('meta[name="twitter:card"]') || {}).content;
    add({ id: "twitter", group: 3, label: "Carte X (Twitter)", max: 2, status: tw ? "ok" : "warn", msg: tw ? "Carte de partage X déclarée." : "Pas de balise twitter:card.", fix: 'Ajoutez <meta name="twitter:card" content="summary_large_image">.' });

    const ld = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
    let ldTypes = [];
    let ldBad = 0;
    ld.forEach((s) => { try { const j = JSON.parse(s.textContent); (Array.isArray(j) ? j : [j]).forEach((o) => { if (o && o["@type"]) ldTypes = ldTypes.concat(o["@type"]); }); } catch (e) { ldBad++; } });
    if (ldBad) add({ id: "jsonld", group: 3, label: "Données structurées", max: 5, status: "fail", msg: "Des données structurées sont invalides et seront ignorées par Google.", fix: "Corrigez le JSON-LD de la page." });
    else if (!ld.length) add({ id: "jsonld", group: 3, label: "Données structurées", max: 5, status: "warn", msg: "Aucune donnée structurée : elles permettent d'afficher des résultats enrichis (horaires, avis, article…).", fix: isArticle ? "Ajoutez un bloc BlogPosting ou Article." : "Ajoutez un bloc adapté au site (Organization, LocalBusiness…)." });
    else add({ id: "jsonld", group: 3, label: "Données structurées", max: 5, status: "ok", msg: "Types détectés : " + Array.from(new Set(ldTypes)).join(", ") + "." });

    add({ id: "favicon", group: 3, label: "Icône du site (favicon)", max: 3, status: doc.querySelector('link[rel~="icon"]') ? "ok" : "warn", msg: doc.querySelector('link[rel~="icon"]') ? "Icône déclarée." : "Pas d'icône dans l'onglet du navigateur : Google l'affiche pourtant à côté du site dans les résultats mobiles.", fix: "Ajoutez une icône carrée (au moins 48 × 48 px) avec une balise link rel=\"icon\"." });

    const pathName = new URL(ctx.url).pathname;
    const urlProblems = [];
    if (new URL(ctx.url).protocol !== "https:") urlProblems.push("l'adresse n'est pas en https");
    if (/[A-Z]/.test(pathName)) urlProblems.push("majuscules");
    if (/[^\x00-\x7F]/.test(decodeURIComponent(pathName))) urlProblems.push("accents");
    if (/[_\s]/.test(pathName)) urlProblems.push("tirets bas ou espaces (préférez les tirets)");
    if (pathName.length > 75) urlProblems.push("adresse trop longue");
    add({ id: "url", group: 3, label: "Qualité de l'adresse (URL)", max: 3, status: urlProblems.length ? "warn" : "ok", msg: urlProblems.length ? "Problème(s) : " + urlProblems.join(", ") + "." : "Adresse courte, lisible et en minuscules.", fix: "Utilisez des mots en minuscules séparés par des tirets.", where: cms });

    // ---- Lisibilité (français)
    const sentences = splitSentences(text);
    if (wordCount >= 60 && sentences.length >= 3) {
      const asl = wordCount / sentences.length;
      const longShare = sentences.filter((s) => wordsOf(s).length > 25).length / sentences.length;
      const wordBoundary = (s) => " " + norm(s).replace(/[.,;:!?()«»""\-–—…]/g, " ").replace(/\s+/g, " ") + " ";
      const trans = sentences.filter((s) => { const n = wordBoundary(s); return TRANSITIONS.some((t) => n.indexOf(" " + norm(t) + " ") !== -1); }).length / sentences.length;
      const syl = words.reduce((n, w) => n + syllables(w), 0);
      const flesch = 207 - 1.015 * asl - 73.6 * (syl / wordCount);
      add({ id: "asl", group: 4, label: "Longueur moyenne des phrases", max: 5, status: asl <= 18 ? "ok" : asl <= 24 ? "warn" : "fail", msg: "En moyenne " + asl.toFixed(1).replace(".", ",") + " mots par phrase (idéal : 18 ou moins).", fix: "Coupez les phrases longues en deux.", where: cms });
      add({ id: "long", group: 4, label: "Phrases très longues", max: 3, status: longShare <= 0.25 ? "ok" : "warn", msg: Math.round(longShare * 100) + " % des phrases dépassent 25 mots (idéal : moins de 25 %).", fix: "Repérez les phrases de plus de 25 mots et raccourcissez-les.", where: cms });
      add({ id: "trans", group: 4, label: "Mots de liaison", max: 3, status: trans >= 0.2 ? "ok" : trans >= 0.1 ? "warn" : "fail", msg: Math.round(trans * 100) + " % des phrases contiennent un mot de liaison (mais, donc, ainsi, en effet…). Idéal : 20 % ou plus.", fix: "Reliez vos idées avec « ainsi », « en effet », « par exemple »…", where: cms });
      add({ id: "flesch", group: 4, label: "Facilité de lecture", max: 3, status: flesch >= 60 ? "ok" : flesch >= 40 ? "warn" : "fail", msg: "Indice de lecture : " + Math.max(0, Math.round(flesch)) + " / 100 (60 ou plus = facile à lire).", fix: "Préférez des mots courts et des phrases simples.", where: cms });
    } else {
      add({ id: "read-na", group: 4, label: "Lisibilité", status: "info", msg: "Texte trop court (moins de 60 mots) pour évaluer la lisibilité." });
    }

    // ---- Mot-clé
    let density = 0;
    if (kw) {
      const nText = norm(text);
      const kwWords = wordsOf(kw).length || 1;
      const occ = nText.split(kw).length - 1;
      density = wordCount ? (occ * kwWords / wordCount) * 100 : 0;
      const inTitle = norm(title).includes(kw);
      const inDesc = norm(desc).includes(kw);
      const inH1 = h1s.some((h) => norm(h).includes(kw));
      const inFirst = norm(firstPara).includes(kw);
      const inUrl = norm(pathName).replace(/[-_/]/g, " ").includes(kw.replace(/[-_]/g, " "));
      const inH2 = h2s.some((h) => norm(h.textContent).includes(kw));
      const inAlt = imgs.some((im) => norm(im.getAttribute("alt")).includes(kw));
      const chk = (id, label, max, ok, okMsg, koMsg, fix) => add({ id, group: 5, label, max, status: ok ? "ok" : "fail", msg: ok ? okMsg : koMsg, fix, where: cms });
      chk("kw-title", "Mot-clé dans le titre", 5, inTitle, "Le mot-clé est dans le titre.", "Le mot-clé « " + ctx.keyword + " » n'apparaît pas dans le titre.", "Placez le mot-clé, de préférence au début du titre.");
      chk("kw-desc", "Mot-clé dans la description", 4, inDesc, "Le mot-clé est dans la description.", "Le mot-clé n'apparaît pas dans la description.", "Intégrez le mot-clé dans la description.");
      chk("kw-h1", "Mot-clé dans le titre principal (H1)", 4, inH1, "Le mot-clé est dans le H1.", "Le mot-clé n'apparaît pas dans le H1.", "Reformulez le grand titre de la page avec le mot-clé.");
      chk("kw-first", "Mot-clé dans le premier paragraphe", 4, inFirst, "Le mot-clé est dans l'introduction.", "Le mot-clé n'apparaît pas dans le premier paragraphe.", "Mentionnez le mot-clé dans les premières phrases.");
      chk("kw-url", "Mot-clé dans l'adresse (URL)", 3, inUrl, "Le mot-clé est dans l'adresse.", "Le mot-clé n'apparaît pas dans l'adresse de la page.", "Adaptez l'adresse de la page (avec un tiret entre les mots).");
      if (h2s.length) chk("kw-h2", "Mot-clé dans un intertitre", 3, inH2, "Le mot-clé est dans un intertitre H2.", "Aucun intertitre H2 ne contient le mot-clé.", "Utilisez le mot-clé dans un des intertitres.");
      if (imgs.length) chk("kw-alt", "Mot-clé dans la description d'une image", 2, inAlt, "Une image est décrite avec le mot-clé.", "Aucune description d'image ne contient le mot-clé.", "Utilisez le mot-clé dans la description d'une image.");
      const dOk = density >= 0.5 && density <= 2.5;
      add({ id: "kw-density", group: 5, label: "Fréquence du mot-clé", max: 4, status: dOk ? "ok" : "warn", msg: "Le mot-clé revient " + occ + " fois (" + density.toFixed(1).replace(".", ",") + " % du texte ; idéal : 0,5 à 2,5 %).", fix: density < 0.5 ? "Utilisez le mot-clé un peu plus souvent, naturellement." : "Trop de répétitions : variez le vocabulaire.", where: cms });
    }
    const ideas = keywordIdeas(text);
    if (!kw) add({ id: "kw-none", group: 5, label: "Mot-clé principal", status: "info", msg: "Aucun mot-clé renseigné : indiquez ce que les visiteurs tapent dans Google pour lancer les vérifications de mot-clé.", extra: ideas.length ? { kind: "keywords", items: ideas } : null });

    // ---- score
    let pts = 0, max = 0;
    items.forEach((i) => { pts += i.pts; max += i.max; });
    const score = max ? Math.round((pts / max) * 100) : 0;
    const groups = GROUPS.map((name, gi) => {
      const its = items.filter((i) => i.group === gi);
      return { name, items: its, pts: its.reduce((n, i) => n + i.pts, 0), max: its.reduce((n, i) => n + i.max, 0) };
    }).filter((g) => g.items.length);
    const counts = { ok: 0, warn: 0, fail: 0 };
    items.forEach((i) => { if (counts[i.status] != null) counts[i.status]++; });
    return { score, pts, max, groups, counts, isArticle, meta: { title, desc, wordCount, density } };
  }

  function grade(score) {
    if (score >= 85) return { label: "Excellent", cls: "is-great" };
    if (score >= 70) return { label: "Bon", cls: "is-good" };
    if (score >= 50) return { label: "À améliorer", cls: "is-mid" };
    return { label: "À corriger", cls: "is-bad" };
  }

  /* ===================================================================== */
  /* Chargement d'une page — sur ce site (rapide, via un cadre invisible)   */
  /* ou sur un autre site (via le relais du serveur, pour contourner le     */
  /* blocage entre sites que les navigateurs appliquent).                  */
  /* ===================================================================== */
  const probe = document.getElementById("probe");

  function loadSameOrigin(url) {
    return new Promise((resolve, reject) => {
      let done = false;
      const timeout = setTimeout(() => { if (!done) { done = true; reject(new Error("La page met trop de temps à répondre.")); } }, 20000);
      probe.onload = async () => {
        if (done) return;
        try {
          const d = probe.contentDocument;
          if (!d || !d.body) throw new Error("Page illisible.");
          const start = Date.now();
          await new Promise((r) => setTimeout(r, 1200));
          while (Date.now() - start < 6000 && !d.querySelector(".article-body, article, main, #root, #app")) {
            if (d.body.textContent.trim().length > 200) break;
            await new Promise((r) => setTimeout(r, 250));
          }
          done = true;
          clearTimeout(timeout);
          resolve(d);
        } catch (e) { done = true; clearTimeout(timeout); reject(e); }
      };
      probe.src = url;
    });
  }

  async function fetchViaProxy(url) {
    const res = await fetch("/api/seo?action=fetch&url=" + encodeURIComponent(url), { headers: authHeaders() });
    const json = await res.json().catch(() => ({}));
    if (res.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      showPasswordForm();
      loginError.hidden = false;
      loginError.textContent = "Session expirée : saisissez le mot de passe de l'outil pour vous reconnecter.";
      throw new Error("Session expirée : reconnectez-vous.");
    }
    if (!res.ok) throw new Error(json.error || "Impossible de charger cette page.");
    return json;
  }

  async function loadPage(url) {
    const target = new URL(url);
    if (target.origin === location.origin) {
      return { doc: await loadSameOrigin(target.pathname + target.search), finalUrl: target.toString() };
    }
    const json = await fetchViaProxy(url);
    const doc = new DOMParser().parseFromString(json.html, "text/html");
    return { doc, finalUrl: json.url || url };
  }

  async function fetchText(url) {
    const target = new URL(url);
    if (target.origin === location.origin) {
      try {
        const r = await fetch(target.pathname + target.search, { cache: "no-store" });
        return { ok: r.ok, status: r.status, text: r.ok ? await r.text() : "" };
      } catch (e) { return { ok: false, status: 0, text: "" }; }
    }
    try {
      const json = await fetchViaProxy(url);
      return { ok: json.ok !== false, status: json.status, text: json.html || "" };
    } catch (e) { return { ok: false, status: 0, text: "" }; }
  }

  function normalizeUrl(raw) {
    let u = String(raw || "").trim();
    if (!u) return null;
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    try { return new URL(u); } catch (e) { return null; }
  }

  async function analyzePage(url, keyword) {
    const { doc, finalUrl } = await loadPage(url);
    const editable = new URL(finalUrl).origin === location.origin;
    const result = analyze(doc, { url: finalUrl, keyword: keyword || "", editable });
    result.url = finalUrl;
    result.keyword = keyword || "";
    return result;
  }

  /* ===================================================================== */
  /* Affichage                                                              */
  /* ===================================================================== */
  const el = (id) => document.getElementById(id);
  let filter = "all";

  function setStatus(msg, kind) {
    const s = el("status");
    if (!msg) { s.hidden = true; return; }
    s.hidden = false;
    s.className = "seo-status" + (kind ? " is-" + kind : "");
    s.textContent = msg;
  }

  const STATUS_LABEL = { ok: "Réussi", warn: "À améliorer", fail: "Critique", info: "Info" };
  const WHERE_LABEL = { cms: "Modifiable sur cette page", code: "Modification technique nécessaire" };

  function extraHtml(x) {
    if (!x) return "";
    if (x.kind === "text") {
      return '<div class="seo-suggest"><div class="seo-suggest-label">' + esc(x.label) + '</div><div class="seo-suggest-row"><span class="seo-suggest-text">' + esc(x.value || "—") + '</span>' +
        (x.value ? '<button type="button" class="seo-copy" data-copy="' + esc(x.value) + '">Copier</button>' : "") + "</div></div>";
    }
    if (x.kind === "keywords") {
      return '<div class="seo-suggest"><div class="seo-suggest-label">Idées de mots-clés tirées de votre texte (cliquez pour analyser avec)</div><div class="seo-chips">' +
        x.items.map((k) => '<button type="button" class="seo-chip" data-kw="' + esc(k) + '">' + esc(k) + "</button>").join("") + "</div></div>";
    }
    if (x.kind === "alts") {
      return '<div class="seo-suggest"><div class="seo-suggest-label">Images à décrire</div><ul class="seo-list">' +
        x.items.map((a) => "<li><code>" + esc(a.file) + "</code>" + (a.idea ? " : idée « " + esc(a.idea) + " »" : " : décrivez ce que montre la photo") + "</li>").join("") + "</ul></div>";
    }
    return "";
  }

  function itemHtml(it) {
    return '<li class="seo-item is-' + it.status + '" data-status="' + it.status + '">' +
      '<div class="seo-item-head"><span class="seo-pill is-' + it.status + '">' + STATUS_LABEL[it.status] + "</span>" +
      '<span class="seo-item-label">' + esc(it.label) + "</span>" +
      (it.max ? '<span class="seo-item-pts">' + it.pts + " / " + it.max + " pt" + (it.max > 1 ? "s" : "") + "</span>" : "") + "</div>" +
      '<p class="seo-item-msg">' + esc(it.msg) + "</p>" +
      (it.status !== "ok" && it.fix ? '<p class="seo-item-fix"><strong>Comment corriger :</strong> ' + esc(it.fix) + "</p>" : "") +
      (it.status !== "ok" && it.status !== "info" ? '<span class="seo-where is-' + it.where + '">' + WHERE_LABEL[it.where] + "</span>" : "") +
      (it.status !== "ok" ? extraHtml(it.extra) : "") + "</li>";
  }

  function renderResult(r) {
    const g = grade(r.score);
    const todo = r.counts.warn + r.counts.fail;
    const u = new URL(r.url);
    const groupsHtml = r.groups.map((gr) => {
      const pct = gr.max ? Math.round(gr.pts * 100 / gr.max) : 0;
      return '<section class="seo-group"><div class="seo-group-head"><h3>' + esc(gr.name) + "</h3>" +
        (gr.max ? '<span class="seo-group-pts">' + gr.pts + " / " + gr.max + " points</span>" : "") + "</div>" +
        (gr.max ? '<div class="seo-meter"><i style="width:' + pct + '%"></i></div>' : "") +
        '<ul class="seo-items">' + gr.items.map(itemHtml).join("") + "</ul></section>";
    }).join("");

    el("result").innerHTML =
      '<section class="seo-card seo-score-card">' +
      '<div class="seo-ring ' + g.cls + '" style="--p:' + r.score + '"><div class="seo-ring-in"><strong>' + r.score + '</strong><span>/ 100</span></div></div>' +
      '<div class="seo-score-body"><div class="seo-grade ' + g.cls + '">' + g.label + (r.isArticle ? ' <span class="seo-type-tag">Article</span>' : "") + "</div>" +
      "<h2>" + esc(u.hostname + u.pathname) + "</h2>" +
      '<p class="seo-note">' + r.pts + " points sur " + r.max + " possibles. " + (todo ? todo + " élément(s) à corriger." : "Aucune correction nécessaire.") + "</p>" +
      '<div class="seo-counts"><span class="is-ok">' + r.counts.ok + ' réussis</span><span class="is-warn">' + r.counts.warn + ' à améliorer</span><span class="is-fail">' + r.counts.fail + " critiques</span></div>" +
      '<div class="seo-actions"><button type="button" class="seo-btn seo-btn-primary" id="copy-report">Copier le rapport</button></div></div></section>' +
      '<div class="seo-tabs" role="tablist"><button type="button" class="seo-tab is-active" data-filter="all">Tout</button><button type="button" class="seo-tab" data-filter="todo">À corriger (' + todo + ')</button><button type="button" class="seo-tab" data-filter="ok">Réussis (' + r.counts.ok + ')</button></div>' +
      '<div id="groups">' + groupsHtml + "</div>" +
      '<section class="seo-card"><h3 class="seo-h3">Aperçu dans Google</h3><div class="seo-serp"><div class="seo-serp-url">' + esc(u.hostname + u.pathname) + '</div><div class="seo-serp-title">' + esc(r.meta.title || "(sans titre)") + '</div><div class="seo-serp-desc">' + esc(r.meta.desc || "(sans description : Google choisira un extrait)") + "</div></div></section>";

    filter = "all";
    applyFilter();
    document.querySelectorAll(".seo-tab").forEach((b) => b.addEventListener("click", () => { filter = b.dataset.filter; document.querySelectorAll(".seo-tab").forEach((x) => x.classList.toggle("is-active", x === b)); applyFilter(); }));
    document.getElementById("copy-report").addEventListener("click", () => copyText(buildReport(r), "Rapport copié : collez-le dans un message ou dans Claude."));
    bindExtras(el("result"));
    el("result").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function applyFilter() {
    document.querySelectorAll("#groups .seo-item").forEach((li) => {
      const s = li.dataset.status;
      li.hidden = filter === "todo" ? !(s === "warn" || s === "fail") : filter === "ok" ? s !== "ok" : false;
    });
    document.querySelectorAll("#groups .seo-group").forEach((g) => { g.hidden = !g.querySelector(".seo-item:not([hidden])"); });
  }

  function bindExtras(scope) {
    scope.querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", () => copyText(b.dataset.copy, "Copié.")));
    scope.querySelectorAll("[data-kw]").forEach((b) => b.addEventListener("click", () => { el("keyword").value = b.dataset.kw; run(); }));
  }

  let toastTimer = null;
  function toast(msg) {
    setStatus(msg, "ok");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => setStatus(""), 3500);
  }
  function copyText(text, okMsg) {
    const done = () => toast(okMsg);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    } else fallbackCopy(text, done);
  }
  function fallbackCopy(text, cb) {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (e) { /* ignoré */ }
    ta.remove(); cb();
  }

  function buildReport(r) {
    const u = new URL(r.url);
    const lines = [];
    lines.push("Audit SEO — " + u.hostname + u.pathname);
    lines.push("Note : " + r.score + " / 100 (" + grade(r.score).label + ") — " + r.pts + " points sur " + r.max);
    if (r.keyword) lines.push("Mot-clé principal : " + r.keyword);
    const todo = [];
    r.groups.forEach((g) => g.items.forEach((i) => { if (i.status === "warn" || i.status === "fail") todo.push({ g: g.name, i }); }));
    lines.push("");
    if (!todo.length) lines.push("Aucune correction nécessaire.");
    else {
      lines.push("À corriger (" + todo.length + ") :");
      todo.sort((a, b) => (a.i.status === "fail" ? 0 : 1) - (b.i.status === "fail" ? 0 : 1)).forEach((t, n) => {
        lines.push((n + 1) + ". [" + (t.i.status === "fail" ? "Critique" : "À améliorer") + "] " + t.i.label + " — " + t.i.msg);
        if (t.i.fix) lines.push("   Correction : " + t.i.fix);
        if (t.i.extra && t.i.extra.kind === "text" && t.i.extra.value) lines.push("   " + t.i.extra.label + " : " + t.i.extra.value);
      });
    }
    return lines.join("\n");
  }

  /* ===================================================================== */
  /* Analyse d'une page                                                     */
  /* ===================================================================== */
  async function run() {
    const u = normalizeUrl(el("page-url").value);
    if (!u) { setStatus("Indiquez une adresse valide, par exemple https://exemple.fr/une-page.", "error"); return; }
    el("page-url").value = u.toString();
    const kw = el("keyword").value.trim();
    // Une analyse de page seule ne doit pas laisser traîner les résultats d'un audit du site entier.
    el("site-audit").innerHTML = "";
    el("site-health").innerHTML = "";
    el("run-btn").disabled = true; el("audit-btn").disabled = true;
    setStatus("Analyse en cours…");
    try {
      const r = await analyzePage(u.toString(), kw);
      setStatus("");
      renderResult(r);
    } catch (err) {
      setStatus("Analyse impossible : " + err.message, "error");
    } finally {
      el("run-btn").disabled = false; el("audit-btn").disabled = false;
    }
  }

  /* ===================================================================== */
  /* Audit de tout le site (découverte via le plan du site)                 */
  /* ===================================================================== */
  function parseSitemapUrls(xml) {
    const matches = Array.from(String(xml || "").matchAll(/<loc>\s*([^<\s][^<]*?)\s*<\/loc>/gi)).map((m) => m[1]);
    return Array.from(new Set(matches)).filter((u) => /^https?:\/\//i.test(u));
  }

  async function discoverPages(origin) {
    const res = await fetchText(origin + "/sitemap.xml");
    if (res.ok && res.text) {
      const urls = parseSitemapUrls(res.text).slice(0, 20);
      if (urls.length) return { urls, source: "sitemap.xml" };
    }
    return { urls: [origin + "/"], source: "aucun plan du site : uniquement la page d'accueil" };
  }

  async function auditSite() {
    const u = normalizeUrl(el("page-url").value);
    if (!u) { setStatus("Indiquez d'abord une adresse du site à auditer.", "error"); return; }
    el("run-btn").disabled = true; el("audit-btn").disabled = true;
    el("result").innerHTML = "";
    el("site-health").innerHTML = "";
    try {
      setStatus("Recherche du plan du site…");
      const { urls, source } = await discoverPages(u.origin);
      const rows = [];
      for (let i = 0; i < urls.length; i++) {
        setStatus("Audit en cours : " + (i + 1) + " page(s) sur " + urls.length + " (" + source + ")…");
        try {
          const r = await analyzePage(urls[i], "");
          rows.push({ url: urls[i], r });
        } catch (e) { rows.push({ url: urls[i], error: e.message }); }
      }
      setStatus("");
      renderSiteAudit(rows, u.origin);
      await renderSiteHealth(u.origin);
    } catch (err) {
      setStatus("Audit impossible : " + err.message, "error");
    } finally {
      el("run-btn").disabled = false; el("audit-btn").disabled = false;
    }
  }

  function renderSiteAudit(rows, origin) {
    const scored = rows.filter((x) => x.r);
    const avg = scored.length ? Math.round(scored.reduce((n, x) => n + x.r.score, 0) / scored.length) : 0;
    const g = grade(avg);
    el("site-audit").innerHTML =
      '<section class="seo-card"><div class="seo-sitehead"><div class="seo-ring seo-ring-sm ' + g.cls + '" style="--p:' + avg + '"><div class="seo-ring-in"><strong>' + avg + '</strong><span>/ 100</span></div></div>' +
      '<div><h2>Note moyenne de ' + esc(new URL(origin).hostname) + '</h2><p class="seo-note">' + scored.length + " page(s) analysée(s) sur " + rows.length + ". Cliquez sur « Détail » pour voir les corrections d'une page.</p></div></div>" +
      '<div class="seo-tablewrap"><table class="seo-table"><thead><tr><th>Page</th><th>Note</th><th>Critiques</th><th>À améliorer</th><th></th></tr></thead><tbody>' +
      rows.map((x, i) => x.r
        ? "<tr><td>" + esc(new URL(x.url).pathname || "/") + '</td><td><span class="seo-badge ' + grade(x.r.score).cls + '">' + x.r.score + "</span></td><td>" + x.r.counts.fail + "</td><td>" + x.r.counts.warn + '</td><td><button type="button" class="seo-btn seo-btn-sm" data-detail="' + i + '">Détail</button></td></tr>'
        : "<tr><td>" + esc(new URL(x.url).pathname || "/") + '</td><td colspan="4">Erreur : ' + esc(x.error) + "</td></tr>").join("") +
      "</tbody></table></div></section>";
    el("site-audit").querySelectorAll("[data-detail]").forEach((b) => b.addEventListener("click", () => {
      const x = rows[Number(b.dataset.detail)];
      el("site-health").innerHTML = "";
      el("site-audit").innerHTML = "";
      el("page-url").value = x.url;
      el("keyword").value = x.r.keyword || "";
      renderResult(x.r);
    }));
    el("site-audit").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function renderSiteHealth(origin) {
    const checks = [];
    const add = (label, ok, msg, fix) => checks.push({ label, ok, msg, fix });

    const sm = await fetchText(origin + "/sitemap.xml");
    if (!sm.ok || !/<urlset|<sitemapindex/i.test(sm.text)) add("Plan du site (sitemap.xml)", false, "Aucun plan du site valide trouvé à " + origin + "/sitemap.xml.", "Ajoutez un fichier sitemap.xml listant les pages importantes.");
    else add("Plan du site (sitemap.xml)", true, "Présent et lisible.", "");

    const rb = await fetchText(origin + "/robots.txt");
    if (!rb.ok) add("Fichier robots.txt", false, "Introuvable.", "Ajoutez un fichier robots.txt à la racine du site.");
    else add("Fichier robots.txt", /sitemap:/i.test(rb.text), /sitemap:/i.test(rb.text) ? "Présent, avec l'adresse du plan du site." : "Présent, mais sans ligne Sitemap.", "Ajoutez une ligne Sitemap: avec l'adresse complète du plan du site.");

    const nf = await fetchText(origin + "/page-inexistante-" + Date.now());
    if (nf.text) add("Page d'erreur 404", nf.status === 404, nf.status === 404 ? "Le site renvoie bien un code 404 pour une page inexistante." : "Le site ne renvoie pas un vrai code d'erreur 404 pour une page inexistante (code observé : " + nf.status + ").", "Configurez le serveur pour renvoyer un code 404 sur les pages introuvables.");

    el("site-health").innerHTML =
      '<section class="seo-card"><h3 class="seo-h3">Santé technique du site</h3><ul class="seo-items">' +
      checks.map((c) => '<li class="seo-item is-' + (c.ok ? "ok" : "warn") + '"><div class="seo-item-head"><span class="seo-pill is-' + (c.ok ? "ok" : "warn") + '">' + (c.ok ? "Réussi" : "À améliorer") + '</span><span class="seo-item-label">' + esc(c.label) + '</span></div><p class="seo-item-msg">' + esc(c.msg) + "</p>" + (!c.ok && c.fix ? '<p class="seo-item-fix"><strong>Comment corriger :</strong> ' + esc(c.fix) + "</p>" : "") + "</li>").join("") +
      "</ul></section>";
  }

  /* ===================================================================== */
  /* Démarrage                                                              */
  /* ===================================================================== */
  function init() {
    if (!el("page-url").value) el("page-url").value = location.origin + "/";
    el("run-btn").addEventListener("click", run);
    el("audit-btn").addEventListener("click", auditSite);
    el("page-url").addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });
    el("keyword").addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });

    const params = new URLSearchParams(location.search);
    const wanted = params.get("page");
    if (wanted) {
      el("page-url").value = wanted;
      if (params.get("kw")) el("keyword").value = params.get("kw");
      run();
    }
  }
})();
