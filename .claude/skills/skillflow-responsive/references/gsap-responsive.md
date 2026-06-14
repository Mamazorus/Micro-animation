# GSAP responsive — MotionPath, Lottie, Swiper, perf

Référence technique pour rendre les animations de Skillflow fluides de 320px à 1440px+.

## Sommaire

1. matchMedia : la colonne vertébrale
2. MotionPath responsive — les 3 stratégies
3. Gérer le resize en cours de vie
4. Faire atterrir Frank pile sur sa cible
5. Lottie en responsive
6. Swiper (slider de features)
7. Règles de performance

---

## 1. matchMedia : la colonne vertébrale

`gsap.matchMedia()` (GSAP 3.11+) crée des animations conditionnées à un media query et les **révoque automatiquement** dès que la condition n'est plus vraie. C'est ce qui empêche les timelines de s'empiler quand on redimensionne ou qu'on tourne le téléphone.

```js
gsap.registerPlugin(MotionPathPlugin);

const mm = gsap.matchMedia();

mm.add({
  isDesktop: "(min-width: 768px)",
  isMobile:  "(max-width: 767px)",
  reduce:    "(prefers-reduced-motion: reduce)"
}, (ctx) => {
  const { isDesktop, isMobile, reduce } = ctx.conditions;

  // ... créer ici TOUTES les timelines de l'écran ...
  // Toute anim créée dans cette fonction est tuée automatiquement
  // quand le breakpoint change. La fonction de retour permet un
  // nettoyage supplémentaire (listeners, instances Lottie, etc.).

  return () => {
    // cleanup manuel si besoin
  };
});
```

Pourquoi c'est non négociable : sans matchMedia, un `gsap.to()` créé au chargement reste vivant. Quand l'utilisateur tourne son téléphone, le layout change mais l'ancienne timeline garde les anciennes coordonnées -> Frank se téléporte ou tremble. matchMedia repart d'une feuille blanche à chaque bascule.

Astuce : construire les timelines via une fabrique appelée dans matchMedia, pour ne pas dupliquer la logique.

```js
function buildScreen(screenEl, conditions) {
  const tl = gsap.timeline({ paused: true });
  // ... ajoute les tweens selon conditions.isDesktop / isMobile ...
  return tl;
}

mm.add({ isDesktop: "(min-width:768px)", isMobile: "(max-width:767px)" }, (ctx) => {
  const timelines = [...document.querySelectorAll(".screen")]
    .map(el => [el, buildScreen(el, ctx.conditions)]);
  // navigation : timelines.find(...)[1].play()
});
```

---

## 2. MotionPath responsive — les 3 stratégies

Le coeur du problème : un chemin est défini en coordonnées absolues (unités SVG ou pixels). Quand le layout change, le chemin ne suit pas. Choisir selon le cas.

### Stratégie A — Chemin dans un SVG à viewBox (préférée)

Le `<path>` vit dans un SVG avec `viewBox`. Le viewBox scale uniformément avec le conteneur -> le chemin scale avec lui. Frank (élément HTML) s'aligne dessus.

```html
<div class="scene">
  <svg class="scene__path" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet">
    <path id="chemin-desktop" d="M40,260 C120,40 280,40 360,260" fill="none"/>
  </svg>
  <div id="frank"><!-- Lottie ou img --></div>
</div>
```

```js
tl.to("#frank", {
  motionPath: {
    path: "#chemin-desktop",
    align: "#chemin-desktop",     // aligne Frank sur la position réelle du path
    alignOrigin: [0.5, 0.5],       // c'est le centre de Frank qui suit le path
    autoRotate: true
  },
  duration: 1.2, ease: "power2.inOut"
});
```

Comme l'animation est déclenchée au tap (et non scrubbée en continu), GSAP relit la géométrie du path au moment du `play()` : Frank prend toujours la bonne échelle courante. C'est la raison pour laquelle un onboarding pas-à-pas est plus tolérant qu'un scroll-scrub.

`.scene` doit avoir un `aspect-ratio` fixe (voir css-responsive.md) pour que le path garde ses proportions.

### Stratégie B — Deux chemins distincts par breakpoint

Quand le layout passe d'horizontal (desktop) à vertical (mobile), un même chemin n'a plus de sens. On déclare deux `<path>` et on choisit dans matchMedia.

```html
<svg class="scene__path" viewBox="0 0 400 300">
  <path id="chemin-desktop" d="M40,260 C120,40 280,40 360,260" fill="none"/>
  <path id="chemin-mobile"  d="M200,40 C60,140 340,160 200,260" fill="none"/>
</svg>
```

```js
mm.add({ isDesktop:"(min-width:768px)", isMobile:"(max-width:767px)" }, (ctx) => {
  const id = ctx.conditions.isDesktop ? "#chemin-desktop" : "#chemin-mobile";
  const tl = gsap.timeline({ paused:true });
  tl.to("#frank", { motionPath:{ path:id, align:id, alignOrigin:[.5,.5], autoRotate:true }, duration:1.2 });
  return () => tl.kill();
});
```

### Stratégie C — Chemin calculé au runtime

Pour "Frank vole du bouton A vers le label B" où les positions dépendent du contenu. On mesure les centres relatifs à la scène et on génère un tableau de points. Frank doit être en `position:absolute` dans `.scene` (qui est son offset parent).

```js
// Renvoie des points en px relatifs au coin haut-gauche de la scène
function pointsBetween(fromEl, toEl, sceneEl) {
  const s = sceneEl.getBoundingClientRect();
  const center = el => {
    const b = el.getBoundingClientRect();
    return { x: b.left - s.left + b.width / 2, y: b.top - s.top + b.height / 2 };
  };
  const a = center(fromEl), b = center(toEl);
  return [a, { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - 80 }, b]; // arc
}

function flyFrank(fromEl, toEl, sceneEl) {
  return gsap.to("#frank", {
    motionPath: { path: pointsBetween(fromEl, toEl, sceneEl), curviness: 1.2, autoRotate: true },
    duration: 1, ease: "power2.inOut"
  });
}
```

Comme les points sont recalculés à chaque appel, l'animation est juste à toutes les tailles. Reconstruire si l'écran est rejoué après un resize.

---

## 3. Gérer le resize en cours de vie

Pour des anims déclenchées au tap (cas Skillflow), le plus simple et le plus robuste est **rebuild-on-trigger** : chaque `play()` reconstruit ou relit la géométrie courante. Pas de timeline persistante à invalider.

Si une timeline doit survivre et rester juste après un resize sans changer de breakpoint :

```js
let raf;
window.addEventListener("resize", () => {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => {
    tl.invalidate();   // GSAP recalcule les valeurs de départ/arrivée au prochain play
  });
});
```

`invalidate()` purge les valeurs enregistrées ; `matchMedia` gère déjà le changement de breakpoint. Toujours débouncer le resize (un `requestAnimationFrame` suffit) pour ne pas spammer.

---

## 4. Faire atterrir Frank pile sur sa cible

Si Frank doit finir exactement sur un élément (un bouton, un champ), ne pas coder la position d'arrivée en dur. Utiliser les helpers MotionPath qui convertissent entre repères :

```js
// position d'un élément exprimée dans le repère de Frank
const p = MotionPathPlugin.getRelativePosition(
  frankEl,         // depuis le repère de Frank
  targetEl,        // vers la cible
  [0.5, 0.5],      // origine sur Frank (centre)
  [0.5, 0.5]       // origine sur la cible (centre)
);
gsap.to(frankEl, { x: `+=${p.x}`, y: `+=${p.y}`, duration: 0.8 });
```

Recalculé à l'exécution, donc juste quelle que soit la largeur.

---

## 5. Lottie en responsive

- **Dimensionner le conteneur en CSS** (`%`, `aspect-ratio`), pas l'animation Lottie elle-même. Le renderer `svg` reste net à toute taille ; sur mobile bas de gamme, `canvas` est plus léger.
- **Appeler `anim.resize()`** sur resize debouncé si le conteneur change de taille, pour réaligner le rendu.
- **Ne jouer que le Lottie de l'écran actif.** Mettre les autres en pause (`anim.pause()`) : des Lottie qui tournent hors écran consomment du CPU pour rien.
- **Synchro GSAP <-> Lottie** : soit play/stop à l'entrée d'écran, soit piloter la frame depuis GSAP pour scrubber :

```js
const frank = lottie.loadAnimation({ container, renderer:"svg", autoplay:false, path:"frank.json" });
frank.addEventListener("DOMLoaded", () => {
  gsap.to({ f: 0 }, {
    f: frank.totalFrames - 1, duration: 1.2, ease: "none",
    onUpdate() { frank.goToAndStop(this.targets()[0].f, true); }
  });
});
```

---

## 6. Swiper (slider de features)

- Utiliser la config **`breakpoints`** de Swiper pour `slidesPerView` selon la largeur — Swiper gère ça nativement, ne pas le réinventer en GSAP.
- Après un changement de layout, appeler `swiper.update()` (et `slideTo` si besoin de recaler).
- **Répartition des rôles** : laisser Swiper gérer la translation des slides ; GSAP/Anime.js gèrent les micro-anims *à l'intérieur* d'une slide. Ne pas animer le même translate des deux côtés, ça se combat.
- Hooker les micro-anims sur les events Swiper :

```js
swiper.on("slideChangeTransitionStart", () => {
  const active = swiper.slides[swiper.activeIndex];
  gsap.fromTo(active.querySelectorAll("[data-anim]"),
    { y: 16, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.06, duration: 0.4 });
});
```

---

## 7. Règles de performance

- **Uniquement `transform` et `opacity`.** Vérifier dans DevTools > Rendering > "Paint flashing" qu'aucun repaint de layout ne se déclenche pendant les anims.
- **`will-change: transform`** seulement pendant l'animation, retiré après (sinon coût mémoire permanent). GSAP gère déjà `force3D` par défaut.
- **Débouncer le resize** (rAF ou ~150ms). Jamais de `setInterval` pour de l'anim : GSAP utilise déjà le ticker rAF.
- **Initialiser paresseusement** la timeline de chaque écran et la tuer à la sortie d'écran, pour ne pas garder 12 timelines vivantes.
- **`prefers-reduced-motion`** : dans le bloc `reduce` de matchMedia, on `gsap.set()` les positions finales sans jouer le MotionPath.
- Sur mobile, limiter le nombre de halos/blurs animés simultanément : `filter: blur()` animé est coûteux. Préférer des halos statiques en `radial-gradient` et n'animer que leur `opacity`/`scale`.
