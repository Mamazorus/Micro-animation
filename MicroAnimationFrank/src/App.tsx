import { useState, useRef, useEffect } from 'react'
import gsap from 'gsap'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'
import OnboardingGrid from './OnboardingGrid'
import './App.css'

gsap.registerPlugin(MotionPathPlugin)

const STEPS = ['welcome', 'skill', 'why', 'ia'] as const
type Step = (typeof STEPS)[number]

type FrankState = { x: number; y: number; scale: number; rot: number; opacity: number }

/* État de Frank par écran — transformOrigin sur ses yeux (50% 51%).
   x ×innerWidth, y ×innerHeight (origine = centre de l'écran).
   Plus il est petit, plus il est « loin » dans l'eau → opacité plus basse. */
const FRANK: Record<'intro' | Step, FrankState> = {
  intro:   { x: 0,     y: 0,     scale: 7,    rot: 0,  opacity: 1 },
  welcome: { x: 0,     y: -0.16, scale: 1,    rot: 8,  opacity: 0.85 },
  skill:   { x: 0,     y: 0.41,  scale: 2.3,  rot: 0,  opacity: 1 },
  why:     { x: 0.34,  y: -0.32, scale: 0.62, rot: -4, opacity: 0.8 },
  ia:      { x: -0.16, y: 0.5,   scale: 2.4,  rot: 5,  opacity: 1 },
}

const AI_OPTIONS = ['Claude', 'ChatGPT', 'Gemini', 'Mistral', 'Codex', 'Copilot', 'Loveable', 'Autre']

/* Bulles libérées par Frank en quittant « Pourquoi Frank ? ».
   dx/drift en px (point de départ / dérive latérale), rise en fraction de hauteur,
   delay en s (cadence d'émission), q = bulle portant un point d'interrogation. */
const QUESTION_BUBBLES = [
  { size: 32, dx: -16, rise: 0.34, drift:  22, delay: 0.00, q: false },
  { size: 62, dx:  18, rise: 0.52, drift:  30, delay: 0.10, q: true  },
  { size: 28, dx:  40, rise: 0.30, drift:  34, delay: 0.05, q: false },
  { size: 84, dx: -10, rise: 0.58, drift: -22, delay: 0.15, q: true  },
  { size: 44, dx:  34, rise: 0.42, drift: -16, delay: 0.08, q: false },
]

const WHY_CARDS = [
  { key: 'feed', Icon: IconSliders, title: 'Feed personnalisé',
    text: "Construit dès l'inscription selon ton domaine + tes IA. Plus tu installes, plus c'est précis." },
  { key: 'install', Icon: IconPlus, title: 'Installation en 1 clic',
    text: "Pas de terminal, pas de fichier à copier. Frank s'occupe de tout." },
  { key: 'verif', Icon: IconCheck, title: 'Skills vérifiés',
    text: "Chaque skill passe par 2 niveaux de vérification. Si quelque chose cloche, tu le vois avant d'installer." },
]

function Onboarding() {
  const frankRef = useRef<HTMLDivElement>(null)
  const frankVideoRef = useRef<HTMLVideoElement>(null)
  const frankSkillRef = useRef<HTMLVideoElement>(null)
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
  // Bulles d'interrogation (transition « Pourquoi Frank ? » → IA)
  const bubblesRef = useRef<HTMLDivElement>(null)

  const segsRef      = useRef<gsap.core.Timeline[]>([])
  const idxRef       = useRef(0)
  const animatingRef = useRef(false)
  const reduceRef    = useRef(false)

  // Deep links de prévisualisation : ?ob=skill | ?ob=why (état figé), ?frz=0..1 (scrub)
  const [step, setStep] = useState<Step>(() => {
    const ob = new URLSearchParams(window.location.search).get('ob')
    return ob === 'ia' ? 'ia' : ob === 'why' ? 'why' : ob === 'skill' ? 'skill' : 'welcome'
  })
  const [selectedAis, setSelectedAis] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    const frank = frankRef.current
    if (!frank) return

    const welcomeEls = [titleRef.current, subRef.current, btnRef.current]
    const skillEls   = [skipRef.current, skillRef.current, navRef.current]
    const whyEls     = [whySkipRef.current, whyHeadRef.current, whyNavRef.current]
    const whyCards   = whyCardsRef.current ? Array.from(whyCardsRef.current.children) : []
    const iaEls      = [iaSkipRef.current, iaNavRef.current]
    const iaChips    = iaGridRef.current ? Array.from(iaGridRef.current.children) : []

    const params = new URLSearchParams(window.location.search)
    const ob  = params.get('ob')
    const frz = params.get('frz')
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    reduceRef.current = reduce

    const startStep: Step =
      ob === 'ia' ? 'ia' : ob === 'why' ? 'why' : ob === 'skill' ? 'skill' : 'welcome'
    const startIdx = STEPS.indexOf(startStep)
    idxRef.current = startIdx

    const done = () => { animatingRef.current = false }

    gsap.set(frank, { transformOrigin: '50% 51%' })
    gsap.set(welcomeEls, { autoAlpha: 0, y: 22 })
    gsap.set(skillEls,   { autoAlpha: 0, y: 24 })
    gsap.set([...whyEls, ...whyCards], { autoAlpha: 0, y: 24 })
    gsap.set([iaHeadRef.current, ...iaEls], { autoAlpha: 0, y: 24 })
    gsap.set(iaChips, { autoAlpha: 0, y: 20, scale: 0.9 })

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
      t.to(frank, { duration: 0.85, ease: 'power2.in',
        motionPath: { path: divePath, curviness: 1.4, autoRotate: false }, rotation: -6 }, 0.08)
      t.to(frank, { opacity: 0, duration: 0.34, ease: 'power2.in' }, 0.55)
      t.set(frankVideoRef.current, { autoAlpha: 0 }, 0.9)
      t.set(frankSkillRef.current, { autoAlpha: 1 }, 0.9)
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

      t.to(frank, { duration: 0.6, ease: 'power2.in',
        motionPath: { path: [
          { x: 0,        y: FRANK.skill.y * h },
          { x: 0.05 * w, y: 0.74 * h },
          { x: 0,        y: 1.08 * h },
        ], curviness: 1.3, autoRotate: false } }, 0.1)
      t.to(frank, { opacity: 0, duration: 0.3, ease: 'power2.in' }, 0.42)
      t.set(frankSkillRef.current, { autoAlpha: 0 }, 0.74)
      t.set(frankVideoRef.current, { autoAlpha: 1 }, 0.74)

      // Téléportation à gauche pendant qu'il est invisible, en tout petit
      t.set(frank, { x: -0.55 * w, y: 0.02 * h, scale: FRANK.why.scale, rotation: FRANK.why.rot }, 0.7)
      t.to(frank, { duration: 1.05, ease: 'power2.out',
        motionPath: { path: [
          { x: -0.55 * w, y: 0.02 * h },
          { x: -0.08 * w, y: 0.2 * h },
          { x:  0.16 * w, y: 0.04 * h },
          { x: FRANK.why.x * w, y: FRANK.why.y * h },
        ], curviness: 1.3, autoRotate: false } }, 0.74)
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

      // Frank nage vers le haut et sort par le plafond
      t.to(frank, { duration: 0.72, ease: 'power2.in',
        motionPath: { path: [
          { x: FRANK.why.x * w, y: FRANK.why.y * h },
          { x: 0.30 * w,        y: -0.46 * h },
          { x: 0.22 * w,        y: -0.95 * h },
        ], curviness: 1.3, autoRotate: false }, rotation: -10 }, 0.12)
      t.to(frank, { opacity: 0, duration: 0.34, ease: 'power2.in' }, 0.52)

      // Réapparition en gros plan par le bas, décalé à gauche
      t.set(frank, { x: FRANK.ia.x * w, y: 1.05 * h, scale: FRANK.ia.scale, rotation: FRANK.ia.rot }, 0.82)
      t.to(frank, { duration: 0.95, ease: 'power3.out',
        motionPath: { path: [
          { x: FRANK.ia.x * w, y: 1.05 * h },
          { x: FRANK.ia.x * w, y: FRANK.ia.y * h },
        ], autoRotate: false } }, 0.86)
      t.to(frank, { opacity: FRANK.ia.opacity, duration: 0.5, ease: 'power2.out' }, 0.9)

      // Entrée de l'écran « Quelles IA »
      t.to(iaHeadRef.current, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power2.out' }, 1.0)
      t.to(iaChips, { autoAlpha: 1, y: 0, scale: 1, duration: 0.45, stagger: 0.05, ease: 'back.out(1.5)' }, 1.08)
      t.to([iaSkipRef.current, iaNavRef.current],
        { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.08, ease: 'power2.out' }, 1.18)

      return t
    }

    const buildSegments = () => {
      segsRef.current.forEach(t => t.kill())
      segsRef.current = [buildWelcomeSkill(), buildSkillWhy(), buildWhyIa()]
    }

    let intro: gsap.core.Timeline | undefined

    if (ob || frz !== null) {
      // Aperçu figé : on pose l'état de départ et on scrub éventuellement le bon segment
      applyFrank(startStep)
      applyMascotKind(startStep)
      if (startStep === 'welcome') gsap.set(welcomeEls, { autoAlpha: 1, y: 0 })
      else if (startStep === 'skill') gsap.set(skillEls, { autoAlpha: 1, y: 0 })
      else if (startStep === 'why') gsap.set([...whyEls, ...whyCards], { autoAlpha: 1, y: 0 })
      else gsap.set([iaHeadRef.current, ...iaEls, ...iaChips], { autoAlpha: 1, y: 0, scale: 1 })
      buildSegments()
      if (frz !== null) {
        const seg = segsRef.current[Math.min(startIdx, segsRef.current.length - 1)]
        seg.progress(parseFloat(frz))
      }
    } else {
      // Gros plan d'ouverture : les yeux pile au centre, puis dézoom vers l'accueil
      applyFrank('intro')
      intro = gsap.timeline({ delay: reduce ? 0 : 1.0 })
      if (reduce) {
        applyFrank('welcome')
        gsap.set(welcomeEls, { autoAlpha: 1, y: 0 })
      } else {
        intro.to(frank, {
          x: 0, y: FRANK.welcome.y * window.innerHeight,
          scale: FRANK.welcome.scale, rotation: FRANK.welcome.rot, opacity: FRANK.welcome.opacity,
          duration: 1.1, ease: 'expo.out',
        }).to(welcomeEls, {
          autoAlpha: 1, y: 0, stagger: 0.13, duration: 0.55, ease: 'power2.out',
        }, '-=0.4')
      }
      buildSegments()
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
      segsRef.current.forEach(t => t.kill())
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
      const frankH = Math.min(0.26 * w, 360) * FRANK.ia.scale
      // Origine = au-dessus de la tête de Frank en gros plan
      gsap.set(layer, { x: w / 2 + FRANK.ia.x * w, y: h / 2 + FRANK.ia.y * h - frankH * 0.48 })
      gsap.set(bubbles, { xPercent: -50, yPercent: -50 })
      bubbles.forEach((b, i) => {
        const cfg = QUESTION_BUBBLES[i % QUESTION_BUBBLES.length]
        const dur = 4 + cfg.rise * 2.5
        const tl = gsap.timeline({ repeat: -1, repeatDelay: 3, delay: i * 1.6 + cfg.delay })
        tl.fromTo(b,
          { x: cfg.dx, y: 0, scale: 0.25 },
          { x: cfg.dx + cfg.drift, y: -(0.45 + cfg.rise) * h, scale: 1, duration: dur, ease: 'power1.out' }, 0)
        tl.fromTo(b,
          { autoAlpha: 0 },
          { autoAlpha: cfg.q ? 1 : 0.78, duration: 0.4, ease: 'power1.out' }, 0)
        tl.to(b, { autoAlpha: 0, duration: 0.7, ease: 'power1.in' }, dur - 0.7)
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

  return (
    <div className={`ob-root onboarding-bg is-${step}`}>
      {/* Couche Frank — découplée du contenu pour « nager » d'un écran à l'autre */}
      <div className="ob-frank-layer">
        <div ref={frankRef} className="ob-frank">
          <span className="ob-frank-glow" aria-hidden="true" />
          <video ref={frankVideoRef} className="ob-frank-svg" autoPlay loop muted playsInline aria-hidden="true">
            <source src="/assets/frank-sur-place.webm" type="video/webm" />
          </video>
          <video ref={frankSkillRef} className="ob-frank-skill" loop muted playsInline aria-hidden="true">
            <source src="/assets/composition-2.webm" type="video/webm" />
          </video>
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
          {AI_OPTIONS.map(name => {
            const selected = selectedAis.has(name)
            return (
              <button
                key={name}
                type="button"
                className={`ob-ai-chip${selected ? ' is-selected' : ''}`}
                aria-pressed={selected}
                onClick={() => toggleAi(name)}
              >
                <span className="ob-ai-dot" aria-hidden="true" />
                {name}
              </button>
            )
          })}
        </div>
        <div ref={iaNavRef} className="ob-nav">
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
