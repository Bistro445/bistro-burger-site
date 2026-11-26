# Bistro Burger Gardanne — guide pour Claude

Site vitrine + espace d'administration du restaurant Bistro Burger (Gardanne), en ligne sur
`https://bistroburgergardanne.com`. Ce fichier est lu automatiquement : suis-le avant toute modification.

## Règle d'or
**Le site est en production et des clients s'en servent (réservations, plat du jour, horaires).**
Fais des changements petits,  vérifie-les avant de les envoyer, et ne casse jamais ce qui marche.
Dans le doute, demande à la personne avant d'agir. Réponds en français, simplement : la personne
n'est pas développeuse.

## Architecture
- `server.js` : serveur Express (Node ≥ 20). Sert les pages, monte chaque fichier de `api/` comme route
  (`api/orders.js` → `/api/orders`), garde en mémoire les données du site, mode maintenance, `/healthz`.
- `pages/` : **toutes les pages HTML publiques** (accueil, blog, CGV, confidentialité, mentions légales, 404, 500 : pages d'erreur à l'image du site ; la 500 s'affiche si le serveur plante sur une page, jamais pour `/api`).
- `public/` : fichiers statiques (CSS, JS, images, `admin/`, `seo/`, `app/`). Voir le piège n°1 ci-dessous.
- `api/` : fonctions serveur. `api/admin/*` exige une session admin Supabase. `api/_lib/` = code partagé.
- `lib/siteData.js` + `lib/siteDataStore.js` : lisent Supabase et fabriquent `data.generated.js` en mémoire.
- `public/hours.js` : **source unique** de la logique d'horaires (site, admin, serveur, JSON-LD Google).
- `public/script.js` : tout le JavaScript du site public. `public/styles.css` : styles.
- `public/admin/` : espace admin (un fichier JS par section). `public/seo/` : outil d'analyse SEO.
  `public/app/` : application mobile des réservations (installable).

## Où vivent les données (Supabase)
Projet Supabase "bistro-burger". Tables : `site_content` (clé/valeur JSON), `reservations`, `orders`,
`push_subscriptions`, plus les comptes admin (Authentication).
Clés de `site_content` : `burgers`, `cartes`, `plat_du_jour`, `offres`, `reservation_settings`,
`promo_popup`, `annonces`, `burger_du_moment`, `blog` (articles), `horaires`.
Le contenu se modifie **de préférence dans l'espace admin** (`/admin/`), qui enregistre puis rafraîchit le site.
Un burger (`burgers`) a `img` (image principale) et `imgs` (jusqu'à 6 images, saisies dans l'admin : ajout multiple,
flèches pour l'ordre). Le site les affiche en carrousel sur la carte du burger (défilement au doigt, flèches et points ; un clic ouvre l'image en grand, avec flèches).
`img` doit toujours rester égale à `imgs[0]` (panier et anciens contenus s'en servent).
Corbeille des images (13/11/2026) : une image retirée avec « × » dans l'admin n'est pas effacée du stockage ; son adresse
part dans `imgsTrash` (liste `{ url, at }`, 30 au plus) et l'admin propose « Restaurer ». Le site public ignore ce champ.
Les articles du blog sont dans la clé `blog` ; leur texte est écrit en dur (une mention d'horaires dans un
article ne suit pas l'éditeur d'horaires : à relire à la main).

## Compteur de consultations du blog (ajouté le 04/11/2026)
Chaque ouverture d'un article (`/blog/<slug>.html`, humain uniquement : robots, pré-chargements et rechargements de moins de
30 min par la même adresse IP ne comptent pas) ajoute 1 dans la table Supabase `blog_views` (fonction SQL
`increment_blog_view`, appelée par `lib/blogViews.js` depuis `server.js`). La table est fermée au public (RLS sans politique) :
**les chiffres ne s'affichent que dans l'admin** (Blog : sous chaque article et dans sa fiche), via `/api/admin/blog-views`
(session admin obligatoire). **Ne jamais ranger ces chiffres dans `site_content`** : tout `site_content` est recopié dans le
fichier public `data.generated.js`. Mise en service : exécuter **une seule fois** `scripts/blog-views.sql` dans Supabase
(SQL Editor). Tant que ce n'est pas fait, le compteur ne compte rien et l'admin l'indique ; le site public n'est pas affecté.

## Demandes et suivi des clics (ajouté le 20/11/2026, pour la page Noël puis le devis traiteur)
- `POST /api/demande` (api/demande.js) : formulaire public. Contrôle des champs, anti-robots (champ piège `website`,
  délai minimum `elapsed` ≥ 3 s, 5 envois par IP et par heure), enregistrement dans la table `demandes`, alerte e-mail
  aux comptes admin (modèle `adminNewDemande`), notification push, accusé de réception au client (`clientDemandeAck`,
  si Resend est configuré). `{ dryRun: true }` contrôle tout sans rien envoyer (tests). Seule origine extérieure
  autorisée (CORS) : `http://localhost:xxxx`, pour tester la maquette locale.
- `POST /api/track` (api/track.js) : compte un clic `{ page: "noel", event }` dans `page_events` (robots ignorés).
- Admin : rubrique « Demandes & Noël » (public/admin/demandes.js, api/admin/demandes.js).
- `scripts/demandes.sql` a été exécuté dans Supabase le 20/11/2026 (testé : demande enregistrée, clic compté).
- **Piège Supabase** : sur ce projet, un tableau créé par SQL n'a **aucun droit**, même pour la clé de service. Toujours
  ajouter `grant select, insert, update, delete on public.<table> to service_role;` (jamais pour anon/authenticated).
  Le compteur du blog (`scripts/blog-views.sql`) n'a jamais été exécuté (table `blog_views` absente au 20/11/2026) :
  y ajouter cette ligne de droits avant de le lancer.
- Page Noël (`pages/noel.html`, `public/noel.css`, `public/noel.js`) : **pas encore publiée** (fichiers locaux, non
  suivis par git). Contenu modifiable dans l'admin, rubrique « Page Noël » (public/admin/noel.js, clé site_content
  `noel` = { visible, textes, docs }) : chaque case `<span class="nl-todo" data-noel="clé">` est remplacée côté
  serveur par lib/noelPage.js (route /noel de server.js, + prix dans les données « Event »). PDF déposés depuis
  l'admin dans Supabase Storage, espace `site-docs` (scripts/noel-docs.sql, exécuté le 26/11/2026), servis à adresse
  fixe `/noel/<fichier>.pdf` (redirection vers le fichier actuel). « Page visible » décochée → /noel répond 404.
  Publication : ajouter pages/noel.html + public/noel.css/.js au dépôt, retirer le bandeau maquette et le noindex.

## Devis traiteur (OUVERT AUX CLIENTS depuis le 26/11/2026, après un aperçu privé le même jour)
- Liens : menu principal de toutes les pages (« Devis traiteur »), page /traiteur, sitemap. Pour recacher en urgence :
  `DEVIS_PUBLIC=false` dans Hostinger (l'aperçu admin /devis-traiteur/apercu reste possible).
- Conditions d'annulation / modification / solde : NON définies dans les CGV (qui ne couvrent que la vente à
  emporter) → le devis indique « conditions convenues avec le gérant lors de l'échange ». Ne pas inventer de conditions.
- Page `/devis-traiteur` (pages/devis-traiteur.html, public/devis-traiteur.css/.js). Le catalogue, les règles et les
  calculs sont dans **public/devis-catalogue.js**, partagé navigateur + serveur : `api/devis.js` refait tout le calcul
  à la validation (prix du navigateur ignorés), contrôle délai (96 h, heure de Paris), jours d'ouverture, minimums,
  composition et coordonnées, numérote via la fonction SQL `next_devis_numero()` (DEV-2026-0001), enregistre dans la
  table `devis`, envoie le devis au client (`clientDevis`) et une copie aux comptes admin (`adminDevis`).
- Chaque devis a sa page : `/devis-traiteur/d/<jeton>` (lib/devisDocument.js) : A4 imprimable / PDF par le navigateur,
  bouton « Je souhaite valider ce devis » → `POST /api/devis {action:"accept"}` → statut `accepte` + alerte au restaurant
  (rien n'est validé avant l'échange avec le gérant et l'acompte de 40 %).
- Admin : rubrique « Devis traiteur » (public/admin/devis.js, api/admin/devis.js) : statuts, notes, historique,
  renvoi au client, export CSV.
- **Aperçu privé** : tant que `DEVIS_PUBLIC` n'est pas `true` dans Hostinger, `/devis-traiteur` et la création de devis
  répondent 404, sauf dans un navigateur passé par `/devis-traiteur/apercu` avec une session admin (cookie signé avec la
  clé serveur Supabase, api/devis-apercu.js et api/_lib/devisAccess.js). **Le dépôt GitHub est public : ne jamais écrire
  de clé ou de lien secret dans le code.** Pour ouvrir aux clients : `DEVIS_PUBLIC=true`, retirer le bandeau
  « Aperçu privé » et le `noindex` de la page, ajouter les liens (menu, page traiteur, QR code), et remettre le compteur
  à zéro (fin de scripts/devis.sql).
- Prix : uniquement la carte « Cocktail & bouchées » (3 formules cocktail + 3 plateaux à partager ; HT ou TTC encore à
  confirmer). Les formules à prix d'EXEMPLE (`ex: true` : lunch boxes, plateaux repas, boissons, suppléments) restent
  dans devis-catalogue.js mais sont masquées (`CONFIG.showExamples: false`). Livraison sous 15 pers. : « frais à
  confirmer » (`deliveryFee.toConfirm`). Aucun code promo.
- PDF : lib/pdfDevis.js (générateur écrit à la main, SANS dépendance npm : package-lock.json ne peut pas être mis à
  jour sur ce PC sans Node). Joint à l'e-mail du client, à la copie au restaurant et au renvoi depuis l'admin ;
  téléchargeable sur `/devis-traiteur/d/<jeton>/pdf`. Logo : lib/devis-logo.jpg (JPEG sur fond vert).
- Pas encore fait : relance automatique à 3 jours, versions modifiées par le restaurant, gestion du catalogue
  depuis l'admin.

## Déploiement
Hébergeur : Hostinger (application Node.js), déploiement depuis GitHub. **Aucun environnement de test en
ligne** : tout `push` sur la branche déployée part en production après un redéploiement.
- Après un redéploiement, **vérifie `https://bistroburgergardanne.com/healthz`** : `processStartedAt` doit
  avoir changé. Le bouton "Redéployer" ne redémarre pas toujours le processus.
- Données Supabase modifiées à la main : le site les relit toutes les 5 minutes, ou tout de suite après un
  enregistrement dans l'admin.
- Variables d'environnement (jamais dans le code, jamais dans le chat) : `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `SITE_URL`, `ALERT_EMAIL` (adresse de secours des alertes, par défaut brasserie.zone.avon@gmail.com), `RECAPTCHA_SITE_KEY`/`RECAPTCHA_SECRET_KEY`, `VAPID_*`,
  `MAINTENANCE_MODE` (="true" met le site en maintenance), `PREVIEW_KEY` (accès privé via `/preview/<clé>`).
  Facultatives : `BREVO_*` (newsletter, pas encore reliée), `GOOGLE_CSE_*`, et `RESEND_API_KEY` + `RESEND_FROM_EMAIL` (+ `RESEND_REPLY_TO`) :
  e-mails soignés par Resend : confirmation au client quand le restaurant clique sur "Confirmer" dans l'admin, et alertes
  "nouvelle réservation/commande" au restaurant. Modèles (couleurs, texte) dans `api/_lib/emailTemplates.js`, envoi dans
  `api/_lib/mailer.js`. Sans ces variables : pas d'e-mail client (l'admin le signale) et les alertes repassent par
  formsubmit.co (ancien système, simple). Plan Resend gratuit : 3 000 e-mails par mois.
  `DEPLOY_HOOK_URL` et `SEO_TOOL_PASSWORD` sont obsolètes.

## Tester avant d'envoyer
1. Relis `git diff` : seuls les changements voulus doivent y figurer.
2. Test local **sans Node** : `powershell -File scripts/serve-local.ps1` puis ouvre `http://localhost:8099/`
   (sert `pages/` + `public/`). Les appels `/api/*` n'existent pas dans ce mode (erreurs 404 normales).
   Avec Node installé, `npm install` puis `node server.js` fait tourner le vrai serveur (variables requises).
3. Contrôle la console du navigateur (aucune erreur) et le rendu sur téléphone (≈ 390–440 px) et ordinateur.
4. Après redéploiement : `/healthz`, la page modifiée, `/admin/`, et un test de réservation si on y a touché.

## Pièges connus (appris à la dure)
1. **Hostinger sert directement le contenu de `public/`**, sans passer par Express : aucun en-tête, aucune
   règle de maintenance. C'est pour cela que les pages HTML sont dans `pages/`. N'y remets jamais de HTML public.
2. Dans `script.js`, le même fichier tourne sur toutes les pages : **protège chaque élément** qui n'existe
   pas partout (un `null.addEventListener` arrête tout le script sur les pages CGV, confidentialité, mentions).
3. Ne lance pas un traitement qui utilise une constante définie plus bas dans le fichier (erreur
   "Cannot access … before initialization", cause d'un bug de l'outil SEO).
4. Fonctionnalités **masquées par CSS** en fin de `public/styles.css` : panier / commande en ligne et
   newsletter. Pour les réactiver : supprimer le bloc concerné. (La section d'accueil `#commander`,
   « Votre burger livré ou à emporter » avec appel + Uber Eats, est affichée depuis le 15/10/2026.) La politique de confidentialité a été
   modifiée en conséquence (historique git pour restaurer la mention Brevo/newsletter). Le bouton
   "Commander" lance un appel téléphonique (`tel:`).
5. Modifier de gros blocs avec `sed`/`perl` en plusieurs lignes a déjà abîmé des fichiers : préfère l'outil
   d'édition, puis relis le diff.
6. Windows : les avertissements "LF will be replaced by CRLF" sont sans gravité.
7. Horaires : ne les écris pas en dur ailleurs que dans `hours.js` (valeurs par défaut) et l'éditeur admin
   ("Horaires d'ouverture"). Le formulaire de réservation et les données Google en dépendent.
8. Supabase gratuit n'envoie que **2 e-mails par heure** (invitations, mot de passe oublié). Dans Authentication →
   URL Configuration, l'adresse du site et les redirections doivent correspondre au domaine actuel.
9. Éditeur JSON de la table Supabase : valeur > 10 240 caractères → cliquer "Load full value" ; **ne jamais
   appuyer sur Échap** ; vérifier dans l'onglet "View" que le JSON est valide avant d'enregistrer ; supprimer les
   guillemets/accolades en trop ajoutés automatiquement ; traduction Chrome désactivée. Préfère l'admin.
10. L'espace admin et l'outil SEO partagent les mêmes comptes (Supabase). Tous les comptes ont les mêmes
    droits (dont inviter et supprimer un autre admin ; pas soi-même, ni le dernier compte). Les mots de passe sont
    illisibles, par conception : on envoie un lien (rubrique Administrateurs → e-mail français via /api/admin/password-link).
    **Inscription libre désactivée dans Supabase le 25/11/2026** (« Allow new users to sign up » = off) : sinon n'importe
    qui pourrait se créer un compte et aurait tous les droits admin, car les API admin vérifient seulement la connexion.
    Ne jamais la réactiver. Les invitations depuis l'admin fonctionnent quand même.
11. Connexion sur plusieurs appareils (corrigé le 18/11/2026) : la déconnexion utilise `signOut({ scope: "local" })`
    (admin et `/app`) ; sans ce paramètre Supabase déconnecte **tous** les appareils du compte. Arrivée par un lien
    d'invitation ou « Mot de passe oublié » : l'admin impose l'écran « Choisissez votre mot de passe » avant d'entrer
    (drapeau `bb-admin-must-set-password` en sessionStorage). Changer de mot de passe déconnecte les autres appareils
    (règle de sécurité de Supabase) : ils redemandent une fois le nouveau mot de passe.

## Sécurité
- Aucun secret dans le dépôt, les commits ou le chat. Ne modifie pas les réglages d'authentification
  (Supabase Auth, mots de passe, clés) sans demander. Ne supprime pas de comptes ni de données sans accord.
- Le fichier `Acces-Admin-Bistro-Burger.pdf` (ignoré par git) contient des accès : à ne pas versionner.

## Retour arrière si quelque chose casse
- `git log --oneline` puis `git revert <commit>` (jamais de `push --force`), push, redéployer, vérifier `/healthz`.
- Besoin de masquer le site le temps de réparer : variable `MAINTENANCE_MODE=true` sur Hostinger, redéployer.
  `/admin`, `/seo`, `/app` et `/api` restent accessibles ; l'accès privé au vrai site se fait via `/preview/<PREVIEW_KEY>`.

## SEO
Articles de blog : toutes les URL `/blog/<slug>.html` utilisent le même modèle `pages/blog/article.html` (rempli en
JavaScript). Pour que Google le lise, **le serveur injecte** titre, description, canonique, données structurées et texte
de chaque article (`lib/blogSeo.js`, appelé par `server.js`) ; un article inconnu répond 404. Ne remets jamais une
canonique commune dans le modèle. Le serveur redirige aussi `www.` vers le domaine sans `www` et `/index.html` vers `/`.
Après un changement d'article, vérifier avec `curl https://bistroburgergardanne.com/blog/<slug>.html` (le `<title>`
doit être celui de l'article). Search Console : « Pages » montre ce que Google n'indexe pas et pourquoi.

Mot-clé principal de l'accueil : "restaurant à Gardanne" (titre, description, H1, premier paragraphe). Les articles
du blog suivent : H1, H2/H3, au moins 300–500 mots, mot-clé en gras dans le texte, liens internes au milieu
(pas de lien en fin d'article), aucune information inventée. Le logo contient encore "Brasserie & Burgers" :
incohérence connue avec le positionnement "restaurant".

## Vitesse (mesurée le 13/10/2026 : mobile 55 → 90 sur PageSpeed)
- **Images** : une image ajoutée doit faire au plus ~1100 px de large et ~150 Ko (JPEG qualité ~78 ou WebP). Les images sous
  la ligne de flottaison portent `loading="lazy"` ; l'image principale de l'accueil (`hero-burger.webp` + `hero-burger-800.webp`
  pour mobile) est préchargée dans le `<head>`. Ne pas remettre d'image de plusieurs centaines de Ko.
- **reCAPTCHA** : son script (~350 Ko) ne se charge que quand le formulaire approche de l'écran ou qu'on y touche (`script.js`).
- **Polices** : `<link>` + `preconnect` dans chaque page (pas de `@import` dans `styles.css`).
- **Maillage interne** : le serveur injecte les liens vers les articles dans l'accueil (`<!--BLOG_LATEST-->` dans
  `pages/index.html`) et dans la page blog (`lib/blogSeo.js`). Ne pas supprimer ce repère.

## Lisibilité par les IA et Google (ajouté le 15/10/2026)
- La FAQ et les avis de l'accueil sont dans `public/site-content.js` (source unique). **Modifier le texte là**, pas dans `script.js`.
- Le serveur (`lib/aiSeo.js`) écrit dans le code de l'accueil le plat du jour, la carte, la FAQ et les avis (les robots IA ne
  lancent pas JavaScript), plus le balisage FAQPage (réponses sans « à confirmer » uniquement). `/llms.txt` est généré avec
  les horaires et le plat du jour à jour. Ne pas déplacer les repères `pdj-*`, `burger-track`, `carte-groups`, `faq-list`, `reviews-grid`.
- Ne jamais écrire « à confirmer » dans un texte public : il est lu par les IA et recopié. Le serveur ignore automatiquement
  les prix, descriptions et notes de la carte qui contiennent « à confirmer » (accueil et `/carte`).
- Il n'y a **pas de page `/carte`** (retirée à la demande du restaurant le 16/10/2026) : la carte vit sur l'accueil (`#carte`).
  Le serveur redirige `/carte` vers `/`. Les liens « Carte sur place / à emporter » du menu sont de vrais liens `/#carte` ;
  sur l'accueil, `script.js` les garde fluides (changement d'onglet et défilement).
- Les horaires écrits dans les articles du blog sont à relire à la main : ils ne suivent pas l'éditeur d'horaires
  (corrigés le 16/10/2026 : plus de « samedi soir »).
- Les réponses FAQ « Où déjeuner à Gardanne ? » et « Servez-vous le petit-déjeuner ? » citent l'ouverture à 9h : les mettre à jour
  (public/site-content.js) si les horaires changent. Même chose pour la ligne « Services » de `lib/aiSeo.js` (llms.txt).
