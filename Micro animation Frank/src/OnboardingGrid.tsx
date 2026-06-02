import { useState, useEffect, useRef } from 'react'
import gsap from 'gsap'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'

gsap.registerPlugin(MotionPathPlugin)
import './OnboardingGrid.css'

const A = (name: string) => `/assets/${name}.svg`

const FORCE_ACTIVE = new URLSearchParams(window.location.search).get('preview') === 'active'

interface CardProps {
  label: string
  className?: string
  children: (active: boolean) => React.ReactNode
}

function Card({ label, className = '', children }: CardProps) {
  const [active, setActive] = useState(FORCE_ACTIVE)

  return (
    <button
      className={`og-card ${active ? 'og-card--active' : ''} ${className}`}
      onClick={() => setActive(a => !a)}
      aria-label={label}
      aria-pressed={active}
    >
      <div className="og-halo" style={{ backgroundImage: `url(${A('violet-halo2')})` }} />
      {children(active)}
    </button>
  )
}

function Glow({ img, pos }: { img: string; pos: 'top' | 'bot' }) {
  return <div className={`og-glow og-glow--${pos}`} style={{ backgroundImage: `url(${A(img)})` }} />
}

/* ─────────────────────────────────────────────────────────────────────────
   Dev </>
   Animation : le chevron gauche part à gauche, le droit à droite,
   le slash fait un flip 360° puis tout revient en place (spring).
───────────────────────────────────────────────────────────────────────── */
function DevCard() {
  return (
    <Card label="Dev" className="og-card--dev">
      {() => (
        <>
          <Glow img="ellipse109" pos="top" />
          <Glow img="ellipse108" pos="bot" />
          <div className="og-icon og-icon--dev">
            <svg viewBox="0 0 215.22 128.184" fill="none" xmlns="http://www.w3.org/2000/svg" overflow="visible">
              {/* Chevron gauche < */}
              <path className="dev-chevron-l" d="M57.9337 19.05L11.7205 56.3376C6.77119 60.331 6.75774 67.8692 11.6928 71.8803L57.9337 109.463"
                stroke="currentColor" strokeWidth="16" strokeLinecap="round"/>
              {/* Chevron droit > */}
              <path className="dev-chevron-r" d="M157.287 19.05L203.5 56.3376C208.449 60.331 208.463 67.8692 203.528 71.8803L157.287 109.463"
                stroke="currentColor" strokeWidth="16" strokeLinecap="round"/>
              {/* Slash / */}
              <path className="dev-slash" d="M131.928 8.00212L86.7212 120.182"
                stroke="currentColor" strokeWidth="16" strokeLinecap="round"/>
            </svg>
          </div>
        </>
      )}
    </Card>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
   Graphic Design — plume
   La plume part du début du tracé Figma (Vector 62) et le suit jusqu'au
   bout via GSAP MotionPath. Le trait se révèle en même temps via
   stroke-dashoffset. En before : trait invisible, plume à sa position finale.
───────────────────────────────────────────────────────────────────────── */
function GraphicCard() {
  const [active, setActive] = useState(FORCE_ACTIVE)
  const svgRef    = useRef<SVGSVGElement>(null)
  const penRef    = useRef<SVGGElement>(null)
  const traceRef  = useRef<SVGPathElement>(null)
  const tlRef     = useRef<gsap.core.Timeline | null>(null)

  useEffect(() => {
    const pen   = penRef.current
    const trace = traceRef.current
    if (!pen || !trace) return

    const len = trace.getTotalLength()
    gsap.set(trace, { strokeDasharray: len, strokeDashoffset: len })

    const DRAW = 0.85
    // Décalage perpendiculaire au tracé, côté droit.
    // Normale droite = tangente tournée de -90° : (dy, -dx) normalisé * PERP.
    const PERP = 22

    const applyPerp = (progress: number) => {
      const eps = 0.5  // petite distance en px pour calculer la tangente
      const t = Math.max(0, Math.min(len, progress * len))
      const a = trace.getPointAtLength(Math.max(0, t - eps))
      const b = trace.getPointAtLength(Math.min(len, t + eps))
      const dx = b.x - a.x, dy = b.y - a.y
      const mag = Math.sqrt(dx * dx + dy * dy) || 1
      // Normale droite : rotation -90° de la tangente (dy/mag, -dx/mag)
      gsap.set(pen, {
        x: `+=${(dy / mag) * PERP}`,
        y: `+=${(-dx / mag) * PERP}`,
      })
    }

    const MOTION = (start: number, end: number) => ({
      path: trace,
      autoRotate: true,
      start,
      end,
    })

    gsap.set(pen, { motionPath: MOTION(0, 0) })
    applyPerp(0)

    const tl = gsap.timeline({
      paused: true,
      onReverseComplete: () => {
        gsap.set(pen, { motionPath: MOTION(0, 0) })
        applyPerp(0)
        gsap.set(trace, { strokeDashoffset: len })
      },
    })
    tl
      .to(trace, { strokeDashoffset: 0, duration: DRAW, ease: 'power2.inOut' }, 0)
      .to(pen, {
        motionPath: MOTION(0, 1),
        duration: DRAW,
        ease: 'power2.inOut',
        onUpdate() { applyPerp(this.progress()) },
      }, 0)

    tlRef.current = tl
    return () => { tl.kill() }
  }, [])

  useEffect(() => {
    const tl = tlRef.current
    if (!tl) return
    if (active) {
      tl.play(0)
    } else {
      tl.reverse()
    }
  }, [active])

  // Couleur : CSS currentColor (héritée de .og-card / .og-card--active)
  return (
    <button
      className={`og-card og-card--graphic ${active ? 'og-card--active' : ''}`}
      onClick={() => setActive(a => !a)}
      aria-label="Graphic design"
      aria-pressed={active}
    >
      <div className="og-halo" style={{ backgroundImage: `url(${A('violet-halo2')})` }} />
      <svg
        ref={svgRef}
        className="og-icon og-icon--graphic"
        viewBox="0 0 233.912 211.453"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        overflow="visible"
      >
        {/* Tracé Figma (Vector 62) — caché par défaut via strokeDashoffset en attribut */}
        <path
          ref={traceRef}
          d="M21.8721 8.00006C88.8691 68.7647 9.23459 105.466 8.02276 147.014C6.81093 188.563 54.9377 203.451 54.9377 203.451"
          stroke="currentColor"
          strokeWidth="16"
          strokeLinecap="round"
          fill="none"
          strokeDasharray="9999"
          strokeDashoffset="9999"
        />
        {/* Groupe motionPath — GSAP positionne ce groupe sur le path.
            L'origine (0,0) de ce groupe correspond à la pointe de la plume.
            Le sous-groupe centre la plume sur (0,0) et la met à l'échelle. */}
        <g ref={penRef} className="graphic-pen">
          {/* translate(0, 20) dans l'espace local du groupe post-autoRotate
              = décalage perpendiculaire au tracé, côté droit */}
          <g transform="rotate(135) scale(0.5) translate(-55, -185)">
            <rect
              x="233.912" y="98.173"
              width="43.3571" height="85.3028"
              rx="7.98716"
              transform="rotate(138.79 233.912 98.173)"
              fill="currentColor"
            />
            <path
              d="M129.305 75.6378C136.192 71.9124 144.74 73.4462 149.903 79.3332L185.195 119.578C189.529 124.522 190.578 131.541 187.876 137.535L172.684 171.24C170.775 175.476 167.195 178.73 162.797 180.228L78.1682 209.056C69.5364 211.996 67.9965 200.564 74.7755 194.464L106.118 166.266C107.665 164.874 109.872 164.614 111.95 164.727C117.651 165.037 122.524 160.668 122.834 154.968C123.145 149.268 118.775 144.395 113.074 144.084C107.374 143.774 102.502 148.144 102.192 153.844C102.046 156.512 101.581 159.383 99.5974 161.174L68.0837 189.622C62.22 194.915 52.6584 192.521 55.5237 185.159L87.6096 102.725C89.0522 99.0186 91.7649 95.9451 95.2629 94.0529L129.305 75.6378Z"
              fill="currentColor"
            />
          </g>
        </g>
      </svg>
    </button>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
   Finance — barres
   Animation : chaque barre monte depuis le bas en stagger (scaleY).
───────────────────────────────────────────────────────────────────────── */
function FinanceCard() {
  return (
    <Card label="Finance" className="og-card--finance">
      {() => (
        <>
          <Glow img="ellipse109" pos="top" />
          <Glow img="ellipse108" pos="bot" />
          <div className="og-icon og-icon--finance">
            <svg viewBox="0 0 131.116 173" fill="none" xmlns="http://www.w3.org/2000/svg" overflow="visible">
              <rect className="finance-bar finance-bar--1" x="0" y="114.726" width="40.0632" height="58.2737" rx="7.28421" fill="currentColor"/>
              <rect className="finance-bar finance-bar--2" x="45.5264" y="0" width="40.0632" height="173" rx="7.28421" fill="currentColor"/>
              <rect className="finance-bar finance-bar--3" x="91.0527" y="61.916" width="40.0632" height="111.084" rx="7.28421" fill="currentColor"/>
            </svg>
          </div>
        </>
      )}
    </Card>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
   UI/UX — cadre artboard
   Animation : chaque barre s'écarte vers l'extérieur avec un spring,
   puis revient en place. Stagger pour un effet d'ouverture d'artboard.
───────────────────────────────────────────────────────────────────────── */
function FrameIcon({ active }: { active: boolean }) {
  const paint = active ? 'url(#frame-grad)' : 'white'
  return (
    <svg className="og-icon og-icon--uiux" viewBox="0 0 236 236" fill="none" xmlns="http://www.w3.org/2000/svg" overflow="visible">
      <defs>
        <linearGradient id="frame-grad" x1="0" y1="236" x2="236" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2E2962"/>
          <stop offset="100%" stopColor="#7E74F0"/>
        </linearGradient>
      </defs>
      {/* Barre droite */}
      <rect className="frame-bar frame-bar--right" x="188" y="0" width="16" height="236" rx="7.28421" fill={paint}/>
      {/* Barre gauche */}
      <rect className="frame-bar frame-bar--left" x="32" y="0" width="16" height="236" rx="7.28421" fill={paint}/>
      {/* Barre top — positionnée directement, sans rotate SVG */}
      <rect className="frame-bar frame-bar--top" x="0" y="32" width="236" height="16" rx="7.28421" fill={paint}/>
      {/* Barre bottom — positionnée directement, sans rotate SVG */}
      <rect className="frame-bar frame-bar--bottom" x="0" y="188" width="236" height="16" rx="7.28421" fill={paint}/>
    </svg>
  )
}

function UiUxCard() {
  return (
    <Card label="UI/UX design" className="og-card--uiux">
      {(active) => (
        <>
          <Glow img="ellipse110" pos="top" />
          <Glow img="ellipse108" pos="bot" />
          <FrameIcon active={active} />
        </>
      )}
    </Card>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
   Marketing — mégaphone
   Animation : le corps pulse (shake horizontal),
   les ondes partent vers la droite en stagger.
───────────────────────────────────────────────────────────────────────── */
function MarketingCard() {
  return (
    <Card label="Marketing" className="og-card--marketing">
      {() => (
        <>
          <Glow img="ellipse109" pos="top" />
          <Glow img="ellipse108" pos="bot" />
          {/* Corps du mégaphone */}
          <div className="og-icon og-icon--mktg-b og-mktg-body">
            <svg viewBox="0 0 166.099 181" fill="none" xmlns="http://www.w3.org/2000/svg" overflow="visible">
              <path d="M57.9131 107.025V161.698C57.9131 170.425 50.839 177.5 42.1123 177.5C33.3855 177.5 26.3105 170.425 26.3105 161.698V107.025H57.9131Z"
                fill="currentColor" stroke="currentColor" strokeWidth="7"/>
              <path d="M21.6406 42.688H71.9512V107.044H21.6406C11.6219 107.044 3.50011 98.9226 3.5 88.9038V60.8286C3.50017 50.8099 11.6219 42.6882 21.6406 42.688Z"
                fill="currentColor" stroke="currentColor" strokeWidth="7"/>
              <path d="M152.55 4.81071L76.5145 41.21C74.0774 42.3766 72.5264 44.8387 72.5264 47.5406V102.621C72.5264 105.21 73.9519 107.589 76.2352 108.81L152.271 149.472C156.946 151.973 162.599 148.585 162.599 143.283V11.1414C162.599 5.97637 157.209 2.58052 152.55 4.81071Z"
                fill="currentColor" stroke="currentColor" strokeWidth="7"/>
            </svg>
          </div>
          {/* Ondes sonores — 3 traits courts et épais en éventail */}
          <svg className="og-icon og-mktg-waves" viewBox="0 0 70 110" fill="none" xmlns="http://www.w3.org/2000/svg" overflow="visible">
            <line className="mktg-wave mktg-wave--1"
              x1="8" y1="22" x2="30" y2="10"
              stroke="currentColor" strokeWidth="14" strokeLinecap="round"/>
            <line className="mktg-wave mktg-wave--2"
              x1="8" y1="55" x2="34" y2="55"
              stroke="currentColor" strokeWidth="14" strokeLinecap="round"/>
            <line className="mktg-wave mktg-wave--3"
              x1="8" y1="88" x2="30" y2="100"
              stroke="currentColor" strokeWidth="14" strokeLinecap="round"/>
          </svg>
        </>
      )}
    </Card>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
   Autre — trois points
   Animation : chaque point saute en rebond (bounce) en stagger.
───────────────────────────────────────────────────────────────────────── */
function AutreCard() {
  return (
    <Card label="Autre" className="og-card--autre">
      {() => (
        <>
          <Glow img="ellipse109" pos="top" />
          <Glow img="ellipse108" pos="bot" />
          <div className="og-dots-wrap">
            <div className="og-dot og-dot--l" />
            <div className="og-dot og-dot--c" />
            <div className="og-dot og-dot--r" />
          </div>
        </>
      )}
    </Card>
  )
}

export default function OnboardingGrid() {
  return (
    <div className="og-root">
      <p className="og-hint">Clique sur une carte pour la sélectionner</p>
      <div className="og-grid">
        <DevCard />
        <GraphicCard />
        <FinanceCard />
        <UiUxCard />
        <MarketingCard />
        <AutreCard />
      </div>
    </div>
  )
}
