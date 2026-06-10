import { useState, useRef, useEffect } from 'react'
import gsap from 'gsap'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'
import './OnboardingGrid.css'

gsap.registerPlugin(MotionPathPlugin)

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

/* ─────────────────────────────────────────────────────────────────────────
   Graphic Design — plume + motion path GSAP
   - before  : plume blanche centrée, tracé invisible
   - clic    : tracé révélé via strokeDashoffset + plume suit le path (autoRotate)
   - after   : tracé complet visible, plume en bas du path
   - re-clic : timeline.reverse() exact
───────────────────────────────────────────────────────────────────────── */

// Longueur approximative du path (mesurée via getTotalLength, ~260px dans le viewBox 242×205)
// Path décalé de +10 en Y
const PATH_D = 'M21.8906 18C88.9769 76.759 9.23627 112.249 8.02283 152.426C6.80938 192.603 55.0003 207 55.0003 207'

function GraphicDesignCard() {
  const [active, setActive] = useState(FORCE_ACTIVE)
  const tlRef = useRef<gsap.core.Timeline | null>(null)
  const penRef = useRef<SVGGElement | null>(null)
  const traceRef = useRef<SVGPathElement | null>(null)
  const motionPathRef = useRef<SVGPathElement | null>(null)

  useEffect(() => {
    const pen = penRef.current
    const trace = traceRef.current
    const motionPath = motionPathRef.current
    if (!pen || !trace || !motionPath) return

    const pathLen = trace.getTotalLength()
    gsap.set(trace, { strokeDasharray: pathLen, strokeDashoffset: pathLen })

    // Calcule le décalage entre le centre de la plume (before) et le début du path,
    // dans l'espace SVG, pour que GSAP parte de la vraie position initiale.
    const svgEl = pen.ownerSVGElement as SVGSVGElement
    const penBBox = pen.getBBox()
    const pathStart = motionPath.getPointAtLength(0)

    // alignOrigin [0.05, 0.95] → pointe de la plume (bas-gauche du groupe)
    const anchorX = penBBox.x + penBBox.width * 0.05
    const anchorY = penBBox.y + penBBox.height * 0.95
    const deltaX = pathStart.x - anchorX
    const deltaY = pathStart.y - anchorY
    void svgEl

    // Angles de tangente au début et à la fin du path
    const ptStart0 = motionPath.getPointAtLength(0)
    const ptStart1 = motionPath.getPointAtLength(3)
    const angleAtStart = Math.atan2(ptStart1.y - ptStart0.y, ptStart1.x - ptStart0.x) * 180 / Math.PI

    const ptEnd0 = motionPath.getPointAtLength(pathLen - 3)
    const ptEnd1 = motionPath.getPointAtLength(pathLen)
    const angleAtEnd = Math.atan2(ptEnd1.y - ptEnd0.y, ptEnd1.x - ptEnd0.x) * 180 / Math.PI

    gsap.set(pen, { rotation: 0, x: 0, y: 0, transformOrigin: '50% 85%' })

    const PHASE1 = 0.3
    const PHASE2 = 0.65

    const tl = gsap.timeline({ paused: true })

    // Phase 1 : rotation 0 → angleAtStart avec -25° pour rester couché au départ
    tl.to(pen, {
      rotation: angleAtStart - 25,
      duration: PHASE1,
      ease: 'back.out(1.4)',
    }, 0)

    // Phase 2 : rotation continue angleAtStart-25° → angleAtEnd
    tl.to(pen, {
      rotation: angleAtEnd,
      duration: PHASE2,
      ease: 'power1.inOut',
    }, PHASE1)

    // Phase 1 : translation vers le début du path — pas d'overshoot pour rester dans le cadre
    tl.to(pen, {
      x: deltaX,
      y: deltaY,
      duration: PHASE1,
      ease: 'power2.inOut',
    }, 0)

    // Phase 2 : motionPath sans autoRotate (la rotation est gérée au-dessus)
    tl.to(trace, {
      strokeDashoffset: 0,
      duration: PHASE2,
      ease: 'power1.inOut',
    }, PHASE1)

    tl.to(pen, {
      duration: PHASE2,
      ease: 'power1.inOut',
      motionPath: {
        path: motionPath,
        align: motionPath,
        alignOrigin: [0.05, 0.95],
        autoRotate: false,
        start: 0,
        end: 1,
      },
    }, PHASE1)

    tlRef.current = tl
    if (FORCE_ACTIVE) tl.progress(1)

    return () => { tl.kill() }
  }, [])

  const handleClick = () => {
    const tl = tlRef.current
    if (!tl) return
    if (!active) {
      tl.play()
    } else {
      tl.reverse()
    }
    setActive(a => !a)
  }

  return (
    <button
      className={`og-card og-card--gd ${active ? 'og-card--active' : ''}`}
      onClick={handleClick}
      aria-label="Graphic Design"
      aria-pressed={active}
    >
      <div className="og-halo" style={{ backgroundImage: `url(${A('violet-halo2')})` }} />
      <Glow img="ellipse109" pos="top" />
      <Glow img="ellipse108" pos="bot" />

      <svg
        className="gd-pen-svg"
        viewBox="0 0 242.068 215"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        overflow="visible"
      >
        {/* Path dupliqué : l'un pour le tracé visible, l'autre pour le rail GSAP (même d=) */}
        <path
          ref={traceRef}
          d={PATH_D}
          stroke="currentColor"
          strokeWidth="16"
          strokeLinecap="round"
          fill="none"
          strokeDasharray="400"
          strokeDashoffset="400"
        />
        <path
          ref={motionPathRef}
          d={PATH_D}
          stroke="none"
          fill="none"
        />

        {/* Plume — GSAP la déplace le long du rail */}
        <g ref={penRef} className="gd-pen-group">
          <rect
            x="202.912" y="90.1729"
            width="43.3571" height="85.3028"
            rx="7.98716"
            transform="rotate(138.79 202.912 90.1729)"
            fill="currentColor"
          />
          <path
            d="M98.3047 67.6378C105.192 63.9124 113.74 65.4461 118.902 71.3331L154.194 111.578C158.529 116.522 159.578 123.541 156.876 129.535L141.684 163.24C139.775 167.475 136.194 170.73 131.797 172.228L47.168 201.056C38.5361 203.996 36.9963 192.563 43.7753 186.464L75.1173 158.266C76.6644 156.874 78.8721 156.613 80.9502 156.727C86.6504 157.037 91.5234 152.668 91.834 146.968C92.1444 141.268 87.7745 136.394 82.0742 136.084C76.3739 135.774 71.5018 140.144 71.1914 145.844C71.0462 148.512 70.5809 151.383 68.5972 153.174L37.0834 181.622C31.2198 186.915 21.6581 184.521 24.5234 177.159L56.6094 94.7247C58.0519 91.0185 60.7647 87.945 64.2627 86.0528L98.3047 67.6378Z"
            fill="currentColor"
          />
        </g>
      </svg>
    </button>
  )
}

export default function OnboardingGrid() {
  return (
    <div className="og-root">
      <p className="og-hint">Clique sur une carte pour la sélectionner</p>
      <div className="og-grid">
        <DevCard />
        <UiUxCard />
        <FinanceCard />
        <MarketingCard />
        <AutreCard />
        <GraphicDesignCard />
      </div>
    </div>
  )
}
