# Charte graphique Skillflow / Frank — recettes (source : Figma « Proto final »)

Toutes les valeurs ci-dessous sont relevées sur la page Figma « Proto final ». Mention « confirmé » = lu directement dans le design ; « cohérent système » = dérivé des mêmes tokens pour un composant non mesuré au pixel (à confirmer si besoin en ouvrant l'écran concerné).

## 1. Palette et usages (confirmé)

| Variable | Hex / valeur | Usage réel |
|---|---|---|
| `--bg` | `#0B091B` | Fond de tous les écrans (rgb 11,9,27) |
| `--violet` | `#5E51F1` | Couleur signature : bordure du bouton principal, cœur des dégradés, glow |
| `--violet-bright` | `#7C72EB` | Stop clair des dégradés |
| `--violet-soft` | `#9A94E5` | Bordure du bouton secondaire, stop de dégradé |
| `--violet-glow` | `#ACA5F5` | Lueur de bord (ombres internes hautes/basses) |
| `--violet-deep` | `#4A40BE` | Stop sombre des dégradés |
| `--violet-deeper` | `#362F8B` | Stop très sombre |
| `--text` | `#F6F6FF` | Titres, libellés de boutons (blanc légèrement violacé) |
| `--text-card` | `#EDEDED` | Texte dans les cartes |
| `--text-muted` | `rgba(246,246,255,.3)` | Liens discrets (« Passer ») |
| `--glass-fill` | `rgba(255,255,255,.05)` | Remplissage des surfaces glass |
| `--glass-border` | `rgba(255,255,255,.10)` | Bordure des surfaces glass |
| `--placeholder` | `#A3A3A3` | **Placeholder uniquement — pas la DA** |

## 2. Fond d'écran (confirmé)

Fond `#0B091B` + glow violet diffus + vignettage interne + fine lueur de bord en haut et en bas (`#ACA5F5` à 4 %).

```css
.app-bg {
  position: relative;
  background:
    radial-gradient(ellipse 80% 60% at 50% 115%,
      rgba(94,81,241,.18) 0%,
      rgba(58,52,131,.10) 35%,
      rgba(31,29,49,.05) 70%,
      transparent 100%),
    var(--bg);
  box-shadow:
    inset 0 0 187px rgba(0,0,0,.25),     /* vignettage */
    inset 0 85px 76px rgba(172,165,245,.04),  /* lueur haute */
    inset 0 -85px 76px rgba(172,165,245,.04); /* lueur basse */
}
```

## 3. Surfaces glass / cartes (confirmé)

C'est le composant de surface central. Remplace tout « carré gris ».

```css
.card {
  background: var(--glass-fill);
  border: 1px solid var(--glass-border);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  border-radius: 16px;
  padding: 32px 24px;
  display: flex;
  flex-direction: column;
  gap: 22px;
}
```

Carte type (écran « Pourquoi Frank ? ») : largeur 440px, icône 32px en haut, titre 32px, paragraphe 20px, puis une zone média (actuellement placeholder gris `#A3A3A3`, rayon 16-29px → à passer en glass + dégradé léger).

## 4. Boutons (confirmé)

Pilule `border-radius: 120px`, padding `24px 48px`, texte **Inter Medium 24px** `#F6F6FF` (letter-spacing -0.96px). Détail signature : un **éclat blanc flou en diagonale** (reflet de lumière) en haut à gauche.

```css
.btn {
  position: relative; overflow: hidden;
  border-radius: 120px;
  padding: 24px 48px;
  font: 500 24px/1.5 "Inter", sans-serif;
  letter-spacing: -0.96px;
  color: var(--text);
  cursor: pointer;
}
/* Éclat de lumière commun aux deux boutons */
.btn::before {
  content: "";
  position: absolute; left: -22px; top: -16px;
  width: 32px; height: 96px;
  background: rgba(255,255,255,.48);
  filter: blur(14.6px);
  transform: rotate(31.35deg);
  pointer-events: none;
}

/* Principal (Suivant / Commencer) : bordure violette + remplissage glass violet */
.btn-primary {
  border: 2px solid var(--violet);
  background:
    radial-gradient(120% 180% at 90% 10%,
      rgba(154,148,229,.34) 0%,
      rgba(124,114,235,.30) 25%,
      rgba(94,81,241,.28) 50%,
      rgba(74,64,190,.20) 75%,
      rgba(54,47,139,.18) 100%),
    rgba(94,81,241,.18);
}

/* Secondaire (Retour) : transparent, bordure violet clair */
.btn-secondary {
  border: 2px solid var(--violet-soft);
  background: transparent;
}
```

Lien discret (« Passer ») : Inter Medium 20px, `color: var(--text-muted)`, sans fond ni bordure.

## 5. Mascotte Frank (confirmé)

Frank apparaît en débordement de coin, avec une **ellipse de glow floue** derrière lui (opacité ~71 %, légèrement tournée). Yeux : globe noir laqué, cerne blanc épais, point de reflet.

```css
.frank { position: relative; filter: drop-shadow(0 0 34px rgba(94,81,241,.45)); }
.frank-glow {            /* ellipse de halo derrière la mascotte */
  position: absolute; inset: -40%;
  background: radial-gradient(circle, rgba(94,81,241,.5), transparent 70%);
  filter: blur(40px); opacity: .71; z-index: -1;
}
```

Animations naturelles : squash & stretch du corps, clignement, ondulation/“pointage” des tentacules vers un élément d'UI (micro-animation fonctionnelle, jamais décorative).

## 6. Typographie (confirmé)

| Rôle | Police | Taille | Tracking | Interligne |
|---|---|---|---|---|
| Titre H1 | Google Sans Flex Medium | 64px | -1.28px | 1.2 |
| Titre de carte | Google Sans Flex Medium | 32px | -0.352px | 1.5 |
| Sous-titre | Roboto Slab Regular (slab serif) | 24px | -0.72px | 1.5 |
| Corps | Google Sans Flex Medium | 20px | -0.22px | 1.5 |
| Marque « Frank » | Libre Baskerville (serif), inline | hérite | — | — |
| Bouton / lien | Inter Medium | 24px / 20px | -0.96px | 1.5 |

Le titre est un **sans-serif géométrique** (Google Sans Flex). Le serif n'est utilisé que pour les sous-titres (Roboto Slab) et le mot *Frank* (Libre Baskerville).

Disponibilité web : Inter, Roboto Slab, Libre Baskerville sont sur Google Fonts (libres). **Google Sans Flex n'y est pas** → auto-hébergement si licence, sinon alternative proche (Plus Jakarta Sans, Geist, Inter). Libre Baskerville n'a que 400/700.

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@500&family=Libre+Baskerville:ital,wght@0,400;0,700&family=Roboto+Slab:wght@400&display=swap');
/* Google Sans Flex : à auto-héberger, ou remplacer par une alternative ci-dessus */
```

## 7. Composants d'onboarding (cohérent système)

Mêmes tokens (glass, bordures claires, violet de sélection). À confirmer au pixel en ouvrant l'écran concerné dans « Proto final » si une valeur exacte est requise.

### Chip de sélection (IA, sous-domaines)
```css
.chip {
  padding: 12px 16px; border-radius: 14px; color: var(--text);
  background: var(--glass-fill); border: 1px solid var(--glass-border);
  cursor: pointer; transition: all .2s cubic-bezier(.22,1,.36,1);
}
.chip[aria-selected="true"] {
  border-color: var(--violet);
  box-shadow: 0 0 0 1px var(--violet), 0 0 22px rgba(94,81,241,.40);
  background: rgba(94,81,241,.12);
}
```

### Champ de saisie (prénom, email, mot de passe)
```css
.input {
  width: 100%; padding: 14px 16px; border-radius: 14px; color: var(--text);
  background: var(--glass-fill); border: 1px solid var(--glass-border);
}
.input::placeholder { color: var(--text-muted); }
.input:focus {
  outline: none; border-color: var(--violet);
  box-shadow: 0 0 0 3px rgba(94,81,241,.25);
}
```

### Carte de Skill (feed) et barre de force du mot de passe
Carte = `.card` (glass) avec note, installs et bouton « + Installer » (= `.btn-primary` compact). Barre de force = piste sombre + remplissage en dégradé violet animé en `width`.

## 8. Rayons, mouvement, accessibilité

- **Rayons** : 120px (boutons pilule) ; 16px (cartes glass) ; 14px (chips/inputs).
- **Mouvement** : transitions 200-400 ms, easing `cubic-bezier(.22,1,.36,1)`. Toujours une raison fonctionnelle (feedback, guidage, continuité). Animer plutôt l'opacité/le rayon du glow que l'élément lui-même pour les ambiances.
- **Reduced motion** : prévoir `@media (prefers-reduced-motion: reduce)`.

## 9. Do / Don't

**Do** : fond `#0B091B` avec glow et vignettage ; violet `#5E51F1` qui émet de la lumière ; surfaces glass translucides ; éclat blanc en diagonale sur les boutons ; coins très arrondis ; Frank qui guide et déborde des coins.

**Don't** : carrés gris plats `#A3A3A3` (placeholders) ; bords durs sans lumière ; titres en serif (le H1 est en sans géométrique) ; teintes hors palette ; animations décoratives ; emojis dans les libellés.
