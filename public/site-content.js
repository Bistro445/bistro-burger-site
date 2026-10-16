// Contenu éditorial partagé : la FAQ et les avis Google affichés sur l'accueil.
// Lu par le navigateur (script.js) ET par le serveur (lib/aiSeo.js), pour que Google et les
// IA lisent les mêmes réponses que les visiteurs. Modifier le texte ICI (une seule source).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.BBContent = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const reviews = [
    { initials: "EC", name: "Eleonore C.", meta: "Avis Google · 5/5", text: "Tout était nickel. Service agréable et serviable, nourriture super, prix corrects et une déco douce." },
    { initials: "AB", name: "Arno BRS", meta: "Avis Google · 5/5", text: "En passant par là, un arrêt déjeuner et une belle surprise : cuisine très bonne et copieuse, service rapide et souriant." },
    { initials: "YG", name: "Yannick Gonzalez", meta: "Avis Google · 5/5", text: "Une équipe super agréable, on mange super bien, les burgers sont top. On y passe un bon moment en famille ou entre amis." },
    { initials: "JK", name: "Les jardins de Kerellec", meta: "Avis Google · 5/5", text: "Accueil au top, cuisine maîtrisée et avec du goût au rendez-vous. Nous recommandons vivement." },
    { initials: "CO", name: "Corinne", meta: "Avis Google · 5/5", text: "Une belle décoration, un accueil chaleureux et un service de qualité. Les burgers sont vraiment excellents." },
    { initials: "SG", name: "Sandrine G.", meta: "Avis Google · 5/5", text: "Plat du jour et burger, tout était excellent : cuisiné avec des produits frais, et ça se sent. Le personnel est souriant." }
  ];

  const faq = [
    // Réponses reprises de la fiche Google (octobre 2026). Elles citent l'ouverture à 9h : à mettre à jour si les horaires changent.
    { q: "Où se trouve le restaurant ?", a: "Bistro Burger est dans la ZAC Avon à Gardanne (Bretelle de la Plaine, 13120), entre Aix-en-Provence et Marseille. Un parking gratuit se trouve devant le restaurant." },
    { q: "Où déjeuner à Gardanne ?", a: "Au Bistro Burger, dans la ZAC Avon : un plat du jour différent du lundi au vendredi, des burgers faits maison, un service rapide et un parking gratuit devant la porte. Le restaurant est ouvert du lundi au vendredi, dès 9h." },
    { q: "Servez-vous le petit-déjeuner ?", a: "Oui. Le restaurant ouvre dès 9h du lundi au vendredi : petit-déjeuner le matin, puis déjeuner. Le dîner est servi du mardi au vendredi, en soirée." },
    { q: "Proposez-vous un service traiteur ?", a: "Oui. Nous préparons des plats faits maison à emporter pour vos repas d'entreprise, réunions, séminaires et événements. Appelez-nous au 04 65 84 89 18 pour en parler." },
    { q: "Proposez-vous des options végétariennes ?", a: "Oui. Le Jardinier est disponible toute l'année, et un burger végétarien du moment change chaque mois. Nos frites sont cuites dans un bain séparé." },
    { q: "Quels sont les allergènes présents dans vos burgers ?", a: "La présence d'allergènes dépend de la composition de chaque burger, de son pain, de ses sauces et de certains produits utilisés dans sa préparation. Les principaux allergènes identifiés dans notre carte peuvent notamment inclure le gluten, le lait, l'œuf, le poisson, la moutarde et les mollusques. Pour connaître précisément les allergènes d'un burger, demandez confirmation à notre équipe avant de commander. Si vous avez une allergie ou une intolérance alimentaire, signalez-la impérativement au personnel." },
    /* À REPUBLIER quand le restaurant aura confirmé les allergènes (ce détail contient des « À confirmer », donc non publié) :
    { q: "Quel est le détail des allergènes par burger ?", a: "Classique — Identifiés : gluten, lait. À confirmer : composition du bun's, sauce origan.\n\nSmash — Identifiés : gluten, lait. À confirmer : composition du bun's, smashed sauce, cornichons.\n\nBlack Peppers — Identifiés : gluten, lait. À confirmer : composition du bun's, oignons frits, sauce au poivre, lard fumé.\n\nCow-Boy — Identifiés : gluten, lait. À confirmer : œuf et/ou moutarde possibles selon les tenders et le coleslaw, composition du bun's.\n\nFisher — Identifiés : gluten, poisson, lait. À confirmer : œuf et/ou moutarde possibles dans la panure et la sauce tartare, composition du bun's.\n\nPull-Pork — Identifiés : gluten, lait. À confirmer : allergènes de la bière et de la sauce barbecue, œuf et/ou moutarde possibles dans le coleslaw, composition du bun's.\n\nPull-Beef — Identifiés : gluten, lait. À confirmer : allergènes éventuels de la préparation bourguignonne, composition du bun's.\n\nPull-Duck — Identifiés : gluten, moutarde. À confirmer : composition exacte de la sauce moutarde miel, éventuels lait/œuf selon la recette, composition du bun's.\n\nLe Poulpe — Identifiés : gluten, mollusques, œuf, lait. À confirmer : composition exacte du pain, sauce mayo sriracha, éventuels autres allergènes de la sauce.\n\nLe Cam — Identifiés : gluten, lait. À confirmer : œuf possible dans la panure, composition de la smashed sauce, composition du bun's.\n\nLe Big BB — Identifiés : gluten, lait. À confirmer : œuf possible dans la panure, composition de la sauce enfant, composition du bun's." },
    */
    { q: "Quels sont vos horaires ?", a: "Le lundi, de 9h00 à 14h00. Du mardi au vendredi, de 9h00 à 14h00 et de 17h30 à 21h30. Nous sommes fermés le samedi et le dimanche." },
    { q: "Faut-il réserver ?", a: "Ce n'est pas obligatoire, mais c'est plus sûr le vendredi soir. Pour les groupes de plus de dix personnes, appelez-nous au 04 65 84 89 18." },
    { q: "Livrez-vous à domicile ?", a: "Oui, de deux façons : vous pouvez commander sur Uber Eats, ou nous appeler au 04 65 84 89 18 pour une livraison assurée par notre équipe, sur Gardanne et les communes limitrophes." },
    { q: "Y a-t-il un parking ?", a: "Un parking gratuit se trouve directement devant le restaurant, dans la ZAC Avon. Aucun horodateur, aucune limite de durée." }
  ];

  return { reviews: reviews, faq: faq };
});
