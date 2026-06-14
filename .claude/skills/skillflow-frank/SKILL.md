---
name: skillflow-frank
description: Contexte projet et charte graphique de Skillflow / Frank — l'onboarding animé (soutenance 3e trimestre, 2e année webdesign) d'une application qui aide à trouver des Skills IA adaptés à son métier. La charte est extraite DIRECTEMENT de la page Figma « Proto final » (couleurs, polices, composants réels), à l'exclusion des pages de tests/recherches. Utilise ce skill DÈS QUE le travail touche ce projet : code HTML/CSS/JS de l'onboarding, écrans de Frank, micro-animations, couleurs, dégradés, lueurs (glow), surfaces glass, composants UI, copie/textes des écrans, ou direction artistique. Consulte-le même si « Skillflow » ou « Frank » ne sont pas cités, dès qu'il s'agit de l'onboarding des Skills IA, de la mascotte pieuvre, du feed personnalisé, ou de la DA violet sombre. Charge references/charte-graphique.md pour les recettes CSS exactes et references/parcours-onboarding.md pour le détail écran par écran.
---

# Skillflow / Frank — contexte projet et charte graphique

> Toutes les valeurs de design (couleurs, polices, composants) viennent de la page Figma **« Proto final »** du fichier `Ve1aiwPr0BzWgEZORQB68v`. Les autres pages (tests, recherches) sont à ignorer.

## Le projet en une page

**Skillflow** est le nom du projet d'école ; **Frank** est la marque et la mascotte affichées dans l'app (« Frank » dans l'UI et les textes, « Skillflow » pour parler du projet).

C'est une application (desktop, 1440×1024 dans le proto) qui sert de **place de marché de Skills pour IA**. Un Skill est un fichier qui apprend à une IA un savoir-faire précis. Selon le domaine de l'utilisateur, Frank propose les Skills adaptés, rapidement et sans terminal.

Le livrable de soutenance est **un onboarding animé** où **les micro-animations sont fonctionnelles** (orienter l'attention, clarifier les étapes, montrer les changements d'état, accompagner les interactions). Livrable codé HTML/CSS/JS + proto Figma.

Problématique : *« Comment un onboarding animé peut-il rendre le concept de "Skill IA" immédiatement compréhensible et suffisamment désirable pour convaincre l'utilisateur de s'engager ? »*

### Les 3 différenciateurs (un écran « Pourquoi Frank ? » les présente)
1. **Feed personnalisé** — « Construit dès l'inscription selon ton domaine + tes IA. Plus tu installes, plus c'est précis. »
2. **Installation en 1 clic** — « Pas de terminal, pas de fichier à copier. Frank s'occupe de tout. »
3. **Skills vérifiés** — « Chaque skill passe par 2 niveaux de vérification. Si quelque chose cloche, tu le vois avant d'installer. »

Choix de conception : **la création de compte arrive après la découverte de la valeur** (logique Duolingo/Notion).

## Frank, la mascotte

Une **pieuvre** violette au corps arrondi gélifié, éclairée d'un **halo de glow** (une ellipse floue derrière elle). Grands yeux noirs laqués cerclés de blanc avec point de reflet, petits tentacules. Dans les écrans, Frank apparaît souvent en **débordement de coin** (il dépasse derrière le contenu) et joue le **guide narrateur**.

Variantes de profil selon le domaine : dev (lunettes + ordi), UI/UX (ordi), Finance (yeux `$`), Marketing (mégaphone).

**Ton de voix** : tutoiement, chaleureux, direct, phrases courtes. Ex. réels : « Salut, moi c'est Frank. », « Un clic suffit. », « Plus tu en mets, plus ton feed est précis. ».

## Direction artistique — principes

Univers **mer / océan / profondeur** : fond très sombre bleu-noir, lumière violette diffuse, surfaces vitrées (glass), lueurs douces.

- **Profondeur** — fond `#0B091B` avec un vignettage interne et un glow violet diffus venant du bas + bords.
- **Lueur (glow)** — le violet `#5E51F1` émet de la lumière ; halos, lueurs de bord en `#ACA5F5`.
- **Glass & reflets** — surfaces translucides `rgba(255,255,255,.05)`, fine bordure claire, `backdrop-filter: blur(~6px)` ; les boutons ont un **éclat blanc flou en diagonale** (reflet de lumière).
- **Dégradés & ombres douces** — dégradés radiaux pour la lumière, ombres internes larges pour la profondeur. Pas d'aplats plats.

> **Carrés gris `#A3A3A3`** présents dans le proto = **placeholders, PAS la DA**. À remplacer par des surfaces glass + dégradé/glow. Ne jamais livrer le gris plat.

## Palette — variables CSS (extraites de Proto final)

```css
:root {
  /* Fond */
  --bg:            #0B091B; /* fond principal (rgb 11,9,27) */

  /* Violet de marque */
  --violet:        #5E51F1; /* SIGNATURE : bordure bouton principal, glow */
  --violet-bright: #7C72EB; /* dégradés clairs */
  --violet-soft:   #9A94E5; /* bordure bouton secondaire, dégradés */
  --violet-glow:   #ACA5F5; /* lueur de bord (inset light) */
  --violet-deep:   #4A40BE; /* dégradés sombres */
  --violet-deeper: #362F8B;

  /* Texte */
  --text:          #F6F6FF;            /* titres, boutons (blanc violacé) */
  --text-card:     #EDEDED;            /* texte dans les cartes */
  --text-muted:    rgba(246,246,255,.3); /* liens discrets ("Passer") */

  /* Surfaces glass */
  --glass-fill:    rgba(255,255,255,.05);
  --glass-border:  rgba(255,255,255,.10);

  /* Placeholder — NE PAS utiliser comme couleur de DA */
  --placeholder:   #A3A3A3;
}
```

Fichier prêt à copier (variables + fond océanique + classes glass/boutons + imports de polices) : **`assets/tokens.css`**.

## Typographie (polices réelles du Proto final)

- **Titres / display** : **Google Sans Flex**, Medium (ex. « Pourquoi Frank ? » 64px, letter-spacing ≈ -0.02em ; titres de carte 32px). C'est un **sans-serif géométrique**, pas un serif.
- **Sous-titres** : **Roboto Slab**, Regular (slab serif), 24px, tracking ≈ -0.03em.
- **Nom de marque « Frank »** : **Libre Baskerville** (serif), posé en inline partout où le mot *Frank* apparaît dans un texte.
- **Corps** : Google Sans Flex Medium, 20px.
- **Boutons / UI** : **Inter**, Medium, 24px, tracking ≈ -0.04em.

⚠️ **Google Sans Flex n'est pas libre de droit pour le web** (pas sur Google Fonts). Pour la version codée : soit l'auto-héberger si licence, soit le remplacer par une alternative proche (Plus Jakarta Sans, Geist, ou Inter). Roboto Slab, Libre Baskerville et Inter sont sur Google Fonts (libres). Libre Baskerville n'existe qu'en 400/700 (le « Medium » de Figma → utiliser 400 ou 700).

## Quand aller plus loin

- Recettes CSS exactes (fond, glow, glass, boutons avec éclat, cartes, chips, inputs, mascotte, typo, do/don't) → **`references/charte-graphique.md`**.
- Déroulé écran par écran (textes exacts + intention d'animation) → **`references/parcours-onboarding.md`**.
- Brief officiel → Google Doc `1690kdVi62nerW5aGV4ISkzEJJLXuF1b6iksqNmHpePk`.

## Règles de travail (préférences de Maël)

- Code en **HTML / CSS / JavaScript** vanilla + libs GSAP, Anime.js, Lottie, swiper.js. Propose du code dans cette stack.
- Travail **itératif** (reformuler des brouillons plutôt que partir de zéro).
- Texte **typographiquement propre** : pas d'emojis dans les libellés, pas de tirets longs dans les diagrammes, traits d'union simples.
- Sorties **directement utilisables**.
