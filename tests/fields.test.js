import { describe, it, expect, beforeEach } from 'vitest'
import { randomUUID } from 'crypto'
import { yearDate } from '../src/shared/calendarMath'
import { channelHandlers, EMPTY_DB, seedSampleData, migrateFieldSystem } from '../src/shared/dbCore'
import {
  coerceValue,
  composeGraphLabel,
  composeName,
  dateFromValue,
  formatValue,
  genderInfo,
  highlightFrom,
  lerpColorHex,
  slotAccepts
} from '../src/shared/fields'

const env = {
  uuid: () => randomUUID(),
  nowStr: () => '2026-01-01 00:00:00',
  storeImageFile: (p) => p,
  removeImageFile: () => {}
}

/** In-memory DB with one seeded project — no Electron, no disk. */
function makeDB() {
  const db = EMPTY_DB()
  const projectId = randomUUID()
  db.projects[projectId] = {
    id: projectId,
    name: 'T',
    created_at: env.nowStr(),
    updated_at: env.nowStr()
  }
  db.activeProjectId = projectId
  seedSampleData(db, projectId, env)
  return db
}

const def = (over = {}) => ({
  id: 'f1',
  project_id: 't1',
  label: 'Trait',
  type: 'text',
  config: {},
  locked: false,
  order: 0,
  has_timeframe: false,
  slot: null,
  slot_order: 0,
  icon: '',
  unit: '',
  sys: '',
  created_at: '2026-01-01 00:00:00',
  updated_at: '2026-01-01 00:00:00',
  ...over
})

// ─────────────────────────────────────────────────────────────────────────────
describe('coerceValue', () => {
  it('text: trims-to-null but keeps content verbatim', () => {
    const d = def({ type: 'text' })
    expect(coerceValue(d, '  ')).toBeNull()
    expect(coerceValue(d, 'Ellen ')).toBe('Ellen ')
    expect(coerceValue(d, null)).toBeNull()
  })

  it('boolean: false is a value, null is empty', () => {
    const d = def({ type: 'boolean' })
    expect(coerceValue(d, false)).toBe(false)
    expect(coerceValue(d, 1)).toBe(true)
    expect(coerceValue(d, null)).toBeNull()
  })

  it('select: only configured option ids pass', () => {
    const d = def({ type: 'select', config: { options: [{ id: 'a', label: 'A' }] } })
    expect(coerceValue(d, 'a')).toBe('a')
    expect(coerceValue(d, 'nope')).toBeNull()
  })

  it('slider: clamps into [min,max]', () => {
    const d = def({ type: 'slider', config: { min: 0, max: 10, step: 1 } })
    expect(coerceValue(d, 25)).toBe(10)
    expect(coerceValue(d, -5)).toBe(0)
    expect(coerceValue(d, 'x')).toBeNull()
  })

  it('number_range: one open side survives, both-empty is null', () => {
    const d = def({ type: 'number_range' })
    expect(coerceValue(d, { a: 1900, b: null })).toEqual({ a: 1900, b: null })
    expect(coerceValue(d, { a: '', b: '' })).toBeNull()
  })

  it('date: garbage and zero-years are null, valid shapes normalize', () => {
    const d = def({ type: 'date' })
    expect(coerceValue(d, { year: 1950 })).toEqual(yearDate(1950))
    expect(coerceValue(d, { year: 0 })).toBeNull()
    expect(coerceValue(d, 'hello')).toBeNull()
  })

  it('custom_date is reserved — never holds a value yet', () => {
    expect(coerceValue(def({ type: 'custom_date' }), { year: 5 })).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('slot semantics', () => {
  it('slot acceptance: name is text-only, highlight takes anything', () => {
    expect(slotAccepts('name', 'text')).toBe(true)
    expect(slotAccepts('name', 'slider')).toBe(false)
    expect(slotAccepts('gender', 'slider')).toBe(true)
    expect(slotAccepts('gender', 'date')).toBe(false)
    expect(slotAccepts('birth', 'number_range')).toBe(true)
    expect(slotAccepts('birth', 'custom_date')).toBe(true) // reserved but accepted
    expect(slotAccepts('highlight', 'boolean')).toBe(true)
  })

  it('genderInfo: select maps options across [0,1] with lowercased label', () => {
    const d = def({
      type: 'select',
      config: {
        options: [
          { id: 'male', label: 'Male' },
          { id: 'x', label: 'X' },
          { id: 'female', label: 'Female' }
        ]
      }
    })
    expect(genderInfo(d, 'male')).toEqual({ t: 0, label: 'male' })
    expect(genderInfo(d, 'x')).toEqual({ t: 0.5, label: 'x' })
    expect(genderInfo(d, 'female')).toEqual({ t: 1, label: 'female' })
    expect(genderInfo(d, null)).toEqual({ t: null, label: '' })
  })

  it('genderInfo: slider normalizes into [0,1]', () => {
    const d = def({ type: 'slider', config: { min: 0, max: 100 } })
    expect(genderInfo(d, 25).t).toBeCloseTo(0.25)
  })

  it('dateFromValue: ranges snapshot to their midpoint', () => {
    expect(dateFromValue(def({ type: 'number' }), 1950)).toEqual(yearDate(1950))
    expect(dateFromValue(def({ type: 'number_range' }), { a: 1900, b: 1910 })).toEqual(
      yearDate(1905)
    )
    expect(
      dateFromValue(def({ type: 'date_range' }), { from: yearDate(2000), to: yearDate(2010) })
    ).toEqual(yearDate(2005))
    expect(dateFromValue(def({ type: 'number_range' }), { a: 1900, b: null })).toEqual(
      yearDate(1900)
    )
  })

  it('highlightFrom: non-null rings, boolean must be true, colors resolve', () => {
    expect(highlightFrom(def({ type: 'text' }), 'anything')).toEqual({ color: '' })
    expect(highlightFrom(def({ type: 'boolean' }), false)).toBeNull()
    expect(highlightFrom(def({ type: 'boolean', config: { slotColor: '#ff0000' } }), true)).toEqual(
      { color: '#ff0000' }
    )
    const sel = def({
      type: 'select',
      config: { options: [{ id: 'a', label: 'A', color: '#00ff00' }] }
    })
    expect(highlightFrom(sel, 'a')).toEqual({ color: '#00ff00' })
    expect(highlightFrom(def({ type: 'text' }), null)).toBeNull()
  })

  it('lerpColorHex interpolates channels', () => {
    expect(lerpColorHex('#000000', '#ffffff', 0)).toBe('#000000')
    expect(lerpColorHex('#000000', '#ffffff', 1)).toBe('#ffffff')
    expect(lerpColorHex('#ff0000', '#0000ff', 0.5)).toBe('#800080')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('label composition', () => {
  const nameA = def({ id: 'n1', type: 'text', slot: 'name', slot_order: 0 })
  const nameB = def({ id: 'n2', type: 'text', slot: 'name', slot_order: 1 })
  const job = def({ id: 'j', type: 'text', label: 'Occupation', order: 5 })
  const height = def({ id: 'h', type: 'number', label: 'Height', unit: 'cm', order: 6 })

  it('composeName joins name-slot values in slot_order, skipping empties', () => {
    const valueOf = (id) => ({ n1: 'Ellen', n2: 'Ripley' })[id] ?? null
    expect(composeName([nameB, job, nameA], valueOf)).toBe('Ellen Ripley')
    expect(composeName([nameA, nameB], (id) => (id === 'n2' ? 'Ripley' : null))).toBe('Ripley')
  })

  it('composeGraphLabel appends displayed extras with · separators', () => {
    const valueOf = (id) => ({ j: 'Lieutenant', h: 180 })[id] ?? null
    const label = composeGraphLabel('Ellen', [nameA, job, height], valueOf, (id) => id !== 'n1')
    expect(label).toBe('Ellen · Lieutenant · 180 cm')
    expect(composeGraphLabel('', [job], valueOf, () => true)).toBe('Lieutenant')
  })

  it('formatValue: booleans read as the trait label when true', () => {
    const knight = def({ type: 'boolean', label: 'Knight' })
    expect(formatValue(knight, true)).toBe('Knight')
    expect(formatValue(knight, false)).toBe('')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('seeded projects & snapshots', () => {
  let db
  beforeEach(() => {
    db = makeDB()
  })

  it('seed creates the default locked defs with their slots', () => {
    const { defs } = channelHandlers['fields:list'](db, {}, env)
    const bySys = Object.fromEntries(defs.map((d) => [d.sys, d]))
    expect(defs).toHaveLength(7)
    expect(bySys.name).toMatchObject({ type: 'text', slot: 'name', locked: true })
    expect(bySys.gender).toMatchObject({ type: 'select', slot: 'gender', locked: true })
    expect(bySys.gender.config.options.map((o) => o.id)).toEqual(['male', 'female'])
    expect(bySys.birth).toMatchObject({ type: 'date', slot: 'birth' })
    expect(bySys.death).toMatchObject({ type: 'date', slot: 'death' })
    expect(bySys.bio.config.multiline).toBe(true)
  })

  it('sample persons keep their snapshot columns through adoption', () => {
    const robert = Object.values(db.persons).find((p) => p.name === 'Robert Anderson')
    expect(robert).toBeDefined()
    expect(robert.birth).toEqual(yearDate(1948))
    expect(robert.gender).toBe('male')
    expect(robert.gender_t).toBe(0)
    expect(robert.graph_label).toBe('Robert Anderson')
    expect(robert.occupation).toBe('Civil Engineer')
  })

  it('persons:create with the legacy payload lands in trait values', () => {
    const p = channelHandlers['persons:create'](
      db,
      { name: 'New Guy', gender: 'female', birth: yearDate(2000), occupation: 'Pilot' },
      env
    )
    expect(p.name).toBe('New Guy')
    expect(p.gender).toBe('female')
    expect(p.gender_t).toBe(1)
    const { defs, values } = channelHandlers['fields:list'](db, {}, env)
    const nameDef = defs.find((d) => d.sys === 'name')
    const v = values.find((x) => x.person_id === p.id && x.field_id === nameDef.id)
    expect(v.value).toBe('New Guy')
  })

  it('a person with no values at all is valid — snapshots go empty', () => {
    const p = channelHandlers['persons:create'](db, {}, env)
    expect(p.name).toBe('')
    expect(p.gender).toBe('unknown')
    expect(p.gender_t).toBeNull()
    expect(p.birth).toBeNull()
    expect(p.highlight).toBeNull()
  })

  it('an unrecognized gender becomes a new select option (round-trips)', () => {
    const p = channelHandlers['persons:create'](db, { name: 'X', gender: 'other' }, env)
    expect(p.gender).toBe('other')
    const genderDef = Object.values(db.field_defs).find((d) => d.sys === 'gender')
    expect(genderDef.config.options.map((o) => o.id)).toContain('other')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('fields:* channels', () => {
  let db, personId
  beforeEach(() => {
    db = makeDB()
    personId = Object.keys(db.persons)[0]
  })

  it('createDef appends at the end; personId attaches an empty value', () => {
    const { def: d, value } = channelHandlers['fields:createDef'](
      db,
      { label: 'Height', type: 'number', unit: 'cm', personId },
      env
    )
    expect(d.order).toBe(7) // after the 7 defaults (0..6)
    expect(d.locked).toBe(false)
    expect(value).toMatchObject({ person_id: personId, field_id: d.id, value: null })
  })

  it('createDef rejects reserved and unknown types', () => {
    expect(() =>
      channelHandlers['fields:createDef'](db, { label: 'X', type: 'custom_date' }, env)
    ).toThrow(/Unknown trait type/)
    expect(() => channelHandlers['fields:createDef'](db, { label: 'X', type: 'wat' }, env)).toThrow(
      /Unknown trait type/
    )
  })

  it('setValue updates the value and the person snapshot in one step', () => {
    const nameDef = Object.values(db.field_defs).find((d) => d.sys === 'name')
    const res = channelHandlers['fields:setValue'](
      db,
      { personId, fieldId: nameDef.id, value: 'Renamed' },
      env
    )
    expect(res.person.name).toBe('Renamed')
    expect(db.persons[personId].name).toBe('Renamed')
    expect(db.persons[personId].graph_label).toBe('Renamed')
  })

  it('display_in_graph feeds graph_label; applyDisplayAll needs a locked def', () => {
    const occDef = Object.values(db.field_defs).find((d) => d.sys === 'occupation')
    channelHandlers['fields:setValue'](
      db,
      { personId, fieldId: occDef.id, display_in_graph: true },
      env
    )
    const p = db.persons[personId]
    expect(p.graph_label).toBe(`${p.name} · ${p.occupation}`)

    const res = channelHandlers['fields:applyDisplayAll'](db, { fieldId: occDef.id, on: true }, env)
    expect(res.values.every((v) => v.display_in_graph)).toBe(true)
    for (const q of Object.values(db.persons)) {
      if (q.occupation) expect(q.graph_label).toContain(q.occupation)
    }

    const loose = channelHandlers['fields:createDef'](db, { label: 'L', type: 'text' }, env)
    expect(() =>
      channelHandlers['fields:applyDisplayAll'](db, { fieldId: loose.def.id, on: true }, env)
    ).toThrow(/Lock the trait/)
  })

  it('setValues batches upserts + removals and returns fresh snapshots', () => {
    const bySys = Object.fromEntries(Object.values(db.field_defs).map((d) => [d.sys, d]))
    const res = channelHandlers['fields:setValues'](
      db,
      {
        personId,
        values: [
          { field_id: bySys.name.id, value: 'Batch Name' },
          { field_id: bySys.birth.id, value: { year: 1912 } }
        ],
        removals: [bySys.occupation.id]
      },
      env
    )
    expect(res.person.name).toBe('Batch Name')
    expect(res.person.birth).toEqual(yearDate(1912))
    expect(res.person.occupation).toBe('')
    expect(res.values.some((v) => v.field_id === bySys.occupation.id)).toBe(false)
  })

  it('setSlot: validates acceptance, evicts single-slot occupants, auto-locks', () => {
    const num = channelHandlers['fields:createDef'](db, { label: 'Year no.', type: 'number' }, env)
    expect(() =>
      channelHandlers['fields:setSlot'](db, { fieldId: num.def.id, slot: 'name' }, env)
    ).toThrow(/Only text traits/)

    const oldBirth = Object.values(db.field_defs).find((d) => d.sys === 'birth')
    channelHandlers['fields:setSlot'](db, { fieldId: num.def.id, slot: 'birth' }, env)
    expect(db.field_defs[num.def.id]).toMatchObject({ slot: 'birth', locked: true })
    expect(db.field_defs[oldBirth.id].slot).toBeNull() // evicted

    // A second name-slot trait appends after the existing one
    const nick = channelHandlers['fields:createDef'](db, { label: 'Nickname', type: 'text' }, env)
    channelHandlers['fields:setSlot'](db, { fieldId: nick.def.id, slot: 'name' }, env)
    const nameDefs = Object.values(db.field_defs)
      .filter((d) => d.slot === 'name')
      .sort((a, b) => a.slot_order - b.slot_order)
    expect(nameDefs).toHaveLength(2)
    expect(nameDefs[1].id).toBe(nick.def.id)

    // Names compose in slot_order
    channelHandlers['fields:setValue'](db, { personId, fieldId: nick.def.id, value: '"Bob"' }, env)
    expect(db.persons[personId].name).toBe('Robert Anderson "Bob"')
  })

  it('unlocking a slotted def is rejected; vacating the slot allows it', () => {
    const nameDef = Object.values(db.field_defs).find((d) => d.sys === 'name')
    expect(() =>
      channelHandlers['fields:updateDef'](db, { id: nameDef.id, locked: false }, env)
    ).toThrow(/Remove the trait from its slot/)
    channelHandlers['fields:setSlot'](db, { fieldId: nameDef.id, slot: null }, env)
    const updated = channelHandlers['fields:updateDef'](db, { id: nameDef.id, locked: false }, env)
    expect(updated.locked).toBe(false)
    // With no name slot, names go blank
    expect(db.persons[personId].name).toBe('')
  })

  it('gender slot with a slider yields a gradient t and no label', () => {
    const slider = channelHandlers['fields:createDef'](
      db,
      { label: 'Presentation', type: 'slider', config: { min: 0, max: 100 } },
      env
    )
    channelHandlers['fields:setSlot'](db, { fieldId: slider.def.id, slot: 'gender' }, env)
    channelHandlers['fields:setValue'](db, { personId, fieldId: slider.def.id, value: 30 }, env)
    const p = db.persons[personId]
    expect(p.gender_t).toBeCloseTo(0.3)
    expect(p.gender).toBe('unknown')
  })

  it('highlight slot rings persons holding a value', () => {
    const flag = channelHandlers['fields:createDef'](
      db,
      { label: 'Royal', type: 'boolean', config: { slotColor: '#d4af37' } },
      env
    )
    channelHandlers['fields:setSlot'](db, { fieldId: flag.def.id, slot: 'highlight' }, env)
    channelHandlers['fields:setValue'](db, { personId, fieldId: flag.def.id, value: true }, env)
    expect(db.persons[personId].highlight).toEqual({ color: '#d4af37' })
    const other = Object.keys(db.persons)[1]
    expect(db.persons[other].highlight).toBeNull()
  })

  it('reorderDefs assigns positions from the given sequence', () => {
    const defs = channelHandlers['fields:list'](db, {}, env).defs
    const reversed = defs.map((d) => d.id).reverse()
    const out = channelHandlers['fields:reorderDefs'](db, { orderedIds: reversed }, env)
    expect(out.map((d) => d.id)).toEqual(reversed)
  })

  it('deleteDef cascades its values and refreshes snapshots', () => {
    const occDef = Object.values(db.field_defs).find((d) => d.sys === 'occupation')
    const before = Object.values(db.field_values).filter((v) => v.field_id === occDef.id).length
    expect(before).toBeGreaterThan(0)
    const res = channelHandlers['fields:deleteDef'](db, { id: occDef.id }, env)
    expect(res.removedValues).toBe(before)
    expect(Object.values(db.field_values).some((v) => v.field_id === occDef.id)).toBe(false)
    expect(db.persons[personId].occupation).toBe('Civil Engineer') // column frozen, def gone
  })

  it('persons:delete cascades that person’s values', () => {
    expect(Object.values(db.field_values).some((v) => v.person_id === personId)).toBe(true)
    channelHandlers['persons:delete'](db, { id: personId }, env)
    expect(Object.values(db.field_values).some((v) => v.person_id === personId)).toBe(false)
  })

  it('projects:delete cascades defs and values', () => {
    const pid = db.activeProjectId
    channelHandlers['projects:create'](db, { name: 'Other' }, env)
    channelHandlers['projects:delete'](db, { id: pid }, env)
    expect(Object.values(db.field_defs).some((d) => d.project_id === pid)).toBe(false)
    expect(Object.keys(db.field_values)).toHaveLength(0)
    // The surviving project got its own defaults on creation
    expect(Object.values(db.field_defs).length).toBe(7)
  })

  it('fields:list scopes to the active project', () => {
    channelHandlers['fields:createDef'](db, { label: 'Mine', type: 'text', personId }, env)
    const other = channelHandlers['projects:create'](db, { name: 'Other' }, env)
    channelHandlers['projects:setActive'](db, { id: other.id }, env)
    const { defs, values } = channelHandlers['fields:list'](db, {}, env)
    expect(defs).toHaveLength(7) // just the new project's defaults
    expect(defs.some((d) => d.label === 'Mine')).toBe(false)
    expect(values).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('migrateFieldSystem', () => {
  it('adopts legacy person columns into defs + values, idempotently', () => {
    const db = EMPTY_DB()
    db.projects.t1 = { id: 't1', name: 'T', created_at: '2024-01-01', updated_at: '2024-01-01' }
    db.activeProjectId = 't1'
    db.persons.p1 = {
      id: 'p1',
      project_id: 't1',
      name: 'Old Person',
      birth: yearDate(1980),
      death: null,
      gender: 'male',
      bio: 'Once upon a time',
      occupation: 'Baker',
      location: 'Oslo',
      created_at: '2024-01-01',
      updated_at: '2024-01-01'
    }
    // simulate an old store missing the tables entirely
    delete db.field_defs
    delete db.field_values

    expect(migrateFieldSystem(db, env)).toBe(true)
    expect(Object.values(db.field_defs)).toHaveLength(7)
    const p = db.persons.p1
    expect(p.name).toBe('Old Person')
    expect(p.birth).toEqual(yearDate(1980))
    expect(p.gender).toBe('male')
    expect(p.gender_t).toBe(0)
    expect(p.bio).toBe('Once upon a time')
    expect(p.graph_label).toBe('Old Person')
    // empty columns create no rows
    const deathDef = Object.values(db.field_defs).find((d) => d.sys === 'death')
    expect(Object.values(db.field_values).some((v) => v.field_id === deathDef.id)).toBe(false)

    // Second run: nothing changes
    const snapshot = JSON.stringify(db)
    expect(migrateFieldSystem(db, env)).toBe(false)
    expect(JSON.stringify(db)).toBe(snapshot)
  })
})
