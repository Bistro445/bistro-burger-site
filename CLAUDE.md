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
- `pages/` : **toutes les pages HTML publiques** (accueil, blog, CGV, confidentialité, mentions légales, 404).
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
Les articles du blog sont dans la clé `blog` ; leur texte est écrit en dur (une mention d'horaires dans un
article ne suit pas l'éditeur d'horaires : à relire à la main).

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
  Facultatives : `BREVO_*` (newsletter, pas encore reliée), `RESEND_*`, `GOOGLE_CSE_*`.
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
   newsletter. Pour les réactiver : supprimer le bloc concerné. La politique de confidentialité a été
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
    droits. Les mots de passe sont illisibles, par conception : on envoie un lien de réinitialisation.

## Sécurité
- Aucun secret dans le dépôt, les commits ou le chat. Ne modifie pas les réglages d'authentification
  (Supabase Auth, mots de passe, clés) sans demander. Ne supprime pas de comptes ni de données sans accord.
- Le fichier `Acces-Admin-Bistro-Burger.pdf` (ignoré par git) contient des accès : à ne pas versionner.

## Retour arrière si quelque chose casse
- `git log --oneline` puis `git revert <commit>` (jamais de `push --force`), push, redéployer, vérifier `/healthz`.
- Besoin de masquer le site le temps de réparer : variable `MAINTENANCE_MODE=true` sur Hostinger, redéployer.
  `/admin`, `/seo`, `/app` et `/api` restent accessibles ; l'accès privé au vrai site se fait via `/preview/<PREVIEW_KEY>`.

## SEO
Mot-clé principal de l'accueil : "restaurant à Gardanne" (titre, description, H1, premier paragraphe). Les articles
du blog suivent : H1, H2/H3, au moins 300–500 mots, mot-clé en gras dans le texte, liens internes au milieu
(pas de lien en fin d'article), aucune information inventée. Le logo contient encore "Brasserie & Burgers" :
incohérence connue avec le positionnement "restaurant".
