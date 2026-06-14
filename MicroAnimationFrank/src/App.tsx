import { useState, useRef, useEffect } from 'react'
import gsap from 'gsap'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'
import OnboardingGrid from './OnboardingGrid'
import { SPECIALITES, SpecIconTile, type Spec } from './Specialties'
import './App.css'

gsap.registerPlugin(MotionPathPlugin)

const STEPS = ['welcome', 'skill', 'why', 'ia', 'specialite'] as const
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
   sans suréchantillonner les filtres de flou au point de saccader. Ajustable. */
const FRANK_SS = 4

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
  intro:   fs(0,     0,     11.6, 0),
  welcome: fs(0,    -0.16,  1,    0),
  skill:   fs(0,     0.41,  2.3,  0),
  why:     fs(0.34, -0.32,  0.62, -4),
  ia:      fs(-0.16, 0,     2.4,  5),
  // Écran spécialité : Frank reste exactement où il était sur l'écran IA.
  specialite: fs(-0.16, 0,  2.4,  5),
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

const WHY_CARDS = [
  { key: 'feed', Icon: IconSliders, title: 'Feed personnalisé',
    text: "Construit dès l'inscription selon ton domaine + tes IA. Plus tu installes, plus c'est précis." },
  { key: 'install', Icon: IconPlus, title: 'Installation en 1 clic',
    text: "Pas de terminal, pas de fichier à copier. Frank s'occupe de tout." },
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
  // Bulles d'interrogation (transition « Pourquoi Frank ? » → IA)
  const bubblesRef = useRef<HTMLDivElement>(null)
  // Traînée de bulles laissée par Frank pendant ses déplacements
  const trailRef = useRef<HTMLDivElement>(null)

  const segsRef      = useRef<gsap.core.Timeline[]>([])
  const idxRef       = useRef(0)
  const animatingRef = useRef(false)
  const reduceRef    = useRef(false)

  // Deep links de prévisualisation : ?ob=skill | ?ob=why (état figé), ?frz=0..1 (scrub)
  const [step, setStep] = useState<Step>(() => {
    const ob = new URLSearchParams(window.location.search).get('ob')
    return ob === 'specialite' ? 'specialite' : ob === 'ia' ? 'ia' : ob === 'why' ? 'why' : ob === 'skill' ? 'skill' : 'welcome'
  })
  const [selectedAis, setSelectedAis] = useState<Set<string>>(() => new Set())
  const [selectedSpecs, setSelectedSpecs] = useState<Set<Spec>>(() => new Set())

  useEffect(() => {
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

    const params = new URLSearchParams(window.location.search)
    const ob  = params.get('ob')
    const frz = params.get('frz')
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    reduceRef.current = reduce

    const startStep: Step =
      ob === 'specialite' ? 'specialite' : ob === 'ia' ? 'ia' : ob === 'why' ? 'why' : ob === 'skill' ? 'skill' : 'welcome'
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
      const f = FRANK[s]
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
    // « Frank part et revient » : il plonge par le bas en emportant les cartes
    // IA, puis remonte exactement à la MÊME place en ramenant les cartes
    // spécialité (sa position d'arrivée ne change pas). La traînée de bulles
    // accompagne le trajet automatiquement (cf. trailEmitter).
    const buildIaSpecialite = () => {
      const h = window.innerHeight, w = window.innerWidth
      const t = gsap.timeline({ paused: true, onComplete: done, onReverseComplete: done })

      // Sortie de l'écran IA — chips aspirées vers le bas (vers Frank)
      t.to([iaNavRef.current, iaSkipRef.current],
        { autoAlpha: 0, y: 16, duration: 0.32, stagger: 0.06, ease: 'power2.in' }, 0)
      t.to(iaHeadRef.current, { autoAlpha: 0, y: -16, duration: 0.34, ease: 'power2.in' }, 0)
      t.to(iaChips, { autoAlpha: 0, y: 70, scale: 0.82, duration: 0.42, stagger: 0.04, ease: 'power2.in' }, 0)

      // Frank plonge par le bas en les emportant, puis disparaît
      const iaLeanOut = makeLean(frank, FRANK.ia.rot, FRANK.ia.rot, false)
      t.to(frank, { duration: 0.7, ease: 'power2.in',
        motionPath: { path: [
          { x: FRANK.ia.x * w,            y: FRANK.ia.y * h },
          { x: FRANK.ia.x * w + 0.05 * w, y: 0.5 * h },
          { x: FRANK.ia.x * w,            y: 1.12 * h },
        ], curviness: 1.3, autoRotate: false },
        onStart: iaLeanOut.start, onUpdate: iaLeanOut.update }, 0.12)
      t.to(frank, { opacity: 0, duration: 0.28, ease: 'power2.in' }, 0.46)

      // Invisible : on le replace tout en bas, puis il remonte à la même place
      t.set(frank, { x: FRANK.specialite.x * w, y: 1.14 * h, scale: FRANK.specialite.scale, rotation: FRANK.specialite.rot }, 0.76)
      const spLeanIn = makeLean(frank, FRANK.specialite.rot, FRANK.specialite.rot, true)
      t.to(frank, { duration: 0.95, ease: 'power3.out',
        motionPath: { path: [
          { x: FRANK.specialite.x * w, y: 1.14 * h },
          { x: FRANK.specialite.x * w, y: FRANK.specialite.y * h },
        ], autoRotate: false },
        onStart: spLeanIn.start, onUpdate: spLeanIn.update }, 0.76)
      t.to(frank, { opacity: FRANK.specialite.opacity, duration: 0.5, ease: 'power2.out' }, 0.82)

      // Entrée de l'écran spécialité — les cartes éclosent pendant qu'il remonte
      t.to(spHeadRef.current, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power2.out' }, 1.04)
      t.to(spCards, { autoAlpha: 1, y: 0, scale: 1, duration: 0.45, stagger: 0.05, ease: 'back.out(1.5)' }, 1.12)
      t.to([spSkipRef.current, spNavRef.current],
        { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.08, ease: 'power2.out' }, 1.22)

      return t
    }

    const buildSegments = () => {
      segsRef.current.forEach(t => t.kill())
      segsRef.current = [buildWelcomeSkill(), buildSkillWhy(), buildWhyIa(), buildIaSpecialite()]
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
      else gsap.set([spHeadRef.current, ...spEls, ...spCards], { autoAlpha: 1, y: 0, scale: 1 })
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

      const emit = (cx: number, cy: number, depth: number) => {
        const b = pool[slot]
        slot = (slot + 1) % pool.length
        gsap.killTweensOf(b)                       // recycle la bulle la plus ancienne
        const size  = gsap.utils.random(9, 28)
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
      const idleSpawn = (cx: number, cy: number, scale: number) => {
        const w = window.innerWidth, h = window.innerHeight
        const appSize = FRANK_SS * Math.min(0.26 * w, 360) * scale
        let sx = cx, sy = cy
        switch (gsap.utils.random(['up', 'left', 'right'])) {
          case 'left':
            sx = cx - gsap.utils.random(0.5, 0.72) * appSize
            sy = cy + gsap.utils.random(-0.32, 0.18) * appSize
            break
          case 'right':
            sx = cx + gsap.utils.random(0.5, 0.72) * appSize
            sy = cy + gsap.utils.random(-0.32, 0.18) * appSize
            break
          default: // au-dessus
            sx = cx + gsap.utils.random(-0.3, 0.3) * appSize
            sy = cy - gsap.utils.random(0.5, 0.78) * appSize
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
            emit(cx, cy, depth)
          }
        } else {
          // Repos : émission temporelle clairsemée tant que Frank est posé sur un
          // écran (scale < 0.9 exclut le gros plan d'intro) et visible — inclut
          // l'accueil « Salut, moi c'est Frank ».
          lx = null; acc = 0
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
            const s = idleSpawn(cx, cy, scale)   // sur un côté ou au-dessus, pas sur le corps
            emit(s.x, s.y, depth)
          }
        }
      }
      gsap.ticker.add(trailEmitter)
    }

    // Recalage si la fenêtre change (les chemins sont en px) : on reconstruit
    // et on cale chaque segment sur l'étape courante.
    const onResize = () => {
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

  // Bulles d'interrogation : Frank en gros plan « réfléchit » en continu sur
  // l'écran IA. La boucle tourne tant qu'on reste sur ce slide et s'arrête au
  // changement d'écran (cleanup). Démarrage différé le temps qu'il arrive.
  useEffect(() => {
    const layer = bubblesRef.current
    if (step !== 'ia' || reduceRef.current || !layer) return

    const bubbles = Array.from(layer.children)
    const seg = segsRef.current[STEPS.indexOf('ia') - 1]
    const startDelay = animatingRef.current && seg ? seg.duration() * 1000 : 0
    const loops: gsap.core.Timeline[] = []
    let cancelled = false

    const launch = () => {
      if (cancelled) return
      const h = window.innerHeight, w = window.innerWidth
      // base CSS réelle = FRANK_SS × min(26vw, 360px) ; × scale (déjà /FRANK_SS) ⇒ hauteur réelle inchangée.
      const frankH = FRANK_SS * Math.min(0.26 * w, 360) * FRANK.ia.scale
      // Origine = sur la tête de Frank (recentrée verticalement)
      gsap.set(layer, { x: w / 2 + FRANK.ia.x * w, y: h / 2 + FRANK.ia.y * h - frankH * 0.10 })
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

  const goNext = () => {
    const i = idxRef.current
    if (animatingRef.current || i >= STEPS.length - 1) return
    idxRef.current = i + 1
    setStep(STEPS[i + 1])
    if (reduceRef.current) { segsRef.current[i].progress(1); return }
    animatingRef.current = true
    segsRef.current[i].play()
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

  return (
    <div className={`ob-root onboarding-bg is-${step}`}>
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
              <source src="/assets/frank-sur-place.webm" type="video/webm" />
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
        <button ref={skipRef} className="ob-skip">Passer</button>
        <div ref={skillRef} className="ob-skill-content">
          <h1 className="ob-title ob-title--lg">Un clic suffit.</h1>
          <p className="ob-subtitle ob-subtitle--skill">
            Un Skill, c'est un fichier qui apprend à ton IA un savoir-faire précis.<br />
            <em>Frank</em> en a des milliers, prêts à installer.
          </p>
        </div>
        <div ref={navRef} className="ob-nav">
          <button className="ob-btn ob-btn--secondary" onClick={goPrev}>Retour</button>
          <button className="ob-btn" onClick={goNext}>Suivant</button>
        </div>
      </div>

      {/* Écran 3 — Pourquoi Frank ? */}
      <div className="ob-screen ob-screen--why">
        <button ref={whySkipRef} className="ob-skip">Passer</button>
        <div ref={whyHeadRef} className="ob-why-head">
          <h1 className="ob-title ob-title--lg">Pourquoi <em>Frank</em>&nbsp;?</h1>
          <p className="ob-subtitle">Trois choses qui changent tout.</p>
        </div>
        <div ref={whyCardsRef} className="ob-why-cards">
          {WHY_CARDS.map(({ key, Icon, title, text }) => (
            <article key={key} className="ob-why-card">
              <span className="ob-why-icon" aria-hidden="true"><Icon /></span>
              <h2>{title}</h2>
              <p>{text}</p>
              <div className="ob-why-card-media" aria-hidden="true" />
            </article>
          ))}
        </div>
        <div ref={whyNavRef} className="ob-nav">
          <button className="ob-btn ob-btn--secondary" onClick={goPrev}>Retour</button>
          <button className="ob-btn" onClick={goNext}>Suivant</button>
        </div>
      </div>

      {/* Écran 4 — Quelles IA tu utilises ? */}
      <div className="ob-screen ob-screen--ia">
        <button ref={iaSkipRef} className="ob-skip">Passer</button>
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
        <div ref={iaNavRef} className="ob-nav">
          <button className="ob-btn ob-btn--secondary" onClick={goPrev}>Retour</button>
          <button className="ob-btn" onClick={goNext}>Suivant</button>
        </div>
      </div>

      {/* Écran 5 — Quelle est ta spécialité ? (cartes = composant partagé Specialties) */}
      <div className="ob-screen ob-screen--ia">
        <button ref={spSkipRef} className="ob-skip">Passer</button>
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
        <div ref={spNavRef} className="ob-nav">
          <button className="ob-btn ob-btn--secondary" onClick={goPrev}>Retour</button>
          <button className="ob-btn" onClick={goNext}>Suivant</button>
        </div>
      </div>
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
  const [page, setPage] = useState(
    new URLSearchParams(window.location.search).get('view') === 'onboarding' ? 1 : 0,
  )
  const pages = [<OnboardingGrid key="grid" />, <Onboarding key="ob" />]

  return (
    <>
      {pages[page]}
      <button
        className="nav-btn"
        onClick={() => setPage(p => (p + 1) % pages.length)}
      >
        {page === 0 ? 'Onboarding' : 'Micro animation'}
      </button>
    </>
  )
}
