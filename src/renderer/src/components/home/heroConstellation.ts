// Living "family constellation" that powers the landing-page hero.
//
// Pure canvas-2D — at this scale (~35 people + ~140 dust stars) it outruns a
// WebGL setup and costs nothing to tear down. The engine procedurally grows a
// small dynasty: a founding couple fades in as stars, marriage and child links
// draw themselves generation by generation, and late-generation births keep
// rippling in while the visitor reads. Pointer movement parallaxes the star
// layers and spotlights the people near the cursor.
//
// Follows the app's renderer rules: draw-only module (no Vue/store imports),
// palette pulled live from the CSS design tokens so both themes work, and the
// rAF loop stops entirely when the canvas is offscreen, the tab is hidden, or
// the caller pauses it.

const TAU = Math.PI * 2

type RGB = [number, number, number]

interface Palette {
  accent: RGB
  pink: RGB
  green: RGB
  amber: RGB
  t1: RGB
  t2: RGB
  bg: RGB
  font: string
}

interface PersonNode {
  u: number // unit-space anchor (0..1 across the canvas)
  v: number
  r: number // core radius in CSS px
  gen: number
  name: string
  year: number
  colorIdx: number // index into the palette color cycle
  born: number // reveal time in seconds since start
  phase: number // drift params — every star wanders on its own orbit
  speed: number
  amp: number
  label: number // current label opacity (eased toward labelTarget)
  labelUntil: number // show the name tag until this timestamp
  glowBoost: number // pointer-proximity glow (eased)
}

interface Link {
  a: number // parent / first partner
  a2: number // second partner for child links (-1 when unknown)
  b: number // child / second partner
  kind: 'union' | 'child'
  born: number
}

interface DustStar {
  u: number
  v: number
  r: number
  layer: number // 0 far … 2 near (parallax depth)
  tw: number // twinkle phase
}

interface Pulse {
  link: number
  t0: number
}

interface Ripple {
  node: number
  t0: number
}

interface Meteor {
  x: number // unit-space start
  y: number
  dx: number // unit-space direction (already scaled per second)
  dy: number
  t0: number
  life: number
}

// Click fireworks: the visitor can tap the sky to burst a handful of sparks
// (ballistic, faded by age) and leave a permanent little star behind.
interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  t0: number
  life: number
  colorIdx: number
  r: number
}

interface BurstRing {
  x: number
  y: number
  t0: number
}

export interface HeroConstellationHandle {
  /** Re-read the CSS design tokens (call when the theme changes). */
  refreshPalette(): void
  /** Externally pause/resume (e.g. while the auth gate covers the page). */
  setPaused(paused: boolean): void
  destroy(): void
}

const NAME_POOL = [
  'Elena',
  'Marcus',
  'Ingrid',
  'Theo',
  'Amara',
  'Jonas',
  'Freya',
  'Ravi',
  'Sofia',
  'Emil',
  'Yuki',
  'Oskar',
  'Leah',
  'Mateo',
  'Astrid',
  'Noor',
  'Felix',
  'Iris',
  'Kai',
  'Nora',
  'Levi',
  'Maren',
  'Arlo',
  'Selma',
  'Hugo',
  'June',
  'Milo',
  'Vera',
  'Anton',
  'Cleo',
  'Sander',
  'Alma',
  'Otis',
  'Live',
  'Isak',
  'Edda'
]

function hexToRgb(value: string): RGB | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(value.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgba(c: RGB, a: number): string {
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`
}

function readPalette(): Palette {
  const s = getComputedStyle(document.documentElement)
  const pick = (name: string, fallback: RGB): RGB => hexToRgb(s.getPropertyValue(name)) ?? fallback
  return {
    accent: pick('--accent', [108, 142, 245]),
    pink: pick('--pink', [240, 98, 146]),
    green: pick('--green', [76, 175, 114]),
    amber: pick('--amber', [245, 166, 35]),
    t1: pick('--t1', [232, 234, 246]),
    t2: pick('--t2', [158, 163, 184]),
    bg: pick('--bg', [15, 17, 23]),
    font: s.getPropertyValue('--font') || 'sans-serif'
  }
}

// Soft radial sprite used for every glow — pre-rendered once per color so the
// hot loop is only drawImage calls.
function makeGlowSprite(c: RGB): HTMLCanvasElement {
  const size = 64
  const cv = document.createElement('canvas')
  cv.width = size
  cv.height = size
  const ctx = cv.getContext('2d')
  if (ctx) {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    g.addColorStop(0, rgba(c, 0.8))
    g.addColorStop(0.32, rgba(c, 0.26))
    g.addColorStop(1, rgba(c, 0))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
  }
  return cv
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

// ── Procedural dynasty ───────────────────────────────────────────────────────

interface Slot {
  person: number
  spouse: number | null
  kids: Slot[]
}

function buildDynasty(): { nodes: PersonNode[]; links: Link[] } {
  const nodes: PersonNode[] = []
  const links: Link[] = []
  const names = [...NAME_POOL].sort(() => Math.random() - 0.5)
  let nameIdx = 0

  function makePerson(gen: number): number {
    const roll = Math.random()
    nodes.push({
      u: 0.5,
      v: 0.5,
      r: gen === 0 ? 4.4 : 2.6 + Math.random() * 1.5,
      gen,
      name: names[nameIdx++ % names.length],
      year: 1902 + gen * 27 + Math.round((Math.random() - 0.5) * 10),
      colorIdx: roll < 0.62 ? 0 : roll < 0.76 ? 1 : roll < 0.9 ? 2 : 3,
      born: 0,
      phase: Math.random() * TAU,
      speed: 0.25 + Math.random() * 0.35,
      amp: 0.0035 + Math.random() * 0.003,
      label: 0,
      labelUntil: 0,
      glowBoost: 0
    })
    return nodes.length - 1
  }

  // Grow the family unit tree. Kid counts taper with depth and the whole
  // dynasty is soft-capped so the sky never gets crowded.
  function grow(gen: number): Slot {
    const slot: Slot = { person: makePerson(gen), spouse: null, kids: [] }
    const crowded = nodes.length > 34
    const marries = gen === 0 || (gen < 3 && !crowded && Math.random() < 0.62)
    if (marries) {
      slot.spouse = makePerson(gen)
      const nKids =
        gen === 0
          ? 3
          : gen === 1
            ? 2 + Math.floor(Math.random() * 2)
            : 1 + Math.floor(Math.random() * 2)
      for (let k = 0; k < nKids && nodes.length < 40; k++) slot.kids.push(grow(gen + 1))
    }
    return slot
  }

  const root = grow(0)

  // Tidy layout in unit space: each subtree gets a horizontal slice sized by
  // its leaf count; generations sit in soft bands from top to bottom.
  function leaves(s: Slot): number {
    return s.kids.length ? s.kids.reduce((n, k) => n + leaves(k), 0) : 1
  }

  function place(s: Slot, x0: number, x1: number): void {
    const gen = nodes[s.person].gen
    const y = 0.15 + gen * 0.215 + (Math.random() - 0.5) * 0.028
    const xc = (x0 + x1) / 2
    if (s.spouse != null) {
      const gap = 0.024
      nodes[s.person].u = xc - gap
      nodes[s.person].v = y
      nodes[s.spouse].u = xc + gap
      nodes[s.spouse].v = y + (Math.random() - 0.5) * 0.012
      links.push({ a: s.person, a2: -1, b: s.spouse, kind: 'union', born: 0 })
    } else {
      nodes[s.person].u = xc + (Math.random() - 0.5) * 0.014
      nodes[s.person].v = y
    }
    const total = leaves(s)
    let acc = x0
    for (const kid of s.kids) {
      const w = ((x1 - x0) * leaves(kid)) / total
      place(kid, acc, acc + w)
      links.push({ a: s.person, a2: s.spouse ?? -1, b: kid.person, kind: 'child', born: 0 })
      acc += w
    }
  }

  place(root, 0.07, 0.93)

  // Reveal schedule: the first two generations assemble during the intro,
  // then later births keep arriving one by one for close to a minute so the
  // constellation stays alive while the visitor reads the page.
  const byGen: number[][] = [[], [], [], [], []]
  nodes.forEach((n, i) => byGen[Math.min(n.gen, 4)].push(i))
  const startFor = (gen: number): number => [0.5, 1.9, 4.6, 9.5, 16][Math.min(gen, 4)]
  const stepFor = (gen: number): number => [0.4, 0.55, 1.15, 2.4, 3.2][Math.min(gen, 4)]
  byGen.forEach((ids, gen) => {
    ids.forEach((id, i) => {
      nodes[id].born = startFor(gen) + i * stepFor(gen) + Math.random() * 0.3
    })
  })
  for (const link of links) {
    if (link.kind === 'union') {
      link.born = Math.max(nodes[link.a].born, nodes[link.b].born) + 0.35
    } else {
      // Child links draw first and "deliver" the newborn star at their tip.
      link.born = Math.max(0.9, nodes[link.b].born - 0.7)
    }
  }

  return { nodes, links }
}

// ── Engine ───────────────────────────────────────────────────────────────────

export function createHeroConstellation(canvas: HTMLCanvasElement): HeroConstellationHandle {
  const ctx = canvas.getContext('2d')
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  let palette = readPalette()
  let colorCycle: RGB[] = []
  let sprites: HTMLCanvasElement[] = []
  function rebuildSprites(): void {
    colorCycle = [palette.accent, palette.pink, palette.green, palette.amber]
    sprites = colorCycle.map(makeGlowSprite)
  }
  rebuildSprites()

  const { nodes, links } = buildDynasty()

  const dust: DustStar[] = Array.from({ length: 140 }, () => ({
    u: Math.random(),
    v: Math.random(),
    r: 0.5 + Math.random() * 1.1,
    layer: Math.floor(Math.random() * 3),
    tw: Math.random() * TAU
  }))

  const pulses: Pulse[] = []
  const ripples: Ripple[] = []
  const meteors: Meteor[] = []
  const sparks: Spark[] = []
  const burstRings: BurstRing[] = []

  let w = 0
  let h = 0
  let dpr = 1
  let t = 0
  let prevT = 0
  let lastNow = 0
  let raf = 0
  let running = false
  let visible = true
  let paused = false
  let nextPulseAt = 2.5
  let nextLabelAt = 3
  let nextMeteorAt = 5 + Math.random() * 6

  // Pointer in [-1, 1] around the canvas center, smoothed for parallax.
  let px = 0
  let py = 0
  let pxTarget = 0
  let pyTarget = 0
  let pointerX = -1e5 // CSS-px position for proximity checks
  let pointerY = -1e5

  function resize(): void {
    const rect = canvas.getBoundingClientRect()
    w = Math.max(1, rect.width)
    h = Math.max(1, rect.height)
    dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    if (reducedMotion) drawFrame()
  }

  function nodeXY(n: PersonNode, time: number): [number, number] {
    // Anchor + a slow personal orbit + a whisper of pointer parallax.
    const x =
      n.u * w + Math.sin(time * n.speed + n.phase) * n.amp * w - px * 9 * (0.6 + n.gen * 0.18)
    const y =
      n.v * h +
      Math.cos(time * n.speed * 0.8 + n.phase * 1.7) * n.amp * h * 0.9 -
      py * 7 * (0.6 + n.gen * 0.18)
    return [x, y]
  }

  // Child links fall from the parents' bond point and fan out to each kid;
  // union links arc gently between partners.
  function linkGeometry(
    link: Link,
    time: number
  ): [number, number, number, number, number, number] {
    const pb = nodeXY(nodes[link.b], time)
    let x1: number
    let y1: number
    if (link.kind === 'child' && link.a2 >= 0) {
      const pa = nodeXY(nodes[link.a], time)
      const ps = nodeXY(nodes[link.a2], time)
      x1 = (pa[0] + ps[0]) / 2
      y1 = (pa[1] + ps[1]) / 2
    } else {
      const pa = nodeXY(nodes[link.a], time)
      x1 = pa[0]
      y1 = pa[1]
    }
    let cx: number
    let cy: number
    if (link.kind === 'union') {
      cx = (x1 + pb[0]) / 2
      cy = Math.min(y1, pb[1]) - 14
    } else {
      cx = x1 + (pb[0] - x1) * 0.5
      cy = y1 + (pb[1] - y1) * 0.18
    }
    return [x1, y1, cx, cy, pb[0], pb[1]]
  }

  function quadPoint(
    g: [number, number, number, number, number, number],
    s: number
  ): [number, number] {
    const inv = 1 - s
    return [
      inv * inv * g[0] + 2 * inv * s * g[2] + s * s * g[4],
      inv * inv * g[1] + 2 * inv * s * g[3] + s * s * g[5]
    ]
  }

  function strokePartialQuad(
    c: CanvasRenderingContext2D,
    g: [number, number, number, number, number, number],
    progress: number
  ): void {
    const end = Math.max(2, Math.ceil(22 * progress))
    c.beginPath()
    c.moveTo(g[0], g[1])
    for (let i = 1; i <= end; i++) {
      const p = quadPoint(g, (i / end) * progress)
      c.lineTo(p[0], p[1])
    }
    c.stroke()
  }

  function drawFrame(): void {
    if (!ctx) return
    const time = reducedMotion ? 120 : t
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    // Dust starfield — three parallax depths, gentle twinkle.
    for (const star of dust) {
      const depth = 0.3 + star.layer * 0.35
      const x = star.u * w + px * (6 + star.layer * 12)
      const y = star.v * h + py * (4 + star.layer * 9)
      const twinkle = 0.55 + 0.45 * Math.sin(time * 0.9 + star.tw)
      const intro = smoothstep(0, 1.4, time - star.tw * 0.12)
      ctx.globalAlpha = (0.16 + star.layer * 0.11) * twinkle * intro
      ctx.fillStyle = rgba(palette.t2, 1)
      ctx.beginPath()
      ctx.arc(x, y, star.r * depth, 0, TAU)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    // Links — a wide soft pass then a bright core pass.
    for (const link of links) {
      const progress = (time - link.born) / 0.9
      if (progress <= 0) continue
      const geo = linkGeometry(link, time)
      const p = Math.min(1, progress)
      const color = link.kind === 'union' ? palette.pink : palette.accent
      const settle = smoothstep(0, 0.6, progress) // links land softly
      ctx.lineCap = 'round'
      ctx.strokeStyle = rgba(color, 0.1 * settle)
      ctx.lineWidth = 3.4
      strokePartialQuad(ctx, geo, p)
      ctx.strokeStyle = rgba(color, (link.kind === 'union' ? 0.5 : 0.34) * settle)
      ctx.lineWidth = 1.1
      strokePartialQuad(ctx, geo, p)
      // A tiny bond-star glows at the middle of every marriage.
      if (link.kind === 'union' && p >= 1) {
        const mid = quadPoint(geo, 0.5)
        const size = 9 + Math.sin(time * 2 + link.a) * 1.5
        ctx.drawImage(sprites[1], mid[0] - size / 2, mid[1] - size / 2, size, size)
      }
    }

    // Pulses — sparks of light travelling along revealed links.
    for (const pulse of pulses) {
      const s = (time - pulse.t0) / 1.6
      if (s < 0 || s > 1) continue
      const link = links[pulse.link]
      const geo = linkGeometry(link, time)
      const p = quadPoint(geo, s)
      const fade = Math.sin(s * Math.PI)
      const size = 14 * fade
      ctx.globalAlpha = fade
      ctx.drawImage(sprites[0], p[0] - size / 2, p[1] - size / 2, size, size)
      ctx.globalAlpha = 1
    }

    // Birth ripples — expanding rings around newborn stars.
    for (const ripple of ripples) {
      const s = (time - ripple.t0) / 1.3
      if (s < 0 || s > 1) continue
      const [x, y] = nodeXY(nodes[ripple.node], time)
      ctx.strokeStyle = rgba(palette.accent, 0.5 * (1 - s))
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.arc(x, y, 4 + s * 30, 0, TAU)
      ctx.stroke()
    }

    // People-stars with glow halos.
    for (const n of nodes) {
      const alpha = smoothstep(0, 0.8, time - n.born)
      if (alpha <= 0) continue
      const [x, y] = nodeXY(n, time)
      const twinkle = 1 + 0.22 * Math.sin(time * 1.6 + n.phase * 3)
      const glowSize = n.r * 9 * twinkle * (1 + n.glowBoost * 0.9)
      ctx.globalAlpha = alpha * (0.75 + n.glowBoost * 0.25)
      ctx.drawImage(sprites[n.colorIdx], x - glowSize / 2, y - glowSize / 2, glowSize, glowSize)
      ctx.globalAlpha = alpha
      ctx.fillStyle = rgba(palette.t1, 0.95)
      ctx.beginPath()
      ctx.arc(x, y, n.r * (1 + n.glowBoost * 0.25), 0, TAU)
      ctx.fill()
      ctx.globalAlpha = 1

      // Floating name tag (spotlight cycle or pointer proximity).
      if (n.label > 0.02) {
        const text = `${n.name} · b. ${n.year}`
        ctx.font = `500 11px ${palette.font}`
        const tw = ctx.measureText(text).width
        const bx = x + 10
        const by = y - 24
        ctx.globalAlpha = n.label * 0.82
        ctx.fillStyle = rgba(palette.bg, 0.72)
        ctx.beginPath()
        ctx.roundRect(bx - 7, by - 3, tw + 14, 20, 9)
        ctx.fill()
        ctx.strokeStyle = rgba(colorCycle[n.colorIdx], 0.45)
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.globalAlpha = n.label
        ctx.fillStyle = rgba(palette.t1, 0.92)
        ctx.fillText(text, bx, by + 11)
        ctx.globalAlpha = 1
      }
    }

    // Click fireworks — ballistic sparks plus an expanding ring.
    for (const s of sparks) {
      const age = time - s.t0
      const k = age / s.life
      if (k < 0 || k > 1) continue
      const fade = 1 - k
      const x = s.x + s.vx * age
      const y = s.y + s.vy * age + 60 * age * age
      const size = s.r * (0.7 + 0.6 * fade) * 2
      ctx.globalAlpha = fade
      ctx.drawImage(sprites[s.colorIdx], x - size / 2, y - size / 2, size, size)
    }
    ctx.globalAlpha = 1
    for (const ring of burstRings) {
      const k = (time - ring.t0) / 1.1
      if (k < 0 || k > 1) continue
      ctx.strokeStyle = rgba(palette.accent, 0.55 * (1 - k))
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.arc(ring.x, ring.y, 3 + k * 48, 0, TAU)
      ctx.stroke()
    }

    // Meteors — rare streaks across the far background.
    for (const m of meteors) {
      const s = (time - m.t0) / m.life
      if (s < 0 || s > 1) continue
      const fade = Math.sin(s * Math.PI)
      const x = (m.x + m.dx * s) * w
      const y = (m.y + m.dy * s) * h
      const tailX = x - m.dx * 0.09 * w
      const tailY = y - m.dy * 0.09 * h
      const grad = ctx.createLinearGradient(tailX, tailY, x, y)
      grad.addColorStop(0, rgba(palette.t2, 0))
      grad.addColorStop(1, rgba(palette.t1, 0.65 * fade))
      ctx.strokeStyle = grad
      ctx.lineWidth = 1.3
      ctx.beginPath()
      ctx.moveTo(tailX, tailY)
      ctx.lineTo(x, y)
      ctx.stroke()
    }
  }

  function step(dt: number): void {
    prevT = t
    t += dt

    // Births that happened this frame get a ripple + a celebratory pulse.
    for (let i = 0; i < nodes.length; i++) {
      const born = nodes[i].born
      if (born > prevT && born <= t) {
        ripples.push({ node: i, t0: t })
        const inbound = links.findIndex((l) => l.kind === 'child' && l.b === i)
        if (inbound >= 0) pulses.push({ link: inbound, t0: t })
      }
    }

    // Ambient pulses wander the revealed constellation.
    if (t >= nextPulseAt) {
      nextPulseAt = t + 0.9 + Math.random() * 1.2
      const ready = links.map((l, i) => i).filter((i) => t - links[i].born > 1.4)
      if (ready.length)
        pulses.push({ link: ready[Math.floor(Math.random() * ready.length)], t0: t })
      while (pulses.length > 14) pulses.shift()
      while (ripples.length > 10) ripples.shift()
    }

    // Spotlight cycle: someone's name tag fades up for a few seconds.
    if (t >= nextLabelAt) {
      nextLabelAt = t + 2.6 + Math.random() * 2
      const revealed = nodes.filter((n) => t - n.born > 1)
      if (revealed.length) {
        const n = revealed[Math.floor(Math.random() * revealed.length)]
        n.labelUntil = t + 3
      }
    }

    if (t >= nextMeteorAt) {
      nextMeteorAt = t + 7 + Math.random() * 8
      const down = Math.random() < 0.5 ? 1 : -1
      meteors.push({
        x: Math.random() * 0.7 + (down > 0 ? 0 : 0.3),
        y: Math.random() * 0.3,
        dx: 0.35 * down,
        dy: 0.22,
        t0: t,
        life: 1.1
      })
      while (meteors.length > 3) meteors.shift()
    }

    // Smooth the pointer and ease per-node label/glow states.
    px += (pxTarget - px) * Math.min(1, dt * 3.5)
    py += (pyTarget - py) * Math.min(1, dt * 3.5)
    for (const n of nodes) {
      const [x, y] = nodeXY(n, t)
      const near = t - n.born > 0.5 && Math.hypot(x - pointerX, y - pointerY) < 70
      const target = near || t < n.labelUntil ? 1 : 0
      n.label += (target - n.label) * Math.min(1, dt * 6)
      n.glowBoost += ((near ? 1 : 0) - n.glowBoost) * Math.min(1, dt * 8)
    }
  }

  function frame(now: number): void {
    raf = requestAnimationFrame(frame)
    const dt = Math.min(0.05, (now - lastNow) / 1000)
    lastNow = now
    step(dt)
    drawFrame()
  }

  function updateRunning(): void {
    const should = visible && !paused && !document.hidden && !reducedMotion
    if (should && !running) {
      running = true
      lastNow = performance.now()
      raf = requestAnimationFrame(frame)
    } else if (!should && running) {
      running = false
      cancelAnimationFrame(raf)
    }
  }

  function onPointerMove(e: MouseEvent): void {
    const rect = canvas.getBoundingClientRect()
    pointerX = e.clientX - rect.left
    pointerY = e.clientY - rect.top
    pxTarget = (pointerX / Math.max(1, rect.width)) * 2 - 1
    pyTarget = (pointerY / Math.max(1, rect.height)) * 2 - 1
  }

  function onPointerLeave(): void {
    pointerX = -1e5
    pointerY = -1e5
    pxTarget = 0
    pyTarget = 0
  }

  function spawnBurst(cx: number, cy: number): void {
    burstRings.push({ x: cx, y: cy, t0: t })
    const count = 14 + Math.floor(Math.random() * 6)
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * TAU
      const speed = 30 + Math.random() * 130
      sparks.push({
        x: cx,
        y: cy,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed - 24,
        t0: t,
        life: 0.7 + Math.random() * 0.9,
        colorIdx: Math.floor(Math.random() * 4),
        r: 5 + Math.random() * 9
      })
    }
    while (sparks.length > 90) sparks.shift()
    while (burstRings.length > 8) burstRings.shift()
    // Every click leaves a permanent little star behind — the visitor's mark.
    dust.push({
      u: cx / Math.max(1, w),
      v: cy / Math.max(1, h),
      r: 1 + Math.random(),
      layer: 2,
      tw: Math.random() * TAU
    })
    if (dust.length > 220) dust.splice(0, dust.length - 220)
  }

  function onClick(e: MouseEvent): void {
    // Only bare-sky clicks — buttons and links inside the hero keep their job.
    if (e.target !== canvas && e.target !== host) return
    const rect = canvas.getBoundingClientRect()
    spawnBurst(e.clientX - rect.left, e.clientY - rect.top)
    if (reducedMotion) drawFrame()
  }

  const host = canvas.parentElement ?? canvas
  host.addEventListener('mousemove', onPointerMove)
  host.addEventListener('mouseleave', onPointerLeave)
  host.addEventListener('click', onClick)

  const resizeObserver = new ResizeObserver(() => resize())
  resizeObserver.observe(host)

  const io = new IntersectionObserver(
    (entries) => {
      visible = entries.some((e) => e.isIntersecting)
      updateRunning()
    },
    { threshold: 0.02 }
  )
  io.observe(canvas)

  function onVisibility(): void {
    updateRunning()
  }
  document.addEventListener('visibilitychange', onVisibility)

  resize()
  if (reducedMotion) drawFrame()
  else updateRunning()

  return {
    refreshPalette() {
      palette = readPalette()
      rebuildSprites()
      if (!running) drawFrame()
    },
    setPaused(p: boolean) {
      paused = p
      updateRunning()
    },
    destroy() {
      cancelAnimationFrame(raf)
      running = false
      resizeObserver.disconnect()
      io.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      host.removeEventListener('mousemove', onPointerMove)
      host.removeEventListener('mouseleave', onPointerLeave)
      host.removeEventListener('click', onClick)
    }
  }
}
