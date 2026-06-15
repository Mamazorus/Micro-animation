import { chromium } from 'playwright'

const SELECTORS = [
  '.ob-why-card', '.ob-why-cards', '.ob-screen--why', '.ob-root',
  '#root', '.ob-frank-layer', '.ob-frank', '.ob-frank-float', '.ob-frank-svg',
]
const PROPS = [
  'position', 'zIndex', 'opacity', 'transform', 'filter', 'backdropFilter',
  'webkitBackdropFilter', 'willChange', 'isolation', 'mixBlendMode',
  'perspective', 'contain', 'visibility',
]

async function probe(url) {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForTimeout(6000) // laisser les segments GSAP se poser
  const data = await page.evaluate((args) => {
    const { SELECTORS, PROPS } = args
    const out = {}
    for (const sel of SELECTORS) {
      const el = document.querySelector(sel)
      if (!el) { out[sel] = '(absent)'; continue }
      const cs = getComputedStyle(el)
      const o = {}
      for (const p of PROPS) o[p] = cs[p]
      o['_inlineStyle'] = el.getAttribute('style') || ''
      out[sel] = o
    }
    return out
  }, { SELECTORS, PROPS })
  await browser.close()
  return data
}

const build = await probe('http://localhost:4173/?ob=why')
const dev = await probe('http://localhost:5174/?ob=why')

console.log('\n================ DIFF DEV vs BUILD (par sélecteur) ================')
for (const sel of SELECTORS) {
  const b = build[sel], d = dev[sel]
  if (typeof b === 'string' || typeof d === 'string') {
    console.log(`\n${sel}: build=${JSON.stringify(b)} dev=${JSON.stringify(d)}`); continue
  }
  const diffs = []
  for (const p of [...PROPS, '_inlineStyle']) {
    if (b[p] !== d[p]) diffs.push(`    ${p}:\n        DEV  = ${d[p]}\n        BUILD= ${b[p]}`)
  }
  console.log(`\n${sel}`)
  if (diffs.length) console.log(diffs.join('\n'))
  else console.log('    (identique dev/build)')
}

console.log('\n================ VALEURS BUILD COMPLÈTES (carte + Frank) ================')
for (const sel of ['.ob-why-card', '.ob-frank-svg']) {
  console.log(`\n${sel} [BUILD]`)
  console.log(JSON.stringify(build[sel], null, 2))
}
