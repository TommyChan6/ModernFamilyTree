import { describe, it, expect, beforeEach } from 'vitest'
import { randomUUID } from 'crypto'
import { channelHandlers, createInitialDB } from '../src/shared/dbCore'
import {
  sanitizeDate,
  eraLanes,
  erasAt,
  erasLivedThrough,
  eventsOf,
  presetEras,
  eventKind
} from '../src/shared/chronicle'

const env = {
  uuid: () => randomUUID(),
  nowStr: () => '2026-01-01 00:00:00',
  storeImageFile: (p) => p,
  removeImageFile: () => {}
}
const invoke = (db, channel, data) => channelHandlers[channel](db, data, env)
const Y = (year) => ({ year, month: null, day: null, precision: 'year', calendar: 'gregorian' })

let db
beforeEach(() => {
  db = createInitialDB(env)
})
const people = () => Object.values(db.persons).filter((p) => p.project_id === db.activeProjectId)

describe('sanitizeDate', () => {
  it('accepts years, strings and DateValue-ish objects', () => {
    expect(sanitizeDate(1914)).toEqual(Y(1914))
    expect(sanitizeDate('1066')).toEqual(Y(1066))
    expect(sanitizeDate({ year: 1990, month: 6, day: 12 })).toMatchObject({
      year: 1990,
      month: 6,
      day: 12,
      precision: 'day'
    })
    expect(sanitizeDate({ year: 1990, month: 13 })).toMatchObject({
      month: null,
      precision: 'year'
    })
    expect(sanitizeDate('')).toBeNull()
    expect(sanitizeDate('soon')).toBeNull()
    expect(sanitizeDate({ month: 3 })).toBeNull()
  })
})

describe('eras channels', () => {
  it('creates, sanitizes, patches and deletes eras', () => {
    const e = invoke(db, 'eras:save', {
      name: '  The Regency  ',
      start: 1820,
      end: 1811, // reversed → put in order
      color: 'not-a-colour',
      icon: '🎩'
    })
    expect(e.project_id).toBe(db.activeProjectId)
    expect(e.name).toBe('The Regency')
    expect(e.start.year).toBe(1811)
    expect(e.end.year).toBe(1820)
    expect(e.color).toBe('#6c8ef5')
    const patched = invoke(db, 'eras:save', { id: e.id, color: '#d4af37', end: null })
    expect(patched.color).toBe('#d4af37')
    expect(patched.end).toBeNull()
    expect(invoke(db, 'eras:getAll')).toHaveLength(1)
    invoke(db, 'eras:delete', { id: e.id })
    expect(invoke(db, 'eras:getAll')).toHaveLength(0)
  })

  it('saves a preset pack as one undoable write', () => {
    const seeds = presetEras('world', 1880, 1960)
    expect(seeds.map((s) => s.name)).toContain('World War I')
    expect(seeds.map((s) => s.name)).not.toContain('Digital Age')
    const saved = invoke(db, 'eras:saveMany', { eras: seeds })
    expect(saved).toHaveLength(seeds.length)
    invoke(db, 'history:undo')
    expect(invoke(db, 'eras:getAll')).toHaveLength(0)
    invoke(db, 'history:redo')
    expect(invoke(db, 'eras:getAll')).toHaveLength(seeds.length)
  })
})

describe('events channels', () => {
  it('creates events with a sanitized cast and kind', () => {
    const [a, b] = people()
    const ev = invoke(db, 'events:save', {
      title: 'Battle of the Bridge',
      kind: 'battle',
      date: { year: 1915, month: 4 },
      importance: 9,
      person_ids: [a.id, b.id, a.id, 'ghost']
    })
    expect(ev.kind).toBe('battle')
    expect(ev.importance).toBe(3)
    expect(ev.person_ids).toEqual([a.id, b.id])
    expect(ev.date).toMatchObject({ year: 1915, month: 4, precision: 'month' })
    const odd = invoke(db, 'events:save', { title: '', kind: 'dragon' })
    expect(odd.title).toBe('Untitled event')
    expect(odd.kind).toBe('custom')
  })

  it('drops a deleted person from the cast — and undo brings them back', () => {
    const [a, b] = people()
    const ev = invoke(db, 'events:save', { title: 'Wedding', person_ids: [a.id, b.id] })
    invoke(db, 'persons:delete', { id: a.id })
    expect(db.events[ev.id].person_ids).toEqual([b.id])
    invoke(db, 'history:undo')
    expect(db.events[ev.id].person_ids).toEqual([a.id, b.id])
  })

  it('is scoped to the active project', () => {
    const ev = invoke(db, 'events:save', { title: 'Mine' })
    const other = invoke(db, 'projects:create', { name: 'Other' })
    invoke(db, 'projects:setActive', { id: other.id })
    expect(invoke(db, 'events:getAll')).toHaveLength(0)
    expect(() => invoke(db, 'events:delete', { id: ev.id })).toThrow()
  })
})

describe('project files carry the chronicle', () => {
  it('exports and imports eras + events with the cast remapped', () => {
    const [a] = people()
    invoke(db, 'eras:save', { name: 'Golden Age', start: 1900, end: 1950 })
    invoke(db, 'events:save', {
      title: 'Founding',
      kind: 'founding',
      date: 1920,
      person_ids: [a.id]
    })
    const file = invoke(db, 'projects:export', { id: db.activeProjectId })
    expect(file.rows.eras).toHaveLength(1)
    expect(file.rows.events).toHaveLength(1)
    const imported = invoke(db, 'projects:import', { file })
    invoke(db, 'projects:setActive', { id: imported.id })
    const evs = invoke(db, 'events:getAll')
    expect(evs).toHaveLength(1)
    expect(evs[0].person_ids).toHaveLength(1)
    expect(evs[0].person_ids[0]).not.toBe(a.id)
    expect(db.persons[evs[0].person_ids[0]].project_id).toBe(imported.id)
    expect(invoke(db, 'eras:getAll')[0].name).toBe('Golden Age')
  })

  it('deleting a project removes its chronicle', () => {
    invoke(db, 'eras:save', { name: 'X', start: 1 })
    invoke(db, 'events:save', { title: 'Y' })
    const pid = db.activeProjectId
    invoke(db, 'projects:create', { name: 'Keep' })
    invoke(db, 'projects:delete', { id: pid })
    expect(Object.values(db.eras).filter((e) => e.project_id === pid)).toHaveLength(0)
    expect(Object.values(db.events).filter((e) => e.project_id === pid)).toHaveLength(0)
  })
})

describe('time math', () => {
  const era = (id, s, e) => ({
    id,
    name: id,
    start: s == null ? null : Y(s),
    end: e == null ? null : Y(e)
  })
  const eras = [
    era('A', 1900, 1950),
    era('B', 1940, 1960),
    era('C', 1950, 1970),
    era('Open', null, 1800)
  ]

  it('stacks overlapping eras into lanes', () => {
    const { lane, count } = eraLanes(eras)
    expect(lane.get('A')).not.toBe(lane.get('B'))
    expect(lane.get('C')).toBe(lane.get('A')) // A ends where C starts
    expect(count).toBe(2)
  })
  it('finds the eras of a year and of a life', () => {
    expect(
      erasAt(eras, 1945)
        .map((e) => e.id)
        .sort()
    ).toEqual(['A', 'B'])
    expect(erasAt(eras, 1700).map((e) => e.id)).toEqual(['Open'])
    expect(erasLivedThrough(eras, Y(1930), Y(1955), 2026).map((e) => e.id)).toEqual(['A', 'B', 'C'])
    expect(erasLivedThrough(eras, null, null, 2026)).toEqual([])
  })
  it('orders a person’s events', () => {
    const evs = [
      { id: '2', date: Y(1950), person_ids: ['p'] },
      { id: '1', date: Y(1920), person_ids: ['p'] },
      { id: 'x', date: Y(1900), person_ids: ['q'] }
    ]
    expect(eventsOf(evs, 'p').map((e) => e.id)).toEqual(['1', '2'])
  })
  it('fits presets to the project', () => {
    expect(presetEras('centuries', 1750, 1920).map((e) => e.name)).toEqual([
      '18th century',
      '19th century',
      '20th century'
    ])
    const fantasy = presetEras('fantasy', 100, 500)
    expect(fantasy).toHaveLength(4)
    expect(fantasy[0].start).toBe(100)
    expect(fantasy[3].end).toBeNull()
    expect(eventKind('nope').id).toBe('custom')
  })
})

describe('view model + timeline range', () => {
  it('resolves spans, lanes and kind defaults for the renderers', async () => {
    const { chronicleViewModel, chronicleRange } =
      await import('../src/renderer/src/components/chronicle/chronicleModel.js')
    const vm = chronicleViewModel(
      [{ id: 'e', name: 'E', icon: '', color: '#ffffff', start: Y(1900), end: null }],
      [
        {
          id: 'v',
          title: 'V',
          kind: 'battle',
          icon: '',
          color: '',
          date: Y(1916),
          end: null,
          importance: 3,
          person_ids: ['p']
        }
      ]
    )
    expect(vm.eras[0]).toMatchObject({ a: 1900, b: Infinity, lane: 0 })
    expect(vm.events[0]).toMatchObject({ icon: 'swords', color: '#e5534b', a: 1916, importance: 3 })
    expect(Number.isNaN(vm.events[0].b)).toBe(true)
    const r = chronicleRange([{ birth: Y(1950), death: null }], [], [{ date: Y(1800) }], 2026)
    expect(r.min).toBe(1800)
  })
  it('stretches the timeline axis to reach dated events', async () => {
    const { computeTimelineLayout } =
      await import('../src/renderer/src/components/timeline/timelineLayout.js')
    const persons = [{ id: 'a', name: 'A', birth: Y(1950), death: null }]
    expect(computeTimelineLayout(persons, [], 2026).minYear).toBe(1950)
    expect(computeTimelineLayout(persons, [], 2026, null, null, [1890.5]).minYear).toBe(1890)
  })
})
