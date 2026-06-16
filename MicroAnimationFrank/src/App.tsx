import { useState, useRef, useEffect, useLayoutEffect, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react'
import gsap from 'gsap'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'
import OnboardingGrid from './OnboardingGrid'
import { SPECIALITES, SpecIconTile, type Spec } from './Specialties'
import './App.css'

gsap.registerPlugin(MotionPathPlugin)

const STEPS = ['welcome', 'login', 'skill', 'why', 'ia', 'specialite', 'precise', 'present', 'password', 'plan', 'feed'] as const
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
  // Écran login : Frank au premier plan gauche, face caméra (comme present).
  login:   fs(-0.25, 0.06,  1.65, 0),
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
/* Noms des tuiles IA fixes : sert à distinguer les IA SAISIES à la main (« Autre »)
   de celles déjà proposées en tuile, dans selectedAis (qui les contient toutes). */
const AI_TILE_NAMES = new Set(AI_OPTIONS.map(o => o.name))

/* Choix élargi du menu déroulant « Autre » — IA non affichées en tuile. L'utilisateur
   peut aussi saisir une valeur libre (la liste n'est qu'une aide à la saisie). */
const AI_MORE = [
  'Perplexity', 'Grok', 'DeepSeek', 'Llama', 'Cursor', 'Midjourney', 'DALL-E',
  'Stable Diffusion', 'Notion AI', 'Jasper', 'Suno', 'ElevenLabs', 'Runway', 'Sora',
  'Qwen', 'Poe',
]

/* Choix élargi du menu déroulant « Autre » — domaines hors des spécialités en tuile. */
const DOMAIN_MORE = [
  'Rédaction', 'Copywriting', 'Traduction', 'Data Science', 'Cybersécurité',
  'Product Management', 'Gestion de projet', 'Ressources humaines', 'Juridique',
  'Vente', 'Support client', 'Comptabilité', 'Photographie', 'Vidéo',
  'Audio / Musique', 'Architecture', 'Éducation', 'Recherche', 'E-commerce',
  'Communication', 'Réseaux sociaux', 'Immobilier', 'Consulting', 'Santé',
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

/* Catalogue de Skills du feed. Chaque Skill porte de quoi composer sa MINIATURE
   (icon = glyphe au trait, posé en sombre sur fond blanc) ET de quoi faire
   fonctionner les FILTRES :
   - domain : la spécialité à laquelle il se rattache (filtre « domaine »)
   - ais    : les IA compatibles (filtre par IA) — affichées en pastilles sur la carte
   - attrs  : étiquettes transverses (Populaire / Récent / Vérifié / Tendance)
   Le badge « vérifié » découle de attrs.includes('Vérifié') → badge et filtre restent
   cohérents (plus de tirage aléatoire : la liste est figée et lisible). */
type SkillCat = 'code' | 'graphisme' | 'uiux' | 'marketing' | 'finance'
type FeedSkill = {
  name: string; domain: SkillCat; icon: string
  ais: string[]; attrs: string[]; rating: string; installs: string
}
const CAT_LABEL: Record<SkillCat, string> = {
  code: 'Code', graphisme: 'Graphisme', uiux: 'UI/UX', marketing: 'Marketing', finance: 'Finance',
}
/* Nom d'IA → nom de fichier du logo (/assets/ai-logos/*.svg), dérivé d'AI_OPTIONS. */
const AI_LOGO: Record<string, string> = Object.fromEntries(AI_OPTIONS.map(o => [o.name, o.logo]))

const FEED_SKILLS: FeedSkill[] = [
  // Code
  { name: 'Refacto TypeScript', domain: 'code', icon: 'refresh', ais: ['Claude', 'Copilot', 'Codex'], attrs: ['Populaire', 'Vérifié'], rating: '4.8', installs: '12k installs' },
  { name: 'Chasseur de bugs', domain: 'code', icon: 'bug', ais: ['Claude', 'Codex', 'ChatGPT'], attrs: ['Populaire'], rating: '4.6', installs: '8k installs' },
  { name: 'Tests unitaires auto', domain: 'code', icon: 'test', ais: ['Claude', 'Copilot'], attrs: ['Vérifié'], rating: '4.5', installs: '5.5k installs' },
  { name: 'Docs de code', domain: 'code', icon: 'doc', ais: ['ChatGPT', 'Claude'], attrs: [], rating: '4.2', installs: '2.4k installs' },
  { name: 'Revue de PR', domain: 'code', icon: 'eye', ais: ['Claude', 'Copilot', 'Codex'], attrs: ['Vérifié', 'Tendance'], rating: '4.7', installs: '3.2k installs' },
  { name: 'Régex magique', domain: 'code', icon: 'wand', ais: ['ChatGPT', 'Mistral'], attrs: ['Récent'], rating: '4.1', installs: '900 installs' },
  { name: 'Optimiseur SQL', domain: 'code', icon: 'database', ais: ['Claude', 'Codex'], attrs: ['Vérifié'], rating: '4.4', installs: '1.1k installs' },
  { name: 'Messages de commit', domain: 'code', icon: 'branch', ais: ['Copilot', 'ChatGPT'], attrs: ['Populaire'], rating: '4.3', installs: '6k installs' },
  // Graphisme
  { name: 'Palette de couleurs', domain: 'graphisme', icon: 'palette', ais: ['ChatGPT', 'Gemini'], attrs: ['Populaire'], rating: '4.6', installs: '7k installs' },
  { name: 'Générateur de logo', domain: 'graphisme', icon: 'sparkles', ais: ['Gemini', 'ChatGPT', 'Loveable'], attrs: ['Tendance'], rating: '4.8', installs: '9k installs' },
  { name: 'Détourage auto', domain: 'graphisme', icon: 'scissors', ais: ['Gemini', 'ChatGPT'], attrs: ['Vérifié', 'Populaire'], rating: '4.5', installs: '5k installs' },
  { name: 'Upscale 4K', domain: 'graphisme', icon: 'expand', ais: ['Gemini'], attrs: ['Récent'], rating: '4.4', installs: '2k installs' },
  { name: 'Mockups produit', domain: 'graphisme', icon: 'image', ais: ['ChatGPT', 'Gemini', 'Loveable'], attrs: ['Populaire'], rating: '4.3', installs: '3.4k installs' },
  { name: 'Style transfer', domain: 'graphisme', icon: 'layers', ais: ['Gemini'], attrs: ['Récent', 'Tendance'], rating: '4.0', installs: '1.2k installs' },
  { name: "Banque d'icônes", domain: 'graphisme', icon: 'grid', ais: ['ChatGPT', 'Claude'], attrs: ['Vérifié'], rating: '4.5', installs: '4k installs' },
  { name: 'Presets motion', domain: 'graphisme', icon: 'play', ais: ['Gemini', 'Loveable'], attrs: ['Récent'], rating: '3.9', installs: '800 installs' },
  // UI/UX
  { name: "Audit d'accessibilité", domain: 'uiux', icon: 'shield', ais: ['Claude', 'ChatGPT'], attrs: ['Vérifié', 'Populaire'], rating: '4.7', installs: '6k installs' },
  { name: 'Design system', domain: 'uiux', icon: 'layers', ais: ['Claude', 'ChatGPT', 'Loveable'], attrs: ['Vérifié'], rating: '4.6', installs: '5.2k installs' },
  { name: 'Wireframe express', domain: 'uiux', icon: 'frame', ais: ['ChatGPT', 'Loveable', 'Gemini'], attrs: ['Populaire', 'Tendance'], rating: '4.5', installs: '4.4k installs' },
  { name: 'Microcopy UX', domain: 'uiux', icon: 'text', ais: ['Claude', 'ChatGPT'], attrs: [], rating: '4.3', installs: '2k installs' },
  { name: 'Insights & heatmap', domain: 'uiux', icon: 'chart', ais: ['ChatGPT', 'Gemini'], attrs: ['Récent'], rating: '4.2', installs: '1.5k installs' },
  { name: 'Composants Figma', domain: 'uiux', icon: 'grid', ais: ['Loveable', 'ChatGPT'], attrs: ['Vérifié', 'Populaire'], rating: '4.6', installs: '8k installs' },
  { name: 'Flow utilisateur', domain: 'uiux', icon: 'flow', ais: ['Claude', 'ChatGPT'], attrs: ['Récent', 'Tendance'], rating: '4.4', installs: '1.1k installs' },
  { name: 'Contraste & WCAG', domain: 'uiux', icon: 'shield', ais: ['Claude'], attrs: ['Vérifié'], rating: '4.5', installs: '3k installs' },
  // Marketing
  { name: 'Calendrier social', domain: 'marketing', icon: 'calendar', ais: ['ChatGPT', 'Gemini'], attrs: ['Populaire'], rating: '4.4', installs: '5k installs' },
  { name: 'Copywriting pub', domain: 'marketing', icon: 'megaphone', ais: ['Claude', 'ChatGPT'], attrs: ['Populaire', 'Vérifié'], rating: '4.6', installs: '7.5k installs' },
  { name: 'Audit SEO', domain: 'marketing', icon: 'search', ais: ['ChatGPT', 'Gemini'], attrs: ['Vérifié', 'Tendance'], rating: '4.5', installs: '6k installs' },
  { name: 'Séquences email', domain: 'marketing', icon: 'mail', ais: ['ChatGPT', 'Mistral'], attrs: [], rating: '4.2', installs: '2.2k installs' },
  { name: 'Idées de posts', domain: 'marketing', icon: 'sparkles', ais: ['ChatGPT', 'Gemini', 'Mistral'], attrs: ['Populaire'], rating: '4.3', installs: '4.6k installs' },
  { name: 'Analyse concurrence', domain: 'marketing', icon: 'eye', ais: ['Claude', 'ChatGPT'], attrs: ['Récent'], rating: '4.1', installs: '1.3k installs' },
  { name: 'Hashtags & tendances', domain: 'marketing', icon: 'hashtag', ais: ['ChatGPT', 'Gemini'], attrs: ['Tendance', 'Récent'], rating: '4.0', installs: '900 installs' },
  { name: 'Landing A/B', domain: 'marketing', icon: 'split', ais: ['ChatGPT', 'Loveable'], attrs: ['Vérifié'], rating: '4.4', installs: '2.8k installs' },
  // Finance
  { name: 'Prévisions de trésorerie', domain: 'finance', icon: 'chart', ais: ['Claude', 'ChatGPT'], attrs: ['Vérifié', 'Populaire'], rating: '4.6', installs: '4k installs' },
  { name: 'Catégorisation dépenses', domain: 'finance', icon: 'tag', ais: ['ChatGPT', 'Mistral'], attrs: [], rating: '4.3', installs: '2.5k installs' },
  { name: 'Modèle DCF', domain: 'finance', icon: 'calculator', ais: ['Claude', 'ChatGPT'], attrs: ['Vérifié'], rating: '4.5', installs: '1.6k installs' },
  { name: 'Rapport mensuel auto', domain: 'finance', icon: 'doc', ais: ['Claude', 'ChatGPT', 'Mistral'], attrs: ['Populaire'], rating: '4.4', installs: '3.1k installs' },
  { name: 'Veille marché', domain: 'finance', icon: 'eye', ais: ['ChatGPT', 'Gemini'], attrs: ['Récent', 'Tendance'], rating: '4.2', installs: '1.2k installs' },
  { name: 'Analyse de risque', domain: 'finance', icon: 'shield', ais: ['Claude'], attrs: ['Vérifié'], rating: '4.5', installs: '1.9k installs' },
  { name: 'Facturation auto', domain: 'finance', icon: 'receipt', ais: ['ChatGPT', 'Mistral'], attrs: ['Populaire'], rating: '4.3', installs: '5.5k installs' },
  { name: 'Tableau de bord KPI', domain: 'finance', icon: 'grid', ais: ['ChatGPT', 'Gemini', 'Claude'], attrs: ['Vérifié', 'Tendance'], rating: '4.6', installs: '6.2k installs' },
]
/* IA proposées au filtre du feed : uniquement celles qui ont au moins un Skill dans le
   catalogue (exclut « Autre », sans Skill → éviterait un feed vide), ordre d'AI_OPTIONS. */
const FEED_AIS = AI_OPTIONS.map(o => o.name).filter(name => FEED_SKILLS.some(s => s.ais.includes(name)))
const FEED_NAV = [
  { label: 'Feed personnalisé', icon: 'home' },
  { label: 'Explorer', icon: 'search' },
  { label: 'Mes Skills', icon: 'doc' },
  { label: 'Connecteurs', icon: 'connect' },
  { label: 'Paramètres', icon: 'gear' },
] as const
const FEED_EXTRA_FILTERS = ['Populaire', 'Récent', 'Vérifié', 'Tendance']

/* Mascotte + rôle selon le domaine choisi (1re spécialité). Chaque spécialité a
   son profil Frank dédié (assets/mascots/*.svg : vecteurs détourés, fond transparent,
   exportés de Figma) ; seul « Autre » retombe sur ui/ux faute de design dédié. */
const DOMAIN_INFO: Record<Spec, { mascot: string; role: string; label: string }> = {
  code:      { mascot: 'dev',       role: 'DÉVELOPPEUR',    label: 'Code' },
  graphisme: { mascot: 'graphic',   role: 'GRAPHISTE',      label: 'Graphisme' },
  uiux:      { mascot: 'uiux',      role: 'UI/UX DESIGNER', label: 'UI/UX' },
  marketing: { mascot: 'marketing', role: 'MARKETER',       label: 'Marketing' },
  finance:   { mascot: 'finance',   role: 'ANALYSTE',       label: 'Finance' },
  autre:     { mascot: 'uiux',      role: 'CRÉATIF',        label: 'UI/UX' },
}

/* Mascottes proposées dans le sélecteur ouvert au clic sur l'avatar du feed (les 5
   profils visuellement distincts). Ne change QUE l'icône affichée, pas le rôle ni le feed. */
const MASCOT_CHOICES: { mascot: string; label: string }[] = [
  { mascot: 'dev',       label: 'Dev'       },
  { mascot: 'uiux',      label: 'UI/UX'     },
  { mascot: 'graphic',   label: 'Graphisme' },
  { mascot: 'marketing', label: 'Marketing' },
  { mascot: 'finance',   label: 'Finance'   },
]

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
  { key: 'feed', Icon: IconFeedTarget, title: 'Feed personnalisé',
    text: "Construit dès l'inscription selon ton domaine + tes IA. Plus tu installes, plus c'est précis." },
  { key: 'install', Icon: IconInstallPlus, title: 'Installation en 1 clic',
    text: <>Pas de terminal, pas de fichier à copier. Frank s'occupe de tout.<br /></> },
  { key: 'verif', Icon: IconVerified, title: 'Skills vérifiés',
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

/* ─── Combobox « Autre » ─────────────────────────────────────────────────────
   Champ de saisie + menu déroulant (choix élargi) déplié sous la grille quand la
   tuile « Autre » est sélectionnée (écrans IA et spécialité). On filtre la liste
   en tapant, on choisit une suggestion OU on ajoute une valeur libre (Entrée /
   ligne « Ajouter »). Les choix retenus s'affichent en jetons supprimables.
   `active` (= écran courant) pilote le fondu de sortie quand on quitte l'écran :
   GSAP n'anime pas ce bloc, donc on le masque nous-mêmes le temps de la transition. */
function OtherCombobox({
  active, visible = true, placeholder, suggestions, values, onAdd, onRemove,
}: {
  active: boolean
  visible?: boolean
  placeholder: string
  suggestions: string[]
  values: string[]
  onAdd: (v: string) => void
  onRemove: (v: string) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)

  const q = query.trim().toLowerCase()
  // Suggestions encore disponibles, filtrées par la saisie (insensible à la casse).
  const matches = suggestions.filter(s => !values.includes(s) && s.toLowerCase().includes(q))
  // Proposer l'ajout libre uniquement si la saisie ne correspond exactement à rien de connu.
  const known = [...suggestions, ...values].some(s => s.toLowerCase() === q)
  const canAddCustom = q.length > 0 && !known
  // Lignes du menu : ajout libre éventuel en tête, puis suggestions (plafonnées).
  const rows: { custom: boolean; label: string }[] = [
    ...(canAddCustom ? [{ custom: true, label: query.trim() }] : []),
    ...matches.slice(0, 8).map(label => ({ custom: false, label })),
  ]

  // Fermeture au clic extérieur. Le menu est en position:absolute dans le wrap (pas
  // de position:fixed, qui serait confiné par le transform GSAP de l'écran) → OK.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  const commit = (label: string) => {
    const v = label.trim()
    setQuery('')
    setActiveIdx(0)
    if (!v || values.includes(v)) return
    onAdd(v)
  }

  // Retrait d'un jeton : on JOUE d'abord la sortie (même esprit que les frames :
  // power2.in, scale + fondu) PUIS on démonte (onRemove) à la fin, sinon React
  // l'arracherait avant l'animation. removingRef évite de relancer sur double-clic.
  const removingRef = useRef<Set<string>>(new Set())
  const removeToken = (e: ReactMouseEvent<HTMLButtonElement>, v: string) => {
    if (removingRef.current.has(v)) return
    const node = (e.currentTarget as HTMLElement).closest('.ob-combo-token')
    if (!node) { onRemove(v); return }
    removingRef.current.add(v)
    gsap.to(node, {
      autoAlpha: 0, scale: 0.7, y: 8, duration: 0.3, ease: 'power2.in',
      onComplete: () => { removingRef.current.delete(v); onRemove(v) },
    })
  }

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActiveIdx(i => Math.min(i + 1, rows.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      const row = rows[activeIdx] ?? rows[0]
      if (row) commit(row.label)
    } else if (e.key === 'Escape') { setOpen(false) }
  }

  if (!visible) return <div className="ob-combo is-collapsed" aria-hidden="true" />
  return (
    <div ref={wrapRef} className={`ob-combo${active ? '' : ' is-hidden'}`}>
      <div className="ob-combo-field">
        <input
          className="ob-combo-input"
          type="text"
          value={query}
          placeholder={placeholder}
          aria-label={placeholder}
          autoComplete="off"
          onChange={e => { setQuery(e.target.value); setOpen(true); setActiveIdx(0) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        <span className="ob-combo-caret" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </div>

      {rows.length > 0 && (
        <ul className={`ob-combo-menu${open && active ? ' is-open' : ''}`} role="listbox">
          {rows.map((row, i) => (
            <li key={(row.custom ? '+' : '') + row.label}>
              <button
                type="button"
                role="option"
                aria-selected={i === activeIdx}
                className={`ob-combo-opt${i === activeIdx ? ' is-active' : ''}${row.custom ? ' ob-combo-opt--add' : ''}`}
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => commit(row.label)}
              >
                {row.custom ? <>Ajouter «&nbsp;{row.label}&nbsp;»</> : row.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      {values.length > 0 && (
        <div className="ob-combo-tokens">
          {values.map(v => (
            <span key={v} className="ob-combo-token">
              {v}
              <button type="button" className="ob-combo-token-x" aria-label={`Retirer ${v}`} onClick={e => removeToken(e, v)}>
                <IconClose />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function Onboarding() {
  const frankRef = useRef<HTMLDivElement>(null)
  const frankFloatRef = useRef<HTMLDivElement>(null)
  const frankVideoRef = useRef<HTMLVideoElement>(null)
  const frankSkillRef = useRef<HTMLVideoElement>(null)
  const bgDecoRef = useRef<HTMLDivElement>(null)
  // Écran 1 — accueil
  const titleRef    = useRef<HTMLHeadingElement>(null)
  const subRef      = useRef<HTMLParagraphElement>(null)
  const btnRef      = useRef<HTMLButtonElement>(null)
  const loginBtnRef = useRef<HTMLButtonElement>(null)
  // Écran login — « Se connecter »
  const loginHeadRef = useRef<HTMLDivElement>(null)
  const loginFormRef = useRef<HTMLFormElement>(null)
  const loginBackRef = useRef<HTMLDivElement>(null)
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
  // Sélecteur de mascotte : refs pour le clic-extérieur (cf. useEffect plus bas).
  const mascotPopRef = useRef<HTMLDivElement>(null)
  const mascotBtnRef = useRef<HTMLButtonElement>(null)
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
  // settle(idx) : force l'état canonique d'une étape, exposé hors de l'effet pour
  // les sauts (« Passer » / « Feed → ») et la navigation en reduced-motion.
  const settleRef      = useRef<((idx: number) => void) | null>(null)
  const doneRef        = useRef<(() => void) | null>(null)
  const commencerTlRef = useRef<gsap.core.Timeline | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const domainInitRef = useRef(true)

  // Deep links de prévisualisation : ?ob=skill | ?ob=why (état figé), ?frz=0..1 (scrub)
  const [step, setStep] = useState<Step>(() => {
    const ob = new URLSearchParams(window.location.search).get('ob')
    return ob === 'feed' ? 'feed' : ob === 'plan' ? 'plan' : ob === 'password' ? 'password' : ob === 'present' ? 'present' : ob === 'precise' ? 'precise' : ob === 'specialite' ? 'specialite' : ob === 'ia' ? 'ia' : ob === 'why' ? 'why' : ob === 'skill' ? 'skill' : ob === 'login' ? 'login' : 'welcome'
  })
  const [selectedAis, setSelectedAis] = useState<Set<string>>(() => new Set())
  const [selectedSpecs, setSelectedSpecs] = useState<Set<Spec>>(() => new Set())
  // Saisies « Autre » de domaines : Spec est un type fermé, donc les domaines libres
  // vivent à part (les IA libres, elles, tiennent dans selectedAis qui est Set<string>).
  const [customSpecs, setCustomSpecs] = useState<Set<string>>(() => new Set())
  const [selectedPrecise, setSelectedPrecise] = useState<Set<string>>(() => new Set())
  // Formulaire « On se présente » (contrôlé)
  const [presName, setPresName] = useState('')
  const [presEmail, setPresEmail] = useState('')
  const [presCgu, setPresCgu] = useState(false)
  // Mot de passe « Créer ton mot de passe » (contrôlé)
  const [presPwd, setPresPwd] = useState('')
  const [presPwd2, setPresPwd2] = useState('')
  // Visibilité des champs mot de passe (toggle œil), indépendante par champ.
  const [showPwd, setShowPwd] = useState(false)
  const [showPwd2, setShowPwd2] = useState(false)
  // Formulaire « Se connecter » (contrôlé)
  const [loginEmail] = useState('')
  const [loginPwd] = useState('')
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  // Feed : filtres choisis (chips actifs) + affichage de filtres supplémentaires.
  const [feedFilters, setFeedFilters] = useState<Set<string>>(() => new Set())
  const [showFilters, setShowFilters] = useState(false)
  // Feed : état d'installation par Skill (animation « installation 1 clic »).
  const [feedInstalls, setFeedInstalls] = useState<Record<string, 'installing' | 'installed'>>({})
  // Feed : sélecteur de mascotte (clic sur l'avatar). Override purement visuel de
  // l'icône, indépendant du domaine choisi (le rôle et les textes du feed ne changent pas).
  const [mascotOverride, setMascotOverride] = useState<string | null>(null)
  const [mascotPickerOpen, setMascotPickerOpen] = useState(false)
  const [pickerHover, setPickerHover] = useState<string | null>(null) // mascotte survolée → libellé dynamique

  // Validations dérivées (recalculées à chaque rendu).
  const loginValid = loginEmail.trim().length > 0 && loginPwd.length > 0
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
  const navLabel = step === 'login' ? 'Se connecter' : step === 'present' || step === 'password' ? 'Enregistrer' : 'Suivant'
  const navDisabled =
    step === 'login' ? !loginValid :
    step === 'present' ? !presValid :
    step === 'password' ? !pwdValid :
    step === 'plan' ? !selectedPlan : false

  // Personnalisation du feed à partir des choix du parcours.
  const primaryDomain: Spec = [...selectedSpecs][0] ?? 'uiux'
  const domainInfo = DOMAIN_INFO[primaryDomain]
  // Mascotte affichée dans la sidebar : l'override manuel (clic sur l'avatar) prime
  // sur celle du domaine ; sinon on retombe sur la mascotte du domaine choisi.
  const shownMascot = mascotOverride ?? domainInfo.mascot
  // Groupes de « Plus précisément ? » propres au domaine principal choisi.
  const preciseGroups = PRECISE_BY_DOMAIN[primaryDomain]
  const userName = presName.trim() || 'toi'
  // « Autre » est un conteneur, pas une IA : on l'exclut du texte (les IA saisies, elles, comptent).
  const userAis = [...selectedAis].filter(a => a !== 'Autre').slice(0, 2).join(' + ') || 'tes IA'

  // Filtrage du feed par FACETTES. Trois familles de chips actifs :
  //   - domaine : le chip du domaine de l'utilisateur (un seul)
  //   - IA      : ses chips d'IA (les 2 premières choisies)
  //   - attributs : Populaire / Récent / Vérifié / Tendance
  // Une carte passe si, pour CHAQUE famille active, elle satisfait au moins un chip
  // (OU intra-famille) ; les attributs, eux, sont CUMULATIFS (ET). Une famille sans
  // chip actif n'impose rien. `feedDomain` ramène « autre » sur uiux (pas de Skills
  // « autre »), comme la mascotte. Désactiver le chip domaine = explorer tous domaines.
  const feedDomain: SkillCat = primaryDomain === 'autre' ? 'uiux' : primaryDomain
  const domainActive = feedFilters.has(domainInfo.label)
  const activeAis = [...feedFilters].filter(f => f in AI_LOGO)
  const activeAttrs = FEED_EXTRA_FILTERS.filter(f => feedFilters.has(f))
  const visibleSkills = FEED_SKILLS.filter(s =>
    (!domainActive || s.domain === feedDomain) &&
    (activeAis.length === 0 || s.ais.some(a => activeAis.includes(a))) &&
    activeAttrs.every(a => s.attrs.includes(a)),
  )
  // Chips d'IA « rapides » de l'utilisateur (ses 2 premières choisies au parcours,
  // restreintes à celles qui ont des Skills) ; les autres IA sont proposées au dépliage.
  const userAiChips = [...selectedAis].filter(a => FEED_AIS.includes(a)).slice(0, 2)
  const otherAis = FEED_AIS.filter(a => !userAiChips.includes(a))

  const toggleFeedFilter = (f: string) =>
    setFeedFilters(prev => {
      const next = new Set(prev)
      if (next.has(f)) next.delete(f)
      else next.add(f)
      return next
    })
  // Chip d'IA (logo + nom), partagé par la rangée rapide et le panneau déplié.
  const feedAiChip = (name: string) => (
    <button key={name} type="button"
      className={`ob-feed-chip ob-feed-chip--ai${feedFilters.has(name) ? ' is-on' : ''}`}
      onClick={() => toggleFeedFilter(name)}>
      <img className="ob-feed-chip-logo" src={`/assets/ai-logos/${AI_LOGO[name]}.svg`} alt="" aria-hidden="true" />
      {name}
    </button>
  )
  // Installation 1 clic : la progression se joue seule (barre qui se remplit → coché),
  // pour faire sentir la promesse « pas de terminal, Frank s'occupe de tout ».
  const installSkill = (name: string) => {
    setFeedInstalls(prev => (prev[name] ? prev : { ...prev, [name]: 'installing' }))
    window.setTimeout(() => {
      setFeedInstalls(prev => (prev[name] === 'installing' ? { ...prev, [name]: 'installed' } : prev))
    }, 300)
  }
  // À l'arrivée sur le feed, on coche par défaut les filtres « contexte » (domaine + ses IA).
  useEffect(() => {
    if (step === 'feed') {
      setFeedFilters(prev => (prev.size ? prev : new Set([domainInfo.label, ...userAiChips])))
    }
  }, [step])

  // Sélecteur de mascotte : fermeture à la touche Échap ET au clic en dehors du
  // popover. On écoute `document` plutôt qu'un overlay `position: fixed` : la sidebar
  // (.ob-feed-side) porte un transform GSAP permanent (x:0), qui confinerait tout
  // fixed à sa boîte → l'overlay ne couvrait que la sidebar. Le listener global est
  // insensible au transform/stacking et ferme depuis n'importe où dans le document.
  useEffect(() => {
    if (!mascotPickerOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMascotPickerOpen(false) }
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node
      // Clic dans le popover → on laisse les boutons (croix, choix) gérer.
      if (mascotPopRef.current?.contains(t)) return
      // Clic sur l'avatar → son propre onClick gère le toggle (pas de double bascule).
      if (mascotBtnRef.current?.contains(t)) return
      setMascotPickerOpen(false)
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [mascotPickerOpen])

  // Filet de masquage déterministe (cf. .ob-screen--off dans App.css). Au REPOS
  // (settled=true, posé en fin de transition/saut), tout écran NON courant reçoit
  // .ob-screen--off → forcé invisible, même si une transition interrompue (navigation
  // rapide / saut) l'avait laissé à autoAlpha>0 (sinon il resterait peint derrière le
  // feed, dernier écran du DOM à z-index égal). Pendant une transition (settled=false)
  // la classe est retirée de tous → GSAP garde la main. Les .ob-screen sont en ordre
  // DOM = ordre STEPS, d'où l'indexation (les écrans ia→plan partagent .ob-screen--ia).
  const applyNet = (idx: number, settled: boolean) => {
    const screens = rootRef.current?.querySelectorAll('.ob-screen')
    screens?.forEach((s, k) => s.classList.toggle('ob-screen--off', settled && k !== idx))
  }

  // useLayoutEffect (et non useEffect) : on pose les autoAlpha:0 et le --ss AVANT le premier
  // paint, sinon le navigateur affiche une frame avec tous les écrans de l'onboarding visibles
  // (ils sont dans le HTML) avant que GSAP ne les cache → flash au chargement.
  useLayoutEffect(() => {
    const frank = frankRef.current
    if (!frank) return
    // Suréchantillonnage : .ob-frank est layouté FRANK_SS× plus grand (cf. App.css + FRANK).
    frank.style.setProperty('--ss', String(FRANK_SS))

    const welcomeEls = [titleRef.current, subRef.current, btnRef.current, loginBtnRef.current]
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
    const loginFormEls = loginFormRef.current ? Array.from(loginFormRef.current.children) : []
    const planCards = planCardsRef.current ? Array.from(planCardsRef.current.children) : []
    // Le feed est filtré dynamiquement (les cartes se montent/démontent selon les
    // filtres) : on ne capture donc PAS les cartes ici. On anime le CONTENEUR de la
    // grille (cible stable) et les cartes entrent en CSS (cf. .ob-feed-grid.is-revealed).

    const params = new URLSearchParams(window.location.search)
    const ob  = params.get('ob')
    const frz = params.get('frz')
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    reduceRef.current = reduce

    const startStep: Step =
      ob === 'feed' ? 'feed' : ob === 'plan' ? 'plan' : ob === 'password' ? 'password' : ob === 'present' ? 'present' : ob === 'precise' ? 'precise' : ob === 'specialite' ? 'specialite' : ob === 'ia' ? 'ia' : ob === 'why' ? 'why' : ob === 'skill' ? 'skill' : ob === 'login' ? 'login' : 'welcome'
    const startIdx = STEPS.indexOf(startStep)
    idxRef.current = startIdx

    const done = () => { animatingRef.current = false; applyNet(idxRef.current, true) }
    doneRef.current = done

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
    gsap.set([loginHeadRef.current, loginBackRef.current], { autoAlpha: 0, y: 24 })
    gsap.set(loginFormEls, { autoAlpha: 0, y: 20 })
    gsap.set([presHeadRef.current, presBackRef.current], { autoAlpha: 0, y: 24 })
    gsap.set(presFormEls, { autoAlpha: 0, y: 20 })
    gsap.set([pwdHeadRef.current, pwdBackRef.current], { autoAlpha: 0, y: 24 })
    gsap.set(pwdFormEls, { autoAlpha: 0, y: 20 })
    gsap.set([planHeadRef.current, planNavRef.current], { autoAlpha: 0, y: 24 })
    gsap.set(planCards, { autoAlpha: 0, y: 24, scale: 0.96 })
    gsap.set(feedSideRef.current, { autoAlpha: 0, x: -40 })
    gsap.set(feedHeadRef.current, { autoAlpha: 0, y: 20 })
    gsap.set(feedCardsRef.current, { autoAlpha: 0 })   // conteneur caché → aucune carte ne flashe au chargement

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

    // Force l'état CANONIQUE de l'étape idx, quel que soit l'état laissé par une
    // transition interrompue ou un saut. Invariant COMPLET sur TOUT l'éventail de
    // segments (comme onResize/rebuild, et non seulement ceux traversés), + recalage
    // de Frank/mascotte, + filet CSS réactivé. Point de convergence des sauts.
    // suppressEvents laissé à false : le segment plan→feed doit pouvoir tirer son
    // callback « is-revealed » qui révèle les cartes du feed lors d'un saut direct.
    const settle = (idx: number) => {
      segsRef.current.forEach((t, k) => t.progress(k < idx ? 1 : 0))
      applyFrank(STEPS[idx])
      applyMascotKind(STEPS[idx])
      applyNet(idx, true)
    }
    settleRef.current = settle

    // Segment 0 — accueil → position login : Frank nage vers le premier plan gauche.
    // Les éléments UI de l'écran login ne sont plus révélés ici ; goCommencer enchaîne
    // directement sur le seg 1 (→ skill) sans s'arrêter sur login.
    const buildWelcomeLogin = () => {
      const h = window.innerHeight, w = window.innerWidth
      const t = gsap.timeline({ paused: true, onComplete: done, onReverseComplete: done })

      t.to([btnRef.current, loginBtnRef.current, subRef.current, titleRef.current],
        { autoAlpha: 0, y: 16, duration: 0.36, stagger: 0.07, ease: 'power2.in' }, 0)

      const loginLean = makeLean(frank, FRANK.welcome.rot, FRANK.login.rot, true)
      t.to(frank, { duration: 1.2, ease: 'sine.inOut',
        scale: FRANK.login.scale, rotation: FRANK.login.rot,
        motionPath: { path: [
          { x: FRANK.welcome.x * w, y: FRANK.welcome.y * h },
          { x: FRANK.login.x * w,   y: FRANK.login.y * h },
        ], curviness: 1.2, autoRotate: false },
        onStart: loginLean.start, onUpdate: loginLean.update }, 0.1)
      t.to(frank, { opacity: FRANK.login.opacity, duration: 0.8, ease: 'power1.out' }, 0.2)

      return t
    }

    // Segment 1 — login → « Un clic suffit » : la plongée depuis la position login
    const buildLoginSkill = () => {
      const h = window.innerHeight, w = window.innerWidth
      const t = gsap.timeline({ paused: true, onComplete: done, onReverseComplete: done })
      const divePath = [
        { x: FRANK.login.x * w, y: FRANK.login.y * h },
        { x: -0.05 * w,          y: 0.16 * h },
        { x:  0.03 * w,          y: 0.52 * h },
        { x: 0,                  y: 0.82 * h },  // sort par le bas
      ]
      t.to(loginBackRef.current, { autoAlpha: 0, y: 16, duration: 0.3, ease: 'power2.in' }, 0)
      t.to(loginHeadRef.current, { autoAlpha: 0, y: -16, duration: 0.34, ease: 'power2.in' }, 0)
      t.to(loginFormEls, { autoAlpha: 0, y: 16, duration: 0.36, stagger: 0.05, ease: 'power2.in' }, 0)
      const wsLeanOut = makeLean(frank, FRANK.login.rot, FRANK.login.rot, false)
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

      // L'app se matérialise : sidebar depuis la gauche, bandeau, puis la grille.
      // La classe is-revealed est posée AVANT que le conteneur ne s'affiche, pour que
      // les cartes (déjà filtrées par domaine+IA à l'arrivée) entrent en cascade CSS
      // depuis l'opacité 0 (cf. @keyframes ob-feed-card-in), sans 1re frame visible.
      t.to(feedSideRef.current, { autoAlpha: 1, x: 0, duration: 0.6, ease: 'power3.out' }, 0.7)
      t.to(feedHeadRef.current, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power2.out' }, 0.95)
      t.add(() => feedCardsRef.current?.classList.add('is-revealed'), 1.05)
      t.set(feedCardsRef.current, { autoAlpha: 1 }, 1.1)

      return t
    }

    const buildSegments = () => {
      segsRef.current.forEach(t => t.kill())
      segsRef.current = [buildWelcomeLogin(), buildLoginSkill(), buildSkillWhy(), buildWhyIa(), buildIaSpecialite(), buildSpecialitePrecise(), buildPrecisePresent(), buildPresentPassword(), buildPasswordPlan(), buildPlanFeed()]
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
    let introPlaying = false   // vrai pendant le gros plan d'ouverture + dézoom → pas de traînée de bulles

    // Flottement idle (cf. startFloat) : créé à amplitude nulle ; il éclot pendant
    // l'intro (dézoom gros plan → petit) ou apparaît en fondu en aperçu d'écran.
    // Pas de flottement en reduced-motion ni en aperçu scrubé (frz) — captures stables.
    const float =
      frankFloatRef.current && !reduce && frz === null ? startFloat(frankFloatRef.current) : null

    if (ob || frz !== null) {
      // Aperçu figé : on pose l'état de départ et on scrub éventuellement le bon segment
      applyFrank(startStep)
      applyMascotKind(startStep)
      applyNet(startIdx, false)   // aperçu : GSAP pose tout explicitement, filet désactivé
      if (startStep === 'welcome') gsap.set(welcomeEls, { autoAlpha: 1, y: 0 })
      else if (startStep === 'skill') gsap.set(skillEls, { autoAlpha: 1, y: 0 })
      else if (startStep === 'why') gsap.set([...whyEls, ...whyCards], { autoAlpha: 1, y: 0 })
      else if (startStep === 'ia') gsap.set([iaHeadRef.current, ...iaEls, ...iaChips], { autoAlpha: 1, y: 0, scale: 1 })
      else if (startStep === 'specialite') gsap.set([spHeadRef.current, ...spEls, ...spCards], { autoAlpha: 1, y: 0, scale: 1 })
      else if (startStep === 'precise') gsap.set([prHeadRef.current, ...prEls, ...prLabels, ...prChips], { autoAlpha: 1, y: 0, scale: 1 })
      else if (startStep === 'login') gsap.set([loginHeadRef.current, loginBackRef.current, ...loginFormEls], { autoAlpha: 1, y: 0 })
      else if (startStep === 'present') gsap.set([presHeadRef.current, presBackRef.current, ...presFormEls], { autoAlpha: 1, y: 0 })
      else if (startStep === 'password') gsap.set([pwdHeadRef.current, pwdBackRef.current, ...pwdFormEls], { autoAlpha: 1, y: 0 })
      else if (startStep === 'plan') gsap.set([planHeadRef.current, planNavRef.current, ...planCards], { autoAlpha: 1, y: 0, scale: 1 })
      else { gsap.set([feedSideRef.current, feedHeadRef.current, feedCardsRef.current], { autoAlpha: 1, x: 0, y: 0 }); feedCardsRef.current?.classList.add('is-revealed') }
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
      intro = gsap.timeline({ delay: reduce ? 0 : 1.0, onComplete: () => { introPlaying = false; done() } })
      if (reduce) {
        applyFrank('welcome')
        gsap.set(welcomeEls, { autoAlpha: 1, y: 0 })
        gsap.set(bgDecoRef.current, { autoAlpha: 1 })
        applyNet(idxRef.current, true)   // pas d'animation : filet actif d'emblée
      } else {
        // Verrou pendant le gros plan + dézoom d'intro : sinon « Commencer » / « Feed → »
        // (gardés par animatingRef) lancent une transition PAR-DESSUS l'intro → Frank
        // doublement animé et écrans superposés. Relâché par onComplete (done) ci-dessus.
        animatingRef.current = true
        applyNet(idxRef.current, false)   // intro en cours → GSAP a la main, filet off (done() le réactive)
        introPlaying = true   // coupe la traînée de bulles pour toute la durée du dézoom d'intro
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
        // Première animation (gros plan d'ouverture → dézoom) : Frank arrive en scène
        // sans traînée. Les bulles ne commencent qu'une fois posé sur l'accueil.
        if (introPlaying) { lx = null; acc = 0; idleAcc = 0; wasEligible = false; return }
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
      // kill() ne tire pas onComplete : sans ça, le verrou posé par l'intro (ou une
      // transition) resterait coincé après un démontage (double-montage StrictMode en dev).
      animatingRef.current = false
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
    if (reduceRef.current) { settleRef.current?.(i + 1); return }
    animatingRef.current = true
    applyNet(i + 1, false)
    segsRef.current[i].play()
  }

  // Saut direct vers une étape avancée (« Passer » → present, « Feed → » → feed).
  // Au lieu de ne snapper que les segments traversés (ce qui laissait les écrans en
  // AVAL à autoAlpha>0 → visibles derrière le feed lors de navigations rapides), on
  // délègue à settle() : invariant COMPLET sur tous les segments + recalage de Frank
  // + filet CSS. L'état obtenu est déterministe quel que soit l'ordre des clics, donc
  // un goNext/goPrev ultérieur repart d'une base saine.
  const jumpTo = (target: Step) => {
    if (animatingRef.current) return
    const targetIdx = STEPS.indexOf(target)
    if (idxRef.current >= targetIdx) return
    idxRef.current = targetIdx
    setStep(target)
    settleRef.current?.(targetIdx)
  }
  const goToPresent = () => jumpTo('present')

  const goCommencer = () => {
    if (animatingRef.current || idxRef.current !== 0) return
    animatingRef.current = true
    idxRef.current = 2
    setStep('skill')
    if (reduceRef.current) { settleRef.current?.(2); return }
    applyNet(2, false)

    const frank = frankRef.current
    const w = window.innerWidth, h = window.innerHeight
    // divePath identique au seg 1 mais premier point = position welcome (pas login)
    const divePath = [
      { x: FRANK.welcome.x * w, y: FRANK.welcome.y * h },
      { x: -0.05 * w,            y: 0.16 * h },
      { x:  0.03 * w,            y: 0.52 * h },
      { x: 0,                    y: 0.82 * h },
    ]
    const tl = gsap.timeline({ onComplete: doneRef.current ?? undefined, onReverseComplete: doneRef.current ?? undefined })
    tl.to([btnRef.current, loginBtnRef.current, subRef.current, titleRef.current],
      { autoAlpha: 0, y: 16, duration: 0.36, stagger: 0.07, ease: 'power2.in' }, 0)
    tl.to(frank, { duration: 0.85, ease: 'power2.in',
      motionPath: { path: divePath, curviness: 1.4, autoRotate: false } }, 0.08)
    tl.to(frank, { opacity: 0, duration: 0.34, ease: 'power2.in' }, 0.55)
    tl.set(frankVideoRef.current, { autoAlpha: 0 }, 0.9)
    tl.set(frankSkillRef.current, { autoAlpha: 1 }, 0.9)
    tl.to(frank, { duration: 0.95, ease: 'power3.out',
      motionPath: { path: [{ x: 0, y: 0.82 * h }, { x: 0, y: FRANK.skill.y * h }], autoRotate: false },
      scale: FRANK.skill.scale, rotation: FRANK.skill.rot }, 0.92)
    tl.to(frank, { opacity: FRANK.skill.opacity, duration: 0.5, ease: 'power2.out' }, 0.95)
    tl.to([skipRef.current, skillRef.current, navRef.current],
      { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.1, ease: 'power2.out' }, 1.3)
    commencerTlRef.current = tl
  }

  // Raccourci de dév « Feed → » masqué (cf. rendu plus bas). Décommenter avec le
  // bouton pour réactiver le saut direct vers le feed.
  // const goToFeed = () => jumpTo('feed')

  const goPrev = () => {
    const i = idxRef.current
    if (animatingRef.current || i <= 0) return
    // Depuis skill (idx=2), si on est arrivé via « Commencer » (seg 0 sans UI login),
    // on joue seg 1 reverse (skill→position login) puis seg 0 reverse (→welcome).
    if (i === 2 && commencerTlRef.current) {
      animatingRef.current = true
      idxRef.current = 0
      setStep('welcome')
      if (reduceRef.current) { settleRef.current?.(0); return }
      applyNet(0, false)
      commencerTlRef.current.reverse()
      return
    }
    idxRef.current = i - 1
    setStep(STEPS[i - 1])
    if (reduceRef.current) { settleRef.current?.(i - 1); return }
    animatingRef.current = true
    applyNet(i - 1, false)
    segsRef.current[i - 1].reverse()
  }

  const toggleAi = (name: string) => {
    setSelectedAis(prev => {
      const next = new Set(prev)
      if (next.has(name)) {
        next.delete(name)
        // Déselectionner « Autre » retire aussi les IA saisies à la main (leur conteneur s'en va).
        if (name === 'Autre') for (const a of [...next]) if (!AI_TILE_NAMES.has(a)) next.delete(a)
      } else next.add(name)
      return next
    })
  }

  // Spécialité = choix multiple (comme les IA) ; re-cliquer désélectionne.
  const toggleSpec = (id: Spec) => {
    setSelectedSpecs(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    // Déselectionner « Autre » vide les domaines saisis à la main.
    if (id === 'autre' && selectedSpecs.has('autre')) setCustomSpecs(new Set())
  }

  // IA saisies à la main = celles de selectedAis qui ne sont pas une tuile fixe.
  const customAiTokens = [...selectedAis].filter(a => !AI_TILE_NAMES.has(a))
  const addCustomAi = (v: string) => setSelectedAis(prev => new Set(prev).add(v))
  const removeCustomAi = (v: string) =>
    setSelectedAis(prev => { const n = new Set(prev); n.delete(v); return n })
  const addCustomSpec = (v: string) => setCustomSpecs(prev => new Set(prev).add(v))
  const removeCustomSpec = (v: string) =>
    setCustomSpecs(prev => { const n = new Set(prev); n.delete(v); return n })

  // « Plus précisément ? » = tags multi-select groupés ; clé = `${groupe}|${option}`.
  const togglePrecise = (key: string) =>
    setSelectedPrecise(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <div ref={rootRef} className={`ob-root onboarding-bg is-${step}`}>
      {/* Raccourci de dév « Feed → » (saut direct au feed) masqué pour la démo.
          Décommenter ce bloc + goToFeed plus haut pour le réactiver. */}
      {/* {step !== 'feed' && (
        <button className="nav-btn" onClick={goToFeed}>Feed →</button>
      )} */}

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
        <div className="ob-welcome-actions">
          <button ref={loginBtnRef} className="ob-btn ob-btn--secondary ob-btn--login" type="button" disabled>Se connecter</button>
          <button ref={btnRef} className="ob-btn" onClick={goCommencer}>Commencer</button>
        </div>
      </div>

      {/* Écran login — contenu supprimé (non utilisé dans le flow actuel) */}
      <div className="ob-screen ob-screen--ia">
        <div ref={loginHeadRef} />
        <form ref={loginFormRef} />
        <div ref={loginBackRef} />
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
              <div className="ob-why-card-media" aria-hidden="true">
                <WhyDemo demoKey={key} />
              </div>
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
        <div className="ob-ia-col">
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
          <OtherCombobox
            visible={selectedAis.has('Autre')}
            active={step === 'ia'}
            placeholder="Saisis ton IA"
            suggestions={AI_MORE}
            values={customAiTokens}
            onAdd={addCustomAi}
            onRemove={removeCustomAi}
          />
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
        <div className="ob-ia-col">
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
          <OtherCombobox
            visible={selectedSpecs.has('autre')}
            active={step === 'specialite'}
            placeholder="Saisis ton domaine"
            suggestions={DOMAIN_MORE}
            values={[...customSpecs]}
            onAdd={addCustomSpec}
            onRemove={removeCustomSpec}
          />
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
            <div className="ob-pwd-wrap">
              <input id="ob-pwd" className="ob-input ob-input--pwd" type={showPwd ? 'text' : 'password'} autoComplete="new-password"
                value={presPwd} onChange={e => setPresPwd(e.target.value)} />
              <button type="button" className="ob-pwd-toggle" onClick={() => setShowPwd(v => !v)}
                aria-label={showPwd ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} aria-pressed={showPwd}>
                {showPwd ? <IconEyeOff /> : <IconEye />}
              </button>
            </div>
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
            <div className="ob-pwd-wrap">
              <input id="ob-pwd2" className="ob-input ob-input--pwd" type={showPwd2 ? 'text' : 'password'} autoComplete="new-password"
                value={presPwd2} onChange={e => setPresPwd2(e.target.value)} />
              <button type="button" className="ob-pwd-toggle" onClick={() => setShowPwd2(v => !v)}
                aria-label={showPwd2 ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} aria-pressed={showPwd2}>
                {showPwd2 ? <IconEyeOff /> : <IconEye />}
              </button>
            </div>
          </div>
        </form>
        <div ref={pwdBackRef} className="ob-pres-back" />
      </div>

      {/* Écran 9 — Choisis ton plan */}
      <div className="ob-screen ob-screen--ia">
        <div ref={planHeadRef} className="ob-plan-head">
          <h1 className="ob-title ob-title--lg">Choisis ton plan</h1>
          <p className="ob-subtitle"><strong>Commence gratuitement</strong>, sans carte bancaire.</p>
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
          {/* Dégradé violet d'origine du Figma, appliqué au glyphe de l'item actif. */}
          <svg className="ob-feed-defs" width="0" height="0" aria-hidden="true" focusable="false">
            <defs>
              <linearGradient id="feed-ic-grad" x1="1" y1="1" x2="0" y2="0">
                <stop stopColor="#7E74F0" />
                <stop offset="1" stopColor="#2E2962" />
              </linearGradient>
            </defs>
          </svg>
          <p className="ob-feed-logo"><em>Frank</em></p>
          <nav className="ob-feed-nav">
            {FEED_NAV.map((item, i) => (
              <span key={item.label} className={`ob-feed-navitem${i === 0 ? ' is-active' : ''}`}>
                <span className="ob-feed-navicon" aria-hidden="true"><FeedNavIcon kind={item.icon} /></span>
                {item.label}
              </span>
            ))}
          </nav>
          <div className="ob-feed-user">
            <button
              ref={mascotBtnRef}
              type="button"
              className="ob-feed-avatar-btn"
              aria-label="Changer de mascotte"
              aria-haspopup="menu"
              aria-expanded={mascotPickerOpen}
              onClick={() => { setMascotPickerOpen(o => !o); setPickerHover(null) }}
            >
              <img className="ob-feed-avatar" src={`/assets/mascots/${shownMascot}.svg`} alt="" aria-hidden="true" />
              <span className="ob-feed-avatar-edit" aria-hidden="true"><IconPen /></span>
            </button>
            <span className="ob-feed-userinfo">
              <span className="ob-feed-username">{userName}</span>
              <span className="ob-feed-userrole">{domainInfo.role}</span>
            </span>

            {mascotPickerOpen && (
              <div ref={mascotPopRef} className="ob-mascot-pop" role="menu" aria-label="Choisir une mascotte">
                <button
                  type="button"
                  className="ob-mascot-pop-close"
                  aria-label="Fermer"
                  onClick={() => setMascotPickerOpen(false)}
                >
                  <IconClose />
                </button>
                <p className="ob-mascot-pop-head">Change de tête</p>
                <div className="ob-mascot-pop-grid" onMouseLeave={() => setPickerHover(null)}>
                  {MASCOT_CHOICES.map(c => (
                    <button
                      key={c.mascot}
                      type="button"
                      role="menuitemradio"
                      aria-checked={shownMascot === c.mascot}
                      aria-label={c.label}
                      title={c.label}
                      className={`ob-mascot-choice${shownMascot === c.mascot ? ' is-active' : ''}`}
                      onMouseEnter={() => setPickerHover(c.mascot)}
                      onFocus={() => setPickerHover(c.mascot)}
                      onClick={() => { setMascotOverride(c.mascot); setMascotPickerOpen(false) }}
                    >
                      <img src={`/assets/mascots/${c.mascot}.svg`} alt="" aria-hidden="true" />
                    </button>
                  ))}
                </div>
                <p className="ob-mascot-pop-name">
                  {MASCOT_CHOICES.find(c => c.mascot === (pickerHover ?? shownMascot))?.label}
                </p>
              </div>
            )}
          </div>
        </aside>
        <div className="ob-feed-main">
          <div ref={feedHeadRef} className="ob-feed-head">
            <div className="ob-feed-banner">
              <p className="ob-feed-banner-h">Bienvenue</p>
              <p className="ob-feed-banner-p">Salut {userName}, voici ton feed perso adapté à {userAis} et {domainInfo.label}.</p>
            </div>
            <div className="ob-feed-filterbar">
              {/* Rangée rapide : domaine + IA de l'utilisateur (logos) + bouton de dépliage */}
              <div className="ob-feed-filters">
                <button type="button"
                  className={`ob-feed-chip${feedFilters.has(domainInfo.label) ? ' is-on' : ''}`}
                  onClick={() => toggleFeedFilter(domainInfo.label)}>{domainInfo.label}</button>
                {userAiChips.map(feedAiChip)}
                <button type="button"
                  className={`ob-feed-chip ob-feed-chip--more${showFilters ? ' is-on' : ''}`}
                  onClick={() => setShowFilters(s => !s)}>{showFilters ? '− Moins' : '+ Filtres'}</button>
              </div>
              {/* Panneau déplié (choix des IA + attributs). Monté en permanence : on ne
                  bascule que is-open → la hauteur s'anime (grid-template-rows 0fr↔1fr),
                  donc ouverture ET fermeture fluides, et la grille en dessous glisse en
                  douceur. inert quand fermé : pas de tabulation dans les chips masqués. */}
              <div className={`ob-feed-collapse${showFilters ? ' is-open' : ''}`} inert={!showFilters}>
                <div className="ob-feed-collapse-inner">
                  <div className="ob-feed-filter-panel">
                    {otherAis.length > 0 && (
                      <div className="ob-feed-filter-group">
                        <p className="ob-feed-filter-label">{userAiChips.length ? 'Autres IA' : 'IA'}</p>
                        <div className="ob-feed-filter-row">{otherAis.map(feedAiChip)}</div>
                      </div>
                    )}
                    <div className="ob-feed-filter-group">
                      <p className="ob-feed-filter-label">Filtres</p>
                      <div className="ob-feed-filter-row">
                        {FEED_EXTRA_FILTERS.map(f => (
                          <button key={f} type="button"
                            className={`ob-feed-chip${feedFilters.has(f) ? ' is-on' : ''}`}
                            onClick={() => toggleFeedFilter(f)}>{f}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div ref={feedCardsRef} className="ob-feed-grid">
            {visibleSkills.map(skill => {
              const istate = feedInstalls[skill.name]
              const verified = skill.attrs.includes('Vérifié')
              return (
                <article key={skill.name} className={`ob-feed-card${istate === 'installed' ? ' is-owned' : ''}`}>
                  {/* Miniature : dégradé océan (tonalité), glyphe au trait du Skill + catégorie */}
                  <div className="ob-feed-thumb" aria-hidden="true">
                    <span className="ob-feed-thumb-ic"><SkillIcon kind={skill.icon} /></span>
                    <span className="ob-feed-thumb-cat">{CAT_LABEL[skill.domain]}</span>
                  </div>
                  <div className="ob-feed-card-body">
                    <h3 className="ob-feed-card-name">
                      {skill.name}
                      {verified && (
                        <span className="ob-feed-verified" title="Skill vérifié" aria-label="Skill vérifié">
                          <IconVerified />
                        </span>
                      )}
                    </h3>
                    <p className="ob-feed-card-meta">★ {skill.rating} · {skill.installs}</p>
                    {/* IA compatibles : rend le filtre par IA tangible directement sur la carte */}
                    <div className="ob-feed-card-ais" aria-label={`Compatible ${skill.ais.join(', ')}`}>
                      {skill.ais.slice(0, 3).map(a => (
                        <img key={a} className="ob-feed-ai" src={`/assets/ai-logos/${AI_LOGO[a]}.svg`} alt="" title={a} />
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`ob-feed-install${istate ? ` is-${istate}` : ''}`}
                    onClick={() => installSkill(skill.name)}
                    disabled={istate === 'installing'}
                    aria-busy={istate === 'installing'}
                    aria-label={
                      istate === 'installed' ? `${skill.name} installé`
                        : istate === 'installing' ? `Installation de ${skill.name} en cours`
                          : `Installer ${skill.name}`
                    }
                  >
                    <span key={istate ?? 'idle'} className={`ob-feed-install-label${istate === 'installing' ? ' is-anim' : ''}`}>
                      {istate === 'installed'
                        ? <><span className="ob-feed-install-ic"><IconInstallCheck /></span>Installé</>
                        : istate === 'installing'
                          ? <span className="ob-feed-install-ic"><IconInstallSpinner /></span>
                          : '+ Installer'}
                    </span>
                  </button>
                </article>
              )
            })}
            {visibleSkills.length === 0 && (
              <p className="ob-feed-empty">
                Aucun Skill ne correspond à ces filtres. Retire-en un pour voir plus de résultats.
              </p>
            )}
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
          {step !== 'login' && (
            <button className="ob-btn" onClick={goNext} disabled={navDisabled}>{navLabel}</button>
          )}
        </div>
      )}
    </div>
  )
}

/* Curseur de souris factice qui pilote les démos des cartes « Pourquoi Frank ? ».
   Flèche blanche cernée de sombre → lisible sur le fond océan. Pointe en haut-gauche
   (origine ~0,0) : on l'aligne sur le point visé, le scale du clic pivote depuis la pointe. */
function CursorArrow() {
  return (
    <svg className="wd-cursor-svg" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path d="M3 2.5l0 16.2 4.1-3.9 2.5 5.4 2.7-1.2-2.4-5.2 5.6 0z"
        fill="#f6f6ff" stroke="rgba(11,9,27,0.65)" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  )
}

/* Scène « Installation en 1 clic » : un curseur factice glisse jusqu'au bouton,
   clique, et le bouton enchaîne idle → installation (spinner) → installé (coche
   tracée + fond violet). Tout est piloté en GSAP (pas les classes d'état one-shot
   du feed) pour que la boucle se rejoue proprement. Renvoie son nettoyage. */
function setupInstallDemo(stage: HTMLElement): (() => void) | void {
  const host = (stage.closest('.ob-why-card') as HTMLElement) ?? stage
  const q = <T extends Element>(sel: string) => stage.querySelector(sel) as T
  const cursor = q<HTMLElement>('.wd-cursor')
  const btn = q<HTMLElement>('.wd-install')
  const idle = q<HTMLElement>('.wd-lbl-idle')
  const load = q<HTMLElement>('.wd-lbl-load')
  const done = q<HTMLElement>('.wd-lbl-done')
  const ring = q<SVGElement>('.ob-check-ring')
  const mark = q<SVGElement>('.ob-check-mark')

  const reset = () => {
    gsap.killTweensOf([cursor, btn, idle, load, done])
    btn.classList.remove('wd-done')
    gsap.set(cursor, { opacity: 0, scale: 1, left: '84%', top: '92%' })
    gsap.set(btn, { scale: 1 })
    gsap.set(idle, { autoAlpha: 1 })
    gsap.set([load, done], { autoAlpha: 0 })
    gsap.set([ring, mark], { strokeDashoffset: 100 })
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    reset()
    btn.classList.add('wd-done')
    gsap.set(idle, { autoAlpha: 0 })
    gsap.set(done, { autoAlpha: 1 })
    gsap.set([ring, mark], { strokeDashoffset: 0 })
    return
  }

  let tl: gsap.core.Timeline | null = null
  const build = () => {
    const s = stage.getBoundingClientRect()
    const b = btn.getBoundingClientRect()
    const start = { x: s.width * 0.84, y: s.height * 0.92 }
    const target = { x: b.left + b.width / 2 - s.left, y: b.top + b.height * 0.5 - s.top }
    reset()
    gsap.set(cursor, { left: start.x, top: start.y })
    tl = gsap.timeline({ repeat: -1, repeatDelay: 0.55, defaults: { ease: 'power2.inOut' } })
    tl.to(cursor, { opacity: 1, duration: 0.22 })
      .to(cursor, { left: target.x, top: target.y, duration: 0.72 })
      // clic : enfoncement curseur + bouton
      .to(cursor, { scale: 0.82, duration: 0.1 })
      .to(btn, { scale: 0.95, duration: 0.1 }, '<')
      .to(cursor, { scale: 1, duration: 0.16 })
      .to(btn, { scale: 1, duration: 0.16 }, '<')
      // idle → installation (spinner) ; le curseur repart
      .to(idle, { autoAlpha: 0, duration: 0.16 })
      .to(load, { autoAlpha: 1, duration: 0.16 }, '<')
      .to(cursor, { left: start.x, top: start.y, opacity: 0, duration: 0.7, ease: 'power2.out' }, '<0.05')
      .to({}, { duration: 0.85 })
      // installation → installé (coche tracée + fond violet)
      .to(load, { autoAlpha: 0, duration: 0.16 })
      .add(() => btn.classList.add('wd-done'))
      .to(done, { autoAlpha: 1, duration: 0.2 }, '<')
      .fromTo(ring, { strokeDashoffset: 100 }, { strokeDashoffset: 0, duration: 0.34, ease: 'power1.inOut' }, '<')
      .fromTo(mark, { strokeDashoffset: 100 }, { strokeDashoffset: 0, duration: 0.26, ease: 'power1.inOut' }, '<0.28')
      .to({}, { duration: 1.05 })
      // retour à l'état de départ pour la boucle suivante
      .add(() => btn.classList.remove('wd-done'))
      .to(done, { autoAlpha: 0, duration: 0.2 })
      .to(idle, { autoAlpha: 1, duration: 0.2 }, '<')
  }

  const enter = () => { build(); tl?.play(0) }
  const leave = () => { tl?.kill(); tl = null; reset() }
  host.addEventListener('mouseenter', enter)
  host.addEventListener('mouseleave', leave)
  reset()
  return () => {
    host.removeEventListener('mouseenter', enter)
    host.removeEventListener('mouseleave', leave)
    tl?.kill()
    gsap.killTweensOf([cursor, btn, idle, load, done])
  }
}

/* Scène « Skills vérifiés » : la double vérification se joue (Niveau 1 puis
   Niveau 2 : chaque coche se trace), puis le sceau « Vérifié » surgit près du nom
   avec un effet de pop et un halo qui irradie → la certification est mise en valeur.
   Aucun curseur : c'est Frank qui vérifie, pas un geste de l'utilisateur. */
function setupVerifDemo(stage: HTMLElement): (() => void) | void {
  const host = (stage.closest('.ob-why-card') as HTMLElement) ?? stage
  const seal = stage.querySelector('.wd-seal') as HTMLElement
  const halo = stage.querySelector('.wd-seal-halo') as HTMLElement
  const levels = Array.from(stage.querySelectorAll<HTMLElement>('.wd-level'))
  const rings = levels.map(l => l.querySelector('.ob-check-ring') as SVGElement)
  const marks = levels.map(l => l.querySelector('.ob-check-mark') as SVGElement)
  const draws = [...rings, ...marks]

  const reset = () => {
    gsap.killTweensOf([seal, halo, ...levels])
    gsap.set(levels, { opacity: 0.32 })
    gsap.set(seal, { autoAlpha: 0, scale: 0 })
    gsap.set(halo, { autoAlpha: 0, scale: 0.4 })
    gsap.set(draws, { strokeDashoffset: 100 })
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    reset()
    gsap.set(levels, { opacity: 1 })
    gsap.set(seal, { autoAlpha: 1, scale: 1 })
    gsap.set(draws, { strokeDashoffset: 0 })
    return
  }

  let tl: gsap.core.Timeline | null = null
  const build = () => {
    reset()
    tl = gsap.timeline({ repeat: -1, repeatDelay: 0.7, defaults: { ease: 'power2.out' } })
    tl.set(levels, { opacity: 0.32 })
      .set(seal, { autoAlpha: 0, scale: 0 })
      .set(halo, { autoAlpha: 0, scale: 0.4 })
      .set(draws, { strokeDashoffset: 100 })
    levels.forEach((lvl, i) => {
      tl!.to(lvl, { opacity: 1, duration: 0.24 }, i === 0 ? '>' : '>0.12')
        .fromTo(rings[i], { strokeDashoffset: 100 }, { strokeDashoffset: 0, duration: 0.32, ease: 'power1.inOut' }, '<0.04')
        .fromTo(marks[i], { strokeDashoffset: 100 }, { strokeDashoffset: 0, duration: 0.26, ease: 'power1.inOut' }, '<0.2')
    })
    // la certification surgit et rayonne → mise en valeur
    tl.to(seal, { autoAlpha: 1, scale: 1, duration: 0.55, ease: 'back.out(2.2)' }, '>0.12')
      .fromTo(halo, { scale: 0.4, autoAlpha: 0.85 }, { scale: 2.6, autoAlpha: 0, duration: 0.85, ease: 'power2.out' }, '<')
      .to({}, { duration: 1.1 })
      // retour pour la boucle suivante
      .to(seal, { autoAlpha: 0, scale: 0.55, duration: 0.35 })
      .to(levels, { opacity: 0.32, duration: 0.35 }, '<')
  }

  const enter = () => { build(); tl?.play(0) }
  const leave = () => { tl?.kill(); tl = null; reset() }
  host.addEventListener('mouseenter', enter)
  host.addEventListener('mouseleave', leave)
  reset()
  return () => {
    host.removeEventListener('mouseenter', enter)
    host.removeEventListener('mouseleave', leave)
    tl?.kill()
    gsap.killTweensOf([seal, halo, ...levels])
  }
}

/* Scène « Feed personnalisé » : le curseur clique un chip de domaine (« Dev »),
   le chip s'active et la grille de tuiles se recompose en cascade — les Skills
   génériques sortent, ceux du domaine entrent → le feed s'adapte « à ton domaine ».
   Deux couches d'icônes par tuile (a = générique, b = domaine) dont GSAP croise
   l'opacité/scale ; pas de changement de DOM, la boucle se rejoue proprement. */
function setupFeedDemo(stage: HTMLElement): (() => void) | void {
  const host = (stage.closest('.ob-why-card') as HTMLElement) ?? stage
  const cursor = stage.querySelector('.wd-cursor') as HTMLElement
  const chips = Array.from(stage.querySelectorAll<HTMLElement>('.wd-chip'))
  const tilesA = Array.from(stage.querySelectorAll<HTMLElement>('.wd-tile-a'))
  const tilesB = Array.from(stage.querySelectorAll<HTMLElement>('.wd-tile-b'))
  const chip = chips[0] // « Dev »

  const reset = () => {
    gsap.killTweensOf([cursor, ...tilesA, ...tilesB])
    chips.forEach(c => c.classList.remove('wd-chip-on'))
    gsap.set(cursor, { opacity: 0, scale: 1, left: '86%', top: '88%' })
    gsap.set(tilesA, { autoAlpha: 1, scale: 1 })
    gsap.set(tilesB, { autoAlpha: 0, scale: 0.6 })
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    reset()
    chip.classList.add('wd-chip-on')
    gsap.set(tilesA, { autoAlpha: 0 })
    gsap.set(tilesB, { autoAlpha: 1, scale: 1 })
    return
  }

  let tl: gsap.core.Timeline | null = null
  const build = () => {
    const s = stage.getBoundingClientRect()
    const c = chip.getBoundingClientRect()
    const start = { x: s.width * 0.86, y: s.height * 0.88 }
    const target = { x: c.left + c.width / 2 - s.left, y: c.top + c.height * 0.5 - s.top }
    reset()
    gsap.set(cursor, { left: start.x, top: start.y })
    tl = gsap.timeline({ repeat: -1, repeatDelay: 0.6, defaults: { ease: 'power2.inOut' } })
    tl.to(cursor, { opacity: 1, duration: 0.22 })
      .to(cursor, { left: target.x, top: target.y, duration: 0.7 })
      // clic : enfoncement + activation du chip
      .to(cursor, { scale: 0.82, duration: 0.1 })
      .add(() => chip.classList.add('wd-chip-on'))
      .to(cursor, { scale: 1, duration: 0.16 })
      // le feed se recompose : générique sort, domaine entre (cascade)
      .to(tilesA, { autoAlpha: 0, scale: 0.6, duration: 0.3, stagger: 0.06 }, '>')
      .fromTo(tilesB, { autoAlpha: 0, scale: 0.6 },
        { autoAlpha: 1, scale: 1, duration: 0.34, stagger: 0.07, ease: 'back.out(1.6)' }, '<0.12')
      .to(cursor, { left: start.x, top: start.y, opacity: 0, duration: 0.7, ease: 'power2.out' }, '<0.05')
      .to({}, { duration: 1.0 })
      // retour à l'état de départ pour la boucle suivante
      .add(() => chip.classList.remove('wd-chip-on'))
      .to(tilesB, { autoAlpha: 0, scale: 0.6, duration: 0.28, stagger: 0.05 })
      .to(tilesA, { autoAlpha: 1, scale: 1, duration: 0.3, stagger: 0.05 }, '<0.1')
  }

  const enter = () => { build(); tl?.play(0) }
  const leave = () => { tl?.kill(); tl = null; reset() }
  host.addEventListener('mouseenter', enter)
  host.addEventListener('mouseleave', leave)
  reset()
  return () => {
    host.removeEventListener('mouseenter', enter)
    host.removeEventListener('mouseleave', leave)
    tl?.kill()
    gsap.killTweensOf([cursor, ...tilesA, ...tilesB])
  }
}

/* Démos animées des cartes « Pourquoi Frank ? » (remplacent les rectangles vides).
   Chaque scène rejoue le geste/évènement clé de sa fonctionnalité, en boucle TANT QUE
   la carte est survolée (mouseenter → play, mouseleave → reset). */
function WhyDemo({ demoKey }: { demoKey: string }) {
  const stageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    if (demoKey === 'install') return setupInstallDemo(stage)
    if (demoKey === 'verif') return setupVerifDemo(stage)
    if (demoKey === 'feed') return setupFeedDemo(stage)
  }, [demoKey])

  if (demoKey === 'install') {
    return (
      <div className="wd-stage wd-stage--install" ref={stageRef} aria-hidden="true">
        <div className="wd-card">
          <div className="wd-thumb"><span className="wd-thumb-ic"><SkillIcon kind="refresh" /></span></div>
          <p className="wd-name">Refacto TypeScript</p>
          <p className="wd-meta">★ 4.8 · 12k installs</p>
          <div className="wd-install">
            <span className="wd-lbl wd-lbl-idle">+ Installer</span>
            <span className="wd-lbl wd-lbl-load"><span className="wd-lbl-ic"><IconInstallSpinner /></span></span>
            <span className="wd-lbl wd-lbl-done"><span className="wd-lbl-ic"><IconInstallCheck /></span>Installé</span>
          </div>
        </div>
        <span className="wd-cursor"><CursorArrow /></span>
      </div>
    )
  }

  if (demoKey === 'verif') {
    return (
      <div className="wd-stage wd-stage--verif" ref={stageRef} aria-hidden="true">
        <div className="wd-card wd-card--verif">
          <div className="wd-vrow">
            <span className="wd-thumb-ic wd-vic"><SkillIcon kind="shield" /></span>
            <p className="wd-name wd-name--verif">
              Design system
              <span className="wd-seal-wrap">
                <span className="wd-seal-halo" />
                <span className="wd-seal"><IconVerified /></span>
              </span>
            </p>
          </div>
          <div className="wd-levels">
            <span className="wd-level"><span className="wd-level-ic"><IconInstallCheck /></span>Niveau 1 · Code vérifié</span>
            <span className="wd-level"><span className="wd-level-ic"><IconInstallCheck /></span>Niveau 2 · Sûreté validée</span>
          </div>
        </div>
      </div>
    )
  }

  if (demoKey === 'feed') {
    return (
      <div className="wd-stage wd-stage--feed" ref={stageRef} aria-hidden="true">
        <div className="wd-feed">
          <div className="wd-chips">
            <span className="wd-chip">Dev</span>
            <span className="wd-chip">UX</span>
            <span className="wd-chip">Marketing</span>
          </div>
          <div className="wd-grid">
            <div className="wd-tile">
              <span className="wd-tile-ic wd-tile-a"><SkillIcon kind="palette" /></span>
              <span className="wd-tile-ic wd-tile-b"><SkillIcon kind="refresh" /></span>
            </div>
            <div className="wd-tile">
              <span className="wd-tile-ic wd-tile-a"><SkillIcon kind="megaphone" /></span>
              <span className="wd-tile-ic wd-tile-b"><SkillIcon kind="bug" /></span>
            </div>
            <div className="wd-tile">
              <span className="wd-tile-ic wd-tile-a"><SkillIcon kind="calculator" /></span>
              <span className="wd-tile-ic wd-tile-b"><SkillIcon kind="branch" /></span>
            </div>
          </div>
        </div>
        <span className="wd-cursor"><CursorArrow /></span>
      </div>
    )
  }

  return null
}

/* Pictos des cartes « Pourquoi Frank ? » — repris tels quels du proto Figma
   (node 1329:2255 et 1329:2289, opération « Subtract ») : un disque plein #EDEDED
   dont le symbole est découpé en négatif (fill-rule evenodd) → il laisse voir la
   carte glass au travers, exactement comme la maquette. Même recette que IconVerified.
   IconFeedTarget : la cible/viseur de « Feed personnalisé ». Le contour extérieur du
   disque (cercle) remplace le rect+clip de l'export Figma pour rester self-contained. */
function IconFeedTarget() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        fill="#EDEDED"
        d="M16 0C24.8366 0 32 7.16344 32 16C32 24.8366 24.8366 32 16 32C7.16344 32 0 24.8366 0 16C0 7.16344 7.16344 0 16 0ZM16 4C15.4479 4.00018 15 4.44782 15 5V8.06348C11.3817 8.51491 8.51683 11.3817 8.06543 15H5.00098C4.44872 15 4.00102 15.4478 4.00098 16C4.00098 16.5523 4.44869 17 5.00098 17H8.06543C8.5168 20.6183 11.3817 23.4841 15 23.9355V27C15 27.5521 15.4479 27.9998 16 28C16.5523 28 17 27.5522 17 27V23.9355C20.6186 23.4843 23.4842 20.6186 23.9355 17H27.001C27.5531 16.9998 28.0009 16.5521 28.001 16C28.001 15.4478 27.5531 15.0002 27.001 15H23.9355C23.4841 11.3814 20.6187 8.51466 17 8.06348V5C17 4.44772 16.5523 4 16 4ZM17 10.8232C19.1972 11.1616 20.9512 12.8414 21.4004 15H21.001C20.4487 15 20.001 15.4477 20.001 16C20.0011 16.5522 20.4487 17 21.001 17H21.4336C21.0475 19.2457 19.2585 21.0105 17 21.3584V21C17 20.4477 16.5523 20 16 20C15.4479 20.0002 15 20.4478 15 21V21.2881C12.9153 20.8158 11.2956 19.1235 10.9307 17H11.001C11.5531 16.9998 12.001 16.5522 12.001 16C12.0009 15.4479 11.5531 15.0002 11.001 15H10.9639C11.3877 12.9621 12.9751 11.3521 15 10.8936V11C15 11.5521 15.4479 11.9998 16 12C16.5523 12 17 11.5522 17 11V10.8232ZM16 14C14.8956 14.0002 14 14.8956 14 16C14 17.1045 14.8956 17.9998 16 18C17.1046 18 18 17.1046 18 16C18 14.8954 17.1046 14 16 14Z"
      />
    </svg>
  )
}

/* IconInstallPlus : le « + » de « Installation en 1 clic » (node 1329:2289). */
function IconInstallPlus() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        fill="#EDEDED"
        d="M16 0C24.8366 0 32 7.16344 32 16C32 24.8366 24.8366 32 16 32C7.16344 32 0 24.8366 0 16C0 7.16344 7.16344 0 16 0ZM16 8C15.4477 8 15 8.44771 15 9V15H9C8.44771 15 8 15.4477 8 16C8 16.5523 8.44771 17 9 17H15V23C15 23.5523 15.4477 24 16 24C16.5523 24 17 23.5523 17 23V17H23C23.5523 17 24 16.5523 24 16C24 15.4477 23.5523 15 23 15H17V9C17 8.44772 16.5523 8 16 8Z"
      />
    </svg>
  )
}

/* Badge « Skill vérifié » — vecteur repris tel quel du proto Figma (node 1329:2299,
   opération « Subtract ») : un sceau festonné dont la coche est découpée en négatif
   (fill-rule evenodd) → elle laisse voir la carte au travers, exactement comme dans
   la maquette. Couleur #EDEDED (le blanc cassé du texte des cartes). */
function IconVerified() {
  return (
    <svg className="ob-verified-svg" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M13.2816 0.968596C14.8642 -0.322865 17.1365 -0.322865 18.7191 0.968596C19.6135 1.69843 20.7641 2.03797 21.9115 1.91098C23.9346 1.68684 25.8449 2.93187 26.4789 4.86606C26.8392 5.96575 27.6271 6.88735 28.6615 7.4061C30.4866 8.32118 31.4233 10.4017 30.9173 12.3797C30.6299 13.5032 30.8002 14.707 31.391 15.7049C32.4344 17.4673 32.1145 19.7242 30.6175 21.1219C29.7705 21.9127 29.272 23.0204 29.2338 24.1786C29.1664 26.2144 27.685 27.9498 25.68 28.3094C24.5424 28.5134 23.5298 29.1706 22.8763 30.1239C21.7243 31.8044 19.5428 32.4542 17.6644 31.6649C16.6006 31.2178 15.4011 31.2179 14.3373 31.6649C12.4588 32.4543 10.2765 31.8045 9.12438 30.1239C8.47091 29.1706 7.45828 28.5134 6.32067 28.3094C4.3158 27.9497 2.83429 26.2144 2.76696 24.1786C2.72868 23.0204 2.23019 21.9127 1.38317 21.1219C-0.113675 19.7242 -0.433586 17.4672 0.609731 15.7049C1.20055 14.707 1.3708 13.5033 1.08336 12.3797C0.577464 10.4017 1.5141 8.32117 3.33922 7.4061C4.37373 6.88736 5.16151 5.96581 5.52184 4.86606C6.15574 2.93183 8.06612 1.68684 10.0892 1.91098C11.2366 2.03804 12.3872 1.6984 13.2816 0.968596ZM21.973 11.2342C21.4571 10.8407 20.7193 10.9401 20.3256 11.4559L14.7748 18.7264L12.8363 16.5565C12.4039 16.0726 11.6602 16.0304 11.1761 16.4627C10.6926 16.8949 10.6507 17.6379 11.0824 18.1219L13.2709 20.5721C14.125 21.5278 15.6385 21.4688 16.4164 20.45L22.1937 12.8817C22.5875 12.3658 22.4889 11.628 21.973 11.2342Z"
      />
    </svg>
  )
}

/* Loader d'installation : anneau qui tourne (pathLength=100 → arc en %),
   trait lumineux violet, écho aux bulles de Frank. Rotation portée par le CSS. */
function IconInstallSpinner() {
  return (
    <svg className="ob-feed-install-spinsvg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="ob-spin-track" cx="12" cy="12" r="8.5" pathLength={100} />
      <circle className="ob-spin-arc" cx="12" cy="12" r="8.5" pathLength={100} />
    </svg>
  )
}

/* Validation : le cercle puis la coche se DESSINENT (stroke-dashoffset animé via
   CSS, déclenché par .is-installed). pathLength=100 → tracé indépendant de la géométrie. */
function IconInstallCheck() {
  return (
    <svg className="ob-feed-install-checksvg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle className="ob-check-ring" cx="12" cy="12" r="8.5" pathLength={100} />
      <path className="ob-check-mark" d="M8 12.4l2.6 2.6 5.4-5.8" pathLength={100} />
    </svg>
  )
}

/* Icônes de la sidebar du feed — vrais vecteurs exportés du Figma (node 1585:2425) :
   maison, loupe, document, engrenage. Coordonnées dans le repère de la tuile 48×48
   du proto (d'où le viewBox décalé). Blanches par défaut (fill = currentColor) ; le
   fill bascule sur le dégradé violet d'origine #feed-ic-grad quand l'item est actif. */
function IconHome() {
  return (
    <svg viewBox="0 0 48 48" fill="currentColor">
      {/* Cheminée */}
      <rect x="30.082" y="12.3563" width="2.76754" height="5.53508" rx="1.38377" />
      {/* Corps + porte */}
      <path d="M22.8949 14.3625L13.6322 23.0622C13.303 23.3715 13.1162 23.8031 13.1162 24.2548V34.2443C13.1162 35.1479 13.8488 35.8805 14.7524 35.8805H19.0607C19.9643 35.8805 20.6969 35.1479 20.6969 34.2443V28.5522C20.6969 27.6486 21.4294 26.9161 22.333 26.9161H25.6897C26.589 26.9161 27.3198 27.6419 27.3258 28.5413L27.3641 34.2553C27.3702 35.1546 28.1009 35.8805 29.0003 35.8805H33.4399C34.3435 35.8805 35.076 35.1479 35.076 34.2443V24.2628C35.076 23.8064 34.8854 23.3708 34.5502 23.0611L25.1254 14.3533C24.4947 13.7706 23.5208 13.7746 22.8949 14.3625Z" />
      {/* Toit (un masque dans le Figma → ici un simple trait) */}
      <path className="ob-navicon-line" fill="none" stroke="currentColor" strokeWidth="1.92524" strokeLinecap="round" strokeLinejoin="round" d="M10.709 22.7647L22.4542 11.8699C23.3296 11.0579 24.6824 11.0562 25.5597 11.8661L37.3014 22.7046" />
    </svg>
  )
}
/* Explorer : au repos une loupe simple ; au survol elle se métamorphose en
   loupe « pieuvre » à la Frank (cercle festonné + spirale + ventouses, Figma
   node 976:639). Les deux états sont superposés et fondus en CSS (.ob-search-*). */
function IconSearch() {
  return (
    <span className="ob-search-morph">
      <svg className="ob-search-plain" viewBox="4.152 3.672 48 48" fill="currentColor">
        <path fillRule="evenodd" clipRule="evenodd" d="M16.1068 23.4921C16.789 17.937 21.8447 13.9869 27.3998 14.6689C32.9549 15.351 36.905 20.4067 36.2231 25.9618C35.9455 28.2225 34.9431 30.2171 33.4779 31.7421L40.0219 40.4062C40.6075 41.1815 40.4534 42.2854 39.6781 42.871C38.9029 43.4563 37.7998 43.3023 37.2143 42.5273L30.6508 33.8359C30.6464 33.8301 30.6424 33.8241 30.6381 33.8183C28.9285 34.6614 26.9634 35.0347 24.9301 34.7851C19.3749 34.103 15.4248 29.0473 16.1068 23.4921ZM27.059 17.454C23.0424 16.961 19.3874 19.8174 18.894 23.8339C18.4009 27.8505 21.2563 31.5065 25.2729 31.9999C29.2896 32.4931 32.9465 29.6368 33.4398 25.62C33.9328 21.6033 31.0757 17.9472 27.059 17.454Z" />
      </svg>
      <svg className="ob-search-octo" viewBox="34.6 30.6 400 400" fill="currentColor">
        <path d="M142.48 145.308C134.363 156.47 133.068 167.935 124.309 161.311C116.87 155.704 126.134 139.262 129.8 134.857C133.286 130.686 142.667 118.815 151.04 122.679C162.786 128.078 150.117 134.866 142.499 145.347L142.48 145.308Z" />
        <path d="M200.85 114.199C187.057 114.669 177.222 120.703 177.054 109.722C176.897 100.408 195.558 97.5937 201.285 97.7731C206.718 97.9543 221.848 98.0446 223.954 107.023C226.926 119.603 213.78 113.794 200.83 114.239L200.85 114.199Z" />
        <path d="M128.199 204.475C130.428 218.094 137.67 227.077 126.801 228.648C117.584 229.994 112.406 211.847 111.852 206.143C111.337 200.732 109.492 185.714 118.127 182.478C130.224 177.921 126.143 191.702 128.24 204.489L128.199 204.475Z" />
        <path d="M153.246 257.952C163.184 267.528 174.362 270.39 166.595 278.153C160.017 284.749 145.007 273.31 141.149 269.073C137.497 265.046 127.031 254.12 132.011 246.359C138.975 235.468 143.954 248.951 153.288 257.938L153.246 257.952Z" />
        <path d="M146.854 135.749C166.841 115.241 189.188 109.693 207.613 110.602C216.802 111.055 225.013 113.114 231.478 115.71C237.87 118.277 242.777 121.461 245.15 124.323H245.149C245.326 124.535 245.489 124.712 245.654 124.871L245.821 125.027L245.849 125.05L245.876 125.075C249.297 128.312 252.246 134.429 252.805 141.016C253.372 147.693 251.497 155.109 244.909 160.653L244.91 160.654C244.492 161.012 244.047 161.313 243.637 161.56L243.636 161.559C243.045 161.934 242.396 162.301 241.706 162.6C237.885 164.271 232.515 165.128 227.51 164.248C222.455 163.359 217.519 160.629 215.213 154.91V154.909C213.152 149.788 214.171 145.471 216.514 142.635C217.655 141.254 219.092 140.249 220.575 139.696C222.031 139.154 223.696 138.992 225.185 139.571C225.352 139.636 225.504 139.722 225.64 139.82C226.676 140.375 227.419 141.332 227.653 142.452C227.927 143.766 227.464 145.172 226.257 146.073L226.253 146.075C225.668 146.511 225.396 146.835 225.25 147.109C225.114 147.362 225.005 147.727 225.023 148.386C225.027 148.534 225.264 149.179 226.39 149.733C227.417 150.238 228.676 150.374 229.725 149.986C230.547 149.677 231.247 149.057 231.703 148.253C232.909 146.08 233.541 139.575 224.262 133.068C224.26 133.066 224.257 133.064 224.252 133.061C224.241 133.055 224.227 133.048 224.212 133.041C214.482 128.142 202.788 128.962 191.987 132.888C181.187 136.813 171.627 143.725 166.334 150.473L166.277 150.544L166.214 150.611C166.193 150.633 166.171 150.656 166.15 150.679C166.149 150.68 166.146 150.681 166.145 150.683C145.292 176.954 146.466 209.4 161.174 233.455L161.885 234.595L161.886 234.596C172.697 251.602 190.81 261.639 210.155 262.602L211.848 262.671C247.174 263.806 268.128 244.834 276.646 221.985C285.382 198.549 280.981 171.298 265.735 157.062L265.709 157.038L265.686 157.014C263.367 154.694 262.045 151.773 261.718 148.555C261.198 143.421 260.682 140.439 260.018 138.057C259.353 135.67 258.526 133.833 257.262 130.889V130.888C257.132 130.584 256.888 129.806 257.37 128.986C257.831 128.202 258.59 128.027 258.836 127.984C259.352 127.893 259.842 128.002 260.018 128.041C260.528 128.154 261.156 128.372 261.709 128.583C262.67 128.949 263.813 129.45 264.404 129.76L264.621 129.88L264.627 129.884C286.95 143.253 297.703 161.283 301.352 179.333C304.987 197.312 301.556 215.194 295.743 228.407L295.744 228.408C295.161 229.735 295.708 228.484 293.955 232.346L293.956 232.347C287.72 246.151 278.512 257.516 267.4 266.05L321.532 337.721C326.411 344.182 325.129 353.375 318.668 358.255C312.208 363.135 303.014 361.853 298.134 355.392L243.435 282.97C242.656 281.938 242.034 280.836 241.565 279.694C217.296 287.682 189.151 285.256 163.663 269.991H163.662C163.647 269.983 163.627 269.972 163.607 269.96C163.55 269.927 163.431 269.853 163.293 269.739C118.006 237.196 112.409 172.245 146.832 135.773L146.843 135.761L146.854 135.749Z" />
      </svg>
    </span>
  )
}
function IconDoc() {
  return (
    <svg viewBox="4.152 3.672 48 48" fill="currentColor">
      {/* Feuilles du dessous : décalées au repos, elles glissent pour s'aligner
         sur la feuille avant au survol (cf. CSS .ob-doc-back1 / .ob-doc-back2). */}
      <g className="ob-doc-back2">
        <path d="M21.3115 15.072V36.552C21.3115 37.0822 21.7413 37.512 22.2715 37.512H37.8715C38.4017 37.512 38.8315 37.0822 38.8315 36.552V15.072C38.8315 14.5418 38.4017 14.112 37.8715 14.112H22.2715C21.7413 14.112 21.3115 14.5418 21.3115 15.072Z" />
      </g>
      <g className="ob-doc-back1">
        <path d="M19.3906 16.992V38.472C19.3906 39.0022 19.8204 39.432 20.3506 39.432H35.9506C36.4808 39.432 36.9106 39.0022 36.9106 38.472V16.992C36.9106 16.4618 36.4808 16.032 35.9506 16.032H20.3506C19.8204 16.032 19.3906 16.4618 19.3906 16.992Z" />
        <path fill="none" stroke="#18143C" strokeWidth="1.2" d="M35.9492 15.4325C36.8108 15.4325 37.5097 16.1306 37.5098 16.9921V38.4726C37.5095 39.3339 36.8106 40.0321 35.9492 40.0321H20.3496C19.4882 40.0321 18.7903 39.3339 18.79 38.4726V16.9921C18.7901 16.1306 19.4881 15.4325 20.3496 15.4325H35.9492Z" />
      </g>
      {/* Feuille avant (fixe) : trait, corps, coin plié */}
      <path fill="none" stroke="#18143C" strokeWidth="1.2" strokeLinejoin="round" d="M28.4717 17.3525C28.8853 17.3525 29.2827 17.5161 29.5752 17.8086L35.1328 23.3672C35.4252 23.6597 35.5898 24.0561 35.5898 24.4697V40.332C35.5898 41.1936 34.8909 41.8925 34.0293 41.8925H18.4297C17.5681 41.8925 16.8701 41.1936 16.8701 40.332V18.9121C16.8701 18.0505 17.5682 17.3525 18.4297 17.3525H28.4717Z" />
      <path fillRule="evenodd" clipRule="evenodd" d="M18.4317 17.9519C17.9015 17.9519 17.4717 18.3817 17.4717 18.9119V40.3319C17.4717 40.8621 17.9015 41.2919 18.4317 41.2919H34.0317C34.5619 41.2919 34.9917 40.8621 34.9917 40.3319V24.0719H29.8317C29.3015 24.0719 28.8717 23.6421 28.8717 23.1119V17.9519H18.4317Z" />
      <path fillOpacity="0.5" d="M34.9917 24.0719H29.8317C29.3015 24.0719 28.8717 23.6421 28.8717 23.1119V17.9519L34.9917 24.0719Z" />
    </svg>
  )
}
function IconGear() {
  return (
    <svg viewBox="4.152 3.672 48 48" fill="currentColor">
      <path className="ob-gear-spin" fillRule="evenodd" clipRule="evenodd" d="M21.9218 15.7423C23.3045 14.944 25.0729 15.4172 25.8713 16.7999C26.0082 17.0369 26.2798 17.1598 26.5508 17.1214C26.6978 17.1005 26.8453 17.0827 26.9925 17.0682C27.3478 17.0329 27.6538 16.7913 27.7467 16.4467C28.16 14.9044 29.7455 13.9891 31.2878 14.4023L32.3056 14.675C33.8479 15.0882 34.7633 16.6738 34.3501 18.2161L34.3018 18.3961C34.2129 18.7279 34.3421 19.0779 34.6119 19.2906C34.6294 19.3044 34.6477 19.3181 34.6651 19.3321C34.9417 19.5528 35.3255 19.5957 35.632 19.4188L35.8341 19.3021C37.2169 18.5038 38.9858 18.9778 39.7841 20.3605L40.311 21.2731C41.1091 22.6558 40.6348 24.424 39.2521 25.2222L38.9705 25.3848C38.6701 25.5584 38.5149 25.902 38.5588 26.2461C38.5652 26.2958 38.5709 26.3462 38.5766 26.396C38.6164 26.7464 38.8571 27.0465 39.1978 27.1379L39.5553 27.2337C41.0976 27.6469 42.013 29.2325 41.5997 30.7748L41.327 31.7926C40.9135 33.3346 39.3281 34.2502 37.7859 33.837L37.3732 33.7257C37.0366 33.6356 36.6817 33.7706 36.4693 34.0469C36.4666 34.0504 36.4635 34.0539 36.4608 34.0575C36.2487 34.3326 36.2112 34.7092 36.3849 35.0101L36.6525 35.4736C37.4505 36.8563 36.9763 38.6245 35.5936 39.4227L34.6811 39.9496C33.2985 40.7476 31.53 40.2744 30.7316 38.892L30.5036 38.4971C30.3268 38.1913 29.9743 38.036 29.625 38.0887C29.6079 38.0912 29.5905 38.0945 29.5734 38.097C29.2332 38.1467 28.9456 38.3849 28.8568 38.7171L28.7692 39.0439C28.3558 40.5859 26.7703 41.5015 25.2282 41.0884L24.2103 40.8156C22.6682 40.4024 21.7529 38.8167 22.1659 37.2746L22.2049 37.1292C22.2969 36.7839 22.1522 36.4215 21.862 36.213C21.7786 36.1531 21.6956 36.0917 21.6138 36.0293C21.338 35.8188 20.9626 35.7817 20.6621 35.9552L20.5784 36.0035C19.1958 36.8015 17.4273 36.3284 16.6289 34.9459L16.1021 34.0334C15.3038 32.6507 15.7779 30.8818 17.1605 30.0834C17.4668 29.9065 17.6262 29.5503 17.5721 29.2007C17.5583 29.1117 17.5461 29.0217 17.5346 28.9326C17.4931 28.612 17.2702 28.3399 16.958 28.2562C15.4162 27.8429 14.5012 26.2579 14.9141 24.716L15.1868 23.6982C15.6001 22.1559 17.1856 21.2405 18.7279 21.6537C19.0112 21.7296 19.3099 21.614 19.4826 21.377C19.6128 21.1981 19.7496 21.0223 19.8916 20.851C20.0398 20.6721 20.0664 20.4196 19.9503 20.2184C19.1521 18.8357 19.6267 17.0676 21.0092 16.2692L21.9218 15.7423ZM26.0601 24.1581C24.1528 25.2594 23.4986 27.6981 24.5998 29.6054C25.7009 31.5125 28.1401 32.1654 30.0474 31.0643C31.9546 29.9631 32.6079 27.5248 31.5068 25.6176C30.4057 23.7103 27.9674 23.057 26.0601 24.1581Z" />
    </svg>
  )
}
function IconPen() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  )
}
function IconClose() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}
/* Œil (mot de passe visible) et œil barré (masqué) — trait currentColor comme IconPen/IconClose. */
function IconEye() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}
function IconEyeOff() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.6 6.2A9.6 9.6 0 0 1 12 6c6.5 0 10 7 10 7a17.3 17.3 0 0 1-3.6 4.3M6.4 7.4A17.4 17.4 0 0 0 2 13s3.5 7 10 7a9.5 9.5 0 0 0 4-.9" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="M3 3l18 18" />
    </svg>
  )
}
/* Connecteurs (Figma node 975:679) : 2×2 modules — 3 carrés pleins + un module
   « + » à coin plié en haut-droite. Repère du proto à grande échelle (viewBox 400).
   Traits de séparation et « + » sombres (#18143C), comme le document. Le module
   « + » est isolé dans un groupe : il se détache au survol (cf. CSS .ob-connect-plug). */
function IconConnect() {
  return (
    <svg viewBox="34.6 30.6 400 400" fill="currentColor">
      <rect x="134.6" y="130.6" width="100" height="100" rx="8" />
      <rect x="134.6" y="230.6" width="100" height="100" rx="8" />
      <rect x="234.6" y="230.6" width="100" height="100" rx="8" />
      <rect fill="none" stroke="#18143C" strokeWidth="8" x="135.6" y="130.6" width="100" height="100" rx="8" />
      <rect fill="none" stroke="#18143C" strokeWidth="8" x="135.6" y="230.6" width="100" height="100" rx="8" />
      <rect fill="none" stroke="#18143C" strokeWidth="8" x="235.6" y="230.6" width="100" height="100" rx="8" />
      <g className="ob-connect-plug">
        <path d="M234.6 138.6C234.6 134.182 238.182 130.6 242.6 130.6H311.6V145.6C311.6 150.018 315.182 153.6 319.6 153.6H334.6V222.6C334.6 227.018 331.018 230.6 326.6 230.6H242.6C238.182 230.6 234.6 227.018 234.6 222.6V138.6Z" />
        <path fillOpacity="0.5" d="M319.6 153.6C315.182 153.6 311.6 150.018 311.6 145.6V130.6L334.6 153.6H319.6Z" />
        <path fill="none" stroke="#18143C" strokeWidth="8" strokeLinejoin="round" d="M335.6 153.6L312.6 130.6H243.6C239.182 130.6 235.6 134.182 235.6 138.6V222.6C235.6 227.018 239.182 230.6 243.6 230.6H327.6C332.018 230.6 335.6 227.018 335.6 222.6V153.6ZM312.6 130.6V145.6C312.6 150.018 316.182 153.6 320.6 153.6H335.6" />
        <path fill="none" stroke="#18143C" strokeWidth="13" strokeLinecap="round" d="M286.097 205.6V156.6" />
        <path fill="none" stroke="#18143C" strokeWidth="13" strokeLinecap="round" d="M310.6 181.103L261.6 181.103" />
      </g>
    </svg>
  )
}
function FeedNavIcon({ kind }: { kind: string }) {
  switch (kind) {
    case 'home': return <IconHome />
    case 'search': return <IconSearch />
    case 'doc': return <IconDoc />
    case 'connect': return <IconConnect />
    case 'gear': return <IconGear />
    default: return null
  }
}

/* Glyphes des miniatures de Skills — vecteurs au trait dans le même esprit que les
   icônes « Pourquoi Frank ? ». Les attributs de tracé (stroke courant, épaisseur,
   bouts arrondis) sont posés sur le <svg> et hérités par les formes ; la couleur
   (sombre) vient du conteneur .ob-feed-thumb-ic. Clé inconnue → repli sur 'code'. */
function SkillIcon({ kind }: { kind: string }) {
  const dot = { fill: 'currentColor', stroke: 'none' } as const
  const G: Record<string, React.JSX.Element> = {
    code: <><polyline points="9 8 4 12 9 16" /><polyline points="15 8 20 12 15 16" /></>,
    bug: <><ellipse cx="12" cy="13" rx="5" ry="6" /><line x1="12" y1="8" x2="12" y2="19" /><path d="M9 5l1.6 2.4M15 5l-1.6 2.4" /><path d="M3.5 11l3 1M20.5 11l-3 1M3.5 16.5l3-1M20.5 16.5l-3-1" /></>,
    test: <><path d="M9 3h6" /><path d="M10.5 3v5L5.7 16.4a2 2 0 0 0 1.8 3h9a2 2 0 0 0 1.8-3L13.5 8V3" /><line x1="8" y1="15" x2="16" y2="15" /></>,
    doc: <><path d="M14 3.5v4a1 1 0 0 0 1 1h4" /><path d="M18 8.5V19a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7Z" /><line x1="9" y1="12.5" x2="15" y2="12.5" /><line x1="9" y1="16" x2="13" y2="16" /></>,
    eye: <><path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.6" /></>,
    wand: <><line x1="6" y1="18" x2="14.5" y2="9.5" /><path d="M17 4l.7 1.9L19.6 6.6l-1.9.7L17 9.2l-.7-1.9L14.4 6.6l1.9-.7Z" /><path d="M6 5l.5 1.3L7.8 6.8l-1.3.5L6 8.6l-.5-1.3L4.2 6.8l1.3-.5Z" /></>,
    refresh: <><path d="M5 11a7 7 0 0 1 11.9-4.3L19 9" /><polyline points="19 4 19 9 14 9" /><path d="M19 13a7 7 0 0 1-11.9 4.3L5 15" /><polyline points="5 20 5 15 10 15" /></>,
    database: <><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" /><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></>,
    branch: <><circle cx="7" cy="6" r="2" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="9" r="2" /><path d="M7 8v8" /><path d="M17 11a6 6 0 0 1-6 6H9" /></>,
    palette: <><path d="M12 3a9 9 0 1 0 0 18c1.3 0 1.9-1 1.9-2 0-1.3 1-2 2.2-2H18a3 3 0 0 0 3-3c0-5-4-8-9-8Z" /><circle cx="8" cy="11.5" r="1.1" {...dot} /><circle cx="12" cy="8.5" r="1.1" {...dot} /><circle cx="16" cy="11.5" r="1.1" {...dot} /></>,
    sparkles: <><path d="M12 4l1.7 4.3L18 10l-4.3 1.7L12 16l-1.7-4.3L6 10l4.3-1.7Z" /><path d="M18 15l.6 1.7L20.3 17.4l-1.7.6L18 19.7l-.6-1.7L15.7 17.4l1.7-.6Z" /></>,
    scissors: <><circle cx="6" cy="7" r="2.2" /><circle cx="6" cy="17" r="2.2" /><line x1="8" y1="8.2" x2="20" y2="16" /><line x1="8" y1="15.8" x2="20" y2="8" /></>,
    expand: <><polyline points="4 9 4 4 9 4" /><polyline points="20 9 20 4 15 4" /><polyline points="4 15 4 20 9 20" /><polyline points="20 15 20 20 15 20" /></>,
    image: <><rect x="4" y="5" width="16" height="14" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="M5 17l4.5-4.5 3 3L16 11l3 3" /></>,
    layers: <><path d="M12 3l8 4-8 4-8-4 8-4Z" /><path d="M4 12l8 4 8-4" /><path d="M4 16.5l8 4 8-4" /></>,
    grid: <><rect x="4" y="4" width="7" height="7" rx="1.3" /><rect x="13" y="4" width="7" height="7" rx="1.3" /><rect x="4" y="13" width="7" height="7" rx="1.3" /><rect x="13" y="13" width="7" height="7" rx="1.3" /></>,
    play: <><circle cx="12" cy="12" r="8.5" /><path d="M10 8.5l5 3.5-5 3.5Z" {...dot} /></>,
    shield: <><path d="M12 3l7 2.5v5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5v-5L12 3Z" /><path d="M9 12l2 2 4-4" /></>,
    frame: <><rect x="4" y="4" width="16" height="16" rx="2" /><line x1="4" y1="9" x2="20" y2="9" /><line x1="9.5" y1="9" x2="9.5" y2="20" /></>,
    text: <><path d="M6.5 7h11" /><path d="M12 7v11" /><path d="M9.5 18h5" /></>,
    chart: <><path d="M4 4v16h16" /><polyline points="7 15 11 10 14 13 19 6" /></>,
    flow: <><rect x="3" y="9" width="5" height="6" rx="1.2" /><rect x="16" y="4" width="5" height="5" rx="1.2" /><rect x="16" y="15" width="5" height="5" rx="1.2" /><path d="M8 12h4M12 12V6.5h4M12 12v5.5h4" /></>,
    calendar: <><rect x="4" y="5" width="16" height="15" rx="2" /><line x1="4" y1="9.5" x2="20" y2="9.5" /><line x1="8" y1="3" x2="8" y2="6.5" /><line x1="16" y1="3" x2="16" y2="6.5" /><circle cx="9" cy="14" r="1" {...dot} /><circle cx="13" cy="14" r="1" {...dot} /></>,
    megaphone: <><path d="M4 10v4a1 1 0 0 0 1 1h2l3.5 4V6L7 9H5a1 1 0 0 0-1 1Z" /><path d="M14 8.5a4 4 0 0 1 0 7" /><path d="M16.5 6a7 7 0 0 1 0 12" /></>,
    search: <><circle cx="11" cy="11" r="6" /><line x1="15.5" y1="15.5" x2="20" y2="20" /></>,
    mail: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M4 7.5l8 6 8-6" /></>,
    hashtag: <><line x1="9.5" y1="4" x2="7.5" y2="20" /><line x1="17" y1="4" x2="15" y2="20" /><line x1="4" y1="9" x2="20" y2="9" /><line x1="3.5" y1="15" x2="19.5" y2="15" /></>,
    split: <><rect x="4" y="5" width="7" height="14" rx="1.5" /><rect x="13" y="5" width="7" height="14" rx="1.5" /></>,
    tag: <><path d="M4 12.5V5.5a1 1 0 0 1 1-1h7a1 1 0 0 1 .7.3l6.5 6.5a1 1 0 0 1 0 1.4l-7 7a1 1 0 0 1-1.4 0L4.3 13.2A1 1 0 0 1 4 12.5Z" /><circle cx="8.5" cy="8.5" r="1.3" /></>,
    calculator: <><rect x="5" y="3" width="14" height="18" rx="2" /><rect x="8" y="6" width="8" height="3" rx="0.6" /><circle cx="9" cy="13" r="1" {...dot} /><circle cx="12" cy="13" r="1" {...dot} /><circle cx="15" cy="13" r="1" {...dot} /><circle cx="9" cy="17" r="1" {...dot} /><circle cx="12" cy="17" r="1" {...dot} /><circle cx="15" cy="17" r="1" {...dot} /></>,
    receipt: <><path d="M6 3h12v18l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3L6 21V3Z" /><line x1="9" y1="8.5" x2="15" y2="8.5" /><line x1="9" y1="12.5" x2="15" y2="12.5" /></>,
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {G[kind] ?? G.code}
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
