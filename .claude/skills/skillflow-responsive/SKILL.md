---
name: skillflow-responsive
description: Adapte l'onboarding Skillflow du desktop vers le mobile et toutes les tailles d'écran intermédiaires, en gardant les animations GSAP (MotionPath de Frank), Lottie et Swiper fluides, propres et performantes. Utilise ce skill dès que Maël veut "rendre responsive", "adapter au mobile", "gérer les breakpoints", "passer ce screen en mobile", "corriger les animations sur petit écran", parle du "MotionPath qui casse", de "Frank qui se décale", de "ça déborde sur téléphone", ou pose une question sur matchMedia, le fluid type, clamp(), dvh ou safe-area dans le projet d'onboarding. Déclenche aussi pour toute passe d'adaptation multi-écrans, même si le mot "responsive" n'est pas dit explicitement.
---

# Skillflow — Responsive & animations multi-écrans

Ce skill sert à adapter l'onboarding **Skillflow** conçu en desktop vers le mobile, en couvrant proprement toutes les largeurs intermédiaires, **sans casser les animations**. Il est le complément technique du skill `skillflow-frank` (qui porte l'identité, la voix de Frank, la DA et les copies). Les couleurs et tokens viennent de `skillflow-frank/assets/tokens.css` — ne pas les redéfinir ici, juste les réutiliser.

## Le projet en deux lignes

Onboarding animé en 12 écrans (HTML/CSS/JS vanilla) pour une marketplace de Skills IA. La mascotte **Frank** (pieuvre violette) réagit aux actions de l'utilisateur à chaque étape. Stack d'animation : **GSAP + MotionPathPlugin** (déplacements de Frank), **Lottie** (expressions de Frank), **Anime.js** (micro-anims), **Swiper** (slider de features). Esthétique grand fond marin : noir profond, halos violets lumineux, surfaces gel brillantes, ombres douces superposées.

## Ce que le skill garantit (definition of done)

Un écran est "responsive" quand, de 320px à 1440px+ :

1. Rien ne déborde, rien ne se chevauche, tout reste lisible et touchable (cibles >= 44px).
2. Frank arrive **pile sur sa cible** (bouton, label, champ) à chaque largeur, sans décalage ni rotation aberrante.
3. Les animations restent fluides (60fps visé) et ne s'empilent pas quand on tourne le téléphone ou redimensionne.
4. L'esthétique fond marin tient : les halos et ombres scalent proportionnellement, ils ne deviennent ni minuscules ni énormes.
5. `prefers-reduced-motion` est respecté : Frank se pose sobrement, l'écran reste utilisable.

## Méthode : adapter un écran

Procéder écran par écran, jamais en bloc :

1. **Lire l'écran desktop** : repérer la "scène" (le conteneur qui porte Frank + son chemin), les cibles d'animation, et ce qui est en `position:absolute`.
2. **Décider du reflow** : la mise en page bascule-t-elle d'horizontal (desktop) à vertical (mobile) ? Si oui, le chemin de Frank doit changer, pas juste se réduire -> deux trajectoires distinctes via `matchMedia`. Sinon, une seule scène proportionnelle suffit.
3. **Passer le layout en fluide** (mobile-first) : `clamp()` pour le texte et les espacements, grilles flexibles, `dvh` + `safe-area`. Voir `references/css-responsive.md`.
4. **Refactor les animations dans `gsap.matchMedia()`** : c'est la colonne vertébrale. Voir `references/gsap-responsive.md`.
5. **Vérifier Frank aux largeurs de test** : 320, 360, 390, 768, 1024, 1280. Corriger le chemin, pas le décor.
6. **Passer la checklist** (plus bas) avant de considérer l'écran fini.

## Les principes non négociables (et pourquoi)

- **`gsap.matchMedia()` est obligatoire, pas optionnel.** Il crée les anims par breakpoint ET les détruit/nettoie automatiquement quand le media query ne matche plus. Sans lui, à chaque rotation ou resize tu empiles des timelines fantômes -> Frank tremble, saute, ou fuit en mémoire. C'est la cause n°1 des bugs "ça marche puis ça casse".
- **N'anime que `transform` et `opacity`.** Ce sont les seules propriétés que le GPU compose sans recalcul de layout. Animer `top/left/width/margin` provoque des reflows qui tuent les fps sur mobile. Pour positionner de façon relative à la taille de l'élément, utilise `xPercent` / `yPercent`.
- **Une scène proportionnelle plutôt que des coordonnées en dur.** Le chemin de Frank doit vivre dans un conteneur "scène" dont les proportions sont fixées (`aspect-ratio` ou unités relatives), pour que la géométrie du MotionPath reste cohérente à toutes les tailles. Détail dans la référence GSAP.
- **Mobile-first, peu de breakpoints, beaucoup de fluide.** Un seul point de bascule structurel (~768px) pour GSAP ; le reste est géré par `clamp()`/`min()`/`max()` qui couvrent en continu toutes les largeurs intermédiaires. On évite la chasse au pixel breakpoint par breakpoint.
- **`prefers-reduced-motion` toujours géré.** Accessibilité réelle + point bonus en soutenance. Dans le bloc `reduce` de matchMedia, on ne joue pas le MotionPath : on place Frank directement, on garde un fondu léger maximum.
- **Cohérence DA avant tout.** Les placeholders gris ne sont pas la DA. Les halos sont des `radial-gradient` dimensionnés en `%`/`vmax` (jamais en px fixes) pour scaler ; ombres superposées ; palette issue de `tokens.css`.

## Le problème dur : MotionPath responsive

Un MotionPath est défini en coordonnées absolues qui ne se reflowent pas seules. Trois stratégies, par ordre de préférence :

- **A — Chemin dans un SVG à `viewBox`** : le `<path>` scale uniformément avec son SVG, Frank s'y aligne. Idéal quand le layout ne change pas de structure entre tailles.
- **B — Deux chemins distincts par breakpoint** : sélectionnés dans `matchMedia`. À utiliser quand mobile = vertical et desktop = horizontal.
- **C — Chemin calculé au runtime** depuis la position réelle des éléments cibles, reconstruit sur resize debouncé. Pour les cas "Frank va du bouton A au label B".

Recettes complètes, code et pièges : **`references/gsap-responsive.md`**.

Squelette canonique à reproduire pour chaque écran animé :

```js
const mm = gsap.matchMedia();

mm.add({
  isDesktop: "(min-width: 768px)",
  isMobile:  "(max-width: 767px)",
  reduce:    "(prefers-reduced-motion: reduce)"
}, (ctx) => {
  const { isDesktop, reduce } = ctx.conditions;

  if (reduce) {                 // accessibilité : pas de vol de Frank
    gsap.set("#frank", { x: 0, y: 0 });
    return;
  }

  const tl = gsap.timeline({ paused: true });
  tl.to("#frank", {
    motionPath: {
      path:  isDesktop ? "#chemin-desktop" : "#chemin-mobile",
      align: isDesktop ? "#chemin-desktop" : "#chemin-mobile",
      alignOrigin: [0.5, 0.5],
      autoRotate: true
    },
    duration: 1.2, ease: "power2.inOut"
  });

  // on expose la timeline pour la navigation entre écrans
  screen.tl = tl;
  return () => tl.kill();        // nettoyage auto au changement de breakpoint
});
```

## Checklist avant soutenance (par écran)

- [ ] Testé à 320 / 360 / 390 / 768 / 1024 / 1280 px : pas de débordement, pas de chevauchement.
- [ ] Testé en rotation portrait <-> paysage : aucune anim fantôme, Frank ne tremble pas.
- [ ] Frank atterrit exactement sur sa cible à chaque largeur.
- [ ] Texte lisible (>= 16px effectif sur mobile), cibles tactiles >= 44px.
- [ ] `100dvh` (pas `100vh`) et `safe-area-inset` gérés (encoches iPhone).
- [ ] Halos/ombres scalent proportionnellement, DA fond marin préservée.
- [ ] `prefers-reduced-motion: reduce` testé : écran utilisable, Frank posé.
- [ ] Seules `transform`/`opacity` sont animées (vérifier au DevTools > Rendering > Paint flashing).

## Fichiers de référence

- `references/gsap-responsive.md` — matchMedia en profondeur, les 3 stratégies MotionPath avec code, gestion du resize, Lottie responsive, Swiper breakpoints, perf.
- `references/css-responsive.md` — stratégie de breakpoints, fluid type/spacing en `clamp()`, la "scène" en `aspect-ratio`, dvh + safe-area, préservation de la DA en responsive.
- `assets/responsive.css` — variables et helpers prêts à coller (breakpoints, échelle fluide, dvh, safe-area, bloc reduced-motion).
