# CSS responsive — layout fluide, scène, DA fond marin

Référence pour la couche CSS de l'adaptation multi-écrans de Skillflow. Les couleurs viennent de `skillflow-frank/assets/tokens.css` ; ici on ne définit que les variables de structure et de fluidité.

## Sommaire

1. Philosophie : mobile-first + fluide
2. Breakpoints
3. Texte et espacements fluides (clamp)
4. La "scène" qui porte Frank
5. Hauteur mobile : dvh + safe-area
6. Préserver la DA fond marin en responsive
7. Spécificités tactiles

---

## 1. Philosophie : mobile-first + fluide

On conçoit pour le plus petit écran d'abord, puis on enrichit vers le haut avec `min-width`. Surtout, on remplace un maximum de valeurs fixes par des fonctions fluides (`clamp()`, `min()`, `max()`) : elles couvrent **en continu** toutes les largeurs intermédiaires, ce qui évite de chasser le bug largeur par largeur. Un seul breakpoint structurel suffit en général (la bascule vertical/horizontal), le reste glisse tout seul.

## 2. Breakpoints

Garder peu de points de rupture. Proposition alignée sur le fork GSAP (768px) :

```css
:root {
  --bp-mobile: 600px;    /* au-delà : on a de la place pour étaler */
  --bp-tablet: 768px;    /* bascule structurelle GSAP : vertical -> horizontal */
  --bp-desktop: 1024px;  /* pleine mise en page desktop */
}
```

Usage mobile-first :

```css
.feature { display: grid; gap: 1rem; }                 /* mobile : empilé */
@media (min-width: 768px) { .feature { grid-template-columns: 1fr 1fr; } }
```

## 3. Texte et espacements fluides (clamp)

`clamp(min, idéal, max)` : la valeur grandit avec le viewport entre deux bornes. Échelle typographique de départ (à ajuster à la DA) :

```css
:root {
  --step--1: clamp(0.83rem, 0.78rem + 0.24vw, 0.95rem);
  --step-0:  clamp(1.00rem, 0.93rem + 0.34vw, 1.19rem);  /* corps */
  --step-1:  clamp(1.20rem, 1.09rem + 0.55vw, 1.49rem);
  --step-2:  clamp(1.44rem, 1.28rem + 0.83vw, 1.86rem);
  --step-3:  clamp(1.73rem, 1.49rem + 1.21vw, 2.33rem);  /* titres d'écran */

  --space-s:  clamp(0.75rem, 0.6rem + 0.75vw, 1.25rem);
  --space-m:  clamp(1.25rem, 1rem + 1.25vw, 2rem);
  --space-l:  clamp(2rem, 1.5rem + 2.5vw, 3.5rem);
}
```

Ne jamais descendre sous ~16px de corps effectif sur mobile (lisibilité + pas de zoom auto iOS sur les champs).

## 4. La "scène" qui porte Frank

Pour que la géométrie du MotionPath reste cohérente, Frank et son chemin vivent dans un conteneur aux **proportions fixées**. C'est le repère stable dont dépendent les coordonnées du path.

```css
.scene {
  position: relative;          /* offset parent de #frank en absolute */
  width: 100%;
  max-width: 520px;
  margin-inline: auto;
  aspect-ratio: 4 / 3;         /* proportions stables -> path cohérent */
}
.scene__path { position: absolute; inset: 0; width: 100%; height: 100%; }
#frank { position: absolute; top: 0; left: 0; width: clamp(64px, 18vw, 120px); }
```

Sur mobile où le layout devient vertical, on change l'`aspect-ratio` (ex. `3 / 4`) et on bascule sur le chemin mobile (stratégie B côté GSAP).

```css
@media (max-width: 767px) { .scene { aspect-ratio: 3 / 4; max-width: 380px; } }
```

## 5. Hauteur mobile : dvh + safe-area

`100vh` est buggé sur mobile (la barre du navigateur fausse la hauteur). Utiliser `100dvh` (dynamic viewport height) et réserver les encoches avec `env(safe-area-inset-*)`.

```css
.onboarding { min-height: 100dvh; }
.onboarding__footer {
  padding-bottom: max(var(--space-m), env(safe-area-inset-bottom));
}
```

## 6. Préserver la DA fond marin en responsive

Le piège : des halos en px fixes paraissent minuscules sur desktop et énormes sur mobile. Les dimensionner en unités relatives au viewport pour qu'ils scalent.

```css
.glow {
  background: radial-gradient(
    circle at 50% 30%,
    var(--halo, #8B82F2) 0%,
    transparent 60%
  );
  /* taille proportionnelle, pas en px figés */
  width: clamp(280px, 60vmax, 900px);
  aspect-ratio: 1;
  filter: blur(clamp(20px, 6vmax, 80px));
  opacity: 0.5;
}
```

Rappels DA (palette dans tokens.css) : fond `#0B0820` / `#07060E`, violet signature `#6B5FEE`, ombres `#4F46C9`, halos `#8B82F2`. Surfaces gel = superposition d'ombres douces + reflet clair en haut, jamais de gris plat (les gris du proto sont des placeholders, pas la DA). Animer de préférence l'`opacity`/`scale` des halos plutôt que le `blur` (coûteux).

## 7. Spécificités tactiles

```css
:root { -webkit-tap-highlight-color: transparent; }
.btn { min-height: 44px; min-width: 44px; }            /* cible tactile */

@media (hover: hover) {                                 /* effets hover desktop only */
  .btn:hover { transform: translateY(-2px); }
}
```

Largeurs de test à repasser systématiquement : 320, 360, 390, 414, 768, 1024, 1280, 1440.
