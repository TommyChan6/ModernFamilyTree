// Pure layout computation for Generation mode — tree-based hierarchical layout

export function computeGenLayout(nodesData, relationships, width, height) {
  const NODE_GAP = 70
  const SPOUSE_GAP = 50
  const FAMILY_GAP = 90

  // Build relationship maps
  const parentToChildren = {}
  const childToParents = {}
  const spouseOf = {}

  relationships.forEach(r => {
    if (r.type === 'parent_child' || r.type === 'adopted') {
      if (!parentToChildren[r.person_a_id]) parentToChildren[r.person_a_id] = new Set()
      parentToChildren[r.person_a_id].add(r.person_b_id)
      if (!childToParents[r.person_b_id]) childToParents[r.person_b_id] = new Set()
      childToParents[r.person_b_id].add(r.person_a_id)
    }
    if (r.type === 'spouse') {
      spouseOf[r.person_a_id] = r.person_b_id
      spouseOf[r.person_b_id] = r.person_a_id
    }
  })

  // Assign generation depth
  const genMap = {}
  function getGen(id, visited) {
    if (genMap[id] !== undefined) return genMap[id]
    if (visited.has(id)) return 0
    visited.add(id)
    const parents = childToParents[id]
    if (!parents || parents.size === 0) { genMap[id] = 0; return 0 }
    let maxP = 0
    parents.forEach(pid => { maxP = Math.max(maxP, getGen(pid, visited)) })
    genMap[id] = maxP + 1
    return genMap[id]
  }
  nodesData.forEach(n => getGen(n.id, new Set()))

  // Align spouses to same generation
  relationships.forEach(r => {
    if (r.type !== 'spouse') return
    const ga = genMap[r.person_a_id]
    const gb = genMap[r.person_b_id]
    if (ga === undefined || gb === undefined) return
    const target = Math.min(ga, gb)
    genMap[r.person_a_id] = target
    genMap[r.person_b_id] = target
  })

  // Top-down: ensure child = max(parent gens) + 1
  const sortedByGen = [...nodesData].sort((a, b) => (genMap[a.id] || 0) - (genMap[b.id] || 0))
  sortedByGen.forEach(n => {
    const parents = childToParents[n.id]
    if (!parents || parents.size === 0) return
    let maxP = 0
    parents.forEach(pid => { maxP = Math.max(maxP, genMap[pid] || 0) })
    genMap[n.id] = maxP + 1
  })

  const genKeys = [...new Set(Object.values(genMap))].sort((a, b) => a - b)

  // Build family units
  const familyUnits = []
  const personToFamily = {}
  const processedPairs = new Set()

  nodesData.forEach(n => {
    const pid = n.id
    if (!parentToChildren[pid]) return
    const spouse = spouseOf[pid]
    const pairKey = spouse ? [pid, spouse].sort().join('|') : pid
    if (processedPairs.has(pairKey)) return
    processedPairs.add(pairKey)

    const parents = spouse ? [pid, spouse] : [pid]
    let children
    if (spouse && parentToChildren[spouse]) {
      const all = new Set([...parentToChildren[pid], ...parentToChildren[spouse]])
      children = [...all]
    } else {
      children = [...parentToChildren[pid]]
    }

    children.sort((a, b) => {
      const na = nodesData.find(x => x.id === a)
      const nb = nodesData.find(x => x.id === b)
      return (na?.birth_year || 9999) - (nb?.birth_year || 9999)
    })

    const idx = familyUnits.length
    familyUnits.push({ parents, children })
    parents.forEach(p => { personToFamily[p] = idx })
  })

  // Compute subtree widths
  const slotWidth = {}
  function getSlotWidth(id) {
    if (slotWidth[id] !== undefined) return slotWidth[id]
    const famIdx = personToFamily[id]
    if (famIdx !== undefined) {
      const fam = familyUnits[famIdx]
      const spouse = spouseOf[id]
      if (spouse && fam.parents[0] !== id) { slotWidth[id] = 0; return 0 }
      let childrenWidth = 0
      fam.children.forEach((cid, i) => {
        childrenWidth += Math.max(1, getSlotWidth(cid))
        if (i < fam.children.length - 1) childrenWidth += 0.15
      })
      const parentWidth = spouse ? 1.5 : 1
      slotWidth[id] = Math.max(parentWidth, childrenWidth)
      return slotWidth[id]
    }
    slotWidth[id] = 1
    return 1
  }
  nodesData.forEach(n => getSlotWidth(n.id))

  // Assign X positions top-down
  const xPos = {}
  const placed = new Set()

  function placeFamily(famIdx, centerX) {
    const fam = familyUnits[famIdx]
    if (fam.parents.length === 2) {
      xPos[fam.parents[0]] = centerX - SPOUSE_GAP / 2
      xPos[fam.parents[1]] = centerX + SPOUSE_GAP / 2
      placed.add(fam.parents[0])
      placed.add(fam.parents[1])
    } else {
      xPos[fam.parents[0]] = centerX
      placed.add(fam.parents[0])
    }

    if (fam.children.length === 0) return

    const childWidths = fam.children.map(cid => Math.max(1, slotWidth[cid]) * NODE_GAP)
    const totalChildWidth = childWidths.reduce((a, b) => a + b, 0)
    let cx = centerX - totalChildWidth / 2

    fam.children.forEach((cid, i) => {
      const w = childWidths[i]
      const childCenter = cx + w / 2
      xPos[cid] = childCenter
      placed.add(cid)

      const childFamIdx = personToFamily[cid]
      if (childFamIdx !== undefined) {
        const childFam = familyUnits[childFamIdx]
        if (childFam.parents[0] === cid) placeFamily(childFamIdx, childCenter)
      }
      cx += w
    })
  }

  // Find and place root families
  const rootFamilies = []
  familyUnits.forEach((fam, idx) => {
    const hasParent = childToParents[fam.parents[0]] && childToParents[fam.parents[0]].size > 0
    if (!hasParent) rootFamilies.push(idx)
  })

  let cursor = 0
  rootFamilies.forEach(famIdx => {
    const fam = familyUnits[famIdx]
    const primaryWidth = Math.max(1, slotWidth[fam.parents[0]]) * NODE_GAP
    placeFamily(famIdx, cursor + primaryWidth / 2)
    cursor += primaryWidth + FAMILY_GAP
  })

  // Center everything
  const allX = Object.values(xPos)
  if (allX.length) {
    const minX = Math.min(...allX)
    const maxX = Math.max(...allX)
    const offsetX = (width - (maxX - minX)) / 2 - minX
    Object.keys(xPos).forEach(id => { xPos[id] += offsetX })
  }

  // Place unplaced nodes
  const unplacedNodes = nodesData.filter(n => !placed.has(n.id))
  if (unplacedNodes.length) {
    const maxPlacedX = allX.length ? Math.max(...allX) + FAMILY_GAP : width / 2
    unplacedNodes.forEach((n, i) => {
      xPos[n.id] = maxPlacedX + i * NODE_GAP
      placed.add(n.id)
    })
  }

  // Compute Y positions
  const rowHeight = Math.min(140, (height - 160) / Math.max(genKeys.length, 1))
  const totalH = (genKeys.length - 1) * rowHeight
  const startY = (height - totalH) / 2

  const targets = {}
  const yMap = {}
  const genLabels = []

  genKeys.forEach((g, ri) => {
    genLabels.push({ label: `Gen ${g + 1}`, y: startY + ri * rowHeight })
  })

  nodesData.forEach(n => {
    const g = genMap[n.id] || 0
    const ri = genKeys.indexOf(g)
    const y = startY + ri * rowHeight
    targets[n.id] = { x: xPos[n.id] !== undefined ? xPos[n.id] : width / 2, y }
    yMap[n.id] = y
  })

  return { targets, yMap, genLabels, padding: 80, usableHeight: height - 160, rowHeight }
}
