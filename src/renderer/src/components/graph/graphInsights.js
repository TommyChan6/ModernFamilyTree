// Pure graph-insight math — no D3/Three/store dependency, unit-tested in
// tests/graphInsights.test.js. Everything treats the relationship list as an
// undirected multigraph unless a helper says otherwise.

/** Adjacency map over every relationship: id → [{ otherId, rel }]. */
export function buildAdjacency(relationships) {
  const adj = new Map()
  const push = (a, otherId, rel) => {
    const arr = adj.get(a)
    if (arr) arr.push({ otherId, rel })
    else adj.set(a, [{ otherId, rel }])
  }
  for (const r of relationships) {
    if (!r.person_a_id || !r.person_b_id || r.person_a_id === r.person_b_id) continue
    push(r.person_a_id, r.person_b_id, r)
    push(r.person_b_id, r.person_a_id, r)
  }
  return adj
}

/**
 * Shortest relationship chain between two people (BFS over every edge type).
 * Returns { ids: [start,…,end], rels: [Relationship,…] } — rels[i] joins
 * ids[i]→ids[i+1] — or null when no chain exists.
 */
export function shortestPath(startId, endId, relationships) {
  if (startId === endId) return { ids: [startId], rels: [] }
  const adj = buildAdjacency(relationships)
  if (!adj.has(startId) || !adj.has(endId)) return null
  const prev = new Map() // id → { fromId, rel }
  prev.set(startId, null)
  let frontier = [startId]
  while (frontier.length) {
    const next = []
    for (const id of frontier) {
      for (const { otherId, rel } of adj.get(id) || []) {
        if (prev.has(otherId)) continue
        prev.set(otherId, { fromId: id, rel })
        if (otherId === endId) {
          // Walk the chain back to the start.
          const ids = [endId]
          const rels = []
          let cur = endId
          while (cur !== startId) {
            const p = prev.get(cur)
            rels.unshift(p.rel)
            ids.unshift(p.fromId)
            cur = p.fromId
          }
          return { ids, rels }
        }
        next.push(otherId)
      }
    }
    frontier = next
  }
  return null
}

/**
 * BFS hop distance from one person to everyone reachable (any edge type).
 * Returns Map id → distance (start = 0). Unreachable people are absent.
 */
export function egoDistances(startId, relationships, maxDepth = Infinity) {
  const adj = buildAdjacency(relationships)
  const dist = new Map([[startId, 0]])
  let frontier = [startId]
  let d = 0
  while (frontier.length && d < maxDepth) {
    d++
    const next = []
    for (const id of frontier) {
      for (const { otherId } of adj.get(id) || []) {
        if (dist.has(otherId)) continue
        dist.set(otherId, d)
        next.push(otherId)
      }
    }
    frontier = next
  }
  return dist
}

/**
 * Derived siblinghood: two people are siblings when they share a parent via a
 * 'vertical' edge (parent_child/adopted/custom vertical types). Explicit
 * sibling rows exist for the cases this can't see (half/step siblings with no
 * recorded shared parent). Returns Map personId → Set of sibling ids.
 * `roleOfType(type)` → 'vertical' | 'horizontal' | 'none' (the registry's
 * symmetryRole); defaults to the legacy trio when omitted.
 */
export function derivedSiblings(relationships, roleOfType) {
  const roleOf =
    roleOfType ||
    ((t) =>
      t === 'parent_child' || t === 'adopted' ? 'vertical' : t === 'spouse' ? 'horizontal' : 'none')
  const childrenOf = new Map() // parentId → [childId]
  for (const r of relationships) {
    if (roleOf(r.type) !== 'vertical') continue
    if (r.person_a_id === r.person_b_id) continue
    const arr = childrenOf.get(r.person_a_id)
    if (arr) arr.push(r.person_b_id)
    else childrenOf.set(r.person_a_id, [r.person_b_id])
  }
  const sibs = new Map()
  const link = (a, b) => {
    let s = sibs.get(a)
    if (!s) sibs.set(a, (s = new Set()))
    s.add(b)
  }
  for (const kids of childrenOf.values()) {
    const uniq = [...new Set(kids)]
    for (let i = 0; i < uniq.length; i++) {
      for (let j = i + 1; j < uniq.length; j++) {
        link(uniq[i], uniq[j])
        link(uniq[j], uniq[i])
      }
    }
  }
  return sibs
}

/**
 * Romance analysis over directed `likes` edges (a admires b):
 *  - mutual:      [{ a, b }]           both directions exist (a < b for stability)
 *  - unrequited:  [{ from, to }]       one-way only
 *  - triangles:   [[a, b, c]]          directed 3-cycles a→b→c→a
 *  - rivals:      [{ crush, admirers }] two+ admirers share an un-mutual crush
 */
export function romanceInsights(relationships, likesKey = 'likes') {
  const edges = relationships.filter(
    (r) => r.type === likesKey && r.person_a_id && r.person_b_id && r.person_a_id !== r.person_b_id
  )
  const has = new Set(edges.map((r) => r.person_a_id + '→' + r.person_b_id))
  const likesOf = new Map() // admirer → Set(crush)
  const admirersOf = new Map() // crush → Set(admirer)
  for (const r of edges) {
    if (!likesOf.has(r.person_a_id)) likesOf.set(r.person_a_id, new Set())
    likesOf.get(r.person_a_id).add(r.person_b_id)
    if (!admirersOf.has(r.person_b_id)) admirersOf.set(r.person_b_id, new Set())
    admirersOf.get(r.person_b_id).add(r.person_a_id)
  }

  const mutual = []
  const seenMutual = new Set()
  const unrequited = []
  for (const r of edges) {
    const back = has.has(r.person_b_id + '→' + r.person_a_id)
    if (back) {
      const key = [r.person_a_id, r.person_b_id].sort().join('~')
      if (!seenMutual.has(key)) {
        seenMutual.add(key)
        const [a, b] = [r.person_a_id, r.person_b_id].sort()
        mutual.push({ a, b })
      }
    } else {
      unrequited.push({ from: r.person_a_id, to: r.person_b_id })
    }
  }

  // Directed 3-cycles, deduped by rotating the smallest id first.
  const triangles = []
  const seenTri = new Set()
  for (const [a, crushes] of likesOf) {
    for (const b of crushes) {
      for (const c of likesOf.get(b) || []) {
        if (c === a) continue
        if (!(likesOf.get(c) || new Set()).has(a)) continue
        const rot = [a, b, c]
        const minIdx = rot.indexOf([...rot].sort()[0])
        const key = [rot[minIdx], rot[(minIdx + 1) % 3], rot[(minIdx + 2) % 3]].join('~')
        if (seenTri.has(key)) continue
        seenTri.add(key)
        triangles.push([rot[minIdx], rot[(minIdx + 1) % 3], rot[(minIdx + 2) % 3]])
      }
    }
  }

  const rivals = []
  for (const [crush, admirers] of admirersOf) {
    const oneWay = [...admirers].filter((a) => !(likesOf.get(crush) || new Set()).has(a))
    if (oneWay.length >= 2) rivals.push({ crush, admirers: oneWay.sort() })
  }

  return { mutual, unrequited, triangles, rivals }
}

/** Set of "a~b" (sorted) pair keys whose likes are mutual — for canvas styling. */
export function mutualLikesKeys(relationships, likesKey = 'likes') {
  const has = new Set()
  for (const r of relationships) {
    if (r.type === likesKey) has.add(r.person_a_id + '→' + r.person_b_id)
  }
  const out = new Set()
  for (const k of has) {
    const [a, b] = k.split('→')
    if (has.has(b + '→' + a)) out.add([a, b].sort().join('~'))
  }
  return out
}
