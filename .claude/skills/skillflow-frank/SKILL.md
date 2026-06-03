---
name: skillflow-frank
description: Contexte projet et charte graphique de Skillflow / Frank — l'onboarding animé (soutenance 3e trimestre, 2e année webdesign) d'une application qui aide à trouver des Skills IA adaptés à son métier. Utilise ce skill DÈS QUE le travail touche ce projet : code HTML/CSS/JS de l'onboarding, écrans de Frank, micro-animations, choix de couleurs, dégradés, lueurs (glow), ombres, reflets, composants UI, copie/textes des écrans, ou toute question de direction artistique (profondeur océanique, violet lumineux, mascotte pieuvre Frank). Consulte-le même si les mots « Skillflow » ou « Frank » ne sont pas cités, dès qu'il s'agit de l'onboarding des Skills IA, de la mascotte pieuvre, du feed personnalisé, ou de la DA violet sombre façon océan/eau. Charge references/charte-graphique.md pour les recettes CSS détaillées et references/parcours-onboarding.md pour le détail écran par écran.
---

# Skillflow / Frank — contexte projet et charte graphique

## Le projet en une page

**Skillflow** est le nom du projet d'école ; **Frank** est la marque et la mascotte de l'application telle qu'elle apparaît à l'écran (utilise « Frank » dans l'UI et les textes, « Skillflow » pour parler du projet).

C'est une application (mobile/desktop) qui sert de **place de marché de Skills pour IA**. Un Skill est un fichier (type `SKILL.md`) qui apprend à une IA un savoir-faire précis. Selon le domaine de l'utilisateur, Frank propose les Skills adaptés à son besoin, rapidement et sans terminal.

Le livrable de soutenance est **un onboarding animé** : pas une intro décorative, mais une vraie entrée dans l'usage où **les micro-animations sont fonctionnelles** (orienter l'attention, clarifier les étapes, montrer les changements d'état, accompagner les interactions). Soutenance : mardi 16 juin, livrable codé (HTML/CSS/JS, lien public type GitHub Pages ou Netlify) + proto Figma/vidéo.

La problématique retenue : *« Comment un onboarding animé peut-il rendre le concept de "Skill IA" immédiatement compréhensible et suffisamment désirable pour convaincre l'utilisateur de s'engager ? »*

### Les 3 différenciateurs (chacun a son écran)
1. **Feed personnalisé** — construit dès l'inscription selon le domaine + les IA utilisées. Plus on installe, plus c'est précis.
2. **Installation en 1 clic** — pas de terminal, pas de fichier à copier, Frank s'occupe de tout (extension navigateur / app desktop).
3. **Skills vérifiés** — 2 niveaux de vérification (analyse automatique + badge attribué manuellement) ; l'utilisateur voit le statut avant d'installer.

Choix de conception clé : **la création de compte arrive après la découverte de la valeur** (logique Duolingo/Notion). On comprend le produit avant de s'engager.

Concurrents de référence : skills.sh, SkillsMP, LobeHub, ClawHub.

## Frank, la mascotte

Une **pieuvre** violette au corps arrondi, gélifié, éclairé de l'intérieur (effet lueur). Grands yeux noirs brillants cerclés de blanc avec un point de reflet, plusieurs petits tentacules. Frank est **le guide narrateur** de tout l'onboarding.

Frank existe en **variantes de profil** selon le métier choisi : Profil dev (lunettes + ordi portable), Profil UI/UX (ordi portable), Profil Finance (yeux en `$`), Profil Marketing (mégaphone). Ces variantes servent l'animation et la personnalisation (Frank « devient » le profil de l'utilisateur).

**Ton de voix de Frank** : tutoiement, chaleureux, direct, rassurant, phrases courtes. Exemples réels : « Salut, moi c'est Frank. », « Tu passes des heures à configurer ton IA pour qu'elle bosse comme tu veux ? », « Un clic suffit. », « Plus tu en mets, plus ton feed est précis. ». Garde ce ton pour toute nouvelle copie.

## Direction artistique — principes

L'univers évoque **la mer / l'océan / l'eau** : profondeur, matière qui capte la lumière, lueurs diffuses sous l'eau. Quatre piliers, à appliquer partout :

- **Profondeur** — fonds sombres très profonds (bleu-noir abyssal), surfaces qui se détachent par la lumière et l'ombre, pas par des bords nets.
- **Lueur (glow)** — le violet émet de la lumière. Halos diffus, points lumineux, glow porté sur la mascotte et les éléments actifs.
- **Reflets & matière** — surfaces gélifiées/vitrées : highlight en haut, légère transparence, sensation d'objet 3D mouillé.
- **Dégradés & ombres douces** — jamais d'aplats plats là où on peut suggérer le volume. Dégradés radiaux pour la lumière, ombres portées larges et douces pour le poids.

> **Important sur le proto actuel** : les **carrés gris plats** (vignettes de Skills, placeholder « cinématique », tuile vide) ne font **pas** partie de la DA — ce sont des placeholders. La cible est de les remplacer par des surfaces avec **dégradé, reflet, ombre et profondeur**. Ne reproduis pas le gris plat : applique les recettes de `references/charte-graphique.md`.

## Palette — variables CSS (l'essentiel)

Échantillonnées directement sur les visuels du projet. Détail des usages dans `references/charte-graphique.md`.

```css
:root {
  /* Fonds — profondeur océanique */
  --bg-abyss:    #07060E; /* le plus sombre, bords / vignettage */
  --bg-deep:     #0B0820; /* fond principal navy */
  --bg-sheet:    #0E0E11; /* écrans (near-black neutre) */
  --bg-surface:  #14121F; /* cartes / surfaces surélevées sur sombre */

  /* Violet de marque — la lueur */
  --violet-deep:   #4F46C9; /* ombre / base de dégradé */
  --violet:        #6B5FEE; /* couleur signature (corps de Frank) */
  --violet-bright: #7D74EB; /* reflets / highlight */
  --violet-glow:   #8B82F2; /* halo lumineux */

  /* Texte */
  --text:        #FFFFFF;
  --text-muted:  #A9A8B8;

  /* Mascotte — yeux */
  --eye-black:   #050505;
  --eye-rim:     #F4F4F6;
}
```

Un fichier prêt à copier (variables + classes utilitaires `.glow`, `.glass`, fond océanique) est fourni dans **`assets/tokens.css`**.

## Typographie

- **Titres / display** : un **serif élégant à fort contraste** (utilisé pour « Salut, moi c'est Frank. », « Un clic suffit. », le wordmark « Frank »). Candidats libres proches si la police réelle n'est pas dispo : Instrument Serif, Fraunces, Playfair Display. *À confirmer avec le fichier Figma.*
- **Corps / UI** : un **sans-serif grotesque neutre** (libellés, boutons, paragraphes). Candidats : Inter, Geist, Manrope.
- Pairing : serif pour l'émotion et l'accroche, sans-serif pour l'action et la lecture.

## Quand aller plus loin

- Recettes CSS complètes (dégradés, glow, glass, ombres, boutons, chips, inputs, mascotte, icônes, do/don't) → lis **`references/charte-graphique.md`**.
- Déroulé écran par écran (12 écrans, textes exacts, intention de micro-animation de chaque écran) → lis **`references/parcours-onboarding.md`**.
- Brief officiel complet → Google Doc `1690kdVi62nerW5aGV4ISkzEJJLXuF1b6iksqNmHpePk`.

## Règles de travail (préférences de Maël)

- Maël **code en HTML / Tailwind CSS / JavaScript** (vanilla, et libs type GSAP, Anime.js, Lottie, swiper.js). Propose du code dans cette stack par défaut. Utilise **Tailwind CSS v4** via CDN (`<script src="https://cdn.tailwindcss.com"></script>`) ou via le plugin Vite selon le contexte. Styles en classes utilitaires en priorité. Pour les valeurs custom très spécifiques au projet (box-shadow glow complexe, dégradés radiaux, animations GSAP), utilise des propriétés CSS inline ou un bloc `<style>` dédié minimal — pas de fichier `.css` séparé sauf si le projet l'exige déjà. Configure la palette Frank dans `tailwind.config` ou via `@theme` (Tailwind v4) : `frank-deep: #0B0820`, `frank-violet: #6B5FEE`, `frank-glow: #8B82F2`, etc.
- Travail **itératif** : il partage des brouillons à reformuler plutôt que de générer de zéro.
- Texte **typographiquement propre** : pas d'emojis dans les libellés/diagrammes, pas de tirets longs (« — ») dans les nœuds de diagramme (formulation fluide à la place), traits d'union plutôt que points médians.
- Sorties **directement utilisables** (collables dans FigJam, prêtes pour la présentation) plutôt que de la doc de référence.
