import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import gsap from 'gsap'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'
import OnboardingGrid from './OnboardingGrid'
import { SPECIALITES, SpecIconTile, type Spec } from './Specialties'
import './App.css'

gsap.registerPlugin(MotionPathPlugin)

const STEPS = ['welcome', 'skill', 'why', 'ia', 'specialite', 'precise', 'present', 'password', 'plan', 'feed'] as const
type Step = (typeof STEPS)[number]

type FrankState = { x: number; y: number; scale: number; rot: number; opacity: number }

/* Suréchantillonnage de la couche Frank. La <video> est rastérisée par le GPU à
   la taille de layout de .ob-frank (~360px) puis agrandie par le scale GSAP : au
   gros plan d'intro (scale 11,2) la texture est étirée 11,2× → gros pixels, quelle que
   soit la résolution de la source. Parade : on layoute .ob-frank FRANK_SS× plus
   grand (var --ss, posé au montage + cf. App.css) et on divise tous les scales par
   FRANK_SS. Rendu identique, mais la texture est rastérisée FRANK_SS× plus fine.
   FRANK_SS=4 ⇒ étirement résiduel 11,2/4=2,8× au lieu de 11,2× (au-delà de la limite du
   net avec la source actuelle ; OK car la V2 de la vidéo sera en 4K — sinon monter FRANK_SS)
   sans suréchantillonner les filtres de flou au point de saccader. Ajustable.
   PLAFOND : la couche scalée (= baseCss × FRANK_SS × scale) + le drop-shadow sature le
   compositing GPU si elle devient trop grande → TOUT bugue. Parade en place : la lueur
   (drop-shadow + glow) est COUPÉE pendant le gros plan d'intro (classe is-intro, cf.
   App.css), invisible à ce scale de toute façon ; ça relève le plafond. FRANK.intro est
   à un scale visuel ~16 ; éviter de dépasser ~18 (au-delà, la taille brute de couche
   redevient limitante, même sans lueur). */
const FRANK_SS = 4

/* Décodage adaptatif de la grosse boucle idle (frank-sur-place). La source pleine est en
   4000×4000 (VP9) : superbe au gros plan d'intro, mais son décodage EN BOUCLE sature le CPU
   des machines sans décodage matériel VP9 4K (iGPU anciens) → tout le site lague et les
   animations saccadent. On sert donc une version allégée 1440² (rendu identique au repos,
   Frank fait ~360–720px à l'écran) sauf aux machines clairement costaudes, qui gardent la 4K.
   saveData (mode éco data) force l'allégé. La rétrogradation dynamique sur frames perdues
   viendra compléter cette heuristique statique (étape 2). */
const pickFrankTier = (): 'high' | 'low' => {
  if (typeof navigator === 'undefined') return 'low'
  // Override de test : ?frank=hd force la 4K, ?frank=light force le 1440² (pour comparer)
  const forced = new URLSearchParams(window.location.search).get('frank')
  if (forced === 'hd') return 'high'
  if (forced === 'light') return 'low'
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } }
  if (nav.connection?.saveData) return 'low'
  const cores = nav.hardwareConcurrency ?? 0
  const mem = nav.deviceMemory // undefined si le navigateur ne l'expose pas (Firefox/Safari)
  return cores >= 8 && (mem === undefined || mem >= 8) ? 'high' : 'low'
}
const FRANK_TIER = pickFrankTier()
const FRANK_IDLE_SRC = FRANK_TIER === 'high'
  ? '/assets/frank-sur-place.webm'
  : '/assets/frank-sur-place-1440.webm'

/* Profondeur de champ : l'opacité « de repos » de Frank découle de sa taille
   VISUELLE (le numérateur des scales, indépendant de FRANK_SS). Plus il est
   petit, plus il est loin dans l'eau → plus il s'estompe.
   visualScale ≥ DEPTH_NEAR → pleinement opaque (gros plan) ; ≤ DEPTH_FAR →
   opacité minimale DEPTH_OP_FAR. Pour accentuer l'effet, baisse DEPTH_OP_FAR. */
const DEPTH_NEAR = 2.3, DEPTH_FAR = 0.6
const DEPTH_OP_FAR = 0.72, DEPTH_OP_NEAR = 1
const depthOpacity = (visualScale: number) => {
  const t = gsap.utils.clamp(0, 1, (visualScale - DEPTH_FAR) / (DEPTH_NEAR - DEPTH_FAR))
  return +(DEPTH_OP_FAR + (DEPTH_OP_NEAR - DEPTH_OP_FAR) * t).toFixed(3)
}

/* État de Frank par écran — transformOrigin sur ses yeux (50% 51%).
   x ×innerWidth, y ×innerHeight (origine = centre de l'écran).
   fs reçoit l'échelle VISUELLE : l'opacité en découle (depthOpacity) et le scale
   stocké est divisé par FRANK_SS (cf. suréchantillonnage ci-dessus). */
const fs = (x: number, y: number, visualScale: number, rot: number): FrankState =>
  ({ x, y, scale: visualScale / FRANK_SS, rot, opacity: depthOpacity(visualScale) })

const FRANK: Record<'intro' | Step, FrankState> = {
  intro:   fs(0,     0,     16,   0),   // gros plan d'ouverture ; lueur coupée pendant l'intro (is-intro) → plafond relevé, mais éviter > ~18
  welcome: fs(0,    -0.16,  1,    0),
  skill:   fs(0,     0.41,  2.3,  0),
  why:     fs(0.34, -0.32,  0.62, -4),
  ia:      fs(-0.28, 0.22,  1.5,  5),
  // Écran spécialité : Frank reste à gauche mais plus petit et plus bas pour ne pas déborder sur le texte.
  specialite: fs(-0.28, 0.22,  1.5,  5),
  // Écran « Plus précisément ? » : Frank assez présent dans l'espace à gauche
  // (l'écran paraissait vide), derrière les cartes (z-order).
  precise: fs(-0.3,  0.12,  1.45, -3),
  // Écran « On se présente » : grande moitié gauche vide → Frank vient au premier
  // plan, grand et droit (face caméra) pour « se présenter ».
  present: fs(-0.25, 0.06,  1.65, 0),
  // Écran « Créer ton mot de passe » : même type d'écran que « On se présente »,
  // Frank reste dans la moitié gauche (dérive minime).
  password: fs(-0.27, 0.07,  1.55, -2),
  // Écran « Choisis ton plan » : Frank petit, en haut à droite, qui dépasse du
  // coin (comme dans le Figma) ; il y nage en arrivant.
  plan: fs(0.38, -0.32,  0.92, 8),
  // Écran feed (arrivée sur l'app) : Frank a « plongé » dans l'app → couche Frank
  // invisible (opacity 0) ; la mascotte de domaine prend le relais dans la sidebar.
  feed: { x: -0.42, y: 0.40, scale: 0.5 / FRANK_SS, rot: 0, opacity: 0 },
}

/* Frank arrive au coin haut-droit de la carte Expert. Le groupe de cartes est
   centré et plafonné à 1080px (cf. .ob-plans) → on calcule sa position depuis le
   bord droit du groupe plutôt qu'une fraction fixe (sinon il dérive selon la
   largeur d'écran). On garde échelle/rotation/opacité de FRANK.plan. */
const planFrankState = (): FrankState => {
  const rightEdge = Math.min(0.47, 540 / window.innerWidth)  // bord droit du groupe (fraction depuis le centre)
  return { ...FRANK.plan, x: rightEdge - 0.05, y: -0.28 }
}

const AI_OPTIONS = [
  { name: 'Claude', logo: 'claude' },
  { name: 'Gemini', logo: 'gemini' },
  { name: 'Codex', logo: 'codex' },
  { name: 'Loveable', logo: 'loveable' },
  { name: 'ChatGPT', logo: 'chatgpt' },
  { name: 'Mistral', logo: 'mistral' },
  { name: 'Copilot', logo: 'copilot' },
  { name: 'Autre', logo: 'autre' },
]

/* Écran « Choisis ton plan » — 3 offres (cartes glass). `popular` = mise en avant. */
const PLANS = [
  { key: 'decouverte', name: 'Découverte', tagline: 'Découvre ce que Frank peut faire.', price: '0€',
    feats: ['Feed perso', '100 Skills à explorer', 'Installation mensuelle de 5 Skills', 'Sans carte bancaire'] },
  { key: 'pro', name: 'Pro', tagline: 'Pour les solo & freelances', price: '15€', popular: true,
    feats: ['+10 000 Skills à explorer', 'Installation sans limites', 'Mises à jour auto de tes Skills', 'Nouveautés en avant-première'] },
  { key: 'expert', name: 'Expert', tagline: 'Pour les équipes', price: '60€',
    feats: ['Installation sans limites', 'Éditeur de Skills', "Espaces d'équipe partagés", 'Crée et partage tes Skills privés', 'Accès prioritaire forte affluence'] },
]

/* Écran feed (arrivée sur l'app) — encore en placeholder côté contenu. */
const FEED_SKILLS = [
  { name: 'Skill 1', rating: '4.6', installs: '1k installs' },
  { name: 'Skill 2', rating: '4.8', installs: '6k installs' },
  { name: 'Skill 3', rating: '4.4', installs: '2.4k installs' },
  { name: 'Skill 4', rating: '4.5', installs: '8k installs' },
  { name: 'Skill 5', rating: '3.9', installs: '500 installs' },
  { name: 'Skill 6', rating: '4.0', installs: '1.1k installs' },
  { name: 'Skill 7', rating: '4.7', installs: '3.2k installs' },
  { name: 'Skill 8', rating: '4.2', installs: '900 installs' },
  { name: 'Skill 9', rating: '4.9', installs: '12k installs' },
  { name: 'Skill 10', rating: '4.1', installs: '740 installs' },
  { name: 'Skill 11', rating: '4.3', installs: '5.5k installs' },
  { name: 'Skill 12', rating: '4.6', installs: '2k installs' },
]
const FEED_NAV = ['Feed personnalisé', 'Explorer', 'Mes Skills', 'Paramètres']
const FEED_EXTRA_FILTERS = ['Gratuit', 'Populaire', 'Récent', 'Vérifié', 'Tendance']

/* Mascotte + rôle selon le domaine choisi (1re spécialité). Finance/Graphisme/Autre
   retombent sur ui/ux (mascottes Figma pas encore exportables proprement). */
const DOMAIN_INFO: Record<Spec, { mascot: string; role: string; label: string }> = {
  code:      { mascot: 'dev',       role: 'DÉVELOPPEUR',    label: 'Code' },
  graphisme: { mascot: 'uiux',      role: 'GRAPHISTE',      label: 'Graphisme' },
  uiux:      { mascot: 'uiux',      role: 'UI/UX DESIGNER', label: 'UI/UX' },
  marketing: { mascot: 'marketing', role: 'MARKETER',       label: 'Marketing' },
  finance:   { mascot: 'uiux',      role: 'ANALYSTE',       label: 'Finance' },
  autre:     { mascot: 'uiux',      role: 'CRÉATIF',        label: 'UI/UX' },
}

/* Écran « Plus précisément ? » — tags multi-select groupés par catégorie.
   On réutilise le composant .ob-ai-chip (variante --tag) plutôt que le style
   « texte dégradé » du Figma. Clé de sélection = `${groupe}|${option}`.
   Les groupes DÉPENDENT du domaine principal choisi à l'écran « spécialité »
   (cf. PRECISE_BY_DOMAIN) : un profil finance n'a pas à voir « Style visuel ».
   La clé de groupe peut se répéter d'un domaine à l'autre (ex. `outils`) sans
   collision, puisque seules comptent les paires `${groupe}|${option}`. */
type PreciseGroup = { key: string; label: string; options: string[] }

const PRECISE_BY_DOMAIN: Record<Spec, PreciseGroup[]> = {
  code: [
    { key: 'langages', label: 'Langages',
      options: ['JavaScript', 'TypeScript', 'Python', 'Go', 'Rust', 'PHP', 'Java', 'C#'] },
    { key: 'stack', label: 'Stack',
      options: ['React', 'Vue', 'Node.js', 'Next.js', 'Django', 'Laravel'] },
    { key: 'domaine', label: 'Domaine',
      options: ['Frontend', 'Backend', 'Mobile', 'DevOps', 'Data / IA', 'Jeux vidéo'] },
    { key: 'outils', label: 'Outils',
      options: ['VS Code', 'GitHub', 'Docker', 'Postman'] },
  ],
  graphisme: [
    { key: 'discipline', label: 'Discipline',
      options: ['Identité visuelle', 'Illustration', 'Motion design', 'Édition', 'Packaging', 'Typographie'] },
    { key: 'style', label: 'Style',
      options: ['Minimalisme', 'Rétro', '3D', 'Flat design', 'Brutalisme'] },
    { key: 'outils', label: 'Outils',
      options: ['Photoshop', 'Illustrator', 'InDesign', 'After Effects', 'Blender'] },
  ],
  uiux: [
    { key: 'style', label: 'Style visuel',
      options: ['Brutalisme', 'Minimalisme', 'Glassmorphique', 'Skeumorphe'] },
    { key: 'produit', label: 'Type de produit',
      options: ['Mobile app', 'Web app', 'Landing page', 'Dashboard', 'Home page', 'E-commerce'] },
    { key: 'expertise', label: 'Expertise',
      options: ['Design system', 'Prototypage', 'Wireframing', 'User research', 'Accessibilité'] },
    { key: 'outils', label: 'Outils',
      options: ['Figma', 'Framer', 'Sketch', 'Penpot'] },
  ],
  marketing: [
    { key: 'canaux', label: 'Canaux',
      options: ['SEO', 'Réseaux sociaux', 'Email', 'Publicité payante', 'Content'] },
    { key: 'objectif', label: 'Objectif',
      options: ['Acquisition', 'Conversion', 'Fidélisation', 'Notoriété'] },
    { key: 'expertise', label: 'Expertise',
      options: ['Copywriting', 'Growth', 'Analytics', 'Branding', 'Influence'] },
    { key: 'outils', label: 'Outils',
      options: ['Google Ads', 'Meta Ads', 'Mailchimp', 'HubSpot'] },
  ],
  finance: [
    { key: 'domaine', label: 'Domaine',
      options: ['Comptabilité', 'Analyse financière', 'Investissement', 'Trading', 'Budget', 'Reporting'] },
    { key: 'expertise', label: 'Expertise',
      options: ['Modélisation', 'Prévision', 'Audit', 'Fiscalité', 'Gestion du risque'] },
    { key: 'marches', label: 'Marchés',
      options: ['Actions', 'Crypto', 'Immobilier', 'Obligations'] },
    { key: 'outils', label: 'Outils',
      options: ['Excel', 'Power BI', 'SAP', 'QuickBooks'] },
  ],
  autre: [
    { key: 'usage', label: 'Usage principal',
      options: ['Rédaction', 'Recherche', 'Productivité', 'Automatisation', 'Apprentissage'] },
    { key: 'contexte', label: 'Contexte',
      options: ['Personnel', 'Professionnel', 'Études', 'Side project'] },
    { key: 'outils', label: 'Outils',
      options: ['Notion', 'Google Workspace', 'Slack', 'Excel'] },
  ],
}

/* Bulles d'interrogation « libérées » autour de la tête de Frank sur l'écran IA.
   dx/dy = point d'apparition autour d'elle (px) ; rise = montée douce (× hauteur) ;
   drift = dérive latérale (px) ; delay = cadence d'émission (s) ;
   q = bulle portant un point d'interrogation.
   Cycle : pop autour d'elle → dérive lente → la taille ET l'opacité réduisent. */
const QUESTION_BUBBLES = [
  { size: 96,  dx: -120, dy:  12, rise: 0.05, drift: -14, delay: 0.0, q: true  },
  { size: 56,  dx:  128, dy: -14, rise: 0.06, drift:  18, delay: 0.6, q: false },
  { size: 128, dx:  -6,  dy: -80, rise: 0.05, drift:  10, delay: 1.1, q: true  },
  { size: 64,  dx: -92,  dy: -70, rise: 0.04, drift: -16, delay: 1.7, q: false },
  { size: 82,  dx:  108, dy:  42, rise: 0.05, drift:  14, delay: 2.2, q: true  },
]

/* Traînée de bulles laissée par Frank. Pendant un déplacement : émission basée
   sur la DISTANCE parcourue (trail régulier quel que soit son rythme). Au repos :
   une émission temporelle très clairsemée (il « respire » sur place). L'opacité
   de chaque bulle suit la PROFONDEUR de Frank (son opacité courante) → quand il
   est loin/estompé, ses bulles sont discrètes et se lisent bien DERRIÈRE lui même
   à travers son corps translucide. Pop à sa position → montée → disparition ~2 s. */
const TRAIL_POOL = 22          // nb de bulles recyclées en rotation
const TRAIL_EMIT_EVERY = 155   // déplacement : distance (px) entre deux bulles (↑ = moins)
const TRAIL_MAX_STEP = 220     // saut/frame au-delà = téléportation → on n'émet pas
const TRAIL_IDLE_MIN = 1.6     // repos : intervalle min (s) entre deux bulles
const TRAIL_IDLE_MAX = 3.0     // repos : intervalle max (s) — très clairsemé
// Taille d'une bulle = fraction de la taille apparente de Frank → petites quand
// il est loin (petit), plus grosses quand il est proche (gros), bornée en px.
const TRAIL_SIZE_RATIO_MIN = 0.03
const TRAIL_SIZE_RATIO_MAX = 0.075
const TRAIL_SIZE_MIN = 5, TRAIL_SIZE_MAX = 72

const WHY_CARDS: { key: string; Icon: () => React.JSX.Element; title: string; text: React.ReactNode }[] = [
  { key: 'feed', Icon: IconSliders, title: 'Feed personnalisé',
    text: "Construit dès l'inscription selon ton domaine + tes IA. Plus tu installes, plus c'est précis." },
  { key: 'install', Icon: IconPlus, title: 'Installation en 1 clic',
    text: <>Pas de terminal, pas de fichier à copier. Frank s'occupe de tout.<br /></> },
  { key: 'verif', Icon: IconCheck, title: 'Skills vérifiés',
    text: "Chaque skill passe par 2 niveaux de vérification. Si quelque chose cloche, tu le vois avant d'installer." },
]

/* Inclinaison « suit la direction » de Frank le long d'un motionPath.
   On lit sa vitesse instantanée (dx,dy) image par image et on l'incline vers sa
   direction de nage, amplitude bornée pour qu'il reste face-caméra et lisible.
   `straighten` : sur les 30 % finaux, l'inclinaison s'efface pour qu'il arrive
   bien droit, à la rotation de repos de l'écran (rotEnd). */
const LEAN_AMP = 18      // inclinaison max (deg)
const LEAN_FACTOR = 0.2  // fraction de l'angle de direction réellement appliquée
const LEAN_SMOOTH = 0.2  // lissage de l'inclinaison [0..1]

function makeLean(target: gsap.TweenTarget, rotStart: number, rotEnd: number, straighten = true) {
  let px: number | null = null
  let py = 0
  let tilt = 0
  return {
    start() { px = null; py = 0; tilt = 0 },
    update(this: gsap.core.Tween) {
      const p = this.progress()
      const x = parseFloat(String(gsap.getProperty(target, 'x')))
      const y = parseFloat(String(gsap.getProperty(target, 'y')))
      if (px !== null) {
        const dx = x - px, dy = y - py
        if (dx * dx + dy * dy > 0.25) {          // ignore les frames quasi immobiles
          // direction de nage ramenée à « 0 = vers le haut », puis dans [-180,180]
          let dir = Math.atan2(dy, dx) * 180 / Math.PI + 90
          dir = ((dir + 180) % 360 + 360) % 360 - 180
          const want = gsap.utils.clamp(-LEAN_AMP, LEAN_AMP, dir * LEAN_FACTOR)
          tilt += (want - tilt) * LEAN_SMOOTH
        }
      }
      px = x; py = y
      const fade = straighten ? gsap.utils.clamp(0, 1, (1 - p) / 0.3) : 1
      gsap.set(target, { rotation: rotStart + (rotEnd - rotStart) * p + tilt * fade })
    },
  }
}

/* Flottement idle « wiggle » : micro-mouvement organique pour que Frank ne soit
   jamais totalement figé. Porté par .ob-frank-float pour ne pas entrer en conflit
   avec le placement/l'inclinaison gérés sur .ob-frank.
   Un seul driver temporel anime 4 sinusoïdes déphasées (périodes premières entre
   elles → non répétitif), toutes multipliées par `state.amp` (0 = figé, 1 = plein).
   On monte amp de 0→1 pendant l'intro pour que le flottement éclose au dézoom.
   yPercent/xPercent sont relatifs à la taille apparente → neutres vis-à-vis de FRANK_SS. */
const FLOAT = {
  y: 1.8,        // amplitude verticale (% de la taille apparente de Frank)
  x: 1.1,        // amplitude horizontale (%)
  rot: 1.4,      // tangage (deg)
  scale: 0.015,  // respiration
}

function startFloat(el: gsap.TweenTarget) {
  gsap.set(el, { transformOrigin: '50% 51%' })
  const state = { amp: 0 }   // facteur global d'amplitude, monté progressivement
  const TAU = Math.PI * 2
  const driver = gsap.to({ t: 0 }, {
    t: 1, duration: 1, repeat: -1, ease: 'none',
    onUpdate(this: gsap.core.Tween) {
      const time = this.totalTime(), a = state.amp   // totalTime() = horloge continue
      gsap.set(el, {
        yPercent: Math.sin(time * TAU / 2.3)       * FLOAT.y     * a,
        xPercent: Math.sin(time * TAU / 3.3 + 1.1) * FLOAT.x     * a,
        rotation: Math.sin(time * TAU / 2.9 + 2.3) * FLOAT.rot   * a,
        scale: 1 + Math.sin(time * TAU / 3.7 + 0.7) * FLOAT.scale * a,
      })
    },
  })
  return { driver, state }
}

function Onboarding() {
  const frankRef = useRef<HTMLDivElement>(null)
  const frankFloatRef = useRef<HTMLDivElement>(null)
  const frankVideoRef = useRef<HTMLVideoElement>(null)
  const frankSkillRef = useRef<HTMLVideoElement>(null)
  const bgDecoRef = useRef<HTMLDivElement>(null)
  // Écran 1 — accueil
  const titleRef = useRef<HTMLHeadingElement>(null)
  const subRef   = useRef<HTMLParagraphElement>(null)
  const btnRef   = useRef<HTMLButtonElement>(null)
  // Écran 2 — « Un clic suffit »
  const skipRef  = useRef<HTMLButtonElement>(null)
  const skillRef = useRef<HTMLDivElement>(null)
  const navRef   = useRef<HTMLDivElement>(null)
  // Écran 3 — « Pourquoi Frank ? »
  const whySkipRef  = useRef<HTMLButtonElement>(null)
  const whyHeadRef  = useRef<HTMLDivElement>(null)
  const whyCardsRef = useRef<HTMLDivElement>(null)
  const whyNavRef   = useRef<HTMLDivElement>(null)
  // Écran 4 — « Quelles IA tu utilises ? »
  const iaSkipRef = useRef<HTMLButtonElement>(null)
  const iaHeadRef = useRef<HTMLDivElement>(null)
  const iaGridRef = useRef<HTMLDivElement>(null)
  const iaNavRef  = useRef<HTMLDivElement>(null)
  // Écran 5 — « Quelle est ta spécialité ? »
  const spSkipRef = useRef<HTMLButtonElement>(null)
  const spHeadRef = useRef<HTMLDivElement>(null)
  const spGridRef = useRef<HTMLDivElement>(null)
  const spNavRef  = useRef<HTMLDivElement>(null)
  // Écran 6 — « Plus précisément ? »
  const prSkipRef   = useRef<HTMLButtonElement>(null)
  const prHeadRef   = useRef<HTMLDivElement>(null)
  const prGroupsRef = useRef<HTMLDivElement>(null)
  const prNavRef    = useRef<HTMLDivElement>(null)
  // Écran 7 — « On se présente » (formulaire)
  const presHeadRef = useRef<HTMLDivElement>(null)
  const presFormRef = useRef<HTMLFormElement>(null)
  const presBackRef = useRef<HTMLDivElement>(null)
  // Écran 8 — « Créer ton mot de passe »
  const pwdHeadRef = useRef<HTMLDivElement>(null)
  const pwdFormRef = useRef<HTMLFormElement>(null)
  const pwdBackRef = useRef<HTMLDivElement>(null)
  // Écran 9 — « Choisis ton plan »
  const planHeadRef = useRef<HTMLDivElement>(null)
  const planCardsRef = useRef<HTMLDivElement>(null)
  const planNavRef = useRef<HTMLDivElement>(null)
  // Écran 10 — feed (arrivée sur l'app)
  const feedSideRef = useRef<HTMLDivElement>(null)
  const feedHeadRef = useRef<HTMLDivElement>(null)
  const feedCardsRef = useRef<HTMLDivElement>(null)
  // Bulles d'interrogation (transition « Pourquoi Frank ? » → IA)
  const bubblesRef = useRef<HTMLDivElement>(null)
  // Traînée de bulles laissée par Frank pendant ses déplacements
  const trailRef = useRef<HTMLDivElement>(null)

  const segsRef      = useRef<gsap.core.Timeline[]>([])
  const idxRef       = useRef(0)
  const animatingRef = useRef(false)
  const reduceRef    = useRef(false)
  // Reconstruction des segments quand le domaine change (les groupes de l'écran
  // « Plus précisément ? » en dépendent) : assignée dans l'effet principal,
  // appelée par l'effet [primaryDomain]. domainInitRef ignore le 1er passage.
  const rebuildPreciseRef = useRef<(() => void) | null>(null)
  const domainInitRef = useRef(true)

  // Deep links de prévisualisation : ?ob=skill | ?ob=why (état figé), ?frz=0..1 (scrub)
  const [step, setStep] = useState<Step>(() => {
    const ob = new URLSearchParams(window.location.search).get('ob')
    return ob === 'feed' ? 'feed' : ob === 'plan' ? 'plan' : ob === 'password' ? 'password' : ob === 'present' ? 'present' : ob === 'precise' ? 'precise' : ob === 'specialite' ? 'specialite' : ob === 'ia' ? 'ia' : ob === 'why' ? 'why' : ob === 'skill' ? 'skill' : 'welcome'
  })
  const [selectedAis, setSelectedAis] = useState<Set<string>>(() => new Set())
  const [selectedSpecs, setSelectedSpecs] = useState<Set<Spec>>(() => new Set())
  const [selectedPrecise, setSelectedPrecise] = useState<Set<string>>(() => new Set())
  // Formulaire « On se présente » (contrôlé)
  const [presName, setPresName] = useState('')
  const [presEmail, setPresEmail] = useState('')
  const [presCgu, setPresCgu] = useState(false)
  // Mot de passe « Créer ton mot de passe » (contrôlé)
  const [presPwd, setPresPwd] = useState('')
  const [presPwd2, setPresPwd2] = useState('')
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  // Feed : filtres choisis (chips actifs) + affichage de filtres supplémentaires.
  const [feedFilters, setFeedFilters] = useState<Set<string>>(() => new Set())
  const [showFilters, setShowFilters] = useState(false)

  // Validations dérivées (recalculées à chaque rendu).
  // Accès à « Créer ton mot de passe » : les 2 champs remplis + CGU cochées.
  const presValid = presName.trim() !== '' && /^\S+@\S+\.\S+$/.test(presEmail) && presCgu
  const pwdReqs = {
    len: presPwd.length >= 8,
    upper: /[A-Z]/.test(presPwd),
    special: /[\d\W]/.test(presPwd),
  }
  const pwdScore = [pwdReqs.len, pwdReqs.upper, pwdReqs.special].filter(Boolean).length
  const pwdStrength = pwdScore <= 1 ? 'Faible' : pwdScore === 2 ? 'Moyen' : 'Fort'
  const pwdValid = pwdScore === 3 && presPwd !== '' && presPwd === presPwd2

  // Barre de nav persistante : libellé + état (désactivé) selon l'étape courante.
  const navLabel = step === 'present' || step === 'password' ? 'Enregistrer' : 'Suivant'
  const navDisabled =
    step === 'present' ? !presValid :
    step === 'password' ? !pwdValid :
    step === 'plan' ? !selectedPlan : false

  // Personnalisation du feed à partir des choix du parcours.
  const primaryDomain: Spec = [...selectedSpecs][0] ?? 'uiux'
  const domainInfo = DOMAIN_INFO[primaryDomain]
  // Groupes de « Plus précisément ? » propres au domaine principal choisi.
  const preciseGroups = PRECISE_BY_DOMAIN[primaryDomain]
  const userName = presName.trim() || 'toi'
  const userAis = [...selectedAis].slice(0, 2).join(' + ') || 'tes IA'

  const toggleFeedFilter = (f: string) =>
    setFeedFilters(prev => {
      const next = new Set(prev)
      if (next.has(f)) next.delete(f)
      else next.add(f)
      return next
    })
  // À l'arrivée sur le feed, on coche par défaut les filtres « contexte » (domaine + IA).
  useEffect(() => {
    if (step === 'feed') {
      setFeedFilters(prev => (prev.size ? prev : new Set([domainInfo.label, ...[...selectedAis].slice(0, 2)])))
    }
  }, [step])

  // useLayoutEffect (et non useEffect) : on pose les autoAlpha:0 et le --ss AVANT le premier
  // paint, sinon le navigateur affiche une frame avec tous les écrans de l'onboarding visibles
  // (ils sont dans le HTML) avant que GSAP ne les cache → flash au chargement.
  useLayoutEffect(() => {
    const frank = frankRef.current
    if (!frank) return
    // Suréchantillonnage : .ob-frank est layouté FRANK_SS× plus grand (cf. App.css + FRANK).
    frank.style.setProperty('--ss', String(FRANK_SS))

    const welcomeEls = [titleRef.current, subRef.current, btnRef.current]
    const skillEls   = [skipRef.current, skillRef.current, navRef.current]
    const whyEls     = [whySkipRef.current, whyHeadRef.current, whyNavRef.current]
    const whyCards   = whyCardsRef.current ? Array.from(whyCardsRef.current.children) : []
    const iaEls      = [iaSkipRef.current, iaNavRef.current]
    const iaChips    = iaGridRef.current ? Array.from(iaGridRef.current.children) : []
    const spEls      = [spSkipRef.current, spNavRef.current]
    const spCards    = spGridRef.current ? Array.from(spGridRef.current.children) : []
    const prEls      = [prSkipRef.current, prNavRef.current]
    const prLabels   = prGroupsRef.current ? Array.from(prGroupsRef.current.querySelectorAll('.ob-pr-label')) : []
    const prChips    = prGroupsRef.current ? Array.from(prGroupsRef.current.querySelectorAll('.ob-ai-chip')) : []
    const presFormEls = presFormRef.current ? Array.from(presFormRef.current.children) : []
    const pwdFormEls = pwdFormRef.current ? Array.from(pwdFormRef.current.children) : []
    const planCards = planCardsRef.current ? Array.from(planCardsRef.current.children) : []
    const feedCards = feedCardsRef.current ? Array.from(feedCardsRef.current.children) : []

    const params = new URLSearchParams(window.location.search)
    const ob  = params.get('ob')
    const frz = params.get('frz')
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    reduceRef.current = reduce

    const startStep: Step =
      ob === 'feed' ? 'feed' : ob === 'plan' ? 'plan' : ob === 'password' ? 'password' : ob === 'present' ? 'present' : ob === 'precise' ? 'precise' : ob === 'specialite' ? 'specialite' : ob === 'ia' ? 'ia' : ob === 'why' ? 'why' : ob === 'skill' ? 'skill' : 'welcome'
    const startIdx = STEPS.indexOf(startStep)
    idxRef.current = startIdx

    const done = () => { animatingRef.current = false }

    gsap.set(frank, { transformOrigin: '50% 51%' })
    gsap.set(welcomeEls, { autoAlpha: 0, y: 22 })
    gsap.set(skillEls,   { autoAlpha: 0, y: 24 })
    gsap.set([...whyEls, ...whyCards], { autoAlpha: 0, y: 24 })
    gsap.set([iaHeadRef.current, ...iaEls], { autoAlpha: 0, y: 24 })
    gsap.set(iaChips, { autoAlpha: 0, y: 20, scale: 0.9 })
    gsap.set([spHeadRef.current, ...spEls], { autoAlpha: 0, y: 24 })
    gsap.set(spCards, { autoAlpha: 0, y: 20, scale: 0.9 })
    gsap.set([prHeadRef.current, ...prEls], { autoAlpha: 0, y: 24 })
    gsap.set(prLabels, { autoAlpha: 0, y: 16 })
    gsap.set(prChips, { autoAlpha: 0, y: 20, scale: 0.9 })
    gsap.set([presHeadRef.current, presBackRef.current], { autoAlpha: 0, y: 24 })
    gsap.set(presFormEls, { autoAlpha: 0, y: 20 })
    gsap.set([pwdHeadRef.current, pwdBackRef.current], { autoAlpha: 0, y: 24 })
    gsap.set(pwdFormEls, { autoAlpha: 0, y: 20 })
    gsap.set([planHeadRef.current, planNavRef.current], { autoAlpha: 0, y: 24 })
    gsap.set(planCards, { autoAlpha: 0, y: 24, scale: 0.96 })
    gsap.set(feedSideRef.current, { autoAlpha: 0, x: -40 })
    gsap.set(feedHeadRef.current, { autoAlpha: 0, y: 20 })
    gsap.set(feedCards, { autoAlpha: 0, y: 24, scale: 0.97 })

    const applyMascotKind = (s: keyof typeof FRANK) => {
      const useSkill = s === 'skill'
      gsap.set(frankVideoRef.current, { autoAlpha: useSkill ? 0 : 1 })
      gsap.set(frankSkillRef.current, { autoAlpha: useSkill ? 1 : 0 })
      if (frankVideoRef.current) {
        if (!useSkill && !reduceRef.current) frankVideoRef.current.play().catch(() => {})
        else frankVideoRef.current.pause()
      }
      if (frankSkillRef.current) {
        if (useSkill && !reduceRef.current) frankSkillRef.current.play().catch(() => {})
        else frankSkillRef.current.pause()
      }
    }
    applyMascotKind('welcome')

    const applyFrank = (s: keyof typeof FRANK) => {
      const f = s === 'plan' ? planFrankState() : FRANK[s]
      gsap.set(frank, {
        x: f.x * window.innerWidth,
        y: f.y * window.innerHeight,
        scale: f.scale, rotation: f.rot, opacity: f.opacity,
      })
    }

    // Segment 0 — accueil → « Un clic suffit » : la plongée (inchangée)
    const buildWelcomeSkill = () => {
      const h = window.innerHeight, w = window.innerWidth
      const t = gsap.timeline({ paused: true, onComplete: done, onReverseComplete: done })
      const divePath = [
        { x: 0,         y: FRANK.welcome.y * h },
        { x: -0.05 * w, y: 0.16 * h },
        { x:  0.03 * w, y: 0.52 * h },
        { x: 0,         y: 0.82 * h },          // sort par le bas
      ]
      t.to([btnRef.current, subRef.current, titleRef.current],
        { autoAlpha: 0, y: 16, duration: 0.36, stagger: 0.07, ease: 'power2.in' }, 0)
      const wsLeanOut = makeLean(frank, FRANK.welcome.rot, FRANK.welcome.rot, false)
      t.to(frank, { duration: 0.85, ease: 'power2.in',
        motionPath: { path: divePath, curviness: 1.4, autoRotate: false },
        onStart: wsLeanOut.start, onUpdate: wsLeanOut.update }, 0.08)
      t.to(frank, { opacity: 0, duration: 0.34, ease: 'power2.in' }, 0.55)
      t.set(frankVideoRef.current, { autoAlpha: 0 }, 0.9)
      t.set(frankSkillRef.current, { autoAlpha: 1 }, 0.9)
      // composition-2.webm (écran skill) : pas d'inclinaison dynamique, juste la pose droite
      t.to(frank, { duration: 0.95, ease: 'power3.out',
        motionPath: { path: [{ x: 0, y: 0.82 * h }, { x: 0, y: FRANK.skill.y * h }], autoRotate: false },
        scale: FRANK.skill.scale, rotation: FRANK.skill.rot }, 0.92)
      t.to(frank, { opacity: FRANK.skill.opacity, duration: 0.5, ease: 'power2.out' }, 0.95)
      t.to([skipRef.current, skillRef.current, navRef.current],
        { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.1, ease: 'power2.out' }, 1.3)
      return t
    }

    // Segment 1 — « Un clic suffit » → « Pourquoi Frank ? »
    // Frank (gros plan) sort par le bas, revient minuscule par la gauche
    // et nage derrière les cards (floutées) jusqu'en haut à droite.
    const buildSkillWhy = () => {
      const h = window.innerHeight, w = window.innerWidth
      const t = gsap.timeline({ paused: true, onComplete: done, onReverseComplete: done })

      t.to([navRef.current, skillRef.current, skipRef.current],
        { autoAlpha: 0, y: 16, duration: 0.34, stagger: 0.06, ease: 'power2.in' }, 0)

      // composition-2.webm reste visible jusqu'à 0.74 → pas d'inclinaison sur la plongée
      t.to(frank, { duration: 0.6, ease: 'power2.in',
        motionPath: { path: [
          { x: 0,        y: FRANK.skill.y * h },
          { x: 0.05 * w, y: 0.74 * h },
          { x: 0,        y: 1.08 * h },
        ], curviness: 1.3, autoRotate: false }, rotation: FRANK.skill.rot }, 0.1)
      t.to(frank, { opacity: 0, duration: 0.3, ease: 'power2.in' }, 0.42)
      t.set(frankSkillRef.current, { autoAlpha: 0 }, 0.74)
      t.set(frankVideoRef.current, { autoAlpha: 1 }, 0.74)

      // Téléportation à gauche pendant qu'il est invisible, en tout petit
      t.set(frank, { x: -0.55 * w, y: 0.02 * h, scale: FRANK.why.scale, rotation: FRANK.why.rot }, 0.7)
      const swLeanIn = makeLean(frank, FRANK.why.rot, FRANK.why.rot, true)
      t.to(frank, { duration: 1.05, ease: 'power2.out',
        motionPath: { path: [
          { x: -0.55 * w, y: 0.02 * h },
          { x: -0.08 * w, y: 0.2 * h },
          { x:  0.16 * w, y: 0.04 * h },
          { x: FRANK.why.x * w, y: FRANK.why.y * h },
        ], curviness: 1.3, autoRotate: false },
        onStart: swLeanIn.start, onUpdate: swLeanIn.update }, 0.74)
      t.to(frank, { opacity: FRANK.why.opacity, duration: 0.45, ease: 'power1.out' }, 0.78)

      // Les cards d'abord (pour voir Frank flouté en passant derrière), puis en-tête + nav
      t.to(whyCards, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.1, ease: 'power2.out' }, 0.5)
      t.to([whySkipRef.current, whyHeadRef.current, whyNavRef.current],
        { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.08, ease: 'power2.out' }, 0.72)

      return t
    }

    // Segment 2 — « Pourquoi Frank ? » → « Quelles IA tu utilises ? »
    // Frank (petit, en haut à droite) nage vers le haut en lâchant des bulles
    // d'interrogation (écho au titre), puis réapparaît en gros plan par le bas.
    const buildWhyIa = () => {
      const h = window.innerHeight, w = window.innerWidth
      const t = gsap.timeline({ paused: true, onComplete: done, onReverseComplete: done })

      // Sortie de l'écran « Pourquoi Frank ? »
      t.to([whyNavRef.current, whyHeadRef.current, whySkipRef.current],
        { autoAlpha: 0, y: 16, duration: 0.34, stagger: 0.06, ease: 'power2.in' }, 0)
      t.to(whyCards, { autoAlpha: 0, y: 16, duration: 0.32, stagger: 0.05, ease: 'power2.in' }, 0)

      // Frank nage vers le haut et disparaît complètement par le plafond
      // (opacité 0 atteinte AVANT la téléportation, pour qu'aucun aller-retour
      //  ne soit visible : il s'efface en haut, on le réapparaît neuf par le bas)
      const wiLeanOut = makeLean(frank, FRANK.why.rot, FRANK.why.rot, false)
      t.to(frank, { duration: 0.6, ease: 'power2.in',
        motionPath: { path: [
          { x: FRANK.why.x * w, y: FRANK.why.y * h },
          { x: 0.30 * w,        y: -0.46 * h },
          { x: 0.22 * w,        y: -0.95 * h },
        ], curviness: 1.3, autoRotate: false },
        onStart: wiLeanOut.start, onUpdate: wiLeanOut.update }, 0.12)
      t.to(frank, { opacity: 0, duration: 0.26, ease: 'power2.in' }, 0.40)

      // Invisible : on téléporte Frank tout en bas (montée finie à 0.72,
      //  opacité déjà nulle depuis 0.66 → la téléportation ne sera pas écrasée)
      t.set(frank, { x: FRANK.ia.x * w, y: 1.05 * h, scale: FRANK.ia.scale, rotation: FRANK.ia.rot }, 0.72)
      // Réapparition en gros plan en remontant par le bas, décalé à gauche
      const wiLeanIn = makeLean(frank, FRANK.ia.rot, FRANK.ia.rot, true)
      t.to(frank, { duration: 0.95, ease: 'power3.out',
        motionPath: { path: [
          { x: FRANK.ia.x * w, y: 1.05 * h },
          { x: FRANK.ia.x * w, y: FRANK.ia.y * h },
        ], autoRotate: false },
        onStart: wiLeanIn.start, onUpdate: wiLeanIn.update }, 0.72)
      t.to(frank, { opacity: FRANK.ia.opacity, duration: 0.5, ease: 'power2.out' }, 0.78)

      // Entrée de l'écran « Quelles IA »
      t.to(iaHeadRef.current, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power2.out' }, 1.0)
      t.to(iaChips, { autoAlpha: 1, y: 0, scale: 1, duration: 0.45, stagger: 0.05, ease: 'back.out(1.5)' }, 1.08)
      t.to([iaSkipRef.current, iaNavRef.current],
        { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.08, ease: 'power2.out' }, 1.18)

      return t
    }

    // Segment 3 — « Quelles IA » → « Quelle est ta spécialité ? »
    // Frank glisse doucement vers sa position spécialité (plus petit, plus bas à gauche)
    // pendant que le contenu change autour de lui.
    const buildIaSpecialite = () => {
      const h = window.innerHeight, w = window.innerWidth
      const t = gsap.timeline({ paused: true, onComplete: done, onReverseComplete: done })

      // Sortie de l'écran IA
      t.to([iaNavRef.current, iaSkipRef.current],
        { autoAlpha: 0, y: 16, duration: 0.32, stagger: 0.06, ease: 'power2.in' }, 0)
      t.to(iaHeadRef.current, { autoAlpha: 0, y: -16, duration: 0.34, ease: 'power2.in' }, 0)
      t.to(iaChips, { autoAlpha: 0, y: 40, scale: 0.88, duration: 0.36, stagger: 0.03, ease: 'power2.in' }, 0)

      // Frank glisse vers sa pose spécialité (plus bas à gauche, plus petit)
      const spLean = makeLean(frank, FRANK.ia.rot, FRANK.specialite.rot, true)
      t.to(frank, { duration: 1.1, ease: 'sine.inOut',
        scale: FRANK.specialite.scale, rotation: FRANK.specialite.rot,
        motionPath: { path: [
          { x: FRANK.ia.x * w,         y: FRANK.ia.y * h },
          { x: FRANK.specialite.x * w, y: FRANK.specialite.y * h },
        ], curviness: 1, autoRotate: false },
        onStart: spLean.start, onUpdate: spLean.update }, 0.1)
      t.to(frank, { opacity: FRANK.specialite.opacity, duration: 0.7, ease: 'power1.out' }, 0.2)

      // Entrée de l'écran spécialité
      t.to(spHeadRef.current, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power2.out' }, 0.44)
      t.to(spCards, { autoAlpha: 1, y: 0, scale: 1, duration: 0.45, stagger: 0.05, ease: 'back.out(1.5)' }, 0.52)
      t.to([spSkipRef.current, spNavRef.current],
        { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.08, ease: 'power2.out' }, 0.68)

      return t
    }

    // Segment 4 — « Spécialité » → « Plus précisément ? »
    // Frank rapetisse (gros plan → petit) et nage vers l'espace vide à gauche,
    // derrière les cartes (z-order), pendant que les tags entrent à droite.
    const buildSpecialitePrecise = () => {
      const h = window.innerHeight, w = window.innerWidth
      const t = gsap.timeline({ paused: true, onComplete: done, onReverseComplete: done })

      // Sortie de l'écran spécialité
      t.to([spNavRef.current, spSkipRef.current],
        { autoAlpha: 0, y: 16, duration: 0.32, stagger: 0.06, ease: 'power2.in' }, 0)
      t.to(spHeadRef.current, { autoAlpha: 0, y: -16, duration: 0.34, ease: 'power2.in' }, 0)
      t.to(spCards, { autoAlpha: 0, y: 24, scale: 0.9, duration: 0.4, stagger: 0.04, ease: 'power2.in' }, 0)

      // Frank rapetisse et nage du gros plan vers la gauche-centre (reste visible,
      // derrière les cartes) ; profondeur → il s'estompe un peu en s'éloignant.
      const prLean = makeLean(frank, FRANK.specialite.rot, FRANK.precise.rot, true)
      t.to(frank, { duration: 1.5, ease: 'sine.inOut',
        scale: FRANK.precise.scale, rotation: FRANK.precise.rot,
        motionPath: { path: [
          { x: FRANK.specialite.x * w, y: FRANK.specialite.y * h },
          { x: -0.23 * w,              y: 0.11 * h },   // point doux, sur le trajet (pas de crochet)
          { x: FRANK.precise.x * w,    y: FRANK.precise.y * h },
        ], curviness: 1.6, autoRotate: false },
        onStart: prLean.start, onUpdate: prLean.update }, 0.15)
      t.to(frank, { opacity: FRANK.precise.opacity, duration: 0.9, ease: 'power1.out' }, 0.4)

      // Entrée de « Plus précisément ? » : titre, puis les groupes en stagger
      t.to(prHeadRef.current, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power2.out' }, 0.7)
      // Cascade GLOBALE continue des cases (une à une), et CHAQUE label apparaît
      // juste avant SES propres cases (sync par catégorie) → plus de titre
      // « Expertise »/« Outils » qui arrive en avance sur ses chips.
      const prGroupEls = prGroupsRef.current ? Array.from(prGroupsRef.current.children) : []
      const CHIP_AT = 0.82, CHIP_STEP = 0.04
      let chipIdx = 0
      prGroupEls.forEach(group => {
        const label = group.querySelector('.ob-pr-label')
        const chips = Array.from(group.querySelectorAll('.ob-ai-chip'))
        const groupStart = CHIP_AT + chipIdx * CHIP_STEP
        if (label) t.to(label, { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power2.out' }, groupStart - 0.06)
        t.to(chips, { autoAlpha: 1, y: 0, scale: 1, duration: 0.42, stagger: CHIP_STEP, ease: 'back.out(1.4)' }, groupStart)
        chipIdx += chips.length
      })
      t.to([prSkipRef.current, prNavRef.current],
        { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.08, ease: 'power2.out' }, 1.0)

      return t
    }

    // Segment 5 — « Plus précisément ? » → « On se présente »
    // Frank dérive doucement vers le premier plan gauche (un peu plus grand, droit)
    // pendant que le formulaire entre à droite. Mouvement doux (sine.inOut).
    const buildPrecisePresent = () => {
      const h = window.innerHeight, w = window.innerWidth
      const t = gsap.timeline({ paused: true, onComplete: done, onReverseComplete: done })

      // Sortie de « Plus précisément ? »
      t.to([prNavRef.current, prSkipRef.current],
        { autoAlpha: 0, y: 16, duration: 0.3, stagger: 0.06, ease: 'power2.in' }, 0)
      t.to(prHeadRef.current, { autoAlpha: 0, y: -16, duration: 0.34, ease: 'power2.in' }, 0)
      // Nœuds re-interrogés à la construction : les groupes dépendent du domaine
      // (PRECISE_BY_DOMAIN) et sont remplacés par React après le montage → on ne
      // fige pas la capture initiale, sinon la sortie animerait d'anciens nœuds.
      const prLabelsNow = prGroupsRef.current ? Array.from(prGroupsRef.current.querySelectorAll('.ob-pr-label')) : []
      const prChipsNow  = prGroupsRef.current ? Array.from(prGroupsRef.current.querySelectorAll('.ob-ai-chip')) : []
      t.to([...prLabelsNow, ...prChipsNow], { autoAlpha: 0, y: 16, duration: 0.34, stagger: 0.015, ease: 'power2.in' }, 0)

      // Frank avance au premier plan gauche (plus grand, droit) — dérive douce et
      // DIRECTE : trajet 2 points, sans point intermédiaire au-dessus de la cible
      // (l'ancien passait par y:0.02 puis redescendait à y:0.06 → Frank montait trop
      // haut puis se reposait, d'où le « dépassement » peu fluide). curviness 1, à
      // l'image du segment present → password.
      const presLean = makeLean(frank, FRANK.precise.rot, FRANK.present.rot, true)
      t.to(frank, { duration: 1.2, ease: 'sine.inOut',
        scale: FRANK.present.scale, rotation: FRANK.present.rot,
        motionPath: { path: [
          { x: FRANK.precise.x * w,  y: FRANK.precise.y * h },
          { x: FRANK.present.x * w,  y: FRANK.present.y * h },
        ], curviness: 1, autoRotate: false },
        onStart: presLean.start, onUpdate: presLean.update }, 0.1)
      t.to(frank, { opacity: FRANK.present.opacity, duration: 0.8, ease: 'power1.out' }, 0.3)

      // Entrée de « On se présente » : titre, formulaire (éléments un à un), puis Retour
      t.to(presHeadRef.current, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power2.out' }, 0.7)
      t.to(presFormEls, { autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.1, ease: 'power2.out' }, 0.82)
      t.to(presBackRef.current, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power2.out' }, 1.1)

      return t
    }

    // Segment 6 — « On se présente » → « Créer ton mot de passe »
    // Même type d'écran : Frank reste dans la moitié gauche (dérive minime),
    // le formulaire mot de passe entre à droite.
    const buildPresentPassword = () => {
      const h = window.innerHeight, w = window.innerWidth
      const t = gsap.timeline({ paused: true, onComplete: done, onReverseComplete: done })

      // Sortie de « On se présente »
      t.to(presBackRef.current, { autoAlpha: 0, y: 16, duration: 0.3, ease: 'power2.in' }, 0)
      t.to(presHeadRef.current, { autoAlpha: 0, y: -16, duration: 0.34, ease: 'power2.in' }, 0)
      t.to(presFormEls, { autoAlpha: 0, y: 16, duration: 0.36, stagger: 0.05, ease: 'power2.in' }, 0)

      // Frank dérive doucement vers sa pose « password » (reste à gauche)
      const pwdLean = makeLean(frank, FRANK.present.rot, FRANK.password.rot, true)
      t.to(frank, { duration: 1.1, ease: 'sine.inOut',
        scale: FRANK.password.scale, rotation: FRANK.password.rot,
        motionPath: { path: [
          { x: FRANK.present.x * w,  y: FRANK.present.y * h },
          { x: FRANK.password.x * w, y: FRANK.password.y * h },
        ], curviness: 1, autoRotate: false },
        onStart: pwdLean.start, onUpdate: pwdLean.update }, 0.1)
      t.to(frank, { opacity: FRANK.password.opacity, duration: 0.7, ease: 'power1.out' }, 0.3)

      // Entrée de « Créer ton mot de passe »
      t.to(pwdHeadRef.current, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power2.out' }, 0.7)
      t.to(pwdFormEls, { autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.1, ease: 'power2.out' }, 0.82)
      t.to(pwdBackRef.current, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power2.out' }, 1.1)

      return t
    }

    // Segment 7 — « Créer ton mot de passe » → « Choisis ton plan »
    // Frank nage de la gauche vers le coin haut-droit en rapetissant (derrière les
    // cartes), pendant que les 3 offres entrent une à une.
    const buildPasswordPlan = () => {
      const h = window.innerHeight, w = window.innerWidth
      const t = gsap.timeline({ paused: true, onComplete: done, onReverseComplete: done })

      // Sortie de « Créer ton mot de passe »
      t.to(pwdBackRef.current, { autoAlpha: 0, y: 16, duration: 0.3, ease: 'power2.in' }, 0)
      t.to(pwdHeadRef.current, { autoAlpha: 0, y: -16, duration: 0.34, ease: 'power2.in' }, 0)
      t.to(pwdFormEls, { autoAlpha: 0, y: 16, duration: 0.36, stagger: 0.05, ease: 'power2.in' }, 0)

      // Frank nage en diagonale vers le coin haut-droit de la carte Expert, en
      // rapetissant. curviness 1 (au lieu de 1.4) : la courbe ne gonfle plus au point
      // de dépasser le coin avant de se caler → arrivée plus nette.
      const pf = planFrankState()
      const planLean = makeLean(frank, FRANK.password.rot, pf.rot, true)
      t.to(frank, { duration: 1.35, ease: 'sine.inOut',
        scale: pf.scale, rotation: pf.rot,
        motionPath: { path: [
          { x: FRANK.password.x * w, y: FRANK.password.y * h },
          { x: 0.05 * w,             y: -0.08 * h },
          { x: pf.x * w,             y: pf.y * h },
        ], curviness: 1, autoRotate: false },
        onStart: planLean.start, onUpdate: planLean.update }, 0.1)
      t.to(frank, { opacity: pf.opacity, duration: 0.8, ease: 'power1.out' }, 0.4)

      // Entrée de « Choisis ton plan » : titre, puis les 3 offres une à une
      t.to(planHeadRef.current, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power2.out' }, 0.8)
      t.to(planCards, { autoAlpha: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.12, ease: 'back.out(1.4)' }, 0.92)
      t.to(planNavRef.current, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power2.out' }, 1.2)

      return t
    }

    // Segment 8 — « Choisis ton plan » → feed (arrivée sur l'app)
    // Frank plonge vers le coin bas-gauche en rapetissant puis s'efface (il « entre »
    // dans l'app) ; la sidebar glisse depuis la gauche, le bandeau et les cartes se
    // matérialisent. La mascotte de domaine prend la place de Frank en bas de sidebar.
    const buildPlanFeed = () => {
      const h = window.innerHeight, w = window.innerWidth
      const t = gsap.timeline({ paused: true, onComplete: done, onReverseComplete: done })

      // Sortie de « Choisis ton plan »
      t.to(planHeadRef.current, { autoAlpha: 0, y: -16, duration: 0.34, ease: 'power2.in' }, 0)
      t.to(planNavRef.current, { autoAlpha: 0, y: 16, duration: 0.3, ease: 'power2.in' }, 0)
      t.to(planCards, { autoAlpha: 0, y: 24, scale: 0.96, duration: 0.4, stagger: 0.05, ease: 'power2.in' }, 0)

      // Frank plonge vers le bas-gauche en rapetissant, puis s'efface (entre dans l'app)
      const pf = planFrankState()
      const feedLean = makeLean(frank, pf.rot, FRANK.feed.rot, true)
      t.to(frank, { duration: 0.95, ease: 'power2.in',
        scale: FRANK.feed.scale, rotation: FRANK.feed.rot,
        motionPath: { path: [
          { x: pf.x * w,         y: pf.y * h },
          { x: -0.15 * w,        y: 0.2 * h },
          { x: FRANK.feed.x * w, y: FRANK.feed.y * h },
        ], curviness: 1.3, autoRotate: false },
        onStart: feedLean.start, onUpdate: feedLean.update }, 0.1)
      t.to(frank, { opacity: 0, duration: 0.4, ease: 'power2.in' }, 0.7)

      // L'app se matérialise : sidebar depuis la gauche, bandeau, puis cartes une à une
      t.to(feedSideRef.current, { autoAlpha: 1, x: 0, duration: 0.6, ease: 'power3.out' }, 0.7)
      t.to(feedHeadRef.current, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power2.out' }, 0.95)
      t.to(feedCards, { autoAlpha: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.08, ease: 'back.out(1.3)' }, 1.1)

      return t
    }

    const buildSegments = () => {
      segsRef.current.forEach(t => t.kill())
      segsRef.current = [buildWelcomeSkill(), buildSkillWhy(), buildWhyIa(), buildIaSpecialite(), buildSpecialitePrecise(), buildPrecisePresent(), buildPresentPassword(), buildPasswordPlan(), buildPlanFeed()]
    }

    // Quand le domaine change, l'écran « Plus précisément ? » reçoit de nouveaux
    // groupes (PRECISE_BY_DOMAIN) → React remplace ses chips/labels. On re-cache
    // (ou ré-affiche si l'écran est déjà passé) ces nouveaux nœuds puis on
    // reconstruit les segments qui les référencent. Même logique qu'onResize.
    rebuildPreciseRef.current = () => {
      if (animatingRef.current) return
      const labels = prGroupsRef.current ? Array.from(prGroupsRef.current.querySelectorAll('.ob-pr-label')) : []
      const chips  = prGroupsRef.current ? Array.from(prGroupsRef.current.querySelectorAll('.ob-ai-chip')) : []
      const i = idxRef.current
      const passed = i > STEPS.indexOf('precise')
      gsap.set(labels, passed ? { autoAlpha: 1, y: 0 } : { autoAlpha: 0, y: 16 })
      gsap.set(chips,  passed ? { autoAlpha: 1, y: 0, scale: 1 } : { autoAlpha: 0, y: 20, scale: 0.9 })
      buildSegments()
      segsRef.current.forEach((t, k) => t.progress(k < i ? 1 : 0))
    }

    let intro: gsap.core.Timeline | undefined

    // Flottement idle (cf. startFloat) : créé à amplitude nulle ; il éclot pendant
    // l'intro (dézoom gros plan → petit) ou apparaît en fondu en aperçu d'écran.
    // Pas de flottement en reduced-motion ni en aperçu scrubé (frz) — captures stables.
    const float =
      frankFloatRef.current && !reduce && frz === null ? startFloat(frankFloatRef.current) : null

    if (ob || frz !== null) {
      // Aperçu figé : on pose l'état de départ et on scrub éventuellement le bon segment
      applyFrank(startStep)
      applyMascotKind(startStep)
      if (startStep === 'welcome') gsap.set(welcomeEls, { autoAlpha: 1, y: 0 })
      else if (startStep === 'skill') gsap.set(skillEls, { autoAlpha: 1, y: 0 })
      else if (startStep === 'why') gsap.set([...whyEls, ...whyCards], { autoAlpha: 1, y: 0 })
      else if (startStep === 'ia') gsap.set([iaHeadRef.current, ...iaEls, ...iaChips], { autoAlpha: 1, y: 0, scale: 1 })
      else if (startStep === 'specialite') gsap.set([spHeadRef.current, ...spEls, ...spCards], { autoAlpha: 1, y: 0, scale: 1 })
      else if (startStep === 'precise') gsap.set([prHeadRef.current, ...prEls, ...prLabels, ...prChips], { autoAlpha: 1, y: 0, scale: 1 })
      else if (startStep === 'present') gsap.set([presHeadRef.current, presBackRef.current, ...presFormEls], { autoAlpha: 1, y: 0 })
      else if (startStep === 'password') gsap.set([pwdHeadRef.current, pwdBackRef.current, ...pwdFormEls], { autoAlpha: 1, y: 0 })
      else if (startStep === 'plan') gsap.set([planHeadRef.current, planNavRef.current, ...planCards], { autoAlpha: 1, y: 0, scale: 1 })
      else gsap.set([feedSideRef.current, feedHeadRef.current, ...feedCards], { autoAlpha: 1, x: 0, y: 0, scale: 1 })
      buildSegments()
      if (frz !== null) {
        const seg = segsRef.current[Math.min(startIdx, segsRef.current.length - 1)]
        seg.progress(parseFloat(frz))
      } else if (float) {
        // Aperçu figé d'un écran (pas de dézoom) : le flottement apparaît en fondu doux.
        gsap.to(float.state, { amp: 1, duration: 0.8, ease: 'power1.out' })
      }
    } else {
      // Gros plan d'ouverture : les yeux pile au centre, puis dézoom vers l'accueil
      applyFrank('intro')
      // Décor océanique masqué tant que Frank emplit l'écran (ses coins transparents
      // laisseraient voir le fond à quelques moments) → révélé en fondu au dézoom.
      gsap.set(bgDecoRef.current, { autoAlpha: 0 })
      intro = gsap.timeline({ delay: reduce ? 0 : 1.0 })
      if (reduce) {
        applyFrank('welcome')
        gsap.set(welcomeEls, { autoAlpha: 1, y: 0 })
        gsap.set(bgDecoRef.current, { autoAlpha: 1 })
      } else {
        // Lueur coupée pendant le gros plan (hors-champ à ce scale, mais lourde au GPU) ;
        // rétablie en cours de dézoom. Évite la saturation GPU qui faisait tout buguer.
        frank?.classList.add('is-intro')
        intro.to(frank, {
          x: 0, y: FRANK.welcome.y * window.innerHeight,
          scale: FRANK.welcome.scale, rotation: FRANK.welcome.rot, opacity: FRANK.welcome.opacity,
          duration: 1.1, ease: 'expo.out',
        })
        .to(bgDecoRef.current, { autoAlpha: 1, duration: 0.9, ease: 'power2.out' }, 0)
        .to(welcomeEls, {
          autoAlpha: 1, y: 0, stagger: 0.13, duration: 0.55, ease: 'power2.out',
        }, '-=0.4')
        // Le flottement éclot pile pendant le dézoom (gros plan → Frank petit).
        if (float) intro.to(float.state, { amp: 1, duration: 1.1, ease: 'power1.inOut' }, 0)
        // Lueur rétablie une fois Frank assez dézoomé (~0,4 s : scale déjà petit → coût GPU négligeable).
        intro.add(() => frank?.classList.remove('is-intro'), 0.4)
      }
      buildSegments()
    }

    // Traînée de bulles : un ticker lit la position de Frank image par image.
    // En déplacement (animatingRef) → émission liée à la DISTANCE parcourue.
    // Au repos → émission temporelle très clairsemée (il respire sur place).
    // L'opacité des bulles suit sa profondeur ; téléportations (saut énorme) et
    // moments invisibles (opacité basse) sont ignorés pour ne pas émettre à vide.
    const trailLayer = trailRef.current
    let trailEmitter: ((time: number, dt: number) => void) | null = null
    if (trailLayer && !reduce) {
      const pool = Array.from(trailLayer.children) as HTMLElement[]
      gsap.set(pool, { xPercent: -50, yPercent: -50 })
      let slot = 0
      let lx: number | null = null
      let ly = 0
      let acc = 0                                              // distance accumulée (déplacement)
      let idleAcc = 0                                          // temps accumulé en ms (repos)
      let idleTarget = gsap.utils.random(TRAIL_IDLE_MIN, TRAIL_IDLE_MAX) * 1000
      let wasEligible = false                                  // déjà posé sur un écran ?

      const emit = (cx: number, cy: number, depth: number, appSize: number) => {
        const b = pool[slot]
        slot = (slot + 1) % pool.length
        gsap.killTweensOf(b)                       // recycle la bulle la plus ancienne
        // Taille proportionnelle à la taille apparente de Frank (cf. constantes).
        const size  = gsap.utils.clamp(TRAIL_SIZE_MIN, TRAIL_SIZE_MAX,
          appSize * gsap.utils.random(TRAIL_SIZE_RATIO_MIN, TRAIL_SIZE_RATIO_MAX))
        const rise  = gsap.utils.random(34, 78)    // montée (px) — les bulles remontent
        const drift = gsap.utils.random(-22, 22)   // dérive latérale
        // Opacité au pic liée à la profondeur de Frank (son opacité courante) :
        // loin/estompé → bulles discrètes → se lisent bien derrière lui.
        const peak  = gsap.utils.random(0.4, 0.7) * depth
        const life  = gsap.utils.random(1.8, 2.6)  // durée de vie totale (s)
        gsap.set(b, { width: size, height: size })
        const tl = gsap.timeline()
        tl.set(b, { x: cx + gsap.utils.random(-12, 12), y: cy + gsap.utils.random(-12, 12),
                    scale: 0.2, autoAlpha: 0 })
        tl.to(b, { scale: 1, autoAlpha: peak, duration: 0.4, ease: 'back.out(2)' }, 0)
        tl.to(b, { y: '-=' + rise, x: '+=' + drift, duration: life, ease: 'sine.out' }, 0)
        tl.to(b, { scale: 0.4, autoAlpha: 0, duration: 0.9, ease: 'power2.in' }, life - 0.9)
      }

      // Point d'apparition AU REPOS : sur un côté ou au-dessus de Frank, jamais
      // sur son corps. L'écart suit sa taille apparente (largeur CSS × --ss ×
      // scale courant, même formule que la couche bulles « ? »), puis on clampe
      // à l'écran pour ne pas émettre dans le vide hors cadre.
      const idleSpawn = (cx: number, cy: number, appSize: number) => {
        const w = window.innerWidth, h = window.innerHeight
        let sx = cx, sy = cy
        switch (gsap.utils.random(['up', 'left', 'right'])) {
          case 'left':
            sx = cx - gsap.utils.random(0.38, 0.52) * appSize
            sy = cy + gsap.utils.random(-0.26, 0.14) * appSize
            break
          case 'right':
            sx = cx + gsap.utils.random(0.38, 0.52) * appSize
            sy = cy + gsap.utils.random(-0.26, 0.14) * appSize
            break
          default: // au-dessus
            sx = cx + gsap.utils.random(-0.26, 0.26) * appSize
            sy = cy - gsap.utils.random(0.4, 0.56) * appSize
        }
        return { x: gsap.utils.clamp(24, w - 24, sx), y: gsap.utils.clamp(24, h - 24, sy) }
      }

      trailEmitter = (_time, dt) => {
        const op    = parseFloat(String(gsap.getProperty(frank, 'opacity')))
        const scale = parseFloat(String(gsap.getProperty(frank, 'scale')))
        const x     = parseFloat(String(gsap.getProperty(frank, 'x')))
        const y     = parseFloat(String(gsap.getProperty(frank, 'y')))
        const cx = window.innerWidth / 2 + x
        const cy = window.innerHeight / 2 + y
        const depth = gsap.utils.clamp(0, 1, op)
        const appSize = FRANK_SS * Math.min(0.26 * window.innerWidth, 360) * scale

        // Pas de bulles tant que c'est la mascotte « Un clic suffit » (vidéo
        // composition-2) qui est à l'écran : elle arrive et se pose sans traînée.
        const skillActive = !!frankSkillRef.current &&
          parseFloat(String(gsap.getProperty(frankSkillRef.current, 'opacity'))) > 0.5
        if (skillActive) { lx = null; acc = 0; idleAcc = 0; wasEligible = false; return }

        if (animatingRef.current) {
          // Déplacement : une bulle tous les TRAIL_EMIT_EVERY px parcourus.
          idleAcc = 0
          wasEligible = false                              // l'arrivée déclenchera une 1re bulle rapide
          if (lx === null) { lx = x; ly = y; return }
          const dx = x - lx, dy = y - ly
          const d = Math.sqrt(dx * dx + dy * dy)
          lx = x; ly = y
          if (d > TRAIL_MAX_STEP || op < 0.25) { acc = 0; return }  // téléportation / invisible
          acc += d
          while (acc >= TRAIL_EMIT_EVERY) {
            acc -= TRAIL_EMIT_EVERY
            emit(cx, cy, depth, appSize)
          }
        } else {
          // Repos : émission temporelle clairsemée tant que Frank est posé sur un
          // écran (scale < 0.9 exclut le gros plan d'intro) et visible — inclut
          // l'accueil « Salut, moi c'est Frank ».
          lx = null; acc = 0
          // Sur « Quelles IA ? » et « Quelle spécialité ? », ce sont les bulles
          // « ? » qui animent Frank au repos → pas de traînée idle ici (doublon).
          const cur = STEPS[idxRef.current]
          if (cur === 'ia' || cur === 'specialite') { idleAcc = 0; wasEligible = false; return }
          if (op < 0.4 || scale >= 0.9) { idleAcc = 0; wasEligible = false; return }
          if (!wasEligible) {                  // fraîchement posé sur l'écran → 1re bulle rapide
            wasEligible = true
            idleAcc = 0
            idleTarget = gsap.utils.random(0.5, 1.2) * 1000
          }
          idleAcc += dt
          if (idleAcc >= idleTarget) {
            idleAcc = 0
            idleTarget = gsap.utils.random(TRAIL_IDLE_MIN, TRAIL_IDLE_MAX) * 1000
            const s = idleSpawn(cx, cy, appSize)  // sur un côté ou au-dessus, pas sur le corps
            emit(s.x, s.y, depth, appSize)
          }
        }
      }
      gsap.ticker.add(trailEmitter)
    }

    // Recalage si la fenêtre change (les chemins sont en px) : on reconstruit
    // et on cale chaque segment sur l'étape courante.
    const onResize = () => {
      frank?.classList.remove('is-intro')   // filet : si on resize pendant le gros plan, la lueur n'y reste pas coincée
      if (animatingRef.current) return
      const i = idxRef.current
      buildSegments()
      segsRef.current.forEach((t, k) => t.progress(k < i ? 1 : 0))
      applyFrank(STEPS[i])
      applyMascotKind(STEPS[i])
    }
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      intro?.kill()
      float?.driver.kill()
      if (float) gsap.killTweensOf(float.state)
      segsRef.current.forEach(t => t.kill())
      if (trailEmitter) gsap.ticker.remove(trailEmitter)
      if (trailLayer) gsap.killTweensOf(Array.from(trailLayer.children))
    }
  }, [])

  useEffect(() => {
    if (reduceRef.current) return
    if (step === 'skill') {
      frankVideoRef.current?.pause()
      frankSkillRef.current?.play().catch(() => {})
    } else {
      frankSkillRef.current?.pause()
      frankVideoRef.current?.play().catch(() => {})
    }
  }, [step])

  // Bulles d'interrogation : Frank en gros plan « réfléchit » en continu sur les
  // écrans « Quelles IA ? » et « Quelle spécialité ? » (mêmes coordonnées). La
  // boucle tourne tant qu'on reste sur ce slide et s'arrête au changement d'écran
  // (cleanup). Démarrage différé le temps qu'il arrive.
  useEffect(() => {
    const layer = bubblesRef.current
    if ((step !== 'ia' && step !== 'specialite') || reduceRef.current || !layer) return

    const bubbles = Array.from(layer.children)
    const fst = FRANK[step]                              // ia et specialite : même position
    const seg = segsRef.current[STEPS.indexOf(step) - 1]
    const startDelay = animatingRef.current && seg ? seg.duration() * 1000 : 0
    const loops: gsap.core.Timeline[] = []
    let cancelled = false

    const launch = () => {
      if (cancelled) return
      const h = window.innerHeight, w = window.innerWidth
      // base CSS réelle = FRANK_SS × min(26vw, 360px) ; × scale (déjà /FRANK_SS) ⇒ hauteur réelle inchangée.
      const frankH = FRANK_SS * Math.min(0.26 * w, 360) * fst.scale
      // Origine = sur la tête de Frank (recentrée verticalement)
      gsap.set(layer, { x: w / 2 + fst.x * w, y: h / 2 + fst.y * h - frankH * 0.10 })
      gsap.set(bubbles, { xPercent: -50, yPercent: -50 })
      bubbles.forEach((b, i) => {
        const cfg = QUESTION_BUBBLES[i % QUESTION_BUBBLES.length]
        const peak = cfg.q ? 1 : 0.82
        const tl = gsap.timeline({ repeat: -1, repeatDelay: 2.2, delay: cfg.delay })
        // état initial : minuscule et invisible, posée autour d'elle
        tl.set(b, { x: cfg.dx, y: cfg.dy, scale: 0.2, autoAlpha: 0 })
        // 1) pop : grossit d'un coup autour d'elle
        tl.to(b, { scale: 1, autoAlpha: peak, duration: 0.5, ease: 'back.out(1.7)' }, 0)
        // 2) dérive lente vers le haut, tout près d'elle
        tl.to(b, { x: cfg.dx + cfg.drift, y: cfg.dy - cfg.rise * h, duration: 2.7, ease: 'sine.out' }, 0)
        // 3) disparition : la taille ET l'opacité se réduisent
        tl.to(b, { scale: 0.34, autoAlpha: 0, duration: 1.0, ease: 'power2.in' }, 1.7)
        loops.push(tl)
      })
    }

    const id = window.setTimeout(launch, startDelay)
    return () => {
      cancelled = true
      clearTimeout(id)
      loops.forEach(tl => tl.kill())
      gsap.set(bubbles, { autoAlpha: 0, scale: 0 })
    }
  }, [step])

  // Le domaine choisi (1re spécialité) détermine les groupes de « Plus précisément ? ».
  // Quand il change : on repart sur des choix vierges (autre domaine = autres choix)
  // et on reconstruit les segments concernés (React a remplacé les chips de l'écran).
  useEffect(() => {
    if (domainInitRef.current) { domainInitRef.current = false; return }
    setSelectedPrecise(new Set())
    rebuildPreciseRef.current?.()
  }, [primaryDomain])

  const goNext = () => {
    const i = idxRef.current
    if (animatingRef.current || i >= STEPS.length - 1) return
    idxRef.current = i + 1
    setStep(STEPS[i + 1])
    if (reduceRef.current) { segsRef.current[i].progress(1); return }
    animatingRef.current = true
    segsRef.current[i].play()
  }

  const goToPresent = () => {
    if (animatingRef.current) return
    const targetIdx = STEPS.indexOf('present')
    const current = idxRef.current
    if (current >= targetIdx) return
    for (let k = current; k < targetIdx; k++) segsRef.current[k].progress(1)
    idxRef.current = targetIdx
    setStep('present')
  }

  const goToFeed = () => {
    if (animatingRef.current) return
    const targetIdx = STEPS.indexOf('feed')
    const current = idxRef.current
    if (current >= targetIdx) return
    for (let k = current; k < targetIdx; k++) segsRef.current[k].progress(1)
    idxRef.current = targetIdx
    setStep('feed')
  }

  const goPrev = () => {
    const i = idxRef.current
    if (animatingRef.current || i <= 0) return
    idxRef.current = i - 1
    setStep(STEPS[i - 1])
    if (reduceRef.current) { segsRef.current[i - 1].progress(0); return }
    animatingRef.current = true
    segsRef.current[i - 1].reverse()
  }

  const toggleAi = (name: string) => {
    setSelectedAis(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  // Spécialité = choix multiple (comme les IA) ; re-cliquer désélectionne.
  const toggleSpec = (id: Spec) =>
    setSelectedSpecs(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  // « Plus précisément ? » = tags multi-select groupés ; clé = `${groupe}|${option}`.
  const togglePrecise = (key: string) =>
    setSelectedPrecise(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <div className={`ob-root onboarding-bg is-${step}`}>
      {step !== 'feed' && (
        <button className="nav-btn" onClick={goToFeed}>Feed →</button>
      )}

      {/* Décor océanique : masqué pendant le gros plan d'intro, révélé en fondu
          pendant le dézoom (cf. effet d'intro). La base sombre reste, elle, visible. */}
      <div ref={bgDecoRef} className="ob-bg-deco" aria-hidden="true" />

      {/* Couche Frank — découplée du contenu pour « nager » d'un écran à l'autre */}
      <div className="ob-frank-layer">
        <div ref={frankRef} className="ob-frank">
          {/* Wrapper interne : porte le flottement idle (wiggle) sans toucher
              au placement/inclinaison globale gérés sur .ob-frank */}
          <div ref={frankFloatRef} className="ob-frank-float">
            <span className="ob-frank-glow" aria-hidden="true" />
            <video ref={frankVideoRef} className="ob-frank-svg" autoPlay loop muted playsInline aria-hidden="true">
              <source src={FRANK_IDLE_SRC} type="video/webm" />
            </video>
            <video ref={frankSkillRef} className="ob-frank-skill" loop muted playsInline aria-hidden="true">
              <source src="/assets/composition-2.webm" type="video/webm" />
            </video>
          </div>
        </div>
      </div>

      {/* Bulles d'interrogation — libérées quand Frank quitte « Pourquoi Frank ? » */}
      <div ref={bubblesRef} className="ob-bubbles" aria-hidden="true">
        {QUESTION_BUBBLES.map((b, i) => (
          <span
            key={i}
            className={`ob-bubble${b.q ? ' ob-bubble--q' : ''}`}
            style={{ width: b.size, height: b.size, fontSize: b.q ? b.size * 0.6 : undefined }}
          >
            {b.q ? '?' : null}
          </span>
        ))}
      </div>

      {/* Traînée de bulles — libérée le long du trajet de Frank pendant les
          transitions d'écran (pool recyclé, piloté par gsap.ticker) */}
      <div ref={trailRef} className="ob-trail" aria-hidden="true">
        {Array.from({ length: TRAIL_POOL }, (_, i) => (
          <span key={i} className="ob-trail-bubble" />
        ))}
      </div>

      {/* Écran 1 — Accueil */}
      <div className="ob-screen ob-screen--welcome">
        <h1 ref={titleRef} className="ob-title">
          Salut, moi c'est <em>Frank.</em>
        </h1>
        <p ref={subRef} className="ob-subtitle">
          Tu passes des heures à configurer ton IA pour qu'elle bosse comme tu veux&nbsp;?
        </p>
        <button ref={btnRef} className="ob-btn" onClick={goNext}>Commencer</button>
      </div>

      {/* Écran 2 — Un clic suffit */}
      <div className="ob-screen ob-screen--skill">
        <button ref={skipRef} className="ob-skip" onClick={goToPresent}>Passer</button>
        <div ref={skillRef} className="ob-skill-content">
          <h1 className="ob-title ob-title--lg">Un clic suffit.</h1>
          <p className="ob-subtitle ob-subtitle--skill">
            Un Skill, c'est un fichier qui apprend à ton IA un savoir-faire précis.<br />
            <em>Frank</em> en a des milliers, prêts à installer.
          </p>
        </div>
        <div ref={navRef} className="ob-nav" />
      </div>

      {/* Écran 3 — Pourquoi Frank ? */}
      <div className="ob-screen ob-screen--why">
        <button ref={whySkipRef} className="ob-skip" onClick={goToPresent}>Passer</button>
        <div ref={whyHeadRef} className="ob-why-head">
          <h1 className="ob-title ob-title--lg">Pourquoi <em>Frank</em>&nbsp;?</h1>
          <p className="ob-subtitle">Trois choses qui changent tout.</p>
        </div>
        <div ref={whyCardsRef} className="ob-why-cards">
          {WHY_CARDS.map(({ key, Icon, title, text }) => (
            <article key={key} className="ob-why-card">
              <div className="ob-why-card-body">
                <span className="ob-why-icon" aria-hidden="true"><Icon /></span>
                <h2>{title}</h2>
                <p>{text}</p>
              </div>
              <div className="ob-why-card-media" aria-hidden="true" />
            </article>
          ))}
        </div>
        <div ref={whyNavRef} className="ob-nav" />
      </div>

      {/* Écran 4 — Quelles IA tu utilises ? */}
      <div className="ob-screen ob-screen--ia">
        <button ref={iaSkipRef} className="ob-skip" onClick={goToPresent}>Passer</button>
        <div ref={iaHeadRef} className="ob-ia-head">
          <h1 className="ob-title ob-title--lg">Quelles IA<br />tu utilises&nbsp;?</h1>
          <p className="ob-subtitle">Choix multiple. On adaptera tes Skills à chacune.</p>
        </div>
        <div ref={iaGridRef} className="ob-ia-grid">
          {AI_OPTIONS.map(({ name, logo }) => {
            const selected = selectedAis.has(name)
            return (
              <button
                key={name}
                type="button"
                className={`ob-ai-chip${selected ? ' is-selected' : ''}`}
                aria-pressed={selected}
                onClick={() => toggleAi(name)}
              >
                <img className="ob-ai-logo" src={`/assets/ai-logos/${logo}.svg`} alt="" aria-hidden="true" />
                <span className="ob-ai-name">{name}</span>
              </button>
            )
          })}
        </div>
        <div ref={iaNavRef} className="ob-nav" />
      </div>

      {/* Écran 5 — Quelle est ta spécialité ? (cartes = composant partagé Specialties) */}
      <div className="ob-screen ob-screen--ia">
        <button ref={spSkipRef} className="ob-skip" onClick={goToPresent}>Passer</button>
        <div ref={spHeadRef} className="ob-ia-head">
          <h1 className="ob-title ob-title--lg">Quelle est ta<br />spécialité&nbsp;?</h1>
          <p className="ob-subtitle">Choisis tes domaines (plusieurs possibles).</p>
        </div>
        <div ref={spGridRef} className="ob-ia-grid">
          {SPECIALITES.map(({ id, label }) => {
            const active = selectedSpecs.has(id)
            return (
              <button
                key={id}
                type="button"
                className={`ob-ai-chip${active ? ' is-selected' : ''}`}
                aria-pressed={active}
                onClick={() => toggleSpec(id)}
              >
                <span className="ob-sp-iconwrap"><SpecIconTile id={id} active={active} /></span>
                <span className="ob-ai-name">{label}</span>
              </button>
            )
          })}
        </div>
        <div ref={spNavRef} className="ob-nav" />
      </div>

      {/* Écran 6 — Plus précisément ? (tags multi-select groupés ; chips = .ob-ai-chip--tag) */}
      <div className="ob-screen ob-screen--ia">
        <button ref={prSkipRef} className="ob-skip" onClick={goToPresent}>Passer</button>
        <div ref={prHeadRef} className="ob-ia-head">
          <h1 className="ob-title ob-title--lg">Plus précisément&nbsp;?</h1>
          <p className="ob-subtitle">Choix multiple. On affinera tes Skills.</p>
        </div>
        <div ref={prGroupsRef} className="ob-pr-groups">
          {preciseGroups.map(({ key, label, options }) => (
            <div key={key} className="ob-pr-group">
              <p className="ob-pr-label">{label}</p>
              <div className="ob-pr-row">
                {options.map(opt => {
                  const tagKey = `${key}|${opt}`
                  const active = selectedPrecise.has(tagKey)
                  return (
                    <button
                      key={opt}
                      type="button"
                      className={`ob-ai-chip ob-ai-chip--tag${active ? ' is-selected' : ''}`}
                      aria-pressed={active}
                      onClick={() => togglePrecise(tagKey)}
                    >
                      <span className="ob-ai-name">{opt}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        <div ref={prNavRef} className="ob-nav" />
      </div>

      {/* Écran 7 — On se présente (formulaire) */}
      <div className="ob-screen ob-screen--ia">
        <div ref={presHeadRef} className="ob-ia-head">
          <h1 className="ob-title ob-title--lg">On se présente.</h1>
          <p className="ob-subtitle">Deux infos rapides.</p>
        </div>
        <form ref={presFormRef} className="ob-pres-form" onSubmit={e => { e.preventDefault(); if (presValid) goNext() }}>
          <div className="ob-field">
            <label className="ob-pr-label" htmlFor="ob-prenom">Prénom</label>
            <input id="ob-prenom" className="ob-input" type="text" autoComplete="given-name"
              placeholder="Ex : Annie" value={presName} onChange={e => setPresName(e.target.value)} />
          </div>
          <div className="ob-field">
            <label className="ob-pr-label" htmlFor="ob-email">Email</label>
            <input id="ob-email" className="ob-input" type="email" autoComplete="email"
              placeholder="Ex : annie.leroy@email.fr" value={presEmail} onChange={e => setPresEmail(e.target.value)} />
          </div>
          <label className="ob-check">
            <input type="checkbox" checked={presCgu} onChange={e => setPresCgu(e.target.checked)} />
            <span className="ob-check-box" aria-hidden="true" />
            <span className="ob-check-label">J'accepte les CGU et la politique de confidentialité.</span>
          </label>
        </form>
        <div ref={presBackRef} className="ob-pres-back" />
      </div>

      {/* Écran 8 — Créer ton mot de passe */}
      <div className="ob-screen ob-screen--ia">
        <div ref={pwdHeadRef} className="ob-ia-head">
          <h1 className="ob-title ob-title--lg">Créer ton<br />mot de passe</h1>
          <p className="ob-subtitle">Choisis un mot de passe solide.</p>
        </div>
        <form ref={pwdFormRef} className="ob-pres-form" onSubmit={e => { e.preventDefault(); if (pwdValid) goNext() }}>
          <div className="ob-field">
            <label className="ob-pr-label" htmlFor="ob-pwd">Mot de passe</label>
            <input id="ob-pwd" className="ob-input" type="password" autoComplete="new-password"
              value={presPwd} onChange={e => setPresPwd(e.target.value)} />
            <div className="ob-pwd-meter" aria-hidden="true">
              <span className="ob-pwd-bar" data-score={presPwd ? pwdScore : 0} />
              <span className="ob-pwd-strength">{presPwd ? pwdStrength : ''}</span>
            </div>
            <ul className="ob-pwd-reqs">
              <li className={pwdReqs.len ? 'is-ok' : ''}>8 caractères min</li>
              <li className={pwdReqs.upper ? 'is-ok' : ''}>1 majuscule</li>
              <li className={pwdReqs.special ? 'is-ok' : ''}>1 chiffre ou symbole</li>
            </ul>
          </div>
          <div className="ob-field">
            <label className="ob-pr-label" htmlFor="ob-pwd2">Confirmez le mot de passe</label>
            <input id="ob-pwd2" className="ob-input" type="password" autoComplete="new-password"
              value={presPwd2} onChange={e => setPresPwd2(e.target.value)} />
          </div>
        </form>
        <div ref={pwdBackRef} className="ob-pres-back" />
      </div>

      {/* Écran 9 — Choisis ton plan */}
      <div className="ob-screen ob-screen--ia">
        <div ref={planHeadRef} className="ob-plan-head">
          <h1 className="ob-title ob-title--lg">Choisis ton plan</h1>
          <p className="ob-subtitle"><strong>7 jours offerts</strong> sur Frank. Sans engagement, annule quand tu veux.</p>
        </div>
        <div ref={planCardsRef} className="ob-plans">
          {PLANS.map(plan => (
            <article
              key={plan.key}
              className={`ob-plan-card${plan.popular ? ' ob-plan-card--popular' : ''}${selectedPlan === plan.key ? ' is-chosen' : ''}`}
            >
              {plan.popular && <span className="ob-plan-badge">Le plus populaire</span>}
              <div className="ob-plan-body">
                <h2 className="ob-plan-name">{plan.name}</h2>
                <p className="ob-plan-tagline">{plan.tagline}</p>
                <p className="ob-plan-price"><span>{plan.price}</span> / mois</p>
                <ul className="ob-plan-feats">
                  {plan.feats.map(f => <li key={f}>{f}</li>)}
                </ul>
              </div>
              <button type="button" className="ob-btn ob-plan-choose" onClick={() => setSelectedPlan(plan.key)}>
                {selectedPlan === plan.key ? 'Choisi' : 'Choisir'}
              </button>
            </article>
          ))}
        </div>
        <div ref={planNavRef} className="ob-nav" />
      </div>

      {/* Écran 10 — feed (arrivée sur l'app). Personnalisé avec les choix du parcours. */}
      <div className={`ob-screen ob-screen--feed${step === 'feed' ? ' is-active' : ''}`}>
        <aside ref={feedSideRef} className="ob-feed-side">
          <p className="ob-feed-logo"><em>Frank</em></p>
          <nav className="ob-feed-nav">
            {FEED_NAV.map((item, i) => (
              <span key={item} className={`ob-feed-navitem${i === 0 ? ' is-active' : ''}`}>
                <span className="ob-feed-navdot" aria-hidden="true" />
                {item}
              </span>
            ))}
          </nav>
          <div className="ob-feed-user">
            <img className="ob-feed-avatar" src={`/assets/mascots/${domainInfo.mascot}.png`} alt="" aria-hidden="true" />
            <span className="ob-feed-userinfo">
              <span className="ob-feed-username">{userName}</span>
              <span className="ob-feed-userrole">{domainInfo.role}</span>
            </span>
          </div>
        </aside>
        <div className="ob-feed-main">
          <div ref={feedHeadRef} className="ob-feed-head">
            <div className="ob-feed-banner">
              <p className="ob-feed-banner-h">Bienvenue</p>
              <p className="ob-feed-banner-p">Salut {userName}, voici ton feed perso adapté à {userAis} et {domainInfo.label}.</p>
            </div>
            <div className="ob-feed-filters">
              {[domainInfo.label, ...[...selectedAis].slice(0, 2)].map(f => (
                <button key={f} type="button"
                  className={`ob-feed-chip${feedFilters.has(f) ? ' is-on' : ''}`}
                  onClick={() => toggleFeedFilter(f)}>{f}</button>
              ))}
              <button type="button"
                className={`ob-feed-chip ob-feed-chip--more${showFilters ? ' is-on' : ''}`}
                onClick={() => setShowFilters(s => !s)}>{showFilters ? '− Moins' : '+ Filtres'}</button>
              {showFilters && FEED_EXTRA_FILTERS.map(f => (
                <button key={f} type="button"
                  className={`ob-feed-chip${feedFilters.has(f) ? ' is-on' : ''}`}
                  onClick={() => toggleFeedFilter(f)}>{f}</button>
              ))}
            </div>
          </div>
          <div ref={feedCardsRef} className="ob-feed-grid">
            {FEED_SKILLS.map(skill => (
              <article key={skill.name} className="ob-feed-card">
                <div className="ob-feed-thumb" aria-hidden="true" />
                <div className="ob-feed-card-body">
                  <h3 className="ob-feed-card-name">{skill.name}</h3>
                  <p className="ob-feed-card-meta">★ {skill.rating} · {skill.installs}</p>
                </div>
                <span className="ob-feed-install">+ Installer</span>
              </article>
            ))}
          </div>
        </div>
      </div>

      {/* Barre de nav persistante (Retour + action) : rendue une seule fois, hors
          des écrans et NON animée par les transitions → elle ne disparaît plus
          entre les écrans. Son libellé/état s'adapte à l'étape (Suivant /
          Enregistrer + désactivation tant que le formulaire/plan n'est pas valide). */}
      {step !== 'welcome' && step !== 'feed' && (
        <div className="ob-nav ob-nav--persist">
          <button className="ob-btn ob-btn--secondary" onClick={goPrev}>Retour</button>
          <button className="ob-btn" onClick={goNext} disabled={navDisabled}>{navLabel}</button>
        </div>
      )}
    </div>
  )
}

function IconSliders() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <line x1="3.5" y1="9" x2="20.5" y2="9" />
      <circle cx="9" cy="9" r="2.6" fill="currentColor" stroke="none" />
      <line x1="3.5" y1="15" x2="20.5" y2="15" />
      <circle cx="15" cy="15" r="2.6" fill="currentColor" stroke="none" />
    </svg>
  )
}

function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="8.5" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8 12.4l2.6 2.6 5.4-5.8" />
    </svg>
  )
}

export default function App() {
  const [page] = useState(
    new URLSearchParams(window.location.search).get('view') === 'grid' ? 1 : 0,
  )
  const pages = [<Onboarding key="ob" />, <OnboardingGrid key="grid" />]

  return (
    <>
      {pages[page]}
    </>
  )
}
