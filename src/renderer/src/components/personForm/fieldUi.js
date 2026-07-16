// UI metadata for the trait system — display names, glyphs and micro-preview
// hints for each field type. Pure data; the logic lives in src/shared/fields.ts.

export const FIELD_TYPE_META = [
  { type: 'text', glyph: 'Aa', label: 'Text', hint: 'Free text' },
  { type: 'boolean', glyph: '◐', label: 'Yes / No', hint: 'A true/false switch' },
  { type: 'number', glyph: '#', label: 'Number', hint: 'One number, optional unit' },
  { type: 'number_range', glyph: '↔', label: 'Number range', hint: 'Uncertain span (a–b)' },
  { type: 'select', glyph: '▾', label: 'Selection', hint: 'Pick one option' },
  { type: 'slider', glyph: '⬌', label: 'Slider', hint: 'A value between two ends' },
  { type: 'date', glyph: '☾', label: 'Date', hint: 'A point in time' },
  { type: 'date_range', glyph: '⧖', label: 'Date range', hint: 'Uncertain time span' }
]

export const typeMeta = (type) =>
  FIELD_TYPE_META.find((m) => m.type === type) || { type, glyph: '?', label: type, hint: '' }

export const SLOT_META = [
  { slot: 'name', glyph: '❖', label: 'Name', hint: 'Text traits · order = word order' },
  { slot: 'gender', glyph: '⚥', label: 'Gender', hint: 'Maps onto the color gradient' },
  { slot: 'birth', glyph: '☀', label: 'Birth', hint: 'Dates, years or ranges' },
  { slot: 'death', glyph: '☽', label: 'Death', hint: 'Dates, years or ranges' },
  { slot: 'highlight', glyph: '◎', label: 'Highlight', hint: 'Any value rings the node' }
]
