import { useRef, useEffect } from 'react'
import gsap from 'gsap'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'
import './Desktop35.css'

gsap.registerPlugin(MotionPathPlugin)

const A = (name: string) => `/assets/${name}.svg`

/* ─────────────────────────────────────────────────────────────────────────
   Icônes animées par spécialité — partagées entre l'écran autonome Desktop35
   et l'écran « spécialité » du parcours d'onboarding (App.tsx).
   Chaque icône s'anime quand `active` passe à true (classe is-active → CSS,
   sauf Graphisme qui pilote une timeline GSAP sur la plume).
───────────────────────────────────────────────────────────────────────── */

/* ─── Icône </>  Dev ────────────────────────────────────────────────────── */
function DevIcon({ active }: { active: boolean }) {
  return (
    <svg className={`sp-icon sp-icon--dev${active ? ' is-active' : ''}`} viewBox="0 0 215.22 128.184" fill="none" overflow="visible">
      <path className="sp-dev-chevron-l" d="M57.9337 19.05L11.7205 56.3376C6.77119 60.331 6.75774 67.8692 11.6928 71.8803L57.9337 109.463"
        stroke="currentColor" strokeWidth="16" strokeLinecap="round"/>
      <path className="sp-dev-chevron-r" d="M157.287 19.05L203.5 56.3376C208.449 60.331 208.463 67.8692 203.528 71.8803L157.287 109.463"
        stroke="currentColor" strokeWidth="16" strokeLinecap="round"/>
      <path className="sp-dev-slash" d="M131.928 8.00212L86.7212 120.182"
        stroke="currentColor" strokeWidth="16" strokeLinecap="round"/>
    </svg>
  )
}

/* ─── Icône Finance ─────────────────────────────────────────────────────── */
function FinanceIcon({ active }: { active: boolean }) {
  return (
    <svg className={`sp-icon sp-icon--finance${active ? ' is-active' : ''}`} viewBox="0 0 131.116 173" fill="none" overflow="visible">
      <rect className="sp-finance-bar sp-finance-bar--1" x="0" y="114.726" width="40.0632" height="58.2737" rx="7.28421" fill="currentColor"/>
      <rect className="sp-finance-bar sp-finance-bar--2" x="45.5264" y="0" width="40.0632" height="173" rx="7.28421" fill="currentColor"/>
      <rect className="sp-finance-bar sp-finance-bar--3" x="91.0527" y="61.916" width="40.0632" height="111.084" rx="7.28421" fill="currentColor"/>
    </svg>
  )
}

/* ─── Icône UI/UX artboard ──────────────────────────────────────────────── */
function UiUxIcon({ active }: { active: boolean }) {
  const paint = active ? 'url(#sp-frame-grad)' : 'currentColor'
  return (
    <svg className={`sp-icon sp-icon--uiux${active ? ' is-active' : ''}`} viewBox="0 0 236 236" fill="none" overflow="visible">
      <defs>
        <linearGradient id="sp-frame-grad" x1="0" y1="236" x2="236" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2E2962"/>
          <stop offset="100%" stopColor="#7E74F0"/>
        </linearGradient>
      </defs>
      <rect className="sp-frame-bar sp-frame-bar--right"  x="188" y="0"   width="16" height="236" rx="7.28421" fill={paint}/>
      <rect className="sp-frame-bar sp-frame-bar--left"   x="32"  y="0"   width="16" height="236" rx="7.28421" fill={paint}/>
      <rect className="sp-frame-bar sp-frame-bar--top"    x="0"   y="32"  width="236" height="16" rx="7.28421" fill={paint}/>
      <rect className="sp-frame-bar sp-frame-bar--bottom" x="0"   y="188" width="236" height="16" rx="7.28421" fill={paint}/>
    </svg>
  )
}

/* ─── Icône Marketing mégaphone ─────────────────────────────────────────── */
function MarketingIcon({ active }: { active: boolean }) {
  return (
    <div className={`sp-icon-wrap${active ? ' is-active' : ''}`}>
      <svg className="sp-icon sp-icon--mktg sp-mktg-body" viewBox="0 0 166.099 181" fill="none" overflow="visible">
        <path d="M57.9131 107.025V161.698C57.9131 170.425 50.839 177.5 42.1123 177.5C33.3855 177.5 26.3105 170.425 26.3105 161.698V107.025H57.9131Z"
          fill="currentColor" stroke="currentColor" strokeWidth="7"/>
        <path d="M21.6406 42.688H71.9512V107.044H21.6406C11.6219 107.044 3.50011 98.9226 3.5 88.9038V60.8286C3.50017 50.8099 11.6219 42.6882 21.6406 42.688Z"
          fill="currentColor" stroke="currentColor" strokeWidth="7"/>
        <path d="M152.55 4.81071L76.5145 41.21C74.0774 42.3766 72.5264 44.8387 72.5264 47.5406V102.621C72.5264 105.21 73.9519 107.589 76.2352 108.81L152.271 149.472C156.946 151.973 162.599 148.585 162.599 143.283V11.1414C162.599 5.97637 157.209 2.58052 152.55 4.81071Z"
          fill="currentColor" stroke="currentColor" strokeWidth="7"/>
      </svg>
      <svg className="sp-mktg-waves" viewBox="0 0 70 110" fill="none" overflow="visible">
        <line className="sp-mktg-wave sp-mktg-wave--1" x1="8" y1="22" x2="30" y2="10" stroke="currentColor" strokeWidth="14" strokeLinecap="round"/>
        <line className="sp-mktg-wave sp-mktg-wave--2" x1="8" y1="55" x2="34" y2="55" stroke="currentColor" strokeWidth="14" strokeLinecap="round"/>
        <line className="sp-mktg-wave sp-mktg-wave--3" x1="8" y1="88" x2="30" y2="100" stroke="currentColor" strokeWidth="14" strokeLinecap="round"/>
      </svg>
    </div>
  )
}

/* ─── Icône Autre (3 points) ────────────────────────────────────────────── */
function AutreIcon({ active }: { active: boolean }) {
  return (
    <div className={`sp-dots-wrap${active ? ' is-active' : ''}`}>
      <div className="sp-dot sp-dot--l" />
      <div className="sp-dot sp-dot--c" />
      <div className="sp-dot sp-dot--r" />
    </div>
  )
}

/* ─── Icône Graphic Design — plume GSAP ────────────────────────────────── */
const GD_PATH = 'M21.8906 18C88.9769 76.759 9.23627 112.249 8.02283 152.426C6.80938 192.603 55.0003 207 55.0003 207'

function GdIcon({ active, onToggle }: { active: boolean; onToggle?: () => void }) {
  const tlRef = useRef<gsap.core.Timeline | null>(null)
  const penRef = useRef<SVGGElement | null>(null)
  const traceRef = useRef<SVGPathElement | null>(null)
  const motionPathRef = useRef<SVGPathElement | null>(null)
  const prevActive = useRef(active)

  useEffect(() => {
    const pen = penRef.current
    const trace = traceRef.current
    const motionPath = motionPathRef.current
    if (!pen || !trace || !motionPath) return

    const pathLen = trace.getTotalLength()
    gsap.set(trace, { strokeDasharray: pathLen, strokeDashoffset: pathLen })

    const penBBox = pen.getBBox()
    const pathStart = motionPath.getPointAtLength(0)
    const anchorX = penBBox.x + penBBox.width * 0.05
    const anchorY = penBBox.y + penBBox.height * 0.95
    const deltaX = pathStart.x - anchorX
    const deltaY = pathStart.y - anchorY

    const ptStart0 = motionPath.getPointAtLength(0)
    const ptStart1 = motionPath.getPointAtLength(3)
    const angleAtStart = Math.atan2(ptStart1.y - ptStart0.y, ptStart1.x - ptStart0.x) * 180 / Math.PI
    const ptEnd0 = motionPath.getPointAtLength(pathLen - 3)
    const ptEnd1 = motionPath.getPointAtLength(pathLen)
    const angleAtEnd = Math.atan2(ptEnd1.y - ptEnd0.y, ptEnd1.x - ptEnd0.x) * 180 / Math.PI

    gsap.set(pen, { rotation: 0, x: 0, y: 0, transformOrigin: '50% 85%' })

    const PHASE1 = 0.3, PHASE2 = 0.65
    const tl = gsap.timeline({ paused: true })

    tl.to(pen, { rotation: angleAtStart - 25, duration: PHASE1, ease: 'back.out(1.4)' }, 0)
    tl.to(pen, { rotation: angleAtEnd, duration: PHASE2, ease: 'power1.inOut' }, PHASE1)
    tl.to(pen, { x: deltaX, y: deltaY, duration: PHASE1, ease: 'power2.inOut' }, 0)
    tl.to(trace, { strokeDashoffset: 0, duration: PHASE2, ease: 'power1.inOut' }, PHASE1)
    tl.to(pen, {
      duration: PHASE2, ease: 'power1.inOut',
      motionPath: { path: motionPath, align: motionPath, alignOrigin: [0.05, 0.95], autoRotate: false, start: 0, end: 1 },
    }, PHASE1)

    tlRef.current = tl
    return () => { tl.kill() }
  }, [])

  useEffect(() => {
    const tl = tlRef.current
    if (!tl) return
    if (active && !prevActive.current) tl.play()
    else if (!active && prevActive.current) tl.reverse()
    prevActive.current = active
  }, [active])

  return (
    <svg
      className={`sp-icon sp-icon--gd${active ? ' is-active' : ''}`}
      viewBox="0 0 242.068 215"
      fill="none"
      overflow="visible"
      onClick={onToggle}
      style={onToggle ? { cursor: 'pointer' } : undefined}
    >
      <path ref={traceRef} d={GD_PATH} stroke="currentColor" strokeWidth="16" strokeLinecap="round" fill="none" strokeDasharray="400" strokeDashoffset="400"/>
      <path ref={motionPathRef} d={GD_PATH} stroke="none" fill="none"/>
      <g ref={penRef} className="sp-gd-pen-group">
        <rect x="202.912" y="90.1729" width="43.3571" height="85.3028" rx="7.98716"
          transform="rotate(138.79 202.912 90.1729)" fill="currentColor"/>
        <path d="M98.3047 67.6378C105.192 63.9124 113.74 65.4461 118.902 71.3331L154.194 111.578C158.529 116.522 159.578 123.541 156.876 129.535L141.684 163.24C139.775 167.475 136.194 170.73 131.797 172.228L47.168 201.056C38.5361 203.996 36.9963 192.563 43.7753 186.464L75.1173 158.266C76.6644 156.874 78.8721 156.613 80.9502 156.727C86.6504 157.037 91.5234 152.668 91.834 146.968C92.1444 141.268 87.7745 136.394 82.0742 136.084C76.3739 135.774 71.5018 140.144 71.1914 145.844C71.0462 148.512 70.5809 151.383 68.5972 153.174L37.0834 181.622C31.2198 186.915 21.6581 184.521 24.5234 177.159L56.6094 94.7247C58.0519 91.0185 60.7647 87.945 64.2627 86.0528L98.3047 67.6378Z"
          fill="currentColor"/>
      </g>
    </svg>
  )
}

/* ─── Données des spécialités ───────────────────────────────────────────── */
export type Spec = 'code' | 'graphisme' | 'uiux' | 'marketing' | 'finance' | 'autre'

export const SPECIALITES: { id: Spec; label: string }[] = [
  { id: 'code',       label: 'Code'      },
  { id: 'graphisme',  label: 'Graphisme' },
  { id: 'uiux',       label: 'UI/UX'     },
  { id: 'marketing',  label: 'Marketing' },
  { id: 'finance',    label: 'Finance'   },
  { id: 'autre',      label: 'Autre'     },
]

/* ─── Tuile d'icône (67.5 × 67.5 px) — boîte sombre + lueurs + icône animée ─ */
export function SpecIconTile({ id, active }: { id: Spec; active: boolean }) {
  return (
    <div className="sp-icon-box">
      <div className="sp-icon-glow sp-icon-glow--top" style={{ backgroundImage: `url(${A('ellipse109')})` }} />
      <div className="sp-icon-glow sp-icon-glow--bot" style={{ backgroundImage: `url(${A('ellipse108')})` }} />
      {id === 'code'      && <DevIcon       active={active} />}
      {id === 'graphisme' && <GdIcon        active={active} />}
      {id === 'uiux'      && <UiUxIcon      active={active} />}
      {id === 'marketing' && <MarketingIcon active={active} />}
      {id === 'finance'   && <FinanceIcon   active={active} />}
      {id === 'autre'     && <AutreIcon     active={active} />}
      <div className="sp-icon-inset" />
    </div>
  )
}
