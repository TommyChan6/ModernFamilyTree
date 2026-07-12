// Mock data + generated cover art for the landing page's community gallery.
//
// Real community projects (browse / like / comment / follow) arrive with the
// hosted backend — until then the gallery renders these stand-ins. Covers are
// not image assets: each card gets a tiny seeded constellation painted onto a
// canvas, so every "project" ships with unique art at zero bytes of assets.

export interface MockProject {
  id: string
  title: string
  author: string
  blurb: string
  category: 'fictional' | 'historical' | 'personal'
  people: number
  generations: number
  likes: number
  comments: number
  stars: number
  followers: number
  updated: string
  badge?: 'Trending' | 'Staff pick' | 'New'
  hue: number // base hue for the generated cover
  seed: number // rng seed for the constellation layout
}

export const MOCK_PROJECTS: MockProject[] = [
  {
    id: 'atreides',
    title: 'House Atreides',
    author: 'spice_must_flow',
    blurb: 'From Duke Leto to Leto II — every bloodline on Arrakis, mapped.',
    category: 'fictional',
    people: 214,
    generations: 9,
    likes: 1284,
    comments: 96,
    stars: 402,
    followers: 318,
    updated: '2h ago',
    badge: 'Trending',
    hue: 28,
    seed: 11
  },
  {
    id: 'medici',
    title: 'The Medici Dynasty',
    author: 'florence1469',
    blurb: 'Bankers, popes and patrons — Renaissance Florence in one graph.',
    category: 'historical',
    people: 167,
    generations: 12,
    likes: 942,
    comments: 71,
    stars: 355,
    followers: 244,
    updated: '5h ago',
    badge: 'Staff pick',
    hue: 260,
    seed: 22
  },
  {
    id: 'vestlandet',
    title: 'Slekta mi — Vestlandet',
    author: 'fjordroots',
    blurb: 'Four farms, seven generations, and one very stubborn great-aunt.',
    category: 'personal',
    people: 89,
    generations: 7,
    likes: 316,
    comments: 42,
    stars: 121,
    followers: 87,
    updated: '1d ago',
    hue: 200,
    seed: 33
  },
  {
    id: 'westeros',
    title: 'Westeros: The Great Houses',
    author: 'maesterwolf',
    blurb: 'Stark, Targaryen, Lannister — alliances, betrayals and all.',
    category: 'fictional',
    people: 483,
    generations: 14,
    likes: 2371,
    comments: 188,
    stars: 764,
    followers: 592,
    updated: '38m ago',
    badge: 'Trending',
    hue: 215,
    seed: 44
  },
  {
    id: 'bronte',
    title: 'The Brontë Circle',
    author: 'moorland_ink',
    blurb: 'Haworth parsonage and everyone who ever walked through it.',
    category: 'historical',
    people: 54,
    generations: 5,
    likes: 428,
    comments: 39,
    stars: 173,
    followers: 118,
    updated: '3d ago',
    hue: 330,
    seed: 55
  },
  {
    id: 'kattegat',
    title: 'Kattegat Bloodlines',
    author: 'shieldmaiden_ok',
    blurb: 'Ragnar’s sons and the sagas between them, raid by raid.',
    category: 'fictional',
    people: 132,
    generations: 6,
    likes: 771,
    comments: 64,
    stars: 236,
    followers: 190,
    updated: '9h ago',
    hue: 185,
    seed: 66
  },
  {
    id: 'village',
    title: "My Grandmother's Village",
    author: 'elena.papadaki',
    blurb: 'Every family on one Cretan hillside, back to 1840.',
    category: 'personal',
    people: 241,
    generations: 8,
    likes: 655,
    comments: 87,
    stars: 214,
    followers: 156,
    updated: '6h ago',
    badge: 'Staff pick',
    hue: 45,
    seed: 77
  },
  {
    id: 'bridgerton',
    title: 'The Bridgerton Set',
    author: 'ladywhistledown',
    blurb: 'Eight siblings, one queen, and the entire ton — dearest reader.',
    category: 'fictional',
    people: 97,
    generations: 4,
    likes: 1093,
    comments: 154,
    stars: 388,
    followers: 402,
    updated: '4h ago',
    hue: 300,
    seed: 88
  },
  {
    id: 'romanov',
    title: 'Romanovs: The Last Tsars',
    author: 'winterpalace',
    blurb: 'Three centuries of the imperial line, ending in Ekaterinburg.',
    category: 'historical',
    people: 203,
    generations: 13,
    likes: 866,
    comments: 92,
    stars: 301,
    followers: 233,
    updated: '2d ago',
    hue: 355,
    seed: 99
  },
  {
    id: 'corleone',
    title: 'La Famiglia Corleone',
    author: 'never_against',
    blurb: 'Business, never personal — from Sicily to Lake Tahoe.',
    category: 'fictional',
    people: 61,
    generations: 4,
    likes: 733,
    comments: 58,
    stars: 245,
    followers: 177,
    updated: '12h ago',
    hue: 15,
    seed: 111
  },
  {
    id: 'curie',
    title: 'The Curie Legacy',
    author: 'polonium.girl',
    blurb: 'Five Nobel prizes in one family tree. No pressure, kids.',
    category: 'historical',
    people: 43,
    generations: 5,
    likes: 512,
    comments: 44,
    stars: 198,
    followers: 141,
    updated: '1d ago',
    badge: 'New',
    hue: 150,
    seed: 123
  },
  {
    id: 'durin',
    title: 'Middle-earth: Line of Durin',
    author: 'khazad.doom',
    blurb: 'Seven fathers of the dwarves and every beard in between.',
    category: 'fictional',
    people: 156,
    generations: 11,
    likes: 689,
    comments: 51,
    stars: 227,
    followers: 164,
    updated: '7h ago',
    badge: 'New',
    hue: 95,
    seed: 135
  }
]

// Deterministic rng so a given project always paints the same cover.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Paint a project's cover: a deep-space gradient in the project's hue with a
 * small seeded constellation-tree glowing over it. Covers are deliberately
 * dark in both themes — they read as artwork, like photos would.
 */
export function drawProjectCover(canvas: HTMLCanvasElement, project: MockProject): void {
  const rect = canvas.getBoundingClientRect()
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const w = Math.max(120, rect.width || 320)
  const h = Math.max(80, rect.height || 170)
  canvas.width = Math.round(w * dpr)
  canvas.height = Math.round(h * dpr)
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  const rnd = mulberry32(project.seed)
  const hue = project.hue

  // Nebula backdrop: diagonal gradient + two soft glow pools.
  const grad = ctx.createLinearGradient(0, 0, w, h)
  grad.addColorStop(0, `hsl(${hue} 52% 11%)`)
  grad.addColorStop(0.55, `hsl(${(hue + 30) % 360} 48% 17%)`)
  grad.addColorStop(1, `hsl(${(hue + 70) % 360} 45% 12%)`)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)

  for (let i = 0; i < 2; i++) {
    const gx = w * (0.2 + rnd() * 0.6)
    const gy = h * (0.2 + rnd() * 0.6)
    const gr = Math.max(w, h) * (0.35 + rnd() * 0.3)
    const pool = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr)
    pool.addColorStop(0, `hsla(${(hue + 40 + i * 60) % 360} 70% 55% / 0.16)`)
    pool.addColorStop(1, 'transparent')
    ctx.fillStyle = pool
    ctx.fillRect(0, 0, w, h)
  }

  // Dust specks.
  for (let i = 0; i < 42; i++) {
    ctx.globalAlpha = 0.12 + rnd() * 0.3
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(rnd() * w, rnd() * h, rnd() * 1.1 + 0.3, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  // Tiny dynasty: 3 generation bands, parents linked down to children.
  interface Pt {
    x: number
    y: number
    r: number
  }
  const gens: Pt[][] = []
  const genCounts = [
    2 + Math.floor(rnd() * 2),
    3 + Math.floor(rnd() * 3),
    4 + Math.floor(rnd() * 4)
  ]
  genCounts.forEach((count, g) => {
    const row: Pt[] = []
    for (let i = 0; i < count; i++) {
      row.push({
        x: w * ((i + 0.5 + (rnd() - 0.5) * 0.5) / count),
        y: h * (0.2 + g * 0.28 + (rnd() - 0.5) * 0.1),
        r: 2.6 - g * 0.5 + rnd() * 1.2
      })
    }
    gens.push(row)
  })

  ctx.lineCap = 'round'
  for (let g = 0; g < gens.length - 1; g++) {
    for (const child of gens[g + 1]) {
      const parent = gens[g][Math.floor(rnd() * gens[g].length)]
      const grad2 = ctx.createLinearGradient(parent.x, parent.y, child.x, child.y)
      grad2.addColorStop(0, `hsla(${hue} 80% 75% / 0.5)`)
      grad2.addColorStop(1, `hsla(${(hue + 60) % 360} 80% 75% / 0.18)`)
      ctx.strokeStyle = grad2
      ctx.lineWidth = 0.9
      ctx.beginPath()
      ctx.moveTo(parent.x, parent.y)
      ctx.quadraticCurveTo(
        (parent.x + child.x) / 2,
        parent.y + (child.y - parent.y) * 0.2,
        child.x,
        child.y
      )
      ctx.stroke()
    }
  }

  for (const row of gens) {
    for (const p of row) {
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 6)
      glow.addColorStop(0, `hsla(${hue} 90% 78% / 0.75)`)
      glow.addColorStop(1, 'transparent')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r * 6, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.95)'
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Bottom vignette so card overlays stay legible.
  const vin = ctx.createLinearGradient(0, h * 0.55, 0, h)
  vin.addColorStop(0, 'transparent')
  vin.addColorStop(1, 'rgba(4,6,12,0.55)')
  ctx.fillStyle = vin
  ctx.fillRect(0, 0, w, h)
}
