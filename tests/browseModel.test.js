import { describe, it, expect } from 'vitest'
import { randomUUID } from 'crypto'
import {
  channelHandlers,
  createInitialDB,
  PROJECT_FILE_FORMAT,
  PROJECT_FILE_VERSION
} from '../src/shared/dbCore'
import {
  PROFILES,
  PROJECTS,
  COLLECTIONS,
  ACTIVITY
} from '../src/renderer/src/components/browse/browseData'
import {
  can,
  parseRel,
  relsOf,
  layoutTree,
  treeOf,
  fold,
  searchProjects,
  matchesFilters,
  EMPTY_FILTERS,
  sortProjects,
  recommend,
  similarity,
  similarProjects,
  funFacts,
  toProjectFile
} from '../src/renderer/src/components/browse/browseModel'

const env = {
  uuid: () => randomUUID(),
  nowStr: () => '2026-01-01 00:00:00',
  storeImageFile: (p) => p,
  removeImageFile: () => {}
}
const invoke = (db, channel, data, ctx) => channelHandlers[channel](db, data, env, ctx)
const byId = (id) => PROJECTS.find((p) => p.id === id)
const noSignals = { liked: [], saved: [], viewed: [], followed: [], grafted: [], locale: 'en' }

describe('mock data integrity', () => {
  it('every relationship, group, comment and activity row points at something real', () => {
    const profileIds = new Set(PROFILES.map((p) => p.id))
    const projectIds = new Set(PROJECTS.map((p) => p.id))
    expect(projectIds.size).toBe(PROJECTS.length)
    for (const p of PROJECTS) {
      const people = new Set(p.people.map((r) => r[0]))
      expect(people.size, p.id).toBe(p.people.length)
      expect(profileIds.has(p.authorId), p.id).toBe(true)
      for (const r of relsOf(p)) {
        expect(people.has(r.a), `${p.id}: ${r.a}`).toBe(true)
        expect(people.has(r.b), `${p.id}: ${r.b}`).toBe(true)
      }
      for (const members of Object.values(p.groups || {})) {
        for (const m of members) expect(people.has(m), `${p.id} group: ${m}`).toBe(true)
      }
      for (const [who] of p.comments) expect(profileIds.has(who), `${p.id} comment`).toBe(true)
    }
    for (const c of COLLECTIONS)
      for (const id of c.projectIds) expect(projectIds.has(id)).toBe(true)
    for (const [who, , pid] of ACTIVITY) {
      expect(profileIds.has(who)).toBe(true)
      expect(projectIds.has(pid)).toBe(true)
    }
  })
})

describe('access ladder', () => {
  it('is cumulative', () => {
    expect(can('glasshouse', 'view')).toBe(true)
    expect(can('glasshouse', 'export')).toBe(false)
    expect(can('seedbank', 'export')).toBe(true)
    expect(can('seedbank', 'fork')).toBe(false)
    expect(can('graft', 'fork')).toBe(true)
    expect(can('graft', 'edit')).toBe(false)
    expect(can('grove', 'edit')).toBe(true)
    expect(can(undefined, 'export')).toBe(false) // unset reads as glasshouse
  })
})

describe('parseRel', () => {
  it('expands comma lists and reads modifiers + label', () => {
    const rows = parseRel('henry8,anneB > elizabeth1')
    expect(rows).toHaveLength(2)
    expect(rows.every((r) => r.type === 'parent_child' && r.b === 'elizabeth1')).toBe(true)
    const [m] = parseRel('henry8 = anneB @1533 |1536 : executed')
    expect(m).toMatchObject({ type: 'spouse', formed: 1533, ended: 1536, label: 'executed' })
    expect(parseRel('a >> b')[0].type).toBe('adopted')
    expect(parseRel('a _ b')[0].type).toBe('subordinate')
  })

  it('rejects unknown operators', () => {
    expect(() => parseRel('a ?? b')).toThrow(/Bad relationship/)
  })
})

describe('layoutTree', () => {
  it('puts every child below all of its parents, in every mock project', () => {
    for (const p of PROJECTS) {
      const t = treeOf(p)
      const gen = new Map(t.nodes.map((n) => [n.id, n.gen]))
      for (const l of t.links) {
        if (l.kind === 'parent')
          expect(gen.get(l.b), `${p.id} ${l.a}>${l.b}`).toBeGreaterThan(gen.get(l.a))
      }
    }
  })

  it('never stacks two people on the same spot', () => {
    for (const p of PROJECTS) {
      const seen = new Set()
      for (const n of treeOf(p).nodes) {
        const key = `${n.gen}:${Math.round(n.x * 100)}`
        expect(seen.has(key), `${p.id} ${n.id}`).toBe(false)
        seen.add(key)
      }
      // Neighbours in a row keep at least one unit apart.
      const rows = new Map()
      for (const n of treeOf(p).nodes) rows.set(n.gen, [...(rows.get(n.gen) || []), n.x])
      for (const xs of rows.values()) {
        xs.sort((a, b) => a - b)
        for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThan(0.999)
      }
    }
  })

  it('pulls a married-in spouse onto their partner’s row', () => {
    const t = layoutTree(
      [
        ['dad', 'Dad', 'm', null, null],
        ['kid', 'Kid', 'm', null, null],
        ['inlaw', 'In-law', 'f', null, null],
        ['grandkid', 'Grandkid', 'f', null, null]
      ],
      ['dad > kid', 'kid = inlaw', 'kid,inlaw > grandkid'].flatMap(parseRel)
    )
    const gen = Object.fromEntries(t.nodes.map((n) => [n.id, n.gen]))
    expect(gen).toEqual({ dad: 0, kid: 1, inlaw: 1, grandkid: 2 })
    expect(t.generations).toBe(3)
  })

  it('lowers a root parent to sit just above its child (Mr. Satan → Videl)', () => {
    const t = treeOf(byId('sonfamily'))
    const gen = Object.fromEntries(t.nodes.map((n) => [n.id, n.gen]))
    expect(gen.videl).toBe(gen.gohan)
    expect(gen.satan).toBe(gen.videl - 1)
  })
})

describe('search', () => {
  it('finds a project by a person inside it and reports who matched', () => {
    const [hit] = searchProjects(PROJECTS, PROFILES, 'itachi')
    expect(hit.project.id).toBe('uchiha')
    expect(hit.people).toContain('Itachi Uchiha')
  })

  it('folds diacritics and matches CJK substrings', () => {
    expect(fold('Ōtsutsuki')).toBe('otsutsuki')
    expect(searchProjects(PROJECTS, PROFILES, 'otsutsuki')[0].project.id).toBe('uchiha')
    expect(searchProjects(PROJECTS, PROFILES, '武则天')[0].project.id).toBe('tang')
    expect(searchProjects(PROJECTS, PROFILES, '皆大歡喜')[0].project.id).toBe('jdhx')
  })

  it('@handle narrows to a creator; every term must match', () => {
    const ids = searchProjects(PROJECTS, PROFILES, '@tudor_rose').map((h) => h.project.id)
    expect(ids.sort()).toEqual(['romanovs', 'tudors'])
    expect(searchProjects(PROJECTS, PROFILES, '@tudor_rose tsar').map((h) => h.project.id)).toEqual(
      ['romanovs']
    )
    expect(searchProjects(PROJECTS, PROFILES, 'itachi zzzqx')).toHaveLength(0)
  })

  it('empty query returns everything', () => {
    expect(searchProjects(PROJECTS, PROFILES, '  ')).toHaveLength(PROJECTS.length)
  })
})

describe('filters & sorting', () => {
  it('filters by genre, access set, size and language', () => {
    const dyn = PROJECTS.filter((p) => matchesFilters(p, { ...EMPTY_FILTERS, genre: 'dynasty' }))
    expect(dyn.map((p) => p.id).sort()).toEqual(['caowei', 'ming', 'qing', 'tang'])
    const groves = PROJECTS.filter((p) =>
      matchesFilters(p, { ...EMPTY_FILTERS, access: ['grove'] })
    )
    expect(groves.every((p) => p.access === 'grove')).toBe(true)
    const hant = PROJECTS.filter((p) => matchesFilters(p, { ...EMPTY_FILTERS, lang: 'zh-Hant' }))
    expect(hant.map((p) => p.id)).toEqual(['jdhx'])
    const cozy = PROJECTS.filter((p) => matchesFilters(p, { ...EMPTY_FILTERS, size: 'cozy' }))
    expect(cozy.every((p) => p.people.length <= 15)).toBe(true)
  })

  it('sorts by the chosen key without mutating the input', () => {
    const before = PROJECTS.map((p) => p.id)
    expect(sortProjects(PROJECTS, 'loved')[0].id).toBe('qing')
    expect(sortProjects(PROJECTS, 'largest')[0].people.length).toBe(
      Math.max(...PROJECTS.map((p) => p.people.length))
    )
    expect(sortProjects(PROJECTS, 'ancient')[0].id).toBe('caowei')
    expect(PROJECTS.map((p) => p.id)).toEqual(before)
  })
})

describe('recommendations', () => {
  it('cold start leans on the viewer’s language', () => {
    const recs = recommend(PROJECTS, { ...noSignals, locale: 'zh-Hans' }, 4)
    expect(recs.every((r) => r.project.lang.startsWith('zh'))).toBe(true)
    expect(recs[0].reason.kind).toBe('lang')
  })

  it('learns from likes, explains why, and hides what you already liked', () => {
    const recs = recommend(PROJECTS, { ...noSignals, liked: ['tudors'] }, 5)
    expect(recs.some((r) => r.project.id === 'tudors')).toBe(false)
    const top = recs[0]
    expect(top.project.genre).toBe('history')
    expect(top.reason).toEqual({ kind: 'because', ref: 'tudors' })
  })

  it('surfaces followed creators and matches the viewer’s own projects', () => {
    const follow = recommend(PROJECTS, { ...noSignals, followed: ['edo_archive'] }, 3)
    expect(follow[0].project.id).toBe('tokugawa')
    expect(follow[0].reason).toEqual({ kind: 'creator', ref: 'edo_archive' })
    const own = recommend(PROJECTS, { ...noSignals, ownText: 'My Naruto fan tree' }, 3)
    expect(own[0].project.id).toBe('uchiha')
    expect(own[0].reason).toEqual({ kind: 'yours', ref: 'naruto' })
  })

  it('similarity is symmetric-ish and prefers the same genre', () => {
    expect(similarity(byId('tang'), byId('ming'))).toBeGreaterThan(
      similarity(byId('tang'), byId('simpsons'))
    )
    const sims = similarProjects(byId('tang'), PROJECTS, 3)
    expect(sims.every((p) => p.genre === 'dynasty')).toBe(true)
  })
})

describe('fun facts', () => {
  it('knows Henry VIII married six times and Elizabeth I outlived most', () => {
    const facts = funFacts(byId('tudors'))
    expect(facts.find((f) => f.key === 'married')).toMatchObject({ name: 'Henry VIII', n: 6 })
    const longest = facts.find((f) => f.key === 'longest')
    expect(longest.n).toBe(
      Math.max(
        ...byId('tudors')
          .people.filter((p) => p[3] && p[4])
          .map((p) => p[4] - p[3])
      )
    )
    expect(facts.find((f) => f.key === 'gens').n).toBe(treeOf(byId('tudors')).generations)
  })
})

describe('toProjectFile → projects:import (graft)', () => {
  it('uses the core’s file format constants', () => {
    const file = toProjectFile(byId('uchiha'), PROFILES[0], '2026-01-01 00:00:00')
    expect(file.format).toBe(PROJECT_FILE_FORMAT)
    expect(file.version).toBe(PROJECT_FILE_VERSION)
  })

  it('imports every mock project as a real project with traits, bonds and groups', () => {
    for (const bp of PROJECTS) {
      const db = createInitialDB(env)
      const author = PROFILES.find((p) => p.id === bp.authorId)
      const file = JSON.parse(JSON.stringify(toProjectFile(bp, author, env.nowStr())))
      const created = invoke(db, 'projects:import', { file })
      const persons = Object.values(db.persons).filter((p) => p.project_id === created.id)
      expect(persons, bp.id).toHaveLength(bp.people.length)
      expect(persons.map((p) => p.name).sort()).toEqual(bp.people.map((p) => p[1]).sort())
      const rels = Object.values(db.relationships).filter((r) => r.project_id === created.id)
      expect(rels, bp.id).toHaveLength(relsOf(bp).length)
      const tags = Object.values(db.tags).filter((t) => t.project_id === created.id)
      expect(tags).toHaveLength(Object.keys(bp.groups || {}).length)
      const scene = Object.values(db.scenes).find((s) => s.project_id === created.id)
      expect(scene.type).toBe('generations')
      expect(created.visibility).toBe('private')
      expect(created.description).toContain(`@${author.username}`)
    }
  })

  it('adopts birth/death years and gender into trait values', () => {
    const db = createInitialDB(env)
    const file = JSON.parse(JSON.stringify(toProjectFile(byId('tudors'), undefined, env.nowStr())))
    const created = invoke(db, 'projects:import', { file })
    const henry = Object.values(db.persons).find(
      (p) => p.project_id === created.id && p.name === 'Henry VIII'
    )
    expect(henry.birth.year).toBe(1491)
    expect(henry.death.year).toBe(1547)
    expect(henry.gender).toBe('male')
    const annulled = Object.values(db.relationships).find(
      (r) => r.project_id === created.id && r.label === 'annulled'
    )
    expect(annulled.status).toBe('divorced')
    expect(annulled.ended.year).toBeGreaterThan(1500)
  })
})

describe('projects:update access', () => {
  it('accepts the four ladder modes and rejects anything else', () => {
    const db = createInitialDB(env)
    const id = db.activeProjectId
    expect(invoke(db, 'projects:update', { id, access: 'graft' }).access).toBe('graft')
    expect(() => invoke(db, 'projects:update', { id, access: 'admin' })).toThrow(/Invalid access/)
  })
})
