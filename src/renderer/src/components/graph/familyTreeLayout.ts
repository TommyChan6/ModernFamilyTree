// Pure family-tree layout — a layered (Sugiyama-style) heuristic shared by the
// graph's refresh / Generations / Birth arrangements and the Timeline's lane order.
//
// Philosophy: generally good, never absolute. Genealogy graphs (remarriage,
// half-siblings, entry mistakes that form cycles) have no single perfect drawing,
// so every rule below is a soft preference applied in decreasing order of strength:
//   1. parents sit above their children. Rows come from walking each family
//      outward from its deepest lineage (so an in-law's parents land one row
//      above them instead of stranded at the top), repaired so every child is
//      below every parent and partners share a row, then tightened so no line
//      is longer than it has to be
//   2. partners sit side by side as one block — father on the left unless the
//      couple's own parents sit the other way round (that would force a
//      crossing); unmarried co-parents of a child pair up the same way
//   3. rows are ordered to minimize crossings: weighted barycenter sweeps plus
//      adjacent-swap (transpose) refinement, keeping the best ordering seen.
//      A couple's lines are counted from their midpoint, as they're drawn
//   4. coordinates pull parent→child lines vertical with an L1-style fit (many
//      perfectly straight lines rather than many slightly bent ones), solved row
//      by row with an exact order-preserving projection; siblings keep a minimum
//      gap and unrelated neighbours a wider one, so families read as clusters
// Disconnected families are laid out independently and placed side by side.
//
// Everything is deterministic (stable sorts, id tie-breaks) and roughly
// O(passes · (N + E) + N log N per row sort), so a few thousand people stay fast.

import type { DateValue, SymmetryRole } from '../../../../shared/types'
import { toOrdinal } from '../../../../shared/calendarMath'

export const NODE_GAP = 100 // min horizontal gap between neighbouring blocks
export const SPOUSE_GAP = 56 // gap between partners inside a couple block
export const FAMILY_GAP = 40 // extra gap between neighbouring blocks that aren't siblings
export const COMPONENT_GAP = 170 // gap between disconnected family components
export const BASE_NODE_RADIUS = 22 // the node radius the gaps above are tuned for
const FATHER_PULL = 1.15 // slight extra weight on single-father→child lines
const ORDER_SWEEPS = 12 // max barycenter ordering sweeps (down + up each)
const ORDER_PATIENCE = 3 // stop after this many sweeps without fewer crossings
const TRANSPOSE_ROUNDS = 4 // adjacent-swap passes per row per sweep
const LAYER_RELAX_PASSES = 20 // cap for the row repair / tightening loops
const COORD_L2_PASSES = 12 // least-squares coordinate passes (smooth start)
const COORD_SNAP_PASSES = 16 // reweighted passes that snap near-straight lines straight
const SNAP_EPS = 2 // px — below this a family counts as aligned
const SNAP_RANGE = 60 // px — misalignment beyond this is shared out (least squares)
const FREE_WEIGHT = 1e-3 // how strongly an unconnected block holds its place

export interface LayoutPerson {
  id: string
  gender?: string | null
  birth?: DateValue | null
}

export interface LayoutRelationship {
  type: string
  person_a_id: string
  person_b_id: string
}

/** rel.type → how the hierarchy treats it (a RelationshipTypeDef's
 *  symmetryRole). Optional everywhere: without it, the legacy trio behaves as
 *  it always did and any other type is ignored by the tree math. */
export type TypeRoles = ReadonlyMap<string, SymmetryRole>

export interface GenLayoutOptions {
  /** Drawn node radius — gaps and row height scale up for bigger nodes. */
  nodeRadius?: number
}

const legacyRoleOf = (type: string): SymmetryRole =>
  type === 'parent_child' || type === 'adopted'
    ? 'vertical'
    : type === 'spouse'
      ? 'horizontal'
      : 'none'

export interface GenLayoutResult {
  targets: Record<string, { x: number; y: number }>
  yMap: Record<string, number>
  genLabels: { label: string; y: number }[]
  padding: number
  usableHeight: number
  rowHeight: number
}

interface Block {
  members: string[] // left→right member ids (partner chains stay adjacent)
  base: string[] // default (father-left) orientation — the tie-break for flips
  width: number // (members - 1) · spouseGap
  x: number // center x of the block
  row: number
  parents: Set<string> // every parent of every member (the sibling test)
  edges: Incident[]
}

// One drawn parent→child line: from the midpoint of the child's parents that
// share a block (a couple's line leaves from between them) down to the child.
interface UnitEdge {
  up: string[]
  upBlock: Block
  down: string
  downBlock: Block
  fam: Family
  w: number
  upOff: number // endpoint offsets from their block centers (coordinate phase)
  downOff: number
}

// A parent unit and all its children — the coordinate phase straightens
// families as a whole, so the unit stays centered over its sibling group.
interface Family {
  edges: UnitEdge[]
  irls: number // current reweighting factor (1 / |unit x − mean child x|)
}

interface Incident {
  e: UnitEdge
  top: boolean // true = this block holds the parent end
}

const isMale = (p: LayoutPerson | undefined): boolean => p?.gender === 'male'
const birthOf = (p: LayoutPerson | undefined): number => toOrdinal(p?.birth) ?? Infinity
const SEP = '\u0000'

function pushUnique(map: Map<string, string[]>, key: string, value: string): void {
  const arr = map.get(key)
  if (!arr) map.set(key, [value])
  else if (!arr.includes(value)) arr.push(value)
}

/** Strict inversions in `seq` (pairs i < j with seq[i] > seq[j]) — merge sort. */
function countInversions(seq: number[]): number {
  if (seq.length < 2) return 0
  let inv = 0
  let a = seq.slice()
  let b = new Array<number>(a.length)
  for (let width = 1; width < a.length; width *= 2) {
    for (let lo = 0; lo < a.length; lo += 2 * width) {
      const mid = Math.min(lo + width, a.length)
      const hi = Math.min(lo + 2 * width, a.length)
      let i = lo
      let j = mid
      let k = lo
      while (i < mid && j < hi) {
        if (a[i] <= a[j]) b[k++] = a[i++]
        else {
          inv += mid - i
          b[k++] = a[j++]
        }
      }
      while (i < mid) b[k++] = a[i++]
      while (j < hi) b[k++] = a[j++]
    }
    const t = a
    a = b
    b = t
  }
  return inv
}

export function computeGenLayout(
  nodesData: readonly LayoutPerson[],
  relationships: readonly LayoutRelationship[],
  width: number,
  height: number,
  typeRoles?: TypeRoles,
  opts?: GenLayoutOptions
): GenLayoutResult {
  const scale = Math.max(1, (opts?.nodeRadius ?? BASE_NODE_RADIUS) / BASE_NODE_RADIUS)
  const nodeGap = NODE_GAP * scale
  const spouseGap = SPOUSE_GAP * scale
  const familyGap = FAMILY_GAP * scale
  const componentGap = COMPONENT_GAP * scale

  const byId = new Map<string, LayoutPerson>()
  for (const p of nodesData) byId.set(p.id, p)

  // ── Adjacency (edges to unknown ids are ignored) ──────────────────────────
  // Which edges are hierarchy edges comes from the type registry's
  // symmetryRole: 'vertical' = parent(a)→child(b), 'horizontal' = couple,
  // 'none' = social overlay the tree math never sees.
  const parentsOf = new Map<string, string[]>()
  const childrenOf = new Map<string, string[]>()
  const spousesOf = new Map<string, string[]>()
  for (const r of relationships) {
    const a = r.person_a_id
    const b = r.person_b_id
    if (a === b || !byId.has(a) || !byId.has(b)) continue
    const role = typeRoles?.get(r.type) ?? legacyRoleOf(r.type)
    if (role === 'vertical') {
      pushUnique(parentsOf, b, a)
      pushUnique(childrenOf, a, b)
    } else if (role === 'horizontal') {
      pushUnique(spousesOf, a, b)
      pushUnique(spousesOf, b, a)
    }
  }
  // Partners = spouses, plus unmarried co-parents (two recorded parents of a
  // child, neither with a spouse) — they read as a couple, so they sit as one.
  const partnersOf = new Map<string, string[]>()
  for (const [id, s] of spousesOf) partnersOf.set(id, [...s])
  for (const p of nodesData) {
    const ps = parentsOf.get(p.id)
    if (!ps || ps.length !== 2 || spousesOf.has(ps[0]) || spousesOf.has(ps[1])) continue
    pushUnique(partnersOf, ps[0], ps[1])
    pushUnique(partnersOf, ps[1], ps[0])
  }
  const edgeWeight = (parentId: string): number => (isMale(byId.get(parentId)) ? FATHER_PULL : 1)

  // Back edges of the parent→child digraph (entry mistakes that form cycles)
  // are ignored by the row math, so a cycle can't ratchet rows downward.
  const backEdge = new Set<string>()
  {
    const state = new Map<string, 1 | 2>() // 1 = on the DFS stack, 2 = done
    for (const p of nodesData) {
      if (state.has(p.id)) continue
      state.set(p.id, 1)
      const stack: { id: string; i: number }[] = [{ id: p.id, i: 0 }]
      while (stack.length) {
        const top = stack[stack.length - 1]
        const kids = childrenOf.get(top.id) ?? []
        if (top.i < kids.length) {
          const c = kids[top.i++]
          const s = state.get(c)
          if (s === 1) backEdge.add(top.id + SEP + c)
          else if (!s) {
            state.set(c, 1)
            stack.push({ id: c, i: 0 })
          }
        } else {
          state.set(top.id, 2)
          stack.pop()
        }
      }
    }
  }
  const isTreeEdge = (parent: string, child: string): boolean => !backEdge.has(parent + SEP + child)

  // ── Connected components ──────────────────────────────────────────────────
  const compOf = new Map<string, number>()
  const compIds = new Map<number, string[]>()
  let compCount = 0
  for (const p of nodesData) {
    if (compOf.has(p.id)) continue
    const queue = [p.id]
    const ids: string[] = []
    compOf.set(p.id, compCount)
    while (queue.length) {
      const id = queue.pop() as string
      ids.push(id)
      for (const n of [
        ...(parentsOf.get(id) ?? []),
        ...(childrenOf.get(id) ?? []),
        ...(partnersOf.get(id) ?? [])
      ]) {
        if (!compOf.has(n)) {
          compOf.set(n, compCount)
          queue.push(n)
        }
      }
    }
    compIds.set(compCount, ids)
    compCount++
  }

  // ── Row (generation) assignment ───────────────────────────────────────────
  // 1. Walk each family breadth-first from its anchor — the founder of its
  //    deepest lineage — giving parents g-1, children g+1, partners g. On
  //    consistent data every line is exactly one row long.
  const below = new Map<string, number>() // longest descent beneath a person
  const depthBelow = (id: string): number => {
    const cached = below.get(id)
    if (cached !== undefined) return cached
    below.set(id, 0) // provisional — guards any cycle the back-edge pass missed
    let d = 0
    for (const c of childrenOf.get(id) ?? []) {
      if (isTreeEdge(id, c)) d = Math.max(d, depthBelow(c) + 1)
    }
    below.set(id, d)
    return d
  }
  const gen = new Map<string, number>()
  for (const ids of compIds.values()) {
    let anchor = ids[0]
    for (const id of ids) {
      const d = depthBelow(id) - depthBelow(anchor)
      const b = birthOf(byId.get(id)) - birthOf(byId.get(anchor))
      if (d > 0 || (d === 0 && (b < 0 || (b === 0 && id < anchor)))) anchor = id
    }
    gen.set(anchor, 0)
    const queue = [anchor]
    for (let head = 0; head < queue.length; head++) {
      const id = queue[head]
      const g = gen.get(id) as number
      const visit = (list: string[] | undefined, ng: number): void => {
        for (const n of list ?? []) {
          if (gen.has(n)) continue
          gen.set(n, ng)
          queue.push(n)
        }
      }
      visit(partnersOf.get(id), g)
      visit(parentsOf.get(id), g - 1)
      visit(childrenOf.get(id), g + 1)
    }
  }

  // 2. Repair: partners share a row, every child sits below every parent
  //    (conflicting data — e.g. cross-generation marriages — pushes down).
  const genOf = (id: string): number => gen.get(id) ?? 0
  for (let pass = 0; pass < LAYER_RELAX_PASSES; pass++) {
    let changed = false
    for (const [id, partners] of partnersOf) {
      for (const s of partners) {
        const g = Math.max(genOf(id), genOf(s))
        if (genOf(id) !== g || genOf(s) !== g) {
          gen.set(id, g)
          gen.set(s, g)
          changed = true
        }
      }
    }
    const byGen = [...nodesData].sort((a, b) => genOf(a.id) - genOf(b.id))
    for (const p of byGen) {
      const g = genOf(p.id)
      for (const c of childrenOf.get(p.id) ?? []) {
        if (isTreeEdge(p.id, c) && genOf(c) <= g) {
          gen.set(c, g + 1)
          changed = true
        }
      }
    }
    if (!changed) break
  }

  // 3. Tighten: a partner group with slack moves toward whichever side has
  //    more lines (its children below or its own parents above), as long as
  //    every line still points down.
  {
    const groups: string[][] = []
    const seen = new Set<string>()
    for (const p of nodesData) {
      if (seen.has(p.id)) continue
      const grp = [p.id]
      seen.add(p.id)
      for (let i = 0; i < grp.length; i++) {
        for (const s of partnersOf.get(grp[i]) ?? []) {
          if (!seen.has(s)) {
            seen.add(s)
            grp.push(s)
          }
        }
      }
      groups.push(grp)
    }
    for (let pass = 0; pass < LAYER_RELAX_PASSES; pass++) {
      let changed = false
      for (const grp of groups) {
        const g = genOf(grp[0])
        if (grp.some((m) => genOf(m) !== g)) continue
        const inGrp = new Set(grp)
        let lo = -Infinity
        let hi = Infinity
        let ups = 0
        const kids = new Set<string>()
        for (const m of grp) {
          let hasParent = false
          for (const p of parentsOf.get(m) ?? []) {
            if (!isTreeEdge(p, m) || inGrp.has(p)) continue
            hasParent = true
            lo = Math.max(lo, genOf(p) + 1)
          }
          if (hasParent) ups++
          for (const c of childrenOf.get(m) ?? []) {
            if (!isTreeEdge(m, c) || inGrp.has(c)) continue
            kids.add(c)
            hi = Math.min(hi, genOf(c) - 1)
          }
        }
        let target = g
        if (kids.size > ups && hi !== Infinity && hi > g) target = hi
        else if (ups > kids.size && lo !== -Infinity && lo < g) target = lo
        if (target !== g) {
          for (const m of grp) gen.set(m, target)
          changed = true
        }
      }
      if (!changed) break
    }
  }

  // Each component starts at its own top row.
  for (const ids of compIds.values()) {
    let min = Infinity
    for (const id of ids) min = Math.min(min, genOf(id))
    for (const id of ids) gen.set(id, genOf(id) - min)
  }

  // Compress to used rows (global), so guides never label an empty row.
  const usedRows = [...new Set([...gen.values()])].sort((a, b) => a - b)
  const rowIndex = new Map<number, number>()
  usedRows.forEach((g, i) => rowIndex.set(g, i))
  const rowOf = (id: string): number => rowIndex.get(genOf(id)) ?? 0

  // ── Blocks, positions, gaps ───────────────────────────────────────────────
  const posX = new Map<string, number>() // current x per person, kept in sync
  const blockOf = new Map<string, Block>()

  const orientChain = (members: string[]): string[] => {
    if (members.length < 2) return members
    // Father-lean: a couple reads father → mother left to right.
    const firstMale = isMale(byId.get(members[0]))
    const lastMale = isMale(byId.get(members[members.length - 1]))
    if (!firstMale && lastMale) return [...members].reverse()
    return members
  }

  // Same-row partner chains merge into one block so partners are always
  // adjacent (partner lines inside a row can never cross anything).
  const buildBlocks = (ids: string[], row: number): Block[] => {
    const inGroup = new Set(ids)
    const seen = new Set<string>()
    const blocks: Block[] = []
    for (const id of ids) {
      if (seen.has(id)) continue
      const chain = new Set<string>([id])
      const queue = [id]
      while (queue.length) {
        const cur = queue.pop() as string
        for (const s of partnersOf.get(cur) ?? []) {
          if (inGroup.has(s) && !chain.has(s)) {
            chain.add(s)
            queue.push(s)
          }
        }
      }
      chain.forEach((m) => seen.add(m))
      // Walk the chain as a path from an endpoint (falls back gracefully on
      // branching/cyclic partner data — heuristic, not absolute).
      const degree = (m: string): number =>
        (partnersOf.get(m) ?? []).filter((s) => chain.has(s)).length
      const sorted = [...chain].sort((a, b) => a.localeCompare(b))
      const start = sorted.find((m) => degree(m) <= 1) ?? sorted[0]
      const members: string[] = []
      const visited = new Set<string>()
      let cur: string | undefined = start
      while (cur && !visited.has(cur)) {
        visited.add(cur)
        members.push(cur)
        cur = (partnersOf.get(cur) ?? []).find((s) => chain.has(s) && !visited.has(s))
      }
      for (const m of sorted) if (!visited.has(m)) members.push(m)
      const base = orientChain(members)
      const parents = new Set<string>()
      for (const m of chain) for (const p of parentsOf.get(m) ?? []) parents.add(p)
      const block: Block = {
        members: base,
        base,
        width: (chain.size - 1) * spouseGap,
        x: 0,
        row,
        parents,
        edges: []
      }
      for (const m of chain) blockOf.set(m, block)
      blocks.push(block)
    }
    return blocks
  }

  // Write member positions from a block's center x.
  const syncBlock = (b: Block): void => {
    const left = b.x - b.width / 2
    b.members.forEach((m, i) => posX.set(m, left + i * spouseGap))
  }

  // Siblings (sharing a parent) sit closer; unrelated neighbours get extra air.
  const gapBetween = (a: Block, b: Block): number => {
    let siblings = false
    for (const p of a.parents) {
      if (b.parents.has(p)) {
        siblings = true
        break
      }
    }
    return (a.width + b.width) / 2 + nodeGap + (siblings ? 0 : familyGap)
  }

  const compactRow = (blocks: Block[]): void => {
    let x = 0
    blocks.forEach((b, i) => {
      if (i) x += gapBetween(blocks[i - 1], b)
      b.x = x
      syncBlock(b)
    })
  }

  // Exact weighted least-squares placement of a row with its order fixed and
  // minimum gaps enforced: substitute away the cumulative gaps and the problem
  // becomes isotonic regression, solved by pool-adjacent-violators.
  const placeRow = (blocks: Block[], gaps: number[], desired: number[], weight: number[]): void => {
    const n = blocks.length
    if (!n) return
    const off = new Array<number>(n)
    off[0] = 0
    for (let i = 1; i < n; i++) off[i] = off[i - 1] + gaps[i - 1]
    const pw: number[] = []
    const ps: number[] = []
    const start: number[] = []
    for (let i = 0; i < n; i++) {
      let w = weight[i]
      let s = w * (desired[i] - off[i])
      let st = i
      while (pw.length && ps[ps.length - 1] / pw[pw.length - 1] > s / w) {
        w += pw.pop() as number
        s += ps.pop() as number
        st = start.pop() as number
      }
      pw.push(w)
      ps.push(s)
      start.push(st)
    }
    for (let k = 0; k < pw.length; k++) {
      const mean = ps[k] / pw[k]
      const end = k + 1 < start.length ? start[k + 1] : n
      for (let i = start[k]; i < end; i++) {
        blocks[i].x = mean + off[i]
        syncBlock(blocks[i])
      }
    }
  }

  const meanX = (ids: string[]): number => {
    let s = 0
    for (const id of ids) s += posX.get(id) ?? 0
    return s / ids.length
  }
  const otherX = (inc: Incident): number =>
    inc.top ? (posX.get(inc.e.down) ?? 0) : meanX(inc.e.up)
  const ownX = (inc: Incident): number => (inc.top ? meanX(inc.e.up) : (posX.get(inc.e.down) ?? 0))
  const otherRow = (inc: Incident): number => (inc.top ? inc.e.downBlock.row : inc.e.upBlock.row)

  // ── Per-component layout ──────────────────────────────────────────────────
  const layoutComponent = (ids: string[]): void => {
    // Rows of blocks, eldest first as the deterministic starting order.
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
      const blocks = buildBlocks(rows.get(r) as string[], r)
      const eldest = (b: Block): number => Math.min(...b.members.map((m) => birthOf(byId.get(m))))
      blocks.sort((a, b) => eldest(a) - eldest(b) || a.members[0].localeCompare(b.members[0]))
      rowBlocks.set(r, blocks)
      compactRow(blocks)
    }

    // Lines: one per (child, parents-in-one-block) group.
    const edges: UnitEdge[] = []
    const families = new Map<string, Family>()
    for (const c of ids) {
      const ps = parentsOf.get(c)
      if (!ps) continue
      const downBlock = blockOf.get(c) as Block
      const byBlock = new Map<Block, string[]>()
      for (const p of ps) {
        const b = blockOf.get(p) as Block
        const arr = byBlock.get(b)
        if (arr) arr.push(p)
        else byBlock.set(b, [p])
      }
      for (const [upBlock, up] of byBlock) {
        if (upBlock === downBlock || upBlock.row === downBlock.row) continue
        const famKey = [...up].sort().join(SEP)
        let fam = families.get(famKey)
        if (!fam) families.set(famKey, (fam = { edges: [], irls: 1 }))
        const e: UnitEdge = {
          up,
          upBlock,
          down: c,
          downBlock,
          fam,
          w: up.length > 1 ? 1 : edgeWeight(up[0]),
          upOff: 0,
          downOff: 0
        }
        edges.push(e)
        fam.edges.push(e)
        upBlock.edges.push({ e, top: true })
        downBlock.edges.push({ e, top: false })
      }
    }

    // ── Ordering ────────────────────────────────────────────────────────────
    const countCrossings = (): number => {
      const groups = new Map<string, [number, number][]>()
      for (const e of edges) {
        const ux = meanX(e.up)
        const dx = posX.get(e.down) ?? 0
        const upTop = e.upBlock.row < e.downBlock.row
        const key = upTop
          ? `${e.upBlock.row}:${e.downBlock.row}`
          : `${e.downBlock.row}:${e.upBlock.row}`
        const pair: [number, number] = upTop ? [ux, dx] : [dx, ux]
        const arr = groups.get(key)
        if (arr) arr.push(pair)
        else groups.set(key, [pair])
      }
      let total = 0
      for (const pairs of groups.values()) {
        pairs.sort((a, b) => a[0] - b[0] || a[1] - b[1])
        total += countInversions(pairs.map((p) => p[1]))
      }
      return total
    }

    // Flip a partner chain when its lines reach the other way round (e.g. the
    // wife's family sits to the left) — father-left only breaks ties.
    const orientBlock = (b: Block): void => {
      if (b.members.length < 2) return
      const left = b.x - b.width / 2
      const costOf = (members: string[]): number => {
        const at = new Map<string, number>()
        members.forEach((m, i) => at.set(m, left + i * spouseGap))
        let cost = 0
        for (const inc of b.edges) {
          const mine = inc.top
            ? inc.e.up.reduce((s, id) => s + (at.get(id) ?? 0), 0) / inc.e.up.length
            : (at.get(inc.e.down) ?? 0)
          cost += inc.e.w * Math.abs(mine - otherX(inc))
        }
        return cost
      }
      const rev = [...b.base].reverse()
      b.members = costOf(rev) < costOf(b.base) - 1e-6 ? rev : b.base
      syncBlock(b)
    }

    // Reorder a row by the weighted mean position of its lines' far ends in
    // one direction (blocks with no such lines keep their place as the key).
    const sortRow = (r: number, wantTop: boolean): void => {
      const blocks = rowBlocks.get(r) as Block[]
      if (blocks.length > 1) {
        const keyed = blocks.map((b, i) => {
          let s = 0
          let ws = 0
          for (const inc of b.edges) {
            if (inc.top !== wantTop) continue
            s += inc.e.w * (otherX(inc) - (ownX(inc) - b.x))
            ws += inc.e.w
          }
          return { b, key: ws > 0 ? s / ws : b.x, i }
        })
        keyed.sort((a, c) => a.key - c.key || a.i - c.i)
        const sorted = keyed.map((k) => k.b)
        rowBlocks.set(r, sorted)
        compactRow(sorted)
      }
      for (const b of rowBlocks.get(r) as Block[]) orientBlock(b)
    }

    // Swap neighbours while that strictly removes crossings with other rows.
    const transposeRow = (r: number): void => {
      const blocks = rowBlocks.get(r) as Block[]
      if (blocks.length < 2) return
      let swapped = false
      for (let round = 0; round < TRANSPOSE_ROUNDS; round++) {
        let improved = false
        for (let i = 0; i + 1 < blocks.length; i++) {
          const a = blocks[i]
          const b = blocks[i + 1]
          if (!a.edges.length || !b.edges.length) continue
          let ab = 0
          let ba = 0
          for (const ia of a.edges) {
            const ra = otherRow(ia)
            const xa = otherX(ia)
            for (const ib of b.edges) {
              if (otherRow(ib) !== ra) continue
              const xb = otherX(ib)
              if (xa > xb) ab++
              else if (xa < xb) ba++
            }
          }
          if (ba < ab) {
            blocks[i] = b
            blocks[i + 1] = a
            improved = true
            swapped = true
          }
        }
        if (!improved) break
      }
      if (swapped) compactRow(blocks)
    }

    const snapshot = (): { r: number; blocks: Block[]; members: string[][] }[] =>
      rowKeys.map((r) => {
        const blocks = [...(rowBlocks.get(r) as Block[])]
        return { r, blocks, members: blocks.map((b) => b.members) }
      })
    const restore = (snap: ReturnType<typeof snapshot>): void => {
      for (const { r, blocks, members } of snap) {
        blocks.forEach((b, i) => (b.members = members[i]))
        rowBlocks.set(r, blocks)
        compactRow(blocks)
      }
    }

    if (edges.length) {
      let best = countCrossings()
      let bestSnap = snapshot()
      let stale = 0
      for (let sweep = 0; sweep < ORDER_SWEEPS && best > 0; sweep++) {
        for (let i = 1; i < rowKeys.length; i++) sortRow(rowKeys[i], false)
        for (let i = rowKeys.length - 2; i >= 0; i--) sortRow(rowKeys[i], true)
        for (const r of rowKeys) transposeRow(r)
        const c = countCrossings()
        if (c < best) {
          best = c
          bestSnap = snapshot()
          stale = 0
        } else if (++stale >= ORDER_PATIENCE) break
      }
      restore(bestSnap)
    }

    // ── Coordinates ─────────────────────────────────────────────────────────
    // Pull every line toward vertical with the row orders fixed: least-squares
    // passes first, then iteratively reweighted ones where each family (a
    // parent unit + its children) is weighted by 1 / its misalignment. That
    // approximates an L1 fit over families — most families end up exactly
    // centered over their children (an only child straight below) and any
    // unavoidable slack collects in a few, instead of every line bending a
    // little. Each row is solved exactly given its neighbours (block
    // coordinate descent).
    const measureOffsets = (): void => {
      for (const e of edges) {
        e.upOff = meanX(e.up) - e.upBlock.x
        e.downOff = (posX.get(e.down) ?? 0) - e.downBlock.x
      }
    }
    measureOffsets()
    const rowGaps = new Map<number, number[]>()
    for (const r of rowKeys) {
      const blocks = rowBlocks.get(r) as Block[]
      rowGaps.set(
        r,
        blocks.slice(1).map((b, i) => gapBetween(blocks[i], b))
      )
    }
    if (edges.length) {
      const passes = COORD_L2_PASSES + COORD_SNAP_PASSES
      const snapEps = SNAP_EPS * scale
      const snapRange = SNAP_RANGE * scale
      for (let pass = 0; pass < passes; pass++) {
        if (pass === COORD_L2_PASSES >> 1) {
          // Positions are near final now — re-decide which way each couple
          // faces against them (the ordering phase only saw compact rows).
          for (const r of rowKeys) for (const b of rowBlocks.get(r) as Block[]) orientBlock(b)
          measureOffsets()
        }
        if (pass >= COORD_L2_PASSES) {
          for (const fam of families.values()) {
            let ux = 0
            let cx = 0
            for (const e of fam.edges) {
              ux += e.upBlock.x + e.upOff
              cx += e.downBlock.x + e.downOff
            }
            const r = Math.abs(ux - cx) / fam.edges.length
            fam.irls = snapRange / Math.min(Math.max(r, snapEps), snapRange)
          }
        }
        const order = pass % 2 === 0 ? rowKeys : [...rowKeys].reverse()
        for (const r of order) {
          const blocks = rowBlocks.get(r) as Block[]
          const desired: number[] = []
          const weight: number[] = []
          for (const b of blocks) {
            let s = 0
            let ws = 0
            for (const { e, top } of b.edges) {
              const ux = e.upBlock.x + e.upOff
              const dx = e.downBlock.x + e.downOff
              const w = e.w * e.fam.irls
              s += w * (top ? dx - e.upOff : ux - e.downOff)
              ws += w
            }
            desired.push(ws > 0 ? s / ws : b.x)
            weight.push(ws > 0 ? ws : FREE_WEIGHT)
          }
          placeRow(blocks, rowGaps.get(r) as number[], desired, weight)
        }
      }
    }
  }

  // Largest families first (left), then by id for determinism.
  const comps = [...compIds.values()].sort(
    (a, b) => b.length - a.length || a[0].localeCompare(b[0])
  )
  for (const ids of comps) layoutComponent(ids)

  // ── Compose components side by side, then center on the canvas ────────────
  let cursor = 0
  for (const ids of comps) {
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
    cursor += max - min + componentGap
  }
  let minX = Infinity
  let maxX = -Infinity
  for (const x of posX.values()) {
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
  }
  const offsetX = posX.size ? width / 2 - (minX + maxX) / 2 : width / 2
  for (const [id, x] of posX) posX.set(id, x + offsetX)

  // ── Rows → y ──────────────────────────────────────────────────────────────
  const rowCount = usedRows.length
  const rowHeight = Math.max(
    120 * scale,
    Math.min(150 * scale, (height - 160) / Math.max(rowCount, 1))
  )
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
  relationships: readonly LayoutRelationship[],
  typeRoles?: TypeRoles
): string[] {
  const { targets } = computeGenLayout(persons, relationships, 2000, 1000, typeRoles)
  return [...persons]
    .sort((a, b) => {
      const ta = targets[a.id]
      const tb = targets[b.id]
      if (ta && tb && ta.x !== tb.x) return ta.x - tb.x
      return birthOf(a) - birthOf(b) || a.id.localeCompare(b.id)
    })
    .map((p) => p.id)
}
