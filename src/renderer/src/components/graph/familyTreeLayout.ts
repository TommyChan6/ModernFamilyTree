// Pure family-tree layout — a layered, crossing-minimizing heuristic shared by the
// Tree view's Generation mode and the Timeline's lane ordering.
//
// Philosophy: generally good, never absolute. Genealogy graphs (remarriage,
// half-siblings, entry mistakes that form cycles) have no single perfect drawing,
// so every rule below is a soft preference applied in decreasing order of strength:
//   1. parents sit above their children (row assignment by longest ancestor path)
//   2. married couples sit side by side as one block, father on the left
//   3. rows are ordered to minimize link crossings (weighted barycenter sweeps,
//      with a slight extra pull along father→child edges)
//   4. nodes keep a minimum spacing and children center under their parents
//      (alternating top-down/bottom-up coordinate refinement with a symmetric
//      overlap resolver that never reorders a row)
// Disconnected families are laid out independently and placed side by side.
//
// Everything is deterministic (stable sorts, id tie-breaks) and O(sweeps · (N + E)
// + N log N per row sort), so a few thousand people stay well under a frame.

export const NODE_GAP = 90 // min horizontal gap between neighbouring blocks
export const SPOUSE_GAP = 56 // gap between partners inside a couple block
export const COMPONENT_GAP = 170 // gap between disconnected family components
const FATHER_PULL = 1.15 // slight extra weight on father→child edges
const ORDER_SWEEPS = 4 // barycenter ordering passes (down + up each)
const REFINE_PASSES = 6 // coordinate refinement passes (alternating)
const LAYER_RELAX_PASSES = 20 // cap for the spouse/child row relaxation

export interface LayoutPerson {
  id: string
  gender?: string | null
  birth_year?: number | null
}

export interface LayoutRelationship {
  type: string
  person_a_id: string
  person_b_id: string
}

export interface GenLayoutResult {
  targets: Record<string, { x: number; y: number }>
  yMap: Record<string, number>
  genLabels: { label: string; y: number }[]
  padding: number
  usableHeight: number
  rowHeight: number
}

interface Block {
  members: string[] // left→right member ids (spouse chains stay adjacent)
  width: number // (members - 1) · SPOUSE_GAP
  x: number // center x of the block
}

const isMale = (p: LayoutPerson | undefined): boolean => p?.gender === 'male'
const birthOf = (p: LayoutPerson | undefined): number =>
  typeof p?.birth_year === 'number' && p.birth_year ? p.birth_year : Infinity

function pushUnique(map: Map<string, string[]>, key: string, value: string): void {
  const arr = map.get(key)
  if (!arr) map.set(key, [value])
  else if (!arr.includes(value)) arr.push(value)
}

export function computeGenLayout(
  nodesData: readonly LayoutPerson[],
  relationships: readonly LayoutRelationship[],
  width: number,
  height: number
): GenLayoutResult {
  const byId = new Map<string, LayoutPerson>()
  for (const p of nodesData) byId.set(p.id, p)

  // ── Adjacency (edges to unknown ids are ignored) ──────────────────────────
  const parentsOf = new Map<string, string[]>()
  const childrenOf = new Map<string, string[]>()
  const spousesOf = new Map<string, string[]>()
  for (const r of relationships) {
    const a = r.person_a_id
    const b = r.person_b_id
    if (a === b || !byId.has(a) || !byId.has(b)) continue
    if (r.type === 'parent_child' || r.type === 'adopted') {
      pushUnique(parentsOf, b, a)
      pushUnique(childrenOf, a, b)
    } else if (r.type === 'spouse') {
      pushUnique(spousesOf, a, b)
      pushUnique(spousesOf, b, a)
    }
  }
  // Father→child edges pull slightly harder in every averaging step below.
  const edgeWeight = (parentId: string): number => (isMale(byId.get(parentId)) ? FATHER_PULL : 1)

  // ── Connected components ──────────────────────────────────────────────────
  const compOf = new Map<string, number>()
  let compCount = 0
  for (const p of nodesData) {
    if (compOf.has(p.id)) continue
    const queue = [p.id]
    compOf.set(p.id, compCount)
    while (queue.length) {
      const id = queue.pop() as string
      for (const n of [
        ...(parentsOf.get(id) ?? []),
        ...(childrenOf.get(id) ?? []),
        ...(spousesOf.get(id) ?? [])
      ]) {
        if (!compOf.has(n)) {
          compOf.set(n, compOf.get(id) as number)
          queue.push(n)
        }
      }
    }
    compCount++
  }

  // ── Row (generation) assignment ───────────────────────────────────────────
  // Longest path from ancestors, then a bounded relaxation so spouses share a
  // row while children stay below every parent. Caps keep pathological data
  // (cycles, spouse chains across generations) from looping forever.
  const gen = new Map<string, number>()
  const genOf = (id: string, seen: Set<string>): number => {
    const cached = gen.get(id)
    if (cached !== undefined) return cached
    if (seen.has(id)) return 0 // cycle guard
    seen.add(id)
    let g = 0
    for (const pid of parentsOf.get(id) ?? []) g = Math.max(g, genOf(pid, seen) + 1)
    gen.set(id, g)
    return g
  }
  for (const p of nodesData) genOf(p.id, new Set())

  for (let pass = 0; pass < LAYER_RELAX_PASSES; pass++) {
    let changed = false
    for (const [id, spouses] of spousesOf) {
      for (const s of spouses) {
        const g = Math.max(gen.get(id) ?? 0, gen.get(s) ?? 0)
        if (gen.get(id) !== g || gen.get(s) !== g) {
          gen.set(id, g)
          gen.set(s, g)
          changed = true
        }
      }
    }
    const byGen = [...nodesData].sort((a, b) => (gen.get(a.id) ?? 0) - (gen.get(b.id) ?? 0))
    for (const p of byGen) {
      const g = gen.get(p.id) ?? 0
      for (const c of childrenOf.get(p.id) ?? []) {
        if ((gen.get(c) ?? 0) <= g) {
          gen.set(c, g + 1)
          changed = true
        }
      }
    }
    if (!changed) break
  }

  // Each component starts at its own top row.
  const compMinGen = new Map<number, number>()
  for (const p of nodesData) {
    const c = compOf.get(p.id) as number
    const g = gen.get(p.id) ?? 0
    compMinGen.set(c, Math.min(compMinGen.get(c) ?? Infinity, g))
  }
  for (const p of nodesData) {
    const c = compOf.get(p.id) as number
    gen.set(p.id, (gen.get(p.id) ?? 0) - (compMinGen.get(c) ?? 0))
  }

  // Compress to used rows (global), so guides never label an empty row.
  const usedRows = [...new Set([...gen.values()])].sort((a, b) => a - b)
  const rowIndex = new Map<number, number>()
  usedRows.forEach((g, i) => rowIndex.set(g, i))
  const rowOf = (id: string): number => rowIndex.get(gen.get(id) ?? 0) ?? 0

  // ── Couple blocks per (component, row) ────────────────────────────────────
  // Same-row spouse chains merge into one block so partners are always adjacent
  // (spouse edges inside a row can never cross anything).
  const posX = new Map<string, number>() // current x per person, kept in sync

  const orientChain = (members: string[]): string[] => {
    if (members.length < 2) return members
    // Father-lean: a couple reads father → mother left to right.
    const firstMale = isMale(byId.get(members[0]))
    const lastMale = isMale(byId.get(members[members.length - 1]))
    if (!firstMale && lastMale) return [...members].reverse()
    return members
  }

  const buildBlocks = (ids: string[]): Block[] => {
    const inGroup = new Set(ids)
    const seen = new Set<string>()
    const blocks: Block[] = []
    for (const id of ids) {
      if (seen.has(id)) continue
      // Collect the whole same-row spouse chain.
      const chain = new Set<string>([id])
      const queue = [id]
      while (queue.length) {
        const cur = queue.pop() as string
        for (const s of spousesOf.get(cur) ?? []) {
          if (inGroup.has(s) && !chain.has(s)) {
            chain.add(s)
            queue.push(s)
          }
        }
      }
      chain.forEach((m) => seen.add(m))
      // Walk the chain as a path from an endpoint (falls back gracefully on
      // branching/cyclic spouse data — heuristic, not absolute).
      const degree = (m: string): number =>
        (spousesOf.get(m) ?? []).filter((s) => chain.has(s)).length
      const start =
        [...chain].sort((a, b) => a.localeCompare(b)).find((m) => degree(m) <= 1) ??
        [...chain].sort((a, b) => a.localeCompare(b))[0]
      const members: string[] = []
      const visited = new Set<string>()
      let cur: string | undefined = start
      while (cur && !visited.has(cur)) {
        visited.add(cur)
        members.push(cur)
        cur = (spousesOf.get(cur) ?? []).find((s) => chain.has(s) && !visited.has(s))
      }
      for (const m of [...chain].sort((a, b) => a.localeCompare(b))) {
        if (!visited.has(m)) members.push(m)
      }
      blocks.push({ members: orientChain(members), width: (chain.size - 1) * SPOUSE_GAP, x: 0 })
    }
    return blocks
  }

  // Write member positions from a block's center x.
  const syncBlock = (b: Block): void => {
    const left = b.x - b.width / 2
    b.members.forEach((m, i) => posX.set(m, left + i * SPOUSE_GAP))
  }

  const compactRow = (blocks: Block[]): void => {
    let cursor = 0
    for (const b of blocks) {
      b.x = cursor + b.width / 2
      cursor += b.width + NODE_GAP
      syncBlock(b)
    }
  }

  // Mean position of a member's relations in the given direction (undefined if none).
  const pullOf = (member: string, dir: 'parents' | 'children'): { x: number; w: number } | null => {
    const rels = (dir === 'parents' ? parentsOf : childrenOf).get(member)
    if (!rels || !rels.length) return null
    let sum = 0
    let wsum = 0
    for (const r of rels) {
      const x = posX.get(r)
      if (x === undefined) continue
      const w = dir === 'parents' ? edgeWeight(r) : edgeWeight(member)
      sum += x * w
      wsum += w
    }
    return wsum > 0 ? { x: sum / wsum, w: wsum } : null
  }

  // Desired center for a block: each member votes with its relations' mean
  // position (minus the member's offset inside the block), weighted by how many
  // relations actually pull on it.
  const desiredX = (b: Block, dir: 'parents' | 'children'): number => {
    let sum = 0
    let wsum = 0
    b.members.forEach((m, i) => {
      const pull = pullOf(m, dir)
      if (!pull) return
      const offset = i * SPOUSE_GAP - b.width / 2
      sum += (pull.x - offset) * pull.w
      wsum += pull.w
    })
    return wsum > 0 ? sum / wsum : b.x
  }

  // Symmetric overlap resolver: forward pass (leftmost feasible ≥ desired) and
  // backward pass (rightmost feasible ≤ desired) are both gap-feasible, so their
  // average is too — and it drifts neither left nor right. Order never changes.
  const resolveRow = (blocks: Block[], desired: number[]): void => {
    const n = blocks.length
    if (!n) return
    const gap = (i: number): number => (blocks[i - 1].width + blocks[i].width) / 2 + NODE_GAP
    const fp = new Array<number>(n)
    const bp = new Array<number>(n)
    for (let i = 0; i < n; i++) fp[i] = i ? Math.max(desired[i], fp[i - 1] + gap(i)) : desired[i]
    for (let i = n - 1; i >= 0; i--)
      bp[i] = i < n - 1 ? Math.min(desired[i], bp[i + 1] - gap(i + 1)) : desired[i]
    for (let i = 0; i < n; i++) {
      blocks[i].x = (fp[i] + bp[i]) / 2
      syncBlock(blocks[i])
    }
  }

  // ── Per-component layout ──────────────────────────────────────────────────
  const compIds = new Map<number, string[]>()
  for (const p of nodesData) {
    const c = compOf.get(p.id) as number
    const arr = compIds.get(c)
    if (arr) arr.push(p.id)
    else compIds.set(c, [p.id])
  }

  const layoutComponent = (ids: string[]): void => {
    // Group members by row.
    const rows = new Map<number, string[]>()
    for (const id of ids) {
      const r = rowOf(id)
      const arr = rows.get(r)
      if (arr) arr.push(id)
      else rows.set(r, [id])
    }
    const rowKeys = [...rows.keys()].sort((a, b) => a - b)
    const rowBlocks = new Map<number, Block[]>()
    for (const r of rowKeys) {
      const blocks = buildBlocks(rows.get(r) as string[])
      // Deterministic initial order: eldest first, then id.
      blocks.sort((a, b) => {
        const ba = Math.min(...a.members.map((m) => birthOf(byId.get(m))))
        const bb = Math.min(...b.members.map((m) => birthOf(byId.get(m))))
        if (ba !== bb) return ba - bb
        return a.members[0].localeCompare(b.members[0])
      })
      rowBlocks.set(r, blocks)
      compactRow(blocks)
    }

    // Crossing minimization: reorder each row by the (weighted) mean position of
    // its relations in the neighbouring rows, sweeping down then up.
    const sortRow = (r: number, dir: 'parents' | 'children'): void => {
      const blocks = rowBlocks.get(r) as Block[]
      if (blocks.length < 2) return
      const keyed = blocks.map((b, i) => ({ b, key: desiredX(b, dir), i }))
      keyed.sort((a, c) => a.key - c.key || a.i - c.i)
      const sorted = keyed.map((k) => k.b)
      rowBlocks.set(r, sorted)
      compactRow(sorted)
    }
    for (let sweep = 0; sweep < ORDER_SWEEPS; sweep++) {
      for (let i = 1; i < rowKeys.length; i++) sortRow(rowKeys[i], 'parents')
      for (let i = rowKeys.length - 2; i >= 0; i--) sortRow(rowKeys[i], 'children')
    }

    // Coordinate refinement: children center under parents (and parents over
    // children), order fixed, minimum gaps enforced symmetrically.
    for (let pass = 0; pass < REFINE_PASSES; pass++) {
      const down = pass % 2 === 0
      const order = down ? rowKeys.slice(1) : rowKeys.slice(0, -1).reverse()
      const dir: 'parents' | 'children' = down ? 'parents' : 'children'
      for (const r of order) {
        const blocks = rowBlocks.get(r) as Block[]
        resolveRow(
          blocks,
          blocks.map((b) => desiredX(b, dir))
        )
      }
    }
  }

  // Largest families first (left), then by id for determinism.
  const comps = [...compIds.entries()].sort(
    (a, b) => b[1].length - a[1].length || a[1][0].localeCompare(b[1][0])
  )
  for (const [, ids] of comps) layoutComponent(ids)

  // ── Compose components side by side, then center on the canvas ────────────
  let cursor = 0
  for (const [, ids] of comps) {
    let min = Infinity
    let max = -Infinity
    for (const id of ids) {
      const x = posX.get(id) ?? 0
      min = Math.min(min, x)
      max = Math.max(max, x)
    }
    if (min === Infinity) continue
    const shift = cursor - min
    for (const id of ids) posX.set(id, (posX.get(id) ?? 0) + shift)
    cursor += max - min + COMPONENT_GAP
  }
  const allX = [...posX.values()]
  const offsetX = allX.length ? width / 2 - (Math.min(...allX) + Math.max(...allX)) / 2 : width / 2
  for (const [id, x] of posX) posX.set(id, x + offsetX)

  // ── Rows → y ──────────────────────────────────────────────────────────────
  const rowCount = usedRows.length
  const rowHeight = Math.max(120, Math.min(150, (height - 160) / Math.max(rowCount, 1)))
  const totalH = Math.max(0, rowCount - 1) * rowHeight
  const startY = (height - totalH) / 2

  const targets: Record<string, { x: number; y: number }> = {}
  const yMap: Record<string, number> = {}
  const genLabels: { label: string; y: number }[] = []
  for (let i = 0; i < rowCount; i++) {
    genLabels.push({ label: `Gen ${i + 1}`, y: startY + i * rowHeight })
  }
  for (const p of nodesData) {
    const y = startY + rowOf(p.id) * rowHeight
    targets[p.id] = { x: posX.get(p.id) ?? width / 2, y }
    yMap[p.id] = y
  }

  return { targets, yMap, genLabels, padding: 80, usableHeight: height - 160, rowHeight }
}

// Left→right reading order of the layout — the Timeline uses this for lane order.
export function computeTreeOrder(
  persons: readonly LayoutPerson[],
  relationships: readonly LayoutRelationship[]
): string[] {
  const { targets } = computeGenLayout(persons, relationships, 2000, 1000)
  return [...persons]
    .sort((a, b) => {
      const ta = targets[a.id]
      const tb = targets[b.id]
      if (ta && tb && ta.x !== tb.x) return ta.x - tb.x
      return birthOf(a) - birthOf(b) || a.id.localeCompare(b.id)
    })
    .map((p) => p.id)
}
