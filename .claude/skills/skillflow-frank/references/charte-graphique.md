# Charte graphique Skillflow / Frank — détail et recettes

DA océanique : profondeur, lueur, reflets, dégradés. Toutes les valeurs viennent des visuels réels du projet (icône d'app, mascotte, écrans d'onboarding).

## 1. Palette détaillée et usages

| Variable | Hex | Usage |
|---|---|---|
| `--bg-abyss` | `#07060E` | Fond le plus profond, coins, vignettage, bords d'icône d'app |
| `--bg-deep` | `#0B0820` | Fond principal des écrans sombres (teinte navy) |
| `--bg-sheet` | `#0E0E11` | Fond des maquettes mobile (near-black plus neutre) |
| `--bg-surface` | `#14121F` | Cartes et panneaux surélevés sur fond sombre |
| `--violet-deep` | `#4F46C9` | Bas des dégradés, ombre interne, état pressé |
| `--violet` | `#6B5FEE` | **Couleur signature** : corps de Frank, boutons, sélection active |
| `--violet-bright` | `#7D74EB` | Reflets, highlights, haut des dégradés du corps |
| `--violet-glow` | `#8B82F2` | Halo lumineux, lueur portée |
| `--text` | `#FFFFFF` | Titres, texte fort |
| `--text-muted` | `#A9A8B8` | Texte secondaire, sous-titres, libellés de section |
| `--eye-black` | `#050505` | Globe des yeux (noir laqué) |
| `--eye-rim` | `#F4F4F6` | Cerne blanc des yeux + point de reflet |

Règle de contraste : titres en blanc pur, secondaire en `--text-muted`. Sur surface violette pleine, texte en blanc. Vise un ratio AA (≥ 4.5:1) pour le texte courant — voir le skill `design:accessibility-review` si besoin d'un audit.

## 2. Fond océanique (lumière venue d'en haut)

Ne jamais poser un aplat sombre uni. Superpose un halo radial (la lumière qui descend dans l'eau) sur un dégradé vertical profond.

```css
.ocean-bg {
  background:
    radial-gradient(120% 80% at 75% 12%, rgba(110,98,238,.22) 0%, transparent 55%),
    radial-gradient(90% 70% at 30% 90%, rgba(79,70,201,.18) 0%, transparent 60%),
    linear-gradient(180deg, var(--bg-deep) 0%, var(--bg-abyss) 100%);
}
```

## 3. Lueur (glow)

Le violet émet de la lumière. Deux couches : un halo large diffus + un liseré proche plus intense.

```css
/* Halo doux autour d'un élément actif ou de Frank */
.glow {
  box-shadow:
    0 0 60px rgba(110,98,238,.45),
    0 0 18px rgba(139,130,242,.55);
}

/* Lueur de texte / accent ponctuel */
.glow-text { text-shadow: 0 0 18px rgba(139,130,242,.6); }
```

Pour une lueur qui « respire » (micro-animation d'attente), anime l'opacité/le rayon du box-shadow plutôt que l'élément lui-même.

## 4. Profondeur et ombres

Les surfaces se détachent par la lumière (reflet en haut) et le poids (ombre portée large), pas par des bords nets.

```css
.depth {
  box-shadow:
    0 24px 60px rgba(0,0,0,.55),   /* poids, ombre portée large */
    inset 0 1px 0 rgba(255,255,255,.10); /* reflet de bord supérieur */
}
```

## 5. Surfaces vitrées / gélifiées (reflets)

Pour remplacer les carrés gris plats du proto. Effet « objet mouillé » : légère transparence, flou d'arrière-plan, highlight haut.

```css
.glass {
  background: linear-gradient(160deg, rgba(255,255,255,.07), rgba(255,255,255,.02));
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 22px;
  box-shadow:
    0 24px 60px rgba(0,0,0,.45),
    inset 0 1px 0 rgba(255,255,255,.12);
}
```

Pour une vignette de Skill (qui était grise dans le proto) : `.glass` + un dégradé violet très léger en fond et un glow discret au survol.

## 6. Mascotte Frank — matière

Corps : dégradé radial éclairé en haut, glow porté. Yeux : globe noir laqué, cerne blanc épais, point de reflet blanc en haut.

```css
.frank-body {
  background: radial-gradient(circle at 50% 32%,
              var(--violet-bright) 0%,
              var(--violet) 55%,
              var(--violet-deep) 100%);
  filter: drop-shadow(0 0 34px rgba(110,98,238,.55));
}
.frank-eye   { background: var(--eye-black); border: 4px solid var(--eye-rim); border-radius: 50%; }
.frank-shine { background: var(--eye-rim); border-radius: 50%; } /* petit point en haut de l'oeil */
```

Animations naturelles pour une pieuvre : squash & stretch (corps souple), clignement des yeux, ondulation des tentacules, petits rebonds. Les tentacules peuvent « tenir » ou « pointer » un élément d'UI pour orienter l'attention (micro-animation fonctionnelle, pas décorative).

## 7. Composants

### Bouton primaire (« Commencer », « Suivant »)
```css
.btn-primary {
  padding: 14px 26px;
  border-radius: 999px;            /* pilule */
  color: #fff;
  background: linear-gradient(180deg, var(--violet) 0%, var(--violet-deep) 100%);
  box-shadow:
    0 10px 28px rgba(79,70,201,.45),
    inset 0 1px 0 rgba(255,255,255,.28); /* reflet du haut */
  border: 0;
}
.btn-primary:hover { filter: brightness(1.06); }
.btn-primary:active { transform: translateY(1px); }
```

### Bouton secondaire (« Retour ») et lien discret (« Passer »)
```css
.btn-ghost {
  padding: 14px 26px; border-radius: 999px; color: #fff;
  background: transparent; border: 1px solid rgba(255,255,255,.18);
}
.link-skip { color: var(--text-muted); background: none; border: 0; }
```

### Chip de sélection (IA, sous-domaines)
```css
.chip {
  padding: 12px 16px; border-radius: 14px; color: #fff;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.10);
}
.chip[aria-selected="true"] {
  border-color: var(--violet);
  box-shadow: 0 0 0 1px var(--violet), 0 0 22px rgba(110,98,238,.40);
  background: rgba(110,98,238,.12);
}
```

### Carte d'option / de domaine (radio)
Surface `.glass` avec un rond de sélection à gauche ; à la sélection, liseré + glow violet. (Dans le proto ces cartes sont grises et plates : les passer en `.glass` + glow.)

### Champ de saisie (prénom, email, mot de passe)
```css
.input {
  width: 100%; padding: 14px 16px; border-radius: 14px;
  color: #fff; background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.10);
}
.input::placeholder { color: var(--text-muted); }
.input:focus {
  outline: none; border-color: var(--violet);
  box-shadow: 0 0 0 3px rgba(110,98,238,.25);
}
```

### Barre de force du mot de passe
Piste sombre, remplissage en dégradé violet ; label d'état (« Fort ») à droite. Anime la largeur du remplissage en `width` + un glow proportionnel à la force.

## 8. Iconographie

Style des icônes d'app : pictos pleins en dégradé violet (`--violet` → `--violet-bright`), posés dans des tuiles arrondies sombres avec un **liseré lumineux** doux (glow de bord). Familles vues : pile de documents (bibliothèque de Skills), document + crayon (créer/éditer un Skill), grille + `+` (installer/ajouter), engrenage (paramètres).

```css
.icon-tile {
  border-radius: 28px; background: var(--bg-surface);
  box-shadow:
    inset 0 0 0 1px rgba(139,130,242,.18),
    0 0 30px rgba(110,98,238,.18);
}
```

Cohérence : coins très arrondis partout (icônes, cartes, boutons pilule), épaisseur de trait régulière, jamais d'icône en aplat gris.

## 9. Rayons, espacements, mouvement

- **Rayons** : pilule (999px) pour les boutons ; 14px pour chips/inputs ; 22-28px pour cartes et tuiles.
- **Mouvement** (micro-animations) : transitions courtes et souples. Easing conseillé `cubic-bezier(.22,1,.36,1)` (sortie douce), durées 200-400 ms pour l'UI, plus lentes pour les ambiances (glow qui respire, ondulation). Toujours une **raison fonctionnelle** : feedback d'état, guidage du regard, continuité entre écrans.
- Respecte `prefers-reduced-motion` : prévois une version sans animation.

## 10. Do / Don't

**Do** : fonds profonds avec halo lumineux ; violet qui émet de la lumière ; reflets en haut des surfaces ; ombres larges et douces ; coins arrondis ; Frank qui guide.

**Don't** : aplats gris plats (placeholders du proto) ; bords durs sans lumière ; ombres nettes type « drop shadow » dure ; multiplier les teintes hors palette ; animations décoratives sans rôle ; emojis dans les libellés d'UI.
