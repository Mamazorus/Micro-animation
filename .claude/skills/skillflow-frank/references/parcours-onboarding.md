# Parcours d'onboarding Frank — écran par écran

Le flux complet observé dans le prototype. Pour chaque écran : le rôle, les textes exacts, les composants, et l'**intention de micro-animation** (fonctionnelle, conforme au brief : orienter l'attention, clarifier l'étape, montrer un changement d'état, accompagner l'interaction).

Tonalité de toute la copie : tutoiement, chaleureux, court (voix de Frank).

---

## 1. Lancement / splash
- **Rôle** : entrée dans l'univers, présence de Frank avant même le texte.
- **Visuel** : gros plan sur Frank (on voit surtout les yeux et le haut des tentacules) sur fond violet lumineux.
- **Animation** : Frank « apparaît » — yeux qui s'ouvrent / clignent, léger squash & stretch, lueur qui monte. Transition fluide vers l'écran de bienvenue.

## 2. Bienvenue
- **Titre (serif)** : « Salut, moi c'est *Frank*. »
- **Sous-titre** : « Tu passes des heures à configurer ton IA pour qu'elle bosse comme tu veux ? »
- **Action** : bouton primaire « Commencer ».
- **Animation** : Frank entre en scène (rebond doux), le texte arrive en cascade. Le bouton attire l'œil par un léger glow qui respire.

## 3. Ce qu'est un Skill
- **Titre** : « Un clic suffit. »
- **Texte** : « Un Skill, c'est un fichier qui apprend à ton IA un savoir-faire précis. Frank en a des milliers, prêts à installer. »
- **Visuel** : zone « Cinématique : Frank branche un Skill » (placeholder — à produire ; surface en `.glass`, pas en gris plat).
- **Nav** : « Retour » / « Suivant » (primaire) ; lien « Passer » en haut.
- **Animation** : la cinématique montre concrètement Frank qui « branche » un Skill — c'est le cœur pédagogique. Le mouvement explique le concept abstrait.

## 4. Pourquoi Frank — les 3 différenciateurs
- **Titre** : « Pourquoi Frank ? » — sous-titre « Trois choses qui changent tout. »
- **Cartes** :
  1. **Feed personnalisé** — « Construit dès l'inscription selon ton domaine + tes IA. Plus tu installes, plus c'est précis. »
  2. **Installation en 1 clic** — « Pas de terminal, pas de fichier à copier. Frank s'occupe de tout. »
  3. **Skills vérifiés** — « Chaque skill passe par 2 niveaux de vérification. Si quelque chose cloche, tu le vois avant d'installer. »
- **Animation** : les cartes apparaissent l'une après l'autre (stagger), chaque picto s'anime à l'entrée. Slider de 3 slides (swiper.js possible).

## 5. Choix des IA
- **Titre** : « Quelles IA tu utilises ? » — sous-titre « Choix multiple. On adaptera tes Skills à chacune. »
- **Options (multi-sélection)** : Claude, ChatGPT, Gemini, Mistral, Codex, Copilot, Loveable, Autre.
- **Décision** : au moins une IA sélectionnée pour continuer (sinon boucle d'erreur sur l'étape).
- **Animation** : feedback de sélection sur chaque chip (liseré + glow violet, petit pop). Le bouton « Suivant » s'active quand une option est cochée.

## 6. Domaine principal
- **Titre** : « Quelle est ta spécialité ? » — sous-titre « Choisis ton domaine principal. »
- **Options (sélection unique)** : Code, UI/UX, Marketing, Finance, Data, Autre.
- **Lien produit** : le domaine choisi détermine la variante de Frank (dev, ui/ux, finance, marketing…) et amorce le feed.
- **Animation** : à la sélection, Frank peut adopter la variante correspondante (transformation = personnalisation rendue visible).

## 7. Sous-domaine / précision
- **Titre** : « Plus précisément ? » — sous-titre « Choix multiple plus tu en mets, plus ton feed est précis. »
- **Groupes de chips** :
  - *Style visuel* : Brutalisme, Minimalisme, Glassmorphique, Skeumorphe
  - *Type de produit* : Mobile app, Web app, Landing page, Dashboard, Home page, E-commerce
  - *Expertise* : Design system, Prototypage, Wireframing, User research, Accessibilité
  - *Outils* : Figma, Framer, Sketch, Penpot
- **Sélection** : récapitulée en chips en bas (ex : Glassmorphique, Mobile app, Figma).
- **Animation** : chip sélectionnée → vole vers la zone « Sélectionnés » ; compteur/feedback « plus tu en mets, plus c'est précis ».

## 8. Transition vers le compte
- **Titre** : « On se présente. » — sous-titre « Deux infos rapides. »
- **Rôle** : amorce douce avant de demander des infos (le compte arrive après la valeur).

## 9. Prénom + email
- **Champs** : Prénom (placeholder « Ex : Annie »), Email (placeholder « Ex : annie.leroy@email.fr »).
- **Consentement** : case « J'accepte les CGU et la politique de confidentialité. »
- **Décision** : format d'email validé (sinon erreur sur le champ).
- **Action** : « Suivant ».
- **Animation** : validation en direct (champ qui passe en état valide/erreur via couleur + glow), Frank peut réagir au prénom saisi.

> Note : une étape de **code de confirmation** est prévue dans la logique (validation du code, boucle d'erreur si incorrect). Elle peut s'intercaler ici selon la version.

## 10. Mot de passe
- **Titre** : « Créer ton mot de passe. » — sous-titre « Il protège tes Skills et ton feed. »
- **Composant** : champ + barre de force (« Fort ») + critères « 8 caractères min / 1 majuscule / 1 chiffre ou symbole ».
- **Animation** : la barre de force se remplit (largeur + glow) en temps réel, les critères se cochent un à un.

## 11. Choix du plan
- **Titre** : « Choisis ton plan. » — « Sans engagement, annule quand tu veux. » + « 7 jours offerts ».
- **Offres** : Gratuite (ce que Frank peut faire), **Pro 15 €/mois** (solo & freelances, « Le plus populaire »), Expert 60 €/mois (équipes). Bouton « Choisir ».
- **Animation** : mise en avant du plan populaire (léger relief/glow), survol qui soulève la carte (profondeur).

## 12. Feed personnalisé (arrivée dans l'app)
- **Sidebar** : marque « Frank » (serif) ; nav « Feed personnalisé » (actif), « Explorer », « Mes Skills », « Paramètres » ; profil utilisateur en bas (avatar Frank + « Annie · UI/UX DESIGNER »).
- **En-tête** : « Bienvenue — Salut Annie voici ton feed perso adapté à Claude + ChatGPT et UI/UX. »
- **Filtres** : chips UI/UX, Claude, ChatGPT, « + Filtres ».
- **Contenu** : grille de cartes de Skill (titre, note ★, nombre d'installs, bouton « + Installer »). Les vignettes grises du proto sont des placeholders → passer en `.glass` + dégradé/glow.
- **Animation** : le feed se compose à l'arrivée (cartes en cascade) ; l'install en 1 clic a un feedback marquant (le bouton « + Installer » confirme l'action, petit succès animé) — c'est la promesse produit, elle doit se sentir.

---

## Logique de validation (nœuds de décision)
- Choix IA : au moins une sélection, sinon retour à l'étape.
- Domaine : une sélection requise.
- Email : format valide requis.
- Code de confirmation : code correct requis (boucle d'erreur sinon).

## Rappel brief
Les micro-animations doivent **orienter l'attention, clarifier les étapes, montrer les changements d'état, accompagner les interactions**. Chaque animation ci-dessus doit pouvoir se justifier par l'une de ces fonctions — sinon la retirer.
