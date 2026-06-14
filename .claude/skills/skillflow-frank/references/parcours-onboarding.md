# Parcours d'onboarding Frank — écran par écran (page Figma « Proto final »)

Format desktop 1440×1024, padding 32px, mise en page en colonne `space-between` (lien « Passer » en haut, contenu au centre, barre de boutons Retour/Suivant en bas). Tonalité : tutoiement, chaleureux, court (voix de Frank).

Pour chaque écran : rôle, textes, et **intention de micro-animation** (fonctionnelle : orienter l'attention, clarifier l'étape, montrer un état, accompagner l'interaction).

> Copie marquée « exact » = relevée directement dans Figma. Le reste suit le même flux et est à recaler si un écran a évolué.

---

## 1. Lancement / splash
- Gros plan sur Frank (yeux + haut des tentacules) sur fond lumineux.
- **Animation** : Frank apparaît (yeux qui s'ouvrent/clignent, léger squash & stretch, glow qui monte), puis transition vers la bienvenue.

## 2. Bienvenue
- Titre : « Salut, moi c'est *Frank*. » (*Frank* en Libre Baskerville)
- Sous-titre : « Tu passes des heures à configurer ton IA pour qu'elle bosse comme tu veux ? »
- Action : bouton principal « Commencer ».
- **Animation** : entrée de Frank (rebond doux), texte en cascade, glow du bouton qui respire.

## 3. Ce qu'est un Skill
- Titre : « Un clic suffit. »
- Texte : « Un Skill, c'est un fichier qui apprend à ton IA un savoir-faire précis. Frank en a des milliers, prêts à installer. »
- Zone « Cinématique : Frank branche un Skill » (placeholder gris → à produire en glass).
- Nav : « Retour » / « Suivant » ; lien « Passer ».
- **Animation** : la cinématique montre Frank qui « branche » un Skill — cœur pédagogique, le mouvement explique le concept.

## 4. Pourquoi Frank — les 3 différenciateurs (exact)
- Titre : « Pourquoi Frank ? » — sous-titre « Trois choses qui changent tout. »
- 3 cartes glass (440px), chacune : icône 32px, titre 32px, paragraphe 20px, zone média (placeholder gris) :
  1. **Feed personnalisé** — « Construit dès l'inscription selon ton domaine + tes IA. Plus tu installes, plus c'est précis. »
  2. **Installation en 1 clic** — « Pas de terminal, pas de fichier à copier. *Frank* s'occupe de tout. »
  3. **Skills vérifiés** — « Chaque skill passe par 2 niveaux de vérification. Si quelque chose cloche, tu le vois avant d'installer. »
- Frank déborde dans le coin supérieur droit, derrière les cartes.
- **Animation** : cartes en cascade (stagger), pictos animés à l'entrée.

## 5. Choix des IA
- Titre : « Quelles IA tu utilises ? » — « Choix multiple. On adaptera tes Skills à chacune. »
- Options (multi) : Claude, ChatGPT, Gemini, Mistral, Codex, Copilot, Loveable, Autre.
- **Décision** : au moins une sélection pour continuer.
- **Animation** : feedback de sélection sur chaque chip (bordure + glow violet, petit pop) ; « Suivant » s'active à la 1re sélection.

## 6. Domaine principal
- Titre : « Quelle est ta spécialité ? » — « Choisis ton domaine principal. »
- Options (unique) : Code, UI/UX, Marketing, Finance, Data, Autre.
- **Animation** : à la sélection, Frank peut adopter la variante de profil correspondante (personnalisation rendue visible).

## 7. Sous-domaine / précision
- Titre : « Plus précisément ? » — « Choix multiple plus tu en mets, plus ton feed est précis. »
- Groupes de chips : *Style visuel* (Brutalisme, Minimalisme, Glassmorphique, Skeumorphe) · *Type de produit* (Mobile app, Web app, Landing page, Dashboard, Home page, E-commerce) · *Expertise* (Design system, Prototypage, Wireframing, User research, Accessibilité) · *Outils* (Figma, Framer, Sketch, Penpot).
- Récap en chips sélectionnés en bas.
- **Animation** : chip sélectionnée → rejoint la zone « Sélectionnés », compteur de précision.

## 8. Transition vers le compte
- Titre : « On se présente. » — « Deux infos rapides. »

## 9. Prénom + email
- Champs : Prénom (« Ex : Annie »), Email (« Ex : annie.leroy@email.fr »).
- Case : « J'accepte les CGU et la politique de confidentialité. »
- **Décision** : email au format valide.
- **Animation** : validation en direct (couleur + glow du champ), Frank réagit au prénom.
- *Note* : une étape « code de confirmation » (boucle d'erreur si incorrect) peut s'intercaler ici.

## 10. Mot de passe
- Titre : « Créer ton mot de passe. » — « Il protège tes Skills et ton feed. »
- Champ + barre de force (« Fort ») + critères « 8 caractères min / 1 majuscule / 1 chiffre ou symbole ».
- **Animation** : remplissage de la barre (largeur + glow) en temps réel, critères qui se cochent.

## 11. Choix du plan
- Titre : « Choisis ton plan. » — « Sans engagement, annule quand tu veux. » + « 7 jours offerts ».
- Offres : Gratuite · **Pro 15 €/mois** (solo & freelances, « Le plus populaire ») · Expert 60 €/mois (équipes). Bouton « Choisir ».
- **Animation** : mise en avant du plan populaire (relief/glow), survol qui soulève la carte.

## 12. Feed personnalisé (arrivée dans l'app)
- Sidebar : marque « Frank » ; nav Feed personnalisé (actif), Explorer, Mes Skills, Paramètres ; profil bas (avatar Frank + « Annie · UI/UX DESIGNER »).
- En-tête : « Bienvenue — Salut Annie voici ton feed perso adapté à Claude + ChatGPT et UI/UX. »
- Filtres : chips UI/UX, Claude, ChatGPT, « + Filtres ».
- Grille de cartes de Skill (titre, note ★, installs, « + Installer »). Vignettes grises = placeholders → glass + dégradé.
- **Animation** : feed qui se compose à l'arrivée (cartes en cascade) ; l'install en 1 clic a un feedback marquant (la promesse produit doit se sentir).

---

## Logique de validation
Choix IA (≥ 1) · Domaine (1 requis) · Email (format valide) · Code de confirmation (correct, boucle sinon).

## Rappel brief
Chaque animation doit se justifier par une fonction : feedback d'état, guidage du regard, clarification d'étape, continuité entre écrans. Sinon, la retirer.
